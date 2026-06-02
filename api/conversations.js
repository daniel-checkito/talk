// GET /api/conversations?device_id=...                -> session list (recent 30)
// GET /api/conversations?device_id=...&session_id=Y    -> full transcript of one session
const { ready, rest } = require("./_db");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!ready()) return res.status(200).json({ sessions: [], skipped: true });
  try {
    const device_id = String(req.query.device_id || "").slice(0, 64);
    if (!device_id) return res.status(400).json({ error: "device_id required" });
    const session_id = req.query.session_id ? String(req.query.session_id).slice(0, 64) : null;

    if (session_id) return res.status(200).json(await getDetail(device_id, session_id));
    return res.status(200).json({ sessions: await listSessions(device_id) });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};

async function listSessions(device_id) {
  // Pull the most recent ~500 turns and group client-side. Keeps schema simple.
  const msgs = await rest(
    `/rehearse_messages?device_id=eq.${encodeURIComponent(device_id)}` +
    `&select=session_id,partner,goal_index,role,text,created_at` +
    `&order=created_at.desc&limit=500`
  );
  const byId = new Map();
  for (const m of msgs) {
    let s = byId.get(m.session_id);
    if (!s) {
      s = {
        session_id: m.session_id,
        partner: m.partner,
        goal_index: m.goal_index,
        started_at: m.created_at,
        last_at: m.created_at,
        last_text: m.text,
        turn_count: 0,
      };
      byId.set(m.session_id, s);
    }
    s.turn_count++;
    if (new Date(m.created_at) > new Date(s.last_at)) {
      s.last_at = m.created_at;
      s.last_text = m.text;
    }
    if (new Date(m.created_at) < new Date(s.started_at)) s.started_at = m.created_at;
  }
  const list = [...byId.values()]
    .sort((a, b) => new Date(b.last_at) - new Date(a.last_at))
    .slice(0, 30);

  // Attach take info (score, hit_goal) where we have one.
  if (list.length) {
    const ids = list.map((s) => `"${s.session_id}"`).join(",");
    const takes = await rest(
      `/rehearse_takes?session_id=in.(${ids})&select=session_id,score,hit_goal`
    );
    const tById = new Map(takes.map((t) => [t.session_id, t]));
    for (const s of list) {
      const t = tById.get(s.session_id);
      if (t) { s.score = t.score; s.hit_goal = t.hit_goal; }
    }
  }
  return list;
}

async function getDetail(device_id, session_id) {
  const msgs = await rest(
    `/rehearse_messages?device_id=eq.${encodeURIComponent(device_id)}` +
    `&session_id=eq.${encodeURIComponent(session_id)}` +
    `&select=role,text,rating,feedback,goal_hit,partner,goal_index,created_at` +
    `&order=created_at.asc`
  );
  const takeRows = await rest(
    `/rehearse_takes?session_id=eq.${encodeURIComponent(session_id)}` +
    `&select=score,hit_goal,verdict,turn_count&limit=1`
  );
  const first = msgs[0] || null;
  return {
    session_id,
    partner: first?.partner || null,
    goal_index: first?.goal_index ?? null,
    started_at: first?.created_at || null,
    take: takeRows[0] || null,
    messages: msgs.map((m) => ({
      role: m.role,
      text: m.text,
      rating: m.rating,
      feedback: m.feedback,
      goal_hit: m.goal_hit,
      created_at: m.created_at,
    })),
  };
}
