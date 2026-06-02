// POST /api/save-speech -> { ok: true }
// Persists one teleprompter take.
const { ready, rest } = require("./_db");
const { requireAuth } = require("./_auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!requireAuth(req, res)) return;
  if (!ready()) return res.status(200).json({ ok: false, skipped: "supabase not configured" });
  try {
    const b = req.body || {};
    if (!b.device_id) return res.status(400).json({ error: "device_id required" });
    const row = {
      device_id: String(b.device_id).slice(0, 64),
      template: b.template ? String(b.template).slice(0, 64) : null,
      context: String(b.context || "keynote").slice(0, 24),
      script_excerpt: b.script_excerpt ? String(b.script_excerpt).slice(0, 500) : null,
      score: Math.max(0, Math.min(100, Math.round(b.score || 0))),
      wpm: Number.isFinite(b.wpm) ? Math.round(b.wpm) : null,
      fillers: Number.isFinite(b.fillers) ? Math.round(b.fillers) : null,
      pause_count: Number.isFinite(b.pause_count) ? Math.round(b.pause_count) : null,
      pitch_std: Number.isFinite(b.pitch_std) ? Math.round(b.pitch_std) : null,
      faithfulness: b.faithfulness == null ? null : Math.max(0, Math.min(100, Math.round(b.faithfulness))),
      duration_s: Number.isFinite(b.duration_s) ? Math.round(b.duration_s) : null,
    };
    await rest("/rehearse_speech_takes", { method: "POST", body: JSON.stringify(row) });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
