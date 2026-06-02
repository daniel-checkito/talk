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
// Sentence length sweet spot: 12-18 words avg. Research on prose readability
// (Flesch) + speech corpora put short-form rhetoric around 14-16. Too short = clipped,
// too long = audience falls off.
function sentenceLenScore(avg) {
  if (avg == null) return null;
  if (avg >= 12 && avg <= 18) return 100;
  if (avg >= 9 && avg <= 22) return 80;
  if (avg >= 7 && avg <= 28) return 60;
  return Math.max(20, Math.round(60 - Math.abs(avg - 15) * 1.5));
}
// Type-token ratio. Casual conversation ~0.4, polished talks ~0.55+.
function vocabScore(ttr) {
  if (ttr == null) return null;
  if (ttr >= 0.55) return 100;
  if (ttr >= 0.45) return 85;
  if (ttr >= 0.35) return 65;
  return Math.max(20, Math.round(ttr * 180));
}
// Question rate: % of user turns ending in / containing a question.
// 25-45% of turns means you're driving curiosity rather than monologuing.
function questionScore(pct) {
  if (pct == null) return null;
  if (pct >= 25 && pct <= 50) return 100;
  if (pct >= 15 && pct <= 60) return 75;
  if (pct < 15) return Math.max(20, Math.round(pct * 4));
  return Math.max(35, Math.round(75 - (pct - 60)));
}
// you-words / (you-words + i-words). 0.5+ is balanced/other-focused.
function youIScore(ratio) {
  if (ratio == null) return null;
  if (ratio >= 0.5) return 100;
  if (ratio >= 0.4) return 85;
  if (ratio >= 0.3) return 65;
  return Math.max(20, Math.round(ratio * 180));
}
// Power words per 100 words. ~2-4 is the engaged-confident zone.
function powerScore(per100) {
  if (per100 == null) return null;
  if (per100 >= 2 && per100 <= 5) return 100;
  if (per100 >= 1 && per100 <= 7) return 80;
  if (per100 < 1) return Math.max(25, Math.round(per100 * 60));
  return Math.max(35, Math.round(80 - (per100 - 7) * 5));
}
// Conversation turn length: 12-40 words is a healthy back-and-forth.
// Very short = stonewalling/monosyllabic; very long = lecturing.
function turnLenScore(avgWords) {
  if (avgWords == null) return null;
  if (avgWords >= 12 && avgWords <= 40) return 100;
  if (avgWords >= 6 && avgWords <= 70) return 75;
  if (avgWords < 6) return Math.max(25, Math.round(avgWords * 12));
  return Math.max(30, Math.round(75 - (avgWords - 70) * 0.8));
}
function rateScore(pct) {
  if (pct == null) return null;
  if (pct >= 70) return 100;
  if (pct >= 50) return 85;
  if (pct >= 30) return 65;
  return Math.max(15, Math.round(pct + 15));
}

// Per-language lexicons. Picked at request time via lang param.
const LEX = {
  en: {
    hedges: ["maybe","kind of","kinda","sort of","sorta","i think","i guess","i mean","just","like","probably","might","could be","i feel like","honestly","i'm not sure","not really","a little bit","somewhat","perhaps","i suppose"],
    power: ["definitely","absolutely","certainly","clearly","precisely","specifically","obviously","exactly","entirely","completely","fundamentally","essentially","will","must","know","proven","decided","commit","guarantee","ensure"],
    iWords: new Set(["i","i'm","i'll","i've","i'd","me","my","mine","myself"]),
    youWords: new Set(["you","your","yours","you're","you've","you'd","you'll"]),
    fillers: ["um","uh","like","you know","sort of","kind of","basically","actually","literally","right","i mean","er","ah"],
  },
  de: {
    hedges: ["vielleicht","irgendwie","irgendwo","sozusagen","ich glaube","ich denke","ich meine","quasi","halt","eigentlich","im prinzip","im grunde","wahrscheinlich","könnte","möglicherweise","ich bin nicht sicher","ein bisschen","etwas","ich vermute","ein wenig"],
    power: ["definitiv","absolut","sicherlich","klar","genau","konkret","offensichtlich","exakt","vollständig","komplett","grundsätzlich","wesentlich","werde","muss","weiß","bewiesen","entschieden","verspreche","garantiere","stelle sicher"],
    iWords: new Set(["ich","mir","mich","mein","meine","meiner","meines","meinem","meinen"]),
    youWords: new Set(["du","dir","dich","dein","deine","deiner","deines","deinem","deinen","ihr","euch","euer","eure"]),
    fillers: ["äh","ähm","also","halt","quasi","irgendwie","sozusagen","eigentlich","weißt du","ne","mal","schon","gewissermaßen","ja"],
  },
};
// Backwards-compat single-language exports (used by legacy code paths if any).
const HEDGES = LEX.en.hedges;
const POWER_WORDS = LEX.en.power;
const I_WORDS = LEX.en.iWords;
const YOU_WORDS = LEX.en.youWords;
function countHedges(text, hedgeList) {
  if (!text) return 0;
  const t = " " + text.toLowerCase().replace(/[^a-zäöüß' ]/g, " ").replace(/\s+/g, " ") + " ";
  let n = 0;
  for (const h of (hedgeList || HEDGES)) {
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
    const lang = String(req.query.lang || "en").toLowerCase() === "de" ? "de" : "en";
    const lex = LEX[lang];

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

    const totalHedges = msgs.reduce((a, m) => a + countHedges(m.text, lex.hedges), 0);
    const hedgeRate = totalWords > 0 ? (totalHedges / totalWords) * 100 : null;

    // --- Deep text analysis across user turns ---
    // One pass over the saved messages to compute sentence rhythm, vocab diversity,
    // question rate, self/other balance, conviction markers, top fillers.
    const sentenceLens = [];
    const turnWordCounts = [];
    const uniqueWords = new Set();
    const fillerByType = {};
    let questionTurns = 0, iCount = 0, youCount = 0, powerCount = 0;
    for (const m of msgs) {
      const raw = m.text || "";
      const lower = raw.toLowerCase();
      const wordList = lower.replace(/[^a-zäöüß' ]/g, " ").split(/\s+/).filter(Boolean);
      turnWordCounts.push(wordList.length);
      for (const w of wordList) {
        uniqueWords.add(w);
        if (lex.iWords.has(w)) iCount++;
        else if (lex.youWords.has(w)) youCount++;
      }
      const sentences = raw.split(/[.!?]+/).map(s => s.trim()).filter(s => s.split(/\s+/).filter(Boolean).length >= 2);
      for (const s of sentences) sentenceLens.push(s.split(/\s+/).filter(Boolean).length);
      if (/\?/.test(raw)) questionTurns++;
      for (const pw of lex.power) {
        const re = new RegExp("\\b" + pw.replace(/ /g, "\\s+") + "\\b", "g");
        const matches = lower.match(re);
        if (matches) powerCount += matches.length;
      }
      for (const f of lex.fillers) {
        const re = new RegExp("\\b" + f.replace(/ /g, "\\s+") + "\\b", "g");
        const matches = lower.match(re);
        if (matches) fillerByType[f] = (fillerByType[f] || 0) + matches.length;
      }
    }
    const avgSentenceLen = sentenceLens.length ? sentenceLens.reduce((a, b) => a + b, 0) / sentenceLens.length : null;
    const avgTurnWords = turnWordCounts.length ? turnWordCounts.reduce((a, b) => a + b, 0) / turnWordCounts.length : null;
    const ttr = totalWords > 0 ? uniqueWords.size / totalWords : null;
    const questionPct = msgs.length ? (questionTurns / msgs.length) * 100 : null;
    const youIRatio = (youCount + iCount) > 0 ? youCount / (youCount + iCount) : null;
    const powerPer100 = totalWords > 0 ? (powerCount / totalWords) * 100 : null;
    const topFillers = Object.entries(fillerByType).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([word, count]) => ({ word, count }));
    // Total speaking time across all logged voice turns + speech takes.
    const totalSpokenSec = deliveries.reduce((a, d) => a + (d.duration || 0), 0) +
                           speechTakes.reduce((a, t) => a + (t.duration_s || 0), 0);
    const minutes7 = Math.round(
      (msgs.filter(m => new Date(m.created_at) >= new Date(Date.now() - 7 * 86400000))
           .reduce((a, m) => a + ((m.delivery && m.delivery.duration) || 0), 0) +
       speechTakes.filter(t => new Date(t.created_at) >= new Date(Date.now() - 7 * 86400000))
           .reduce((a, t) => a + (t.duration_s || 0), 0)) / 60
    );

    // --- Conversation quality ---
    const ratedMsgs = msgs.filter(m => m.rating);
    const ratingCounts = { great: 0, good: 0, ok: 0, miss: 0 };
    for (const m of ratedMsgs) if (ratingCounts[m.rating] != null) ratingCounts[m.rating]++;
    const ratingTotal = ratedMsgs.length;
    const greatPct = ratingTotal ? (ratingCounts.great / ratingTotal) * 100 : null;
    const goalHits = takes.filter(t => t.hit_goal).length;
    const goalHitPct = takes.length ? (goalHits / takes.length) * 100 : null;

    // Tempo consistency: std dev of per-turn wpm. Top speakers have controlled variance,
    // not a perfectly flat metronome. Score by how tight the spread is.
    const wpmSeries = deliveries.map(d => d.wpm).filter(x => x > 0);
    let tempoStd = null;
    if (wpmSeries.length >= 3) {
      const m = wpmSeries.reduce((a, b) => a + b, 0) / wpmSeries.length;
      tempoStd = Math.sqrt(wpmSeries.reduce((a, b) => a + (b - m) ** 2, 0) / wpmSeries.length);
    }
    function tempoScore(std) {
      if (std == null) return null;
      if (std < 12) return 100;
      if (std < 22) return 85;
      if (std < 35) return 65;
      return Math.max(20, Math.round(65 - (std - 35) * 1.2));
    }

    // Pause control: pauses per minute of speech. Sweet spot ~4-8/min (strategic),
    // <2 = no breathing room, >12 = lots of dead air.
    const pauseTotalFrames = deliveries.reduce((a, d) => a + (d.pauseFrames || 0), 0) +
                             speechTakes.reduce((a, t) => a + (t.pause_count || 0), 0);
    const totalSpeakSec = deliveries.reduce((a, d) => a + (d.duration || 0), 0) +
                          speechTakes.reduce((a, t) => a + (t.duration_s || 0), 0);
    const pausesPerMin = totalSpeakSec > 30 ? pauseTotalFrames / (totalSpeakSec / 60) : null;
    function pauseScore(ppm) {
      if (ppm == null) return null;
      if (ppm >= 4 && ppm <= 8) return 100;
      if (ppm >= 2 && ppm <= 12) return 75;
      if (ppm < 2) return Math.max(30, Math.round(60 + ppm * 7));
      return Math.max(25, Math.round(75 - (ppm - 12) * 4));
    }

    // --- Per-dimension scores ---
    // Categories: 'delivery' (how it sounds), 'language' (the words), 'performance' (outcomes).
    const dims = [
      { key: "pace", category: "delivery", label: "Pace", value: avgWpm != null ? Math.round(avgWpm) + " wpm" : null, score: paceScore(avgWpm), target: "140-160 wpm",
        tip: avgWpm == null ? "" : avgWpm < 130 ? "You're slow. Push energy on key sentences." :
             avgWpm > 175 ? "You're rushing. Land each beat, breathe between sentences." :
             "Pace is in the keynote pocket." },
      { key: "tempo", category: "delivery", label: "Tempo control", value: tempoStd != null ? "±" + Math.round(tempoStd) + " wpm" : null, score: tempoScore(tempoStd), target: "Tight, intentional variance",
        tip: tempoStd == null ? "" : tempoStd < 15 ? "Steady rhythm. Watch you don't go flat." :
             tempoStd < 30 ? "Healthy variation across turns." :
             "Rhythm is erratic. Anchor pace to the moment, not your nerves." },
      { key: "variety", category: "delivery", label: "Vocal variety", value: avgPitchStd != null ? Math.round(avgPitchStd) + " Hz" : null, score: varietyScore(avgPitchStd), target: "25+ Hz pitch range",
        tip: avgPitchStd == null ? "" : avgPitchStd < 12 ? "Monotone. Drop your pitch on key words; raise it for surprise." :
             avgPitchStd < 25 ? "Some variation. Push contrast on the most important phrase." :
             "Strong prosody. Keep using pitch to mark what matters." },
      { key: "pauses", category: "delivery", label: "Pause control", value: pausesPerMin != null ? pausesPerMin.toFixed(1) + "/min" : null, score: pauseScore(pausesPerMin), target: "4-8 strategic pauses/min",
        tip: pausesPerMin == null ? "" : pausesPerMin < 2 ? "Almost no pauses. Silence is a tool, use it after key lines." :
             pausesPerMin > 12 ? "A lot of dead air. Tighten transitions; one beat, then move." :
             "Pauses are well placed." },
      { key: "fillers", category: "language", label: "Filler words", value: fillerRate != null ? fillerRate.toFixed(1) + "%" : null, score: fillerRateScore(fillerRate), target: "<2% of words",
        tip: fillerRate == null ? "" : fillerRate < 2 ? "Crisp. Top-speaker territory." :
             fillerRate < 4 ? "A few slipping in. Replace with a half-second silence." :
             "Heavy filler use. Record a take and pause instead of saying 'um'." },
      { key: "hedging", category: "language", label: "Conviction", value: hedgeRate != null ? hedgeRate.toFixed(1) + " hedges/100w" : null, score: hedgeRateScore(hedgeRate), target: "<1.5 per 100 words",
        tip: hedgeRate == null ? "" : hedgeRate < 1.5 ? "Direct. You say what you mean." :
             hedgeRate < 3 ? "Watch 'kind of', 'I think', 'just'. Drop them and the line lands harder." :
             "Lots of hedging. Reread your transcripts and strike every 'maybe', 'sort of', 'I guess'." },
      { key: "confidence", category: "performance", label: "Confidence", value: avgConfidence != null ? Math.round(avgConfidence) + "%" : null, score: confidenceScore(avgConfidence), target: "75% or higher",
        tip: avgConfidence == null ? "" : avgConfidence >= 75 ? "You sound like you mean it." :
             avgConfidence >= 60 ? "Solid. Tighten pace and fillers to push higher." :
             "Composite is low. Focus on pace + fillers; conviction follows." },
      { key: "goalhit", category: "performance", label: "Goal hit rate", value: goalHitPct != null ? Math.round(goalHitPct) + "%" : null, score: rateScore(goalHitPct), target: "70%+",
        tip: goalHitPct == null ? "" : goalHitPct >= 70 ? "You're closing scenes." :
             goalHitPct >= 40 ? "Half-and-half. Pick one goal and run it three times." :
             "Most scenes don't land the win. Re-read the goal hint before each take." },
      { key: "greats", category: "performance", label: "'Great' turn rate", value: greatPct != null ? Math.round(greatPct) + "%" : null, score: rateScore(greatPct ? greatPct * 1.6 : null), target: "30%+ of turns",
        tip: greatPct == null ? "" : greatPct >= 25 ? "You land strong lines regularly." :
             greatPct >= 12 ? "A few sharp moments per scene. Build more around them." :
             "Few standout lines. Study which feedback notes say 'great' and lean in." },
      // Language additions
      { key: "sentence", category: "language", label: "Sentence rhythm", value: avgSentenceLen != null ? avgSentenceLen.toFixed(1) + " words avg" : null, score: sentenceLenScore(avgSentenceLen), target: "12-18 words avg",
        tip: avgSentenceLen == null ? "" : avgSentenceLen < 9 ? "Short and choppy. Mix in longer thoughts." :
             avgSentenceLen > 22 ? "Sentences run long. Cut them in half on key beats." :
             "Solid length. Mix short and long to land emphasis." },
      { key: "vocab", category: "language", label: "Vocabulary diversity", value: ttr != null ? Math.round(ttr * 100) + "%" : null, score: vocabScore(ttr), target: "55%+ unique words",
        tip: ttr == null ? "" : ttr >= 0.55 ? "Rich, varied language." :
             ttr >= 0.4 ? "Decent range. Try not to recycle the same five verbs." :
             "Repetitive. Stretch into adjacent words; same idea, fresh phrasing." },
      { key: "power", category: "language", label: "Power words", value: powerPer100 != null ? powerPer100.toFixed(1) + "/100w" : null, score: powerScore(powerPer100), target: "2-5 per 100 words",
        tip: powerPer100 == null ? "" : powerPer100 < 1 ? "Few conviction markers. 'Definitely', 'will', 'clearly' carry weight." :
             powerPer100 > 6 ? "Heavy on absolutes. Backs you into a corner under pushback." :
             "Conviction reads strong." },
      // New 'engagement' category - how the conversation lands with the other side.
      { key: "questions", category: "engagement", label: "Question rate", value: questionPct != null ? Math.round(questionPct) + "%" : null, score: questionScore(questionPct), target: "25-50% of turns",
        tip: questionPct == null ? "" : questionPct < 15 ? "You barely ask. Curiosity is a tool, use it." :
             questionPct > 60 ? "Every other line is a question. Make some statements." :
             "Healthy curiosity." },
      { key: "youi", category: "engagement", label: "Self vs other focus", value: youIRatio != null ? Math.round(youIRatio * 100) + "% you-words" : null, score: youIScore(youIRatio), target: "50%+ other-focused",
        tip: youIRatio == null ? "" : youIRatio >= 0.5 ? "Other-focused. People feel heard." :
             youIRatio >= 0.35 ? "Slightly self-centered. Flip one 'I' to 'you' per turn." :
             "Heavy 'I' talk. Top persuaders use 'you' twice as often as 'I'." },
      { key: "turnlen", category: "engagement", label: "Turn length", value: avgTurnWords != null ? avgTurnWords.toFixed(1) + " words/turn" : null, score: turnLenScore(avgTurnWords), target: "12-40 words/turn",
        tip: avgTurnWords == null ? "" : avgTurnWords < 6 ? "Monosyllabic. Add one specific detail per turn." :
             avgTurnWords > 60 ? "You're lecturing. Cut your turns in half." :
             "Balanced back-and-forth." },
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
      practice_volume: {
        total_minutes: Math.round(totalSpokenSec / 60),
        minutes_7d: minutes7,
        words_spoken: totalWords,
      },
      top_fillers: topFillers,
      // Per-take score timeline for the dashboard's "progress over time" graph.
      // Includes both conversation and speech takes, oldest first.
      score_trend: [
        ...takes.map(t => ({ ts: t.created_at, score: t.score, kind: "convo" })),
        ...speechTakes.map(t => ({ ts: t.created_at, score: t.score, kind: "speech" })),
      ].filter(p => p.score != null).sort((a, b) => new Date(a.ts) - new Date(b.ts)),
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
