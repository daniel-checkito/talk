// POST /api/stt -> { text }
// Body: raw audio bytes (webm/ogg/mp4). Content-Type passed through from client.
// We disable Vercel's body parser so we can read the raw audio buffer.
export const config = { api: { bodyParser: false } };

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
  try {
    const audio = await readRaw(req);
    if (!audio || !audio.length) return res.status(400).json({ error: "no audio" });

    const contentType = req.headers["content-type"] || "audio/webm";
    const ext = contentType.includes("mp4") ? "mp4" : contentType.includes("ogg") ? "ogg" : "webm";

    // Build multipart form for ElevenLabs Scribe
    const form = new FormData();
    const blob = new Blob([audio], { type: contentType });
    form.append("file", blob, `clip.${ext}`);
    form.append("model_id", "scribe_v2");
    form.append("language_code", "eng");

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
    return res.status(200).json({ text: (data.text || "").trim() });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
