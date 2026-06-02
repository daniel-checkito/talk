// POST /api/save  -> { ok: true }
// Body: { kind: "message" | "take" | "speech", ...fields }
// Single endpoint that replaces save-message + save-take + save-speech to stay
// under the Hobby-tier 12-function cap. Behavior per kind is unchanged.
const { ready, rest } = require("./_db");
const { requireAuth } = require("./_auth");

const VALID_ROLES = new Set(["me", "them"]);
const VALID_RATINGS = new Set(["great", "good", "ok", "miss"]);

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!requireAuth(req, res)) return;
  if (!ready()) return res.status(200).json({ ok: false, skipped: "supabase not configured" });
  try {
    const b = req.body || {};
    const kind = String(b.kind || "").toLowerCase();
    if (kind === "message") return await saveMessage(b, res);
    if (kind === "take") return await saveTake(b, res);
    if (kind === "speech") return await saveSpeech(b, res);
    if (kind === "cancel") return await cancelSession(b, res);
    return res.status(400).json({ error: "unknown kind" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};

async function saveMessage(b, res) {
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
    delivery: b.delivery && typeof b.delivery === "object" ? b.delivery : null,
  };
  await rest("/rehearse_messages", { method: "POST", body: JSON.stringify(row) });
  return res.status(200).json({ ok: true });
}

async function saveTake(b, res) {
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
    drill: !!b.drill,
  };
  await rest("/rehearse_takes", { method: "POST", body: JSON.stringify(row) });
  return res.status(200).json({ ok: true });
}

// kind:'cancel' - wipe a session's messages + take row. Scoped by device_id
// so a leaked session id alone can't touch another device's data.
async function cancelSession(b, res) {
  if (!b.session_id || !b.device_id) return res.status(400).json({ error: "session_id and device_id required" });
  const sid = String(b.session_id).slice(0, 64);
  const did = String(b.device_id).slice(0, 64);
  const msgPath = `/rehearse_messages?session_id=eq.${encodeURIComponent(sid)}&device_id=eq.${encodeURIComponent(did)}`;
  const takePath = `/rehearse_takes?session_id=eq.${encodeURIComponent(sid)}&device_id=eq.${encodeURIComponent(did)}`;
  let deletedMsgs = 0, deletedTakes = 0;
  try { const r = await rest(msgPath, { method: "DELETE", headers: { Prefer: "return=representation" } }); deletedMsgs = Array.isArray(r) ? r.length : 0; } catch {}
  try { const r = await rest(takePath, { method: "DELETE", headers: { Prefer: "return=representation" } }); deletedTakes = Array.isArray(r) ? r.length : 0; } catch {}
  return res.status(200).json({ ok: true, deleted_messages: deletedMsgs, deleted_takes: deletedTakes });
}

async function saveSpeech(b, res) {
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
}
