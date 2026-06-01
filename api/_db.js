// Tiny Supabase REST helper — uses the service-role key (server-only).
// Required Vercel env vars:
//   SUPABASE_URL                  e.g. https://xxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY     (from Supabase dashboard -> Project Settings -> API)
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function ready() {
  return !!(URL && KEY);
}

async function rest(path, init = {}) {
  const r = await fetch(`${URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) throw new Error(`supabase ${r.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
}

module.exports = { ready, rest };
