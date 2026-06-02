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
      { t: "Approach a stranger cold", hint: "Comment on something real about where you are. Low-stakes opener. No lines." },
    ],
    // Per-scenario context for the "Approach a stranger cold" goal (last goal).
    // Voice + opening change every run; index is sent to /api/reply so the server can inject the SCENE.
    // Keep in sync with api/_personas.js scenarios.
    scenariosByGoal: {
      4: [
        {
          setting: "You're in a quiet coffee shop on a weekday afternoon. They're at a corner table, reading a paperback, half a latte left. You just sat down two tables over.",
          voice_id: "21m00Tcm4TlvDq8ikWAM",
          opening: "(Glances up from the book, polite half-smile, waits to see what you want.)",
          av: "📖",
          name: "Stranger at the cafe",
        },
        {
          setting: "You're at the dog park. Their golden retriever just dropped a tennis ball at your feet. They're walking over to grab it back, mildly apologetic.",
          voice_id: "ErXwobaYiN019PkySvjV",
          opening: "Oh, sorry, he does this to everyone. Hope he didn't slime you.",
          av: "🐕",
          name: "Stranger at the dog park",
        },
        {
          setting: "You're in a bookstore, in the small philosophy aisle. They're crouched down reading the back of a book you've been thinking about buying.",
          voice_id: "AZnzlk1HygsiSFalpV0g",
          opening: "(Looks up briefly, slight nod, goes back to the book.)",
          av: "📚",
          name: "Stranger at the bookstore",
        },
        {
          setting: "You're at a hotel bar around 9pm, alone-ish crowd. They're two stools down, scrolling their phone, half a drink, no one with them.",
          voice_id: "TxGEqnHWrfWFTfGW9XjX",
          opening: "(Puts the phone face-down, neutral look, waits.)",
          av: "🍸",
          name: "Stranger at the bar",
        },
        {
          setting: "You're at a small gallery opening, holding a plastic cup of wine. They're standing in front of a painting you also stopped at, looking puzzled.",
          voice_id: "MF3mGyEYCl7XYWbV9V6O",
          opening: "Hm. I genuinely cannot tell if this one is brilliant or a joke.",
          av: "🎨",
          name: "Stranger at the gallery",
        },
      ],
    },
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
    // Each audience goal has scenarios that give the user an actual topic + situation to handle.
    // Voice + opening + scene change every run. Keep in sync with api/_personas.js.
    scenariosByGoal: {
      0: [
        {
          setting: "You're at a TEDx event. You walk out to polite applause. Your talk title on the screen behind you: 'Why your brain treats deadlines like furniture'. The room is about 200 people, slightly tired, mid-afternoon slot. You have 12 minutes total. The host has just handed the mic over.",
          voice_id: "pqHfZKP75CvOlQylNhV4",
          opening: "Mic's hot. Whenever you're ready.",
          av: "🎤", name: "TEDx · 200 people",
        },
        {
          setting: "You're at an industry conference, keynote slot, 400 people in the room. Your title slide: 'Your team's meetings cost more than your office lease'. Lights just came up. You have 8 minutes before Q&A.",
          voice_id: "JBFqnCBsd6RMkjVDRZzb",
          opening: "Right then. Take it away.",
          av: "🏛️", name: "Conference keynote",
        },
        {
          setting: "Company all-hands, 150 employees on Zoom + 80 in the room. You're announcing a major reorganization. People are uneasy. You have the floor for the next five minutes before questions.",
          voice_id: "nPczCjzI2devNBz1zQrb",
          opening: "Okay, everyone's here. Floor's yours.",
          av: "🏢", name: "All-hands · reorg",
        },
        {
          setting: "Pitch competition finale. Three judges at a table, audience of 250 behind them. Your startup is one of five finalists. You have exactly 90 seconds. Clock starts on your first word.",
          voice_id: "IKne3meq5aSn9XLyUdCD",
          opening: "Ninety seconds. Starting now.",
          av: "🏆", name: "Pitch finale · 90s",
        },
      ],
      1: [
        {
          setting: "You just finished a 10-minute board presentation on Q3 results. Revenue is up 18%, but customer acquisition cost rose 40% and you only mentioned it briefly. The CFO has the deck open in front of her and is tapping page 14.",
          voice_id: "pqHfZKP75CvOlQylNhV4",
          opening: "Hold on. Your CAC is up forty percent and you buried it on slide fourteen. Walk us through why I shouldn't be alarmed.",
          av: "📊", name: "Board · CAC challenge",
        },
        {
          setting: "Press conference after your company issued a voluntary product recall this morning. Cameras rolling. A reporter from a major outlet has raised her hand.",
          voice_id: "EXAVITQu4vr4xnSDxMaL",
          opening: "Two questions. First: who at your company knew about this issue before the recall, and when? Don't dodge the timeline.",
          av: "📷", name: "Press · recall",
        },
        {
          setting: "Investor town hall, two weeks after you missed quarterly earnings by 12%. A long-time shareholder at the back microphone, visibly frustrated.",
          voice_id: "onwK4e9ZLuTAKqWW03F9",
          opening: "Last year you stood here and told us this exact scenario couldn't happen. So either you were lying then, or you don't actually understand your own business. Which is it?",
          av: "💸", name: "Investor town hall",
        },
        {
          setting: "Engineering review meeting. You just proposed migrating a critical system to a new architecture. The principal engineer who built the current system is in the room, arms crossed.",
          voice_id: "VR6AwgfvsGCJSGpZemc",
          opening: "Your migration plan assumes a clean cutover. We tried that in 2019 and lost three days of revenue. What's different this time, specifically?",
          av: "⚙️", name: "Eng review · migration",
        },
      ],
      2: [
        {
          setting: "Board meeting. You're asking for $2M to pivot your product into a new vertical. The lead investor leans toward 'no' going in. You have 6 minutes before they vote.",
          voice_id: "pqHfZKP75CvOlQylNhV4",
          opening: "We've read the memo. I'll be direct: I'm leaning no. The current line is finally working. Tell me why we should bet two million on a pivot now.",
          av: "💰", name: "Board · $2M pivot ask",
        },
        {
          setting: "You're asking the CFO to approve 8 new headcount on your team. The company just announced a hiring freeze last month. She agreed to hear you out for ten minutes.",
          voice_id: "EXAVITQu4vr4xnSDxMaL",
          opening: "I have ten minutes. We're in a freeze. I assume you know that. So what's so urgent it can't wait two quarters?",
          av: "🧊", name: "CFO · hiring freeze",
        },
        {
          setting: "Leadership offsite. You're proposing to sunset a profitable but stagnant product line so the team can focus on a riskier bet. The product's GM is in the room.",
          voice_id: "JBFqnCBsd6RMkjVDRZzb",
          opening: "Right, so you want us to shut down a line that still pays the bills. Convince the room. Start with the math.",
          av: "🗡️", name: "Offsite · kill the line",
        },
        {
          setting: "Promotion committee. You're advocating for a direct report's promotion to senior. Two of the four reviewers don't know them well. You have 4 minutes.",
          voice_id: "nPczCjzI2devNBz1zQrb",
          opening: "Okay. We've got four minutes and two of us haven't worked with this person. Make the case.",
          av: "📈", name: "Promo committee",
        },
      ],
      3: [
        {
          setting: "You're ending a TEDx talk on resilience. You've told the story of rebuilding your life after losing everything in a fire. The audience is quiet. You have one minute left, and one final point to land.",
          voice_id: "JBFqnCBsd6RMkjVDRZzb",
          opening: "Bring it home. The room's with you. Don't waste it on a 'thank you for listening'.",
          av: "🔥", name: "TEDx · resilience close",
        },
        {
          setting: "Your retirement speech at the company you've been at for 25 years. The whole team is in the room, drinks in hand. You've thanked everyone. There's one thing left to say.",
          voice_id: "pqHfZKP75CvOlQylNhV4",
          opening: "Wrap it up. Give us the line we'll be quoting at the bar tonight.",
          av: "🥂", name: "Retirement · 25 years",
        },
        {
          setting: "Commencement address at your alma mater. You've talked for 12 minutes about your journey. The graduates have phones half-up, ready to clip the last sentence.",
          voice_id: "VR6AwgfvsGCJSGpZemc",
          opening: "Last sentence. Give them something they'll put in a caption.",
          av: "🎓", name: "Commencement",
        },
        {
          setting: "Closing keynote at an industry conference. You've made your case for the next decade of the industry. The screen behind you is black. The room is yours.",
          voice_id: "nPczCjzI2devNBz1zQrb",
          opening: "Mic's still hot. Land it.",
          av: "🎤", name: "Closing keynote",
        },
      ],
    },
  },
};
