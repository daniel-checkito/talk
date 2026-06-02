// POST /api/debrief -> { score, hit_goal, verdict, worked[], fix[], weak_line, better_line }
// Body: { partner, goalIndex, history, nudgeCount }
const { PARTNERS } = require("./_personas");
const { requireAuth } = require("./_auth");
const { logUsage, anthropicCostMicros } = require("./_usage");

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
    const { partner, goalIndex, history, nudgeCount, device_id } = req.body || {};
    const p = PARTNERS[partner];
    if (!p) return res.status(400).json({ error: "unknown partner" });
    const g = p.goals[goalIndex];

    const sys = `You are a sharp, encouraging conversation coach. Analyze this "${partner}" roleplay. The user's goal was: "${g.t}". Win condition: ${g.win}
Score against this rubric: ${g.rubric.join(", ")}.
STYLE RULES: Do NOT use em-dashes or en-dashes anywhere in your output. Use commas, periods, or simple words. No emojis.
Be specific and reference what the user ACTUALLY said. Return ONLY valid JSON, no markdown:
{"score":<0-100 integer>,"hit_goal":<true/false>,"verdict":"<one encouraging sentence>","worked":["<thing 1>","<thing 2>"],"fix":["<thing 1>","<thing 2>"],"weak_line":"<the user's weakest actual line, verbatim or close>","better_line":"<a stronger rewrite of that line>"}`;

    const convo = (history || []).map((h) => `${h.role === "me" ? "USER" : p.name}: ${h.text}`).join("\n");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", // quality matters for the debrief
        max_tokens: 1500,
        system: sys,
        messages: [{ role: "user", content: "Transcript:\n" + convo + `\n\n(Live nudges shown during scene: ${nudgeCount || 0})` }],
      }),
    });
    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message || "anthropic error" });
    const model = "claude-sonnet-4-6";
    logUsage({
      device_id, provider: "anthropic", service: "debrief", model,
      input_units: data.usage?.input_tokens || 0,
      output_units: data.usage?.output_tokens || 0,
      cost_micros: anthropicCostMicros(model, data.usage),
    });
    let txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(txt);
    parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    parsed.verdict = stripDashes(parsed.verdict);
    parsed.weak_line = stripDashes(parsed.weak_line);
    parsed.better_line = stripDashes(parsed.better_line);
    parsed.worked = (parsed.worked || []).map(stripDashes);
    parsed.fix = (parsed.fix || []).map(stripDashes);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
