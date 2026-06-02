// POST /api/reply  -> { reply, nudge, goal_hit }
// Body: { partner, goalIndex, history:[{role:'me'|'them', text}], variant }
const { PARTNERS } = require("./_personas");
const { requireAuth } = require("./_auth");

function stripDashes(s) {
  if (!s) return s;
  return String(s)
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/[—–]/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/,+/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!requireAuth(req, res)) return;
  try {
    const { partner, goalIndex, history, variant } = req.body || {};
    const p = PARTNERS[partner];
    if (!p) return res.status(400).json({ error: "unknown partner" });
    const g = p.goals[goalIndex];

    const variants = p.variants || [];
    const vi = Number.isInteger(variant) && variant >= 0 && variant < variants.length ? variant : 0;
    const variantLine = variants[vi] || "";

    const sys = `${p.persona}
${variantLine ? "MOOD FOR THIS SCENE: " + variantLine : ""}
You are in a live spoken conversation. Reply in 1-3 short, natural, interruptible sentences, it will be read aloud, so write the way people actually talk. Stay 100% in character. Never mention being an AI.
STYLE RULES: Do NOT use em-dashes or en-dashes. Use commas, periods, or simple words instead. Do not use ellipses for dramatic pauses; just write the sentence. No emojis.
PRIVATE GOAL LOGIC: The user is secretly trying to: "${g.t}". Only behave as if they've succeeded when: ${g.win}
HIDDEN COACHING: You also silently coach the user, judging ONLY their most recent message against the goal "${g.t}" and rubric: ${g.rubric.join(", ")}.
Rate it as one of:
  "great" = nailed it, used the rubric well, real progress toward the goal
  "good"  = solid, on track
  "ok"    = neutral, neither helping nor hurting
  "miss"  = clearly slipped (rambling, needy, arrogant, weak joke, missed an obvious opening, folded on their position)
Then write a MAX 8-word feedback line that ALWAYS describes what was good or what to fix. Be specific, not generic.
The user sees the rating and feedback privately; your character does not. Feedback must follow the no-dash rule.
Return ONLY valid JSON, no markdown, no preamble:
{"reply":"<in-character reply>","rating":"great|good|ok|miss","feedback":"<max 8 words>","goal_hit":<true ONLY if the win condition was genuinely met this turn, else false>}`;

    const convo = (history || []).map((h) => `${h.role === "me" ? "USER" : "YOU"}: ${h.text}`).join("\n");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: sys,
        messages: [{ role: "user", content: "Conversation so far:\n" + convo + "\n\nRespond as your character now." }],
      }),
    });
    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message || "anthropic error" });
    let txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").replace(/```json|```/g, "").trim();
    let parsed;
    try { parsed = JSON.parse(txt); }
    catch { parsed = { reply: txt || "...", rating: "ok", feedback: "", goal_hit: false }; }
    const validRatings = ["great", "good", "ok", "miss"];
    parsed.reply = stripDashes(parsed.reply || "");
    parsed.feedback = stripDashes((parsed.feedback || "").trim());
    parsed.rating = validRatings.includes(parsed.rating) ? parsed.rating : "ok";
    parsed.goal_hit = !!parsed.goal_hit;
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
