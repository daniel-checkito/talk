// POST /api/save-message -> { ok: true }
// Body: { session_id, device_id, partner, goal_index, variant, role, text,
//         rating?, feedback?, goal_hit? }
// Persists one conversation turn. Fire-and-forget from the client.
const { ready, rest } = require("./_db");

const VALID_ROLES = new Set(["me", "them"]);
const VALID_RATINGS = new Set(["great", "good", "ok", "miss"]);

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!ready()) return res.status(200).json({ ok: false, skipped: "supabase not configured" });
  try {
    const b = req.body || {};
    if (!b.session_id || !b.device_id || !b.partner || !b.role || !b.text) {
      return res.status(400).json({ error: "session_id, device_id, partner, role, text required" });
    }
    if (!VALID_ROLES.has(b.role)) return res.status(400).json({ error: "bad role" });
    const row = {
      session_id: String(b.session_id).slice(0, 64),
      device_id: String(b.device_id).slice(0, 64),
      partner: String(b.partner).slice(0, 32),
      goal_index: Number.isInteger(b.goal_index) ? b.goal_index : 0,
      variant: Number.isInteger(b.variant) ? b.variant : null,
      role: b.role,
      text: String(b.text).slice(0, 4000),
      rating: VALID_RATINGS.has(b.rating) ? b.rating : null,
      feedback: b.feedback ? String(b.feedback).slice(0, 500) : null,
      goal_hit: b.goal_hit == null ? null : !!b.goal_hit,
    };
    await rest("/rehearse_messages", { method: "POST", body: JSON.stringify(row) });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
