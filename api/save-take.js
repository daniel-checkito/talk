// POST /api/save-take -> { ok: true }
// Body: { device_id, partner, goal_index, score, hit_goal, nudge_count, turn_count, verdict }
const { ready, rest } = require("./_db");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!ready()) return res.status(200).json({ ok: false, skipped: "supabase not configured" });
  try {
    const b = req.body || {};
    if (!b.device_id || !b.partner) return res.status(400).json({ error: "device_id and partner required" });
    const row = {
      device_id: String(b.device_id).slice(0, 64),
      partner: String(b.partner).slice(0, 32),
      goal_index: Number.isInteger(b.goal_index) ? b.goal_index : 0,
      score: Math.max(0, Math.min(100, Math.round(b.score || 0))),
      hit_goal: !!b.hit_goal,
      nudge_count: Math.max(0, Math.round(b.nudge_count || 0)),
      turn_count: Math.max(0, Math.round(b.turn_count || 0)),
      verdict: b.verdict ? String(b.verdict).slice(0, 500) : null,
      session_id: b.session_id ? String(b.session_id).slice(0, 64) : null,
    };
    await rest("/rehearse_takes", { method: "POST", body: JSON.stringify(row) });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
