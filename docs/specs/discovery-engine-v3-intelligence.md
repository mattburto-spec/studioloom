# Discovery Engine v3 — The AI Intelligence Layer
*How the AI shapes the experience in real-time, what data gaps remain, and why activity order matters*

**Date:** 26 March 2026
**Builds on:** discovery-engine-spec.md, discovery-engine-v2.md, discovery-engine-research-audit.md

---

## Part 1: Data Completeness Audit — Are We Missing Anything?

Before designing the AI layer, let's verify we're capturing everything needed for a student to start a self-directed project with confidence.

### What We Capture Well

| Data Need | Stations | Confidence |
|-----------|----------|------------|
| Design archetype / working style | 1 + 2 | High — 10 binary dimensions + 6 scenario responses + text prompt |
| Values hierarchy | 3 | High — 8 cards in 3 tiers |
| Interest clusters | 3 | High — icon selection + curiosity topics + irritation signals |
| Empathy targets / problems noticed | 4 | High — visual scene + narrowing + text prompt |
| Resource inventory | 5 | High — 3-tier card sort + human resources |
| Self-efficacy | 5 | High — 6 domain sliders |
| Project direction | 6 | High — 3 AI-generated options + chosen path |
| Commitment / goal | 7 | High — project statement + success criteria |

### What's Thin or Missing

| Gap | Why It Matters | Proposed Fix |
|-----|---------------|-------------|
| **Collaboration style depth** | We know solo↔team from Station 1 quick-fire, but not HOW they collaborate (lead, follow, parallel, merge). This shapes milestone design. | Add 1 collaboration scenario to Station 2: "You and a partner disagree on the design direction. You..." with 4 responses mapping to collaboration styles (Assert, Negotiate, Defer, Fork-and-merge). |
| **Learning style / information intake** | We know what they're good at but not how they LEARN best. A Maker who learns by reading is different from a Maker who learns by watching. | Add to Station 1 quick-fire: 2 pairs about learning intake (read↔watch, example↔explanation). Lightweight — 6 extra seconds. |
| **Emotional relationship to the project** | Excitement slider exists (Station 6/7) but we don't know their FEAR. Fear of failure? Fear of being judged? Fear of not finishing? This predicts dropout. | Add 1 question to Station 6 after door selection: "The thing that scares me most about this project is..." with 5 illustrated scenario cards (failing publicly, not finishing, it being boring, people not caring, not being good enough). No text needed — the selection IS the data. |
| **Social context / audience awareness** | Who will SEE this project? Classmates? Teachers? Public? Community? The audience shapes ambition and anxiety differently. | Add to Station 5: "Who will see your finished work?" icon selection (just me, my class, my teacher, my school, the community, online/public). This affects AI project scope suggestions. |
| **Prior domain knowledge** | A student choosing an accessibility project who already uses a wheelchair vs one who's never thought about it — very different starting points. | The text prompt at Station 4 ("What shouldn't be this hard?") partially captures this. Enhance: after the visual scene selection, add "Have you experienced this yourself?" (yes/no/someone close to me). 5 seconds, huge signal. |
| **Creative confidence vs technical confidence** | Station 5 sliders mix them (making, presenting, writing are different TYPES of confidence). A student might be terrified of sketching but confident building. | Split "making" into "making with hands" and "sketching/drawing" in the self-efficacy sliders. Add "coming up with ideas" as a 7th domain. Now 7 sliders instead of 6. 10 extra seconds. |
| **Time horizon awareness** | We capture hours/week but not whether they understand what 8 weeks actually FEELS like. Year 7 students are famously bad at long-term time estimation. | Add 1 calibration question to Station 5: "8 weeks from now feels..." with a slider from "ages away" to "basically tomorrow." This calibrates the AI's scope recommendations — a student who thinks 8 weeks is forever needs tighter milestones. |

### Revised Data Point Count

Original spec: ~30 explicit data points + stealth behavioral layer
After filling gaps: ~38 explicit data points + stealth behavioral layer + ~25 behavioral composite signals

**No new stations needed.** The 7 additions above add ~90 seconds total to the journey (all clicking). They slot into existing stations without disrupting flow.

---

## Part 2: How AI Works In the Background

This is the core innovation. The AI isn't just scoring responses at the end — it's actively shaping the experience at 5 levels while the student moves through stations.

### Level 1: Real-Time Adaptation Within Stations

The AI processes each response immediately and adjusts the NEXT activity within the same station.

**Station 2 Example — Archetype Emerging Mid-Station:**

The student does 3 of 6 scenario responses. After 3, the AI has a preliminary archetype signal:
- If archetype is already clear (one type scoring 70%+ after 3 scenarios): the remaining 3 scenarios become **confirmation scenarios** — they test the edges of the archetype. "You're looking like a Maker — but let's see... what about when the PLAN is more important than the PRODUCT?" This deepens the profile instead of redundantly confirming what's obvious.
- If archetype is split (two types tied after 3 scenarios): the remaining 3 scenarios become **differentiator scenarios** — they specifically target the dimensions that distinguish the two tied types. More diagnostic, less generic.
- If all types are low (student is scattered or answering inconsistently): the AI notes this as an identity-exploration signal (healthy at this age per Erikson). Remaining scenarios become broader. Reveal acknowledges the exploration: "You're not one type — you're a blend. That's actually rare and powerful."

**Station 4 Example — Scene Interaction Depth:**

The student clicks 3 things in the community scene. The AI analyzes:
- If all 3 are PEOPLE problems (lonely student, excluded group, overwhelmed teacher): the "zoom in" step focuses on WHO they want to help. Empathy target = people-centered.
- If all 3 are SYSTEM problems (broken fountain, steep ramp, outdated poster): zoom-in focuses on WHAT system is broken. Empathy target = systems-centered.
- If mixed: zoom-in asks them to choose between a person problem and a system problem — this forced choice is itself a diagnostic.
- If they only clicked 1-2 things (low engagement or focused attention): the scene subtly highlights 2 more things they might have missed. "Look closer — anything else?" Second chance isn't pushy, it's scaffolding.

**Station 5 Example — Self-Efficacy Calibration:**

As the student moves through the 7 confidence sliders, the AI watches for patterns:
- If ALL sliders are high (>80): likely overconfidence or social desirability. The mentor gently challenges: "That's impressive — but I want to dig deeper. Which one are you LEAST confident in?" Forces differentiation.
- If ALL sliders are low (<30): possible anxiety, imposter syndrome, or genuine beginner. The mentor reframes: "Low scores aren't bad — they're honest. And honest people build better projects because they know where they need help."
- If there's a spike (one domain much higher than others): the AI highlights this as their superpower. "Everything else is developing — but THIS is where you're already strong."

### Level 2: Cross-Station Intelligence (Between Stations)

After each station completes, the AI synthesizes ALL data so far and adjusts the NEXT station's content.

**Station 1 → Station 2 Adaptation:**

The 10 quick-fire binary choices from Station 1 give the AI a working style vector. This pre-loads Station 2:
- If the student is a "planner" type (planned>improvise, structured>flexible): Station 2 scenarios are framed with planning language. "You've got a project that needs organising..."
- If they're a "doer" type: scenarios are framed with action language. "You've got a project that needs STARTING..."
- The mentor's failure story (2.1) is selected from a pool based on working style match — a planner hears about a time the mentor over-planned and missed the deadline; a doer hears about jumping in without thinking.

**Station 2 + 3 → Station 4 Adaptation:**

By the time the student reaches the Window (Station 4), the AI knows their archetype AND interests. The community scene can be subtly weighted:
- A Maker who likes technology might see more tech-related problems highlighted in the scene (subtle glow on the broken water fountain's sensor, emphasis on the outdated digital poster)
- A Communicator who values fairness might see social problems highlighted (the excluded group, the lonely student)
- The scene contains ALL hotspots regardless — but the AI adjusts which 2-3 have subtle visual emphasis (brighter glow, slight animation). This guides without constraining. If they click something unexpected, that's an even STRONGER signal.

**Stations 2-4 → Station 5 Adaptation:**

The readiness check (Station 5) adjusts its framing based on the emerging project direction:
- If the student's archetype + interests + empathy target are pointing toward a physical making project: the resource cards emphasize workshop access, materials, tools. "Budget" becomes more important.
- If pointing toward a research/communication project: resource cards emphasize internet access, interview subjects, presentation equipment. "Quiet workspace" becomes more important.
- The self-efficacy domains are presented in ORDER of relevance to the emerging direction. If they're heading toward a making project: "making with hands" is first (most important to assess), "presenting" is last.

**Stations 2-5 → Station 6 Adaptation (The Big One):**

Station 6 is where the AI does its most sophisticated work — generating 3 project directions from ALL previous data. This isn't random — it's constrained optimization:

```
Direction 1: "Sweet Spot" — highest overlap between archetype, interests, empathy target, AND resources
Direction 2: "Stretch" — matches archetype + interests but requires growing into a resource gap (eg. needs to find a mentor, or learn a skill)
Direction 3: "Surprise" — AI-identified non-obvious connection that the student hasn't explicitly made (eg. "You said you like technology AND you noticed the ramp was too steep — what about sensor-based accessibility solutions?")
```

The 3 doors are deliberately different in ambition level:
- Door 1: achievable with current resources (confidence builder)
- Door 2: requires growth but realistic (development opportunity)
- Door 3: unexpected angle that might spark something (creative leap)

**If the student's self-efficacy was very low:** Door 1 is gentler, Door 3 is less ambitious. The AI calibrates to the student's confidence.
**If self-efficacy was very high:** All 3 doors are more ambitious. The AI challenges rather than comforts.

### Level 3: Mentor Personality Modulation

The chosen mentor (Station 1) affects HOW all AI content is delivered, not WHAT is assessed.

| Mentor | Framing Style | Challenge Style | Reveal Style |
|--------|--------------|-----------------|-------------|
| **Kit** (Maker) | "Let me show you something I built..." | "What if you tried making it instead of planning it?" | Warm, craft metaphors ("Your profile is like a well-stocked workshop") |
| **Sage** (Questioner) | "Here's a question I've been thinking about..." | "But have you considered the opposite?" | Thoughtful, question-ending ("Your profile raises an interesting question...") |
| **River** (Storyteller) | "That reminds me of a student I once knew..." | "What would the hero of YOUR story do here?" | Narrative, story arc ("Your profile reads like the opening chapter of...") |
| **Spark** (Provocateur) | "I'm going to say something controversial..." | "That's a safe answer. What's the REAL answer?" | Direct, slightly edgy ("Your profile says you're not afraid of...") |
| **Haven** (Quiet Builder) | "I noticed something interesting about what you just did..." | "Take a moment. What does your gut say?" | Gentle, observational ("Your profile is quieter than most — and that's a strength") |

The mentor personality doesn't change the DATA collected — it changes the emotional texture. A nervous student with Haven gets patience and space. The same nervous student with Spark gets pushed (constructively). The student's mentor CHOICE is itself a signal about what communication style they respond to.

### Level 4: Adaptive Pacing (Extension/Compression)

Not every student needs the same depth at every station. The AI detects engagement and adjusts:

**Extension Triggers (go deeper, add activities):**
- Student is spending significantly longer than average on a station (high engagement, not confusion — disambiguated by behavioral signals: slow + lots of clicks = engaged; slow + few clicks = confused)
- Student clicked "learn more" or explored optional content (curiosity signal)
- Station data is unusually rich or complex (eg. they clicked 6 things in the scene instead of the expected 2-3 — they're observant, give them more to explore)

**Extension activities (pre-built, deployed on demand):**
- Station 2: "I want to explore this more" → 2 additional archetype scenarios that test edge cases
- Station 3: "Your interests are really varied" → pile-naming card sort (group your interests and name the groups — cognitive style assessment, only for 14+)
- Station 4: "You noticed a lot" → "Pick one and tell me more" expanded empathy interview (3 quick scenario questions about the chosen problem)
- Station 5: "Let's go deeper on skills" → domain-specific sub-sliders (eg. "making" expands to: woodwork, textiles, electronics, cooking, 3D printing)

**Compression Triggers (speed up, skip optional):**
- Student is clicking very fast through activities (< 2 sec per response — rushing)
- Low engagement signals: tab switches, minimal exploration, center-hugging sliders
- Student has clicked "Skip" or tried to advance past an activity

**Compression actions:**
- Skip mentor stories (passive viewing sections)
- Reduce scenario count (6 → 4 at Station 2 if archetype is already clear after 3)
- Combine activities (values ranking + irritation selection in one screen instead of two)
- Shorter reveal animations (quick fade instead of full confetti sequence)

**The time budget flexes:** The 46-62 minute range exists because of this. A deeply engaged student gets the full 60+ minutes with extensions. A rushing student gets a tighter 40-minute experience. Both get valid profiles because the core data collection is the same — only the depth varies.

### Level 5: Novel Cross-Domain Insights

This is where the AI does something no linear quiz or personality test has ever done. Because we're combining 6 data domains in a single journey, the AI can detect relationships between domains that have NEVER been studied together:

**Archetype × Empathy Pattern:**
- A Maker who notices system problems → "Infrastructure Designer" (builds physical solutions to system failures)
- A Maker who notices people problems → "Assistive Technologist" (builds tools/devices for individuals)
- A Researcher who notices people problems → "User Researcher" (studies human needs systematically)
- A Researcher who notices system problems → "Policy Analyst" (investigates root causes in systems)
- These 12 combinations (6 archetypes × 2 empathy orientations) create more specific project archetypes than either framework alone

**Values × Self-Efficacy Tension:**
- Top value is "Fairness" but self-efficacy for "presenting" is very low → the student cares deeply about advocacy but is terrified of speaking up. AI insight: "You want to fight for fairness but presenting scares you. Your project could be a designed ARTIFACT that speaks for you — a poster, an installation, a prototype that communicates without you having to stand up and talk."
- Top value is "Creating beauty" but self-efficacy for "sketching" is very low → they have aesthetic sensibility but lack drawing confidence. AI: "You see beauty but you're not confident drawing yet. What about photography, collage, or digital tools? Beautiful design isn't just drawing."

**Working Style × Resource Constraints:**
- "Jump in and start" working style + low time budget (2 hrs/week) → danger of starting too many things and finishing nothing. AI proactively: "You like to start fast — which is great. But with only 2 hours a week, pick ONE thing and protect that time. Your first milestone is a single prototype, not three."
- "Planner" working style + high time budget (8+ hrs/week) → danger of over-planning and never building. AI: "You have plenty of time — which means you might spend 4 weeks planning and only 4 building. Set a rule: planning stops at Week 2, building starts Week 3 no matter what."

**Interest Cluster × Collaboration Style:**
- Highly diverse interests (5+ unrelated icons) + solo worker → Renaissance person working alone. Fine for individual projects, but AI suggests: "Your interests are incredibly broad. You might benefit from a collaborator who's deep where you're broad."
- Narrow interests (3 closely related icons) + team worker → specialist seeking teammates. AI suggests: "You know exactly what you care about. Find teammates who cover your blind spots — you'll go deeper together."

**Fear × Archetype:**
- Fear of "not finishing" + Maker archetype → classic Maker trap (start exciting, abandon when hard). AI: "Every Maker I know has a graveyard of unfinished projects. Your first milestone is FINISHING something small, not STARTING something big."
- Fear of "people not caring" + Communicator archetype → needs audience validation to sustain effort. AI: "You need to know people care. Build in an early feedback moment — show something rough to 3 people in Week 2. Their reactions will fuel you."
- Fear of "not being good enough" + Creative archetype → perfectionism paralysis. AI: "Creatives who wait until it's perfect never ship. Your first milestone is sharing something you're 60% happy with."

**Time Horizon Awareness × Experience Level:**
- "8 weeks feels like ages away" + no prior project experience → will procrastinate, then panic. AI sets WEEKLY milestones with very tight accountability.
- "8 weeks feels like basically tomorrow" + experienced → realistic understanding, can handle longer milestone gaps.

### The AI's Decision Matrix

At each decision point, the AI evaluates:

```
CONTEXT = {
  archetype_confidence: 0-100,       // how clear is their archetype?
  engagement_level: high/medium/low,  // from behavioral signals
  consistency_score: 0-100,           // are their answers coherent?
  age_band: 12-13 / 14-15 / 16,     // from class settings
  mentor_style: kit/sage/river/spark/haven,
  stations_completed: 0-7,
  data_richness: sparse/moderate/rich, // how much signal do we have?
  time_spent: minutes,
  time_remaining: estimated minutes,
}

DECISIONS = {
  extend_or_compress: extend / normal / compress,
  scenario_difficulty: introductory / standard / challenging,
  reveal_depth: brief / standard / detailed,
  next_activity_selection: from pool of pre-built activities,
  mentor_tone: encouraging / neutral / challenging,
  project_ambition_level: gentle / moderate / ambitious,
  cross_reference_depth: light / medium / deep,
}
```

---

## Part 3: Does Activity Order Matter?

**Yes — significantly.** And the current linear order (1→2→3→4→5→6→7) is good but not optimal for everyone. Here's why:

### Why the Current Order Works

The spec's station order follows a psychological progression:

1. **Campfire (ice-breaker)** — low stakes, builds trust with mentor
2. **Workshop (identity)** — "who am I?" comes before "what do I care about" because identity is the lens through which you see everything else
3. **Collection Wall (interests)** — now that you know WHO you are, what GRABS your attention?
4. **Window (empathy)** — now look OUTWARD with your identity + interests as a lens
5. **Toolkit (resources)** — reality check against dreams
6. **Crossroads (synthesis)** — AI combines everything
7. **Launchpad (commitment)** — commit and go

This follows the classic self-discovery arc: **self → world → intersection → action.** It's sound psychology (Erikson's identity formation → Bandura's self-efficacy → goal commitment).

### But Different Students Need Different Orders

**The Anxious Student (behavioral composite: low confidence, center-hugging sliders, slow decisions):**
- Current order problem: Station 2 (identity) is high-stakes early. Being asked "who are you?" when you're anxious is the WORST opening.
- Better order: Start with Station 3 (interests — low stakes, just pick things you like) → Station 4 (look at problems — externally focused, takes pressure off self) → THEN Station 2 (now that they're warmed up and have context, identity questions feel less threatening)
- Reordered: 1 → 3 → 4 → 2 → 5 → 6 → 7

**The Confident Doer (behavioral composite: fast decisions, high self-efficacy, action-oriented):**
- Current order problem: Stations 2-4 feel slow. They already know who they are and what they care about. They want to GET TO THE PROJECT.
- Better order: Compress Stations 2-4 (fewer scenarios, faster reveals) → expand Station 6 (more project options, deeper feasibility analysis)
- Reordered: same sequence but compressed 2-4, expanded 6

**The Explorer (behavioral composite: slow but engaged, clicks everything, revisits):**
- Current order works fine — they'll spend extra time at every station and the extension activities will fire. Give them the full 60+ minutes.
- Enhancement: allow them to REVISIT stations after completion (with a "your data might change" warning)

### The Adaptive Ordering System

Rather than a fixed order for everyone, the AI makes a routing decision after Station 1:

```
After Station 1 (quick-fire + mentor selection):

IF behavioral_composite == 'anxious_rusher':
  → Route: 1 → 3 (interests, low stakes) → 4 (external focus) → 2 (identity, now warmed up) → 5 → 6 → 7
  → Reason: build confidence with easy wins before high-stakes identity questions

ELIF behavioral_composite == 'confident_decider':
  → Route: 1 → 2 (fast) → 3 (fast) → 4 (fast) → 5 → 6 (expanded) → 7
  → Reason: they know themselves, spend more time on project design

ELIF archetype_emerging == 'strong_signal' after Station 1:
  → Route: standard (1 → 2 → 3 → 4 → 5 → 6 → 7)
  → Reason: clear identity, standard progression works

ELIF age_band == '12-13':
  → Route: 1 → 3 (concrete interests) → 2 (identity through interests lens) → 4 → 5 → 6 (2 doors not 3) → 7
  → Reason: younger students find "what do you like?" easier than "who are you?"

ELSE:
  → Route: standard (1 → 2 → 3 → 4 → 5 → 6 → 7)
```

**In the game world:** The side-scroller has ALL stations visible as locations. The mentor GUIDES the student to the next station ("Follow me — I want to show you something"). The route the mentor takes through the world changes based on the AI's routing decision. The student CAN wander off-path (click on a different station) — and that choice itself is a signal (independence, curiosity, or confusion).

### Station Dependencies (What MUST Come Before What)

Some ordering constraints are hard — the data from earlier stations is REQUIRED for later ones:

| Station | Hard Dependencies | Soft Dependencies |
|---------|------------------|-------------------|
| 1 (Campfire) | None — always first | — |
| 2 (Workshop / Archetype) | Station 1 (working style feeds scenario selection) | Better after 3 for anxious students |
| 3 (Collection Wall / Interests) | None — can be done anytime after 1 | Benefits from archetype context (2) |
| 4 (Window / Empathy) | None — can be done anytime after 1 | Benefits from interests (3) to weight scene emphasis |
| 5 (Toolkit / Resources) | Needs archetype (2) + interests (3) + empathy (4) to contextualize resource relevance | Can't meaningfully compress — all data needed |
| 6 (Crossroads / Direction) | **HARD: Needs 2, 3, 4, 5 completed** — AI can't generate project directions without all 4 | — |
| 7 (Launchpad / Commitment) | **HARD: Needs 6 completed** — can't commit to a direction without choosing one | — |

**Flexible zone:** Stations 2, 3, 4 can be reordered freely. Station 5 needs 2+3+4 done. Station 6 needs all. Station 7 needs 6.

This means 3 valid orderings of the middle section:
- Default: 2 → 3 → 4 (self → interests → world)
- Anxious: 3 → 4 → 2 (interests → world → self)
- Interest-first: 3 → 2 → 4 (interests → self → world)

### Novel Cross-Station Relationships

Because these activities have never been done together in this combination, there are interaction effects that no prior research has studied. We should LOG these and look for patterns:

**Hypothesis 1: Mentor choice predicts archetype**
- Students who choose Kit (Maker) disproportionately score as Maker archetype
- Students who choose Sage (Questioner) disproportionately score as Researcher
- When mentor ≠ archetype, that's interesting — it means they're ATTRACTED to a style they don't naturally have. Log this as "aspiration signal."

**Hypothesis 2: Quick-fire speed predicts text prompt quality**
- Fast decision-makers in Station 1 write shorter, more concrete text prompts
- Slow decision-makers write longer, more nuanced text prompts
- This could validate (or invalidate) the speed-as-confidence stealth signal

**Hypothesis 3: Scene click order predicts values**
- Students who click people first in the scene → top value is Helping Others or Community
- Students who click systems first → top value is Solving Problems or Fairness
- If scene clicks DON'T correlate with values, that's a data quality warning (one of the two signals is unreliable)

**Hypothesis 4: Interest breadth predicts project scope realism**
- Students with 7 diverse interests → more likely to propose overly ambitious projects at Station 6
- Students with 3 focused interests → more likely to propose focused, achievable projects
- AI can use this to calibrate project suggestion ambition

**Hypothesis 5: Self-efficacy shape predicts dropout risk**
- Students with one HIGH spike and everything else low → higher completion (they have a "home base" skill)
- Students with all-medium scores → moderate completion (jack of all trades, master of none → less clear project direction)
- Students with all-low scores → highest dropout risk (need the most scaffolded milestones)

**Hypothesis 6: Fear × archetype is the strongest predictor of project success**
- This combination has literally never been studied. No personality test captures FEAR, and no project planning tool captures ARCHETYPE. We'll be the first to see whether Maker + fear-of-not-finishing predicts differently from Researcher + fear-of-not-finishing.

**Data science opportunity:** After 100+ students complete the journey, we'll have a dataset that correlates 38 explicit data points + 25 behavioral signals + project outcomes (completion, quality, growth). This dataset could reveal which early signals ACTUALLY predict project success — and we can feed those findings back into the AI to make better recommendations.

---

## Part 4: The AI Processing Pipeline

Here's exactly when and how the AI fires during the journey:

### Synchronous (Blocking — Student Waits)

| Trigger | AI Task | Model | Latency Target | Output |
|---------|---------|-------|----------------|--------|
| After Station 2 | Generate archetype reveal narrative | Haiku 4.5 | <2 sec | 2-sentence archetype description + exemplars |
| After Station 3 | Identify cross-domain interest connections | Haiku 4.5 | <2 sec | 1-2 unexpected connections for Interest Map reveal |
| After Station 4 | Synthesize archetype + interests + empathy into insight | Haiku 4.5 | <3 sec | "These three things point somewhere..." bridge to Station 5 |
| After Station 5 | Generate readiness assessment + gap identification | Haiku 4.5 | <2 sec | Readiness Radar data + mentor gap commentary |
| Station 6 door generation | Generate 3 project directions from ALL data | Sonnet 4 | <5 sec | 3 structured ProjectDirection objects (title, description, feasibility, excitement prompt) |
| After Station 7 | Generate full profile narrative + Ikigai mapping + feasibility validation | Sonnet 4 | <5 sec | Grand Reveal content (multi-paragraph profile + Ikigai circle contents + feasibility score) |

### Asynchronous (Background — Student Doesn't Wait)

| Trigger | AI Task | Purpose |
|---------|---------|---------|
| Every activity completion | Update behavioral composite scores | Inform next activity selection |
| Station transitions | Pre-generate next station's adapted content | Have mentor stories / scenario framings ready |
| After Station 4 | Pre-generate Station 6 directions (draft) | Get a 3-second head start on the expensive Sonnet call |
| After Grand Reveal | Generate teacher dashboard summary | Teacher sees profile without delay |
| After Grand Reveal | Compute cross-domain insights | Novel correlations for data science logging |
| After each check-in meeting | Update evolving profile + growth narrative | Keep longitudinal data fresh |

### Cost Estimate Per Student Journey

| Calls | Model | Avg Tokens | Cost |
|-------|-------|-----------|------|
| 5 | Haiku 4.5 | ~500 in + 200 out each | ~$0.005 |
| 2 | Sonnet 4 | ~2000 in + 800 out each | ~$0.05 |
| 6 follow-up meetings × 2 calls | Haiku 4.5 | ~400 in + 150 out each | ~$0.006 |
| **Total per student lifecycle** | | | **~$0.06** |

Very affordable. The expensive Sonnet call (Station 6 door generation) is justified because it's the moment where AI quality most impacts student experience.

---

## Part 5: Revised Activity Count With All Additions

| Station | Original Activities | Added | New Total | Time Impact |
|---------|-------------------|-------|-----------|-------------|
| 1 (Campfire) | 5 | +2 learning style pairs in quick-fire | 5 (pairs increased from 10→12) | +6 sec |
| 2 (Workshop) | 6 | +1 collaboration scenario | 7 | +20 sec |
| 3 (Collection Wall) | 7 | — | 7 | — |
| 4 (Window) | 7 | +1 "experienced this yourself?" binary | 8 | +5 sec |
| 5 (Toolkit) | 8 | +1 audience awareness, +1 time horizon, +1 creative confidence split | 11 | +45 sec |
| 6 (Crossroads) | 8 | +1 fear identification | 9 | +15 sec |
| 7 (Launchpad) | 7 | — | 7 | — |
| **TOTAL** | **48** | **+7** | **54** | **+91 sec (~1.5 min)** |

**Revised timing: 48-64 minutes** (was 46-62). The additions are all sub-30-second interactions. The time budget stays within the 45-60 minute target with compression, or extends to 64 for deeply engaged students with extensions firing.

---

## Part 6: What We'll Learn That Nobody Else Knows

After launching, we'll have a dataset combining:
- Personality/archetype data (adapted CliftonStrengths)
- Character strengths/values (adapted VIA)
- Ikigai convergence mapping
- Developmental asset readiness (adapted Search Institute)
- Domain-specific self-efficacy (adapted Bandura)
- Behavioral decision-making patterns (adapted Pymetrics)
- Empathy mapping (adapted IDEO/d.school)
- Project fear profiles (novel — nobody measures this)
- AND longitudinal project outcomes

This combination has never existed. Every existing tool measures ONE domain (personality OR strengths OR interests OR readiness). We measure ALL of them in context, with behavioral validation, and then track what actually happens over the following weeks. The cross-domain insights section in Part 2 is just hypotheses — the real insights will emerge from the data.

**This is the long-term competitive moat.** The engine gets smarter with every student. After 1,000 students, the AI can say: "Students with your profile who chose Door 2 completed their projects 73% of the time. Students who chose Door 1 completed 91% of the time. I'd recommend Door 1 for you." No personality test can do this because they don't track outcomes.
