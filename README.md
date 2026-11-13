# LydiaRx website

The public LydiaRx website, built from the website v3 prototype (29 October 2026).

## What's here

- `site/`: the website itself. Plain HTML pages with one shared stylesheet (`site/assets/site.css`) and images in `site/assets/img/`. No build step is needed.
- `.github/workflows/pages.yml`: publishes `site/` to GitHub Pages every time a change lands on `main`.
- `tools/build_site.py`: the script that split the single-file prototype into these pages. It's kept for reference only; edit the pages in `site/` directly from now on.

## Pages

| Page | File |
|---|---|
| Home | `site/index.html` |
| Programmes in motion | `site/programmes.html` |
| Pakistan National Genome Programme | `site/pakistan.html` |
| Questions governments ask | `site/questions.html` |
| Platform | `site/platform.html` |
| Governance | `site/governance.html` |
| Research access | `site/research.html` |
| About | `site/about.html` |
| The people | `site/people.html` |
| News | `site/news.html` |
| Contact | `site/contact.html` |

## Making a change

1. Edit the page in `site/` (on GitHub, open the file and click the pencil icon).
2. Commit to `main`. The site republishes automatically within a minute or two; progress shows under the **Actions** tab.

To preview locally, open `site/index.html` in a browser.

## Not yet on the site

These items from the prototype were left out because they weren't ready to publish:

- the prototype's internal build notes and amber publish-gate notes
- the registered office address, VAT number and telephone number (placeholders in the prototype)
- links to the Privacy Policy, Cookie Policy and Terms of Use, which haven't been written yet
- the contact form, which had no back end; the Contact page now has an "Email us" button instead
