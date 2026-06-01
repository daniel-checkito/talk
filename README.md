# Rehearse — audio-first conversation sim

Speak out loud to an AI partner (friend / date / boss), hear them reply in a real voice, get a subtle live nudge when you slip, and a full coached debrief at the end.

**Architecture:** ElevenLabs is the ears (Scribe v2 STT) and mouth (Flash v2.5 TTS). Claude is the brain — Haiku for fast in-character replies, Sonnet for the debrief. All API keys live in Vercel env vars and are never exposed to the browser.

```
public/index.html   audio-first UI (mic loop + text fallback)
public/personas.js  client display config (no secret prompts)
api/reply.js        Claude Haiku: in-character reply + hidden nudge   (fast loop)
api/debrief.js      Claude Sonnet: scorecard against the goal rubric   (slow loop)
api/tts.js          ElevenLabs TTS  -> mp3 of the partner's reply
api/stt.js          ElevenLabs Scribe -> transcript of your speech
api/_personas.js    server-side persona PROMPTS + win conditions (the IP)
```

## Deploy (5 min)

1. Install the CLI and log in:
   ```
   npm i -g vercel
   vercel login
   ```
2. From this folder, deploy:
   ```
   vercel
   ```
   Accept the defaults. It auto-detects the static `public/` + `api/` functions.
3. Add your two secrets (either in the dashboard → Project → Settings → Environment Variables, or via CLI):
   ```
   vercel env add ANTHROPIC_API_KEY
   vercel env add ELEVENLABS_API_KEY
   ```
4. Redeploy to production so the env vars take effect:
   ```
   vercel --prod
   ```

Open the URL on your phone, allow the mic, tap the green mic, talk.

> **Mic needs HTTPS.** Vercel gives you HTTPS automatically, so it just works. (This is why it never worked inside the Claude artifact sandbox.)

## Voices

Each persona has a `voice_id` in **both** `api/_personas.js` and `public/personas.js` — keep them in sync if you change one. Browse voices at https://elevenlabs.io/app/voice-library and paste the ID.

## Cost guardrails (read this)

- **ElevenLabs is ~95% of per-session cost** (~$0.08–0.12/min of audio). Claude Haiku replies are a fraction of a cent; the Sonnet debrief is ~1–2 cents.
- A 5-min scene ≈ **$0.40–0.60**. The free ElevenLabs tier is ~15 min/month, then it stops.
- Before opening this to anyone but yourself, add: a **hard session time cap**, a **per-user daily limit**, and ideally a paywall. At these costs, unlimited free voice will drain your account fast.
- `eleven_flash_v2_5` is already the cheapest/fastest TTS model. Don't switch to v3/multilingual unless quality complaints justify it.

## Local dev

```
vercel dev
```
Runs the functions + static site locally at http://localhost:3000 (mic works on localhost too).

## What's next (not built yet)

- Supabase for accounts + progress-over-time ("am I getting funnier across 10 sessions").
- Streaming STT (Scribe v2 Realtime, ~150ms) to cut the turn latency.
- Auto-stop on silence so you don't have to tap to end each turn.
