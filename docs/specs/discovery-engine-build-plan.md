# Discovery Engine — Build Plan & Content Bible
*Everything needed before writing the first line of code.*

**Status:** Pre-build. All decisions locked.
**Companion docs:** `discovery-engine-ux-design.md` (visuals), `discovery-engine-ai-integration.md` (AI), `discovery-engine-spec.md` (data model), `discovery-engine-v3-intelligence.md` (intelligence layer)
**Date:** 26 March 2026

---

## Part 1: Build Order (Phased Implementation)

The Discovery Engine has hard dependencies. Building out of order creates throwaway work.

### The Dependency Chain

```
Content Pool (authored) ← Station Components ← State Machine ← AI Integration ← Reveals ← Polish
     ↓                        ↓                     ↓               ↓              ↓
  Can't test            Can't flow             Can't save       Can't adapt    Can't share
  interactions          between them            progress       to responses    screenshots
```

**Critical path:** Content → State Machine → Station 0-1 → Station 2 → Station 3 → Station 4 → Station 5 → Station 6 (AI) → Station 7 (Grand Reveal) → Polish

### Phase 0: Foundations (~2 days)

Build the scaffolding everything plugs into.

| Task | What | Why First |
|------|------|-----------|
| 0.1 | Route structure + page shell | Everything mounts here |
| 0.2 | `DiscoveryProfile` TypeScript interfaces | Every component reads/writes this |
| 0.3 | State machine (XState or useReducer) | Controls all navigation + saves |
| 0.4 | Auto-save hook (`useDiscoverySession`) | Must work before testing anything |
| 0.5 | Age band detection + content pool loader | All content branches on this |
| 0.6 | Kit Rive placeholder (static image with expression swap) | Mentor presence from day 1, Rive file can come later |
| 0.7 | Transition wrapper component (Framer Motion page transitions) | Stations need enter/exit animations |
| 0.8 | Station background component (CSS gradient Layer 0 + image lazy load) | Visual atmosphere from day 1 |

**Phase 0 exit criteria:** Can navigate between empty station shells, state persists across browser close, Kit shows a face, backgrounds have color.

### Phase 1: Content-Heavy Stations (no AI) (~4-5 days)

Build the stations that DON'T need AI calls. This validates the interaction patterns and data collection.

| Task | Station | Depends On | AI Calls |
|------|---------|-----------|----------|
| 1.1 | **Station 0: Design Identity Card** — palette picker, tool belt drag, workspace decoration | Phase 0 | None |
| 1.2 | **Station 1: Campfire** — Kit intro, 12 binary quick-fire pairs, working style computation | Phase 0, content pool | None (Kit reflection is template for now) |
| 1.3 | **Station 3: Collection Wall** — interest icon grid (20 icons), irritation scenarios, YouTube topics, values card sort | Phase 0, content pool | None (synthesis is template for now) |
| 1.4 | **Station 5: Toolkit** — time slider, resource card sort (12 cards), people icons, 7 self-efficacy sliders, past projects, failure response | Phase 0, content pool | None (calibration is template for now) |

**Why these 4 first:** Zero AI dependency. Pure interaction → data collection. Tests all 8 interaction types. By the end, you have a working prototype that collects 70% of the profile data with no API calls.

**Phase 1 exit criteria:** Student can complete S0 → S1 → S3 → S5 in sequence with placeholder transitions. All data lands in `DiscoveryProfile` state. Auto-save works. Resume from any point works.

### Phase 2: AI-Light Stations (~3-4 days)

Add the stations with Haiku calls (cheap, fast, low-risk).

| Task | Station | Depends On | AI Calls |
|------|---------|-----------|----------|
| 2.1 | **Station 2: Workshop** — panic scenario text prompt, 6 archetype scenarios, "people come to you for" icon grid | Phase 1 (needs working style from S1) | 3 Haiku (reflection, mid-station adaptation, archetype reveal narrative) |
| 2.2 | **Station 4: Window** — community scene with CSS hotspot overlays, zoom-in narrowing, scale/urgency/proximity sliders, problem text prompt | Phase 1 (needs archetype + interests) | 3 Haiku (scene emphasis, problem analysis, bridge synthesis) |
| 2.3 | Haiku API route (`/api/discovery/reflect`) | — | Shared endpoint for all Haiku calls |
| 2.4 | Wire Kit reflections to all stations (replace templates from Phase 1) | 2.3 | Haiku per station |
| 2.5 | Station reveals (6 mini-reveals: working style summary, archetype card, interest map, empathy compass, resource radar, combined bridge) | Phases 1+2 | Deterministic + Haiku narrative overlays |

**Phase 2 exit criteria:** Full S0 → S1 → S2 → S3 → S4 → S5 flow works. Kit responds contextually. Reveals show real data. Profile is 90% complete (missing only project direction).

### Phase 3: AI-Heavy Stations (~3-4 days)

The high-stakes Sonnet calls. These are the defining moments.

| Task | Station | Depends On | AI Calls |
|------|---------|-----------|----------|
| 3.1 | **Station 6: Crossroads** — 3 AI-generated doors, explore each, fear cards, choose | Full profile from S0-S5 | 1 Sonnet (door generation) + 2 Haiku |
| 3.2 | **Station 7: Launchpad** — project statement, success criteria, excitement check, Grand Reveal | S6 chosen door | 1 Sonnet (Grand Reveal) + 1 Haiku |
| 3.3 | Door generation prompt + fallback chain (Sonnet → retry → Haiku simplified → template) | — | — |
| 3.4 | Grand Reveal generation + staggered fallback (deterministic Phase 1 → AI Phase 2 → template Phase 3) | — | — |
| 3.5 | Pre-generation: async Sonnet draft between S4→S5 to reduce S6 latency | 2.2 | 1 Sonnet (async) |
| 3.6 | Post-journey: teacher summary, Design Assistant handoff (`buildDiscoveryContext()`) | Full profile | 2 Haiku (async) |

**Phase 3 exit criteria:** Complete journey works end-to-end. All AI calls fire with fallbacks. Grand Reveal renders. Profile persists to DB. Design Assistant receives discovery context.

### Phase 4: Polish (~2-3 days)

| Task | What |
|------|------|
| 4.1 | ChatGPT-generated background images replace CSS gradients |
| 4.2 | Rive Kit animation file (5 expressions, breathing, blinks) |
| 4.3 | Station transition animations (parallax scroll, Kit walking) |
| 4.4 | Shareable PNG export of Grand Reveal |
| 4.5 | Mobile responsive pass |
| 4.6 | Resume experience ("Welcome back — here's where we were") |
| 4.7 | Mode 2 (Open Studio-default) entry point |

**Total estimate: ~14-18 days** (not including image generation, which is a parallel track).

---

## Part 2: Content Bible

Every piece of authored content the Discovery Engine needs, organized by station. This is the content that must EXIST before the station can be tested.

### Content Format

All content is stored in a TypeScript content pool file per station:

```typescript
// src/lib/discovery/content/station-1-campfire.ts
export interface BinaryPair {
  id: string;
  prompt: string;  // "When a project is due soon, I..."
  optionA: { label: string; icon: string; signal: string; dimension: string; value: 'a' };
  optionB: { label: string; icon: string; signal: string; dimension: string; value: 'b' };
  ageBands: ('junior' | 'senior' | 'extended')[];
}
```

Age bands: **junior** (MYP Years 1-3, ages 11-13), **senior** (MYP Years 4-5, ages 14-16), **extended** (DP/CP, ages 17-18).

Content marked `[ALL]` works for all bands. Content marked `[J]` `[S]` `[E]` is age-specific.

---

### Station 0: Design Identity Card

**No authored text content needed.** All interaction is visual selection.

**Assets needed:**

| Asset | Count | Notes |
|-------|-------|-------|
| Color palettes | 5 | Warm, Cool, Bold, Earth, Neon — each as a visual swatch group |
| Tool icons | 12 | Students pick 3. Each maps to archetype weights. |
| Workspace items | 16 | Students pick 4. Each maps to working style signals. |

**Tool → Archetype mapping table (revised — every tool has a unique fingerprint, see §6.4):**

| Tool | Maker | Researcher | Leader | Communicator | Creative | Systems |
|------|-------|-----------|--------|-------------|---------|---------|
| Hammer | 3 | 0 | 0 | 0 | 0 | 0 |
| Magnifying glass | 0 | 3 | 0 | 0 | 0 | 0 |
| Clipboard | 0 | 0 | 3 | 0 | 0 | 1 |
| Megaphone | 0 | 0 | 1 | 3 | 0 | 0 |
| Paintbrush | 0 | 0 | 0 | 0 | 3 | 0 |
| Gear | 0 | 0 | 0 | 0 | 0 | 3 |
| Pencil | 1 | 0 | 0 | 2 | 1 | 0 |
| Microscope | 0 | 2 | 0 | 0 | 0 | 2 |
| Camera | 0 | 1 | 0 | 2 | 1 | 0 |
| Laptop | 0 | 1 | 0 | 1 | 0 | 2 |
| Scissors | 2 | 0 | 0 | 0 | 2 | 0 |
| Compass (drawing) | 1 | 0 | 0 | 0 | 0 | 3 |

**Workspace Item → Working Style mapping:**

| Item | Signal | Trait |
|------|--------|-------|
| Tidy desk | Organized space | Structured |
| Messy desk with projects | Creative chaos | Flexible |
| Whiteboard with plans | Visual planning | Planner |
| Sticky notes everywhere | Quick capture | Improviser |
| Plants | Living things, patience | Marathoner |
| Clock | Time awareness | Structured |
| Headphones | Focus, solo zone | Solo worker |
| Two chairs | Space for others | Collaborator |
| Reference books | Research-oriented | Researcher |
| Prototype models | Making | Maker/Doer |
| Inspiration board | Visual thinker | Creative |
| Tool organizer | Systematic | Systems thinker |
| Coffee/tea setup | Comfort, ritual | Marathoner |
| Calendar | Deadline aware | Planner |
| Sketchbook | Ideation | Creative |
| Collaboration board | Team space | Collaborator |

---

### Station 1: The Campfire — Quick-Fire Binary Pairs

**12 pairs needed.** Each maps to a working style dimension. Must feel fast and fun — no overthinking.

**Voice rule:** Prompts are micro-situations, not abstract traits. Options are what you'd actually SAY, not how a psychologist would label you. Both options must feel equally cool — no "right answer" vibes.

| # | Dimension | Prompt | Option A | Option B | Bands |
|---|-----------|--------|----------|----------|-------|
| 1 | planning | "New project, blank page. You..." | "Grab a pencil and start sketching immediately" | "Open a doc and write down a plan first" | [ALL] |
| 2 | social | "You're stuck on a problem. You..." | "Find someone to talk it through with" | "Put your headphones on and figure it out alone" | [ALL] |
| 3 | structure | "Your desk right now is..." | "Pretty organised — I like knowing where things are" | "A mess — but I know exactly where everything is" | [ALL] |
| 4 | energy | "Saturday morning, no plans. You'd rather..." | "Pick one thing and go deep for hours" | "Do a bunch of different stuff, switching when you feel like it" | [ALL] |
| 5 | decision | "You're choosing between two project ideas. You..." | "Just pick the one that feels right" | "Make a list of pros and cons first" | [ALL] |
| 6 | risk | "Your project is 'good enough' with 2 days left. You..." | "Tear it apart and try something way more ambitious" | "Polish what you've got until it's really solid" | [ALL] |
| 7 | pace | "First day on a new project. You..." | "Go slow — research, think, plan, then start" | "Get something made by the end of the day, even if it's rough" | [ALL] |
| 8 | feedback | "A teacher hands back your work with notes. You look at..." | "The specific marks and comments — what exactly needs fixing" | "The overall grade and vibe — do they get what I was going for?" | [ALL] |
| 9 | scope | "If you had an extra week on a project, you'd..." | "Go deeper into what you've already got" | "Add something new you haven't tried yet" | [ALL] |
| 10 | expression | "You need to explain an idea to someone. You'd rather..." | "Draw it, build it, or show them a picture" | "Talk them through it or write it down" | [ALL] |
| 11 | learning_intake | "You need to learn how to use a new tool. You..." | "Watch a video or read the instructions first" | "Just start pressing buttons and see what happens" | [ALL] |
| 12 | learning_source | "You really 'get' something when..." | "Someone shows you a great example of it done well" | "Someone explains the idea behind why it works" | [ALL] |

**Working style computation:**

```typescript
type WorkingStyleVector = {
  planning: 'planner' | 'improviser';
  social: 'collaborative' | 'independent';
  structure: 'structured' | 'flexible';
  energy: 'deep_focus' | 'burst';
  decision: 'gut' | 'analytical';
  risk: 'risk_taker' | 'reliable';
  pace: 'slow_build' | 'fast_start';
  feedback: 'specific' | 'big_picture';
  scope: 'depth' | 'breadth';
  expression: 'visual' | 'verbal';
  learning_intake: 'study' | 'experiment';
  learning_source: 'example' | 'concept';
};

function computeDominantStyle(vector: WorkingStyleVector): 'planner' | 'doer' | 'explorer' | 'balanced' {
  const plannerSignals = [vector.planning === 'planner', vector.structure === 'structured', vector.pace === 'slow_build', vector.decision === 'analytical'].filter(Boolean).length;
  const doerSignals = [vector.planning === 'improviser', vector.pace === 'fast_start', vector.risk === 'risk_taker', vector.learning_intake === 'experiment'].filter(Boolean).length;
  const explorerSignals = [vector.scope === 'breadth', vector.structure === 'flexible', vector.risk === 'risk_taker', vector.feedback === 'big_picture'].filter(Boolean).length;

  const max = Math.max(plannerSignals, doerSignals, explorerSignals);
  if (max <= 1) return 'balanced';
  if (plannerSignals === max) return 'planner';
  if (doerSignals === max) return 'doer';
  return 'explorer';
}
```

**Kit reflection templates (fallback when Haiku unavailable):**

These reference SPECIFIC answers from the quick-fire — Kit should feel like she was paying attention, not reading from a script.

```typescript
const QUICK_FIRE_REFLECTIONS: Record<string, string> = {
  planner: "You went for the plan almost every time. I used to be like that — needed the whole map before I'd take a step. Here's what took me years to learn: the plan is never right. But planners who know that? They're unstoppable. Because you plan, then adapt, while everyone else is still figuring out where to start.",
  doer: "You barely hesitated on most of those. Straight to action. I love that — but I've also watched that instinct build the wrong thing really fast. The trick isn't slowing down. It's pointing your energy at something worth building before you start swinging the hammer.",
  explorer: "You kept picking the open-ended option. More things, wider scope, bigger picture. That's not indecision — that's how people who make unexpected connections think. Your challenge isn't going to be having ideas. It's going to be picking one.",
  balanced: "Interesting — you went back and forth on a lot of those. Some people would call that indecisive. I'd call it adaptable. You read the situation and adjust. That's actually harder than just having one mode.",
};
```

---

### Station 2: The Workshop — Archetype Scenarios

**6 archetype scenarios + 1 junior variant.** Each has 4-6 response options mapping to different archetypes.

#### Scenario 2.1: Group Project Crisis [ALL]

> "You're in a group project. Halfway through, you realise the plan isn't working. The deadline is next week. You..."

| Option | Text | Archetype | Weight |
|--------|------|-----------|--------|
| A | "Quietly start building a backup plan in case the original fails" | Maker | 3 |
| B | "Call a meeting and lay out a new direction for the group" | Leader | 3 |
| C | "Research what went wrong — you need data before changing anything" | Researcher | 3 |
| D | "Sketch 3 quick alternatives and let the group pick" | Creative | 3 |
| E | "Talk to each person separately to understand what they think" | Communicator | 3 |
| F | "Map out which parts are working and which aren't — fix only what's broken" | Systems | 3 |

#### Scenario 2.2: Unexpected Free Period [ALL]

> "Your teacher is absent and you have a free period. Your design project is due in 3 days. You..."

| Option | Text | Archetype | Weight |
|--------|------|-----------|--------|
| A | "Head to the workshop and start making something — even rough" | Maker | 3 |
| B | "Open your laptop and research what other people have done for similar problems" | Researcher | 3 |
| C | "Find your group and coordinate who's doing what by when" | Leader | 3 |
| D | "Grab your sketchbook and brainstorm wildly — no judgement" | Creative | 3 |
| E | "Find your target user and ask them some quick questions" | Communicator | 2, Researcher | 1 |
| F | "Review the project plan and figure out the most efficient path to done" | Systems | 3 |

#### Scenario 2.3: Feedback Crunch [ALL]

> "Your teacher says your design is 'fine but safe.' You have one day to improve it before final submission. You..."

| Option | Text | Archetype | Weight |
|--------|------|-----------|--------|
| A | "Rebuild one section from scratch with a bolder approach" | Maker | 2, Creative | 1 |
| B | "Look at award-winning examples and analyse what makes them stand out" | Researcher | 3 |
| C | "Ask 3 classmates for honest feedback and pick the best suggestion" | Communicator | 2, Leader | 1 |
| D | "Generate 5 radically different alternatives in 20 minutes, pick the most exciting" | Creative | 3 |
| E | "Identify the weakest part of the system and redesign just that piece" | Systems | 3 |
| F | "Present your current work to someone and watch their reaction — that tells you what to fix" | Communicator | 3 |

#### Scenario 2.4: Someone Needs Help [ALL]

> "A classmate is struggling with their project. They're frustrated and behind. You..."

| Option | Text | Archetype | Weight |
|--------|------|-----------|--------|
| A | "Sit down with them and help build something together — hands on" | Maker | 3 |
| B | "Help them break down the problem and find resources" | Researcher | 2, Systems | 1 |
| C | "Organise a quick study group so they're not alone" | Leader | 3 |
| D | "Share some creative techniques that always work for you when you're stuck" | Creative | 2, Communicator | 1 |
| E | "Listen first. Sometimes people just need to talk through it before they can fix it" | Communicator | 3 |
| F | "Look at their process and spot where it went off track — help them see the pattern" | Systems | 3 |

#### Scenario 2.5: Collaboration Disagreement [ALL]

> "You and a partner disagree about which direction your project should go. You both feel strongly. You..."

| Option | Text | Archetype | Collaboration Style |
|--------|------|-----------|-------------------|
| A | "Make your case clearly and try to convince them" | Leader | Assert |
| B | "Find the overlap between both ideas — there's usually a way to combine them" | Communicator | Negotiate |
| C | "Let them take the lead on this one — you'll contribute more in your own way later" | — | Defer |
| D | "Split up — you each build your version and compare" | Maker | Fork-and-merge |

#### Scenario 2.6: Ambiguity Response [S][E]

> "Your teacher gives you a project brief that says: 'Improve something in your community.' No other instructions. You..."

| Option | Text | Archetype | Weight |
|--------|------|-----------|--------|
| A | "Love it — immediately start thinking about what to build" | Maker | 2, Creative | 1 |
| B | "Start researching your community — what needs improving?" | Researcher | 3 |
| C | "Ask the teacher clarifying questions — what counts? what's the scope?" | Systems | 2, Leader | 1 |
| D | "Talk to community members to find out what THEY think needs improving" | Communicator | 3 |
| E | "Feel a bit overwhelmed but excited — draw a mind map to find your way in" | Creative | 2 |
| F | "Create a spreadsheet of every possible problem and rank them by impact" | Systems | 3 |

#### Scenario 2.6J: Ambiguity Response (Junior) [J]

> "Your teacher says 'Design something that solves a problem at school.' That's it — no other rules. You..."

| Option | Text | Archetype | Weight |
|--------|------|-----------|--------|
| A | "Awesome! Start sketching ideas straight away" | Maker | 2, Creative | 1 |
| B | "Walk around school looking for problems to solve" | Researcher | 2, Communicator | 1 |
| C | "Ask your friends what annoys them about school" | Communicator | 3 |
| D | "Ask the teacher some questions first — you want to know what's expected" | Systems | 2 |
| E | "Make a list of every problem you can think of, then pick the best one" | Systems | 2, Researcher | 1 |
| F | "Find a friend and brainstorm together" | Leader | 1, Communicator | 2 |

**"What do people come to you for?" — Icon Grid (S2.5):**

| Icon | Label | Archetype Signal |
|------|-------|-----------------|
| 🛠️ | Fixing things | Maker |
| 💡 | Ideas | Creative |
| 📋 | Getting organized | Leader / Systems |
| 🗣️ | Explaining things | Communicator |
| 🔍 | Finding things out | Researcher |
| 🤝 | Settling arguments | Communicator / Leader |
| 🎨 | Making things look good | Creative |
| 🧩 | Figuring out how things work | Systems / Researcher |
| 📱 | Tech help | Systems / Maker |
| 🎭 | Making people laugh / feel better | Communicator |

Student selects 2-3. Each contributes to archetype scoring as "external validation" signal (weighted 1.5× because observable strengths are more reliable than self-assessment).

---

### Station 3: The Collection Wall — Interests & Values

**Interest Icon Pool (20 icons, student picks 5-7):**

| # | Label | Cluster | Bands |
|---|-------|---------|-------|
| 1 | Building & making | Physical creation | [ALL] |
| 2 | Art & visual design | Creative expression | [ALL] |
| 3 | Music & sound | Creative expression | [ALL] |
| 4 | Sports & movement | Physical | [ALL] |
| 5 | Nature & environment | Environment | [ALL] |
| 6 | Food & cooking | Physical creation | [ALL] |
| 7 | Coding & digital | Technology | [ALL] |
| 8 | Social media & content | Communication | [ALL] |
| 9 | Photography & film | Creative expression | [ALL] |
| 10 | Gaming & game design | Technology / Creative | [ALL] |
| 11 | Reading & writing | Communication | [ALL] |
| 12 | Science & experiments | Research | [ALL] |
| 13 | Travel & cultures | Exploration | [ALL] |
| 14 | Animals & wildlife | Environment | [ALL] |
| 15 | Fashion & textiles | Creative expression | [ALL] |
| 16 | Architecture & spaces | Systems / Creative | [ALL] |
| 17 | Psychology & people | Research / Communication | [S][E] |
| 18 | Fairness & justice | Values | [S][E] |
| 19 | Business & entrepreneurship | Systems | [S][E] |
| 20 | Global issues | Values / Environment | [ALL] |

Junior replacements for #17-19:

| # | Label | Cluster | Bands |
|---|-------|---------|-------|
| 17J | Puzzles & problem-solving | Research / Systems | [J] |
| 18J | Performing & presenting | Communication | [J] |
| 19J | Robots & electronics | Technology / Making | [J] |

**Irritation Scenarios (pick 1-2 or write own):**

Written in the voice students actually use. These should feel like overheard hallway complaints, not a teacher's idea of what students care about.

| # | Scenario | Signal | Bands |
|---|----------|--------|-------|
| 1 | "When you can see the bin is full and people just keep piling rubbish on top instead of doing something about it" | Environmental / Systems | [ALL] |
| 2 | "When the school app is so confusing that it's faster to just ask someone in person" | Design / Systems | [ALL] |
| 3 | "When adults make decisions about you — your schedule, your groups, your options — without ever asking what you think" | Autonomy / Leader | [ALL] |
| 4 | "When someone has a good idea in a group but the loudest person talks over them and nobody notices" | Social / Communicator | [ALL] |
| 5 | "When you're told to 'be creative' but then every choice is already made for you" | Autonomy / Creative | [ALL] |
| 6 | "When something that should take 2 minutes takes 20 because nobody thought about how people actually use it" | Systems / Design | [ALL] |
| 7 | "When a space could be really nice but nobody cares enough to look after it" | Environment / Creative | [ALL] |
| 8 | "When the same people always get picked for things and nobody else gets a chance" | Fairness / Leader | [ALL] |
| 9 | "When everyone knows something is a problem but people just shrug and say 'that's how it is'" | Systems / Researcher | [S][E] |
| 10 | "When rules exist to protect 'everyone' but actually only work for some people" | Justice / Systems | [S][E] |

**YouTube Rabbit Hole Topics (select 2-3):**

Kit intro: *"What do you actually watch when nobody's making you? The stuff you click at 11pm when you should be sleeping."*

Phrased as actual YouTube genres, not adult categories. Students should see these and think "oh yeah, that's me at 2am."

| # | Topic | Example channels/vibes | Cluster Signal |
|---|-------|----------------------|---------------|
| 1 | Factory tours / "How It's Made" stuff | How It's Made, Process X, factory walkthroughs | Making / Systems |
| 2 | Logo & design breakdowns | The Futur, Will Paterson, "why this logo works" | Creative / Research |
| 3 | DIY builds / room makeovers / upcycling | 5-Minute Crafts (guilty), actual makers, thrift flips | Making / Creative |
| 4 | Science experiments / "what happens if" | Mark Rober, Stuff Made Here, Veritasium | Research / Systems |
| 5 | Street interviews / social experiments | JiDion, Yes Theory, "asking strangers" videos | Communication / Research |
| 6 | Gaming content / game design deep dives | GMTK, design docs, "why this game feels good" | Technology / Creative |
| 7 | Cooking / recipe videos / food challenges | Joshua Weissman, Babish, "can I make..." | Making / Research |
| 8 | History rabbit holes / true stories / mysteries | Lemmino, Kurzgesagt, "the iceberg explained" | Research |
| 9 | Fashion hauls / fit checks / textile stuff | Thrift flips, "styling $10 outfits", pattern making | Creative |
| 10 | Room tours / tiny homes / architecture | Never Too Small, "I built a house for $X" | Creative / Systems |
| 11 | Climate / sustainability / protest footage | Our Changing Climate, activist content | Environment |
| 12 | Startup stories / "how I made money" / side hustles | Graham Stephan, "I started a business at 16" | Systems / Leader |

**Value Cards (8 — drag into Core / Important / Nice tiers):**

Kit intro: *"These are all good things. But you can't care about everything equally — nobody does. Drag them into what ACTUALLY drives you, not what sounds nicest."*

Cards have a bold title and a smaller "what this actually means" line underneath. The descriptions are written to prevent social desirability bias — every card should feel equally valid.

| # | Value | What it actually means |
|---|-------|----------------------|
| 1 | Helping people | You'd drop what you're doing if someone needed you — even if your own work suffers |
| 2 | Making things beautiful | You care whether things look right, feel right, are done with craft — even if nobody notices |
| 3 | Fixing what's broken | You see a problem and can't leave it alone — you have to solve it |
| 4 | Doing it your way | You'd rather do something original and imperfect than follow someone else's template |
| 5 | Making it fair | It bugs you when things are unfair — even when it doesn't affect you personally |
| 6 | Understanding deeply | You'd rather know WHY something works than just know THAT it works |
| 7 | Making things happen | You like being the person who gets people moving — even if it means making unpopular calls |
| 8 | Being part of something | The best work you've done was with other people — the team matters as much as the result |

---

### Station 4: The Window — Community Scene Hotspots

**Scene description (for ChatGPT image generation):**

> A bird's-eye-view illustration of a school and surrounding community. Warm afternoon light. The school is in the center with a playground, garden, entrance, and windows visible. Around it: a park, some shops, houses, a bus stop, a community center. People of various ages doing various things. Some things are clearly "problems" — but subtly, not cartoonishly. The scene should reward close looking.

**12 hotspots with CSS overlay positions:**

| # | ID | What's Visible | Problem Signal | Scale | Type |
|---|-----|---------------|---------------|-------|------|
| 1 | `lonely_student` | Student sitting alone at lunch | Social isolation | Personal | People |
| 2 | `broken_fountain` | Water fountain with "out of order" sign | Infrastructure neglect | School | System |
| 3 | `messy_artroom` | Art room visible through window, cluttered | Resource management | School | System |
| 4 | `exclusion` | Group excluding someone (body language) | Social dynamics | Personal | People |
| 5 | `steep_ramp` | Wheelchair ramp that's clearly too steep | Accessibility | School | System |
| 6 | `dead_garden` | School garden with wilted plants | Environmental neglect | School | System |
| 7 | `overwhelmed_teacher` | Teacher at desk, head in hands | Workload | School | People |
| 8 | `littering` | Trash near overflowing bins | Environmental | Community | System |
| 9 | `elderly_crossing` | Elderly person struggling at busy crossing | Safety / Access | Community | People |
| 10 | `closed_shop` | Small shop with "closing down" sign | Economic | Community | System |
| 11 | `broken_bench` | Park bench with broken slat | Infrastructure | Community | System |
| 12 | `lost_kid` | Young child looking around uncertainly | Safety | Community | People |

**Text prompt variants (based on what student clicked):**

Kit adapts based on their click pattern. The prompt should feel like Kit genuinely noticed what they looked at.

- Clicked mostly people → "You went straight to the people. [Hotspot1], [hotspot2]. You see who's struggling before you see what's broken. So tell me — who has it harder than they should, and what makes it hard?"
- Clicked mostly systems → "You looked at [hotspot1] and [hotspot2] — the broken things, the badly designed things. You see systems. So tell me — what's something you deal with regularly that's way more complicated than it needs to be?"
- Mixed → "You looked at everything — the people AND the broken stuff. That's rare. Most people lean one way. Here's your question: if you could fix ONE thing you see every single day, what would it be and why does it bother you?"

---

### Station 5: The Toolkit — Resources & Confidence

**UX note (breaking the survey problem):**
S5 collects the most data points of any station. After the emotional peaks of S2-S4, this CANNOT feel like a form. The metaphor is **"packing your bag before a trip"** — Kit frames it as a practical, honest inventory. Each sub-section is a different "compartment" of the bag, introduced with a Kit one-liner. Students should feel like they're preparing for an adventure, not filling in a questionnaire.

**Pacing rule:** Never show more than one interaction type per screen. Resource cards are one screen. People icons are the next. Each self-efficacy slider gets its own card with Kit commentary. This means ~12 mini-screens, not one long scrolling form. Fast transitions between them (200ms Framer Motion) keep the pace up.

---

**5a. "Open your bag — what have you got?" (Resource cards)**

12 resource cards — student drags into 3 columns: ✅ Got it / 🔄 Could get it / ❌ Nope

| # | Resource | Kit one-liner (on card back) | Signal |
|---|----------|-----|--------|
| 1 | A workshop or makerspace | "The best projects start with sawdust on the floor" | Physical making |
| 2 | Art supplies — paper, paint, markers | "You'd be surprised what you can do with a marker and an idea" | Creative materials |
| 3 | A computer or laptop | "Not just for YouTube. Mostly for YouTube. But not just." | Digital capacity |
| 4 | Some money to spend (~$20+) | "Even a tiny budget changes what's possible" | Financial resource |
| 5 | A camera or phone camera | "The best camera is the one in your pocket" | Documentation |
| 6 | Real tools — saws, drills, soldering iron | "Power tools are just levers with attitude" | Advanced making |
| 7 | A kitchen or food prep space | "Some of the best design projects you can eat" | Food projects |
| 8 | Outdoor space you can use | "Nature is the original design studio" | Environmental |
| 9 | A way to present to people (projector, screen, wall) | "The work isn't done until someone else sees it" | Communication |
| 10 | Reliable internet | "Research superpower. Also distraction superpower." | Research / digital |
| 11 | A way to get places (bike, bus, parents) | "Some problems require you to actually go there" | Community access |
| 12 | A quiet space where you can focus | "Sometimes the most productive tool is a closed door" | Focus |

---

**5b. "Who's in your corner?" (People icons)**

Select all that apply. Each icon is a simple illustrated character, not a stock photo.

| # | Person | How it's phrased (student voice) | Signal |
|---|--------|---------|--------|
| 1 | A teacher who gets it | "There's a teacher who'd actually help me with this" | Adult support |
| 2 | A friend who'd be up for it | "I've got someone who'd work on this with me" | Peer collaboration |
| 3 | Someone who knows things | "I know someone who's an expert — or close enough" | Domain expertise |
| 4 | Someone who's good at what I'm bad at | "There's a person whose skills are different from mine" | Complementary skills |
| 5 | Family who'd back me up | "Someone at home would support this" | Home support |
| 6 | A real person I could talk to | "I could actually go interview someone about this" | Community access |

---

**5c. "Honest check" (Self-efficacy — one slider per card)**

7 cards, one at a time. Each has a skill icon at the top, a slider, and a Kit micro-reaction that changes as you slide (3 breakpoints: low/mid/high). **The slider labels are deliberately informal** — if they sound like a form, students game them.

| # | Domain | Left (0) | Right (100) | Kit low (0-30) | Kit mid (31-69) | Kit high (70-100) |
|---|--------|----------|-------------|----------------|-----------------|-------------------|
| 1 | Making with hands | "I'll be honest — I break things more than I build them" | "Give me materials and I'll figure it out" | "That's fine — not every project needs power tools" | "Enough to be dangerous" | "Maker hands. Noted." |
| 2 | Sketching & drawing | "Stick figures are a stretch" | "I can get what's in my head onto paper" | "You don't need to draw well. You need to think visually." | "Good enough to communicate — that's what matters" | "Visual thinker. That's a real asset." |
| 3 | Researching | "I Google things and hope for the best" | "I know how to actually find things out" | "We'll work on that — there's a method to it" | "You know your way around — good" | "Research brain. You'll find things nobody else does." |
| 4 | Presenting | "I'd genuinely rather clean toilets" | "Put me in front of people, I'm fine" | "Noted. We'll find ways to share your work that don't require a stage." | "It's not your favourite, but you can do it" | "Comfortable up front — that opens doors." |
| 5 | Writing | "Getting thoughts into sentences is painful" | "I can explain things clearly on paper" | "Not everyone thinks in words. That's OK." | "You can get by. That's enough." | "Strong writer — that's an underrated superpower." |
| 6 | Working with others | "Group work gives me a headache" | "I work well with basically anyone" | "Solo project it is. Nothing wrong with that." | "Depends on the group, right? Always does." | "People person. Your team will be lucky." |
| 7 | Coming up with ideas | "My brain goes blank when someone says 'brainstorm'" | "Ideas are the easy part for me" | "Ideas can be learned. I'll show you some tricks." | "They come when you're not trying — right?" | "Idea machine. Your challenge will be picking one." |

---

**5d. "Track record" (Past experience — quick taps)**

Kit intro: *"One more thing. I'm not judging — I just need to know what you're walking in with."*

> "Design projects you've actually finished?"
- 🆕 This is my first one
- ✌️ One or two small ones
- 🔄 A few — I've been here before
- 💪 Loads — I know the drill

> "Last project — how'd it end?"
- 🎉 Finished it. Proud of it.
- 😐 Finished it. It was... fine.
- ⏰ Ran out of time before it was done
- 🔀 Changed direction halfway through
- 🤷 Haven't really done one before

---

**5e. "When it gets hard" (Failure response)**

Kit: *"Every project hits a wall. I've never seen one that doesn't. When yours does..."*

> "Your project stops working halfway through. Nothing is going to plan. You..."
- 🔥 "Burn it down, start fresh — the idea was the problem" → pivot
- 🪨 "Keep grinding — I'll get through it eventually" → persist
- 🚶 "Step away. Come back tomorrow with fresh eyes." → pause
- 🙋 "Find someone who's done this before and ask for help" → help-seek

---

**5f. "Who's this for?" (Audience — select all)**
- 🪞 Just me and my teacher → personal
- 🏫 My class → school
- 🏫🏫 My whole school → school-wide
- 🏘️ People in my community → community
- 🌍 Anyone, anywhere → global

---

**5g. "How far away is the deadline?" (Time horizon slider)**

Kit: *"Last one. Be honest."*

"8 weeks from now feels like..."

Left: "Basically forever away" → Right: "Basically tomorrow" (0-100)

Kit reacts: low (<30) = "You've got time on your side. Use it." / mid (30-69) = "Enough time to do something real if you start soon." / high (>70) = "Okay, so we need to be realistic about scope. That's useful information."

---

### Station 6: The Crossroads — Doors & Fears

**Door types (AI generates 3):**

| Door | Name | Strategy |
|------|------|----------|
| 1 | "The Sweet Spot" | Highest alignment with archetype + interests + resources. Most achievable. |
| 2 | "The Stretch" | Pushes into a gap area — develops a weakness using a strength. |
| 3 | "The Surprise" | Cross-domain — connects interests in an unexpected way. |

**Door card structure:**

```typescript
interface ProjectDirection {
  number: 1 | 2 | 3;
  title: string;
  description: string;       // 2-3 sentences
  whyThisFits: string;       // connects to profile data
  firstStep: string;         // concrete week-1 action
  resourcesNeeded: string[];
  resourcesGap: string[];
  ambitionLevel: 'achievable' | 'stretch' | 'ambitious';
  archetypeAlignment: number; // 0-100
}
```

**Fear cards (5 — select 1 after choosing door):**

| # | Fear | Scene Description |
|---|------|------------------|
| 1 | Failing publicly | Student presenting, audience looking skeptical |
| 2 | Not finishing | Project half-done on desk, calendar showing deadline |
| 3 | It being boring | Yawning audience, uninspired project |
| 4 | Nobody caring | Student showing work, people walking past |
| 5 | Not being good enough | Student comparing their work to someone else's |

**Template doors (fallback per archetype — need 18 total):**

| Archetype | Door 1 (Sweet Spot) | Door 2 (Stretch) | Door 3 (Surprise) |
|-----------|-------------------|-------------------|-------------------|
| Maker | "Fix Something Broken" — Find something at school that doesn't work and redesign it | "Teach Someone to Make" — Create a workshop that teaches others a skill you have | "Make the Invisible Visible" — Build something that shows a hidden problem |
| Researcher | "Deep Dive" — Pick a question nobody's answered properly and investigate it | "Research to Action" — Turn your findings into something people can use | "Cross-Pollinate" — Connect two fields nobody thought were related |
| Leader | "Rally a Team" — Organize a group around a cause that matters to you | "Lead by Making" — Don't just plan — build something yourself first | "Empower Someone Else" — Help another person find and complete their project |
| Communicator | "Tell a Story" — Find a story that needs telling and tell it powerfully | "Change a Mind" — Design something that shifts how people think about an issue | "Bridge the Gap" — Connect two groups who don't understand each other |
| Creative | "Reimagine Something Old" — Take something everyone's used to and make it new | "Beauty with Purpose" — Create something beautiful that also solves a problem | "Creative Toolkit" — Design tools or resources that help others be creative |
| Systems | "Fix the System" — Find a broken process and redesign it | "Make Complexity Simple" — Take something confusing and make it understandable | "Connect the Dots" — Find a pattern nobody else has noticed and make it useful |

---

### Kit's Pre-Written Dialogue

**Voice rules for Kit across ALL stations:**
- Kit talks like a smart older cousin, not a teacher. Contractions always. Short sentences mixed with longer ones.
- Kit shares before asking. Vulnerability first, question second.
- Kit never says "Great choice!" or "Well done!" — that's teacher energy. Kit says "Interesting" or "Huh" or "I wouldn't have guessed that."
- Kit references specific earlier answers when possible (Haiku handles this; templates use [placeholder] syntax).
- Kit is allowed to be a little sarcastic, a little self-deprecating, never mean.

---

**Station 0 (Design Identity Card):**

*Kit appears as student enters:*
> "Before we talk — show me who you are. Pick some colours, grab some tools, set up your space. Don't think too hard about it. First instincts are usually the honest ones."

*Kit after selections:*
> "Huh. [Palette] colours, [tool1] and [tool2] on the desk, and [workspace item]. I'm already forming a theory about you. Let's see if I'm right."

---

**Station 1 intro (Mode 1 — post-lessons):**
> "Alright. I'm Kit. I've been doing this for a while — mentoring students through projects. Some went brilliantly. Some went off a cliff. I learned from both. Before we figure out what you're going to build, I need to understand how your brain works. This is going to be fast. Don't overthink it — there are no wrong answers, just honest ones."

**Station 1 intro (Mode 2 — unit entry):**
> "Hey. I'm Kit — I'll be your guide through this project. But I don't know you yet, and I'm not going to pretend to. So let's fix that. I'm going to throw some quick choices at you. Go with your gut. There's no right answer — I just need to see how you think."

**Station 1 outro (after quick-fire, before reflection):**
> "Twelve questions, and you didn't hesitate on most of them. That tells me something already."

---

**Station 2:** Full micro-story about "The Chair" — see §6.5 for Mode 1 and Mode 2 variants.

**Station 2 transition to scenarios:**
> "So — The Chair taught me I was a certain kind of designer. I didn't know it at the time. Let me see what kind you are. I'm going to throw some situations at you. Not hypothetical ones — these actually happen."

**Station 2 after scenarios:**
> "Interesting. The way you respond when things go wrong tells me more about you than what you'd do when everything's fine."

---

**Station 3:**
> "This is my collection wall. See the mess? Every pin, every photo, every weird magazine clipping — it's something I noticed and couldn't stop thinking about. Over the years I've learned that the things that grab you aren't random. They're clues. Your turn. Don't curate it. Just grab what feels right."

**Station 3 after interest selection:**
> "[N] things on your wall. I can already see a pattern — can you?"

**Station 3 irritation intro:**
> "OK here's my favourite question. What ANNOYS you? Not mildly bothers you — genuinely irritates you. Because here's the thing: the stuff that makes you angry? That's where your best projects hide."

---

**Station 4:**
> "Come over here. See this window? I want to tell you about a student I worked with — Maya. She was smart, creative, good grades. But she couldn't pick a project. Everything felt too small or too abstract. Then one day she looked out the window during class and saw a kid in a wheelchair stuck at the bottom of the ramp outside the art room. Three months later she'd redesigned the entire entrance. The project didn't come from a textbook. It came from paying attention."

**Station 4 after scene clicks:**
> "You clicked on [hotspot1] and [hotspot2]. You notice [people/systems/a mix]. That's not random — that's your lens."

---

**Station 5:**
> "Time to get real. I've seen a lot of first-timers plan a project that needs a 3D printer, a film crew, and six months. Then they've got two weeks, a pair of scissors, and a free period on Thursdays. That's not a disaster — that's useful information. Let's pack your bag and see what you're actually working with."

---

**Station 6:**
> "This is the bit that scares people. Three directions. One choice. But listen — I'm going to tell you something nobody tells students: the 'perfect project' doesn't exist. I've never seen one. What I HAVE seen is someone pick a decent direction and make it extraordinary through sheer stubbornness and curiosity. The door you choose matters less than what you do after you walk through it."

**Station 6 after door exploration:**
> "You've looked behind all three. Your face changed on Door [N] — did you notice that?"

---

**Station 7:**
> "Last stop. Everything you've shown me — how you think, what you care about, what bugs you, what you can actually do, and where you want to go — it's time to bring it together. This isn't a final answer. It's a starting point that actually fits who you are. That's better than what most people start with."

**Station 7 after project statement:**
> "Read that back to yourself. Does it sound like you? Not like what a teacher would want to hear — like what you actually want to do."

---

## Part 3: Image Generation Strategy

### The Problem

~40 images that need to feel like one world. ChatGPT image generation drifts in style between sessions.

### Base Style Prompt (use for EVERY image)

```
Style: Warm painterly digital illustration. Visible brush texture, not flat vector.
Lighting: Late afternoon golden light with soft shadows.
Palette: Warm ambers, deep teals, soft purples, cream highlights. Rich but not saturated.
Mood: Cozy, creative, inviting. Like a design studio you'd want to work in.
Quality: High detail, atmospheric depth, layered composition.
NOT: Photorealistic, flat vector, pixel art, neon, dark/gritty, cartoon, anime.
Characters: When present, diverse students aged 12-16 in casual clothes. Stylized (not photorealistic faces). Warm skin tones. Expressive but not exaggerated.
```

### Per-Station Accent Colors

| Station | Name | Accent Colors | Mood |
|---------|------|---------------|------|
| 0 | Identity Card | Soft golds + personal palette choice | Warm, personal |
| 1 | Campfire | Warm amber + firelight orange | Cozy, intimate |
| 2 | Workshop | Copper + deep wood brown | Hands-on, grounded |
| 3 | Collection Wall | Eclectic / varied | Curious, playful |
| 4 | Window | Blue-gold afternoon light | Reflective, outward |
| 5 | Toolkit | Practical gray-green + wood | Honest, grounded |
| 6 | Crossroads | Deep purple + golden glow from doors | Dramatic, choice |
| 7 | Launchpad | Sunrise palette (pink, gold, sky blue) | Hopeful, expansive |

### Image Asset List (by build phase)

**Phase 0 (foundations):** Kit portrait (1), studio door entry (1) = **2 images**

**Phase 1 (no-AI stations):** S0 background 2 layers (2), S1 background 2 layers (2), S3 background 2 layers (2), S5 background 2 layers (2) = **8 images**

**Phase 2 (AI-light stations):** S2 background 2 layers (2), S4 background 2 layers (2), S4 community scene (1) = **5 images**

**Phase 3 (AI-heavy stations):** S6 background 2 layers (2), S6 door designs ×3 (3), S7 background 2 layers (2), fear cards ×5 (5), Grand Reveal background (1) = **13 images**

**Phase 4 (polish):** Transition scenes ×7 (7), Kit expression variants ×4 additional (4) = **11 images**

**Total: ~39 images**

### Consistency Protocol

1. Generate Kit first — use as the style anchor
2. Generate all backgrounds in one session if possible
3. Save successful prompts — reuse exact wording
4. Use image-to-image when available — feed prior images as style references
5. Review all images in a grid — regenerate any that feel like a different artist

---

## Part 4: State Machine

### All States

```typescript
type DiscoveryState =
  | 'not_started' | 'loading' | 'completed'
  // Station 0
  | 'station_0' | 'station_0_palette' | 'station_0_tools' | 'station_0_workspace'
  // Station 1
  | 'station_1' | 'station_1_intro' | 'station_1_quickfire' | 'station_1_reflection'
  // Station 2
  | 'station_2' | 'station_2_intro' | 'station_2_story' | 'station_2_text_prompt'
  | 'station_2_scenarios' | 'station_2_people_grid' | 'station_2_reveal'
  // Station 3
  | 'station_3' | 'station_3_intro' | 'station_3_interest_grid' | 'station_3_irritation'
  | 'station_3_youtube' | 'station_3_values_sort' | 'station_3_reveal'
  // Station 4
  | 'station_4' | 'station_4_intro' | 'station_4_story' | 'station_4_scene'
  | 'station_4_zoom' | 'station_4_sliders' | 'station_4_text_prompt' | 'station_4_reveal'
  // Station 5
  | 'station_5' | 'station_5_intro' | 'station_5_time' | 'station_5_resources'
  | 'station_5_people' | 'station_5_efficacy' | 'station_5_experience'
  | 'station_5_failure' | 'station_5_audience' | 'station_5_time_horizon' | 'station_5_reveal'
  // Station 6
  | 'station_6' | 'station_6_intro' | 'station_6_generating' | 'station_6_explore_1'
  | 'station_6_explore_2' | 'station_6_explore_3' | 'station_6_custom'
  | 'station_6_fear' | 'station_6_choose'
  // Station 7
  | 'station_7' | 'station_7_intro' | 'station_7_ascent' | 'station_7_statement'
  | 'station_7_criteria' | 'station_7_excitement' | 'station_7_grand_reveal' | 'station_7_share'
  // Transitions
  | 'transition_0_1' | 'transition_1_2' | 'transition_2_3' | 'transition_3_4'
  | 'transition_4_5' | 'transition_5_6' | 'transition_6_7';
```

### Key Transition Guards

```typescript
// Can't leave S0 without all selections
station_0_workspace → transition_0_1:
  palette selected AND tools.length === 3 AND workspace.length === 4

// Can't leave S1 without all 12 pairs
station_1_quickfire → station_1_reflection:
  dimensions.length >= 12

// Can't leave S4 without 2+ scene clicks
station_4_scene → station_4_zoom:
  sceneClicks.length >= 2

// S6 doors must exist
station_6_generating → station_6_explore_1:
  doors.length === 3

// S7 statement needs 10+ words
station_7_statement → station_7_criteria:
  statement.split(/\s+/).length >= 10
```

### Auto-Save Triggers

Save `DiscoverySavePayload` to DB after:
- Every state transition
- Text prompt submission
- Card sort completion
- Slider value change (debounced 2s)
- Scene click (immediate)
- Binary pair answer (batched per round)

### Resume Logic

- Find last COMPLETED station (not mid-activity state)
- Resume at START of current incomplete station
- Kit acknowledges gap if >3 days: recap from profile-so-far
- Kit acknowledges gap if 1-3 days: brief "you were at [station]"
- Same session: "Let's continue"

---

## Part 5: Route Architecture & Migration

### Routes

```
/discovery/[unitId]    → Main shell, renders current station
```

Discovery is always in a unit context (both Mode 1 and Mode 2).

### File Structure

```
src/app/(student)/discovery/[unitId]/page.tsx     → Main shell
src/app/(student)/discovery/[unitId]/layout.tsx   → Full-bleed layout (no sidebar)

src/components/discovery/
  DiscoveryShell.tsx           → State machine host, Kit overlay, transitions
  KitMentor.tsx                → Kit face + speech bubble + expressions
  StationBackground.tsx        → Parallax layers (CSS gradient → images)
  stations/                    → One component per station (8 files)
  interactions/                → Reusable interaction components (8 types)
  reveals/                     → Reveal card components (6 + Grand Reveal)

src/hooks/
  useDiscoverySession.ts       → State management, auto-save, resume
  useDiscoveryAudio.ts         → Audio stubs

src/lib/discovery/
  state-machine.ts             → States, transitions, guards
  scoring.ts                   → Archetype scoring, behavioral composite
  profile-builder.ts           → Builds DiscoveryProfile from responses
  content/                     → Content pools (one file per station + Kit dialogue)

src/app/api/discovery/
  session/route.ts             → CRUD for discovery sessions
  reflect/route.ts             → Haiku reflections (shared)
  doors/route.ts               → Sonnet door generation
  reveal/route.ts              → Sonnet Grand Reveal
  teacher-summary/route.ts     → Haiku teacher summary (async)
```

### Migration from Old Discovery

1. **Keep old code** (`DiscoveryFlow.tsx`, `ComicPanel.tsx`) on disk — don't delete
2. **New route** (`/discovery/[unitId]`) is entirely separate
3. **Feature flag** (`NEXT_PUBLIC_ENABLE_NEW_DISCOVERY`) switches between old and new
4. **Open Studio entry** redirects to `/discovery/[unitId]` when flag is on
5. **Existing students** who completed old Discovery are treated as "complete" — no migration
6. **Mode 2 entry:** student lesson page checks `class_units.open_studio_default_mode`, redirects to `/discovery/[unitId]` instead of showing lesson content

```typescript
// Modified Open Studio entry point
function handleStartDiscovery() {
  if (process.env.NEXT_PUBLIC_ENABLE_NEW_DISCOVERY === 'true') {
    router.push(`/discovery/${unitId}`);
  } else {
    setShowDiscoveryFlow(true); // old behavior
  }
}
```

---

## Readiness Checklist

| Category | Item | Status |
|----------|------|--------|
| **Build order** | 5-phase plan with dependencies | ✅ |
| **Content** | S0 tool/item mappings | ✅ |
| **Content** | S1 binary pairs (12) | ✅ |
| **Content** | S2 scenarios (6+1 variant) | ✅ |
| **Content** | S2 people grid (10 icons) | ✅ |
| **Content** | S3 interest icons (20+3 junior) | ✅ |
| **Content** | S3 irritation scenarios (10) | ✅ |
| **Content** | S3 YouTube topics (12) | ✅ |
| **Content** | S3 value cards (8) | ✅ |
| **Content** | S4 hotspot definitions (12) | ✅ |
| **Content** | S4 text prompt variants (3) | ✅ |
| **Content** | S5 resource cards (12) | ✅ |
| **Content** | S5 people icons (6) | ✅ |
| **Content** | S5 self-efficacy sliders (7) | ✅ |
| **Content** | S5 experience + failure choices | ✅ |
| **Content** | S6 fear cards (5) | ✅ |
| **Content** | S6 template doors (18) | ✅ |
| **Content** | Kit pre-written dialogue | ✅ |
| **Images** | Base style prompt + palettes | ✅ |
| **Images** | Asset list (~39 images) | ✅ |
| **State machine** | All states + guards | ✅ |
| **State machine** | Save points + resume | ✅ |
| **Routes** | File architecture | ✅ |
| **Routes** | Migration plan + feature flag | ✅ |
| **Content** | S7 success criteria templates | ✅ |
| **Content** | Kit age-branched variants | ⚠️ Start with senior, branch later |
| **Scoring** | Archetype score normalization | ✅ |
| **Architecture** | Mode 2 redirect guard | ✅ |
| **Content** | S0 tool deduplication | ✅ |
| **Content** | Kit S2 micro-story | ✅ |

| **Responses** | Dead-end audit (19 points) | ✅ |
| **Responses** | All dead-end response specs written | ✅ |
| **Responses** | Fear card responses (critical) | ✅ |
| **Responses** | S7 excitement check full spec | ✅ |
| **Content** | Mode 1 template doors (Design) | ✅ |
| **Content** | Mode 2 template doors (Service/PP/PYPx) | ✅ |
| **Content** | Door selection logic + mode context | ✅ |
| **Scoring** | Free-text irritation AI analysis prompt | ✅ |
| **Scoring** | Irritation scoring integration + weight | ✅ |
| **Scoring** | People icon split scoring (0.7/0.3) | ✅ |
| **Scoring** | Revised station weight table | ✅ |
| **Architecture** | Teacher content control panel spec | ✅ |
| **Architecture** | Content pool override chain | ✅ |

**All blockers cleared. Ready to build.**

---

## Part 6: Gap Fills (added 26 March 2026)

These sections close every gap identified in the pre-build review.

### 6.1 Station 7: Success Criteria Templates

S7 asks the student to define what success looks like for their chosen project. The AI generates personalized criteria when available, but these templates serve as fallbacks AND as seed suggestions the student can adopt/edit.

**Per-archetype criteria (student picks 3-5, can write custom):**

```typescript
const SUCCESS_CRITERIA_TEMPLATES: Record<DesignArchetype, string[]> = {
  Maker: [
    "I built a working prototype that someone can actually use",
    "I learned a new making skill I didn't have before",
    "I tested my design with a real person and improved it based on their feedback",
    "The final version is noticeably better than my first attempt",
    "I documented my process so someone else could build it too",
    "I solved a problem that actually mattered to someone",
  ],
  Researcher: [
    "I found evidence that changed my understanding of the problem",
    "I talked to real people affected by the issue, not just read about it",
    "My research led to a specific, actionable recommendation",
    "I can explain my findings clearly to someone who knows nothing about the topic",
    "I discovered something that surprised me — not just confirmed what I already thought",
    "I connected information from multiple sources in a way nobody else has",
  ],
  Leader: [
    "I brought together a group of people who wouldn't have worked together otherwise",
    "The project continued making progress even when I wasn't pushing it",
    "I helped someone else develop a skill or confidence they didn't have",
    "I made a decision under pressure that I can defend with reasons",
    "The people involved would say the process was fair",
    "Something real changed because of what we did — not just a presentation",
  ],
  Communicator: [
    "Someone who didn't care about this issue started caring because of my work",
    "I told a true story in a way that was hard to ignore",
    "I listened to perspectives I disagreed with and represented them fairly",
    "My audience understood the message without me having to explain it",
    "I found the right medium for the message — not just the easiest one",
    "Someone told me my work made them feel something specific",
  ],
  Creative: [
    "I made something that didn't exist before — not a copy of something else",
    "I took a creative risk that scared me a little",
    "I can explain why my design choices work, not just that they look good",
    "I explored at least 3 different directions before committing to one",
    "Someone saw my work and said 'I've never seen it done that way'",
    "The final piece has a level of craft I'm proud of",
  ],
  Systems: [
    "I made something complicated easier to understand",
    "I found a pattern or connection that nobody else noticed",
    "My solution addresses the root cause, not just the symptom",
    "I can draw a diagram that explains how the system works — and where it breaks",
    "I tested my solution against edge cases, not just the obvious scenario",
    "Someone is actually using the system/process I designed",
  ],
};

// Generic criteria (always available regardless of archetype)
const GENERIC_CRITERIA: string[] = [
  "I'm proud enough to show this to someone I respect",
  "I learned something about myself through this project",
  "I managed my time well enough to finish without a last-minute panic",
  "I asked for help when I needed it instead of struggling alone",
  "I can point to a specific moment where the project got better because I iterated",
];
```

**How S7 uses these:**
1. Load archetype-specific templates for the student's primary archetype
2. Add 2-3 from their secondary archetype (if exists)
3. Always include the 5 generic criteria
4. Student sees a scrollable list of ~13-16 suggestions, picks 3-5 OR writes custom
5. AI (Haiku) can generate 1-2 personalized criteria based on the full profile — these appear at the top, marked with a ✨ sparkle icon
6. Final `success_criteria` array stored on `DiscoveryProfile.commitment.success_criteria`

---

### 6.2 Archetype Score Normalization

**The problem:** Stations contribute archetype signals at different scales and volumes:
- S0 tools: 3 tools × 0-3 weight each = max 9 per archetype
- S0 workspace: 4 items → binary trait signals (not direct archetype scores)
- S2 scenarios: 6 scenarios × 0-3 weight each = max 18 per archetype
- S2 "people come to you for": 2-3 picks × 1.5× weight = max 4.5 per archetype
- S3 interests: cluster mapping (indirect — interest icons map to clusters, clusters weakly correlate to archetypes)
- S5 self-efficacy: 7 sliders × 0-100 (domain confidence, not archetype)

**Design principle:** Normalize per-station, weight by signal quality, then composite.

```typescript
type DesignArchetype = 'Maker' | 'Researcher' | 'Leader' | 'Communicator' | 'Creative' | 'Systems';

interface StationArchetypeSignal {
  station: number;
  raw: Record<DesignArchetype, number>;   // Raw score from this station
  maxPossible: number;                     // Maximum achievable score from this station
  signalQuality: number;                   // 0-1, how reliable this station's signal is
}

/**
 * Normalize and composite archetype scores from all stations.
 *
 * Strategy: Per-station percentage normalization → weighted average → 0-100 scale.
 *
 * Why not just sum raw scores?
 * - S2 scenarios can produce max 18 per archetype; S0 tools max 9.
 * - A student who's strongly Maker in S0 but mixed in S2 shouldn't have
 *   their S0 signal drowned out by higher-volume S2 data.
 * - Normalizing each station to 0-1 first means every station gets its
 *   configured voice in the composite.
 *
 * Signal quality weights (tunable):
 * - S2 scenarios (0.35) — highest: behavioral responses to realistic situations
 * - S2 "people come to you for" (0.25) — external validation, very reliable
 * - S0 tools (0.20) — intentional self-expression, moderate reliability
 * - S3 interest clusters (0.10) — indirect signal, interests ≠ archetype
 * - S5 self-efficacy (0.10) — domain confidence, loosely correlated
 *
 * S0 workspace items contribute to WORKING STYLE, not archetype scoring.
 * S4 (community scene) contributes to EMPATHY/PROBLEM data, not archetypes.
 */

const STATION_WEIGHTS: Record<string, number> = {
  s0_tools:      0.20,  // Intentional identity expression
  s2_scenarios:  0.35,  // Behavioral — most reliable
  s2_people:     0.25,  // External validation — second most reliable
  s3_interests:  0.10,  // Indirect cluster correlation
  s5_efficacy:   0.10,  // Self-assessed confidence
};

function normalizeArchetypeScores(signals: StationArchetypeSignal[]): Record<DesignArchetype, number> {
  const archetypes: DesignArchetype[] = ['Maker', 'Researcher', 'Leader', 'Communicator', 'Creative', 'Systems'];
  const composite: Record<DesignArchetype, number> = {} as any;

  for (const arch of archetypes) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const signal of signals) {
      if (signal.maxPossible === 0) continue; // Station didn't produce data for this archetype

      // Normalize this station's score to 0-1
      const normalized = signal.raw[arch] / signal.maxPossible;

      // Weight by signal quality
      weightedSum += normalized * signal.signalQuality;
      totalWeight += signal.signalQuality;
    }

    // Scale to 0-100
    composite[arch] = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
  }

  return composite;
}

/**
 * Determine primary and secondary archetypes.
 *
 * Secondary must be at least 60% of primary's score to qualify.
 * If the top 3 archetypes are within 15 points of each other,
 * the student is a "polymath" — no single dominant archetype.
 */
function computeArchetypeResult(scores: Record<DesignArchetype, number>): {
  primary: DesignArchetype;
  secondary: DesignArchetype | null;
  isPolymath: boolean;
} {
  const sorted = Object.entries(scores)
    .sort(([, a], [, b]) => b - a) as [DesignArchetype, number][];

  const [primary, primaryScore] = sorted[0];
  const [second, secondScore] = sorted[1];
  const [third, thirdScore] = sorted[2];

  // Polymath: top 3 within 15 points
  const isPolymath = (primaryScore - thirdScore) <= 15;

  // Secondary: must be at least 60% of primary
  const secondary = secondScore >= primaryScore * 0.6 ? second : null;

  return { primary, secondary, isPolymath };
}

/**
 * Build the station signals from collected data.
 * Called after each station completes, so partial composites are available.
 */

// S0: Sum tool weights per archetype
function buildS0Signal(selectedTools: string[]): StationArchetypeSignal {
  const raw: Record<DesignArchetype, number> = { Maker: 0, Researcher: 0, Leader: 0, Communicator: 0, Creative: 0, Systems: 0 };
  for (const toolId of selectedTools) {
    const weights = TOOL_ARCHETYPE_MAP[toolId]; // from content pool
    for (const [arch, weight] of Object.entries(weights)) {
      raw[arch as DesignArchetype] += weight;
    }
  }
  return {
    station: 0,
    raw,
    maxPossible: 9, // 3 tools × max 3 weight each
    signalQuality: STATION_WEIGHTS.s0_tools,
  };
}

// S2 scenarios: Sum chosen option weights
function buildS2ScenarioSignal(scenarioChoices: { scenarioId: string; optionId: string }[]): StationArchetypeSignal {
  const raw: Record<DesignArchetype, number> = { Maker: 0, Researcher: 0, Leader: 0, Communicator: 0, Creative: 0, Systems: 0 };
  for (const choice of scenarioChoices) {
    const scenario = SCENARIOS[choice.scenarioId];
    const option = scenario.options[choice.optionId];
    for (const [arch, weight] of Object.entries(option.archetypeWeights)) {
      raw[arch as DesignArchetype] += weight;
    }
  }
  return {
    station: 2,
    raw,
    maxPossible: 18, // 6 scenarios × max 3 weight
    signalQuality: STATION_WEIGHTS.s2_scenarios,
  };
}

// S2 "people come to you for": External validation (1.5× multiplier baked into signalQuality)
function buildS2PeopleSignal(selectedIcons: string[]): StationArchetypeSignal {
  const raw: Record<DesignArchetype, number> = { Maker: 0, Researcher: 0, Leader: 0, Communicator: 0, Creative: 0, Systems: 0 };
  for (const iconId of selectedIcons) {
    const signal = PEOPLE_ICONS[iconId];
    for (const arch of signal.archetypes) {
      raw[arch] += 1;
    }
  }
  return {
    station: 2,
    raw,
    maxPossible: 3, // 3 picks × 1 signal each
    signalQuality: STATION_WEIGHTS.s2_people,
  };
}

// S3 interests: Map selected icons to clusters, then clusters to weak archetype signals
function buildS3Signal(selectedInterests: string[]): StationArchetypeSignal {
  const raw: Record<DesignArchetype, number> = { Maker: 0, Researcher: 0, Leader: 0, Communicator: 0, Creative: 0, Systems: 0 };
  for (const interestId of selectedInterests) {
    const icon = INTEREST_ICONS[interestId];
    // Each cluster has a weak archetype correlation
    const archCorrelation = CLUSTER_ARCHETYPE_MAP[icon.cluster]; // e.g., "Physical creation" → { Maker: 0.5 }
    for (const [arch, weight] of Object.entries(archCorrelation)) {
      raw[arch as DesignArchetype] += weight;
    }
  }
  return {
    station: 3,
    raw,
    maxPossible: 3.5, // 7 picks × max 0.5 correlation weight
    signalQuality: STATION_WEIGHTS.s3_interests,
  };
}

// S5 self-efficacy: Map domain confidence to archetype correlation
function buildS5Signal(efficacy: Record<string, number>): StationArchetypeSignal {
  // Domain → archetype mapping
  const EFFICACY_ARCHETYPE: Record<string, Partial<Record<DesignArchetype, number>>> = {
    making_hands:    { Maker: 1.0 },
    sketching:       { Creative: 0.7, Maker: 0.3 },
    researching:     { Researcher: 1.0 },
    presenting:      { Communicator: 0.7, Leader: 0.3 },
    writing:         { Communicator: 0.7, Researcher: 0.3 },
    collaborating:   { Leader: 0.5, Communicator: 0.5 },
    ideas:           { Creative: 1.0 },
  };

  const raw: Record<DesignArchetype, number> = { Maker: 0, Researcher: 0, Leader: 0, Communicator: 0, Creative: 0, Systems: 0 };
  for (const [domain, score] of Object.entries(efficacy)) {
    const mapping = EFFICACY_ARCHETYPE[domain];
    if (!mapping) continue;
    const normalizedScore = score / 100; // 0-1
    for (const [arch, weight] of Object.entries(mapping)) {
      raw[arch as DesignArchetype] += normalizedScore * weight;
    }
  }
  return {
    station: 5,
    raw,
    maxPossible: 1.0, // Max is 1.0 (one domain at 100% with 1.0 weight)
    signalQuality: STATION_WEIGHTS.s5_efficacy,
  };
}
```

**Tuning notes:**
- The `STATION_WEIGHTS` object is the main tuning knob. After testing with real students, Matt can adjust these weights based on which signals produce the most accurate archetype assignments.
- `isPolymath` threshold (15 points) may need adjustment — too tight means every student is a polymath, too loose means nobody is.
- Secondary archetype threshold (60% of primary) may also need tuning.
- The `CLUSTER_ARCHETYPE_MAP` defined below. Weak signals (0.3-0.5) since interest ≠ ability. Tune after testing.

```typescript
// Interest cluster → weak archetype correlation
// These are HINTS, not proof. A kid who likes cooking isn't necessarily a Maker.
const CLUSTER_ARCHETYPE_MAP: Record<string, Partial<Record<DesignArchetype, number>>> = {
  'Physical creation':     { Maker: 0.5, Creative: 0.2 },
  'Creative expression':   { Creative: 0.5, Communicator: 0.2 },
  'Physical':              { Maker: 0.3 },
  'Environment':           { Researcher: 0.3, Systems: 0.2 },
  'Technology':            { Systems: 0.4, Maker: 0.2 },
  'Communication':         { Communicator: 0.5 },
  'Research':              { Researcher: 0.5 },
  'Exploration':           { Researcher: 0.3, Creative: 0.2 },
  'Values':                { Leader: 0.3, Communicator: 0.2 },
  'Systems / Creative':    { Systems: 0.3, Creative: 0.3 },
  'Research / Communication': { Researcher: 0.3, Communicator: 0.3 },
  'Technology / Creative': { Systems: 0.2, Creative: 0.3, Maker: 0.2 },
  'Research / Systems':    { Researcher: 0.3, Systems: 0.3 },
  'Technology / Making':   { Maker: 0.4, Systems: 0.3 },
  'Values / Environment':  { Leader: 0.2, Researcher: 0.2 },
};
```

---

### 6.3 Mode 2 Redirect Guard (Student Lesson Page)

**The problem:** Mode 2 units (Service, PP, PYPx) default to Open Studio from day one. The student lesson page currently shows lesson content. For Mode 2 units, it should redirect to Discovery (if not completed) or Open Studio (if completed).

**Where the guard lives:** `src/app/(student)/unit/[unitId]/[pageId]/page.tsx` — the student lesson page. NOT in middleware (too expensive to run DB queries on every request).

```typescript
// src/app/(student)/unit/[unitId]/[pageId]/page.tsx
// Add this BEFORE the existing content rendering logic

// 1. Check if this unit-class combo is Mode 2 (Open Studio default)
const classUnit = await supabase
  .from('class_units')
  .select('open_studio_default_mode')
  .eq('unit_id', unitId)
  .eq('class_id', studentClassId)
  .maybeSingle();

const isMode2 = classUnit?.data?.open_studio_default_mode === 'open_studio_default';

if (isMode2) {
  // 2. Check if Discovery is completed
  const discoverySession = await supabase
    .from('discovery_sessions')
    .select('status')
    .eq('student_id', studentId)
    .eq('unit_id', unitId)
    .maybeSingle();

  const discoveryComplete = discoverySession?.data?.status === 'completed';

  if (!discoveryComplete) {
    // 3a. Discovery not done → redirect to Discovery
    redirect(`/discovery/${unitId}`);
  } else {
    // 3b. Discovery done → redirect to Open Studio
    redirect(`/open-studio/${unitId}`);
  }
  // Student NEVER sees the lesson page for Mode 2 units
}

// If we get here, it's Mode 1 (normal) — render lesson content as usual
```

**What about the student dashboard?** The unit card's "Continue" button needs the same logic:

```typescript
// src/app/(student)/dashboard/page.tsx (inside unit card rendering)

function getUnitContinueUrl(unit: UnitWithProgress): string {
  if (unit.open_studio_default_mode === 'open_studio_default') {
    // Mode 2: go to Discovery or Open Studio
    return unit.discovery_completed
      ? `/open-studio/${unit.id}`
      : `/discovery/${unit.id}`;
  }
  // Mode 1: go to current lesson page
  return `/unit/${unit.id}/${unit.current_page_id || 'narrative'}`;
}
```

**What the student units API needs to return:**

```typescript
// src/app/api/student/units/route.ts — add to the query/response
// For each unit, include:
{
  open_studio_default_mode: classUnit.open_studio_default_mode || 'teacher_directed',
  discovery_completed: discoverySession?.status === 'completed' || false,
}
```

**What about the narrative page?** Same guard needed on `src/app/(student)/unit/[unitId]/narrative/page.tsx` — Mode 2 units don't have a narrative, so redirect there too.

**Migration needed:** Add `open_studio_default_mode TEXT DEFAULT 'teacher_directed'` to `class_units` table. This is a single `ALTER TABLE` — can go in the same migration as the `discovery_sessions` table.

```sql
-- In the discovery_sessions migration
ALTER TABLE class_units
ADD COLUMN IF NOT EXISTS open_studio_default_mode TEXT DEFAULT 'teacher_directed'
CHECK (open_studio_default_mode IN ('teacher_directed', 'open_studio_default'));
```

**Teacher sets Mode 2:** On the Class Hub Overview tab (`/teacher/units/[unitId]/class/[classId]`), add a toggle: "Unit Mode: Lesson-First (default) / Open Studio from Day One". Saving PATCHes `class_units.open_studio_default_mode`.

**Edge cases:**
- Student enrolled in two classes for same unit, one Mode 1 and one Mode 2 → the guard checks the specific `class_id` from the student's enrollment, not the unit globally.
- Teacher switches Mode 2 → Mode 1 after students started Discovery → students who completed Discovery can still access Open Studio; students mid-Discovery see lesson content (Discovery progress preserved but not required).
- Teacher switches Mode 1 → Mode 2 after students started lessons → students with lesson progress are redirected to Discovery; their lesson progress is preserved in `student_progress` for if the teacher switches back.

---

### 6.4 Revised S0 Tool Mapping (Deduplicated Signals)

The original mapping had several tools with identical archetype signatures (Hammer ≡ Scissors, Magnifying glass ≡ Microscope). Every tool should produce a unique archetype fingerprint.

```typescript
const TOOL_ARCHETYPE_MAP: Record<string, Record<DesignArchetype, number>> = {
  // Pure signals (one dominant archetype)
  hammer:           { Maker: 3, Researcher: 0, Leader: 0, Communicator: 0, Creative: 0, Systems: 0 },
  magnifying_glass: { Maker: 0, Researcher: 3, Leader: 0, Communicator: 0, Creative: 0, Systems: 0 },
  clipboard:        { Maker: 0, Researcher: 0, Leader: 3, Communicator: 0, Creative: 0, Systems: 1 },
  megaphone:        { Maker: 0, Researcher: 0, Leader: 1, Communicator: 3, Creative: 0, Systems: 0 },
  paintbrush:       { Maker: 0, Researcher: 0, Leader: 0, Communicator: 0, Creative: 3, Systems: 0 },
  gear:             { Maker: 0, Researcher: 0, Leader: 0, Communicator: 0, Creative: 0, Systems: 3 },

  // Hybrid signals (two archetypes)
  pencil:           { Maker: 1, Researcher: 0, Leader: 0, Communicator: 2, Creative: 1, Systems: 0 },
  microscope:       { Maker: 0, Researcher: 2, Leader: 0, Communicator: 0, Creative: 0, Systems: 2 },
  camera:           { Maker: 0, Researcher: 1, Leader: 0, Communicator: 2, Creative: 1, Systems: 0 },
  laptop:           { Maker: 0, Researcher: 1, Leader: 0, Communicator: 1, Creative: 0, Systems: 2 },
  scissors:         { Maker: 2, Researcher: 0, Leader: 0, Communicator: 0, Creative: 2, Systems: 0 },
  compass_drawing:  { Maker: 1, Researcher: 0, Leader: 0, Communicator: 0, Creative: 0, Systems: 3 },
};
```

**What changed:**
- `magnifying_glass` → pure Researcher (was R3,S1). Now distinct from `microscope` (R2,S2 — research + systems).
- `paintbrush` → pure Creative (was M1,C1,Cr3). Now distinct from `pencil` (M1,Co2,Cr1).
- `scissors` → Maker+Creative split (was M3,Cr1 — identical to hammer). Now Maker and Creative get equal signal, distinguishing "cutting/crafting" from "building/constructing" (hammer).
- `compass_drawing` → Maker+Systems (was M1,Cr1,S2). Now heavier Systems signal with a touch of Maker — precision instruments are about systems thinking.
- `gear` → pure Systems (was M1,R1,S3). Cleaner signal.
- `camera` → Communicator-primary + Research secondary (was M1,R1,Co1,Cr2). Cameras are documentation and storytelling tools.
- `laptop` → Systems+Research+Communication split (was R1,Co1,Cr1,S2). Digital tools are primarily systems.

**Uniqueness check:** No two tools now have the same archetype fingerprint. A student who picks {hammer, scissors, pencil} gets a different composite than {hammer, paintbrush, pencil}.

---

### 6.5 Kit's Workshop Story (Station 2)

Kit needs a real micro-story for the S2 intro — a personal failure that makes Kit feel human before asking students to reveal their own patterns.

**Kit's S2 intro (replaces the one-liner):**

```typescript
const KIT_S2_INTRO = {
  mode_1: `Welcome to my workshop. See that shelf up there — the one with the dust?
That's where I keep The Chair. Capital T, Capital C.

It was supposed to be my masterpiece. I spent three weeks on the design —
perfect angles, beautiful joints, reclaimed timber. I was so proud of the plan
that I skipped testing whether anyone actually needed a new chair.

Turns out, they didn't. The school already had chairs. What they needed was
somewhere to put their bags. Three weeks of work, and the answer was a hook.

That's the thing about design — sometimes the best maker in the room is the
worst at seeing the actual problem. I had to learn that the hard way.

Now — let me find out what kind of designer YOU are. Not what you think you
should be. What you actually do when things get real.`,

  mode_2: `This is my workshop. Everything in here has a story — mostly stories
about getting it wrong first.

See that shelf? That's where I keep The Chair. Three weeks I spent on it.
Perfect design. Beautiful joints. Only problem — nobody needed a chair.
They needed a hook for their bags. Three weeks for a hook.

That's when I learned: the best maker in the room can still miss the real
problem entirely.

Before you start your project, I want to figure out how you work — not who
you think you should be, but what you actually do when things get messy.`,
};
```

**Why this story works:**
- Kit admits failure (vulnerability before asking vulnerability)
- The failure is specific and visual (students can picture The Chair on the shelf)
- It teaches a real design lesson (solution before problem identification)
- It transitions naturally to "let me find out what kind of designer YOU are"
- It's short enough to read in 20 seconds but memorable enough to reference later
- Kit can reference "The Chair" throughout the journey as a running callback ("remember The Chair — don't let your project become a chair")

---

## Part 7: Future — Group Work & Team Dynamics (Phase 2/3)

*Not built now. Captured here so the Discovery data model doesn't need retrofitting later.*

### Why This Matters

Service as Learning, Personal Project, and PYPx units are often group projects. Even Design units have collaborative tasks. The Discovery profile already captures 80% of the data needed for intelligent team formation — archetype, working style, collaboration style (Assert/Negotiate/Defer/Fork-and-merge), social preference, self-efficacy per domain, failure response. The missing piece is how to USE that data across multiple students.

### Three Layers (build in order)

**Layer 1 — Smart Team Formation (~3 days)**
Teacher creates groups manually OR uses AI-suggested optimal grouping. Algorithm optimizes for:
- **Archetype diversity** — best teams cover different domains (Maker + Researcher + Communicator > Maker + Maker + Maker)
- **Collaboration style balance** — mix of Assert + Negotiate + Defer is healthy; all-Assert = conflict, all-Defer = no leadership
- **Confidence spread** — similar average self-efficacy prevents dominance/disengagement
- **Working rhythm compatibility** — deep-focus + burst workers can clash; flag but don't block

Teacher sees warnings ("this group has no Researcher", "two Assert styles — potential friction"). Teacher always has final say — algorithm suggests, human decides.

Data model: `project_teams` table (team_id, unit_id, class_id, members JSONB, formed_by, created_at). No changes to `DiscoveryProfile`.

**Layer 2 — Team Awareness (~2 days)**
Each team member sees a "Team Profile" card:
- Who's on the team + their primary archetypes (with consent/privacy controls)
- Team superpower ("your team has strong research AND making — you can investigate deeply and prototype fast")
- Team blind spot ("nobody on your team is a natural Communicator — who'll present your work?")
- Working style preferences visible to teammates ("Alex works best in short bursts, Sam needs long focus blocks")

This creates self-awareness and negotiation without forcing roles. Students discuss and self-organise based on real data.

**Layer 3 — Group Dynamics & Progress (~5-7 days)**
Track contributions per team member. Detect imbalances (one person doing everything). Surface friction patterns. Team check-ins replace individual check-ins. Design Assistant knows team context and can mediate ("I notice you and Sam chose different directions — have you talked about it?").

Depends on Layer 1 + 2 being stable.

### Architecture Decision: Computed, Not Stored

Team compatibility is **computed from existing profile data**, not a new property of a profile. The `DiscoveryProfile` interface needs zero changes. The grouping algorithm reads profiles at team-formation time and scores combinations.

```typescript
interface TeamCompatibilityScore {
  skillCoverage: number;        // Unique primary archetypes / team size (0-1, higher = more diverse)
  collaborationBalance: number; // Mix of Assert/Negotiate/Defer styles (0-1, higher = healthier)
  confidenceSpread: number;     // 1 - (stddev of avg self-efficacy / 50) (0-1, higher = more balanced)
  workingStyleFit: number;      // Compatible energy/pace/structure prefs (0-1, higher = fewer conflicts)
  overall: number;              // Weighted composite
}
```

### One Data Model Note for Discovery Build

The Discovery session API should return profile data in a format that's easy to query across multiple students. If profiles are stored as JSONB on `discovery_sessions`, ensure the key fields used by the grouping algorithm (`archetype.primary`, `archetype.scores`, `working_style.dimensions`, `collaboration_style`, average `self_efficacy`) are either:
- (a) Extracted into indexed columns on the table, OR
- (b) Queryable via a Postgres view/function that flattens the JSONB

This avoids a retrofit when Layer 1 needs to run `SELECT * FROM discovery_profiles WHERE class_id = X` and score every combination.

### What's NOT Needed in Discovery v1

- No "who would you want on your team" question — creates social dynamics problems in a class of 25
- No explicit role assignment during Discovery — roles emerge from team awareness, not top-down labelling
- No group Discovery sessions — each student does Discovery individually, team formation happens after
- No scheduling/availability data in Discovery — that's runtime data (changes per project), collected at team formation time

---

## Part 8: Dead-End Audit & Response Specs (added 26 March 2026)

A "dead end" is any place where a student gives meaningful input and gets silence back. In a real mentoring conversation, this would be rude. In Discovery, it breaks the illusion that Kit is paying attention. Every data point either needs a Kit response (template for deterministic inputs, Haiku for free-text) or must be deliberately flagged as "fast-pass" (quick-fire pacing where response would slow things down).

### 8.1 Complete Dead-End Inventory

19 dead ends found across all 8 stations. Severity ratings: Critical (student is emotionally vulnerable, silence is harmful), High (meaningful input ignored), Medium (missed opportunity for connection), Low (nice-to-have).

| # | Station | Data Point | Current State | Severity | Fix Type |
|---|---------|-----------|---------------|----------|----------|
| 1 | S1 | Balanced vector with no specific pair refs | Generic "you went back and forth" | Low | Template enhancement |
| 2 | S2 | Panic scenario text prompt | No response | **High** | Haiku response |
| 3 | S2 | Per-scenario transitions | Silent progression | Medium | 6 Kit one-liners |
| 4 | S2 | "People come to you for" selection | No acknowledgment | Medium | Kit template |
| 5 | S3 | Irritation scenario selection | No response | **High** | Kit cluster responses |
| 6 | S3 | Free-text irritation (write own) | No response | **Critical** | Haiku analysis + Kit |
| 7 | S3 | YouTube topic selection | No acknowledgment | Medium | Kit template |
| 8 | S3 | Value card sort completion | No reflection | **High** | Kit template |
| 9 | S4 | Scale/urgency/proximity sliders | No reaction | Medium | Kit template |
| 10 | S4 | Problem text prompt | No caring response | **High** | Haiku response |
| 11 | S5 | Resource card sort | No summary | Medium | Kit template |
| 12 | S5 | People icons selection | No acknowledgment | Medium | Kit template |
| 13 | S5 | Past projects selection | No response | Medium | Kit per-option |
| 14 | S5 | Failure response selection | No response | Medium | Kit per-option |
| 15 | S5 | Audience selection | No response | Low | Kit brief |
| 16 | S6 | Fear card selection | No caring response | **Critical** | Kit per-fear |
| 17 | S7 | Success criteria selection | No acknowledgment | Low | Kit brief |
| 18 | S7 | Excitement check interaction | Not specced at all | **High** | Full spec |
| 19 | S1 | Balanced vector — no specific pair tension refs | Covered but generic | Low | Template improvement |

**AI call impact:** Fixes add ~3 Haiku calls (S2 panic text, S3 irritation text, S4 problem text). All other fixes are deterministic templates. Revised budget: ~22-23 calls per student (~$0.10).

### 8.2 All Dead-End Response Specs

---

#### S1: Balanced Vector Enhancement

The existing `balanced` template is generic. When Kit says "you went back and forth," it should reference 1-2 specific pairs where the student's choice contradicts their overall pattern.

```typescript
function buildBalancedReflection(vector: WorkingStyleVector, answers: BinaryAnswer[]): string {
  // Find "surprise" answers — choices that go against the dominant pattern
  const dominantStyle = computeDominantStyle(vector);
  const surprises = answers.filter(a => {
    // E.g., a student who's mostly "planner" but picked "grab a pencil and start sketching"
    if (dominantStyle === 'planner' && a.dimension === 'planning' && a.value === 'a') return true;
    if (dominantStyle === 'doer' && a.dimension === 'pace' && a.value === 'a') return true;
    // ... similar logic for other contradictions
    return false;
  });

  if (surprises.length === 0) {
    return QUICK_FIRE_REFLECTIONS.balanced; // Fallback to existing
  }

  // Reference the specific contradiction
  const s = surprises[0];
  return `Interesting — you went back and forth on a lot of those. But here's what caught me: on most things you're a ${dominantStyle}, but when it came to "${s.prompt}" you went the other way. That's not inconsistency — that's context awareness. You read the situation and adjust. That's actually harder than just having one mode.`;
}
```

---

#### S2: Panic Scenario Text Response

Student writes their first free-text response about a crisis situation. This MUST get a response — it's the first time they've typed something personal.

**Haiku prompt:**

```typescript
const S2_PANIC_RESPONSE_PROMPT = `You are Kit, a design mentor. A student just answered a question about what they do when a project is falling apart.

Their response: "{studentText}"

Their working style from Station 1: {dominantStyle} ({vector summary}).

Write a 1-2 sentence response that:
1. Acknowledges what they said WITHOUT praising it ("Interesting" not "Great answer!")
2. Names the strategy they described (e.g., "That's a pivot instinct" or "You go to people first")
3. Connects it to their working style if there's a pattern ("Makes sense for someone who [working style trait]")

Voice: Smart older cousin. Contractions. Never say "Great!" or "Well done!" Never start with "I".
Max 40 words.

Return JSON: { "response": "..." }`;
```

**Fallback templates (if Haiku fails):**

```typescript
const S2_PANIC_FALLBACKS: Record<string, string> = {
  action_oriented: "Straight to doing. You didn't even think about stepping back first — that's instinct, not planning.",
  people_oriented: "You went to people. That's not weakness — that's knowing where the answers actually are.",
  analytical: "You want to understand before you act. Most people skip that step when they're panicking.",
  emotional: "Honest response. Most people pretend they'd be calm. The fact that you're not pretending tells me something.",
  default: "That's a real answer. I can work with that.",
};
```

---

#### S2: Per-Scenario Micro-Reactions

Not per-option (that'd be 36+ lines). Per-scenario — Kit reacts to the TYPE of choice made, keeping quick-fire pacing.

```typescript
const SCENARIO_MICRO_REACTIONS: Record<string, Record<string, string>> = {
  "2.1_group_crisis": {
    Maker: "Backup plan. Quiet. Smart.",
    Leader: "Straight to the meeting room.",
    Researcher: "Data first. I respect that.",
    Creative: "Three sketches in twenty minutes — that's your move.",
    Communicator: "One-on-ones. You want the real story.",
    Systems: "Triage. Fix what's broken, leave what's working.",
  },
  "2.2_free_period": {
    Maker: "Hands-on. Immediately.",
    Researcher: "Laptop open. Research mode.",
    Leader: "Straight to coordination.",
    Creative: "Sketchbook out. No judgement.",
    Communicator: "Went to the user. Good instinct.",
    Systems: "Efficiency mode. Classic.",
  },
  "2.3_feedback_crunch": {
    Maker: "Rebuild from scratch. Bold.",
    Researcher: "Looking at examples. Smart.",
    Communicator: "Asking three people. Quick data.",
    Creative: "Five alternatives in twenty minutes. Wild.",
    Systems: "Find the weakest link. Surgical.",
  },
  "2.4_someone_needs_help": {
    Maker: "Hands-on help. Sitting down together.",
    Researcher: "Break it down. Find resources.",
    Leader: "Build a support group. Nobody alone.",
    Creative: "Share your tricks.",
    Communicator: "Listen first. That's rare.",
    Systems: "Find where it went off track.",
  },
  "2.5_disagreement": {
    Assert: "Make your case. Direct.",
    Negotiate: "Find the overlap. Diplomat.",
    Defer: "Step back. Play the long game.",
    "Fork-and-merge": "Split up and compare. Scientist's approach.",
  },
  "2.6_ambiguity": {
    Maker: "Straight to building. Love it.",
    Researcher: "Research first. Thorough.",
    Systems: "Clarifying questions. You want the rules.",
    Communicator: "Talk to actual community members. Smart.",
    Creative: "Mind map. Finding your way in.",
  },
};
```

**Display:** Brief text that slides in below the scenario card after selection, visible for 2 seconds, then fades as the next scenario loads. NOT a modal or speech bubble — that'd break quick-fire pacing. Think "subtitle flash."

---

#### S2: "People Come to You For" Acknowledgment

```typescript
function buildPeopleReaction(selectedIcons: string[]): string {
  if (selectedIcons.length === 1) {
    const label = PEOPLE_ICONS[selectedIcons[0]].label.toLowerCase();
    return `One thing. ${label}. When people know exactly what you're for, that's a reputation worth having.`;
  }

  const labels = selectedIcons.map(id => PEOPLE_ICONS[id].label.toLowerCase());

  // Check for interesting combinations
  const hasMaking = selectedIcons.some(id => ['fixing', 'tech_help'].includes(id));
  const hasPeople = selectedIcons.some(id => ['explaining', 'settling', 'feel_better'].includes(id));
  const hasThinking = selectedIcons.some(id => ['ideas', 'figuring_out', 'finding_out'].includes(id));

  if (hasMaking && hasPeople) {
    return `People come to you to ${labels[0]} and ${labels[1]}. That's someone who doesn't just solve problems — you make sure people understand the solution.`;
  }
  if (hasThinking && hasMaking) {
    return `${labels.join(' and ')}. You think AND you build. That's a rare combination.`;
  }
  if (hasPeople && hasThinking) {
    return `${labels.join(' and ')}. You understand things and help others understand them too. That's powerful.`;
  }

  return `People come to you for ${labels.join(' and ')}. That's not something you chose — it's what others see in you. Pay attention to that.`;
}
```

---

#### S3: Irritation Scenario Selection Response

Responses grouped by problem cluster, not individual scenario. Student picks 1-2 scenarios; Kit responds to the cluster pattern.

```typescript
const IRRITATION_CLUSTER_RESPONSES: Record<string, string> = {
  environmental_systems: "You notice the stuff everyone else walks past. The full bin, the confusing app, the thing that should take 2 minutes but takes 20. That's a systems eye. You see how things SHOULD work — and it bothers you when they don't.",
  autonomy_agency: "You picked the ones about control — about decisions being made for you, or creativity being boxed in. That's not just frustration. That's someone who needs ownership. Your project has to be YOURS, or it won't mean anything.",
  social_fairness: "The ones that got you were about people. Who gets heard, who gets picked, who gets left out. You're tuned into social dynamics in a way most people your age aren't. That's an empathy signal.",
  systems_efficiency: "You see broken systems. The thing that should work but doesn't, the rule that protects some people but not others. You're a pattern-spotter — you see how things connect and where they fail.",
};

function getIrritationCluster(selectedIds: string[]): string {
  // Map scenario IDs to clusters
  const clusters = selectedIds.map(id => IRRITATION_SCENARIOS[id].cluster);
  if (clusters.includes('Environmental') || clusters.includes('Design')) return 'environmental_systems';
  if (clusters.includes('Autonomy')) return 'autonomy_agency';
  if (clusters.includes('Social') || clusters.includes('Fairness')) return 'social_fairness';
  return 'systems_efficiency';
}
```

---

#### S3: Free-Text Irritation AI Analysis (CRITICAL — #4 from Matt)

When a student writes their own irritation, this is gold-tier data. It's emotional, genuine, self-generated — and it needs both analysis AND a caring response.

**Haiku analysis prompt:**

```typescript
const IRRITATION_ANALYSIS_PROMPT = `You are analysing a student's self-written frustration for a design profiling system. The student was asked "What genuinely irritates you?" after seeing examples like "When the school app is so confusing it's faster to ask someone" and "When adults make decisions about you without asking."

Student wrote: "{studentText}"

Analyse this text and return JSON:

{
  "problem_domain": "one of: environmental, social, systemic, personal, technological, educational, creative, accessibility",
  "emotional_intensity": "low | medium | high",
  "scope": "personal | school | community | global",
  "archetype_signals": {
    "Maker": 0-3,       // Mentions building, fixing, creating physical solutions
    "Researcher": 0-3,  // Mentions investigating, understanding why, evidence
    "Leader": 0-3,      // Mentions organizing people, fairness, decision-making
    "Communicator": 0-3, // Mentions being heard, telling stories, explaining
    "Creative": 0-3,    // Mentions design, aesthetics, originality, expression
    "Systems": 0-3      // Mentions efficiency, patterns, how things connect
  },
  "interest_signals": ["string array of 1-3 interest areas this connects to"],
  "kit_response": "1-2 sentence caring response in Kit's voice (smart older cousin, not teacher). Reference what they wrote specifically. Name the emotion underneath. Connect it to potential project direction without being prescriptive. Max 50 words.",
  "summary_tag": "3-5 word label for this irritation (e.g., 'broken accessibility', 'voice not heard', 'wasted potential')"
}

IMPORTANT: The kit_response must feel like Kit genuinely heard them. Not "That's valid" — more like "Yeah, that would drive me crazy too. You know what's underneath that? You think [insight]."
Do NOT praise the student. Do NOT say "Great observation." Kit is real, not encouraging.`;
```

**Scoring integration:**

```typescript
interface IrritationAnalysis {
  problem_domain: string;
  emotional_intensity: 'low' | 'medium' | 'high';
  scope: string;
  archetype_signals: Record<DesignArchetype, number>;
  interest_signals: string[];
  kit_response: string;
  summary_tag: string;
}

// Build a station signal from AI analysis
function buildIrritationSignal(analysis: IrritationAnalysis): StationArchetypeSignal {
  return {
    station: 3,
    raw: analysis.archetype_signals,
    maxPossible: 3,
    signalQuality: 0.30,  // HIGH weight — self-generated emotional data is very reliable
  };
}
```

**Where this fits in scoring:**

Add to `STATION_WEIGHTS`:

```typescript
const STATION_WEIGHTS: Record<string, number> = {
  s0_tools:         0.15,  // Adjusted down from 0.20
  s2_scenarios:     0.30,  // Adjusted down from 0.35
  s2_people:        0.20,  // Adjusted down from 0.25
  s3_interests:     0.05,  // Adjusted down from 0.10
  s3_irritation:    0.15,  // NEW — free-text irritation analysis (high-quality self-generated signal)
  s5_efficacy:      0.05,  // Adjusted down from 0.10
  // Also fed into S4 problem space seeding, not directly into archetype scoring
};
// Weights still sum to ~0.90 — the remaining 0.10 is reserved for the irritation
// SCENARIO selection signal (pre-written options, lower quality than free-text)
```

**If student doesn't write their own (just picks from list):** No Haiku call. Use the irritation cluster response from §8.2 S3 section. The `s3_irritation` weight drops to 0.05 (pre-written scenario signals are less reliable than self-authored text).

**Fallback if Haiku fails:**

```typescript
const IRRITATION_FALLBACK_RESPONSE = "That got to you. I can tell. Hold onto that feeling — it's going to be useful when we get to project time.";
```

---

#### S3: YouTube Topic Acknowledgment

```typescript
function buildYouTubeReaction(selectedTopics: string[]): string {
  const clusters = selectedTopics.map(t => YOUTUBE_TOPICS[t].cluster);

  // Check for "Making" signals
  if (clusters.filter(c => c.includes('Making')).length >= 2) {
    return "Factory tours AND cooking videos? You like watching how things are MADE. That's not background noise — that's your brain studying process.";
  }
  if (clusters.filter(c => c.includes('Research')).length >= 2) {
    return "History rabbit holes and science experiments. You go DOWN. When you find something interesting you don't stop at the surface.";
  }
  if (clusters.filter(c => c.includes('Creative')).length >= 2) {
    return "Design breakdowns and fashion. You're studying the CRAFT — not just consuming it. There's a difference.";
  }
  if (clusters.filter(c => c.includes('Communication')).length >= 1) {
    return "Street interviews. You watch how people interact. That's research most people don't even realise they're doing.";
  }
  // Generic but still personal
  return `${selectedTopics.length} rabbit holes. The stuff you watch when nobody's making you tells me more about you than any questionnaire.`;
}
```

---

#### S3: Value Card Sort Reflection

```typescript
function buildValueReflection(tiers: { core: string[]; important: string[]; nice: string[] }): string {
  const coreLabels = tiers.core.map(id => VALUE_CARDS[id].title.toLowerCase());

  if (coreLabels.length === 0) {
    return "You didn't put anything in Core? Either nothing feels essential or everything does. Both of those are interesting.";
  }
  if (coreLabels.length === 1) {
    return `One thing in Core: ${coreLabels[0]}. When you only have one, you mean it. That's your non-negotiable.`;
  }
  if (coreLabels.length >= 4) {
    return `${coreLabels.length} things in Core. That's a lot of non-negotiables. Here's the hard question: when two of those clash — and they will — which one wins?`;
  }

  // 2-3 core values — the sweet spot
  const hasHelpingAndFair = coreLabels.includes('helping people') && coreLabels.includes('making it fair');
  const hasMakingAndOwn = coreLabels.includes('making things beautiful') && coreLabels.includes('doing it your way');
  const hasFixingAndDeep = coreLabels.includes('fixing what\'s broken') && coreLabels.includes('understanding deeply');

  if (hasHelpingAndFair) return `Helping people AND making it fair. You care about the people AND the system. That's not common — most people lean one way.`;
  if (hasMakingAndOwn) return `Beauty and originality at the top. You'd rather make something imperfect and yours than perfect and predictable.`;
  if (hasFixingAndDeep) return `Fixing things AND understanding why. You don't just patch problems — you want to know what caused them. That's how you avoid building chairs nobody needs.`;

  return `${coreLabels.join(' and ')} at the top. That combination is going to shape every decision you make in this project — remember it when you're stuck.`;
}
```

---

#### S4: Slider Combination Response

```typescript
function buildSliderReaction(scale: string, urgency: number, proximity: number): string {
  // scale: 'personal' | 'school' | 'community' | 'global'
  // urgency: 0-100
  // proximity: 0-100 (how close/personal)

  if (proximity > 70 && urgency > 70) {
    return "Personal, urgent, close to home. You want to fix something you deal with every day. That's where the best projects come from — you'll never lose motivation.";
  }
  if (proximity < 30 && scale === 'global') {
    return "Big scope, far away. Ambitious. The challenge will be making it concrete enough to actually DO something about it in ${timeframe}.";
  }
  if (urgency < 30) {
    return "Not urgent. That's fine — it means you can go deeper instead of rushing. Some problems are worth thinking about slowly.";
  }
  if (proximity > 70 && urgency < 40) {
    return "Close to you but not urgent. Something that's been bugging you for a while. Those quiet frustrations often make the most interesting projects.";
  }
  return "Good compass reading. Let's see where this points.";
}
```

---

#### S4: Problem Text Prompt Response

**Haiku prompt:**

```typescript
const S4_PROBLEM_RESPONSE_PROMPT = `You are Kit, a design mentor. A student just described a problem they care about.

What they wrote: "{studentText}"
Their hotspot clicks: {clickedHotspots}
Their irritation data: {irritationSummary}
Their archetype so far: {currentPrimaryArchetype}

Write a 2-3 sentence response that:
1. Shows you heard the specific problem they described (reference a detail from their text)
2. Names what KIND of problem it is without jargon (people problem, systems problem, communication problem, access problem)
3. Connects it to something earlier in their journey if possible ("This feels connected to what irritated you about [irritation]")

Voice: Kit — smart older cousin. Genuine curiosity. Not praising. Not evaluating. Interested.
Max 60 words.

Return JSON: { "response": "...", "problem_type": "people|systems|communication|access|environment|creative" }`;
```

**Fallback:**

```typescript
const S4_PROBLEM_FALLBACKS = {
  people: "That's a people problem. Those are the hardest kind — and the most worth solving.",
  systems: "Broken system. You can see how it SHOULD work. That gap between should and does? That's your project.",
  communication: "Nobody's talking about it, or nobody's listening. Either way, that's a communication gap waiting for someone to bridge it.",
  access: "Someone can't get to something they should be able to. That's a design failure. Fixable.",
  environment: "You see what's being neglected. Most people walk past it. You stopped.",
  creative: "The world needs more of that. The challenge is making it real, not just imagining it.",
  default: "Real problem. Not made up for a class. I can feel that. Let's figure out what you can actually do about it.",
};
```

---

#### S5: Resource Card Sort Summary

```typescript
function buildResourceSummary(sort: { got: string[]; could_get: string[]; nope: string[] }): string {
  const gotCount = sort.got.length;
  const couldCount = sort.could_get.length;
  const nopeCount = sort.nope.length;

  if (gotCount >= 8) return `${gotCount} out of 12 — you're well-equipped. The question isn't what you can do — it's what you SHOULD do with all that.`;
  if (gotCount <= 3) return `${gotCount} resources. Honest. Constraints aren't a weakness — they force creativity. Some of the best projects I've seen came from students who had nothing but time and an idea.`;
  if (couldCount >= 5) return `${gotCount} locked in, ${couldCount} you could chase down. That's actually a great position — it means your project can grow if you put in the work to get those resources.`;
  return `${gotCount} resources ready, ${couldCount} possible, ${nopeCount} not happening. That's a realistic picture. Let's work with what you've got.`;
}
```

---

#### S5: People Icons Acknowledgment

```typescript
function buildPeopleAcknowledgment(selected: string[]): string {
  if (selected.length === 0) return "Nobody? OK. Solo projects are fine — but keep your eyes open. Support shows up in unexpected places.";
  if (selected.length === 1) return `Just one person — but the right one person is enough. Especially if they're ${PEOPLE_ICONS[selected[0]].label.toLowerCase()}.`;
  if (selected.length >= 4) return `${selected.length} people in your corner. That's a support network. Use it — the biggest mistake I see is students who have help available and don't ask.`;

  const hasTeacher = selected.includes('teacher');
  const hasFriend = selected.includes('friend');
  const hasExpert = selected.includes('expert');
  const hasFamily = selected.includes('family');

  if (hasTeacher && hasFriend) return "A teacher and a friend. That's the classic combo — structure and fun. Both matter.";
  if (hasExpert) return "You know someone with expertise. That's an unfair advantage. Use it early, not when you're stuck at the end.";
  if (hasFamily) return "Family support. That changes what's possible — especially for projects that need space, materials, or rides.";
  return `${selected.length} people who'd back you up. That's more than most people think they have.`;
}
```

---

#### S5: Past Projects Response

```typescript
const PAST_PROJECT_RESPONSES: Record<string, string> = {
  first_time: "First one. Everyone starts somewhere. I was terrible at my first project — ask me about The Chair sometime. Actually, don't.",
  one_or_two: "A couple under your belt. Enough to know it's hard, not enough to be jaded. Good place to be.",
  a_few: "You've been here before. That changes everything — you know the uncomfortable middle part is normal.",
  loads: "Veteran. You know the drill. The danger for experienced students is playing it safe. Don't build another chair.",
};

const LAST_PROJECT_RESPONSES: Record<string, string> = {
  proud: "Finished AND proud. That's rarer than people think. What made it different?",
  fine: "Finished but 'fine.' I know that feeling. You know it could've been better. That self-awareness is actually useful.",
  ran_out: "Ran out of time. That's the #1 killer of good projects. We're going to plan for that this time.",
  changed: "Changed direction halfway. That's either a pivot or a panic — we'll figure out which one you are.",
  no_experience: "Clean slate. No bad habits to unlearn. That's honestly an advantage.",
};
```

---

#### S5: Failure Response Reaction

```typescript
const FAILURE_RESPONSES: Record<string, string> = {
  pivot: "Burn it down. Phoenix mode. That takes guts — but make sure you're pivoting to something better, not just running from something hard.",
  persist: "Keep grinding. Stubborn. I mean that as a genuine compliment. The world needs people who don't quit at the first wall.",
  pause: "Step away. That's not giving up — that's strategy. Most people don't know when to stop pushing. You do.",
  help_seek: "Find someone who's done it. That's not weakness. That's the fastest path through any wall. Just make sure you actually do it and don't just think about it.",
};
```

---

#### S5: Audience Selection Response

```typescript
function buildAudienceResponse(selected: string[]): string {
  const widest = selected[selected.length - 1]; // Assume sorted by scope
  if (selected.includes('global')) return "Anyone, anywhere. Big ambition. The trick is starting specific and letting it grow — you can't design for 8 billion people at once.";
  if (selected.includes('community')) return "Community-focused. That means you'll need to actually talk to people outside school. The best data is out there, not in here.";
  if (selected.includes('school_wide')) return "Whole school. Visible. Ambitious. Everyone will have an opinion. Are you ready for that?";
  if (selected.includes('class')) return "Your class. Built-in test audience. That's actually smart — fast feedback, people you know.";
  return "Just you and your teacher. Nothing wrong with that. Some of the deepest projects are personal ones.";
}
```

---

#### S6: Fear Card Responses (CRITICAL)

This is the most vulnerable moment in Discovery. The student has chosen their project direction and is now admitting what scares them. Kit's response must be genuine, specific, normalizing, and offer a concrete reframing — not "that's totally valid!" energy.

```typescript
const FEAR_RESPONSES: Record<string, string> = {
  failing_publicly: `Yeah. Presenting something you made and watching people not get it — that's a specific kind of horrible. Here's what I've learned though: the students who fail publicly and keep going? They become the ones other students trust. Because everyone knows they're not faking it. Your first version will probably be rough. Show it anyway. The feedback from a rough version is worth more than the silence around a perfect one you never share.`,

  not_finishing: `This one's real. I've watched talented students pour weeks into something and run out of time with a half-built project on their desk. It's the worst. Here's the trick: plan backwards from the deadline. What does "done enough" look like? Not perfect — done enough. If you know that answer on day one, you'll finish. I'll help you figure that out.`,

  it_being_boring: `You're scared of making something nobody cares about. That's actually a good fear — it means you care about impact, not just grades. Here's how you avoid boring: start with a REAL problem that affects REAL people. If your project makes one person's day slightly better, it's not boring. Boring is when you design for a brief instead of a person.`,

  nobody_caring: `Showing your work and having people walk past. I've been there. Here's the thing — if your project solves a real problem for a real person, that person will care. You don't need everyone. You need one person who says "this matters to me." We're going to find that person.`,

  not_good_enough: `Comparing yourself to the kid who seems to nail everything. I know. Here's something nobody tells you: that kid is comparing themselves to someone too. "Good enough" is a moving target. The question isn't whether your work is as good as theirs — it's whether YOUR work is better than YOUR last attempt. That's the only comparison that matters.`,
};
```

**Display:** This is NOT a flash subtitle. This is a full Kit speech bubble that takes 8-10 seconds to read. The student sits with this response. A "Continue" button appears after 5 seconds (prevent accidental skip). Kit's expression: concerned/thoughtful (not smiling).

---

#### S7: Excitement Check Interaction (FULL SPEC — was missing)

Between success criteria selection and the Grand Reveal. A gut-check moment.

**Interaction:** Single slider with Kit watching.

Kit: *"Last thing before the big moment. Close your eyes for a second. Think about the project direction you chose and the criteria you just set. Now..."*

> "How excited are you to actually start this?"

Left (0): "Honestly? Not very." → Right (100): "I can't wait to start."

**Kit reactions at 3 breakpoints:**

```typescript
const EXCITEMENT_REACTIONS = {
  low: "Under 30. That's honest. If you're not excited, we should figure out why — because a project you're not into is a project that dies in week two. Want to go back and change your door?",  // Offer backtrack
  mid: "Cautiously optimistic. That's actually healthy. Pure excitement fades. Curiosity with a bit of nerves — that lasts.",
  high: "You're ready. I can tell. That energy is going to carry you through the hard parts — just remember it when you're in the messy middle.",
};
```

**If score < 20:** Offer a "Go Back" button that returns to S6 door selection. Student can re-explore or pick a different door. Kit: "No shame in changing your mind. Better now than three weeks in."

**Data stored:** `excitement_score: number (0-100)` on `DiscoveryProfile.commitment`

**Why this matters:** A low excitement score is a red flag that the door generation missed. It's a safety valve. And the data feeds the Design Assistant — if a student starts Open Studio with excitement 25, the AI mentor knows to check in more carefully.

---

#### S7: Success Criteria Acknowledgment

```typescript
function buildCriteriaReaction(criteria: string[], archetype: DesignArchetype): string {
  const hasPersonalGrowth = criteria.some(c => c.includes('learned') || c.includes('myself') || c.includes('proud'));
  const hasImpact = criteria.some(c => c.includes('someone') || c.includes('people') || c.includes('changed'));
  const hasProcess = criteria.some(c => c.includes('tested') || c.includes('iterated') || c.includes('documented'));
  const hasAmbition = criteria.some(c => c.includes('never seen') || c.includes('risk') || c.includes('original'));

  if (hasImpact && hasProcess) return "Impact AND process. You care about the result AND how you got there. That's mature.";
  if (hasAmbition && !hasProcess) return "Big ambitions. Love it. But I notice you didn't pick anything about process — the ambitious projects are the ones that need the most discipline.";
  if (hasPersonalGrowth && criteria.length <= 3) return "Personal growth criteria. This project is about YOU growing, not just making something. That's the kind of project you'll remember in ten years.";
  if (criteria.length >= 5) return `${criteria.length} criteria. That's a lot to hit. Make sure they're not contradicting each other — you can't go deep AND wide.`;
  return "Solid criteria. Keep these somewhere you can see them — not in a folder. On your wall.";
}
```

---

## Part 9: Mode 1 vs Mode 2 Template Doors (added 26 March 2026)

### Why Two Sets

Mode 1 (MYP Design): Discovery happens AFTER several structured lessons. The student has context, has been exposed to the design cycle, and is scoping an Open Studio project. The doors are about **project direction within a known framework**.

Mode 2 (Service as Learning, Personal Project, PYPx): Discovery IS the unit entry point. The student may have zero context about the subject area. Open Studio runs from day one — the doors are about **the entire unit journey**. They need to be broader, more foundational, and frame a longer arc.

### Mode 1 Template Doors (Design — Open Studio project scoping)

These assume the student has completed lessons and understands the design cycle. The doors are project-scale (weeks, not months).

| Archetype | Door 1 — Sweet Spot | Door 2 — Stretch | Door 3 — Surprise |
|-----------|-------------------|-------------------|-------------------|
| Maker | **"Fix Something Broken"** — Find something at school that doesn't work and redesign it. Start in the workshop by the end of the week. | **"Teach Someone to Make"** — Create a workshop that teaches a skill you have. You'll have to think like a teacher, not just a maker. | **"Make the Invisible Visible"** — Build something that shows a hidden problem. Data becomes physical. Numbers become objects. |
| Researcher | **"Deep Dive"** — Pick a question nobody's answered properly and investigate it. Your deliverable is evidence, not opinion. | **"Research to Action"** — Turn your findings into something people can actually use. A tool, a guide, a resource. | **"Cross-Pollinate"** — Connect two fields nobody thought were related. Find the pattern between things. |
| Leader | **"Rally a Team"** — Organize a group around a cause that matters to you. Your job is to make something happen, not do it all yourself. | **"Lead by Making"** — Don't just plan — build something yourself first. Then bring people in. | **"Empower Someone Else"** — Help another person find and complete their project. Your success is measured by theirs. |
| Communicator | **"Tell a Story"** — Find a story that needs telling and tell it in a way that's hard to ignore. | **"Change a Mind"** — Design something that shifts how people think about an issue. Not propaganda — perspective. | **"Bridge the Gap"** — Connect two groups who don't understand each other. Your job is translation. |
| Creative | **"Reimagine Something Old"** — Take something everyone's used to and make it feel new. | **"Beauty with Purpose"** — Create something beautiful that also solves a problem. Form AND function. | **"Creative Toolkit"** — Design tools or resources that help OTHER people be creative. |
| Systems | **"Fix the System"** — Find a broken process and redesign it so it actually works. | **"Make Complexity Simple"** — Take something confusing and make it understandable for real people. | **"Connect the Dots"** — Find a pattern nobody else has noticed and make it useful. |

### Mode 2 Template Doors (Service/PP/PYPx — unit foundation)

These assume the student is starting from scratch. The doors frame a JOURNEY, not just a project. They need to work for 8-16 weeks, not 2-4.

| Archetype | Door 1 — Sweet Spot | Door 2 — Stretch | Door 3 — Surprise |
|-----------|-------------------|-------------------|-------------------|
| Maker | **"Build for Someone"** — Find a person or group in your community who needs something made. Spend the first weeks understanding THEM, not building. The making comes after the listening. | **"Repair What's Broken"** — Something in your world is failing — a space, a system, a resource. Document it. Understand why. Then fix it with your hands. | **"Prototype a Future"** — What should exist but doesn't yet? Design and build it. Start rough, test with real people, iterate until it works. |
| Researcher | **"Investigate and Illuminate"** — A question matters to you but nobody's answering it properly. Spend weeks gathering real evidence from real people. Turn your findings into something the community can use. | **"Understand to Change"** — Pick something everyone accepts as "just how it is." Research why. Find out who it affects most. Propose something better. | **"Map the Unseen"** — There's a pattern, a system, or a story in your community that most people can't see. Uncover it. Make it visible. |
| Leader | **"Mobilise"** — Find a cause that matters and bring people together around it. Your project is the people and what they accomplish together — not a solo performance. | **"Grow Someone Else"** — Find a person or group who could do more with the right support. Your success is measured by their growth, not your visibility. | **"Design the Process"** — Don't just run a project — design HOW a group should work together. Create the system that makes collaboration effective. |
| Communicator | **"Amplify a Voice"** — Someone's story isn't being heard. Find them. Listen deeply. Then tell their story in a way that makes people stop and pay attention. | **"Start a Conversation"** — Two groups, communities, or perspectives aren't talking to each other. Your job is to build the bridge and get the conversation started. | **"Create Understanding"** — Something complex needs to be explained to people who matter. Find the right medium, the right tone, the right moment. |
| Creative | **"Create Something That Matters"** — Beauty for its own sake is fine — but beauty that serves a purpose is powerful. Make something new that also makes something better. | **"Reclaim and Reimagine"** — Take something that's been neglected, forgotten, or written off. See what it could become. Give it new life. | **"Design an Experience"** — Don't just make an object. Design how someone FEELS when they encounter your work. The experience IS the project. |
| Systems | **"Redesign a Process"** — Find a system that's failing the people who use it. Map it, understand why it breaks, and redesign it so it actually works. | **"Simplify the Complex"** — Something important is too hard for people to understand or use. Your job is to make it accessible without making it stupid. | **"Find the Leverage Point"** — In every broken system there's one small change that would fix a lot. Find it. Prove it. Propose it. |

### Key Differences Between Mode 1 and Mode 2 Doors

| Aspect | Mode 1 (Design) | Mode 2 (Service/PP/PYPx) |
|--------|-----------------|--------------------------|
| **Scope** | Project (2-4 weeks) | Unit journey (8-16 weeks) |
| **Assumed context** | Student has design cycle knowledge | Student may be starting cold |
| **Language** | Action-oriented, specific | Journey-oriented, exploratory |
| **First step** | "Start in the workshop by Friday" | "Spend the first weeks understanding" |
| **Success frame** | Deliverable-focused | Growth + impact focused |
| **Risk profile** | Can fail fast, iterate | Needs sustained engagement |

### Door Selection Logic

```typescript
function getTemplateDoors(
  archetype: DesignArchetype,
  mode: 'teacher_directed' | 'open_studio_default'
): ProjectDirection[] {
  const templates = mode === 'open_studio_default'
    ? MODE_2_TEMPLATE_DOORS[archetype]
    : MODE_1_TEMPLATE_DOORS[archetype];
  return templates;
}
```

AI-generated doors (Sonnet) should also be aware of mode — the generation prompt needs the mode context so it generates appropriately-scoped doors. Add to the door generation system prompt:

```typescript
const MODE_CONTEXT = {
  teacher_directed: "This student is scoping a 2-4 week Open Studio project within a Design unit. They've already completed structured lessons and understand the design cycle. Generate project-scale directions.",
  open_studio_default: "This student is starting a full unit journey (8-16 weeks) in a self-directed mode. They may have limited prior context. Generate journey-scale directions that include discovery, development, AND delivery phases.",
};
```

---

## Part 10: "People Come to You For" Split Scoring (added 26 March 2026)

### The Problem

4 of the 10 "people come to you for" icons map to dual archetypes:

| Icon | Current Signal | Ambiguity |
|------|---------------|-----------|
| 📋 Getting organized | Leader / Systems | Is organizing people (Leader) or organizing processes (Systems)? |
| 🤝 Settling arguments | Communicator / Leader | Is mediating (Communicator) or directing (Leader)? |
| 🧩 Figuring out how things work | Systems / Researcher | Is systems thinking or research? |
| 📱 Tech help | Systems / Maker | Is fixing systems or building things? |

### Solution: Primary/Secondary Split (0.7/0.3)

Each dual-archetype icon has a **primary** archetype (gets 0.7 weight) and a **secondary** (gets 0.3 weight). The split reflects what the label's phrasing implies more strongly.

```typescript
interface PeopleIconSignal {
  id: string;
  label: string;
  archetypes: { archetype: DesignArchetype; weight: number }[];
}

const PEOPLE_ICON_SIGNALS: Record<string, PeopleIconSignal> = {
  // Pure signals (single archetype)
  fixing:      { id: 'fixing', label: 'Fixing things', archetypes: [{ archetype: 'Maker', weight: 1.0 }] },
  ideas:       { id: 'ideas', label: 'Ideas', archetypes: [{ archetype: 'Creative', weight: 1.0 }] },
  explaining:  { id: 'explaining', label: 'Explaining things', archetypes: [{ archetype: 'Communicator', weight: 1.0 }] },
  finding_out: { id: 'finding_out', label: 'Finding things out', archetypes: [{ archetype: 'Researcher', weight: 1.0 }] },
  look_good:   { id: 'look_good', label: 'Making things look good', archetypes: [{ archetype: 'Creative', weight: 1.0 }] },
  feel_better: { id: 'feel_better', label: 'Making people laugh / feel better', archetypes: [{ archetype: 'Communicator', weight: 1.0 }] },

  // Split signals (dual archetype — primary 0.7, secondary 0.3)
  organized:   {
    id: 'organized', label: 'Getting organized',
    archetypes: [
      { archetype: 'Leader', weight: 0.7 },     // "Getting organized" implies organizing PEOPLE + projects
      { archetype: 'Systems', weight: 0.3 },     // But systems thinking is part of it
    ]
  },
  settling:    {
    id: 'settling', label: 'Settling arguments',
    archetypes: [
      { archetype: 'Communicator', weight: 0.7 }, // Mediation is communication
      { archetype: 'Leader', weight: 0.3 },        // But it requires authority
    ]
  },
  figuring:    {
    id: 'figuring', label: 'Figuring out how things work',
    archetypes: [
      { archetype: 'Systems', weight: 0.7 },      // "How things work" = systems
      { archetype: 'Researcher', weight: 0.3 },    // But investigation is part of it
    ]
  },
  tech_help:   {
    id: 'tech_help', label: 'Tech help',
    archetypes: [
      { archetype: 'Systems', weight: 0.7 },      // Tech troubleshooting = systems thinking
      { archetype: 'Maker', weight: 0.3 },         // But hands-on fixing is part of it
    ]
  },
};
```

### Updated `buildS2PeopleSignal` Function

```typescript
function buildS2PeopleSignal(selectedIcons: string[]): StationArchetypeSignal {
  const raw: Record<DesignArchetype, number> = {
    Maker: 0, Researcher: 0, Leader: 0, Communicator: 0, Creative: 0, Systems: 0
  };

  for (const iconId of selectedIcons) {
    const signal = PEOPLE_ICON_SIGNALS[iconId];
    for (const { archetype, weight } of signal.archetypes) {
      raw[archetype] += weight;
    }
  }

  return {
    station: 2,
    raw,
    maxPossible: 3.0, // 3 picks × max 1.0 weight per archetype per icon
    signalQuality: STATION_WEIGHTS.s2_people,
  };
}
```

### Why 0.7/0.3 (not 0.5/0.5)

Equal split (0.5/0.5) means the icon provides no useful differentiation between two archetypes — it's noise. A dominant split (0.7/0.3) means the icon's label drives the primary signal while acknowledging the secondary. The 0.3 secondary still matters when a student picks multiple split icons that share a secondary — the cumulative secondary signal can become significant.

**Example:** A student picks 📋 Getting organized (Leader 0.7, Systems 0.3) AND 📱 Tech help (Systems 0.7, Maker 0.3). Systems gets 0.3 + 0.7 = 1.0, which is a strong signal from the "people" station. Without the split, this pattern would be invisible.

---

## Part 11: Teacher Content Control Panel (added 26 March 2026)

### Design Principle

All Discovery content (binary pairs, scenarios, irritation options, value cards, resource cards, YouTube topics, tool mappings, fear cards, Kit dialogue, success criteria templates, door templates) must be editable by a teacher or admin without touching code. This is NOT a v1 requirement — Discovery ships with hardcoded content pools first. But the architecture must support a content management layer.

### Architecture: Content Pool Override Chain

Same pattern as StudioLoom's content resolution chain (`resolveClassUnitContent`):

```
Hardcoded default → School override → Teacher override → Class override
```

In practice for v1: just hardcoded + teacher override.

```typescript
interface DiscoveryContentPool {
  id: string;
  teacher_id: string | null;  // null = system default
  class_id: string | null;    // null = applies to all classes
  content_type: 'binary_pairs' | 'scenarios' | 'irritations' | 'youtube_topics'
    | 'value_cards' | 'resource_cards' | 'tool_mappings' | 'fear_cards'
    | 'success_criteria' | 'door_templates' | 'kit_dialogue'
    | 'interest_icons' | 'people_icons' | 'efficacy_sliders';
  items: any[];  // Content type-specific JSONB
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### Content Resolution

```typescript
function resolveContentPool(
  contentType: string,
  teacherId: string,
  classId?: string
): ContentItem[] {
  // 1. Check class-specific override
  if (classId) {
    const classPool = db.discovery_content_pools
      .where({ content_type: contentType, teacher_id: teacherId, class_id: classId, is_active: true })
      .first();
    if (classPool) return classPool.items;
  }

  // 2. Check teacher override
  const teacherPool = db.discovery_content_pools
    .where({ content_type: contentType, teacher_id: teacherId, class_id: null, is_active: true })
    .first();
  if (teacherPool) return teacherPool.items;

  // 3. Fall back to hardcoded system defaults
  return SYSTEM_DEFAULTS[contentType];
}
```

### Control Panel UI (Future — not v1)

Location: `/teacher/settings` → "Discovery Content" tab (or `/teacher/discovery/content`)

**Sections:**

| Section | What Teacher Edits | Complexity |
|---------|-------------------|------------|
| Binary Pairs | Add/edit/remove/reorder pairs. Edit prompt text, option A/B labels, dimension mapping. | Medium |
| Scenarios | Add/edit/remove scenarios. Edit situation text, option labels, archetype weights per option. | High |
| Irritation Prompts | Add/edit/remove pre-written irritations. Edit text, cluster mapping. | Low |
| YouTube Topics | Add/edit/remove topics. Edit labels, example channels, cluster signals. | Low |
| Value Cards | Add/edit/remove cards. Edit title + "what it actually means" text. | Low |
| Resource Cards | Add/edit/remove cards. Edit resource name + Kit one-liner. | Low |
| Tool Mappings | Edit archetype weights per tool. Visual weight grid (6 columns × 12 rows). | Medium |
| Fear Cards | Add/edit/remove fears. Edit label + Kit response. | Low |
| Success Criteria | Add/edit/remove criteria per archetype + generic. | Low |
| Door Templates | Edit Mode 1 + Mode 2 door titles/descriptions per archetype. | Medium |
| Kit Dialogue | Edit Kit's per-station intro, outro, and reaction templates. | High |

**UI Pattern:** Each section is a collapsible card. Click "Customize" to open an edit modal. Items show as draggable cards. Each card has Edit (pencil) and Delete (trash) icons. "Add New" button at bottom. "Reset to Default" button restores system content.

**Important:** Teachers can only ADD and EDIT. Deleting a system default item only hides it (sets `is_active: false` on the override). The system default is never actually deleted.

### Migration (future — not v1)

```sql
CREATE TABLE IF NOT EXISTS discovery_content_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id),
  class_id TEXT,  -- nullable, for class-specific overrides
  content_type TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, class_id, content_type)
);

-- RLS: teachers can only read/write their own
ALTER TABLE discovery_content_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own content pools"
  ON discovery_content_pools
  FOR ALL
  USING (teacher_id = auth.uid());
```

### v1 Strategy

1. All content hardcoded in TypeScript content pool files (`src/lib/discovery/content/`)
2. Each file exports a typed array with the system defaults
3. The station components import from these files directly
4. NO database content lookup in v1 — pure TypeScript imports
5. When the control panel is built (v2), the content pool loader checks DB first, falls back to the TypeScript defaults
6. This means v1 content files become the "system defaults" automatically — zero migration needed

---

## Part 12: Revised Station Weight Table (added 26 March 2026)

The addition of the free-text irritation AI analysis (§8.2 S3) as a scored signal changes the weight distribution. Updated table:

```typescript
const STATION_WEIGHTS: Record<string, number> = {
  s0_tools:         0.15,  // Down from 0.20 — identity expression (moderate reliability)
  s2_scenarios:     0.25,  // Down from 0.35 — behavioral, but forced-choice limits signal depth
  s2_people:        0.20,  // Down from 0.25 — external validation (high reliability)
  s3_irritation_ai: 0.20,  // NEW — free-text AI analysis (highest reliability: emotional, self-generated, specific)
  s3_irritation_preset: 0.05, // Pre-written scenario selection (low reliability vs free-text)
  s3_interests:     0.05,  // Down from 0.10 — indirect cluster correlation
  s5_efficacy:      0.05,  // Down from 0.10 — self-assessed, least reliable
};
// Total: 0.95 — the remaining 0.05 absorbs rounding and future signals
```

**Key change:** The free-text irritation analysis now has the HIGHEST individual weight (0.20) because:
- It's self-generated (not forced-choice from pre-written options)
- It's emotional (carries genuine investment)
- It's specific (Haiku extracts precise archetype signals from the actual text)
- It's unique to this student (can't be gamed by picking the "cool" option)

**When student writes their own irritation:** `s3_irritation_ai` (0.20) is used, `s3_irritation_preset` (0.05) is ignored.
**When student only picks from list:** `s3_irritation_preset` (0.05) is used, `s3_irritation_ai` (0.20) is dropped. Total weight drops to 0.75 — which means the other signals get proportionally more influence (normalization handles this).

The `normalizeArchetypeScores` function already handles this gracefully — it divides by `totalWeight`, not a fixed denominator. Missing signals don't bias the result; they just reduce confidence.
