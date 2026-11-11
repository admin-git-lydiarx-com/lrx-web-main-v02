"""Split the LydiaRx v3 wireframe into a static multi-page site.

Usage: python3 -I build_site.py <wireframe.html> <out_dir>
"""
import base64, hashlib, os, re, sys
from bs4 import BeautifulSoup, Comment

src, out = sys.argv[1], sys.argv[2]
soup = BeautifulSoup(open(src, encoding="utf-8").read(), "html.parser")

PAGES = ["home", "programmes", "pakistan", "questions", "platform", "governance",
         "research", "about", "people", "news", "contact"]
FILE = {p: ("index.html" if p == "home" else f"{p}.html") for p in PAGES}
TITLES = {
    "home": "LydiaRx | Sovereign genomics, delivered",
    "programmes": "Programmes in motion | LydiaRx",
    "pakistan": "Pakistan National Genome Programme | LydiaRx",
    "questions": "Questions governments ask | LydiaRx",
    "platform": "Platform | LydiaRx",
    "governance": "Governance | LydiaRx",
    "research": "Research access | LydiaRx",
    "about": "About | LydiaRx",
    "people": "The people | LydiaRx",
    "news": "News | LydiaRx",
    "contact": "Contact | LydiaRx",
}
# Which page each in-page anchor lives on
anchor_page = {}
for sec in soup.select("section.page"):
    for el in sec.select("[id]"):
        anchor_page[el["id"]] = sec["id"]

os.makedirs(os.path.join(out, "assets", "img"), exist_ok=True)

# ---- shared stylesheet -------------------------------------------------
style = soup.find("style")
css = style.string
css = css.replace(".page{ display:none; } .page.active{ display:block; }", "")
open(os.path.join(out, "assets", "site.css"), "w", encoding="utf-8").write(
    "/* LydiaRx site styles, derived from the website v3 prototype */\n" + css.strip() + "\n")

# ---- strip prototype-only material ------------------------------------
for el in soup.select("div.slate"):
    el.decompose()
for el in soup.select("p.note"):
    el.decompose()
for el in soup.select("span.gate"):
    parent = el.parent
    el.decompose()
    if parent and parent.name in ("p", "li", "div") and not parent.get_text(strip=True) and not parent.find(["img", "svg", "a"]):
        parent.decompose()
for c in soup.find_all(string=lambda t: isinstance(t, Comment)):
    c.extract()

# Footer: drop unfilled placeholders and links to policy pages that don't exist yet
for div in soup.select("footer.foot div"):
    for t in div.find_all(string=True):
        if "[address]" in t or "[VAT" in t:
            t.replace_with(re.sub(r"\s*Registered office: \[address\]\.\s*\[VAT number, if registered\.\]", "", t))
for a in soup.select("footer.foot a"):
    if a.get("href") == "#":
        a.decompose()

# Contact: remove placeholder rows; replace the non-working form with an email panel
for li in soup.select("#contact ul.rule li"):
    txt = li.get_text(" ", strip=True)
    if "[Registered office address]" in txt or "[number]" in txt:
        li.decompose()
form = soup.select_one("#contact div.form")
if form:
    panel = BeautifulSoup(
        '<div class="form" style="border-top:0;padding-top:0">'
        '<h3>Write to us</h3>'
        '<p>Email <a href="mailto:hello@lydiarx.com">hello@lydiarx.com</a>. Tell us who you are: a government or public '
        'institution, a funder or research partner, a pharmaceutical or biotechnology company, a research institution, '
        'or press. A briefing is with a founder. We reply within two working days.</p>'
        '<a class="btn" href="mailto:hello@lydiarx.com?subject=Briefing%20request">Email us</a></div>',
        "html.parser")
    form.replace_with(panel)

# ---- images: data URIs -> files ----------------------------------------
seen = {}
for img in soup.find_all("img"):
    m = re.match(r"data:image/(jpeg|png);base64,(.+)", img.get("src", ""), re.S)
    if not m:
        continue
    data = base64.b64decode(m.group(2))
    h = hashlib.sha1(data).hexdigest()[:10]
    if h not in seen:
        name = re.sub(r"[^a-z0-9]+", "-", (img.get("alt") or "image").lower()).strip("-") or "image"
        fn = f"{name}-{h}.{'jpg' if m.group(1) == 'jpeg' else 'png'}"
        open(os.path.join(out, "assets", "img", fn), "wb").write(data)
        seen[h] = fn
    img["src"] = f"assets/img/{seen[h]}"
    img["loading"] = "lazy"

# ---- links: hash routes -> files ---------------------------------------
def fix(href):
    if not href or not href.startswith("#"):
        return href
    parts = [p for p in href.split("#") if p]
    if not parts:
        return href
    first = parts[0]
    if first in FILE:
        return FILE[first] + ("#" + parts[1] if len(parts) > 1 else "")
    if first in anchor_page:
        return FILE[anchor_page[first]] + "#" + first
    return href

for a in soup.find_all("a"):
    if a.get("href"):
        a["href"] = fix(a["href"])

# ---- write pages --------------------------------------------------------
desc = soup.find("meta", attrs={"name": "description"})["content"]
for sec in soup.select("section.page"):
    pid = sec["id"]
    sec["class"] = ["page-body"]
    del sec["id"]
    html = f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{TITLES[pid]}</title>
<meta name="description" content="{desc}">
<link rel="stylesheet" href="assets/site.css">
</head>
<body id="{pid}">
{sec.decode_contents().strip()}
</body>
</html>
"""
    open(os.path.join(out, FILE[pid]), "w", encoding="utf-8").write(html)

print("pages:", len(soup.select("section.page")), "images:", len(seen))
