// Single shared-password gate. Cookie is a fixed HMAC of APP_PASSWORD, so
// rotating the env var invalidates every device automatically.
const crypto = require("crypto");

const COOKIE_NAME = "rehearse_auth";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function token() {
  const pw = process.env.APP_PASSWORD || "";
  if (!pw) return "";
  return crypto.createHmac("sha256", pw).update("rehearse-v1").digest("hex");
}

function hasCookie(req) {
  const t = token();
  if (!t) return false; // no password configured = treat as locked
  const raw = req.headers.cookie || "";
  for (const part of raw.split(/;\s*/)) {
    if (part.startsWith(COOKIE_NAME + "=")) return part.slice(COOKIE_NAME.length + 1) === t;
  }
  return false;
}

// Shorthand: if not authed, send a 401 and return false; caller should `return`.
function requireAuth(req, res) {
  if (hasCookie(req)) return true;
  res.status(401).json({ error: "unauthorized" });
  return false;
}

function setCookie(res) {
  const t = token();
  if (!t) return false;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${t}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax; Secure`
  );
  return true;
}

function clearCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`);
}

module.exports = { requireAuth, hasCookie, setCookie, clearCookie, token, COOKIE_NAME };
