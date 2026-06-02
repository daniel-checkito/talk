// Single shared-password gate. Cookie is a fixed HMAC of APP_PASSWORD, so
// rotating the env var invalidates every device automatically.
const crypto = require("crypto");

const COOKIE_NAME = "rehearse_auth";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

// Default password is "mesh". Set APP_PASSWORD in env to override.
const PASSWORD = process.env.APP_PASSWORD || "mesh";
function token() {
  return crypto.createHmac("sha256", PASSWORD).update("rehearse-v1").digest("hex");
}
function password() { return PASSWORD; }

function hasCookie(req) {
  const t = token();
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
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${t}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax; Secure`
  );
  return true;
}

function clearCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`);
}

module.exports = { requireAuth, hasCookie, setCookie, clearCookie, token, password, COOKIE_NAME };
