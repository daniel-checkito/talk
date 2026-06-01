// Best-effort in-memory per-IP rate limit. Survives only within a single warm
// serverless instance — Vercel may spin up multiple, so this is a soft guard,
// not a hard cap. For real protection, swap in Upstash/Vercel KV.
const buckets = new Map();
const DAY_MS = 24 * 60 * 60 * 1000;

function clientIp(req) {
  const xff = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xff || req.socket?.remoteAddress || "unknown";
}

// limit: max calls allowed per IP per day for this key
function check(req, key, limit) {
  const ip = clientIp(req);
  const id = `${key}:${ip}`;
  const now = Date.now();
  let b = buckets.get(id);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + DAY_MS };
    buckets.set(id, b);
  }
  b.count++;
  // crude cleanup so the map doesn't grow forever
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  }
  return { ok: b.count <= limit, count: b.count, limit, resetAt: b.resetAt };
}

module.exports = { check };
