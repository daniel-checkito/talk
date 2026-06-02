// POST /api/login -> { ok: true }  body: { password }
// GET  /api/login -> { authed: <bool> }   (cheap "am I logged in" check)
const { hasCookie, setCookie, clearCookie, password } = require("./_auth");

module.exports = async (req, res) => {
  if (req.method === "GET") return res.status(200).json({ authed: hasCookie(req) });
  if (req.method === "DELETE") { clearCookie(res); return res.status(200).json({ ok: true }); }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const pw = (req.body || {}).password || "";
  if (pw !== password()) return res.status(401).json({ error: "wrong password" });
  setCookie(res);
  return res.status(200).json({ ok: true });
};
