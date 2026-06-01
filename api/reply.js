// POST /api/reply  -> { reply, nudge, goal_hit }
// Body: { partner, goalIndex, history:[{role:'me'|'them', text}] }
const { PARTNERS } = require("./_personas");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { partner, goalIndex, history } = req.body || {};
    const p = PARTNERS[partner];
    if (!p) return res.status(400).json({ error: "unknown partner" });
    const g = p.goals[goalIndex];

    const sys = `${p.persona}
You are in a live spoken conversation. Reply in 1-3 short, natural, interruptible sentences — it will be read aloud, so write the way people actually talk. Stay 100% in character. Never mention being an AI.
PRIVATE GOAL LOGIC: The user is secretly trying to: "${g.t}". Only behave as if they've succeeded when: ${g.win}
HIDDEN COACHING: You also silently coach the user. Judging ONLY their most recent message, if they clearly slipped (rambling, needy, arrogant, weak joke, missed an obvious opening, folded on their position), give a MAX 6-word nudge. Otherwise leave it empty. The user sees the nudge privately; your character does not.
Return ONLY valid JSON, no markdown, no preamble:
{"reply":"<in-character reply>","nudge":"<max 6 words, or empty string>","goal_hit":<true ONLY if the win condition was genuinely met this turn, else false>}`;

    const convo = (history || []).map((h) => `${h.role === "me" ? "USER" : "YOU"}: ${h.text}`).join("\n");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // fast + cheap for the per-turn loop
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
    catch { parsed = { reply: txt || "…", nudge: "", goal_hit: false }; }
    parsed.nudge = (parsed.nudge || "").trim();
    parsed.goal_hit = !!parsed.goal_hit;
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
