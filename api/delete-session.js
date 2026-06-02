// POST /api/delete-session  -> { ok: true, deleted_messages, deleted_takes }
// Body: { session_id, device_id }
// Used when the user cancels a scene mid-flight: removes any turns that were
// auto-saved by save-message + any take row, so the scene never appears in
// Talks / Progress.
const { ready, rest } = require("./_db");
const { requireAuth } = require("./_auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!requireAuth(req, res)) return;
  if (!ready()) return res.status(200).json({ ok: true, skipped: true });
  try {
    const { session_id, device_id } = req.body || {};
    if (!session_id || !device_id) return res.status(400).json({ error: "session_id and device_id required" });
    const sid = String(session_id).slice(0, 64);
    const did = String(device_id).slice(0, 64);

    // Scoped by device_id so a session id alone can't be used to nuke another device's data.
    const msgPath = `/rehearse_messages?session_id=eq.${encodeURIComponent(sid)}&device_id=eq.${encodeURIComponent(did)}`;
    const takePath = `/rehearse_takes?session_id=eq.${encodeURIComponent(sid)}&device_id=eq.${encodeURIComponent(did)}`;

    // Best-effort delete; ignore individual failures so a missing table or
    // empty result doesn't surface as an error to the user mid-cancel.
    let deletedMsgs = 0, deletedTakes = 0;
    try {
      const r = await rest(msgPath, { method: "DELETE", headers: { Prefer: "return=representation" } });
      deletedMsgs = Array.isArray(r) ? r.length : 0;
    } catch {}
    try {
      const r = await rest(takePath, { method: "DELETE", headers: { Prefer: "return=representation" } });
      deletedTakes = Array.isArray(r) ? r.length : 0;
    } catch {}

    return res.status(200).json({ ok: true, deleted_messages: deletedMsgs, deleted_takes: deletedTakes });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
