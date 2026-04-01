# Discovery Engine — Design Specification
*The engine behind the journey. Design this first, then build the game.*

**Status:** Research complete. Ready for review.
**Companion docs:** `discovery-comic-strip-spec.md` (narrative), `discovery-mentor-system.md` (5 mentors), `discovery-voiceover-script.md` (audio)
**Date:** 26 March 2026

---

## The Insight That Changes Everything

The current Discovery is a chatbot wearing a costume. Text box, AI response, text box, AI response. The comic strip spec solved the **narrative** problem (stories not interrogations) but not the **interaction** problem (still mostly typing).

**What 16Personalities gets right:** millions of teens take it voluntarily because it's mostly clicking, with an irresistible reveal loop. The interaction is varied — binary choices, sliders, scenarios, visual metaphors. You're *doing* things, not *writing* things. And the payoff (your 4-letter type + detailed profile) feels like discovering a secret about yourself.

**What we need:** A 45-60 minute journey that collects 30+ data points through varied interactions (mini-tests, scenarios, card sorts, binary choices, visual selections, 2-3 focused text prompts) — wrapped in the mentor narrative and side-scrolling game world. By the end, the student has a genuine self-portrait and a realistic project direction.

**The ratio:** ~70% clicking/selecting/dragging, ~30% writing. Never more than 2 text inputs in a row.

---

## Part 1: What the Engine Needs to Know

Research from Gallup (CliftonStrengths), VIA Character Strengths, Search Institute (Developmental Assets), Bandura (self-efficacy), Ikigai, Stanford d.school, IB CAS, and adolescent identity formation literature converges on **6 knowledge domains** the student needs before starting a self-directed project:

### Domain 1: WHO AM I? (Strengths & Working Style)
*What comes naturally, how my brain works, what I default to under pressure*

**Data points collected:**
- Design archetype (Maker / Researcher / Leader / Communicator / Systems Thinker / Creative)
- Working style (solo ↔ collaborative, structured ↔ flexible, fast-start ↔ planner)
- Decision-making pattern (gut ↔ analytical, independent ↔ consensus)
- Energy pattern (sprinter ↔ marathoner, morning ↔ evening, deep-focus ↔ multitask)
- What people come to them for (observable strength, not self-assessed)

**Research basis:** CliftonStrengths (34 themes → simplified to 6 design-specific archetypes), VIA Character Strengths (24 → mapped to design domains), 16Personalities (MBTI → working style dimensions)

### Domain 2: WHAT DO I CARE ABOUT? (Interests, Values, Curiosities)
*What grabs my attention, what annoys me, what I lose track of time doing*

**Data points collected:**
- Interest clusters (3-5 topics/areas, in their own words)
- Values hierarchy (ranked, not just listed)
- Irritation signals (what bothers them → authentic interest indicator)
- Curiosity patterns (rabbit holes, obsessions, collections)
- Cross-domain connections (where interests overlap unexpectedly)

**Research basis:** RIASEC/Holland Codes (interest mapping), Ikigai (passion ∩ skill ∩ need ∩ viability), adolescent identity research (interests as identity anchors during ages 11-18)

### Domain 3: WHAT DO I NOTICE? (Problems, Needs, Empathy)
*Who's struggling, what's broken, what shouldn't be that hard*

**Data points collected:**
- Observed needs (specific, local, concrete — not "world peace")
- Empathy targets (who they naturally notice and care about)
- Scale of concern (personal sphere ↔ school ↔ community ↔ global)
- Problem framing ability (can they articulate WHY something is a problem?)
- Prior action (have they tried to do anything about it before?)

**Research basis:** Stanford d.school Empathize phase, IDEO Human-Centered Design, Asset-Based Community Development, Theory of Change (problem → activities → outputs → outcomes)

### Domain 4: WHAT CAN I ACTUALLY DO? (Resources & Constraints)
*Time, skills, people, materials, space, money — the reality check*

**Data points collected:**
- Hours per week (realistic, not aspirational)
- Term/deadline awareness (weeks available)
- Physical resources (workshop access, materials, tools, budget)
- Human resources (collaborators, mentors, experts accessible)
- Skills inventory (what they can already do vs. need to learn)
- Technology access (devices, software, internet reliability)

**Research basis:** Search Institute Developmental Assets (external supports), project management research on scope estimation, PBL literature on resource-realistic goal setting

### Domain 5: HOW READY AM I? (Confidence & Experience)
*Self-efficacy, past project experience, failure tolerance*

**Data points collected:**
- Domain-specific self-efficacy (making, researching, presenting, collaborating, iterating — not general confidence)
- Past project count and outcome (completed, abandoned, scaled back)
- Response to setbacks (pivot, persist, pause, panic)
- Help-seeking behaviour (asks early ↔ waits until crisis ↔ never asks)
- Comfort with ambiguity (needs clear brief ↔ thrives in open-endedness)

**Research basis:** Bandura's self-efficacy scales (domain-specific predicts persistence better than general confidence), goal-setting research (42% of written-goal setters achieve vs. ~10% without), IB CAS learning outcomes (initiative, perseverance, commitment)

### Domain 6: WHAT'S MY DIRECTION? (Narrowing & Commitment)
*Where strengths ∩ interests ∩ needs ∩ resources → realistic project*

**Data points collected:**
- Project direction (chosen from AI-generated options or self-proposed)
- Goal articulation ("I will [what], for [who], because [why]")
- Success criteria (how they'll know it worked)
- Biggest risk they foresee
- Excitement level (gut check — does this make their stomach flip?)

**Research basis:** Golden Circle (Why → How → What), Theory of Change, IB CAS investigation stage, Ikigai sweet spot

---

## Part 2: Interaction Types (The Toolkit)

The engine uses **8 interaction types**, each designed to extract specific data while keeping engagement high. The key principle: **never more than 2 of the same type in a row.**

### Type 1: Binary Forced Choice (16Personalities style)
**What:** Two statements side by side. Tap the one that fits better. No middle ground.
**Duration:** 3-5 seconds per pair
**Best for:** Personality dimensions, working style, decision patterns
**UX:** Two cards that tilt/glow on hover. Tap to select, satisfying animation, auto-advance.
**Example:**
> "When a project is due soon, I..."
> 🅰️ "...make a detailed plan before starting" | 🅱️ "...jump in and figure it out as I go"

**Data extracted:** Binary preference → contributes to working style profile
**Engagement mechanism:** Speed + decisiveness feels game-like. Progress bar advances visibly.

### Type 2: Scenario Response (Multiple Choice)
**What:** A vivid scenario with 3-4 response options. Each maps to a different archetype/trait.
**Duration:** 20-40 seconds per scenario
**Best for:** Revealing actual behaviour (not ideal self), strengths under pressure, decision-making
**UX:** Scenario text/illustration at top. Response cards below with short descriptions. Select one, mentor reacts.
**Example:**
> "You're in a group project. Halfway through, you realise the plan isn't working. You..."
> 🔧 "Quietly start building an alternative in case the plan fails" (Maker)
> 📋 "Call a meeting and propose a new direction" (Leader)
> 🔍 "Research what went wrong before suggesting changes" (Researcher)
> 💡 "Sketch 3 quick alternatives and let the group pick" (Creative)

**Data extracted:** Archetype signal + decision-making pattern
**Engagement mechanism:** Feels like a personality quiz. Students compare answers with friends.

### Type 3: Card Sort / Drag Ranking
**What:** Drag cards into ranked order, or sort into categories (important/not important, me/not me).
**Duration:** 30-60 seconds per sort
**Best for:** Values hierarchy, interest prioritisation, resource inventory
**UX:** Cards with icons + short labels. Drag into slots or buckets. Satisfying snap animation.
**Example — Values Sort:**
> Rank these from "most me" to "least me":
> [Helping others] [Creating things] [Solving puzzles] [Leading people] [Understanding systems] [Expressing ideas]

**Example — Resource Check:**
> Drag to "I have this" or "I don't have this":
> [Workshop access] [Budget ($20+)] [A collaborator] [Expert I can talk to] [Reliable internet] [Time after school]

**Data extracted:** Ordered preferences, resource availability
**Engagement mechanism:** Physical interaction (dragging) is more engaging than clicking. Feels like organising, not testing.

### Type 4: Visual Scene Selection
**What:** An illustrated scene with clickable elements. Student clicks things they notice/care about.
**Duration:** 30-60 seconds per scene
**Best for:** Problem identification, empathy targets, interest signals
**UX:** Rich illustrated scene (community, school, home). Hotspots glow subtly on hover. Click to "notice" them. Mentor comments on what you noticed.
**Example:**
> *A school scene: a student eating alone, a broken water fountain, a messy art room, a poster with outdated info, a group excluding someone, a garden with dead plants, a ramp that's too steep*
> "What catches your eye? Click the things you notice."

**Data extracted:** Empathy patterns, problem sensitivity, scale of concern
**Engagement mechanism:** Discovery/exploration. Students find different things, making it personal. "I can't believe you noticed the ramp — most people walk right past that."

### Type 5: Slider Scales (Continuous)
**What:** A slider between two poles. More nuanced than binary choice.
**Duration:** 5-10 seconds per slider
**Best for:** Self-efficacy, confidence, time estimation, comfort levels
**UX:** Labelled poles. Slider with a thumb that the student drags. Visual feedback (colour gradient, emoji, descriptive label changes as slider moves).
**Example:**
> How confident are you at...
> Making things with your hands: [Not at all ←——●——→ Very confident]
> Presenting to a group: [Not at all ←——●——→ Very confident]
> Researching a topic deeply: [Not at all ←——●——→ Very confident]

**Data extracted:** Domain-specific self-efficacy scores (0-100)
**Engagement mechanism:** Quick, low-stakes, satisfying interaction. Stack 4-6 in a row for "confidence fingerprint."

### Type 6: Image/Icon Selection (Pinterest-style)
**What:** A grid of images or icons. Student selects multiple that resonate.
**Duration:** 20-40 seconds per grid
**Best for:** Interest discovery, aesthetic preferences, project type matching
**UX:** Grid of 8-12 images with subtle labels. Tap to select (up to 3-5). Selected items glow/enlarge.
**Example — "What kind of work excites you?":**
> [🏗️ Building something physical] [🎨 Making something beautiful] [📊 Figuring out a system]
> [🗣️ Changing someone's mind] [🔬 Discovering something new] [🤝 Helping someone directly]
> [📱 Creating something digital] [📝 Writing something meaningful] [🎭 Performing or presenting]

**Data extracted:** Project type preferences, multi-signal interest mapping
**Engagement mechanism:** Visual + low cognitive load. Feels like curating, not answering.

### Type 7: "This or That" Quick-Fire Round
**What:** Rapid sequence of binary image/word pairs. Tap one. 2-3 seconds each. 8-12 in a row.
**Duration:** 30-45 seconds for a round of 10
**Best for:** Personality dimensions, gut reactions, subconscious preferences
**UX:** Full-screen split. Two options. Tap. Instant next. Speed creates honesty (no time to overthink).
**Example:**
> 🌅 Morning | 🌙 Night
> 📖 Read about it | 🔨 Try it
> 👥 Team | 🧑 Solo
> 📋 Plan first | 🚀 Start now
> 🎯 One big goal | 🎲 Many small experiments
> 🗣️ Talk it through | ✍️ Write it down
> 🏆 Win | 📚 Learn
> 🔥 Passion | 🧊 Discipline

**Data extracted:** Working style vector (8-12 binary dimensions → composite profile)
**Engagement mechanism:** Speed + rhythm + the feeling of revealing yourself through rapid choices. This is the most "game-like" interaction.

### Type 8: Focused Text Prompt (Max 3 per journey)
**What:** An open text field with a carefully crafted provocation. NOT "tell me about yourself."
**Duration:** 2-4 minutes per prompt
**Best for:** Problem articulation, project statement, nuanced self-expression that clicks can't capture
**UX:** Full-width text area with the mentor's provocation above. Character count or word count visible but not limiting. Mentor reacts after submission.
**Example prompts (each designed to extract maximum signal with minimum writing):**
1. "Your best friend is panicking — big project due tomorrow, 2 hours left. What do you actually do?" (reveals strengths)
2. "What's something broken or unfair that you notice and most people seem to ignore?" (reveals empathy + problem awareness)
3. "I'm going to [what], for [who], because [why]." (project commitment statement)

**Data extracted:** Natural language → AI analyses for archetype signals, specificity, emotional charge, action orientation
**Engagement mechanism:** The prompts are so specific and vivid that students want to answer. "What are your strengths?" gets nothing. "Your friend is panicking, 2 hours left" gets real answers.

---

## Part 3: The Full Journey Map (45-60 Minutes)

The journey is structured as **7 stations** in a side-scrolling world. Each station is a physical location the student walks to (the game mechanic). Between stations, brief walking/transition moments with environmental storytelling and mentor dialogue.

Total: ~35 interactive activities across the 7 stations + transitions.

### STATION 1: "The Campfire" — Meeting Your Mentor (5-7 min)

*The student enters the world. A campfire in a clearing. The 5 mentors are gathered. The student chooses one.*

**Activities:**

| # | Activity | Type | Duration | Data Collected |
|---|----------|------|----------|---------------|
| 1.1 | Mentor introduction — 5 short mentor monologues (auto-playing as student scrolls past each) | Passive viewing | 2 min | — |
| 1.2 | "Choose your mentor" — tap the one whose vibe you connect with | Image selection | 30 sec | Mentor affinity (itself a personality signal) |
| 1.3 | Mentor acknowledges the choice, explains the journey ahead | Mentor dialogue (passive) | 1 min | — |
| 1.4 | "Before we start — quick fire round" — 10 rapid This-or-That pairs | Quick-fire binary | 45 sec | Working style vector (10 binary dimensions) |
| 1.5 | Mentor reflects on the quick-fire results ("So you're a morning person who starts before planning — interesting...") | AI response | 30 sec | — |

**Station 1 output:** Mentor selected, 10-dimension working style vector, initial personality sketch

---

### STATION 2: "The Workshop" — Strengths (7-9 min)

*The mentor leads the student to their workshop/studio. The mentor shares a failure story (campfire effect) then presents activities that reveal the student's strengths.*

**Activities:**

| # | Activity | Type | Duration | Data Collected |
|---|----------|------|----------|---------------|
| 2.1 | Mentor's failure story (illustrated panels) | Passive viewing | 1.5 min | — |
| 2.2 | "The Panic Scenario" — friend panicking, 2 hours left, what do you do? | **Text prompt #1** | 2-3 min | Natural strength signal (from language), archetype |
| 2.3 | Mentor reflects on what the answer reveals | AI response | 30 sec | — |
| 2.4 | "Your Superpower Grid" — 6 strength scenarios, pick which you'd handle best | Scenario response ×6 | 2 min | Archetype scoring (6 scenarios → dominant archetype) |
| 2.5 | "What do people come to you for?" — select from icon grid + optional custom text | Icon selection + text | 1 min | Observable strength (external validation signal) |
| 2.6 | **REVEAL: Your Design Archetype** — animated card with archetype name, description, famous exemplar | Reveal moment | 30 sec | — |

**Station 2 output:** Design archetype (primary + secondary), strength narrative in own words, external strength signal

**Design archetypes (6):**
- **The Maker** — builds first, thinks while making, hands-on problem solver
- **The Researcher** — goes deep, evidence-driven, thorough investigator
- **The Leader** — organises people, sees the big picture, delegates well
- **The Communicator** — explains, persuades, connects, translates between groups
- **The Creative** — generates ideas, sees alternatives, aesthetic sensitivity
- **The Systems Thinker** — sees patterns, optimises processes, connects dots

---

### STATION 3: "The Collection Wall" — Interests & Values (7-9 min)

*A wall covered in pinned-up items. The mentor shows their own eclectic collection, normalising not having "one passion."*

**Activities:**

| # | Activity | Type | Duration | Data Collected |
|---|----------|------|----------|---------------|
| 3.1 | Mentor shows their collection wall (illustrated, interactive — click items for stories) | Visual exploration | 1.5 min | — |
| 3.2 | "Build your wall" — drag from a pool of 20 interest icons onto your wall section (select 5-7) | Card sort / drag | 1.5 min | Interest cluster signals |
| 3.3 | "What annoys you?" — pick from illustrated scenarios OR write your own | Scenario select + optional text | 1 min | Irritation-based interest signal |
| 3.4 | "YouTube rabbit holes" — select topics from a visual grid that you lose time on | Image/icon selection | 30 sec | Curiosity patterns |
| 3.5 | Values ranking — drag 8 value cards into "Core / Important / Nice" tiers | Card sort (3-tier) | 1 min | Values hierarchy |
| 3.6 | Mentor connects the dots — "You said X, Y, Z — there's a pattern here..." | AI synthesis | 30 sec | — |
| 3.7 | **REVEAL: Your Interest Map** — visual cluster diagram showing connections between interests | Reveal moment | 30 sec | — |

**Station 3 output:** 5-7 interest signals, values hierarchy (8 items ranked), irritation signal, curiosity pattern, cross-domain connections

**Value cards (8):**
Helping others, Creating beauty, Solving problems, Independence, Fairness/justice, Learning new things, Leading/influencing, Community/belonging

---

### STATION 4: "The Window" — Problems & Needs (6-8 min)

*A window overlooking a community scene. The mentor shares a story about a student who saw a problem nobody else noticed. The conversation shifts outward.*

**Activities:**

| # | Activity | Type | Duration | Data Collected |
|---|----------|------|----------|---------------|
| 4.1 | Mentor's story — the medicine bottle student (or mentor-specific version) | Passive viewing | 1.5 min | — |
| 4.2 | "The Scene" — interactive community illustration with 10+ clickable hotspots. Click what you notice. | Visual scene selection | 1.5 min | Problem sensitivity pattern, scale of concern |
| 4.3 | "Zoom in" — the 2-3 things you clicked expand. Pick the one that matters most to you. | Narrowing selection | 30 sec | Primary empathy target |
| 4.4 | "Who's affected?" — slider scales for how many people, how urgent, how personal | Slider ×3 | 30 sec | Problem framing (scale, urgency, proximity) |
| 4.5 | "What shouldn't be this hard?" — one focused text prompt about a real problem they've noticed | **Text prompt #2** | 2 min | Problem articulation in own words |
| 4.6 | Mentor bridges — connects strengths + interests + problem ("These three things are pointing somewhere...") | AI synthesis | 30 sec | — |
| 4.7 | **REVEAL: Your Empathy Compass** — shows what they notice, who they care about, where their attention goes | Reveal moment | 30 sec | — |

**Station 4 output:** Problem area identified, empathy target, scale/urgency/proximity scores, problem articulation

---

### STATION 5: "The Toolkit" — Resources & Constraints (5-7 min)

*A storage room / shed attached to the workshop. Practical inventory — what do you actually have to work with? The mentor keeps it grounded and honest.*

**Activities:**

| # | Activity | Type | Duration | Data Collected |
|---|----------|------|----------|---------------|
| 5.1 | Mentor on scope ("Every first-timer thinks too big. That's normal. Let's figure out what's realistic.") | Mentor dialogue | 45 sec | — |
| 5.2 | "Time Reality Check" — slider: hours per week you can realistically give (1-15) | Slider | 15 sec | Time budget |
| 5.3 | "Your Toolkit" — drag-sort resource cards into "Have" / "Can Get" / "Don't Have" | Card sort (3-bucket) | 1 min | Resource inventory |
| 5.4 | "Your People" — select from relationship icons: mentor, collaborator, expert, peer, family support | Icon selection (multi) | 30 sec | Human resource map |
| 5.5 | "Skill Check" — confidence sliders for 6 domains (making, researching, presenting, writing, coding, collaborating) | Slider ×6 | 1 min | Self-efficacy fingerprint |
| 5.6 | "Past Projects" — multiple choice: how many projects have you completed? What happened with the last one? | Scenario response ×2 | 30 sec | Experience level, past outcome pattern |
| 5.7 | "When things go wrong" — scenario: "Your project hits a wall halfway through. You..." | Scenario response | 20 sec | Failure response pattern |
| 5.8 | Mentor reality-checks: "With X hours and Y resources, here's what's realistic..." | AI calibration | 30 sec | — |

**Station 5 output:** Time budget, resource inventory (3 tiers), human resources, 6-domain self-efficacy, experience level, failure response pattern

**Resource cards (12):**
Workshop/makerspace, Art supplies, Computer/laptop, Budget ($20+), Camera/phone camera, Tools (hand/power), Kitchen/food prep space, Outdoor space, Presentation equipment, Internet access, Transport to locations, Quiet workspace

---

### STATION 6: "The Crossroads" — Narrowing & Direction (8-10 min)

*A corridor with 3 doors. Each represents an AI-generated project direction synthesised from Stations 2-5. The student explores, eliminates, and commits. This is the hardest station — the mentor's job is to make choosing feel safe.*

**Activities:**

| # | Activity | Type | Duration | Data Collected |
|---|----------|------|----------|---------------|
| 6.1 | AI generates 3 project directions (doors) based on all data so far | AI generation | 5 sec (loading) | — |
| 6.2 | "Explore Door 1" — description + quick feasibility: time match? resource match? excitement level? | Card display + slider (excitement 1-5) | 1.5 min | Direction 1 feasibility + gut reaction |
| 6.3 | "Explore Door 2" — same format | Card display + slider | 1.5 min | Direction 2 feasibility + gut reaction |
| 6.4 | "Explore Door 3" — same format | Card display + slider | 1.5 min | Direction 3 feasibility + gut reaction |
| 6.5 | "Or... your own door" — optional: propose something different entirely | Optional text input | 0-2 min | Self-directed option |
| 6.6 | Mentor on choosing ("I've never picked the 'right' project first try. Commitment matters more than selection.") | Mentor dialogue | 30 sec | — |
| 6.7 | "Pick your door" — confirm selection with a satisfying interaction (key turning, door opening) | Confirmation | 15 sec | Chosen direction |
| 6.8 | Quick risk check — "What's the biggest thing that could go wrong?" (select from options) | Scenario response | 20 sec | Risk awareness |

**Station 6 output:** Chosen project direction, excitement level, risk awareness, feasibility self-assessment

---

### STATION 7: "The Launchpad" — Commitment & Project Statement (5-7 min)

*The rooftop / summit. The student articulates their commitment. The AI validates feasibility against teacher-provided constraints. The full profile is revealed.*

**Activities:**

| # | Activity | Type | Duration | Data Collected |
|---|----------|------|----------|---------------|
| 7.1 | "The Ascent" — visual recap of the journey (scrolling past icons representing each station's discoveries) | Passive / interactive scroll | 1 min | — |
| 7.2 | "Say it out loud" — project commitment: "I'm going to [what], for [who], because [why]" | **Text prompt #3** | 2 min | Project statement |
| 7.3 | "How will you know it worked?" — select from outcome types + optional custom | Icon selection + optional text | 45 sec | Success criteria |
| 7.4 | "Excitement check" — final gut check slider (cold feet ↔ can't wait) | Slider | 10 sec | Commitment confidence |
| 7.5 | AI feasibility validation — checks statement against time budget, resources, term length (teacher-set) | AI validation | 15 sec | Feasibility score |
| 7.6 | Mentor sign-off — personalised farewell connecting the journey to the project | AI response | 30 sec | — |
| 7.7 | **GRAND REVEAL: Your Designer Profile** — full animated profile card with archetype, strengths, interests, values, empathy compass, confidence fingerprint, project direction | Reveal moment | 1 min | — |

**Station 7 output:** Project statement, success criteria, commitment confidence, full validated profile

---

## Part 4: Data Architecture — What Gets Stored

### The Discovery Profile (structured data)

```typescript
interface DiscoveryProfile {
  // Station 1: Campfire
  mentor_id: MentorId;
  working_style: {
    dimensions: Record<string, 'a' | 'b'>;  // 10 binary dimensions
    summary: string;                         // AI-generated narrative
  };

  // Station 2: Workshop
  archetype: {
    primary: DesignArchetype;
    secondary: DesignArchetype | null;
    scores: Record<DesignArchetype, number>;  // 0-100 per archetype
  };
  strengths: {
    scenario_response: string;     // text prompt #1 raw answer
    observable_strength: string;   // what people come to them for
    archetype_signals: string[];   // from scenario responses
  };

  // Station 3: Collection Wall
  interests: {
    selected_icons: string[];         // 5-7 from pool of 20
    irritation_signal: string;        // what annoys them
    curiosity_topics: string[];       // YouTube rabbit holes
    values_hierarchy: string[];       // 8 values ranked
    cross_connections: string[];      // AI-identified overlaps
  };

  // Station 4: Window
  empathy: {
    scene_selections: string[];       // what they clicked in the scene
    primary_target: string;           // who they care most about
    problem_scale: number;            // 0-100 slider
    problem_urgency: number;          // 0-100 slider
    problem_proximity: number;        // 0-100 slider (personal ↔ global)
    problem_articulation: string;     // text prompt #2 raw answer
  };

  // Station 5: Toolkit
  resources: {
    hours_per_week: number;
    resource_tiers: {
      have: string[];
      can_get: string[];
      dont_have: string[];
    };
    human_resources: string[];          // mentor, collaborator, expert, etc.
    self_efficacy: Record<string, number>;  // 6 domains, 0-100 each
    experience_level: 'none' | 'beginner' | 'some' | 'experienced';
    failure_response: string;           // pivot/persist/pause/panic
  };

  // Station 6: Crossroads
  direction: {
    options_presented: ProjectDirection[];  // 3 AI-generated
    chosen_option: number | 'custom';
    custom_proposal?: string;
    excitement_level: number;               // 0-100
    risk_awareness: string;
  };

  // Station 7: Launchpad
  commitment: {
    project_statement: string;           // text prompt #3
    success_criteria: string[];
    commitment_confidence: number;       // 0-100
    feasibility_score: number;           // AI-computed
  };

  // Meta
  completed_at: string;
  duration_minutes: number;
  stations_completed: number[];
}
```

### How the AI Uses This Data

**During journey (real-time):** Each station's AI responses reference earlier stations. "You said you're a Maker AND you notice accessibility problems — that combination is rare and powerful." Cross-referencing creates the "aha" moments that make 16Personalities addictive.

**After journey (ongoing):** The full profile feeds into:
- **Mentor AI personality** — knows the student's archetype, adjusts tone (Makers get "try building it" nudges, Researchers get "have you looked at..." nudges)
- **Milestone suggestions** — shaped by self-efficacy (low confidence in presenting → milestone includes a low-stakes practice presentation first)
- **Check-in questions** — reference specific profile data ("You said fairness is your top value — does this milestone connect to that?")
- **Drift detection** — if a student's work drifts from their stated interest/problem area, mentor can gently redirect
- **Teacher dashboard** — teacher sees class-wide archetype distribution, resource gaps, confidence patterns

---

## Part 5: The Reveal System (The Secret Sauce)

Every station ends with a **reveal** — a beautifully designed card that shows the student what they just learned about themselves. This is the 16Personalities magic applied to project readiness.

### Reveal Types:

**Station 1:** Quick-Fire Summary — "You're a [morning/night] [planner/starter] who prefers [solo/team] work and [talks/writes] things through."

**Station 2:** Design Archetype Card — Full card with:
- Archetype name + icon (e.g., "The Maker 🔧")
- 2-sentence description
- "Famous exemplars" (real designers/makers who share this archetype)
- Primary colour (feeds the game world's colour palette for the rest of the journey)

**Station 3:** Interest Map — Visual cluster diagram with labelled nodes showing their interests + lines connecting related ones. The AI highlights an unexpected connection.

**Station 4:** Empathy Compass — A compass graphic pointing toward their problem area. Shows scale (personal → global), urgency, and the connection to their interests.

**Station 5:** Resource Radar — A radar/spider chart showing their self-efficacy across 6 domains + a simple resource inventory summary.

**Station 6:** Door Card — The chosen direction with a 2-sentence summary + excitement meter.

**Station 7:** Full Designer Profile — All previous reveals combined into one comprehensive card. Shareable. Saveable. Referenced throughout the rest of the project.

### The Grand Reveal (Station 7) should feel like:
- Unlocking a character in a game
- Getting your Hogwarts house
- Seeing your 16Personalities result for the first time
- The student goes "wait, that's actually me"

---

## Part 6: Timing Budget

| Station | Name | Duration | Activities | Text Prompts |
|---------|------|----------|-----------|-------------|
| 1 | The Campfire | 5-7 min | 5 | 0 |
| 2 | The Workshop | 7-9 min | 6 | 1 |
| 3 | The Collection Wall | 7-9 min | 7 | 0 (irritation has optional text) |
| 4 | The Window | 6-8 min | 7 | 1 |
| 5 | The Toolkit | 5-7 min | 8 | 0 |
| 6 | The Crossroads | 8-10 min | 8 | 0-1 (custom door is optional) |
| 7 | The Launchpad | 5-7 min | 7 | 1 |
| | **Transitions** | 3-5 min | walking + dialogue | 0 |
| | **TOTAL** | **46-62 min** | **~48** | **3 (+ 1 optional)** |

**Interaction breakdown:**
- Binary choices / quick-fire: ~14 (29%)
- Scenario responses: ~9 (19%)
- Card sorts / drag ranking: ~4 (8%)
- Visual scene / icon selection: ~7 (15%)
- Sliders: ~8 (17%)
- Text prompts: 3-4 (6-8%)
- Passive (viewing/listening): ~3 (6%)

**The 70/30 ratio holds:** ~70% clicking/selecting/dragging, ~30% reading/writing/viewing.

---

## Part 7: What Makes This Different From Everything Else

### vs. CliftonStrengths / 16Personalities
Those are personality tests. This is a **project readiness journey.** The output isn't a type — it's a specific, feasible project direction grounded in the student's actual resources and constraints. The personality data is a means to an end, not the end itself.

### vs. Current QuestDiscoveryFlow
The current implementation is a conversation (chat messages). This is a **game with stations** — each station has specific mechanics designed to extract specific data. The mentor provides narrative connective tissue, not an interrogation at each stop.

### vs. Any existing edtech self-assessment
Nobody combines personality assessment + interest mapping + empathy mapping + resource inventory + AI-generated project recommendations in a single journey with game mechanics. The closest is IB CAS's investigation stage, but that's a reflective framework, not an interactive experience.

### The key innovation
**Station cross-referencing.** Every reveal references previous stations. "You're a Maker (Station 2) who cares about accessibility (Station 4) and has workshop access (Station 5) — here's a project that uses all three." This creates the "aha" moments that make the experience feel personally meaningful, not generic.

---

## Part 8: Open Questions

1. **Can students redo individual stations?** Probably yes — interests and confidence change over time. But the project statement (Station 7) should be a deliberate reset, not casual.

2. **How does the teacher set constraints?** Before students start, the teacher configures: term length, available resources (school-wide), project scope guidelines, framework requirements. These feed into Station 5 (resource check) and Station 6 (AI-generated directions).

3. **Should the 5 mentors give different activities?** Same stations, same data extraction, but different framing/stories/scenarios per mentor personality. Kit tells a making story, Sage poses a philosophical question, Spark provokes with a controversial take. Same data out, different experience in.

4. **Save and resume?** Yes — with clear "you were at Station 3" re-entry. Each station is self-contained enough to resume without context loss.

5. **Side-scroller game fidelity?** The game world between stations can be simple (parallax scrolling, walking animation, environmental objects to click for mentor commentary). The stations themselves are where the rich interactions live. Don't over-invest in the walking game at the expense of the station UX.

6. **Accessibility?** All interactions must work without dragging (keyboard alternatives for card sorts, tab navigation for scene selection). Colour is never the only signal. Screen reader support for reveals.

7. **How does GCD/CAS fit?** The same engine works for Global Citizenship Diploma / CAS by swapping the archetype labels and adjusting the AI-generated project directions. The 6 knowledge domains are universal. The framework-specific layer is thin (which archetypes, which example projects, which assessment criteria).

---

## Part 9: Build Priority

**Phase 1: The Engine (no game, no art)**
Build the data model + interaction components + AI synthesis. Test with a basic linear flow (no side-scrolling). Validate that the data quality is dramatically better than the current chatbot approach. ~5-7 days.

**Phase 2: The Reveals**
Design and build the 7 reveal cards. This is what makes students want to share and what makes the experience feel "worth it." ~3-4 days.

**Phase 3: The Game World**
Side-scrolling world, walking animations, station transitions, environmental storytelling. This is polish, not core. ~5-8 days.

**Phase 4: Mentor Variations**
Different stories/framings per mentor. Same data extraction, different personality in the delivery. ~3-5 days.

**Do Phase 1 first. If the engine works, everything else is dressing.**
