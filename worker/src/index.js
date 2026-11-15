// LydiaRx contact form Worker.
//
// Receives the Contact page form, checks it came from a real visitor
// (Cloudflare Turnstile plus a hidden decoy field), and emails it to the
// LydiaRx inbox. The inbox address is a Cloudflare secret (TO_ADDRESS),
// so it never appears in this public repository or on the website.

import { EmailMessage } from "cloudflare:email";

const ROLES = [
  "Government or public institution",
  "Funder or research partner",
  "Pharmaceutical or biotechnology company",
  "Research institution",
  "Press",
  "Other",
];

const LIMITS = { name: 120, organisation: 160, email: 200, message: 5000 };
const EMAIL_RE = /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[^\s@<>"',;:]{2,}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = allowedOrigins(env);
    const cors = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: allowed.includes(origin) ? 204 : 403, headers: cors });
    }
    if (url.pathname !== "/submit") {
      return json({ error: "Not found." }, 404, cors);
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405, cors);
    }
    if (!allowed.includes(origin)) {
      return json({ error: "This form only accepts messages from the LydiaRx website." }, 403, cors);
    }

    let data;
    try {
      const type = request.headers.get("Content-Type") || "";
      if (type.includes("application/json")) {
        data = await request.json();
      } else {
        data = Object.fromEntries(await request.formData());
      }
    } catch {
      return json({ error: "The message could not be read. Please try again." }, 400, cors);
    }

    // Hidden decoy field: people never see it, bots tend to fill it in.
    // Pretend success so bots learn nothing.
    if (clean(data.website)) {
      return json({ ok: true }, 200, cors);
    }

    const form = {
      name: clean(data.name),
      organisation: clean(data.organisation),
      email: clean(data.email),
      role: clean(data.role),
      message: cleanMultiline(data.message),
    };

    const problem = validate(form);
    if (problem) {
      return json({ error: problem }, 400, cors);
    }

    const token = clean(data.token || data["cf-turnstile-response"]);
    const ip = request.headers.get("CF-Connecting-IP") || "";
    const human = await verifyTurnstile(token, ip, env, allowed);
    if (!human) {
      return json({ error: "The security check did not pass. Please try again." }, 403, cors);
    }

    try {
      const raw = buildMime(form, env);
      await env.SEND.send(new EmailMessage(env.FROM_ADDRESS, env.TO_ADDRESS, raw));
    } catch (err) {
      console.error("send failed", err && err.message);
      return json({ error: "Sorry, your message could not be sent. Please try again later." }, 502, cors);
    }

    return json({ ok: true }, 200, cors);
  },
};

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin, allowed) {
  const h = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

// Single-line fields: trim, and strip control characters (including line
// breaks) so nothing can be smuggled into email headers.
function clean(v) {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
}

function cleanMultiline(v) {
  return String(v ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, "")
    .trim();
}

function validate(f) {
  if (!f.name) return "Please enter your name.";
  if (!f.email || !EMAIL_RE.test(f.email)) return "Please enter a valid email address.";
  if (!ROLES.includes(f.role)) return "Please choose who you are from the list.";
  if (!f.message) return "Please enter a message.";
  for (const [key, max] of Object.entries(LIMITS)) {
    if (f[key].length > max) return `Please shorten the ${key} field.`;
  }
  return null;
}

async function verifyTurnstile(token, ip, env, allowed) {
  if (!token || !env.TURNSTILE_SECRET) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const out = await res.json();
    if (!out.success) return false;
    const hosts = allowed.map((o) => new URL(o).hostname);
    return !out.hostname || hosts.includes(out.hostname);
  } catch {
    return false;
  }
}

function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function encodeHeader(str) {
  return /^[\x20-\x7e]*$/.test(str) ? str : `=?UTF-8?B?${b64(str)}?=`;
}

function buildMime(f, env) {
  const domain = String(env.FROM_ADDRESS).split("@")[1];
  const subject = `Website enquiry from ${f.name} (${f.role})`;
  const body = [
    "New message from the LydiaRx website contact form.",
    "",
    `Name: ${f.name}`,
    `Organisation: ${f.organisation || "Not given"}`,
    `Email: ${f.email}`,
    `I am a: ${f.role}`,
    "",
    "Message:",
    f.message,
    "",
    "Reply to this email to answer the sender directly.",
  ].join("\r\n");
  const wrapped = b64(body).replace(/.{1,76}/g, "$&\r\n");
  return [
    `From: ${encodeHeader(env.FROM_NAME || "LydiaRx website")} <${env.FROM_ADDRESS}>`,
    `To: <${env.TO_ADDRESS}>`,
    `Reply-To: ${encodeHeader(f.name)} <${f.email}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapped,
  ].join("\r\n");
}
