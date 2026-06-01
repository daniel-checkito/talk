// POST /api/tts -> audio/mpeg bytes
// Body: { text, voice_id }
const { check } = require("./_ratelimit");
const MAX_CHARS = 600;
const DAILY_LIMIT = 200;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const rl = check(req, "tts", DAILY_LIMIT);
    if (!rl.ok) return res.status(429).json({ error: "Daily voice limit reached. Try again tomorrow." });
    let { text, voice_id } = req.body || {};
    if (!text || !voice_id) return res.status(400).json({ error: "text and voice_id required" });
    if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_flash_v2_5", // ~75ms latency, cheapest credits — right for real-time
        voice_settings: { stability: 0.4, similarity_boost: 0.75 },
      }),
    });
    if (!r.ok) {
      const msg = await r.text();
      return res.status(r.status).json({ error: "elevenlabs tts: " + msg.slice(0, 300) });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
