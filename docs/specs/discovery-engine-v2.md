# Discovery Engine v2 — Framework Mapping, Stealth Layer, Visualizations & Ongoing Journey
*Building on discovery-engine-spec.md + discovery-engine-research-audit.md*

**Date:** 26 March 2026
**Status:** Design spec — ready for review before build

---

## Part 1: Which Frameworks Feed Which Data (And How We Make Them Engaging)

The 4 frameworks Matt identified each solve a different piece of the puzzle. Here's exactly what we're borrowing, what data it produces, and how it manifests in the journey.

### 1.1 — From 16Personalities: The Interaction Pattern (Not the Content)

We're NOT building another MBTI. We're stealing the **UX pattern** that makes millions of teens take it voluntarily:

| 16P Pattern | What We're Borrowing | Where It Lives In Our Journey |
|-------------|---------------------|-------------------------------|
| Binary forced choice (Agree/Disagree spectrum) | The core interaction mechanic — forced choices with no middle ground | Station 1 quick-fire (10 pairs), Station 2 scenario responses (6), scattered throughout |
| 10-minute sweet spot | Each station is 5-9 min. No single station overstays. Students can quit between stations and come back. | All stations |
| Immediate reveal + identity label | Every station ends with a reveal card. Station 2 gives the archetype name. | 7 station reveals + Grand Reveal |
| "I'm an INFP" shareable moment | Design Archetype card: "I'm a Maker" with color, icon, exemplars. Instagram-story format (9:16). | Station 2 reveal, Station 7 Grand Reveal |
| No bad types | Every archetype is celebrated. "The Researcher isn't better than The Maker — they're different." | Mentor framing at Station 2. All reveal descriptions are strength-focused. |
| Intrigue → engagement → surprise → recognition → validation → sharing | This IS our emotional arc. Campfire (intrigue) → stations (engagement) → reveals (surprise) → "that's actually me" (recognition) → mentor validation → shareable profile (sharing). | End-to-end journey structure |

**What we're NOT borrowing:** MBTI's dichotomies (introvert/extravert, thinking/feeling). These are personality TYPE categories. We need design-specific STRENGTH dimensions. The archetypes are ours.

**Data produced:** 10 binary working-style dimensions + 6 archetype scores (0-100 each, from scenario responses)
**Interaction ratio:** 100% clicking. Zero typing. This is pure 16P.

---

### 1.2 — From VIA Character Strengths: The Values & Character Layer

VIA is the most research-backed character assessment for this age group (Youth Survey validated for ages 13-17, published by Peterson & Seligman). We're borrowing the **strengths-as-values** concept — not the full 240-item survey.

| VIA Concept | What We're Borrowing | Where It Lives |
|-------------|---------------------|----------------|
| 24 strengths across 6 virtues | Simplified to **8 value cards** that map to design-relevant character strengths | Station 3 values ranking |
| Character > personality | Framing: "Values tell you what kind of designer you'll be. Personality tells you how you'll work." | Mentor framing at Station 3 |
| Youth Survey format (age 13-17) | Scenario-based, not abstract. "When someone disagrees with me, I..." not "I value fairness." | Station 3 irritation scenarios, Station 6 risk check |
| Top 5 "signature strengths" | Our values ranking forces a hierarchy — top 3 become "signature values" in the profile | Station 3 reveal (Interest Map includes values overlay) |

**Our 8 value cards (mapped from VIA's 24 → design relevance):**

| Our Card | VIA Strengths Mapped | Design Relevance |
|----------|---------------------|-----------------|
| Helping others | Kindness, Teamwork | Service design, accessibility, user advocacy |
| Creating beauty | Appreciation of Beauty, Creativity | Aesthetic design, craft, visual communication |
| Solving problems | Judgment, Prudence, Perspective | Engineering design, systems design, optimization |
| Independence | Bravery, Self-regulation | Entrepreneurial design, solo practice |
| Fairness & justice | Fairness, Citizenship | Inclusive design, social design, activism |
| Learning new things | Curiosity, Love of Learning | Research-led design, emerging tech |
| Leading & influencing | Leadership, Social Intelligence | Design management, persuasion, communication |
| Community & belonging | Love, Gratitude, Humility | Participatory design, co-design, place-making |

**Data produced:** 8 values in ranked order (tier 1: Core, tier 2: Important, tier 3: Nice). Top 3 become "signature values."
**Interaction:** Drag cards into 3 tiers. ~60 seconds. 100% clicking/dragging.

---

### 1.3 — From Ikigai: The Convergence Engine (Station 6 + Grand Reveal)

Ikigai is the synthesis framework — it doesn't generate NEW data, it maps the data we already have into a convergence diagram. This is the most important visualization moment in the entire journey.

| Ikigai Circle | Our Data Source | Station |
|---------------|----------------|---------|
| **What you love** (passion) | Interest icons (5-7 selected), curiosity topics, irritation signals | Station 3 |
| **What you're good at** (profession/skill) | Design archetype, self-efficacy scores, observable strengths | Stations 2 + 5 |
| **What the world needs** | Scene selections, primary empathy target, problem articulation | Station 4 |
| **What you can be ~~paid for~~ supported to do** (viability for students) | Resource inventory, time budget, human resources, teacher constraints | Station 5 + teacher config |

**The visual:** At the Grand Reveal (Station 7), the student sees an animated Ikigai diagram where their actual data fills each circle, and the overlapping center — where all 4 converge — contains their project direction. This is the moment the AI says "this is where YOUR strengths, interests, problems, and resources all point."

**Why this is powerful for 12-16 year olds:** Most students have never seen their own data presented as a convergence. They think in fragments ("I like art" + "I hate how the playground is ugly" are separate thoughts). The Ikigai diagram shows them these fragments are actually ONE project waiting to happen. That's the "aha."

**Adaptation for school context:** The 4th circle is NOT "what you can be paid for" — it's "what's realistic given your resources and constraints." This is honest: a student with 2 hours/week and no workshop access shouldn't aim for a physical product. The AI uses Station 5 data to calibrate project scope.

**Data produced:** No new data. Ikigai is a VISUALIZATION of existing data. But the student's reaction to seeing it (excitement slider, edits to project statement) is itself data.
**Interaction:** Passive viewing of animated diagram → excitement slider → project statement edit. ~90% viewing, ~10% interacting.

---

### 1.4 — From Search Institute's 40 Developmental Assets: The Readiness Check

This is the most underrated framework. Search Institute researched 1M+ students grades 6-12 and found that students with more "developmental assets" (both internal and external) achieve dramatically better outcomes. The insight: **it's not just about WHO the student is — it's whether they have the INFRASTRUCTURE to succeed.**

| Asset Category (Search Institute) | What We're Checking | Where It Lives |
|-----------------------------------|--------------------|-|
| **External: Support** | "Your People" — mentor, collaborator, expert, peer, family | Station 5 (icon selection) |
| **External: Empowerment** | Does the student feel they CAN make a difference? Prior action on problems? | Station 4 (prior action question), Station 5 (experience level) |
| **External: Boundaries & Expectations** | Teacher constraints, term length, project scope guidelines | Teacher config (pre-set), referenced at Station 6 |
| **External: Constructive Use of Time** | Hours available, competing demands, time realism | Station 5 (time slider) |
| **Internal: Commitment to Learning** | Curiosity signals, rabbit holes, completion of optional content | Stealth: dwell time on mentor stories, "learn more" clicks, optional exploration |
| **Internal: Positive Values** | Values hierarchy, empathy target specificity, fairness orientation | Station 3 (values ranking), Station 4 (empathy compass) |
| **Internal: Social Competencies** | Team scenario responses, help-seeking pattern, conflict response | Station 2 (group project scenario), Station 5 (failure response) |
| **Internal: Positive Identity** | Self-efficacy scores, confidence fingerprint, excitement level | Station 5 (6-domain sliders), Station 7 (commitment confidence) |

**What makes this powerful:** A student with high passion + low support infrastructure will fail. The AI should detect this gap and either (a) help them build infrastructure first ("Your first milestone is finding a mentor") or (b) scale the project to match what they have. This is what no personality test does — it checks whether the ENVIRONMENT supports the ambition.

**Visualization:** "Your Readiness Radar" — a spider chart at Station 5 showing 6 dimensions (Time, Skills, People, Resources, Experience, Confidence). Gaps are visible. The mentor addresses them directly: "You've got the skills and the passion, but you're low on people. Your first week should be about finding a collaborator."

**Data produced:** 6 readiness dimensions (0-100 each), asset gap identification, infrastructure recommendations
**Interaction:** Sliders + card sorts + scenario responses. 100% clicking. The readiness assessment IS Station 5.

---

## Part 2: The Stealth Assessment Layer — Full Catalog

This is the hidden engine running underneath every visible interaction. The student sees a fun journey. The system captures 40+ behavioral signals that reveal personality, confidence, cognitive style, and engagement level without asking a single question.

### 2.1 — Decision-Making Signals

| Signal | How It's Captured | What It Reveals | Reliability | Web API |
|--------|------------------|-----------------|-------------|---------|
| **Decision latency** | `Date.now()` between option render and first click | Preference strength (fast = certain, slow = deliberating) | Strong (peer-reviewed: mouse tracking + personality, PMC10084322) | ✅ Trivial |
| **Reconsideration rate** | Count of changed answers (click option A, then switch to B) | Conscientiousness (high = more changes), openness (high = more exploration) | Moderate (extrapolated from IAT research) | ✅ Event listener |
| **Exploration breadth** | At Station 6 (3 doors): do they explore all 3 before choosing, or commit after 1? | Decision style (maximizer vs satisficer) | Strong (Barry Schwartz's Paradox of Choice — maximizers explore more, satisficers commit early) | ✅ Click tracking |
| **Slider settling** | Slider position changes before final rest (oscillating vs direct) | Confidence (direct = certain, oscillating = uncertain or perfectionistic) | Moderate | ✅ onChange events |
| **Default deviation** | How far from center/midpoint they move sliders | Opinion strength / self-awareness (staying near center = unsure or moderate; extremes = confident or polarized) | Moderate | ✅ Value tracking |
| **Answer change after seeing reveal** | Do they want to go back and re-answer after seeing Station 2 archetype? | Identity exploration (Erikson) vs identity commitment | Moderate (theoretical, grounded in Marcia's identity statuses) | ✅ Navigation tracking |

### 2.2 — Attention & Engagement Signals

| Signal | How It's Captured | What It Reveals | Reliability | Web API |
|--------|------------------|-----------------|-------------|---------|
| **Dwell time per station** | Session timestamps per station entry/exit | Interest level (longest station = highest engagement) | Strong | ✅ Trivial |
| **Dwell time on reveal cards** | How long they look at each reveal before advancing | Self-recognition ("that's actually me" moments = longer dwell) | Moderate | ✅ Timer |
| **Optional content clicks** | "Learn more" links, mentor stories, exemplar bios | Intellectual curiosity (Commitment to Learning asset) | Moderate-strong (maps to VIA Curiosity/Love of Learning) | ✅ Click counter |
| **Scroll depth & speed** | Scroll events with position/timestamp | Reading thoroughness (slow scroll = reading; fast = skimming) | Moderate (extrapolated from content engagement research) | ✅ Scroll listener |
| **Tab/window switches** | `visibilitychange` event | Distraction level, engagement quality. Frequent = low engagement or multitasking style | Moderate | ✅ Page Visibility API |
| **Session breaks** | Time between last activity and next | Natural pauses (between stations = healthy), mid-station breaks (= fatigue or disengagement) | Moderate | ✅ Timestamp gaps |
| **Instruction re-reading** | Scrolling back up to instructions mid-activity | Conscientiousness (reads carefully) OR confusion (instructions unclear) — disambiguate by context | Low-moderate (ambiguous signal) | ✅ Scroll tracking |

### 2.3 — Text Input Behavioral Signals (For the 2 Text Prompts)

| Signal | How It's Captured | What It Reveals | Reliability | Web API |
|--------|------------------|-----------------|-------------|---------|
| **Time to first keystroke** | Gap between prompt render and first keydown | Reaction time / thinking style (fast = impulsive or confident; long pause = reflective or anxious) | Moderate | ✅ Keydown listener |
| **Typing speed** (chars/min) | Keydown timestamps | Fluency / confidence in self-expression | Low-moderate (typing skill is a confound) | ✅ Keydown tracking |
| **Deletion ratio** | Backspace/delete count ÷ total keystrokes | Perfectionism, self-editing, conscientiousness | Moderate (MonitoredTextarea already captures this — same pattern) | ✅ Keydown listener |
| **Pause patterns** | Gaps >3 sec mid-sentence | Thinking breaks = processing, idea generation, or uncertainty | Low-moderate | ✅ Keystroke timestamps |
| **Response length** | Word count relative to prompt type | Verbosity / introversion (short = concise/reserved; long = expressive/thorough) | Low (too many confounds — typing ability, language, screen size) | ✅ Word count |
| **Vocabulary richness** | Unique words ÷ total words (type-token ratio) | Linguistic sophistication, domain knowledge | Moderate (validated in NLP research) | ✅ Text analysis |

### 2.4 — Navigation & Session Patterns

| Signal | How It's Captured | What It Reveals | Reliability | Web API |
|--------|------------------|-----------------|-------------|---------|
| **Completion in one sitting vs multiple** | Session count per journey | Engagement level, attention span, schedule constraints | Low (too many external factors — class time, interruptions) | ✅ Session tracking |
| **Station revisits** | Going BACK to a completed station | Identity exploration (Erikson), perfectionism, or genuine interest in refining self-understanding | Moderate | ✅ Navigation events |
| **Resume point** | Where they stopped when they left | Difficulty/engagement inflection point (if everyone drops at Station 5 = it's boring or too hard) | Strong (aggregate only — individual signal is noisy) | ✅ Last-viewed station |
| **Pace variation** | Time per activity plotted across journey | Engagement curve (speeding up at end = fatigue; slowing down = deeper engagement) | Moderate | ✅ Activity timestamps |
| **Exploration of game world** | Clicks on environmental objects between stations | Curiosity, playfulness, attention to detail | Low-moderate | ✅ Click tracking |

### 2.5 — Social & Comparative Signals (If Class Comparisons Added Later)

| Signal | How It's Captured | What It Reveals | Reliability |
|--------|------------------|-----------------|-------------|
| **Do they look at class comparison data?** | Click on "see how your class answered" | Social comparison orientation | Moderate |
| **Do they change answers after seeing class data?** | Answer changes following class reveal | Conformity vs independence | Strong (classic social psych) |
| **Do they screenshot/share results?** | Share button clicks, or long-press on mobile | Engagement + identity commitment (sharing = "this is me") | Moderate |
| **Do they compare mentors with friends?** | Conversations about mentor choice (can't capture directly, but mentor choice IS shareable) | Social bonding around the experience | N/A (social, not digital) |

### 2.6 — Composite Behavioral Profiles

The individual signals above are noisy. The real value comes from **composites** — patterns across multiple signals:

**The Confident Decider:**
- Fast decision latency (<3 sec avg)
- Low reconsideration rate (<10%)
- Direct slider settling (no oscillation)
- Commits to Door 1 without exploring all 3
- Short text responses (concise, declarative)
- **Profile implication:** High self-efficacy. Can handle ambitious projects. May need to be pushed to consider alternatives.

**The Reflective Explorer:**
- Slow decision latency (5-10 sec avg)
- Moderate reconsideration (20-30%)
- Explores all 3 doors before choosing
- Long dwell on reveals (self-recognition)
- Revisits Station 2 or 3 after later stations
- **Profile implication:** Thorough, identity-exploring (healthy for this age). May need help committing. Milestone 1 = "pick one thing and start."

**The Anxious Rusher:**
- Very fast decisions (<2 sec — too fast for genuine preference)
- Center-hugging on sliders (avoiding commitment)
- Tab switches / page leaves during stations
- Minimal text input (short, vague)
- Completes journey in <30 min (rushing through)
- **Profile implication:** Disengaged or anxious. May not have meaningful profile data. Mentor should note this. Teacher flag.

**The Deep Diver:**
- Clicks all optional content ("learn more", mentor stories)
- Longest dwell on Station 4 (empathy/problems)
- Multiple text edits on project statement
- Completes in 55+ min (fully engaged)
- **Profile implication:** Highly engaged, intrinsically motivated. Give them the most ambitious project options.

### 2.7 — Implementation: The Event Stream

Every interaction emits a standardized event to an array stored in session state:

```typescript
interface BehavioralEvent {
  timestamp: number;          // Date.now()
  station: number;            // 1-7
  activity_id: string;        // e.g., "2.4" or "quick-fire-round"
  event_type:
    | 'option_viewed'         // options rendered, timer starts
    | 'option_selected'       // first click
    | 'option_changed'        // changed answer
    | 'slider_moved'          // each slider position change
    | 'slider_settled'        // final slider value (no change for 2 sec)
    | 'text_keystroke'        // each keystroke (for typing speed/pauses)
    | 'text_submitted'        // final text submitted
    | 'reveal_viewed'         // reveal card rendered
    | 'reveal_dismissed'      // moved past reveal
    | 'optional_click'        // "learn more", mentor stories, etc.
    | 'navigation'            // station entry/exit/revisit
    | 'visibility_change'     // tab switch / page hidden
    | 'scroll'                // scroll position + speed
    | 'drag_start'            // card sort / ranking drag events
    | 'drag_drop'             // card placed in final position
    | 'scene_click'           // hotspot clicked in visual scene
    ;
  value?: any;                // interaction-specific data
  duration_ms?: number;       // time since previous event (computed)
}
```

**Privacy & Ethics (CRITICAL for 12-16 year olds):**
- No mouse position tracking (too surveillance-y, minimal extra value)
- No keystroke logging of actual content (only timing/count metadata)
- All behavioral data is AGGREGATED into composite scores, never shown raw
- Teacher sees: "Engagement: High, Decision style: Reflective, Confidence: Growing"
- Teacher does NOT see: "She hesitated 8.2 seconds on the fairness question"
- Student never knows behavioral tracking exists (stealth = the point)
- Behavioral composites are SUPPLEMENTARY — they adjust AI confidence in explicit data, they don't override it
- Stored alongside DiscoveryProfile in the same session record, accessible only to the AI + teacher dashboard

---

## Part 3: Data Visualizations — The Beautiful Moments

These are the reveal moments that make the journey feel like discovering something real about yourself. Each visualization should be screenshot-worthy, emotionally resonant, and specific enough to create the "wait, that's actually me" response.

### 3.1 — Station 2 Reveal: Design Archetype Card

**Format:** Portrait card (9:16 Instagram-story ratio), screenshot-ready
**Content:**
- Archetype icon (large, centered) with archetype colour background
- Name in bold: "You're The Maker"
- 2-sentence description: "You think with your hands. When others are still planning, you're already building — and you learn more from one prototype than a hundred sketches."
- "Designers like you:" 3 real exemplars (e.g., James Dyson, Simone Giertz, a student example)
- Secondary archetype badge: "with a touch of The Researcher"
- Archetype colour bleeds into the game world palette from this point on

**UX moment:** Card animates in with a satisfying reveal (blur → sharp, scale up, confetti burst). Mentor voice: "I had a feeling. Let me tell you about someone just like you..."

### 3.2 — Station 3 Reveal: Interest Constellation

**Format:** Dark background with connected nodes (constellation/star map aesthetic)
**Content:**
- Each selected interest is a glowing node, sized by how quickly they selected it (fast = bigger = stronger signal)
- Lines connect related interests (AI-identified relationships)
- One unexpected connection highlighted in gold with a label: "Did you notice? Technology + Fairness often leads to accessibility design."
- Values orbit the constellation as smaller nodes in a different colour
- The whole thing slowly rotates (subtle parallax on scroll/tilt)

**UX moment:** Constellation builds node by node with gentle animation. Each connection line draws itself. The gold highlight is the last thing to appear — the "aha."

### 3.3 — Station 4 Reveal: Empathy Compass

**Format:** Compass graphic (circular) with directional indicators
**Content:**
- North/South axis: Personal ↔ Global (where their concern lands)
- East/West axis: Immediate ↔ Systemic (urgent fix vs root cause)
- Their primary empathy target placed on the compass with an icon
- Heat zones showing where they clicked in the community scene
- Quote from their text prompt (the thing they noticed) displayed below

**UX moment:** Compass needle spins and lands. Quadrant glows. Mentor: "Most people walked past that. You stopped."

### 3.4 — Station 5 Reveal: Readiness Radar

**Format:** Spider/radar chart with 6 axes
**Content:**
- 6 dimensions: Time, Skills, People, Resources, Experience, Confidence
- Filled area shows their current readiness shape
- Gaps highlighted with a small ⚠️ and one-line suggestion
- Overall "Readiness Score" (0-100) with a descriptive band: Getting Ready (0-40), On Track (41-70), Ready to Launch (71-100)

**UX moment:** Radar fills from center outward, dimension by dimension. Gaps pulse gently. Mentor addresses the biggest gap directly: "You're strong everywhere except People. Week 1 goal: find your collaborator."

### 3.5 — Station 7 Grand Reveal: The Full Profile + Ikigai

This is the BIG moment. 3 screens that scroll vertically:

**Screen 1: Identity Summary**
- Design Archetype card (from Station 2) — now enriched with all subsequent data
- Underneath: 3 signature values (from Station 3) as colored pills
- Working style vector as a visual spectrum bar (planner ↔ improviser, solo ↔ team, etc.)

**Screen 2: Ikigai Diagram (THE visualization)**
- Classic 4-circle Venn diagram, but animated and data-driven
- Circle 1 (What you love): populated with interest icons from Station 3
- Circle 2 (What you're good at): archetype icon + top 2 self-efficacy domains from Station 5
- Circle 3 (What the world needs): empathy target icon + problem statement excerpt from Station 4
- Circle 4 (What's realistic): resource icons from Station 5 "Have" tier + time budget
- CENTER (where all 4 overlap): the chosen project direction from Station 6
- Each circle animates in sequence, then the center glows and the project direction appears
- Labeled: "Your Design Sweet Spot"

**Adaptation for students:** The original Ikigai uses "What you can be paid for." We replace this with "What's realistic for you right now" — honest about constraints without killing ambition. The AI annotation might say: "Right now your sweet spot is [X]. As you grow your skills and resources, your sweet spot will expand."

**Screen 3: The Commitment**
- Project statement (their words) in large quote-style typography
- Success criteria as checkboxes (aspirational — these become their first milestones)
- Commitment confidence meter (the gut-check slider)
- Mentor's parting words (personalized to archetype + journey data)
- "Share Your Profile" button (generates shareable card image)
- "Begin Your Project →" CTA

**UX moment:** The Ikigai animation is the emotional peak. 4 circles appear one by one (each with a gentle sound), then converge. Center glows. Project direction text types out letter by letter. Mentor voice: "Everything you told me — your hands, your heart, what you see that others don't, and what you've got to work with — it all points here."

### 3.6 — Minor Adjustments to the Ikigai

The classic Ikigai has 4 circles creating 4 overlap zones (passion, mission, vocation, profession) plus the center. For students, simplify:

- **Don't label the overlap zones.** The overlaps are implicit. Labeling them ("this is your Mission") is abstract for 12-year-olds.
- **DO label the circles clearly** with their data sources: "Things you love" (not "Passion"), "Things you're good at" (not "Vocation"), etc.
- **The center gets the spotlight.** It's literally "your project" — make it glow, animate it, give it a name.
- **Make it interactive post-journey.** Students should be able to click any circle to see the underlying data. Click "Things you love" → the interest icons expand. Click "What the world needs" → the empathy target details appear. This turns a static diagram into a living reference they can revisit throughout the project.

---

## Part 4: The Ongoing Journey — Follow-Up Meetings

The discovery journey (Station 1-7) is Meeting 1. But the REAL value is what happens after. The student now has a profile, a project direction, and a mentor. The journey continues.

### 4.1 — Meeting Cadence

| Meeting | When | Duration | Purpose |
|---------|------|----------|---------|
| **Meeting 1: Discovery** | Project start | 45-60 min | Build full profile + choose direction (Stations 1-7) |
| **Meeting 2: First Check-In** | End of Week 1 | 10-15 min | Reality check. Did they start? What's working? Adjust profile if needed. |
| **Meeting 3: Momentum Check** | Week 3-4 | 10-15 min | Progress review. Are they still aligned with their direction? Drift detection. |
| **Meeting 4: Mid-Point Reflection** | ~Halfway through term | 15-20 min | Deep review. Recalibrate if project has evolved. Re-assess self-efficacy (how has confidence changed?). |
| **Meeting 5: Pivot or Persist** | If triggered by drift detection | 10-15 min | Only happens if AI detects significant drift OR student requests it. Formal decision: pivot, persist, or scale. |
| **Meeting 6: Pre-Sharing Prep** | 1-2 weeks before deadline | 15-20 min | Shift from DOING to DOCUMENTING. Portfolio/presentation/evidence planning. |
| **Meeting 7: Reflection & Growth** | After project completion | 15-20 min | What happened vs what was planned. Profile comparison (before/after). Growth narrative. |

### 4.2 — What Each Follow-Up Looks Like

**Meeting 2: First Check-In (10-15 min)**

The student returns to the game world. Their profile is visible. The mentor greets them at the Workshop (Station 2 location).

Activities:
1. **"Traffic Light" quick pulse** — 3 taps: 🟢 On track / 🟡 Bit stuck / 🔴 Lost (5 sec)
2. **"This week I..."** — select from illustrated activity cards: started making, did research, talked to someone, changed my mind, didn't start yet (10 sec)
3. **Mentor response** — AI adapts to traffic light + activity: green+making = celebration + next challenge; red+didn't start = no shame, diagnose blocker (30 sec)
4. **Blocker identification** (if yellow/red) — "What's in the way?" select from: time, resources, motivation, unclear direction, too ambitious, other (15 sec)
5. **Mentor nudge** — specific action for next week, referenced to their archetype ("As a Maker, your instinct is to build. So this week: build ONE thing, even if it's small and wrong.") (30 sec)
6. **Profile tweak** (optional) — "Has anything changed since Discovery?" If yes, quick 3-question check (archetype still feel right? problem still matter? resources changed?) (1 min)

**Stealth capture during check-ins:** Response speed to traffic light (instant green = genuinely fine; delayed green = performing fine), blocker selection speed, whether they click "profile tweak" (identity still forming vs committed).

**Meeting 4: Mid-Point Reflection (15-20 min)**

This is the most important follow-up. The student returns to the Crossroads (Station 6 location). Their original project direction is visible on the door they chose.

Activities:
1. **Journey so far** — visual timeline of what they've done (auto-populated from milestones/evidence) (1 min viewing)
2. **Self-efficacy re-check** — same 6 sliders from Station 5. AI compares before/after. If confidence has grown: "Look at that — 3 weeks ago you were a 4 on presenting. Now you're a 7." (1 min)
3. **Ikigai revisit** — their Ikigai diagram re-renders with any updated data. Has the sweet spot shifted? (1 min viewing)
4. **Alignment check** — "Is your project still pointing to the center of your Ikigai, or has it drifted?" Select: still aligned / evolved (good) / drifted (need help) / want to change direction (30 sec)
5. **If evolved/drifted:** Mentor helps recalibrate. New direction options if needed. Updated project statement. (5-8 min)
6. **If still aligned:** Celebration + challenge ("You're on track. Here's what the last half looks like for someone like you...") (2 min)
7. **Resource re-check** — "Do you need anything you don't have?" Quick scan of resource cards. (30 sec)
8. **Updated profile** — changes saved, Ikigai re-rendered, growth narrative updated. (auto)

### 4.3 — Meeting 7: Reflection & Growth (The Bookend)

This closes the loop. The student returns to the Launchpad (Station 7) where they made their commitment.

Activities:
1. **Side-by-side profile comparison** — Discovery profile (Meeting 1) vs current profile. Visual diff: which self-efficacy scores changed? Which values shifted? Did their archetype evolve? (2 min viewing)
2. **Ikigai then vs now** — two Ikigai diagrams side by side. The center may have shifted. "Your sweet spot evolved — and that's exactly what should happen." (1 min)
3. **Growth narrative** — AI generates a 3-paragraph story of their journey: where they started, what changed, what they can do now that they couldn't before. (1 min viewing)
4. **Strength evolution** — "At the start you said people come to you for [X]. After this project, what would you add?" (30 sec, icon selection)
5. **Advice to future self** — "What would you tell yourself at Station 1?" (text prompt — this becomes a data point for the NEXT project's Discovery, if they do another one) (2 min)
6. **Updated Grand Reveal** — refreshed profile card with growth annotations. Shareable. (30 sec)
7. **Mentor farewell** — personalized, references specific moments from the journey. "Remember when you almost pivoted at Week 4? That decision to persist is what made this work." (30 sec)

### 4.4 — Drift Detection Between Meetings (Passive/Stealth)

The AI doesn't only check in at scheduled meetings. Between meetings, it watches for drift signals:

| Signal | Detection | Response |
|--------|-----------|----------|
| **No activity for 5+ days** | Milestone check + activity log | Gentle nudge via Open Studio mentor ("Hey — haven't seen you in a while. Everything OK?") |
| **Work doesn't match direction** | AI compares milestone evidence to project statement | Mentor asks: "I noticed you've been doing [X] — is your project evolving, or did you get sidetracked?" |
| **Self-efficacy crash** | If student's confidence drops significantly (e.g., via pace feedback or reflection) | Trigger Meeting 5 (Pivot or Persist) |
| **Scope creep** | Evidence suggests project growing beyond original time/resource budget | Mentor: "This is getting bigger than planned. Should we scale back, find more resources, or split it into phases?" |
| **Archetype mismatch** | Student is doing work that doesn't match their archetype (e.g., a Maker doing only research) | Mentor: "You said you're a Maker — but I see a lot of reading and not much building. Is that intentional?" |

### 4.5 — Data That Evolves Across Meetings

The DiscoveryProfile isn't static. It evolves:

```typescript
interface EvolvingProfile extends DiscoveryProfile {
  // Meeting 1 data (static snapshot)
  discovery_snapshot: DiscoveryProfile;

  // Longitudinal tracking
  self_efficacy_history: Array<{
    date: string;
    meeting: number;
    scores: Record<string, number>;  // 6 domains
  }>;

  confidence_trend: 'growing' | 'stable' | 'declining';

  // Project evolution
  direction_changes: Array<{
    date: string;
    from: string;
    to: string;
    reason: 'evolution' | 'pivot' | 'drift_correction';
  }>;

  // Behavioral evolution
  engagement_trend: 'deepening' | 'stable' | 'fading';
  decision_style_shift?: string;  // e.g., "becoming more decisive"

  // Growth narrative (AI-generated, updated each meeting)
  growth_summary: string;

  // Advice chain (what they'd tell their past self)
  advice_to_past_self: string[];  // one per meeting 7
}
```

---

## Part 5: Updated Interaction Ratio — 85/15 Confirmed

### Full Activity Inventory (All Meetings Combined)

**Meeting 1 (Discovery): ~53 activities**
- Clicking/selecting/dragging: ~45 (85%)
- Text input: ~2 full prompts (4%)
- Passive viewing: ~6 (11%)

**Each Follow-Up Meeting: ~8-12 activities**
- Clicking/selecting: ~7-10 (85-90%)
- Text input: ~0-1 (0-10%)
- Passive viewing: ~1-2 (10-15%)

**Overall journey ratio across ALL meetings: ~85/15**

The text prompts are:
1. **Meeting 1, Station 2:** "Friend panicking, 2 hours left" (full text prompt — natural language IS the data)
2. **Meeting 1, Station 7:** Project statement (AI pre-fills, student edits — half-text)
3. **Meeting 7:** "Advice to future self" (full text prompt — reflection, not data collection)

Everything else is clicking, dragging, sliding, or viewing. The 85/15 ratio holds across the full lifecycle.

---

## Part 6: Age Stratification Summary (12-16)

| Element | Age 12-13 | Age 14-15 | Age 16 |
|---------|-----------|-----------|--------|
| Scenario responses | Illustrated characters, 3 options | Illustrated + text, 4 options | Text-primary, 4 options + nuance |
| Sliders | 4-point scale (emoji labels) | 5-point scale | 5-7 point scale |
| Values ranking | Sort into 2 tiers (Important / Not sure) | Sort into 3 tiers | Full 3-tier + optional pile naming |
| Station 6 doors | 2 doors (less choice paralysis) | 3 doors | 3 doors + custom option |
| Text prompts | Illustrated scenario + select response + optional 1-sentence addition | Full text prompt with sentence starter | Full open text prompt |
| Ikigai diagram | Simplified: 2 circles (What I love + What I can do) converging on project | 3 circles (add What the world needs) | Full 4-circle Ikigai |
| Archetype descriptions | Concrete examples ("Makers are like LEGO master builders") | Mix of concrete + abstract | Abstract + philosophical |
| Follow-up cadence | Weekly check-ins (shorter attention span, need more scaffolding) | Bi-weekly | Bi-weekly or student-initiated |
| Behavioral composites | Simplified to 3 (Confident / Exploring / Needs Support) | Full 4 composites | Full composites + nuanced AI interpretation |

**Implementation:** Teacher sets grade level per class. AI checks age at journey entry and serves the appropriate version of each interaction. Same engine, different rendering layer. Content in a config object keyed by age band.

---

## Part 7: What This Means for the Side-Scroller Game

The engine spec is now solid enough to build Phase 1 (no game, just the interaction flow). But here's how the game world maps to what we've designed:

| Game World Element | Engine Element | Notes |
|-------------------|----------------|-------|
| Walking between locations | Station transitions | Environmental storytelling, mentor dialogue, collectibles |
| Campfire clearing | Station 1 | 5 mentors gathered, choose-your-mentor moment |
| Workshop / studio building | Station 2 | Archetype reveal happens here |
| Collection wall / gallery | Station 3 | Interest nodes on a wall, values as framed items |
| Window / viewpoint | Station 4 | Community scene visible through window |
| Storage shed / toolkit room | Station 5 | Resource inventory as physical objects on shelves |
| Corridor with doors | Station 6 | 3 doors with glowing previews |
| Rooftop / summit | Station 7 | Ikigai diagram appears in the sky, Grand Reveal |
| Environmental objects | Stealth engagement tracking | Clicking objects = curiosity signal |
| Walking speed | Student-controlled pace | Fast walking = eager or rushing; slow = exploring |
| Collectibles/easter eggs | Optional content | Each one clicked = engagement data point |

The game is the WRAPPING. The engine is the SUBSTANCE. Build the engine first, wrap it in the game later.
