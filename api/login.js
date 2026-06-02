// POST /api/login -> { ok: true }  body: { password }
// GET  /api/login -> { authed: <bool> }   (cheap "am I logged in" check)
const { hasCookie, setCookie, clearCookie } = require("./_auth");

module.exports = async (req, res) => {
  if (req.method === "GET") return res.status(200).json({ authed: hasCookie(req) });
  if (req.method === "DELETE") { clearCookie(res); return res.status(200).json({ ok: true }); }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.APP_PASSWORD) return res.status(500).json({ error: "APP_PASSWORD not set on the server" });
  const pw = (req.body || {}).password || "";
  if (pw !== process.env.APP_PASSWORD) return res.status(401).json({ error: "wrong password" });
  setCookie(res);
  return res.status(200).json({ ok: true });
};
