// Client-side display config. The actual persona PROMPTS live server-side in
// api/_personas.js and are never shipped to the browser. This only holds what
// the UI needs to render + the voice_id to request playback.
export const PARTNERS = {
  friend: {
    av: "😎", name: "Jordan", full: "Jordan (your friend)",
    sub: "Relaxed, gives you a hard time, won't laugh at lazy jokes.",
    voice_id: "TX3LPaxmHKxFdv7VOQHJ",
    opening: "Yo. What's good?",
    goals: [
      { t: "Make me actually laugh", hint: "Land a real laugh, not a pity laugh. Callbacks beat one-liners." },
      { t: "Win the pizza-topping argument", hint: "Pick a side and hold it. Be funny, not preachy." },
      { t: "Get me out of my funk", hint: "Listen first. One light reframe beats five pep talks." },
      { t: "Convince me to come to your event", hint: "Make it sound like a story they'd miss, not a favor." },
    ],
  },
  date: {
    av: "💘", name: "Sam", full: "Sam (first date)",
    sub: "Warm but guarded. Short answers until you show real curiosity.",
    voice_id: "EXAVITQu4vr4xnSDxMaL",
    opening: "Hey, glad this worked out. So, how was your day, honestly?",
    goals: [
      { t: "Get a second date", hint: "Curiosity beats self-talk. End on a specific plan." },
      { t: "Make the conversation spark", hint: "Light teasing, real questions, no interview vibes." },
      { t: "Recover after they go quiet", hint: "Don't panic-fill. Pivot confidently or call back." },
      { t: "Get them to ask you a question", hint: "Drop a hook, then stop talking. Mystery, not monologue." },
    ],
  },
  boss: {
    av: "💼", name: "Mr. Klein", full: "Mr. Klein (your manager)",
    sub: "Busy, results-oriented, mildly skeptical of raise requests.",
    voice_id: "onwK4e9ZLuTAKqWW03F9",
    opening: "Come in. I've got about ten minutes. What's on your mind?",
    goals: [
      { t: "Get a raise", hint: "Lead with value. Name a specific number. Don't fold." },
      { t: "Get a risky project approved", hint: "Address his risk first. Propose a small, scoped trial." },
      { t: "Push back on an unfair deadline", hint: "Trade-offs, not complaints. Offer two options." },
      { t: "Ask for time off without sounding lazy", hint: "Be direct, name the dates, own the handoff plan." },
    ],
  },
};
