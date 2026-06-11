// POST /api/present -> Present mode (live cue cards for real-world presentations).
// One endpoint with three actions so the whole feature fits in a single Vercel
// function (Hobby tier caps the function count):
//   { action:"cards",  pdf_base64?, outline?, notes?, lang, device_id }
//     -> { title, cards:[{ n, title, points:[{id,t,say}], bridge }] }
//   { action:"track",  points:[{id,t}], transcript, lang, device_id }
//     -> { covered:["s1p2", ...] }
//   { action:"answer", question, deck_title, card, notes, lang, device_id }
//     -> { answer }
// Body parsing is manual (raw read) because a base64 PDF can be a few MB and we
// want to enforce our own size cap instead of trusting any parser default.
export const config = { api: { bodyParser: false } };

import { hasCookie } from "./_auth.js";
import { logUsage, anthropicCostMicros } from "./_usage.js";

const MAX_BODY_BYTES = 4.4 * 1024 * 1024; // Vercel request cap is 4.5MB
const SONNET = "claude-sonnet-4-6";
const HAIKU = "claude-haiku-4-5-20251001";
const MAX_CARDS = 40;
const MAX_POINTS_PER_CARD = 6;

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { reject(new Error("too_big")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function claude({ model, system, content, max_tokens }) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens, system, messages: [{ role: "user", content }] }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message || "anthropic error");
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { text, usage: data.usage };
}

function parseJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  // The model occasionally wraps JSON in a sentence; grab the outermost braces.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/* ---------- action: cards ---------- */
async function doCards(body, device_id) {
  const lang = body.lang === "de" ? "de" : "en";
  const notes = String(body.notes || "").slice(0, 6000);
  const outline = String(body.outline || "").slice(0, 12000);
  const pdf = typeof body.pdf_base64 === "string" ? body.pdf_base64 : "";
  if (!pdf && !outline.trim()) return { status: 400, json: { error: "no deck" } };

  const langLine = lang === "de"
    ? "Schreibe ALLES auf Deutsch, in natürlicher gesprochener Sprache (du-Form vermeiden, es ist ein Vortrag)."
    : "Write everything in natural spoken English.";
  const sys = `You are a presentation coach building CUE CARDS for someone about to give this presentation live, in person, with the slides behind them and a phone in front of them. The cards must let them present confidently even if they did not write the deck themselves, so the content has to actually teach them what each slide claims.
${langLine}
Rules:
- One card per slide, in order. Merge purely decorative slides (title page, section dividers, "thank you") into a card with a single point.
- Per card: a short title (max 6 words) and 2-${MAX_POINTS_PER_CARD} talking points.
- Each point has two parts:
  "t": the CHECKLIST phrase, max 8 words, the concrete thing they must mention (a fact, number, name, claim from the slide). Glanceable at podium distance.
  "say": 1-2 full spoken sentences showing HOW to say it well. Natural speech, no jargon dumps. If the slide has a number or term, explain what it means so the presenter understands it, not just reads it.
- "bridge": one short spoken sentence that transitions to the NEXT slide. Omit it on the last card.
- If speaker notes are provided, treat them as the presenter's intent and fold them in.
- No em-dashes or en-dashes anywhere; use commas or periods.
Return ONLY valid JSON, no markdown, no preamble:
{"title":"<deck title, max 6 words>","cards":[{"n":1,"title":"...","points":[{"t":"...","say":"..."}],"bridge":"..."}]}`;

  const userText =
    (outline ? "PRESENTATION OUTLINE (no PDF available):\n" + outline + "\n\n" : "") +
    (notes ? "PRESENTER'S OWN NOTES:\n" + notes + "\n\n" : "") +
    "Build the cue cards now.";
  const content = pdf
    ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } }, { type: "text", text: userText }]
    : [{ type: "text", text: userText }];

  const { text, usage } = await claude({ model: SONNET, system: sys, content, max_tokens: 8000 });
  logUsage({
    device_id, provider: "anthropic", service: "present_cards", model: SONNET,
    input_units: usage?.input_tokens || 0, output_units: usage?.output_tokens || 0,
    cost_micros: anthropicCostMicros(SONNET, usage),
  });

  const parsed = parseJson(text);
  if (!Array.isArray(parsed.cards) || !parsed.cards.length) throw new Error("model returned no cards");
  // Re-issue ids server-side so they are guaranteed unique and stable; the
  // client and the track action key everything off these.
  const cards = parsed.cards.slice(0, MAX_CARDS).map((c, ci) => ({
    n: ci + 1,
    title: String(c.title || "Slide " + (ci + 1)).slice(0, 80),
    points: (Array.isArray(c.points) ? c.points : []).slice(0, MAX_POINTS_PER_CARD).map((p, pi) => ({
      id: `s${ci + 1}p${pi + 1}`,
      t: String(p.t || "").slice(0, 90),
      say: String(p.say || "").slice(0, 400),
    })).filter((p) => p.t),
    bridge: c.bridge ? String(c.bridge).slice(0, 200) : "",
  })).filter((c) => c.points.length);
  if (!cards.length) throw new Error("model returned empty cards");
  return { status: 200, json: { title: String(parsed.title || "").slice(0, 60) || "Presentation", cards } };
}

/* ---------- action: track ---------- */
async function doTrack(body, device_id) {
  const lang = body.lang === "de" ? "de" : "en";
  const transcript = String(body.transcript || "").slice(-2500);
  const points = (Array.isArray(body.points) ? body.points : [])
    .slice(0, 24)
    .map((p) => ({ id: String(p.id || "").slice(0, 12), t: String(p.t || "").slice(0, 90) }))
    .filter((p) => p.id && p.t);
  if (!points.length || transcript.trim().split(/\s+/).length < 4) return { status: 200, json: { covered: [] } };

  const sys = `You check off talking points while someone gives a live presentation${lang === "de" ? " in German" : ""}. You get a list of pending points and the most recent transcript of what the speaker said. Mark a point as covered ONLY if the speaker genuinely addressed its substance, in any wording (the transcript comes from speech recognition, so tolerate misrecognized words that sound similar). Mentioning one word in passing is NOT covering it. Be strict; an unchecked point costs nothing, a wrongly checked one misleads the speaker.
Return ONLY valid JSON: {"covered":["<id>", ...]} . Empty array if nothing was covered.`;
  const userText = "PENDING POINTS:\n" + points.map((p) => `${p.id}: ${p.t}`).join("\n") +
    "\n\nRECENT TRANSCRIPT:\n" + transcript;

  const { text, usage } = await claude({ model: HAIKU, system: sys, content: [{ type: "text", text: userText }], max_tokens: 300 });
  logUsage({
    device_id, provider: "anthropic", service: "present_track", model: HAIKU,
    input_units: usage?.input_tokens || 0, output_units: usage?.output_tokens || 0,
    cost_micros: anthropicCostMicros(HAIKU, usage),
  });

  let covered = [];
  try {
    const parsed = parseJson(text);
    const known = new Set(points.map((p) => p.id));
    covered = (Array.isArray(parsed.covered) ? parsed.covered : []).filter((id) => known.has(id));
  } catch { covered = []; }
  return { status: 200, json: { covered } };
}

/* ---------- action: answer ---------- */
async function doAnswer(body, device_id) {
  const lang = body.lang === "de" ? "de" : "en";
  const question = String(body.question || "").slice(0, 1200);
  if (!question.trim()) return { status: 400, json: { error: "no question" } };
  const deckTitle = String(body.deck_title || "").slice(0, 80);
  const notes = String(body.notes || "").slice(0, 3000);
  const card = body.card && typeof body.card === "object" ? body.card : null;
  const cardCtx = card
    ? `CURRENT SLIDE: ${String(card.title || "").slice(0, 80)}\nITS POINTS:\n` +
      (Array.isArray(card.points) ? card.points : []).slice(0, MAX_POINTS_PER_CARD)
        .map((p) => "- " + String(p.t || "") + (p.say ? " (" + String(p.say).slice(0, 200) + ")" : "")).join("\n")
    : "";

  const sys = `Someone is mid-presentation and just got a question from the audience. Give them an answer they can read at a glance on their phone and deliver out loud${lang === "de" ? ", auf Deutsch" : ""}.
Rules: maximum 60 words. Start with the direct answer in the first sentence, then at most two supporting sentences. Spoken language, no bullet symbols, no markdown, no em-dashes. If the question cannot be answered from the presentation context, say so honestly and give them one graceful spoken line to respond with anyway (for example offering to follow up after).`;
  const userText = `PRESENTATION: ${deckTitle}\n${cardCtx}\n${notes ? "PRESENTER NOTES:\n" + notes + "\n" : ""}\nQUESTION FROM THE AUDIENCE:\n${question}\n\nWrite the answer they should say now.`;

  const { text, usage } = await claude({ model: HAIKU, system: sys, content: [{ type: "text", text: userText }], max_tokens: 350 });
  logUsage({
    device_id, provider: "anthropic", service: "present_answer", model: HAIKU,
    input_units: usage?.input_tokens || 0, output_units: usage?.output_tokens || 0,
    cost_micros: anthropicCostMicros(HAIKU, usage),
  });
  return { status: 200, json: { answer: text.trim() } };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!hasCookie(req)) return res.status(401).json({ error: "unauthorized" });
  let body;
  try {
    const raw = await readRaw(req);
    body = JSON.parse(raw.toString("utf8") || "{}");
  } catch (e) {
    if (String(e.message) === "too_big") return res.status(413).json({ error: "PDF too large" });
    return res.status(400).json({ error: "bad json" });
  }
  const device_id = String(body.device_id || "").slice(0, 64);
  try {
    let out;
    if (body.action === "cards") out = await doCards(body, device_id);
    else if (body.action === "track") out = await doTrack(body, device_id);
    else if (body.action === "answer") out = await doAnswer(body, device_id);
    else return res.status(400).json({ error: "unknown action" });
    return res.status(out.status).json(out.json);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
