// POST /api/present -> Present mode (live cue cards for real-world presentations).
// One endpoint, three actions, so the whole feature stays inside a single Vercel
// function (Hobby tier caps the function count):
//   { action:"cards",  slides?:[{n,text}], outline?, notes?, want_title?, lang, device_id }
//     -> { title, cards:[{ n, title, points:[{id,t,say}], bridge }] }
//   { action:"track",  points:[{id,t}], transcript, lang, device_id }
//     -> { covered:["s1p2", ...] }
//   { action:"answer", question, deck_title, card, notes, lang, device_id }
//     -> { answer }
// Slide TEXT is extracted in the browser (pdf.js / JSZip) and sent here, so we
// never ship a multi-MB base64 PDF or pay for image tokens, and generation is
// batched client-side to stay well under the function timeout.
export const config = { api: { bodyParser: false } };

import { hasCookie } from "./_auth.js";
import { logUsage, anthropicCostMicros } from "./_usage.js";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";
const MAX_POINTS_PER_CARD = 6;
const MAX_SLIDES_PER_CALL = 10;

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

async function claude({ model = HAIKU, system, content, max_tokens }) {
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
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/* ---------- action: cards ---------- */
async function doCards(body, device_id) {
  const lang = body.lang === "de" ? "de" : "en";
  const notes = String(body.notes || "").slice(0, 8000);
  const wantTitle = !!body.want_title;

  // Either a list of slides (text already extracted client-side) or a pasted outline.
  let inSlides = Array.isArray(body.slides) ? body.slides
    .slice(0, MAX_SLIDES_PER_CALL)
    .map((s, i) => ({ n: Number(s.n) || i + 1, text: String(s.text || "").slice(0, 1600) })) : null;
  let deckText;
  if (inSlides && inSlides.length) {
    deckText = inSlides.map((s) => `=== SLIDE ${s.n} ===\n${s.text || "(no text on this slide, likely a title or section divider)"}`).join("\n\n");
  } else {
    const outline = String(body.outline || "").slice(0, 12000);
    if (!outline.trim()) return { status: 400, json: { error: "no deck" } };
    deckText = outline;
    inSlides = null;
  }

  const langLine = lang === "de"
    ? "Schreibe ALLES auf Deutsch, in natürlicher gesprochener Sprache."
    : "Write everything in natural spoken English.";
  const oneCardRule = inSlides
    ? `Produce EXACTLY ONE card per slide given, in the same order. If a slide has little or no text (a title or divider), still output a card with one short point such as introducing the topic or yourself.`
    : `Turn the outline into a sensible sequence of cards, one per logical slide or section.`;
  const sys = `You are a presentation coach building CUE CARDS for someone about to give this presentation live, in person, with the slides behind them and a phone in front of them. The cards must let them present confidently even if they did not write the deck, so the content has to actually teach them what each slide claims.
${langLine}
${oneCardRule}
Rules:
- Per card: a short title (max 6 words) and 1-4 talking points. FEWER, BETTER: pick only the genuinely interesting, presentation-worthy content of the slide. A talk is not a reading of the slide; nothing important may be missing, but not everything on a slide deserves to be said.
- NEVER make points out of things nobody says out loud: page numbers, footers, headers, image credits, source citations, URLs, file names, agenda listings, decorative labels, contact details. If a slide is mostly that, one short point is enough.
- A title/opening slide gets a greeting point: welcome the audience, introduce yourself and the topic. A closing/thanks slide gets a wrap-up point: summarize the core message, thank them, invite questions.
- Each point has two parts:
  "t": the CHECKLIST phrase, max 8 words, the concrete idea they must get across (a fact, number, name, or claim from the slide). Glanceable at podium distance.
  "say": ONE natural spoken sentence showing how to say it well (a second sentence ONLY if a number or term needs explaining, so the presenter understands it instead of just reading it). This is a suggestion; the presenter will use their own words.
- "bridge": one short spoken sentence transitioning to the next slide. Omit on the last card.
- If presenter notes are provided, treat them as the presenter's intent and fold them in.
- No em-dashes or en-dashes anywhere; use commas or periods.
Return ONLY valid JSON, no markdown, no preamble:
{${wantTitle ? '"title":"<deck title, max 6 words>",' : ""}"cards":[{"title":"...","points":[{"t":"...","say":"..."}],"bridge":"..."}]}`;

  const userText =
    (inSlides ? "SLIDE TEXT:\n" + deckText : "PRESENTATION OUTLINE:\n" + deckText) + "\n\n" +
    (notes ? "PRESENTER'S OWN NOTES:\n" + notes + "\n\n" : "") +
    "Build the cue cards now.";

  // Bound output so a batch can never run long: ~700 tokens of headroom per slide.
  const slideCount = inSlides ? inSlides.length : 8;
  const maxTokens = Math.min(8000, 800 + slideCount * 700);
  const { text, usage } = await claude({ system: sys, content: [{ type: "text", text: userText }], max_tokens: maxTokens });
  logUsage({
    device_id, provider: "anthropic", service: "present_cards", model: HAIKU,
    input_units: usage?.input_tokens || 0, output_units: usage?.output_tokens || 0,
    cost_micros: anthropicCostMicros(HAIKU, usage),
  });

  const parsed = parseJson(text);
  if (!Array.isArray(parsed.cards) || !parsed.cards.length) throw new Error("model returned no cards");
  // Stable, globally-unique ids keyed off each slide's real number (so ids stay
  // unique even though the client assembles several batches into one deck).
  const cards = parsed.cards.map((c, ci) => {
    const n = inSlides ? (inSlides[ci] ? inSlides[ci].n : ci + 1) : (Number(c.n) || ci + 1);
    return {
      n,
      title: String(c.title || "Slide " + n).slice(0, 80),
      points: (Array.isArray(c.points) ? c.points : []).slice(0, MAX_POINTS_PER_CARD).map((p, pi) => ({
        id: `s${n}p${pi + 1}`,
        t: String(p.t || "").slice(0, 90),
        say: String(p.say || "").slice(0, 400),
      })).filter((p) => p.t),
      bridge: c.bridge ? String(c.bridge).slice(0, 200) : "",
    };
  }).filter((c) => c.points.length);
  if (!cards.length) throw new Error("model returned empty cards");
  const out = { cards };
  if (wantTitle) out.title = String(parsed.title || "").slice(0, 60) || "Presentation";
  return { status: 200, json: out };
}

/* ---------- action: track ---------- */
async function doTrack(body, device_id) {
  const lang = body.lang === "de" ? "de" : "en";
  const transcript = String(body.transcript || "").slice(-2500);
  const clean = (arr) => (Array.isArray(arr) ? arr : [])
    .slice(0, 16)
    .map((p) => ({ id: String(p.id || "").slice(0, 16), t: String(p.t || "").slice(0, 90) }))
    .filter((p) => p.id && p.t);
  const points = clean(body.points);          // current slide
  const nextPoints = clean(body.next_points); // next slide (talking ahead)
  if ((!points.length && !nextPoints.length) || transcript.trim().split(/\s+/).length < 4) {
    return { status: 200, json: { covered: [], moveon: false } };
  }

  const sys = `You follow along while someone gives a live presentation${lang === "de" ? " in German" : ""}. You get the pending talking points of the CURRENT slide (and possibly the NEXT slide), plus the latest transcript of what the speaker said.
Mark a point as "covered" when the speaker got its core idea across IN ANY WORDING. Be generous: paraphrases, the speaker's own words, simplified versions, all count. The transcript comes from speech recognition, so tolerate garbled or similar-sounding words. Only leave a point unchecked if its substance truly has not come up yet.
Also decide "moveon": true when the speaker is essentially done with the CURRENT slide. That means the main ideas landed, or they are clearly summarizing or transitioning, even if minor points remain. False while they are still mid-topic.
Return ONLY valid JSON: {"covered":["<id>", ...],"moveon":true|false}`;
  const userText =
    "CURRENT SLIDE, PENDING POINTS:\n" + (points.length ? points.map((p) => `${p.id}: ${p.t}`).join("\n") : "(all covered already)") +
    (nextPoints.length ? "\n\nNEXT SLIDE, PENDING POINTS:\n" + nextPoints.map((p) => `${p.id}: ${p.t}`).join("\n") : "") +
    "\n\nRECENT TRANSCRIPT:\n" + transcript;

  const { text, usage } = await claude({ system: sys, content: [{ type: "text", text: userText }], max_tokens: 300 });
  logUsage({
    device_id, provider: "anthropic", service: "present_track", model: HAIKU,
    input_units: usage?.input_tokens || 0, output_units: usage?.output_tokens || 0,
    cost_micros: anthropicCostMicros(HAIKU, usage),
  });

  let covered = [], moveon = false;
  try {
    const parsed = parseJson(text);
    const known = new Set([...points, ...nextPoints].map((p) => p.id));
    covered = (Array.isArray(parsed.covered) ? parsed.covered : []).filter((id) => known.has(id));
    moveon = !!parsed.moveon;
  } catch { covered = []; }
  return { status: 200, json: { covered, moveon } };
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

  const { text, usage } = await claude({ system: sys, content: [{ type: "text", text: userText }], max_tokens: 350 });
  logUsage({
    device_id, provider: "anthropic", service: "present_answer", model: HAIKU,
    input_units: usage?.input_tokens || 0, output_units: usage?.output_tokens || 0,
    cost_micros: anthropicCostMicros(HAIKU, usage),
  });
  return { status: 200, json: { answer: text.trim() } };
}

/* ---------- action: coach (Train debrief) ---------- */
async function doCoach(body, device_id) {
  const lang = body.lang === "de" ? "de" : "en";
  const transcript = String(body.transcript || "").slice(0, 14000);
  if (transcript.trim().split(/\s+/).length < 8) return { status: 400, json: { error: "too short" } };
  const cards = (Array.isArray(body.cards) ? body.cards : []).slice(0, 40);
  const pointsList = cards.flatMap((c) => (Array.isArray(c.points) ? c.points : []).map((p) => String(p.t || ""))).filter(Boolean).slice(0, 120);
  const wpm = Number(body.wpm) || 0;
  const fillers = Number(body.fillers) || 0;
  const durationS = Number(body.duration_s) || 0;

  const langLine = lang === "de" ? "Antworte AUSSCHLIESSLICH auf Deutsch." : "Reply only in English.";
  const sys = `You are a demanding but encouraging presentation coach. The user just REHEARSED their talk out loud (this is practice, not the real thing). You have the planned talking points and a transcript of what they actually said. Judge how well they delivered it and tell them precisely what to change before the real thing.
${langLine}
Delivery facts (already measured): pace ${wpm || "?"} words per minute, ${fillers} filler words, ${durationS ? Math.round(durationS) + " seconds spoken" : "duration unknown"}. A natural talk pace is 130-160 wpm; under 110 is sluggish, over 175 is rushed.
Be specific and reference what they actually said. No generic advice. No em-dashes; use commas or periods.
Return ONLY valid JSON, no markdown:
{"score":<0-100 overall delivery score>,"summary":"<1-2 sentence verdict>","delivery":"<1 sentence on pace and fillers>","missed":["<planned point they did not cover or covered weakly>", ...],"tips":["<concrete change to make, max 18 words>", ...]}
Keep "missed" to the points genuinely skipped or rushed (empty array if they covered everything). Give 3-5 "tips", ordered by impact.`;
  const userText =
    "PLANNED TALKING POINTS:\n" + (pointsList.length ? pointsList.map((p, i) => `${i + 1}. ${p}`).join("\n") : "(none provided)") +
    "\n\nWHAT THEY ACTUALLY SAID (transcript):\n" + transcript +
    "\n\nCoach them now.";

  const { text, usage } = await claude({ model: SONNET, system: sys, content: [{ type: "text", text: userText }], max_tokens: 1400 });
  logUsage({
    device_id, provider: "anthropic", service: "present_coach", model: SONNET,
    input_units: usage?.input_tokens || 0, output_units: usage?.output_tokens || 0,
    cost_micros: anthropicCostMicros(SONNET, usage),
  });
  const parsed = parseJson(text);
  return { status: 200, json: {
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
    summary: String(parsed.summary || "").slice(0, 400),
    delivery: String(parsed.delivery || "").slice(0, 300),
    missed: (Array.isArray(parsed.missed) ? parsed.missed : []).slice(0, 12).map((m) => String(m).slice(0, 120)),
    tips: (Array.isArray(parsed.tips) ? parsed.tips : []).slice(0, 6).map((m) => String(m).slice(0, 160)),
  } };
}

/* ---------- action: assist (Interview live help) ---------- */
async function doAssist(body, device_id) {
  const lang = body.lang === "de" ? "de" : "en";
  const context = String(body.context || "").slice(0, 12000);
  const transcript = String(body.transcript || "").slice(-1800);
  const question = String(body.question || "").slice(0, 800);
  if (!transcript.trim() && !question.trim()) return { status: 200, json: { answer: "", points: [] } };

  const langLine = lang === "de" ? "Antworte AUSSCHLIESSLICH auf Deutsch." : "Reply only in English.";
  const sys = `You are a live interview copilot. The user is IN an interview or conversation right now, with a phone in front of them. You hear a transcript of what was just said (it may include the interviewer's question and the user's own words, from speech recognition, so tolerate errors). Using the user's background CONTEXT, give them help they can glance at and speak from immediately.
${langLine}
Figure out what the user most needs to say next (usually answering the latest question). Then return, as JSON only:
{"answer":"<a strong spoken answer in 1-3 short sentences they can say now, grounded in their context, max 55 words>","points":["<3 to 4 key bullet phrases to hit, max 7 words each>"]}
Spoken, natural, confident, first person. No markdown, no em-dashes. If there is no clear question yet, give the single best thing to say or ask next.`;
  const userText =
    "USER BACKGROUND CONTEXT:\n" + (context || "(none provided)") +
    "\n\nLATEST CONVERSATION (transcript):\n" + (transcript || "(nothing yet)") +
    (question ? "\n\nThe user flagged this question specifically:\n" + question : "") +
    "\n\nHelp them now.";

  const { text, usage } = await claude({ system: sys, content: [{ type: "text", text: userText }], max_tokens: 500 });
  logUsage({
    device_id, provider: "anthropic", service: "present_assist", model: HAIKU,
    input_units: usage?.input_tokens || 0, output_units: usage?.output_tokens || 0,
    cost_micros: anthropicCostMicros(HAIKU, usage),
  });
  let out = { answer: "", points: [] };
  try {
    const parsed = parseJson(text);
    out.answer = String(parsed.answer || "").slice(0, 500);
    out.points = (Array.isArray(parsed.points) ? parsed.points : []).slice(0, 5).map((p) => String(p).slice(0, 80));
  } catch { out.answer = text.trim().slice(0, 500); }
  return { status: 200, json: out };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!hasCookie(req)) return res.status(401).json({ error: "unauthorized" });
  let body;
  try {
    const raw = await readRaw(req);
    body = JSON.parse(raw.toString("utf8") || "{}");
  } catch (e) {
    if (String(e.message) === "too_big") return res.status(413).json({ error: "deck too large" });
    return res.status(400).json({ error: "bad json" });
  }
  const device_id = String(body.device_id || "").slice(0, 64);
  try {
    let out;
    if (body.action === "cards") out = await doCards(body, device_id);
    else if (body.action === "track") out = await doTrack(body, device_id);
    else if (body.action === "answer") out = await doAnswer(body, device_id);
    else if (body.action === "coach") out = await doCoach(body, device_id);
    else if (body.action === "assist") out = await doAssist(body, device_id);
    else return res.status(400).json({ error: "unknown action" });
    return res.status(out.status).json(out.json);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
