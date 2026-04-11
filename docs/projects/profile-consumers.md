# Profile Consumers — Using the Student Learning Profile

**Status:** Scoping
**Priority:** P1 (immediately after SLP Phase A-D)
**Est:** TBD — rolls up ~6 sub-projects, likely 20-30d total across all consumers
**Created:** 10 Apr 2026
**Depends on:** [Student Learning Profile — Unified Schema](../specs/student-learning-profile-schema.md) (Phase A minimum)

---

## Why this exists

The Student Learning Profile spec is a **capture + synthesis** system. It produces a canonical `student_learning_profile` with 7 sections + computed `pedagogy_preferences`, and exposes it via `getStudentProfile()`. But capturing data is worthless unless something downstream *acts* on it.

This project tracks the consumer-side work: **every place in the platform that should read the profile and adapt its behaviour accordingly.** Without this, the SLP becomes a very expensive database column nobody reads.

**Core question:** for each student-facing system, what does "profile-aware" look like, and what's the smallest meaningful behaviour change we can ship?

---

## Consumers (the list)

Each entry below is a candidate sub-project. Scoped lightly here; each will need its own spec before build.

### 1. AI Mentor — tone, depth, scaffolding adaptation
**What it does today:** Reads `students.learning_profile` JSONB loosely via `buildDesignTeachingContext()`. Same prompt shape for everyone.
**What profile-aware looks like:** Reads `pedagogy_preferences` + `current_state.motivational_state` + `cognitive` + `wellbeing` via `getStudentProfile()`. Adapts: scaffolding_intensity (SDT competence drives it), tone (archetype + wellbeing), depth (cognitive load capacity), which questions to ask first (weakest motivational dimension), whether to redirect to teacher (wellbeing flags).
**Smallest shippable slice:** Inject the existing "prompt_guidance" block from §21 appendix into the Design Assistant system prompt. Measure tone change.
**Open questions:** How often do we re-read the profile mid-conversation? Per-message? Per-session? Caching strategy?

### 2. Generation Pipeline — profile-injected lesson generation
**What it does today:** Dimensions3 generates lessons from unit brief + framework + activity blocks. No per-student awareness.
**What profile-aware looks like:** Class-level aggregate profile (averaged/clustered across students) injected into Stage 2-3 (sequencing + block selection). Adjusts: complexity, scaffolding level, activity variety, criterion emphasis based on class cognitive/motivational distribution. Per-student adaptation lives in rendering (see #3).
**Smallest shippable slice:** Class profile digest (3-5 sentences) injected into Stage 3 block ranking. No per-student yet.
**Open questions:** Do we generate one lesson per class, or one lesson with per-student variants? (Probably former for v1.)

### 3. Lesson Rendering — per-student scaffolding variants
**What it does today:** All students see the same rendered lesson.
**What profile-aware looks like:** At render time (student opens lesson), system consults profile and swaps in: alternative instructions (more visual for high-visual-learners), extra scaffolding (low self-efficacy), stretch prompts (high capability), different exemplars (matching aesthetic preference from creative_voice). Lesson structure stays identical — only *expression* of each activity block varies.
**Smallest shippable slice:** Two scaffolding tiers (standard / extended) toggled by `current_state.self_efficacy` + `cognitive.working_memory_load`.
**Open questions:** How do teachers preview variants? Do they lock certain students to a tier? How do we prevent ability-grouping perception?

### 4. Open Studio v2 — plan health + adaptive check-ins
**What it does today:** Open Studio v2 spec exists (`openstudio-v2.md`) but not built. Assumes teacher parameters drive cadence.
**What profile-aware looks like:** Plan health score reads motivational_state (relatedness drop → escalate to teacher), wellbeing (stress → reduce cadence + offer de-load), self_efficacy trajectory (rising → more autonomy, falling → more mentor check-ins). Check-in *style* adapts to archetype + SDT profile.
**Smallest shippable slice:** Plan health incorporates one profile signal — motivational_state.relatedness trajectory — alongside teacher parameters. Everything else stays in openstudio-v2 spec.
**Open questions:** Does this block Open Studio v2 build, or happen after? (After — ship OS v2 without it, add as v2.1.)

### 5. Discovery Engine — return-visit short-circuit
**What it does today:** Every time a student starts Discovery, they do all 8 stations fresh. 45-min experience.
**What profile-aware looks like:** Returning students with an existing profile get a compressed 10-15 min version — only re-visits dimensions that are low-confidence, stale (>6 months), or flagged for re-assessment. Kit says "let's check in on a few things" instead of "let's discover your DNA."
**Smallest shippable slice:** Binary gate — if profile exists AND confidence > 0.6 AND age < 6 months, skip to a 3-station "check-in" journey.
**Open questions:** Which stations are "always re-run" vs "skip if recent"? How does confidence decay over time?

### 6. Designer Mentor Matching — aesthetic embedding match
**What it does today:** Matching is planned but blocked on creative_voice (now unblocked by SLP Phase A extension).
**What profile-aware looks like:** After student has uploaded 5+ work items, `mentor_matcher` touchpoint reads `identity.creative_voice.aesthetic_embedding` + `stated_references` + `revealed_references` and cosine-matches against designer corpus. Returns ranked top-5 with reasoning ("your work keeps drifting toward material honesty — here are three designers who lived that").
**Smallest shippable slice:** Match endpoint returns top-1 mentor with one-sentence rationale. No UI yet.
**Open questions:** How many work items before match is trustworthy? Manual override?

### 7. Group Formation — peer-aware grouping suggestions
**What it does today:** Teachers form groups manually or randomly.
**What profile-aware looks like:** Reads `social.collaboration_orientation`, `social.critique_giving_quality`, `social.peer_influences` (who they've worked well with), plus cognitive complementarity (mix of strengths). Suggests groups with rationale. Never auto-forms — always teacher-approved.
**Smallest shippable slice:** "Suggest groups" button on class page → returns 3 candidate groupings with one-line rationale per group.
**Open questions:** How do we handle students who explicitly don't want to work with someone? Social profile negatives are sensitive.

### 8. Teacher Dashboard — profile-surfaced nudges
**What it does today:** Teacher sees unit progress, grades, Teaching Mode check-ins.
**What profile-aware looks like:** "Pulse" card surfaces: students with relatedness drop, motivation decline, wellbeing flags, self-efficacy stagnation, dimension confidence gaps (need a re-assessment nudge). Actionable — each card has a suggested teacher move.
**Smallest shippable slice:** Single "attention needed" card on teacher dashboard showing top-3 students with a profile-derived flag.
**Open questions:** Alerting threshold? How often does it refresh? Teacher override / snooze?

---

## Consumer Control Plane — Admin Toggles + Sandbox (MANDATORY for every consumer)

**Principle:** Every profile consumer ships **OFF by default**. Nothing reads the profile in production until it's been proven in a sandbox. No exceptions, no "let's just try it live" shortcuts.

### Admin dashboard — consumer toggle registry

New admin dashboard tab: **Profile Consumers**. Lists all 8 consumers as rows with per-consumer controls:

- **Enabled (global)** — master switch. OFF at launch. Turning ON means "this consumer will read profile data in production for the cohort below."
- **Cohort scope** — which students/classes/teachers are in scope. Options: `none` (disabled), `specific_classes[]`, `specific_teachers[]`, `percentage_rollout` (0-100%), `all`. Default `none`.
- **Profile fields read** — explicit allowlist of which profile paths the consumer is permitted to read (e.g., `pedagogy_preferences.scaffolding_intensity`, `current_state.self_efficacy`, `identity.creative_voice.aesthetic_embedding`). Enforced at the `getStudentProfile()` layer — attempting to read outside the allowlist throws. This is both a safety guarantee and a documentation contract.
- **Fallback strategy** — dropdown: `class_defaults` / `profile_naive` / `hardcoded_value`. Defines what happens when profile is missing/sparse/low-confidence.
- **Observability level** — `off` / `sample` (10%) / `full`. Controls how much is logged to the consumer activity log.
- **Kill switch** — big red button. Disables the consumer everywhere instantly, clears its cache, and logs the reason. Available to any admin.
- **Last toggled** — audit trail (who/when/why).

Each toggle flip writes to `consumer_config_audit` table. Nothing is silent.

### Sandbox — extensive pre-production testing environment

New admin route: `/admin/profile-consumers/sandbox`. Purpose: let you (and eventually school admins) test consumer behaviour against synthetic or real-anonymised profiles before flipping the toggle in production.

**Required sandbox features:**

1. **Profile picker** — choose a student profile to test against. Options: (a) pick a real student (anonymised — names/IDs redacted in sandbox view), (b) pick a synthetic profile from the seed library (see below), (c) build a custom profile via the sandbox editor (sliders for every numeric field, dropdowns for categoricals).
2. **Seed profile library** — curated synthetic profiles covering the edge cases: low-efficacy anxious student, high-efficacy autonomous student, new-to-platform (empty profile), high cognitive load + low motivation, creative_voice-rich vs empty, group-oriented vs lone-wolf, drift-declining, at-risk, extension-seeking. ~15 profiles minimum. Each has a named description so you can say "test this on 'Anxious Ali'."
3. **Consumer selector** — pick which consumer to exercise. Shows the consumer's allowlisted fields so you can see exactly what it's reading.
4. **Side-by-side diff view** — runs the consumer twice against the same input: once with profile (profile-aware) and once with profile stripped (profile-naive). Shows the two outputs side by side with diff highlighting. Critical for A/B intuition.
5. **Field influence trace** — for each output, shows which profile fields were read and a rough weighting of how much each influenced the decision. For AI outputs, this means the system prompt diff + a post-hoc "which fields were quoted." For generation outputs, it's the explicit parameter deltas.
6. **Scenario runner** — record a sequence of interactions (student asks X, AI responds Y, student follows up Z) and replay it against a consumer. Lets you test consistency over a session, not just a single turn.
7. **Snapshot comparison** — save a scenario run output as a "golden" snapshot. Re-run later to check if behaviour has drifted. This is your regression safety net.
8. **Privacy-safe mode toggle** — in sandbox, always replaces real student identifiers with opaque refs and redacts any wellbeing/social data unless explicitly enabled for a QA session (audit-logged).
9. **Observability view** — full trace log of every profile read, every prompt built, every output produced. No sampling. This is the debugger for "why did the AI say that?"
10. **Rollout simulator** — "if I enabled this consumer at 10% rollout across Year 9, here's an estimate of how many profile reads/day, how many tokens, how much it costs, how many students affected." Prevents surprise bills and surprise scope.

### Build estimate for the control plane

- Admin toggle registry + audit + kill switches: **2-3 days**
- Sandbox UI (profile picker, consumer selector, side-by-side, field trace): **3-4 days**
- Seed profile library (15 curated profiles with descriptions): **1 day**
- Scenario runner + snapshot regression: **2 days**
- Rollout simulator: **1 day**
- Wiring `getStudentProfile()` allowlist enforcement: **1 day**

**Total: ~10-12 days.** This is non-negotiable overhead — it must ship BEFORE the first consumer goes live, not alongside. Treat it as its own milestone.

### Ordering implication

Revised build order:

1. **Control plane + sandbox (10-12d)** — mandatory prerequisite. Ships with zero active consumers.
2. **AI Mentor consumer (1-2d)** — first consumer, wired through the control plane, tested in sandbox for ~1 week before flipping to a single pilot class.
3. **Designer Mentor matching (2-3d)** — same flow.
4. … and so on through the 8 consumers.

Total project now **~31-42 days** (was 21-30d without control plane).

---

## Cross-cutting concerns

**Caching.** Reading the profile on every AI call is expensive. Need a per-session cache with invalidation on profile writes. Define in SLP §11 Read API extension before building consumers.

**Observability.** Every consumer needs to log *which* profile fields it read and *how* they influenced output. Without this, we can't debug "why did the AI give this student that response?" Feeds back into Lesson Pulse + generation feedback loop.

**A/B-ability.** We need to be able to ship each consumer behind a feature flag and measure whether the profile-aware version actually outperforms the profile-naive version. Otherwise we're building on faith.

**Fallback behaviour.** What does each consumer do when the profile is missing, sparse, or low-confidence? "Fall back to class defaults" should be the universal answer — define once in a shared helper.

**Privacy scope enforcement.** Every consumer must declare its `viewer` touchpoint on `getStudentProfile()`. Audit trail enforced at the read layer. No consumer reads raw `wellbeing` or `social.peer_influences` without a whitelisted viewer.

---

## Build order (proposed)

Do these in rough order of impact-per-day:

1. **AI Mentor adaptation** (1-2d) — biggest reach, lowest risk, simplest integration. Ship immediately after SLP Phase A.
2. **Designer Mentor matching** (2-3d) — unblocks a project that's been waiting, fast follow on creative_voice.
3. **Discovery return-visit short-circuit** (2-3d) — immediate UX win for returning students.
4. **Lesson rendering variants** (5-7d) — biggest lift but biggest pedagogical payoff. Needs careful teacher UX.
5. **Teacher dashboard nudges** (3-4d) — gives teachers visible ROI from SLP, drives trust.
6. **Generation pipeline class profile** (3-5d) — pairs well with Dimensions3 stabilisation.
7. **Open Studio v2 plan health** (2d) — after OS v2 is live.
8. **Group formation** (3-4d) — requires PeerInteractionWorker data to be mature (post SLP Phase B).

**Total:** ~21-30d across all consumers, sequenceable over several months. None block each other.

---

## What this project does NOT include

- Building the SLP itself (separate project, must ship first)
- New data capture systems (those are their own projects — Work Capture, Journey Engine, etc.)
- Teacher-visible profile editing UI (part of SLP Phase C)
- Profile export / parent reporting (part of SLP Phase D)

This project is purely: **how downstream systems read and act on profile data.**

---

## Open strategic questions

1. **Should consumers compete or cooperate?** If the AI mentor sees low self-efficacy and softens tone, and the lesson renderer also sees it and adds scaffolding, are we double-dipping? Need a coordination strategy.
2. **How do we prevent ability-grouping perception?** Per-student variants can feel like tracking. UX matters enormously.
3. **Teacher opt-out granularity.** Should teachers be able to disable profile-aware adaptation for specific students, specific consumers, or globally?
4. **Student visibility.** Should students know the AI is adapting to their profile? (Probably yes — trust + agency.)
5. **Measurement.** What's the success metric? Engagement? Completion? Grade distribution? Teacher sentiment? Pick before building or we won't know if it worked.

---

## Next actions (when you pick this up)

1. Resolve the 5 strategic questions above — they're the real blockers, not technical.
2. Pick 1-2 consumers to spec first (recommend AI Mentor + Designer Mentor Matching).
3. Write a per-consumer mini-spec using the same sections as above.
4. Extend SLP §11 Read API with caching contract before any consumer ships.
5. Decide measurement framework.
