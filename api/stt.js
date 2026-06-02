// POST /api/stt -> { text }
// Body: raw audio bytes (webm/ogg/mp4). Content-Type passed through from client.
// We disable Vercel's body parser so we can read the raw audio buffer.
export const config = { api: { bodyParser: false } };

import { logUsage, sttCostMicros, sttSecondsFromBytes } from "./_usage.js";
// Reuse the shared auth helper so the default-password fallback ("mesh" when
// APP_PASSWORD env var isn't set) matches every other endpoint. The previous
// inline copy defaulted to "" and rejected every request with 401, which
// kicked the user back to the login screen mid-transcription.
import { hasCookie } from "./_auth.js";

const DAILY_LIMIT = 200;
const MAX_AUDIO_BYTES = 4 * 1024 * 1024; // ~30s of opus is well under this
const DAY_MS = 24 * 60 * 60 * 1000;
const buckets = new Map();
function rateCheck(req) {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now > b.resetAt) { b = { count: 0, resetAt: now + DAY_MS }; buckets.set(ip, b); }
  b.count++;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  return b.count <= DAILY_LIMIT;
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!hasCookie(req)) return res.status(401).json({ error: "unauthorized" });
  try {
    if (!rateCheck(req)) return res.status(429).json({ error: "Daily voice limit reached. Try again tomorrow." });
    const audio = await readRaw(req);
    if (!audio || !audio.length) return res.status(400).json({ error: "no audio" });
    if (audio.length > MAX_AUDIO_BYTES) return res.status(413).json({ error: "audio too long" });

    const contentType = req.headers["content-type"] || "audio/webm";
    const ext = contentType.includes("mp4") ? "mp4" : contentType.includes("ogg") ? "ogg" : "webm";

    // Build multipart form for ElevenLabs Scribe. Language can be overridden via
    // the x-language header; default English. Scribe uses 3-letter codes.
    const langHeader = (req.headers["x-language"] || "").toString().toLowerCase();
    const languageCode = langHeader === "de" || langHeader === "deu" ? "deu" : "eng";
    const form = new FormData();
    const blob = new Blob([audio], { type: contentType });
    form.append("file", blob, `clip.${ext}`);
    form.append("model_id", "scribe_v2");
    form.append("language_code", languageCode);

    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY }, // do NOT set Content-Type; fetch sets the multipart boundary
      body: form,
    });
    if (!r.ok) {
      const msg = await r.text();
      return res.status(r.status).json({ error: "elevenlabs stt: " + msg.slice(0, 300) });
    }
    const data = await r.json();
    const device_id = (req.headers["x-device-id"] || "").toString().slice(0, 64);
    const seconds = sttSecondsFromBytes(audio.length);
    logUsage({
      device_id, provider: "elevenlabs", service: "stt", model: "scribe_v2",
      input_units: audio.length, output_units: 0,
      cost_micros: sttCostMicros(seconds),
    });
    return res.status(200).json({ text: (data.text || "").trim() });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
