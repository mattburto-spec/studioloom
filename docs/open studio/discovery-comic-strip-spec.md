# Open Studio Discovery — Comic Strip Narrative Spec
*A story, not an interview*

**Status:** In design. Companion docs: `discovery-mentor-system.md` (5 mentors), `discovery-voiceover-script.md` (audio).

**Architecture update (21 Mar 2026):** Discovery now begins with a **Choose Your Mentor** screen. 5 distinct mentors (Kit, Sage, River, Spark, Haven) with different looks, personalities, voices, and teaching approaches. Same 5-chapter structure, same data model — different experience per mentor. The mentor choice itself is a data point that feeds the student profile. Full spec in `discovery-mentor-system.md`.

---

## The Problem With the Current Flow

The current Discovery is an **interrogation in costume**. The mentor asks "What are you good at?", the student answers, the mentor says "Great!", then asks the next question. SVG mountains don't fix this. The 5-step structure (Strengths → Interests → Needs → Narrowing → Commitment) collects the right data but in the most boring way possible.

Teenagers have been asked "tell me about yourself" by every new teacher, app, and camp counsellor since they were 11. Their defences are already up.

## The New Approach: A Story That Invites Story

The mentor doesn't ask questions. The mentor **tells a story** — and the story creates space for the student to share. This is the campfire effect: vulnerability invites vulnerability, stories invite stories.

The comic strip format is the delivery vehicle. Each panel is a **moment**, and moments build into emotional arcs. The illustrated style signals "this matters" while the comic format signals "this is approachable."

---

## Design Principles

1. **Mentor goes first, always.** Before any question, the mentor shares something — a memory, a mistake, a wonder. This models the vulnerability we want from the student.

2. **Provoke, don't interrogate.** Instead of "What are your strengths?", show a scenario and let the student's response reveal who they are indirectly.

3. **Acknowledge the weirdness.** The mentor doesn't pretend this is normal. It names the artificiality and explains why it matters anyway.

4. **Silent panels breathe.** Not every panel needs dialogue. Wide shots, pauses, environmental scenes create emotional texture. These are Scott McCloud's "closure" moments — the reader fills in meaning.

5. **Choices, not questions.** At branch points, give the student visual choices (two paths, two doors, two scenes) rather than open-ended questions.

6. **Webtoon pacing.** Vertical scroll. Variable panel heights. Large panels for emotional beats, small rapid panels for energy. Hide information below the scroll to create reveals.

7. **Never "fellow kids."** No forced slang, no emoji-speak, no performed relatability. The mentor is warm, slightly weathered, genuinely curious. Think Uncle Iroh, not Steve Buscemi in a backwards cap.

---

## The Mentor Character: "Kit"

**Who Kit is:** A design mentor who's been through it. Not a teacher — more like a studio advisor or artist-in-residence. Has callused hands and paint under their nails. Talks about their own work and failures casually. Has a dry sense of humour. Never talks down. Treats students like junior colleagues, not children.

**Visual design:**
- Mid-30s, approachable but not trying to be young
- Casual creative-professional look: rolled sleeves, tool belt or apron, interesting accessories (vintage watch, unusual earring, worn sketchbook always nearby)
- Warm skin tone, expressive eyes, slight asymmetry in their smile (feels real, not airbrushed)
- Body language: leans forward when interested, gestures when telling stories, sits on tables not chairs
- **NOT:** corporate, clinical, uniformed, or cartoonishly "cool"

**Voice:** Warm, direct, occasionally self-deprecating. Shares real stories. Asks one thing at a time and actually listens. Never uses educational jargon. Acknowledges when something is hard or weird.

---

## The Student Character

**Not illustrated.** The student is represented by their own text responses in speech bubbles. We don't draw a character for them because:
- Any illustrated student would feel wrong to half the audience ("that doesn't look like me")
- The student IS the audience — they're the reader stepping into the story
- Their speech bubbles emerge from the bottom of panels like their voice entering the scene

This is a graphic novel convention: the protagonist's perspective is shown through the "camera", not through a drawn character. Think first-person webtoons or the reader-insert in interactive fiction.

---

## The Narrative Arc: 5 Chapters

Same data collected (strengths, interests, needs, narrowing, commitment) but through story, not questionnaire.

---

### CHAPTER 1: "The Workshop" (Strengths)

**Story beat:** Kit invites the student into their workshop/studio. While showing them around, Kit casually talks about their own journey — how they discovered what they were good at by accident, not through planning. Kit reveals something personal and imperfect. Then Kit poses a scenario that indirectly surfaces the student's strengths.

**Emotional register:** Warm, casual, slightly conspiratorial. "Welcome to my world. It's a mess. But it's mine."

#### Panel 1.1 — THE DOOR
*Full-width panel. A workshop door, slightly ajar, warm light spilling out. You can see tools, materials, a coffee mug, scattered sketches on a table inside. It feels lived-in, not curated. Hand-lettered sign on the door reads "Studio — come in."*

**No dialogue.** This is a silent invitation. The student scrolls into the story.

**Mood:** Anticipation. The threshold moment before a journey begins.

#### Panel 1.2 — KIT'S INTRO (Acknowledging the Weirdness)
*Medium shot of Kit leaning against a workbench, arms loosely crossed, slight smile. Workshop behind them — shelves of materials, a half-finished prototype on the table, a whiteboard with messy notes. Natural light from a large window.*

**Kit (speech bubble):**
> "So — welcome. I know this is a bit unusual. You've been asked to 'discover yourself' which sounds like something off a wellness retreat brochure. I promise this is different."

**Kit (thought bubble, smaller, handwritten feel):**
> *"Just be honest with them. They'll smell it if you're not."*

**Design note:** The thought bubble is the comic strip advantage — we can show Kit's internal world. This vulnerability (the mentor coaching themselves to be real) is powerful. It signals: this person is trying, not performing.

#### Panel 1.3 — KIT'S STORY
*Two-panel sequence. Left: Kit as a younger person (early 20s), frustrated, sitting on a floor surrounded by failed prototypes — crumpled paper, broken models, a laptop with "DEADLINE: TOMORROW" on screen. Right: Kit now, pointing at a beautiful finished project on the shelf, but looking at the mess on the floor with more fondness.*

**Kit:**
> "When I was starting out, I spent a year trying to be a graphic designer because it seemed like the 'right' career. I was terrible. Absolutely terrible. But I kept noticing I'd sneak off to build things with my hands instead of working on the screen."

> "Took me embarrassingly long to realise that the thing I kept avoiding my 'real work' to do... was my real work."

**Design note:** This is the campfire effect. Kit shares a real failure. Not a humble-brag ("I was bad at X but then became amazing!") — a genuine admission that they didn't understand themselves for a long time. This gives the student permission to not have it figured out either.

#### Panel 1.4 — THE PROVOCATION (Not a Question)
*Wide panel. Kit has set up a scenario on the workbench: a messy pile of materials and a brief that reads "Your friend needs help. They have 2 hours and no idea where to start. What do you actually do?" Kit is stepping back, coffee in hand, watching with genuine curiosity.*

**Kit:**
> "Here's what I want to know — and there's no right answer. Your best friend comes to you panicking. Big project due tomorrow. Two hours left. They need help."

> "What do you actually do? Not what you *should* do. What do you *actually* do?"

**[STUDENT INPUT AREA — warm, inviting, not a clinical text field]**

**Design note:** This is "provoke, don't interrogate." The student's answer reveals their strengths indirectly. A maker says "I'd grab materials and start building something rough." A researcher says "I'd help them find the right information fast." A leader says "I'd help them make a plan and break it into steps." A creator says "I'd sketch out a few ideas to get them unstuck." We never ask "What are your strengths?" — we let them show us through a story.

#### Panel 1.5 — KIT REFLECTS ON THE ANSWER
*Close-up of Kit, leaning forward, genuinely interested. Warm lighting on their face.*

**Kit (response adapts based on student's answer):**
> [AI generates a response that mirrors back what the student revealed — e.g., "Interesting. So when the pressure's on, you go straight to building. You didn't say 'let me think about it' or 'let me research options' — you said 'let me make something.' That tells me a lot about how your brain works."]

**Kit:**
> "I had a friend like that in school. She'd already have cardboard and tape out before the rest of us had finished reading the brief. It used to annoy me — but looking back, she was usually right to just start."

**Design note:** Kit doesn't evaluate ("Great answer!") or praise ("Wow, you're so creative!"). Kit **reflects** — showing the student what their answer reveals about them. And Kit connects it to a real person, making the student feel like they belong to a type that exists in the world.

#### Panel 1.6 — GOING DEEPER (One More Beat)
*Kit has pulled up a stool, sitting across from the student's perspective. More intimate framing. Workshop background slightly blurred.*

**Kit:**
> "One more thing about you. The thing people come to you for — not what you *wish* they'd ask for, but what they actually come to you for. Could be anything. Fixing tech. Settling arguments. Making things look good. Being honest when everyone else is being polite."

**[STUDENT INPUT AREA]**

**Design note:** This second prompt goes deeper. The first was hypothetical (a scenario). This is real (who are you to the people around you?). But it's still phrased as observable behaviour, not self-analysis. "What do people come to you for?" is infinitely more answerable than "What are your strengths?"

#### Panel 1.7 — CHAPTER CLOSE (The Quiet Moment)
*Wide environmental panel. Workshop, late afternoon light. Kit's silhouette at the window. A sketchbook on the bench has a page with two bullet points — representing the student's strengths being recorded. It's visual, not textual.*

**Kit (small speech bubble):**
> "I'm starting to get a picture of you. Let's keep going."

**[PROFILE REVEAL CARD slides in from below — shows 2-3 strengths the AI extracted, in the student's own words, not clinical labels]**

---

### CHAPTER 2: "The Collection Wall" (Interests)

**Story beat:** Kit takes the student to a wall in the studio covered in pinned-up images, articles, objects — Kit's personal "obsession wall." Kit talks about how following rabbit holes is underrated. Then asks the student what their version of this wall would have on it.

**Emotional register:** Energetic, curious, a little nerdy. "This is what happens when you let yourself get obsessed."

#### Panel 2.1 — TRANSITION (Silent Cinematic Panel)
*Full-width panel. Kit walking through the workshop toward a back wall. Student's perspective following. The wall ahead is covered in pinned items — barely visible at this distance. It creates curiosity. Journey path on the floor (footsteps, an arrow painted on concrete).*

**No dialogue.** Motion and anticipation.

#### Panel 2.2 — THE WALL
*Wide, detailed panel. The Collection Wall is covered in pinned-up things: a photo of a bridge, a torn-out magazine page, a feather, a circuit board, a kid's drawing, a bus ticket, a screenshot of a tweet, a fabric swatch, a receipt with a note scribbled on it. It's a physical Pinterest board. Messy, personal, beautiful.*

**Kit (standing beside it, one hand touching a pinned photo):**
> "This is my collection wall. Everything on here is something that made me stop and go 'huh, that's interesting.' No theme. No logic. Just... things that grabbed me."

> "That circuit board? Found it on the street in Shenzhen. The kid's drawing? My niece drew her version of my workshop. The bridge? I don't even know why I like that bridge. I just do."

#### Panel 2.3 — KIT'S CONFESSION
*Close-up on Kit, slightly sheepish expression.*

**Kit:**
> "People say 'follow your passion' like it's one thing. One big obvious thing. I've never had that. I have a hundred small curiosities that bump into each other. The interesting stuff happens in the collisions."

**Design note:** This normalises not having one clear passion — which is most teenagers' experience. The "follow your passion" advice is paralyzing for teens who have lots of interests or none they can name.

#### Panel 2.4 — THE INVITATION
*Kit has cleared a section of the wall and pinned up a blank card. Handing the student a marker (from their perspective — hand extending toward camera).*

**Kit:**
> "If you had a wall like this, what would be on it? Not school subjects — I don't mean 'I like science.' I mean... what do you actually spend time on when nobody's watching? What YouTube rabbit hole did you fall into last? What makes you lose track of time?"

**[STUDENT INPUT AREA — styled as a pinned card on the wall]**

#### Panel 2.5 — KIT CONNECTS THE DOTS
*Two-panel. Left: close-up of Kit's hand moving pins on the wall, drawing a string between two items (like a detective's evidence board). Right: Kit looking at the student with a slightly surprised/delighted expression.*

**Kit (response adapts):**
> [AI connects the student's interest to their earlier strength. E.g., "Wait — you said you're the person people come to for fixing tech, and now you're telling me you spend hours watching restoration videos? There's a pattern here. You're drawn to taking broken things and making them work again."]

**Design note:** This is the cross-referencing moment from the experience design spec ("You said you're good at building AND you care about accessibility — interesting combination...") but delivered as a genuine insight, not a formulaic connection.

#### Panel 2.6 — GOING DEEPER (What Annoys You?)
*Kit is now sitting on the floor, leaning against the wall. More casual, more intimate framing. Sketching something idly in the ever-present sketchbook.*

**Kit:**
> "Okay, different angle. What annoys you? Like genuinely bugs you about the world? Not 'world peace' level stuff — I mean something specific. A thing that's broken or dumb or unfair that you notice and other people seem to not care about."

**[STUDENT INPUT AREA]**

**Design note:** "What annoys you?" surfaces authentic interests better than "What are you passionate about?" Passion is abstract; irritation is concrete. A student who's annoyed by food waste has a different interest profile than one annoyed by school dress codes, even if neither could articulate their "passion."

#### Panel 2.7 — CHAPTER CLOSE
*The collection wall now has the student's items pinned alongside Kit's — visible as new, fresh cards among the worn ones. Kit is stepping back to admire the combined wall.*

**Kit:**
> "I like your wall. It's different from mine — but I can see the thread."

**[PROFILE REVEAL CARD — interests mapped, connections highlighted]**

---

### CHAPTER 3: "The Window" (Needs)

**Story beat:** Kit walks the student to a window that looks out on a community scene — a street, a school, a neighbourhood. Kit tells a story about a time someone showed them a problem they hadn't noticed. The conversation shifts from inward (who am I?) to outward (who needs help?).

**Emotional register:** Thoughtful, slightly serious, outward-looking. "There's a world out there that could use what you've got."

#### Panel 3.1 — THE WINDOW
*Full-width panel. Kit and the student (represented by the "camera angle") looking out a large industrial window. Outside: a richly detailed community scene — a school playground, a elderly person struggling with groceries, a teenager on a bench looking at their phone, a small park that's run-down, a community garden with a broken fence, a parent pushing a stroller past a closed shop.*

**No dialogue initially.** Let the student scan the scene. (In the digital version, this could be a slightly wider panel that the student can linger on.)

#### Panel 3.2 — KIT'S STORY
*Medium shot of Kit at the window, reflective.*

**Kit:**
> "A few years ago, a student of mine — Year 9, quiet kid, good builder — spent a week walking around her neighbourhood with a camera. Not for an assignment. Just looking. She came back with this photo of her grandmother trying to open a medicine bottle. The cap was those childproof ones."

> "She said: 'My nana has arthritis. She can't open her own medicine. Someone designed that bottle and never thought about her hands.'"

> "That one photo became a six-month project. She redesigned the cap. It was brilliant. And it started with just... looking."

#### Panel 3.3 — THE SHIFT
*Kit turns from the window to face the student's perspective.*

**Kit:**
> "So far we've been talking about you — what you're good at, what interests you. Now I want to flip it. Who around you needs something? Not a charity case — I mean someone whose day you could genuinely make better. Could be a person, could be a group, could be your school, your street, your family."

> "Who comes to mind when you think 'that shouldn't be that hard'?"

**[STUDENT INPUT AREA]**

#### Panel 3.4 — KIT BRIDGES
*Kit is now drawing on a whiteboard — connecting the student's strengths, interests, and the need they just identified. Not a diagram — more like a rough sketch with arrows. Messy, energetic.*

**Kit (response adapts):**
> [AI connects all three: "Okay, let me think out loud. You're someone who fixes things — that's where your brain goes first. You're fascinated by [interest]. And you've just noticed that [need]. Those three things might be pointing somewhere."]

> "I'm not going to tell you what to do with this. But I want you to sit with the collision of those three things for a second."

**[SILENT PANEL — wide shot of the whiteboard with the three elements connected. Space to think.]**

#### Panel 3.5 — CHAPTER CLOSE
*The window again, but now the scene outside is slightly different — warmer light, as if later in the day. One of the people in the scene (the one related to the student's identified need) is highlighted with a subtle glow.*

**[PROFILE REVEAL CARD — needs identified, connected to strengths and interests]**

---

### CHAPTER 4: "The Crossroads" (Narrowing)

**Story beat:** Kit takes the student to a room with three doors — each representing a potential project direction that emerged from the previous chapters. Kit shares a story about how choosing is hard, and how they've learned that commitment matters more than picking the "right" thing. The student explores and eliminates.

**Emotional register:** Honest, grounding, slightly tense. "This is the hard part. Let's do it anyway."

#### Panel 4.1 — THREE DOORS
*Wide panel. A corridor with three doors, each slightly different — different colours, different materials, different energy. Each door has a small symbol or image pinned to it that relates to one of the student's potential project directions (AI generates these from the conversation so far).*

**Kit (standing at the start of the corridor):**
> "Based on everything you've told me, I see three possible directions for your project. None of them are wrong. But you can only walk through one door."

> "Let's look at each one."

#### Panel 4.2-4.4 — DOOR EXPLORATIONS
*Three sequential panels, one per door. Each shows Kit opening the door slightly, peeking inside. The room beyond is abstract — representing the project type (e.g., a making workshop, a research library, a community space).*

For each door, Kit does a lightweight feasibility check:
- "Can you actually do this in the time you have?"
- "Who would you need to talk to?"
- "What excites you most about this one?"
- "What scares you?"

**[STUDENT RESPONDS to each door — tapping "Explore" or "Not this one"]**

**Design note:** This is choose-your-own-adventure. The student has agency. They can dismiss doors they're not feeling. The AI adapts — if a student dismisses two quickly and lingers on one, Kit notices: "You barely looked at the first two. This one's got you, hasn't it?"

#### Panel 4.5 — KIT ON CHOOSING
*Close-up of Kit, leaning against a door frame. Honest expression.*

**Kit:**
> "Can I tell you something? I've never once in my life picked the 'right' project on the first try. Every project I'm proud of started as something different. The magic isn't in choosing perfectly — it's in committing hard enough that the project teaches you what it actually wants to be."

> "So don't agonise. Pick the one that makes your stomach do a little flip. That's your signal."

**Design note:** This is crucial. Teenagers are paralysed by the fear of choosing wrong. Kit normalises imperfect choices and reframes commitment as the skill, not selection.

#### Panel 4.6 — THE CHOICE
*The student stands before their chosen door. It's open. Light pours through.*

**Kit:**
> "That one?"

**[STUDENT CONFIRMS — a satisfying interaction, not just "OK"]**

---

### CHAPTER 5: "The Launchpad" (Commitment)

**Story beat:** The final chapter. Kit and the student are now on a rooftop / high point overlooking a landscape — metaphor for the journey ahead. Kit asks the student to say, in their own words, what they're doing and why. This becomes the project statement.

**Emotional register:** Elevated, proud, slightly solemn. "Say it out loud. Make it real."

#### Panel 5.1 — THE ASCENT
*Vertical sequence of panels showing Kit and the student climbing stairs — abstract, could be fire escape, could be scaffolding, could be a hill path. Each step has a word chalked on it from the journey so far (a strength word, an interest, a need).*

**No dialogue.** Pure visual storytelling. The journey so far, distilled into steps.

#### Panel 5.2 — THE VIEW
*Full-width panoramic panel. A rooftop or hilltop. A wide open landscape below — city, nature, sky. Morning light. Kit and the student's silhouette (student shown as a silhouette for the first time — generic enough to be anyone, specific enough to feel like *you*).*

**Kit:**
> "Alright. We're here. You know what you're good at. You know what fires you up. You know who needs what you've got."

> "Now say it. Not for me — for you. What are you going to make happen?"

#### Panel 5.3 — THE COMMITMENT
*Close-up of Kit's sketchbook, open to a blank page. A pen rests on it. Warm light.*

**Kit:**
> "Write it like this: 'I'm going to [what], for [who], because [why it matters to me].' One sentence. Don't overthink it."

**[STUDENT INPUT AREA — styled as writing in the sketchbook. This is the project statement.]**

#### Panel 5.4 — KIT'S RESPONSE
*Kit reading the sketchbook. Genuine expression — not performative pride, but real recognition.*

**Kit (response adapts):**
> [AI reflects the project statement back, connects it to the full journey. "You started by telling me you're the person who [strength]. Then you showed me you care about [interest]. And when you looked out that window, you saw [need]. This project — [statement] — is all three of those things colliding. That's not an accident."]

#### Panel 5.5 — THE SEND-OFF (Final Panel)
*Wide panel. Kit standing at the rooftop edge, looking out. Student's perspective behind them. Kit is slightly turned back, one hand raised in a casual wave/salute.*

**Kit:**
> "I'll be around. When you're stuck, when you're flying, when you want to quit — I'll be in the workshop. Come find me."

> "Now go build something."

**[DISCOVERY COMPLETE — Profile card rises from the bottom showing the full picture: archetype, strengths, interests, needs, project statement. Beautiful, earned, personal.]**

---

## Interaction Design Notes

### How Student Input Works
- Input areas appear **within** the comic, not below it in a separate chat bar
- Styled as part of the scene: writing on a card (Ch. 2), speaking from below the panel (Ch. 1, 3), tapping doors (Ch. 4), writing in a sketchbook (Ch. 5)
- After the student submits, their text appears as a speech bubble that rises into the panel from below
- Kit's response panel animates in after a brief pause (the "thinking" moment)

### How the AI Backend Works
- Same API structure as current DiscoveryFlow — POST message, get response + updated profile + step info
- The AI system prompt changes per chapter, not just per step. Each chapter has:
  - Kit's voice/tone for that chapter
  - What data to extract from the student's response
  - How to reflect back (mirror, connect, provoke — never evaluate)
  - When to advance to the next chapter
- Kit's stories are **not hardcoded** — they're generated by the AI with guidelines ("tell a brief personal story about discovering a strength by accident, ~2-3 sentences, conversational tone, include a specific sensory detail")
- The three doors in Chapter 4 are AI-generated from the student's accumulated profile

### Panel Image Strategy
- **Pre-generated images** for structural panels (the door, the wall, the window, the crossroads corridor, the rooftop) — these are the same for every student
- **Dynamic text** overlaid on panels via the React component (speech bubbles, profile cards, student responses)
- **~15-18 unique images needed** for the full flow
- All generated via ChatGPT image (gpt-image-1) with consistent style prompt

### Scroll & Pacing
- Webtoon-style vertical scroll — no page turns, no "next" buttons between panels
- New panels animate in from below as the student scrolls or after they submit a response
- Larger panels for emotional moments (the window, the view, the send-off)
- Tighter panels for dialogue exchanges
- Silent/environmental panels between chapters create breathing room

---

## ChatGPT Image Generation Prompts

**Master style prompt (prepend to all):**
> Illustrated comic book panel in a warm, realistic graphic novel style. Slightly desaturated palette with warm amber/golden undertones. Thick but refined panel borders (3px dark charcoal, slightly rounded corners). Art style reference: similar to modern graphic novels like "Saga" or "Paper Girls" — detailed but not photorealistic, with strong lighting and atmosphere. Characters have expressive features and natural body language. No text or speech bubbles in the image — those will be added digitally.

### Panel 1.1 — The Door
> A workshop door slightly ajar, warm golden light spilling out onto a dark hallway floor. Through the crack you can see: a wooden workbench with scattered sketches, a coffee mug with steam, hand tools on wall hooks, a desk lamp casting a warm cone of light. A hand-lettered sign taped to the door reads "Studio — come in" in casual handwriting. The door is heavy wood with a brass handle. Concrete floor. The feeling is inviting, lived-in, authentic — like a real creative person's workspace. Camera angle: standing in the hallway looking at the door, first-person perspective. Warm amber lighting.

### Panel 1.2 — Kit's Introduction
> A creative mentor in their mid-30s leaning casually against a wooden workbench in a design workshop. They have warm brown skin, short natural hair, rolled-up sleeves showing forearms with old paint stains, and a genuine half-smile. They wear a canvas work apron over a simple t-shirt. Behind them: shelves with materials (fabric swatches, foam core, paint jars), a half-finished cardboard prototype on the table, a whiteboard with messy notes and post-its. Natural light from a large industrial window. Their posture is relaxed and welcoming — arms loosely crossed, weight on one hip. They look directly at the viewer with warm, intelligent eyes. Medium shot framing.

### Panel 1.3a — Young Kit (Failure)
> A young person in their early 20s sitting on the floor of a messy apartment, surrounded by crumpled paper, broken foam-core models, and a laptop showing a deadline countdown. They look frustrated and exhausted — head tilted back against the wall, one hand on their forehead. The desk behind them has graphic design work (a half-finished poster on screen) but the floor is covered in 3D model attempts and hand-sketched prototypes. Warm but dim lighting — late night, single desk lamp. The visual tension: the screen shows "design work" but the floor shows "making work" — the person is drawn to building but trying to force themselves into a screen-based career. Slightly messy, vulnerable, real.

### Panel 1.3b — Kit Now (Reflection)
> The same person from the previous panel, now in their mid-30s, standing in their workshop pointing at a beautiful finished project on a shelf — a well-crafted physical product or prototype. But they're not looking at the finished project. They're looking down at a messy workbench with fondness and a slight smile, as if remembering the struggle that got them here. The workshop is the same one from Panel 1.2. Warm golden light. The feeling: pride mixed with nostalgia, acceptance of the messy path.

### Panel 1.4 — The Provocation
> Wide shot of a workshop table with a deliberately messy setup: materials scattered across it (cardboard, markers, scissors, tape, a laptop, a phone, post-it notes), and a printed brief card that reads "Your friend needs help." A mentor stands to the side holding a coffee mug, stepping back to observe with genuine curiosity — not testing, but wondering. The table is lit by a warm overhead lamp. The scene feels like an invitation to jump in. Camera angle: slightly above, looking down at the table and out toward the mentor. The feeling: possibility, creative energy, a challenge that's exciting not threatening.

### Panel 2.2 — The Collection Wall
> A large wall in a creative workshop completely covered in pinned-up items: torn magazine pages, photographs, fabric swatches, a dried flower, a circuit board, postcards, a child's drawing, a bus ticket, handwritten notes on index cards, a small fabric pocket holding a feather, paint colour chips, a screenshot of a tweet printed out, a receipt with handwriting on it. Items are pinned with colourful pushpins and some connected with string (like a detective's evidence board but creative, not sinister). The wall is on exposed brick or industrial concrete. Warm side lighting from a window. A person's hand is touching one of the photos. The feeling: a lifetime of curiosity made physical. Messy, personal, beautiful, overwhelming in the best way.

### Panel 3.1 — The Window
> Two silhouettes (an adult mentor and implied student viewer — shot from behind) looking out a large industrial window at a richly detailed community scene below. Outside: a school playground with kids, an elderly person carrying heavy shopping bags, a teenager sitting alone on a bench looking at their phone, a small park with a broken fence, a community garden, a parent with a stroller passing a shuttered shop. Late afternoon golden light streaming in. The window frame is industrial steel. The feeling: the shift from looking inward to looking outward. The world is full of problems worth solving, if you know how to look.

### Panel 3.2 — Kit's Medicine Bottle Story
> Close-up of hands — elderly hands with visible arthritis, knuckles swollen — struggling to open a childproof medicine bottle cap. The hands are real, expressive, slightly trembling. A young person's hands are reaching in from the edge of the frame to help. On the table: other medicine bottles, a glass of water, a knitted table mat. Warm domestic lighting. The image tells the whole story: someone designed this bottle and never thought about these hands. Emotional, specific, human.

### Panel 4.1 — Three Doors
> A wide corridor with three distinct doors at the end, each slightly different in character. Left door: wooden and warm, with a small window showing workshop tools inside — maker energy. Middle door: sleek and modern, with a digital screen beside it showing data/research — investigator energy. Right door: painted bright colours with community artwork around the frame — helper/connector energy. Atmospheric lighting — each door has its own light colour spilling from underneath (amber, blue, warm pink). The corridor walls have faded footprints painted on the floor leading toward the doors. The feeling: a genuine crossroads, three real possibilities, no wrong choice.

### Panel 4.5 — Kit on Choosing
> The mentor leaning against a door frame in the corridor, casual posture, honest expression — not cheerful, not solemn, just real. One hand in pocket, other hand gesturing slightly as if making a point. The lighting catches one side of their face. Behind them, two of the three doors are slightly faded/closed, while the third has light coming from it. The feeling: a moment of real talk. "Here's what I've learned about choosing."

### Panel 5.2 — The View
> Full panoramic view from a rooftop or hilltop at golden hour. A wide landscape stretches below — a mix of city buildings, green spaces, water in the distance, and sky taking up the top third of the image. Two silhouettes in the foreground: the mentor (slightly turned, gesturing outward) and a student figure (smaller, looking out at the view). Both are dark silhouettes against the warm sky — the student is deliberately generic/universal so any viewer can project themselves. The feeling: possibility, elevation, the moment before launch. Everything learned so far has led to this view.

### Panel 5.5 — The Send-Off
> The mentor standing at the edge of the rooftop, slightly turned back toward the viewer with a casual wave/salute. One hand raised, fingers loosely spread. They're backlit by morning light, face partially visible with a warm expression — confident in the student, no sentimentality. Behind them: the open sky, clouds, birds. The rooftop has scattered creative items (a sketch pad left on a ledge, a coffee cup). The feeling: "I believe in you. Now go." Not a goodbye — a launch.

### Transition Panels (Between Chapters)
> A pair of footprints on a concrete floor, one in front of the other, walking from left to right. Chalk marks and symbols drawn on the ground along the path — an arrow, a small star, a squiggly line, a word written in chalk (changes per transition: "curious," "looking," "choosing," "ready"). Warm overhead light creating long shadows. Minimalist, atmospheric, forward motion. No characters — just evidence of a journey.

---

## Implementation Notes

### What Changes From Current Code
1. **DiscoveryFlow.tsx** — major rewrite. Current chat-with-comic-panels becomes true sequential comic strip with pre-rendered images and AI-generated text in speech bubbles
2. **ComicPanel.tsx** — replace SVG scenes with `<img>` tags loading pre-generated panel images. Keep speech bubble overlay system but restyle for graphic novel feel
3. **API route** — system prompt restructure. Current generic "discovery conversation" becomes chapter-specific prompts with Kit's voice, chapter-appropriate data extraction, and story-first response patterns
4. **New: chapter progression** — panels render sequentially as the student scrolls and responds. Not all at once. Each chapter animates in after the previous one completes
5. **New: choice UI for Chapter 4** — door selection interaction, not just text input

### What Stays the Same
- Data model (DiscoveryProfile shape, strengths/interests/needs/project_statement)
- Step progression logic (just renamed chapters)
- Profile reveal cards (redesigned but same function)
- Completion trigger and handoff to Planning phase

### Image Assets Needed
~15-18 panels. Some are reusable across students (structural scenes), some have variant versions. All generated in ChatGPT image with consistent style.

Priority order for generation:
1. Panel 1.1 (The Door) — sets the visual tone for everything
2. Panel 1.2 (Kit) — establishes the character
3. Panel 2.2 (The Wall) — most visually rich scene
4. Panel 3.1 (The Window) — the emotional pivot
5. Panel 5.2 (The View) — the payoff
6. Remaining panels in narrative order
