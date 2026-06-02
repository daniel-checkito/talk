// GET /api/dashboard?device_id=...
// Aggregated speaker dashboard: practice cadence, strengths, weaknesses,
// per-dimension scoring against research-grounded benchmarks, and the
// most common coaching note.
const { ready, rest } = require("./_db");
const { requireAuth } = require("./_auth");

// Benchmarks. Each band returns a 0-100 score. Sources:
//   pace        - TED-talk corpus avg ~163 wpm; conversational sweet spot 140-160.
//   filler rate - Pro speakers <2%/100w; nervous speakers 6%+.
//   pitch std   - Higher prosodic variance (>=25 Hz) correlates with engagement.
//   hedging     - Lakoff "powerless speech" markers; top speakers <1.5/100w.
//   confidence  - Composite from delivery analyzer.
//   goal hit    - App rubric pass rate.
function paceScore(wpm) {
  if (!wpm) return null;
  if (wpm >= 140 && wpm <= 160) return 100;
  if (wpm >= 130 && wpm <= 170) return 85;
  if (wpm >= 120 && wpm <= 180) return 70;
  const d = wpm < 120 ? 120 - wpm : wpm - 180;
  return Math.max(20, Math.round(70 - d * 1.5));
}
function fillerRateScore(rate) {
  if (rate == null) return null;
  if (rate < 1) return 100;
  if (rate < 2) return 90;
  if (rate < 4) return 75;
  if (rate < 6) return 55;
  return Math.max(15, Math.round(55 - (rate - 6) * 6));
}
function varietyScore(std) {
  if (std == null) return null;
  if (std >= 30) return 100;
  if (std >= 25) return 90;
  if (std >= 18) return 75;
  if (std >= 12) return 55;
  return Math.max(15, Math.round(std * 4));
}
function hedgeRateScore(rate) {
  if (rate == null) return null;
  if (rate < 1) return 100;
  if (rate < 1.5) return 90;
  if (rate < 3) return 75;
  if (rate < 5) return 55;
  return Math.max(15, Math.round(55 - (rate - 5) * 6));
}
function confidenceScore(c) { return c == null ? null : Math.round(c); }
function rateScore(pct) {
  if (pct == null) return null;
  if (pct >= 70) return 100;
  if (pct >= 50) return 85;
  if (pct >= 30) return 65;
  return Math.max(15, Math.round(pct + 15));
}

// Powerless / hedging markers from sociolinguistics (Lakoff, O'Barr).
const HEDGES = [
  "maybe","kind of","kinda","sort of","sorta","i think","i guess","i mean",
  "just","like","probably","might","could be","i feel like","honestly",
  "i'm not sure","not really","a little bit","somewhat","perhaps","i suppose",
];
function countHedges(text) {
  if (!text) return 0;
  const t = " " + text.toLowerCase().replace(/[^a-z' ]/g, " ").replace(/\s+/g, " ") + " ";
  let n = 0;
  for (const h of HEDGES) {
    const re = new RegExp("\\b" + h.replace(/ /g, "\\s+") + "\\b", "g");
    const m = t.match(re);
    if (m) n += m.length;
  }
  return n;
}
function wordCount(text) {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

// Tag a feedback string to a coaching theme. First match wins; order matters.
const FEEDBACK_THEMES = [
  { key: "fillers", label: "Cutting filler words", pat: /\b(filler|fillers|um|uh|like\b|you know)\b/i },
  { key: "ramble", label: "Staying concise", pat: /\b(ramble|rambl|too long|wordy|cut|trim|shorten|concise|tighten)\b/i },
  { key: "vague", label: "Being specific", pat: /\b(vague|generic|specific|concrete|name|numbers|detail)\b/i },
  { key: "needy", label: "Showing confidence", pat: /\b(needy|desper|insecure|seeking|apolog|sorry|fold|folded|cav|backed down)\b/i },
  { key: "curious", label: "Asking better questions", pat: /\b(curio|question|interview|listen|ask|probe)\b/i },
  { key: "timing", label: "Comedic timing", pat: /\b(timing|punchline|joke|laugh|funny|pace|too fast|too slow|land)\b/i },
  { key: "hedging", label: "Speaking with conviction", pat: /\b(hedge|hedging|maybe|might|sort of|kind of|i think)\b/i },
  { key: "callback", label: "Using callbacks", pat: /\b(callback|earlier|reference|tie back|connect)\b/i },
  { key: "energy", label: "Matching energy", pat: /\b(energy|flat|monoton|dull|push|spark|warmth)\b/i },
  { key: "hold", label: "Holding your position", pat: /\b(hold|holding|stand|defend|number|stuck to|conviction)\b/i },
];
function classifyFeedback(s) {
  if (!s) return null;
  for (const t of FEEDBACK_THEMES) if (t.pat.test(s)) return t;
  return null;
}

// Streak across local date strings (YYYY-MM-DD). Treats today as live.
function buildStreak(dateStrings) {
  const days = new Set(dateStrings);
  const today = new Date().toISOString().slice(0, 10);
  let cur = 0;
  let cursor = days.has(today) ? new Date(today) : new Date(new Date(today).getTime() - 86400000);
  // If we don't have yesterday either, streak is 0.
  if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    cur++;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return cur;
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (!requireAuth(req, res)) return;
  if (!ready()) return res.status(200).json({ empty: true, skipped: true });
  try {
    const device_id = String(req.query.device_id || "").slice(0, 64);
    if (!device_id) return res.status(400).json({ error: "device_id required" });

    // Pull recent data. 90-day window is plenty for trend math.
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    const [takes, speechTakes, msgs] = await Promise.all([
      rest(`/rehearse_takes?device_id=eq.${encodeURIComponent(device_id)}&created_at=gte.${since}` +
           `&select=score,hit_goal,partner,goal_index,drill,nudge_count,turn_count,created_at` +
           `&order=created_at.desc&limit=200`),
      rest(`/rehearse_speech_takes?device_id=eq.${encodeURIComponent(device_id)}&created_at=gte.${since}` +
           `&select=score,wpm,fillers,pause_count,pitch_std,faithfulness,duration_s,context,created_at` +
           `&order=created_at.desc&limit=200`),
      rest(`/rehearse_messages?device_id=eq.${encodeURIComponent(device_id)}&role=eq.me&created_at=gte.${since}` +
           `&select=text,rating,feedback,delivery,partner,goal_index,created_at` +
           `&order=created_at.desc&limit=800`),
    ]);

    const totalSessions = takes.length + speechTakes.length;
    if (!totalSessions && !msgs.length) {
      return res.status(200).json({ empty: true });
    }

    // --- Practice cadence ---
    const allDates = [
      ...takes.map(t => t.created_at),
      ...speechTakes.map(t => t.created_at),
    ].map(d => new Date(d).toISOString().slice(0, 10));
    const uniqueDays = [...new Set(allDates)];
    const today = new Date().toISOString().slice(0, 10);
    const days7 = uniqueDays.filter(d => new Date(d) >= new Date(Date.now() - 7 * 86400000)).length;
    const days30 = uniqueDays.filter(d => new Date(d) >= new Date(Date.now() - 30 * 86400000)).length;
    const sessions7 = allDates.filter(d => new Date(d) >= new Date(Date.now() - 7 * 86400000)).length;
    const sessions30 = allDates.filter(d => new Date(d) >= new Date(Date.now() - 30 * 86400000)).length;
    const streak = buildStreak(allDates);

    // --- Delivery aggregates from per-turn messages ---
    const deliveries = msgs.filter(m => m.delivery && typeof m.delivery === "object").map(m => m.delivery);
    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const avgWpm = avg(deliveries.map(d => d.wpm).filter(x => x > 0));
    const avgConfidence = avg(deliveries.map(d => d.confidence).filter(x => x != null));
    const avgPitchStd = avg([
      ...deliveries.map(d => d.pitchStd).filter(x => x != null && x > 0),
      ...speechTakes.map(t => t.pitch_std).filter(x => x != null && x > 0),
    ]);
    const totalWords = msgs.reduce((a, m) => a + wordCount(m.text), 0);
    const totalFillers = deliveries.reduce((a, d) => a + (d.fillers || 0), 0) +
      speechTakes.reduce((a, t) => a + (t.fillers || 0), 0);
    const speechWords = speechTakes.reduce((a, t) => a + ((t.wpm || 0) * (t.duration_s || 0) / 60), 0);
    const allWords = totalWords + speechWords;
    const fillerRate = allWords > 0 ? (totalFillers / allWords) * 100 : null;

    const totalHedges = msgs.reduce((a, m) => a + countHedges(m.text), 0);
    const hedgeRate = totalWords > 0 ? (totalHedges / totalWords) * 100 : null;

    // --- Conversation quality ---
    const ratedMsgs = msgs.filter(m => m.rating);
    const ratingCounts = { great: 0, good: 0, ok: 0, miss: 0 };
    for (const m of ratedMsgs) if (ratingCounts[m.rating] != null) ratingCounts[m.rating]++;
    const ratingTotal = ratedMsgs.length;
    const greatPct = ratingTotal ? (ratingCounts.great / ratingTotal) * 100 : null;
    const goalHits = takes.filter(t => t.hit_goal).length;
    const goalHitPct = takes.length ? (goalHits / takes.length) * 100 : null;

    // --- Per-dimension scores ---
    const dims = [
      { key: "pace", label: "Pace", value: avgWpm != null ? Math.round(avgWpm) + " wpm" : null, score: paceScore(avgWpm), target: "140-160 wpm",
        tip: avgWpm == null ? "" : avgWpm < 130 ? "You're slow. Push energy on key sentences." :
             avgWpm > 175 ? "You're rushing. Land each beat, breathe between sentences." :
             "Pace is in the keynote pocket." },
      { key: "fillers", label: "Filler words", value: fillerRate != null ? fillerRate.toFixed(1) + "%" : null, score: fillerRateScore(fillerRate), target: "<2% of words",
        tip: fillerRate == null ? "" : fillerRate < 2 ? "Crisp. Top-speaker territory." :
             fillerRate < 4 ? "A few slipping in. Replace with a half-second silence." :
             "Heavy filler use. Record a take and pause instead of saying 'um'." },
      { key: "variety", label: "Vocal variety", value: avgPitchStd != null ? Math.round(avgPitchStd) + " Hz" : null, score: varietyScore(avgPitchStd), target: "25+ Hz pitch range",
        tip: avgPitchStd == null ? "" : avgPitchStd < 12 ? "Monotone. Drop your pitch on key words; raise it for surprise." :
             avgPitchStd < 25 ? "Some variation. Push contrast on the most important phrase." :
             "Strong prosody. Keep using pitch to mark what matters." },
      { key: "hedging", label: "Conviction", value: hedgeRate != null ? hedgeRate.toFixed(1) + " hedges/100w" : null, score: hedgeRateScore(hedgeRate), target: "<1.5 per 100 words",
        tip: hedgeRate == null ? "" : hedgeRate < 1.5 ? "Direct. You say what you mean." :
             hedgeRate < 3 ? "Watch 'kind of', 'I think', 'just'. Drop them and the line lands harder." :
             "Lots of hedging. Reread your transcripts and strike every 'maybe', 'sort of', 'I guess'." },
      { key: "confidence", label: "Confidence", value: avgConfidence != null ? Math.round(avgConfidence) + "%" : null, score: confidenceScore(avgConfidence), target: "75% or higher",
        tip: avgConfidence == null ? "" : avgConfidence >= 75 ? "You sound like you mean it." :
             avgConfidence >= 60 ? "Solid. Tighten pace and fillers to push higher." :
             "Composite is low. Focus on pace + fillers; conviction follows." },
      { key: "goalhit", label: "Goal hit rate", value: goalHitPct != null ? Math.round(goalHitPct) + "%" : null, score: rateScore(goalHitPct), target: "70%+",
        tip: goalHitPct == null ? "" : goalHitPct >= 70 ? "You're closing scenes." :
             goalHitPct >= 40 ? "Half-and-half. Pick one goal and run it three times." :
             "Most scenes don't land the win. Re-read the goal hint before each take." },
      { key: "greats", label: "'Great' turn rate", value: greatPct != null ? Math.round(greatPct) + "%" : null, score: rateScore(greatPct ? greatPct * 1.6 : null), target: "30%+ of turns",
        tip: greatPct == null ? "" : greatPct >= 25 ? "You land strong lines regularly." :
             greatPct >= 12 ? "A few sharp moments per scene. Build more around them." :
             "Few standout lines. Study which feedback notes say 'great' and lean in." },
    ];

    const measured = dims.filter(d => d.score != null);
    const strengths = measured.filter(d => d.score >= 75).sort((a, b) => b.score - a.score).slice(0, 3);
    const weaknesses = measured.filter(d => d.score < 65).sort((a, b) => a.score - b.score).slice(0, 3);
    const composite = measured.length ? Math.round(measured.reduce((a, d) => a + d.score, 0) / measured.length) : null;

    // --- Improvement: per-weakness trend (first half vs second half of recent takes) ---
    // Crude but readable: did the dimension improve in the last ~half of attempts?
    function dimSeries(dim) {
      if (dim.key === "pace" || dim.key === "fillers" || dim.key === "variety" || dim.key === "confidence" || dim.key === "hedging") {
        // Order chronologically (oldest first).
        const ordered = msgs.slice().reverse();
        const vals = [];
        for (const m of ordered) {
          if (dim.key === "hedging") {
            const w = wordCount(m.text); if (w >= 5) vals.push((countHedges(m.text) / w) * 100);
          } else if (m.delivery) {
            const d = m.delivery;
            if (dim.key === "pace" && d.wpm) vals.push(d.wpm);
            if (dim.key === "fillers" && d.wpm && d.duration) vals.push((d.fillers || 0) / Math.max(1, (d.wpm * d.duration / 60) / 100));
            if (dim.key === "variety" && d.pitchStd != null) vals.push(d.pitchStd);
            if (dim.key === "confidence" && d.confidence != null) vals.push(d.confidence);
          }
        }
        return vals;
      }
      return [];
    }
    function trendFor(dim) {
      const s = dimSeries(dim);
      if (s.length < 6) return null;
      const mid = Math.floor(s.length / 2);
      const a = s.slice(0, mid), b = s.slice(mid);
      const m = arr => arr.reduce((x, y) => x + y, 0) / arr.length;
      const ma = m(a), mb = m(b);
      // For fillers + hedging, lower is better; invert.
      const better = (dim.key === "fillers" || dim.key === "hedging") ? mb < ma : mb > ma;
      const diff = Math.abs(mb - ma);
      if (diff < 0.5 && dim.key !== "pace") return { dir: "flat", delta: 0 };
      if (dim.key === "pace" && Math.abs(mb - ma) < 3) return { dir: "flat", delta: 0 };
      return { dir: better ? "up" : "down", delta: Math.round((mb - ma) * 10) / 10 };
    }
    const weaknessesWithTrend = weaknesses.map(w => ({ ...w, trend: trendFor(w) }));
    const strengthsWithTrend = strengths.map(s => ({ ...s, trend: trendFor(s) }));

    // --- Most common coaching theme ---
    const themeCounts = {};
    for (const m of ratedMsgs) {
      const t = classifyFeedback(m.feedback);
      if (t) themeCounts[t.key] = (themeCounts[t.key] || 0) + 1;
    }
    const sortedThemes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, count]) => {
        const t = FEEDBACK_THEMES.find(x => x.key === k);
        return { key: k, label: t.label, count };
      });

    // --- Per-partner score breakdown ---
    const byPartner = {};
    for (const t of takes) {
      const p = t.partner || "unknown";
      if (!byPartner[p]) byPartner[p] = { takes: 0, hits: 0, scoreSum: 0 };
      byPartner[p].takes++;
      byPartner[p].scoreSum += t.score || 0;
      if (t.hit_goal) byPartner[p].hits++;
    }
    const partnerStats = Object.entries(byPartner).map(([partner, s]) => ({
      partner,
      takes: s.takes,
      avg_score: Math.round(s.scoreSum / s.takes),
      hit_pct: Math.round((s.hits / s.takes) * 100),
    })).sort((a, b) => b.takes - a.takes);

    return res.status(200).json({
      empty: false,
      composite,
      practice: {
        sessions_total: totalSessions,
        sessions_7d: sessions7,
        sessions_30d: sessions30,
        days_active_7d: days7,
        days_active_30d: days30,
        streak,
      },
      dimensions: dims,
      strengths: strengthsWithTrend,
      weaknesses: weaknessesWithTrend,
      themes: sortedThemes,
      partners: partnerStats,
      rating_mix: { ...ratingCounts, total: ratingTotal },
      sample_size: {
        conversation_takes: takes.length,
        speech_takes: speechTakes.length,
        turns: msgs.length,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
