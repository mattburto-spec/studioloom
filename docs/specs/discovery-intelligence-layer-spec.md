# Discovery Intelligence Layer — Architecture Spec

*Author: Matt Burton + Claude | Date: 26 March 2026*
*Status: Architecture spec — not yet built*

## Executive Summary

The Discovery Engine evolves from a standalone onboarding experience into the **student profiling backbone** for the entire StudioLoom platform. Every AI interaction — Design Assistant mentoring, toolkit suggestions, lesson scaffolding, project recommendations — becomes personalized based on a rich student profile that the student actively builds through Discovery and that the platform passively enriches through usage data.

No other edtech platform carries a structured, student-built personality profile through every AI touchpoint.

---

## Core Architecture: Three Modules, Not Eight Stations

The current 8-station linear journey is architecturally three distinct modules:

### Module 1 — Identity (S0-S3)
*"Who are you as a designer?"*

- Binary working style pairs (S1)
- Scenario responses revealing archetype (S2)
- Interests, irritations, values (S3)
- **Output:** Archetype scores, working style vector, interest map, irritation signals
- **Lifecycle:** Done well once, rarely repeated. Confirmed/adjusted on subsequent entries.

### Module 2 — Problem Finding (S4-S5)
*"What matters to you right now?"*

- Problem identification in context (S4)
- Resources, self-efficacy assessment (S5)
- **Output:** Problem statement, resource inventory, confidence profile
- **Lifecycle:** Fresh each unit. Gets smarter with project history context.

### Module 3 — Commitment (S6-S7)
*"What are you going to do about it?"*

- AI-generated project doors (S6)
- Fear acknowledgment, project statement, success criteria (S7)
- **Output:** Chosen direction, fear areas, project brief, success criteria
- **Lifecycle:** Always fresh — specific to the project ahead.

---

## Adaptive Flow: How Discovery Changes Over Time

### First Time (any unit type) — Full Journey
All 3 modules. ~45 minutes. Kit introduces himself, student builds complete profile.

### Second Time (different unit) — Confirm + Focus
- **Module 1:** 5-minute "confirm and adjust" screen
  - Kit: "Last time you told me you're a Maker who cares about waste. Still true? Anything changed?"
  - Quick-edit cards for archetype, interests, working style
  - Option to "Start Fresh" if student feels they've changed
- **Module 2:** Full, but enriched with history
  - Kit: "Last time you tackled food waste and said the hardest part was stakeholder interviews. Want to go deeper or try something new?"
  - Previous project outcomes inform door generation
- **Module 3:** Full (always project-specific)
- **~20 minutes total**

### Third Time+ — Streamlined
- **Module 1:** Skipped entirely (unless student/teacher requests reset)
- **Module 2:** Faster — profile data pre-populates context, Kit references growth
  - Kit: "Your self-efficacy on 'finding good resources' jumped from 3 to 5 since your first project. Nice."
- **Module 3:** Smarter doors based on cumulative profile
- **~10 minutes total**

### Teacher Override
- Teacher can force full re-discovery for any student (significant life changes, new school, seems disengaged)
- Teacher can view student's Discovery profile on their detail page
- Teacher can flag sections as "needs refresh" (e.g., interests may have shifted)

---

## First-Time StudioLoom Onboarding — The Avatar Moment

Before Discovery exists as a concept for the student, their very first interaction with StudioLoom is a quick identity moment:

1. **Choose your design mentor avatar** (2-3 visual styles — the face that appears in the bottom-left circle throughout the platform)
2. **Pick a color/theme** for your workspace
3. **2-3 quick vibe questions** that seed the beginning of their profile

This creates immediate ownership ("this is MY space") and gives Kit a face before Discovery proper. The avatar choice itself is a data point — students who pick the adventurer vs. the architect are already signaling design identity.

When they later enter Discovery, Kit is already familiar: "Hey, we've met! Remember when you picked that look? That told me something about you already..."

**Architecture:** `student_profile.avatar_id`, `student_profile.theme`, `student_profile.onboarding_signals` — lightweight JSONB, no migration complexity.

---

## Discovery Variants by Framework

### MYP Design (Mode 1)
- Students complete guided lessons first → teacher unlocks Discovery → Discovery → Open Studio
- Module 2 focuses on design problems within the unit's criterion scope
- Doors are 6-10 week project scale
- Kit references specific MYP criteria in scaffolding

### Service as Action (Mode 2)
- Discovery IS the unit entry point — no prerequisite lessons
- Module 2 emphasizes community needs, service orientation
- Doors frame service projects (community partnerships, real impact)
- Kit's tone shifts toward empathy and social responsibility

### Personal Project (PP)
- Year-long independent project — highest stakes
- Module 2 is deeper, more personal, more ambitious
- Doors aren't 8-week projects, they're year-long commitments
- Kit's tone: "This is a big decision. Let's make sure it's something you'll still care about in March."
- Additional station: Goal decomposition (breaking year-long project into milestones)
- Success criteria are more rigorous (IB PP assessment criteria alignment)

### PYP Exhibition (PYPx)
- Collaborative — Discovery needs a **group dimension**
- Individual profiles compared to form complementary teams
- A team of all Makers with no Researcher will struggle with inquiry
- Module 3 generates group-aware doors (projects that leverage the team's combined archetypes)
- Kit mediates: "Your team has strong Makers but no one who loves research. How will you handle the inquiry phase?"

---

## Persistent Student Profile Architecture

### Current: Per-Session Profiles
Each `discovery_sessions` row stores its own `DiscoveryProfile` JSONB. Profiles don't carry across sessions.

### Future: Canonical Profile + Session History

```
student_discovery_profile (NEW TABLE)
├── student_id (PK)
├── canonical_profile JSONB        -- accumulated across all Discovery sessions
│   ├── archetype_scores           -- weighted average across sessions
│   ├── working_style              -- latest confirmed values
│   ├── interests[]                -- union of all sessions, with recency weighting
│   ├── irritations[]              -- same
│   ├── values[]                   -- same
│   ├── self_efficacy{}            -- latest per-dimension, with trajectory
│   ├── fear_areas[]               -- persistent, with resolution tracking
│   └── history[]                  -- previous projects with outcomes
├── passive_signals JSONB          -- accumulated from platform usage
│   ├── toolkit_preferences{}      -- which tools used, frequency, depth
│   ├── response_patterns{}        -- typing speed, editing style, effort levels
│   ├── pace_profile{}             -- consistent fast/matched/slow across lessons
│   ├── engagement_indicators{}    -- session lengths, drift frequency, focus time
│   └── criterion_trajectory{}     -- grade trends across units
├── avatar_id
├── theme
├── onboarding_completed_at
├── last_discovery_at
├── discovery_count INTEGER
├── created_at
└── updated_at

discovery_sessions (EXISTING — becomes session log)
├── id
├── student_id
├── unit_id
├── session_type ENUM('full', 'returning', 'confirm_only', 'problem_only')
├── source_profile_version INTEGER -- which canonical profile version was active
├── profile_data JSONB             -- this session's specific data (unchanged)
├── modules_completed[]            -- which modules ran this session
└── ... (existing fields)
```

**Key invariant:** Discovery writes to canonical profile. Everything else reads from it. Passive signals are append-only (collected by background jobs, never modified by user-facing code).

---

## Data Collection Points Across the Platform

### Deliberate (Student-Driven via Discovery)
| Source | What it reveals | Profile field |
|--------|----------------|---------------|
| S0 Design Identity Card | Tool/material preferences | `archetype_scores`, `working_style` |
| S1 Binary Pairs | Working style dimensions | `working_style` |
| S2 Scenarios | Archetype under pressure | `archetype_scores` |
| S3 Interests/Irritations | Authentic interests, emotional triggers | `interests`, `irritations` |
| S4 Problem Finding | What they notice, what bothers them | `problem_orientation` |
| S5 Self-Efficacy | Confidence per skill area | `self_efficacy` |
| S6 Fear Cards | Vulnerability areas | `fear_areas` |
| S7 Project Statement | Articulation ability, ambition level | `history[]` |
| Avatar Choice | Personality signaling | `avatar_id` |

### Passive (Platform-Observed)
| Source | What it reveals | Profile field |
|--------|----------------|---------------|
| Toolkit usage patterns | Thinking preferences (SCAMPER→Creative, Decision Matrix→Researcher) | `toolkit_preferences` |
| Response quality (integrity data) | Working style (fast-draft-heavy-edit vs slow-careful) | `response_patterns` |
| Pace feedback (🐢👌🏃) | Processing speed, engagement | `pace_profile` |
| Design Assistant conversations | What they ask about reveals priorities | `engagement_indicators` |
| Portfolio documentation style | Visual-heavy→Maker/Creative, written→Researcher/Communicator | `response_patterns` |
| NM self-assessments | Self-awareness, growth areas | `self_efficacy` (cross-validated) |
| Open Studio sessions | Focus duration, drift frequency, productivity | `engagement_indicators` |
| Criterion grades | Performance trajectory, persistent strengths/gaps | `criterion_trajectory` |
| Reflection quality | Metacognitive ability, depth of thinking | `response_patterns` |

---

## Implementation Phases

### Phase A: Profile-Aware Design Assistant (~2-3 days)
**Zero new dependencies. Immediate value.**

1. In `design-assistant-prompt.ts`, query `discovery_sessions` for the student
2. If profile exists, inject "What I know about this student" context block:
   - Archetype + secondary: "This student is primarily a Maker with Researcher secondary"
   - Working style: "Prefers hands-on exploration over planning. Works best with concrete examples."
   - Fear areas: "Anxious about presenting publicly — be supportive around sharing/critique"
   - Self-efficacy gaps: "Low confidence in 'choosing the right materials' — offer more material guidance"
   - Interests: "Interested in gaming and sustainability — use these as hooks/analogies"
3. Same pattern for Open Studio AI (studio critic prompt already gets some profile data — expand)
4. No new tables, no migrations — reads existing `discovery_sessions.profile_data`

### Phase B: Adaptive Discovery Flow (~3-4 days)
**Requires: Phase A complete**

1. Add `session_type` field to `discovery_sessions` (or determine from profile completeness)
2. Extend `getResumeState()` to check canonical profile sections, not just station visits
3. Build "Confirm & Adjust" UI for Module 1 (compact card view of existing profile with edit toggles)
4. Kit dialogue variants for returning students
5. History injection into Module 2 context (previous projects, outcomes)
6. `source_profile_id` linking to canonical profile

### Phase C: Persistent Profile + Passive Signals (~5-7 days)
**Requires: Phase B complete, grading page functional**

1. Create `student_discovery_profile` table (canonical profile + passive signals)
2. Background job: aggregate toolkit usage, pace data, conversation patterns into passive signals
3. Profile merge logic: Discovery writes + passive enrichment
4. Teacher dashboard: class profile aggregate (archetype distribution, common fears, efficacy gaps)
5. AI generation uses class profile: if 60% Makers, weight toward hands-on activities
6. Portfolio narrative auto-generation from Discovery data

### Phase D: Framework Variants + Group Discovery (~5-8 days)
**Requires: Phase C complete**

1. PP variant (deeper Module 2, year-long commitment framing, milestone decomposition)
2. PYPx variant (group profiling, team formation, complementary archetype matching)
3. First-time onboarding flow (avatar selection, theme, seed questions)
4. Teacher content control panel for Discovery content pools

---

## Ethical Framework

**Why this approach is ethically clean:**

1. **Student agency:** The profile is built through deliberate self-reflection, not surveillance. Students choose what to share.
2. **Transparency:** Students can see their own profile. Nothing is hidden.
3. **Passive data is supplementary:** Behavioral signals enrich but never override self-reported identity. A student who says they're a Maker is a Maker, even if their toolkit usage looks more like a Researcher.
4. **Teacher visibility, not control:** Teachers see profiles to inform instruction, not to label or sort students.
5. **No public comparison:** Profiles are private. No class rankings, no "you're behind" messaging.
6. **Reset available:** Students can request a full profile reset at any time.
7. **Age-appropriate:** Designed for 11-18 year olds. No personality "typing" that could feel reductive. Archetypes are presented as tendencies, not categories.

---

## Key Metrics

- **Profile completion rate:** % of students who finish full Discovery (target: >85%)
- **Return session duration:** How much faster is the 2nd/3rd Discovery (target: <50% of first)
- **AI relevance score:** Teacher rating of Design Assistant quality for profiled vs non-profiled students
- **Student sentiment:** "Does the AI understand you?" survey question
- **Profile accuracy:** Student agreement with their archetype after 3+ months (self-validation)

---

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| Students game Discovery to get "cool" archetypes | Archetype names are all equally aspirational. No "best" archetype. Scoring uses behavioral scenarios, not self-report preferences. |
| Profile data becomes stale | Adaptive flow includes confirmation step. Passive signals detect divergence (e.g., self-reported Maker but toolkit usage shows Researcher → Kit asks about it). |
| Teachers over-rely on profiles | Profiles are "conversation starters" not "definitive assessments." UI language emphasizes this. |
| Privacy concerns from parents | All data is student-generated or derived from normal platform usage. No external data. No facial recognition. No device tracking. COPPA-compliant. Profile visible to student + their teachers only. |
| Scope creep — trying to profile everything | Strict read/write separation. Discovery writes. Everything else reads. Passive signals are append-only background jobs, never blocking. |

---

## Related Documents
- `docs/specs/discovery-engine-build-plan.md` — Master build plan (8 stations, content, scoring)
- `docs/specs/discovery-engine-spec.md` — Data model, DiscoveryProfile interface
- `docs/specs/discovery-engine-ai-integration.md` — AI touchpoint map
- `docs/student-learning-intelligence.md` — 4-phase student profiling roadmap
- `docs/education-ai-patterns.md` — 5 core patterns for student-facing AI
- `docs/roadmap.md` → Discovery Intelligence Layer section
