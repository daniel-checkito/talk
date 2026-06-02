// Per-call usage + cost logging for the Rehearse app.
// Costs are *estimates* using published list prices; tune the constants if
// your plan tier differs. Writes are best-effort and never throw to callers.
const { ready, rest } = require("./_db");

// Per-million-token list prices (USD). Adjust if Anthropic updates pricing
// or you negotiate a different rate. Sonnet 4.6 + Haiku 4.5 used here.
const ANTHROPIC_PRICES = {
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
  "claude-sonnet-4-6":         { in: 3.0, out: 15.0 },
  // Safe defaults if the model id changes; the user-visible total will still be a sensible upper bound.
  "_default":                  { in: 3.0, out: 15.0 },
};

// ElevenLabs list prices (Creator tier, list as of late 2025; tune for your plan).
//   Flash v2.5 TTS: ~$0.10 per 1k chars (half-credit model -> half list price).
//   Scribe v2 STT:  ~$0.40 per hour of audio.
const ELEVENLABS_TTS_USD_PER_CHAR  = 0.0001;        // $0.10 / 1000 chars
const ELEVENLABS_STT_USD_PER_SECOND = 0.40 / 3600;   // $0.40 / hour

// Audio bitrate assumption for STT cost estimation when no duration is available.
// Opus at ~16 kbps ≈ 2000 bytes/sec; pessimistic upper bound for cost reporting.
const STT_BYTES_PER_SECOND = 2000;

function anthropicCostMicros(model, usage) {
  const p = ANTHROPIC_PRICES[model] || ANTHROPIC_PRICES._default;
  const inTok = usage?.input_tokens || 0;
  const outTok = usage?.output_tokens || 0;
  const usd = (inTok * p.in + outTok * p.out) / 1_000_000;
  return Math.round(usd * 1_000_000);
}
function ttsCostMicros(chars) {
  return Math.round(chars * ELEVENLABS_TTS_USD_PER_CHAR * 1_000_000);
}
function sttCostMicros(seconds) {
  return Math.round(seconds * ELEVENLABS_STT_USD_PER_SECOND * 1_000_000);
}
function sttSecondsFromBytes(bytes) {
  return bytes / STT_BYTES_PER_SECOND;
}

// Fire-and-forget. Never throws. Skips silently if Supabase isn't configured
// or device_id is missing (anonymous / not yet known).
function logUsage({ device_id, provider, service, model, input_units, output_units, cost_micros }) {
  if (!ready() || !device_id) return;
  const row = {
    device_id: String(device_id).slice(0, 64),
    provider,
    service,
    model: model || null,
    input_units: input_units || 0,
    output_units: output_units || 0,
    cost_micros: cost_micros || 0,
  };
  // Don't await; this is best-effort and must not block the user-facing reply.
  rest("/rehearse_usage", { method: "POST", body: JSON.stringify(row) }).catch(() => {});
}

module.exports = {
  logUsage,
  anthropicCostMicros,
  ttsCostMicros,
  sttCostMicros,
  sttSecondsFromBytes,
  ANTHROPIC_PRICES,
  ELEVENLABS_TTS_USD_PER_CHAR,
  ELEVENLABS_STT_USD_PER_SECOND,
};
