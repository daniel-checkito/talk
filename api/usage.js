// GET /api/usage?device_id=...
// Aggregated cost summary for the Profile/Progress dashboard.
// Returns totals, last-7d, last-30d, and a per-service breakdown.
const { ready, rest } = require("./_db");
const { requireAuth } = require("./_auth");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!requireAuth(req, res)) return;
  if (!ready()) return res.status(200).json({ skipped: true, total_usd: 0, services: [] });
  try {
    const device_id = String(req.query.device_id || "").slice(0, 64);
    if (!device_id) return res.status(400).json({ error: "device_id required" });

    const since90 = new Date(Date.now() - 90 * 86400000).toISOString();
    const rows = await rest(
      `/rehearse_usage?device_id=eq.${encodeURIComponent(device_id)}` +
      `&created_at=gte.${since90}` +
      `&select=provider,service,model,input_units,output_units,cost_micros,created_at` +
      `&order=created_at.desc&limit=5000`
    );

    const now = Date.now();
    const sevenAgo = now - 7 * 86400000;
    const thirtyAgo = now - 30 * 86400000;

    let total = 0, total7 = 0, total30 = 0, calls = 0;
    const byService = {}; // service -> { calls, cost_micros, input_units, output_units, provider, model }
    const byProvider = {}; // provider -> cost
    const byDay = {}; // YYYY-MM-DD -> cost (last 30d only)

    for (const r of rows) {
      const ts = new Date(r.created_at).getTime();
      const c = r.cost_micros || 0;
      total += c;
      if (ts >= sevenAgo) total7 += c;
      if (ts >= thirtyAgo) {
        total30 += c;
        const day = new Date(r.created_at).toISOString().slice(0, 10);
        byDay[day] = (byDay[day] || 0) + c;
      }
      calls++;
      const key = r.service || "unknown";
      const s = byService[key] || { service: key, provider: r.provider, model: r.model, calls: 0, cost_micros: 0, input_units: 0, output_units: 0 };
      s.calls++;
      s.cost_micros += c;
      s.input_units += r.input_units || 0;
      s.output_units += r.output_units || 0;
      byService[key] = s;
      byProvider[r.provider || "unknown"] = (byProvider[r.provider || "unknown"] || 0) + c;
    }

    const microsToUsd = m => m / 1_000_000;
    const services = Object.values(byService)
      .map(s => ({ ...s, cost_usd: microsToUsd(s.cost_micros) }))
      .sort((a, b) => b.cost_micros - a.cost_micros);
    const providers = Object.entries(byProvider)
      .map(([provider, cost_micros]) => ({ provider, cost_usd: microsToUsd(cost_micros) }))
      .sort((a, b) => b.cost_usd - a.cost_usd);

    // Last-30d sparkline series. Fill gaps so the chart is stable.
    const series = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(now - i * 86400000).toISOString().slice(0, 10);
      series.push({ day, cost_usd: microsToUsd(byDay[day] || 0) });
    }

    return res.status(200).json({
      calls,
      total_usd: microsToUsd(total),
      total_7d_usd: microsToUsd(total7),
      total_30d_usd: microsToUsd(total30),
      services,
      providers,
      series_30d: series,
      window_days: 90,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
