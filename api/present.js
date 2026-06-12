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
const MAX_POINTS_PER_CARD = 6;
const MAX_SLIDES_PER_CALL = 10;

// Per-device daily budget so one runaway client (or a stuck loop) can't burn
// tokens unbounded. In-memory per serverless instance, like stt.js: not exact
// accounting, but a real ceiling in practice.
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_LIMITS = { cards: 80, track: 900, answer: 150 };
const buckets = new Map(); // device|action -> {count, resetAt}
function budgetCheck(device_id, action) {
  const key = (device_id || "anon") + "|" + action;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.resetAt) { b = { count: 0, resetAt: now + DAY_MS }; buckets.set(key, b); }
  b.count++;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  return b.count <= (DAILY_LIMITS[action] || 100);
}

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

async function claude({ model = HAIKU, system, content, max_tokens, tools }) {
  const call = (messages) => fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens, system, messages, ...(tools ? { tools } : {}) }),
  }).then((r) => r.json());

  const messages = [{ role: "user", content }];
  let data = await call(messages);
  // Server-side tools (web search) can pause mid-loop; one continuation pass
  // resumes the same turn. The trailing server_tool_use block tells the API
  // to pick up where it left off.
  if (!data.error && data.stop_reason === "pause_turn") {
    messages.push({ role: "assistant", content: data.content });
    data = await call(messages);
  }
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
  const cardRule = inSlides
    ? `Go slide by slide, in order. MOST slides become exactly ONE card. Split a single slide into TWO or more cards ONLY when it genuinely carries several distinct ideas, or so much content that one card would be cramped; each card then covers one coherent chunk you'd say in one stretch. On EVERY card set "n" to the SLIDE NUMBER it belongs to (multiple cards may share the same n). If a slide has little or no text (a title or divider), output one card with a single short point such as introducing the topic or yourself.`
    : `Turn the outline into a sensible sequence of cards, one per logical section. Set "n" to the card's position, starting at 1.`;
  const sys = `You are a presentation coach building CUE CARDS for someone about to give this presentation live, in person, with the slides behind them and a phone in front of them. The cards must let them present confidently even if they did not write the deck, so the content has to actually teach them what each slide claims and tell them what to SAY, not just what the topic is.
${langLine}
${cardRule}
Rules:
- Per card: a short title (max 6 words) and 3 to 5 talking points, so the presenter always has several things to say about the slide. Only true title, divider, or thanks slides may have 1 or 2 points. Mine the slide (and notes) for substance: facts, numbers, names, reasons, examples, consequences. A talk is not a reading of the slide, but nothing important may be missing. If a slide has more than 5 worthwhile points, SPLIT it into multiple cards rather than cramming or dropping content.
- NEVER make points out of things nobody says out loud: page numbers, footers, headers, image credits, source citations, URLs, file names, agenda listings, decorative labels, contact details. If a slide is mostly that, one short point is enough.
- A title/opening slide gets a greeting point: welcome the audience, introduce yourself and the topic. A closing/thanks slide gets a wrap-up point: summarize the core message, thank them, invite questions.
- Each point has two parts that must clearly match each other:
  "t": the CHECKLIST phrase, max 8 words, the concrete idea (a fact, number, name, or claim). Glanceable at podium distance. It is a label for "say", so it must name the SAME idea "say" delivers.
  "say": what to actually SAY out loud, in natural confident spoken language, so a presenter who did not write the deck still sounds like they understand it. ONE strong sentence, PLUS a second sentence whenever a number, term, or claim needs explaining (what it means, why it matters). Never just restate "t" in other words; teach the point so they could defend it.
- "bridge": one short spoken sentence that hands off to the next slide and teases what is coming. Omit on the last card.
- If presenter notes are provided, treat them as the presenter's intent and fold them in.
- No em-dashes or en-dashes anywhere; use commas or periods.
Return ONLY valid JSON, no markdown, no preamble:
{${wantTitle ? '"title":"<deck title, max 6 words>",' : ""}"cards":[{"n":<slide number>,"title":"...","points":[{"t":"...","say":"..."}],"bridge":"..."}]}`;

  const userText =
    (inSlides ? "SLIDE TEXT:\n" + deckText : "PRESENTATION OUTLINE:\n" + deckText) + "\n\n" +
    (notes ? "PRESENTER'S OWN NOTES:\n" + notes + "\n\n" : "") +
    "Build the cue cards now.";

  // Bound output so a batch can never run long. More headroom per slide now that
  // a dense slide may fan out into several cards with richer spoken lines.
  const slideCount = inSlides ? inSlides.length : 8;
  const maxTokens = Math.min(8000, 700 + slideCount * 1000);
  const { text, usage } = await claude({ system: sys, content: [{ type: "text", text: userText }], max_tokens: maxTokens });
  logUsage({
    device_id, provider: "anthropic", service: "present_cards", model: HAIKU,
    input_units: usage?.input_tokens || 0, output_units: usage?.output_tokens || 0,
    cost_micros: anthropicCostMicros(HAIKU, usage),
  });

  const parsed = parseJson(text);
  if (!Array.isArray(parsed.cards) || !parsed.cards.length) throw new Error("model returned no cards");
  // A slide may now fan out into several cards, so the model reports each card's
  // slide number "n". Ids stay globally unique by combining that slide number
  // (unique across batches, since each slide lives in exactly one batch) with a
  // per-slide card counter: s<n>c<k>p<i>.
  const validNs = inSlides ? inSlides.map((s) => s.n) : null;
  const perSlide = new Map(); // slide n -> cards seen so far
  const cards = parsed.cards.map((c, ci) => {
    let n;
    if (inSlides) {
      const want = Number(c.n);
      n = validNs.includes(want) ? want : validNs[Math.min(ci, validNs.length - 1)];
    } else {
      n = Number(c.n) || ci + 1;
    }
    const k = (perSlide.get(n) || 0) + 1;
    perSlide.set(n, k);
    return {
      n,
      title: String(c.title || "Slide " + n).slice(0, 80),
      points: (Array.isArray(c.points) ? c.points : []).slice(0, MAX_POINTS_PER_CARD).map((p, pi) => ({
        id: `s${n}c${k}p${pi + 1}`,
        t: String(p.t || "").slice(0, 90),
        say: String(p.say || "").slice(0, 500),
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
Mark a point as "covered" when the speaker got its core idea across IN ANY WORDING. Be generous: paraphrases, the speaker's own words, simplified versions, all count. The transcript comes from speech recognition, so tolerate garbled or similar-sounding words. Only leave a point unchecked if its substance truly has not come up yet. Cover points from EITHER slide.
Also decide "moveon": true when the speaker is essentially done with the CURRENT slide. That means the main ideas landed, or they are clearly summarizing or transitioning, even if minor points remain. False while they are still mid-topic.
And decide "next": true when the speaker has clearly ALREADY MOVED ON to the next slide, meaning the recent transcript is mostly about the NEXT slide's points or topic, not the current one. This is a stronger signal than moveon and triggers an immediate jump ahead, so only set it true when you are confident the speaker has left the current slide behind. False if there is no next slide, or they are still on the current slide. Never set "next" without also reflecting any next-slide points they covered in "covered".
Return ONLY valid JSON: {"covered":["<id>", ...],"moveon":true|false,"next":true|false}`;
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

  let covered = [], moveon = false, next = false;
  try {
    const parsed = parseJson(text);
    const known = new Set([...points, ...nextPoints].map((p) => p.id));
    covered = (Array.isArray(parsed.covered) ? parsed.covered : []).filter((id) => known.has(id));
    moveon = !!parsed.moveon;
    next = !!parsed.next && nextPoints.length > 0; // only meaningful when a next slide was supplied
  } catch { covered = []; }
  return { status: 200, json: { covered, moveon, next } };
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

  // Q&A-round mode ('web': true) may search the internet when the deck doesn't
  // contain the answer. max_uses caps the searches per question (cost guard).
  const web = !!body.web;
  const sys = `Someone is mid-presentation and just got a question from the audience. Give them an answer they can read at a glance on their phone and deliver out loud${lang === "de" ? ", auf Deutsch" : ""}.
Rules: maximum ${web ? 80 : 60} words. Start with the direct answer in the first sentence, then at most two supporting sentences. Spoken language, no bullet symbols, no markdown, no URLs, no em-dashes.${web
    ? " Answer from the presentation context when it suffices. If it does not, use web search to find the fact, then answer in your own spoken words. If neither helps, say so honestly and give one graceful spoken line to respond with anyway."
    : " If the question cannot be answered from the presentation context, say so honestly and give them one graceful spoken line to respond with anyway (for example offering to follow up after)."}`;
  const userText = `PRESENTATION: ${deckTitle}\n${cardCtx}\n${notes ? "PRESENTER NOTES:\n" + notes + "\n" : ""}\nQUESTION FROM THE AUDIENCE:\n${question}\n\nWrite the answer they should say now.`;

  const { text, usage } = await claude({
    system: sys,
    content: [{ type: "text", text: userText }],
    max_tokens: web ? 700 : 350,
    tools: web ? [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }] : undefined,
  });
  logUsage({
    device_id, provider: "anthropic", service: web ? "present_qa_web" : "present_answer", model: HAIKU,
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
    if (String(e.message) === "too_big") return res.status(413).json({ error: "deck too large" });
    return res.status(400).json({ error: "bad json" });
  }
  const device_id = String(body.device_id || "").slice(0, 64);
  if (["cards", "track", "answer"].includes(body.action) && !budgetCheck(device_id, body.action)) {
    return res.status(429).json({ error: "Tageslimit erreicht. Versuch es morgen wieder." });
  }
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
