// POST /api/coach -> { answer }
// Body: { device_id, question, lang, dashboard }
// AI Q&A on the user's performance. Frontend sends the same dashboard snapshot
// it just rendered so we don't re-aggregate the database here for every question.
const { requireAuth } = require("./_auth");
const { logUsage, anthropicCostMicros } = require("./_usage");

const MAX_Q_CHARS = 500;
const MODEL = "claude-sonnet-4-6";

function compactDashboard(d) {
  if (!d) return null;
  // Pull a focused snapshot Claude can reason over without bloating tokens.
  return {
    composite: d.composite,
    practice: d.practice,
    practice_volume: d.practice_volume,
    dimensions: (d.dimensions || []).map(x => ({
      key: x.key, label: x.label, category: x.category,
      value: x.value, score: x.score, target: x.target,
    })),
    strengths: (d.strengths || []).map(s => ({ key: s.key, label: s.label, score: s.score })),
    weaknesses: (d.weaknesses || []).map(w => ({ key: w.key, label: w.label, score: w.score, trend: w.trend })),
    themes: d.themes,
    top_fillers: d.top_fillers,
    partners: d.partners,
    rating_mix: d.rating_mix,
    sample_size: d.sample_size,
    score_trend_summary: (() => {
      const t = d.score_trend || [];
      if (!t.length) return null;
      return { count: t.length, first: t[0].score, last: t[t.length - 1].score };
    })(),
  };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!requireAuth(req, res)) return;
  try {
    const { device_id, question, lang, dashboard } = req.body || {};
    if (!question || typeof question !== "string") return res.status(400).json({ error: "question required" });
    const q = question.slice(0, MAX_Q_CHARS);
    const isDe = lang === "de";
    const snapshot = compactDashboard(dashboard);

    const sys = isDe
      ? `Du bist ein scharfer, ermutigender Sprech-Coach für die Rehearse-App. Der Nutzer hat sein Speaker-Dashboard mit echten Metriken aus seinen Übungssitzungen. Analysiere DIESE Daten, um die Frage zu beantworten. Sei spezifisch, konkret, umsetzbar. Verweise auf die tatsächlichen Zahlen (z.B. "deine Tempo-Kontrolle liegt bei 48"). Vermeide allgemeine Coaching-Floskeln. Max 4-6 Sätze. Schreibe AUSSCHLIESSLICH auf Deutsch. Keine Em-Dashes, keine Emojis, keine Markdown-Listen.`
      : `You are a sharp, encouraging speech coach for the Rehearse app. The user has a speaker dashboard with real metrics from their practice sessions. Analyze THIS data to answer their question. Be specific, concrete, actionable. Refer to actual numbers (e.g. "your tempo control sits at 48"). Skip generic coaching platitudes. Max 4-6 sentences. Reply only in English. No em-dashes, no emojis, no markdown lists.`;

    const userMsg = `Dashboard snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nUser question: ${q}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: sys,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message || "anthropic error" });
    logUsage({
      device_id, provider: "anthropic", service: "coach", model: MODEL,
      input_units: data.usage?.input_tokens || 0,
      output_units: data.usage?.output_tokens || 0,
      cost_micros: anthropicCostMicros(MODEL, data.usage),
    });
    const answer = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("")
      .replace(/\s*[—–]\s*/g, ", ").trim();
    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
