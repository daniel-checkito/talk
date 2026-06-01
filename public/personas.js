// Client-side display config. The actual persona PROMPTS live server-side in
// api/_personas.js and are never shipped to the browser. This only holds what
// the UI needs to render + the voice_id to request playback.
export const PARTNERS = {
  friend: {
    av: "😎", name: "Jordan", full: "Jordan (your friend)",
    sub: "Relaxed, gives you a hard time, won't laugh at lazy jokes.",
    voice_id: "TX3LPaxmHKxFdv7VOQHJ",
    opening: "Yo. What's good?",
    goals: [{ t: "Make me actually laugh" }, { t: "Win the pizza-topping argument" }],
  },
  date: {
    av: "💘", name: "Sam", full: "Sam (first date)",
    sub: "Warm but guarded. Short answers until you show real curiosity.",
    voice_id: "EXAVITQu4vr4xnSDxMaL",
    opening: "Hey — glad this worked out. So… how was your day, honestly?",
    goals: [{ t: "Get a second date" }, { t: "Make the conversation spark" }],
  },
  boss: {
    av: "💼", name: "Mr. Klein", full: "Mr. Klein (your manager)",
    sub: "Busy, results-oriented, mildly skeptical of raise requests.",
    voice_id: "onwK4e9ZLuTAKqWW03F9",
    opening: "Come in. I've got about ten minutes — what's on your mind?",
    goals: [{ t: "Get a raise" }, { t: "Get a risky project approved" }],
  },
};
