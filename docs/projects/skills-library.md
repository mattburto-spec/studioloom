# Project: Skills Library

**Created:** 11 April 2026
**Status:** PLANNED — specs written, workshop build scheduled for w/c 14 April 2026
**Priority:** P1
**Estimate:** Workshop project ≈ 4-6 days for the "must-have" slice
**Owner:** Matt
**Supersedes:** [`self-help-library.md`](self-help-library.md) (idea absorbed — rescoped and renamed)

**Canonical specs:**
- [`docs/specs/skills-library-spec.md`](../specs/skills-library-spec.md) — base spec (schema, embed contexts, quizzes, badges, authoring phases, maintenance, cross-school sharing as moat)
- [`docs/specs/skills-library-completion-addendum.md`](../specs/skills-library-completion-addendum.md) — extension (completion state model, freshness, context-aware gating, refresh mode, categories, strength radar chart, privacy/wellbeing)

**Related prototypes:**
- [`docs/prototypes/strength-chart-prototype.html`](../prototypes/strength-chart-prototype.html) — radar chart working prototype (three students, state ladder, context-aware gating demo)
- [`docs/prototypes/student-dashboard-composed.html`](../prototypes/student-dashboard-composed.html) — dashboard composing skill cards into Stone prereqs, crit board, journal wikilinks

---

## 1. What this is

The skills library is the canonical content layer that powers StudioLoom's "no chatbot at launch" strategy. Every student-facing help surface — Stone prerequisites, crit board pins, journal wikilinks, blocker hints, Open Studio capability-gap recommendations — resolves to a **skill card** via a join, not a model. Authored once, referenced from many embed contexts.

**Strategic frame:** the library is not a feature, it is the moat. Fifteen years of teacher-authored MYP Design material is an asset competitors structurally cannot copy. Every new card compounds the value of every existing Stone, lesson, and badge.

## 2. Why now

1. Directly unblocks the Open Studio Mode project — Open Studio promises silence and trust; structural scaffolding without generation is the only way to deliver on that promise inside the no-chatbot constraint.
2. Dimensions3 ingestion pipeline is complete, so existing PowerPoints can be mined for content without bespoke tooling.
3. Workshop slot booked for next week — 20-30 high-value cards from existing MYP Design materials is a complete, immediately useful product surface.

## 3. Workshop project scope (next week)

**Must have**
- Schema: `skill_cards`, `skill_card_tags`, `skill_prerequisites`, `skill_external_links`, `skill_categories` (with MYP Design default set seeded)
- Skill completions written as `learning_events` (no separate table) — event types: `skill.viewed`, `skill.quiz_passed`, `skill.quiz_failed`, `skill.refresh_passed`, `skill.refresh_acknowledged`, `skill.demonstrated`, `skill.applied`
- `student_skill_state` derived view (highest state + freshness per skill per student)
- Basic authoring UI — structured-block editor (prose, image, video embed, callout, worked example, checklist)
- Card view (the leaf experience)
- Library browse with tag filtering
- Stone prerequisite integration — lowest-risk first embed context
- Nightly link-check via pg_cron — ship from day one, retrofit is painful
- Basic context-aware gating: "skip if recently viewed" at minimum

**Should have if time permits**
- Refresh mode: collapsed card view + one-tap acknowledge (skip the quick-quiz logic in v1)
- Quiz engine for MC single, MC multi, and true/false only
- Lesson activity block embedding with viewed-level gate
- Open Studio capability-gap surfacing (the join is trivial; the UI is the work)

**Deliberately deferred**
- Radar chart visualisation — depends on real completion data to look meaningful; an empty chart in week one is worse than no chart
- Mastery derivation from Stone completions — wait until Stones are mature
- Badge engine — deserves its own spec with teacher sign-off workflow, expiry, visualisation
- Forking / lineage UI (schema supports it from day one)
- Cross-school visibility (until there are multiple schools)
- Image identification, ordering, matching quiz types — phase 2

**Realistic target:** 20-30 high-value skill cards mined from existing PowerPoints, viewable in the library, linkable from Stones, with working link-check.

## 4. Key design decisions (already made)

- **One canonical card, many embed contexts.** Authored once; referenced from library, lessons, Stones, Open Studio, crit board, badges.
- **Tags over hierarchy.** Folder structures break with curriculum changes; tag graphs survive them.
- **Append-only completions.** Skill completions are `learning_events`, never their own table. Current state is a derived view — survives school transfers automatically.
- **Quizzes gradable without a model.** Six question types (MC single/multi, true/false, image identification, ordering, matching) cover almost any practical skill. No free-text evaluation, ever.
- **Mastery derived from real work**, not test-taking — Stone completions where the skill was a prerequisite.
- **Strength chart computed on view, never stored.** State score × freshness factor × category weight, normalised per axis.
- **No peer-to-peer chart visibility.** The chart is a mirror, not a scoreboard. No streaks, no hearts, no decay notifications.

## 5. Dependencies

- **Blocks on:** none (schema can be built independently)
- **Unblocks:** Open Studio Mode (capability-gap surfacing), Badge Engine (future), Self-help surfaces, Safety Badge consolidation
- **Related:** Dimensions3 ingestion pipeline (for mining existing content), `learning_events` (already in place), Stones (prereq integration)

## 6. Open questions to resolve in the workshop

Captured from the base spec + addendum. Grouped by urgency.

**Decide before build**
1. Confirm lesson activity blocks vs Stones mental model against current architecture.
2. Quiz item types for v1 — MC + true/false only, or include image identification from day one?
3. Video hosting — Cloudflare Stream is the strong default (cheap, works in China, no ads); confirm bandwidth costs.

**Calibration (starting guess now, tune with real data later)**
4. Mastery threshold default — 3 successful Stone applications. Vary by skill type?
5. State score weights — `viewed=0.2`, `quiz_passed=0.6`, `demonstrated=0.9`, `mastered=1.0`. Gap between quiz_passed and demonstrated deliberately large; sanity check?
6. Freshness band edges — 90/180 days. Soldering muscle memory fades fast; design vocabulary doesn't. Per-category decay curves eventually?
7. Quiz pass threshold — 80% is conventional but unexamined.
8. Refresh question count — three is a guess.

**Design calls**
9. Empty-chart wellbeing — baseline non-zero chart so day one doesn't feel demoralising, or honesty?
10. Stale visualisation on the chart — faded outline ring outside the current fill? Visually rich but possibly confusing.
11. Tag governance — phase 1 Matt decides; phase 3+ needs a process.

## 7. Next steps

1. Confirm the "lesson activity block" mental model against current architecture.
2. Draft the controlled tag vocabulary for MYP Design (30-min task, anchors everything else).
3. Pick the first 20-30 skill cards to author — mine from existing PowerPoints.
4. Write the schema migration against the existing Supabase setup.
5. Stand up the link-check Edge Function before any external links are added.
6. Sketch the authoring UI — the experience Matt will live in for years, deserves design care.
