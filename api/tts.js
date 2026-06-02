// POST /api/tts -> audio/mpeg bytes
// Body: { text, voice_id, device_id?, lang? }
// Caches the mp3 in Supabase keyed by sha256(voice_id:model_id:text). Identical
// re-requests (same opening line spoken by the same persona, same language) are
// served from cache for ~0 ElevenLabs spend.
const crypto = require("crypto");
const { check } = require("./_ratelimit");
const { requireAuth } = require("./_auth");
const { logUsage, ttsCostMicros } = require("./_usage");
const { ready, rest } = require("./_db");
const MAX_CHARS = 600;
const DAILY_LIMIT = 200;

function hashFor(voice_id, model_id, text) {
  return crypto.createHash("sha256").update(voice_id + ":" + model_id + ":" + text).digest("hex");
}

async function readCache(hash) {
  if (!ready()) return null;
  try {
    const rows = await rest(`/rehearse_tts_cache?hash=eq.${encodeURIComponent(hash)}&select=audio_b64&limit=1`);
    if (Array.isArray(rows) && rows.length && rows[0].audio_b64) {
      // Best-effort touch of last_used_at so the warmest entries are easy to keep
      // when we eventually trim the table. (hit_count needs an atomic increment via
      // an RPC, which we don't have set up; for now we just refresh the timestamp.)
      rest(`/rehearse_tts_cache?hash=eq.${encodeURIComponent(hash)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ last_used_at: new Date().toISOString() }),
      }).catch(() => {});
      return Buffer.from(rows[0].audio_b64, "base64");
    }
  } catch {}
  return null;
}

async function writeCache(hash, voice_id, model_id, audio, charCount) {
  if (!ready()) return;
  try {
    await rest("/rehearse_tts_cache", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        hash, voice_id, model_id,
        audio_b64: audio.toString("base64"),
        char_count: charCount,
      }),
    });
  } catch {}
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!requireAuth(req, res)) return;
  try {
    const rl = check(req, "tts", DAILY_LIMIT);
    if (!rl.ok) return res.status(429).json({ error: "Daily voice limit reached. Try again tomorrow." });
    let { text, voice_id, device_id, lang } = req.body || {};
    if (!text || !voice_id) return res.status(400).json({ error: "text and voice_id required" });
    if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);

    const isEnglish = !lang || lang === "en";
    const model_id = isEnglish ? "eleven_flash_v2_5" : "eleven_turbo_v2_5";
    const hash = hashFor(voice_id, model_id, text);

    // Cache lookup. A hit costs nothing on ElevenLabs and gets logged as a free
    // tts_cached call so the user can see the savings in the cost dashboard.
    const cached = await readCache(hash);
    if (cached) {
      logUsage({
        device_id, provider: "elevenlabs", service: "tts_cached", model: model_id,
        input_units: text.length, output_units: cached.length, cost_micros: 0,
      });
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.setHeader("X-Tts-Cache", "hit");
      return res.status(200).send(cached);
    }

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id,
        voice_settings: { stability: 0.4, similarity_boost: 0.75 },
      }),
    });
    if (!r.ok) {
      const msg = await r.text();
      return res.status(r.status).json({ error: "elevenlabs tts: " + msg.slice(0, 300) });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    logUsage({
      device_id, provider: "elevenlabs", service: "tts", model: model_id,
      input_units: text.length, output_units: buf.length,
      cost_micros: ttsCostMicros(text.length),
    });
    // Write to cache asynchronously; user gets the audio without waiting.
    writeCache(hash, voice_id, model_id, buf, text.length);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("X-Tts-Cache", "miss");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
