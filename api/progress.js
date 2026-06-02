// GET /api/progress?device_id=...&partner=...&goal_index=...
//   partner+goal_index optional: if provided, returns stats scoped to that prompt
// -> { takes, best_score, gain, recent: [{score, hit_goal, partner, goal_index, created_at, verdict}] }
const { ready, rest } = require("./_db");
const { requireAuth } = require("./_auth");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!requireAuth(req, res)) return;
  if (!ready()) return res.status(200).json({ takes: 0, best_score: null, gain: null, recent: [], skipped: true });
  try {
    const device_id = String(req.query.device_id || "").slice(0, 64);
    if (!device_id) return res.status(400).json({ error: "device_id required" });
    const partner = req.query.partner ? String(req.query.partner).slice(0, 32) : null;
    const goalIdx = req.query.goal_index != null && req.query.goal_index !== "" ? Number(req.query.goal_index) : null;

    const filters = [`device_id=eq.${encodeURIComponent(device_id)}`];
    if (partner) filters.push(`partner=eq.${encodeURIComponent(partner)}`);
    if (Number.isInteger(goalIdx)) filters.push(`goal_index=eq.${goalIdx}`);
    const qs = filters.join("&");

    // Fetch up to last 50 takes for this scope, newest first.
    const rows = await rest(
      `/rehearse_takes?${qs}&order=created_at.desc&limit=50&select=score,hit_goal,partner,goal_index,verdict,created_at`
    );
    const scores = rows.map((r) => r.score);
    const best = scores.length ? Math.max(...scores) : null;
    // Gain = newest score minus oldest score across the (up to 50) returned takes.
    const gain = scores.length >= 2 ? scores[0] - scores[scores.length - 1] : null;
    return res.status(200).json({ takes: rows.length, best_score: best, gain, recent: rows });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
