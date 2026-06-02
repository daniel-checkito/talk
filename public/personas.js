// Client-side display config. The actual persona PROMPTS live server-side in
// api/_personas.js and are never shipped to the browser. This only holds what
// the UI needs to render + the voice_id to request playback.
export const PARTNERS = {
  friend: {
    av: "😎", name: "Jordan", full: "Jordan (your friend)",
    sub: "Relaxed, gives you a hard time, won't laugh at lazy jokes.",
    voice_id: "TX3LPaxmHKxFdv7VOQHJ",
    opening: "Yo. What's good?",
    openingsByGoal: [
      [
        "Yo. What's good?",
        "Sup. Where you been hiding?",
        "Hey, you owe me twenty bucks by the way. Where's it at?",
        "Tell me something. Make it good, I'm bored.",
      ],
      [
        "So I was telling Maya pineapple on pizza is a war crime, and she said you were on her side. Care to explain?",
        "Wait, you actually ordered Hawaiian last weekend? We need to talk.",
        "Okay defend it. The pineapple thing. Go.",
        "Heard you have OPINIONS about pizza. Lay it on me.",
      ],
      [
        "Hey. Rough day. Not really in the mood, what's up?",
        "Sorry I've been quiet. Kind of in a weird place lately.",
        "Hey, don't really wanna talk about it but yeah, hi.",
        "Mm. Hey. Just had a long one.",
      ],
      [
        "So what's this thing you keep texting me about?",
        "Saw the invite. Honestly probably gonna pass, sorry.",
        "Alright, pitch me. Why am I coming to this?",
        "I have a thing that night maybe. Convince me to bail on it.",
      ],
    ],
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
    openingsByGoal: [
      [
        "Hey! Glad we made this work. How's the place?",
        "So we're here. What do you usually go for at a spot like this?",
        "Hi. Honestly almost cancelled three times today. Glad I didn't.",
        "Hey. So your profile said you do something with code? Lie to me about it.",
      ],
      [
        "Hi! Sorry, I'm a little nervous. How was getting here?",
        "Hey. Honestly didn't expect this app to actually work out.",
        "So, tell me something true about you that isn't in your bio.",
        "Hi. Worst first date you've ever been on, go.",
      ],
      [
        "Yeah... it's been an okay day, I guess.",
        "Hm. Hi. So, what brought you out tonight?",
        "Mm. Yeah. Sorry, long week.",
        "Hey. Yeah, this place is fine I guess.",
      ],
      [
        "Hey. How's it going.",
        "Hi. So tell me something interesting about you.",
        "Hey. What's new in your world.",
        "Hi. So what do you do, the normal version of that question.",
      ],
    ],
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
    openingsByGoal: [
      [
        "Come in. Ten minutes, go.",
        "Walk and talk, I've got a meeting at the half hour. What's on your mind?",
        "Alright. What is it?",
        "Sit. You said comp on the calendar invite, so let's talk numbers.",
      ],
      [
        "Sit. You said this was time-sensitive?",
        "Give me the pitch. I'm skeptical going in, fair warning.",
        "Make this quick. What's the ask?",
        "Okay, lay it out. And lead with the cost, please.",
      ],
      [
        "Hey, perfect timing. I was about to ping you about Friday. We good?",
        "What's up. Don't tell me there's a problem with the deadline.",
        "Have a seat. The Friday delivery on track?",
        "I saw your message. So what's slipping?",
      ],
      [
        "What can I do for you?",
        "You wanted to chat?",
        "Sit. What's up?",
        "You good? Calendar said personal so I'm a little curious.",
      ],
    ],
    goals: [
      { t: "Get a raise", hint: "Lead with value. Name a specific number. Don't fold." },
      { t: "Get a risky project approved", hint: "Address his risk first. Propose a small, scoped trial." },
      { t: "Push back on an unfair deadline", hint: "Trade-offs, not complaints. Offer two options." },
      { t: "Ask for time off without sounding lazy", hint: "Be direct, name the dates, own the handoff plan." },
    ],
  },
  stranger: {
    av: "👋", name: "Alex", full: "Alex (someone you just met)",
    sub: "At a bar or event. Polite but won't carry the conversation for you.",
    voice_id: "pNInz6obpgDQGcFmaJgB",
    opening: "Oh, hey. Sorry, I was kind of in my own head. Are you here with anyone?",
    openingsByGoal: [
      [
        "Oh, hey. Sorry, was kind of in my own head. You here with people?",
        "Hey. Wild crowd tonight. Music or just stumbled in?",
        "Hi. Friend of the host or just brave?",
        "Hey. This your scene normally? Asking honestly.",
      ],
      [
        "Hey. I don't know anyone here, you?",
        "Oh, hi. You been here before?",
        "Hey. That looks like a good drink, what is it?",
        "Hi. Be honest, are you having fun.",
      ],
      [
        "Yeah... it's alright, I guess.",
        "Mm. Sure.",
        "Yeah, just... tired honestly.",
        "Cool. Yeah.",
      ],
      [
        "Hey, this has been... actually pretty fun. Anyway, I should head out soon.",
        "Oh, my friend's calling. Was nice meeting you.",
        "I gotta find my crew, but, hey, this was cool.",
        "Cool talking to you. I'm gonna grab another drink.",
      ],
    ],
    goals: [
      { t: "Get past small talk in 60 seconds", hint: "One real question beats five polite ones. Skip the weather." },
      { t: "Get a real conversation going", hint: "Find a shared frame fast. Pull on one specific thread." },
      { t: "Re-engage them after they go monosyllabic", hint: "Don't escalate effort. Pivot once, then let silence work." },
      { t: "Get an opening to meet again", hint: "Be specific. A plan with a day beats 'we should hang out'." },
    ],
  },
  audience: {
    av: "🎤", name: "The Room", full: "A skeptical room",
    sub: "A mixed audience. Arms crossed by default. Has to be earned, sentence by sentence.",
    voice_id: "nPczCjzI2devNBz1zQrb",
    opening: "Alright, the floor is yours. Make it worth our time.",
    openingsByGoal: [
      [
        "Alright, floor's yours. Don't waste it.",
        "You've got ninety seconds before I tune out. Go.",
        "We've heard ten of these today. Why is yours different?",
        "Mic's hot. Make it count from the first sentence.",
      ],
      [
        "Hold on, before you go further: the numbers in your deck don't add up. Walk us through that.",
        "Quick interjection. How is this different from what we already tried two years ago?",
        "Sorry to cut in, but isn't this just a rebrand of last year's pitch? Convince me it isn't.",
        "Real question: who pays for this when it inevitably doesn't work the first time?",
      ],
      [
        "We've seen three proposals like this die. What's different about yours?",
        "I'll be honest, I'm leaning no. Five minutes to change my mind.",
        "Okay. Make the ask. Pretend I'm already saying no, talk me out of it.",
        "Skip the warm-up. What do you want from us and what's the smallest version of it.",
      ],
      [
        "Wrap it up. Give us something to take home.",
        "Last word's yours. Make it stick.",
        "Close strong. I'll forget everything except your last sentence.",
        "Bring it home. One line we'll quote in the hallway.",
      ],
    ],
    goals: [
      { t: "Open with a hook that lands", hint: "First sentence is the whole thing. Concrete beats clever." },
      { t: "Handle a hostile question without folding", hint: "Acknowledge, reframe, answer. Don't apologize twice." },
      { t: "Win over a skeptical board with one ask", hint: "Lead with the outcome. Bury the methodology." },
      { t: "Land a memorable closing line", hint: "Callback to your opener. Stop before you over-explain." },
    ],
  },
};
