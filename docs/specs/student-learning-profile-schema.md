# Student Learning Profile — Unified Schema & Build Spec

**Status:** Spec — ready to build
**Date:** 10 April 2026
**Author:** Matt + Claude
**Supersedes:** Overlapping sections of `discovery-intelligence-layer-spec.md` and `student-learning-intelligence.md` (both kept as reference — this is the canonical schema)
**Depends on:** Dimensions3 (complete), Journey Engine (spec approved, not yet built)
**Unblocks:** Profile-aware Design Assistant, Open Studio v2 personalisation, Cognitive Layer, adaptive unit generation, teacher student-detail page

---

## TL;DR

One canonical row per student (`student_learning_profile`) with five internally-owned sections (`identity`, `cognitive`, `current_state`, `wellbeing`, `passive_signals`), backed by three satellite tables (`student_project_history`, `student_learning_events`, existing `journey_sessions`). Every AI touchpoint in StudioLoom reads from it. Five clearly separated writer classes (Discovery/Journey synthesis, cognitive puzzle journeys, background passive-signal job, teacher UI, and a scheduled synthesis job) each own exactly one section. Visibility is section-level: `identity` + `cognitive` + `current_state` are student-visible, `wellbeing` + `passive_signals` are teacher-only. No data migration — hard cutover.

---

## 1. Problem Statement

StudioLoom captures ~80% of the signals needed to personalise every AI interaction per student — from Discovery responses to conversation transcripts to assessment grades — but those signals live in six disconnected tables and no AI touchpoint reads across them. The consequence is that Design Assistant talks to a Year 9 Maker with poor visual memory the same way it talks to a Year 11 Researcher with high processing speed, and that teachers can't see a single coherent picture of the student. The intelligence-layer spec, student-learning-intelligence spec, and cognitive-layer spec each propose a profile table for their own purpose; if we build them separately we'll ship three drifting profiles and the personalisation story falls apart.

**Who's affected:** every student who uses AI features (1,000+ expected by end of year), every teacher grading or planning units, and every future feature that needs to adapt to student state (Open Studio v2, cognitive layer, profile-aware Design Assistant, class-aware unit generation).

**Cost of not solving it:** we build profile-shaped tables ad-hoc inside each feature and spend the next 12 months reconciling them, or we ship personalisation that's only as smart as the most recent conversation. Both outcomes kneecap StudioLoom's "the AI actually knows this student" differentiator.

---

## 2. Goals

1. **One source of truth for "what StudioLoom knows about a student."** Every AI touchpoint reads from the same place; no feature maintains its own shadow profile.
2. **Clean write separation.** Each section has exactly one writer class so two features can't silently overwrite each other's data.
3. **Phase-A value in ≤ 3 days.** Profile-aware Design Assistant shipping on top of the new schema within the first build phase, proving the loop end-to-end before the cognitive layer or teacher UI is built.
4. **Ethical by construction.** Students see their own non-sensitive data in a friendly view; pastoral notes and behavioural signals are teacher-only by structural rule, not by convention.
5. **Forward-compatible with Loominary OS.** The schema is `ServiceContext`-shaped (tenant-aware, product-aware) so Makloom/other Loominary apps can consume it without a rewrite. No hardcoded StudioLoom vocabulary in column names.

---

## 3. Non-Goals

1. **Not building the cognitive puzzles themselves.** The `cognitive` section ships empty (`confidence_level: cold_start`); puzzle UIs are a separate project referencing `discovery-engine-cognitive-layer.md`. The schema just reserves the space.
2. **Not building an ML model to predict anything.** Derived fields (`pedagogy_preferences`, `confidence_level`) are computed by deterministic synthesis functions, not trained models. Model-based scoring is a v3 question.
3. **Not migrating existing `discovery_sessions` data.** Hard cutover — students who've done Discovery under the old system either re-run it when they hit a profile-aware feature, or accept an empty profile until they do. Keeps the synthesis logic focused on the new data shape.
4. **Not replacing `journey_sessions`.** That table stays exactly as the Journey Engine spec defines it — it's the per-run response log. This spec adds a canonical *synthesis* of journey data, not a replacement for it.
5. **Not a "student dashboard" feature.** A student-facing profile view is P1 here (visibility rules + API), but the full dashboard UX (gamified reveals, progress charts, etc.) is a separate project.
6. **Not retrofitting every existing AI touchpoint.** Phase A wires Design Assistant; Open Studio critic, unit generation, and toolkit recommendations follow in their own projects. The schema supports them; wiring them is out of scope for v1.

---

## 4. Locked-In Decisions

These are the four questions Matt answered on 10 April 2026 that shape the rest of the spec. If any of these change, re-read from here.

| # | Question | Decision | Why it matters |
|---|----------|----------|---------------|
| 1 | History storage | **Separate `student_project_history` table** | Cleaner schema, queryable across students, bounded profile row |
| 2 | Cognitive → pedagogy mapping | **Computed `pedagogy_preferences` field** (derived section, synthesis job) | Centralised interpretation logic, tunable without touching prompts |
| 3 | Visibility model | **Section-level visibility** (`identity`/`cognitive`/`current_state` student-visible, `wellbeing`/`passive_signals` teacher-only) | Simple blunt rule, enforced in API layer, avoids per-field bookkeeping |
| 4 | Migration strategy | **Hard cutover** | Keeps synthesis logic focused; existing discovery data remains in `journey_sessions` as historical log only |

### 4.1 Locked-in answers to the three blocking open questions (10 April 2026)

These were OQ-2, OQ-4, and OQ-9 in §15. Resolved before Phase A coding starts.

| OQ | Question | Decision | Implication |
|---|----------|----------|-------------|
| 2 | Multi-class teacher RLS for `wellbeing` / `passive_signals` | **Author-only with explicit share.** A teacher only sees `wellbeing` notes they wrote themselves. Notes can be explicitly shared with named other teachers via a `shared_with: uuid[]` field on each note. No homeroom-wide auto-share. Cross-teacher pastoral context is opt-in, never automatic. | `wellbeing` becomes an **array of notes**, not a single object. Each note row carries `author_teacher_id`, `shared_with`, `body`, `tags`, `created_at`. RLS reads `wellbeing` as `WHERE author_teacher_id = auth.uid() OR auth.uid() = ANY(shared_with)`. UI needs a "share with…" picker. Cost: ~1 extra day in Phase A for the share UI + RLS function. |
| 4 | COPPA / under-13 parental consent gating | **Build it in now.** Add `parental_consent` JSONB column to `student_learning_profile` with shape `{granted: bool, granted_at: timestamp, granted_by: text, scope: ('wellbeing'\|'passive_signals')[]}`. Default `{granted: false, scope: []}`. RLS denies writes to `wellbeing` and `passive_signals` for any student where `date_of_birth` puts them under 13 AND `parental_consent.granted` is false. | Adds ~half-day to Phase A. Schema is US-ready from day one. `student_learning_profile` table needs `date_of_birth` (or pull it from existing students table). Onboarding flow needs a parent-consent capture step for under-13 students — out of scope for this spec but blocked by it. International schools (current users) won't hit the gate because they're 11+, but the column is there. |
| 9 | `ProfileSynthesisJob` trigger | **Debounced async after any section write.** Any write to `identity` / `cognitive` / `current_state` / `passive_signals` enqueues a synthesis job for that student. Debounce window: 30 seconds — bursts collapse to one rebuild. Worker reads the section bundle, recomputes `pedagogy_preferences`, writes back. Failures retry 3× with exponential backoff, then alert. | Needs a job queue — reuse the ingestion queue infra (already built). Adds a `profile_synthesis_jobs` row tracker so we can see backlog and failures. Pedagogy is fresh within ~1 minute of any upstream change. Cognitive room → first AI conversation flow works correctly because the journey-completion write triggers synthesis before the student lands in chat. |

### 4.2 Additional decisions (10 April 2026)

Answered in a rapid follow-up round after the three blockers. All locked.

| Topic | Decision | Implication |
|-------|----------|-------------|
| Archetype shape | **Weighted mix of all 6.** `identity.archetype_weights: {maker, researcher, leader, communicator, creative, systems_thinker}` each 0–1, sum to 1. Computed `archetype_primary` for display. | Mentor matching uses cosine similarity over the weight vector. Student reveal shows top 1 with a "you also lean into…" tail. Synthesis reads weights, not single label. |
| `current_state` staleness | **Rolling window per field.** Each field has its own TTL. `current_unit` never stale (updates on unit switch), `recent_confusion_topics` TTL=14d, `energy_level` TTL=7d, `goal_for_term` persists until student updates. Synthesis applies decay — old values fade but aren't deleted. | Synthesis function accepts a per-field TTL config. Freshness metadata (`last_updated` per field) required. Adds ~half-day to synthesis implementation. |
| Cold start behaviour | **Neutral default profile.** Synthesis returns `cold_start: true` + balanced defaults (visual/verbal = 0.5, pacing = medium, prompts = open). AI responds normally. Passive signals rebuild profile over time. First profiling journey replaces defaults. | No onboarding friction. Design Assistant ships with a `cold_start_pedagogy_preferences` constant. |
| Passive signal sources (Phase A) | **All 4 wired:** Design Assistant transcripts, toolkit completions, grading scores + feedback, integrity/pacing signals. | **Phase A scope increases by ~3 days (5d → 8d).** Total build: 15-19 days. Four separate parser/aggregator modules under `PassiveSignalWorker`. |
| Teacher override of `pedagogy_preferences` | **Nudge, not replacement.** Teacher pushes individual fields with a required reason. Stored in `pedagogy_preferences.teacher_nudges[]` array. Synthesis respects nudges as weighted bias on recompute — never hard-overwrites signal. Audit-logged. | Synthesis function signature gains `teacher_nudges` parameter. Student-detail page UI adds a "nudge" control per pedagogy field. |
| Student self-view | **Narrative reveal only.** "Your Design DNA" page with archetype reveal, top 3 strengths framed positively, plain-language "how the AI works with you." No raw numbers. Template transform JSONB → narrative text. | Needs a `profileToNarrative()` function + copy templates per archetype + per pedagogy field. UX copy pass required. Protects against gaming. |
| Profile reset | **Soft reset.** On reset: `identity` + `cognitive` + `current_state` archived to `student_learning_events`, zeroed with `confidence_level: cold_start`. `passive_signals` keep flowing. `wellbeing` untouched. Student re-runs profiling journey. Reversible. | `resetProfile(studentId, sections?)` function writes archival event before zeroing. Reversible via replay of the archival event. |
| Data export / portability | **JSON on request via teacher/admin.** Teacher or admin triggers export for a student. Returns JSON with profile + learning_events + project_history + human-readable summary header. Not student-self-serve in v1. | Adds a `GET /api/admin/student/:id/export` route + download UI on student-detail page. ~half day. GDPR-ready. |

### 4.3 Rollout & integration decisions (10 April 2026)

| Topic | Decision | Implication |
|-------|----------|-------------|
| Phase A proof-of-loop target | **Design Assistant.** Highest daily read volume, existing prompt, cleanest wiring. Success criteria: inject rendered `pedagogy_preferences.prompt_guidance` into `design-assistant-prompt.ts` system prompt, ship to 3 test students, measure response quality shift. Open Studio critic and unit generation follow in their own projects. | Phase A ends with one real AI feature reading the profile end-to-end. Ships a measurable before/after. |
| `students.learning_profile` column | **Replace.** Drop the column from the Journey Engine spec. `student_learning_profile` is the single canonical location. `ProfilingJourneyWriter` writes to the new table directly. Update Journey Engine spec in a separate pass. | Small cross-spec cleanup required. No drift risk. No denormalised read cache (join is cheap on an indexed bigint FK). |
| Explainability | **Full traceback.** Every synthesis run writes a `synthesis_trace` record into `student_learning_events` showing which fields fed which pedagogy value with which weights. Teacher UI renders `prefers_visual: 0.82 ← cognitive.spatial_reasoning (0.9 × 0.4) + passive_signals.visual_tool_usage (0.7 × 0.3) + current_state.recent_confusion_topics:verbal (0.8 × 0.3)`. | Adds ~1 day to synthesis implementation (trace recording + UI). Builds teacher trust. Unblocks the nudge flow — teachers can see what they're nudging against. |
| OS readiness | **Shape only, no extraction.** Table lives in StudioLoom schema. Column names product-neutral (`archetype_weights` not `design_archetype_weights`, `pedagogy_preferences` not `design_pedagogy_preferences`). `tenant_id` + `product_id` columns present, both default to StudioLoom. Zero abstraction work, cheap future extraction when Makloom forces it. | Two extra columns on the table. A naming pass on JSONB field keys. No shared library imports. Per ADR-001. |

### 4.4 Wellbeing → AI separation (decided 10 April 2026)

**`wellbeing` does NOT feed `pedagogy_preferences`.** Synthesis input is strictly `cognitive` + `current_state` + `passive_signals` + `social` + `motivational_state`. Wellbeing notes are a pastoral layer for humans only — teachers read them, AI never does. This keeps synthesis simple, single-viewer, and debuggable, and sidesteps the viewer-dependent pedagogy problem that would arise under author-only sharing. If we later want AI to soften tone for students going through hard times, it will be via a separate pastoral-flags mechanism (not in v1) with its own shared vocabulary and TTL — answers already on file: any current teacher can set, auto-expire with renewal prompt.

### 4.5 Structural additions from 10 April 2026 stress test

After the initial spec was frozen, a directed stress-test identified five structural gaps that would force a rebuild within 6–12 months if deferred. All five are now in v1. Build estimate moves from 15–19 days to **21–25 days** (+6 days). The trade is real — we stretch Phase A and add one phase — but we avoid a tear-up.

| # | Gap | Decision | Why it's in v1, not v2 |
|---|---|---|---|
| A | **Self-Determination Theory layer.** The strongest evidence base in adolescent motivation (Deci & Ryan — autonomy, competence, relatedness, purpose) was absent. Archetype captures *what they prefer*; SDT captures *whether they show up tomorrow*. | Add `current_state.motivational_state: { autonomy, competence, relatedness, purpose }` with per-dimension value + trajectory + confidence. Feeds `pedagogy_preferences` directly: low autonomy → more choice offered; low relatedness → reference peer work; low purpose → connect to stated interests/values; low competence → scaffold more. | This is the single biggest predictor of adolescent engagement. Shipping without it would mean every AI interaction ignores the thing the research says matters most. |
| B | **Peer / social layer (including group work).** The schema had zero fields about collaboration, peer influence, critique quality, help-seeking, group-project behaviour — even though Class Gallery, Peer Review, Teaching Mode, and group unit types are already collecting the raw data and throwing it away. Hattie's peer-influence effect size is ~0.53. | Add a 6th section **`social`** owned by a new `PeerInteractionWorker` writer class. Tracks `collaboration_orientation`, `critique_giving_quality`, `critique_receiving_quality`, `help_seeking_pattern`, `peer_influences[]` (students whose work they reference), `group_history[]` (past group projects + role played + group dynamics), `current_groups[]` (active group memberships for in-flight group projects). | Without this, the AI can't reason about group-mode projects at all, and the biggest passive signal source on the platform (who interacts with whom) stays dark. Matt confirmed students sometimes work in groups — this has to ship. |
| C | **Dimension registry (extensibility mechanism).** Every field in v1 was strongly typed into named sections. A new journey block inventing a "failure tolerance" or "aesthetic risk appetite" dimension next month would need a migration, a spec update, a synthesis rule change, and a narrative template update. The schema could not absorb new dimensions without code changes. | Add `profile_dimensions` registry table + `profile.custom` JSONB section. Dimensions are declared at author-time (via Journey Engine admin UI, not code) with: `dimension_id`, `display_name`, `data_type`, `writer_class`, `ttl_days`, `narrative_template`, `visibility` (student/teacher/system), `synthesis_weights` (optional contribution to named `pedagogy_preferences` fields). Synthesis discovers registered dimensions and applies them. Journey blocks can write to registered dimensions via their own writer class gate. | This is the single change that makes the system survive three years. Without it, every new research-backed dimension becomes a migration. With it, Matt can ship a new block type on a Wednesday afternoon. |
| D | **Creative voice / aesthetic fingerprint.** Half of being a designer is taste. No field existed for material preferences, visual vocabulary, referenced designers (stated vs revealed), or an aesthetic embedding. The Work Capture pipeline is already planned to produce visual data (Voyage AI embeddings, pgvector) — that data had nowhere to live. | Add `identity.creative_voice: { aesthetic_embedding (1024-d), material_preferences[], visual_tags[], stated_references[], revealed_references[], voice_confidence }`. Populated by `ProfilingJourneyWriter` (stated) + `CreativeVoiceWorker` (revealed from work submissions via Voyage AI). Feeds Designer Mentor matching via cosine similarity — without it, matching is theme-based, not taste-based. | Without this, Designer Mentor is surface-level. This is the field that makes "we matched you with Dieter Rams because your work has his DNA" possible versus "we matched you because you both like minimal." |
| E | **Identity trajectory snapshots.** Current `archetype_weights` is a snapshot. For a student who might use the platform for 6 years (Year 7 → Year 12), there was no time-lapse — just a photo album. Adolescence is identity-forming; a Year 7 Maker can become a Year 10 Systems Thinker and we'd never see the shift. | Add `identity.trajectory_snapshots: Array<{ captured_at, archetype_weights, sdt_summary, self_efficacy_summary, term_label, trigger }>`. Compressed termly snapshot written by a scheduled `TrajectorySnapshotJob` (first of each term) or on significant drift. Enables "how has this student evolved" queries + teacher UI trend view + adaptive Discovery ("welcome back — looks like you've shifted toward research this year"). | Cheap to add at build time, impossible to backfill later. The event log technically has this data but a derived snapshot is what UI and synthesis can query in O(1). |

**Cost breakdown (+6 days):**
- +1d — schema additions (social section, profile_dimensions table, motivational_state on current_state, creative_voice + trajectory_snapshots on identity, custom JSONB)
- +1d — SDT synthesis rules + integration into `pedagogy_preferences` + trace entries
- +1.5d — `PeerInteractionWorker` (reads Class Gallery, Peer Review events, Teaching Mode check-ins, group project membership)
- +1d — dimension registry: table, declaration API, writer-class gate, synthesis discovery loop, narrative template registration
- +1d — creative_voice: Voyage AI embedding pipeline hook into Work Capture, material/visual tag extraction, stated-references capture in Discovery
- +0.5d — `TrajectorySnapshotJob` scheduled task + termly trigger

**What this unblocks:** Designer Mentor matching (needs creative_voice), group-project AI mentoring (needs social), motivation-aware scaffolding (needs SDT), future journey block types (needs dimension registry), long-horizon student journey UX (needs trajectory snapshots).

---

## 5. Target Users

- **Students (11–18)** — Primary beneficiary. Get an AI that actually adapts to them. Can see their own designer profile in a friendly narrative view (P1 in this spec, full UX elsewhere).
- **Teachers** — Can see every student's full profile on the student-detail page, enter wellbeing/SEN data, flag sections for refresh, reset a student's profile on request.
- **AI systems** (Design Assistant, Open Studio critic, unit generator, toolkit recommender, grading assistant, drift detection) — Consumers. Read from the profile; never write directly, always via the declared writer classes.
- **Platform engineers** — Need a stable contract they can build against. Section ownership rules + TypeScript types + an explainability audit log are the contract.

---

## 6. Architecture Overview

### 6.1 The six tables

```
student_learning_profile          (1 row per student — the canonical profile)
  └── profile JSONB
      ├── identity            ← written by profiling journeys (+ creative_voice from work pipeline)
      │   └── trajectory_snapshots[]  ← written by TrajectorySnapshotJob (termly)
      ├── cognitive           ← written by cognitive puzzle journeys
      ├── current_state       ← written by Discovery Modules 2–3 + passive sync
      │   └── motivational_state (SDT: autonomy/competence/relatedness/purpose)
      ├── social              ← written by PeerInteractionWorker (peer + group data)
      ├── wellbeing           ← written by teacher UI only
      ├── passive_signals     ← written by background job only
      ├── custom              ← open slot for registered dimensions (writer-class gated)
      └── pedagogy_preferences ← derived by synthesis job (read-only to everything else)

student_project_history           (N rows per student — append-only project log)
journey_sessions                   (existing — per-run response log from Journey Engine)
student_learning_events            (audit log — every write to student_learning_profile)
profile_synthesis_jobs             (debounced synthesis queue)
profile_dimensions                 (registry — declared dimensions + their writer classes)
```

### 6.2 The seven writer classes

Exactly one writer class owns each section. Writes to other sections from a non-owner path **throw** — this is enforced in the API layer, not just convention. Registered custom dimensions have their own per-dimension writer class declared in `profile_dimensions`.

| Writer class | Writes to | Triggered by | Frequency |
|---|---|---|---|
| `ProfilingJourneyWriter` | `identity` (incl. `creative_voice.stated_references`), parts of `current_state` (incl. `motivational_state` from SDT-tagged blocks) | Discovery journey or any journey with `goal_type='profiling'` completion | On journey completion |
| `CognitivePuzzleWriter` | `cognitive` | Journey with `goal_type='cognitive_assessment'` completion | On journey completion |
| `PassiveSignalWorker` | `passive_signals`, trajectory fields in `current_state` | Scheduled background job | Nightly batch + real-time on specific triggers (see §10.3) |
| `PeerInteractionWorker` | `social` (collaboration, critique, help-seeking, peer influences, group history) | Scheduled batch + real-time on Class Gallery, Peer Review, Teaching Mode check-in, and group project events | Nightly batch + real-time triggers (see §10.6) |
| `CreativeVoiceWorker` | `identity.creative_voice` (revealed: aesthetic_embedding, material_preferences, visual_tags, revealed_references) | New work submission via Work Capture pipeline | Real-time on submission |
| `TeacherProfileEditor` | `wellbeing` | Teacher UI on student-detail page | Manual, audit-logged |
| `TrajectorySnapshotJob` | `identity.trajectory_snapshots[]` (append-only) | Scheduled termly + drift-triggered | First of term + when `ProfileSynthesisJob` detects drift > threshold |
| `ProfileSynthesisJob` | `pedagogy_preferences`, `meta.confidence_level` | Triggered after any other writer commits | Within 30s of upstream write |
| `<RegisteredDimensionWriter>` | `profile.custom.<dimension_id>` | Declared in `profile_dimensions`; invoked by the journey block that registered the dimension | Per-dimension |

Every AI touchpoint is a **reader only**. Reads go through a single `getStudentProfile(studentId, { sections, viewer })` function that enforces section-level visibility based on the viewer role.

### 6.3 The invariants (non-negotiable)

1. **One writer per section.** Enforced at the API layer via a `writeSection(section, writerClass, data)` function that checks `writerClass` against an allowlist. Direct SQL writes bypass the check — those are explicitly forbidden except in the audit-logged migration script.
2. **Passive signals never override deliberate self-report.** If a student says they're a Maker in a profiling journey, `identity.archetype_primary = 'maker'` even if `passive_signals.archetype_divergence_score` says otherwise. Divergence is *surfaced* as a signal the next profiling journey can ask about, never silently applied.
3. **Every write produces an event.** `student_learning_events` gets a row for every mutation. The row includes writer class, section, prior value, new value, and trigger reference (journey_session_id, teacher_user_id, or job_run_id). Replayable.
4. **Reads are free, writes are gated.** Any AI touchpoint with a `viewer` context can read any visible section. Writes require declaring a writer class. Non-writer code must use the reader API.
5. **Cold-start is a first-class state.** A student with no profile gets `confidence_level: 'cold_start'` and AI touchpoints render safe defaults. A student with identity but no cognitive data gets section-level confidence; global confidence is the minimum across populated sections.
6. **Section lifecycles are independent.** Re-synthesising `identity` doesn't touch `cognitive`. Re-running passive signals doesn't touch `wellbeing`. This is what the five-writer rule buys us.

---

## 7. Database Schema

### 7.1 `student_learning_profile`

```sql
CREATE TABLE student_learning_profile (
  student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,

  -- OS-seam columns (ADR-001): product-neutral shape, StudioLoom defaults for v1
  tenant_id UUID NOT NULL,                            -- multi-tenant boundary (school/org)
  product_id TEXT NOT NULL DEFAULT 'studioloom',      -- 'studioloom' | 'makloom' | ...

  -- Schema versioning (bumped when JSONB shape changes)
  schema_version INT NOT NULL DEFAULT 1,

  -- COPPA / parental consent gating (§4.1 OQ-4)
  -- Gates writes to `wellbeing` and `passive_signals` for under-13 students
  date_of_birth DATE,                                  -- mirrored from students table for gate check
  parental_consent JSONB NOT NULL DEFAULT '{
    "granted": false,
    "granted_at": null,
    "granted_by": null,
    "scope": []
  }'::jsonb,
  /* scope is an array of section names: ["wellbeing", "passive_signals"] */

  -- The sections live inside here + meta + derived
  -- NOTE: `wellbeing` is an ARRAY of notes (not a single object) — see §8.4
  -- NOTE: `custom` is a map keyed by dimension_id from profile_dimensions — see §7.6
  profile JSONB NOT NULL DEFAULT '{
    "meta": {
      "confidence_level": "cold_start",
      "cold_start": true,
      "section_confidence": {
        "identity": "cold_start",
        "cognitive": "cold_start",
        "current_state": "cold_start",
        "social": "cold_start",
        "wellbeing": "cold_start",
        "passive_signals": "cold_start"
      }
    },
    "identity": null,
    "cognitive": null,
    "current_state": null,
    "social": null,
    "wellbeing": [],
    "passive_signals": null,
    "custom": {},
    "pedagogy_preferences": null
  }'::jsonb,

  -- Denormalised timestamps (enables queries without JSONB parsing)
  last_profiling_journey_at TIMESTAMPTZ,
  last_cognitive_assessment_at TIMESTAMPTZ,
  last_passive_sync_at TIMESTAMPTZ,
  last_peer_sync_at TIMESTAMPTZ,
  last_creative_voice_update_at TIMESTAMPTZ,
  last_trajectory_snapshot_at TIMESTAMPTZ,
  last_teacher_edit_at TIMESTAMPTZ,
  last_synthesis_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_slp_tenant_product ON student_learning_profile(tenant_id, product_id);

-- Enforce RLS
ALTER TABLE student_learning_profile ENABLE ROW LEVEL SECURITY;

-- Students read their own row — BUT wellbeing + passive_signals are stripped in the read API layer
CREATE POLICY student_reads_own ON student_learning_profile
  FOR SELECT USING (student_id = current_student_id());

-- Teachers read rows for students in their active classes (row-level)
-- Field-level filtering (author-only wellbeing, COPPA gating) happens in getStudentProfile()
CREATE POLICY teacher_reads_class ON student_learning_profile
  FOR SELECT USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN class_enrollments ce ON ce.student_id = s.id
      JOIN classes c ON c.id = ce.class_id
      WHERE c.teacher_id = auth.uid()
        AND ce.status = 'active'
    )
  );

-- All writes go through SECURITY DEFINER functions (never raw INSERT/UPDATE)
REVOKE INSERT, UPDATE, DELETE ON student_learning_profile FROM authenticated;

-- Helper: is this student under 13 on date X?
CREATE OR REPLACE FUNCTION is_under_13(p_student_id UUID) RETURNS BOOLEAN AS $$
  SELECT date_of_birth IS NOT NULL
     AND date_of_birth > (now() - interval '13 years')::date
  FROM student_learning_profile WHERE student_id = p_student_id;
$$ LANGUAGE SQL STABLE;

-- Helper: does this student's parental consent cover this section?
CREATE OR REPLACE FUNCTION parental_consent_covers(p_student_id UUID, p_section TEXT) RETURNS BOOLEAN AS $$
  SELECT (parental_consent->>'granted')::bool = true
     AND parental_consent->'scope' ? p_section
  FROM student_learning_profile WHERE student_id = p_student_id;
$$ LANGUAGE SQL STABLE;
```

### 7.2 `student_project_history`

```sql
CREATE TABLE student_project_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  -- What the project was
  project_type TEXT NOT NULL CHECK (project_type IN (
    'unit', 'open_studio', 'personal_project', 'service_action', 'pypx'
  )),
  unit_id UUID REFERENCES units(id),
  open_studio_plan_id UUID REFERENCES open_studio_plans(id),
  source_journey_session_id UUID REFERENCES journey_sessions(id),  -- Discovery that kicked it off

  -- When
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ,

  -- What happened (filled by grading + post-project reflection)
  status TEXT NOT NULL CHECK (status IN (
    'in_progress', 'completed', 'abandoned', 'extended'
  )),
  criterion_grades JSONB,     -- { A: 6, B: 5, C: 7, D: 4 } — raw criterion scores
  final_artifact_ids UUID[],  -- references portfolio_entries
  teacher_comments TEXT,
  student_reflection TEXT,    -- post-project reflection (from a reflection journey)

  -- Computed summary (used by 'recent projects' display + next Discovery context)
  summary JSONB NOT NULL DEFAULT '{}',
  /* {
    headline: "Redesigned school lunch queuing with a Maker approach",
    archetype_expressed: "maker",
    criterion_trend: "improved_criterion_b",
    struggles: ["stakeholder interviews", "time management"],
    wins: ["prototype quality", "iteration depth"]
  } */

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_history_by_student ON student_project_history(student_id, completed_at DESC);
CREATE INDEX idx_student_history_open ON student_project_history(student_id) WHERE status = 'in_progress';
```

### 7.3 `student_learning_events` (audit log)

```sql
CREATE TABLE student_learning_events (
  id BIGSERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  -- What changed
  section TEXT NOT NULL CHECK (section IN (
    'identity', 'cognitive', 'current_state', 'social', 'wellbeing',
    'passive_signals', 'custom', 'pedagogy_preferences', 'meta'
  )),
  -- For writes to the `custom` section, which registered dimension was touched
  custom_dimension_id TEXT,  -- FK soft-ref to profile_dimensions.dimension_id; null for built-in sections
  writer_class TEXT NOT NULL,  -- 'ProfilingJourneyWriter' | 'PassiveSignalWorker' | ...

  -- Why it changed (at most one of these should be non-null)
  journey_session_id UUID REFERENCES journey_sessions(id),
  teacher_user_id UUID REFERENCES auth.users(id),
  job_run_id TEXT,

  -- Before/after for replay + explainability
  prior_value JSONB,
  new_value JSONB NOT NULL,
  diff_summary TEXT,  -- Human-readable: "archetype_primary: creative → maker (confidence: 0.6 → 0.8)"

  -- Synthesis traceback (populated only for writer_class = 'ProfileSynthesisJob')
  -- Structure: { field_name: [{source, path, raw_value, weight, contribution}, ...] }
  -- Example for prefers_visual = 0.82:
  -- {
  --   "prefers_visual": [
  --     {"source": "cognitive", "path": "spatial_reasoning", "raw_value": 0.9, "weight": 0.4, "contribution": 0.36},
  --     {"source": "passive_signals", "path": "visual_tool_usage", "raw_value": 0.7, "weight": 0.3, "contribution": 0.21},
  --     {"source": "current_state", "path": "recent_confusion_topics.verbal", "raw_value": 0.8, "weight": 0.3, "contribution": 0.24}
  --   ]
  -- }
  synthesis_trace JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_by_student ON student_learning_events(student_id, created_at DESC);
CREATE INDEX idx_events_by_section ON student_learning_events(section, created_at DESC);
CREATE INDEX idx_events_synthesis ON student_learning_events(student_id, created_at DESC)
  WHERE writer_class = 'ProfileSynthesisJob';
```

### 7.4 `profile_synthesis_jobs` (queue tracker)

```sql
-- Tracks debounced synthesis jobs triggered by upstream writes (§4.1 OQ-9)
CREATE TABLE profile_synthesis_jobs (
  id BIGSERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  trigger_source TEXT NOT NULL,  -- 'identity_write' | 'cognitive_write' | 'current_state_write' | 'passive_signals_write'
  scheduled_for TIMESTAMPTZ NOT NULL,  -- now() + 30s debounce window
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'collapsed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one pending job per student at a time — duplicates get status='collapsed'
CREATE UNIQUE INDEX idx_synthesis_jobs_active_unique
  ON profile_synthesis_jobs(student_id)
  WHERE status IN ('pending', 'running');

CREATE INDEX idx_synthesis_jobs_queue
  ON profile_synthesis_jobs(scheduled_for)
  WHERE status = 'pending';
```

### 7.5 Relationship to existing `journey_sessions`

No schema changes needed. `journey_sessions` stays as the per-run response log from the Journey Engine. `student_learning_profile` references it via:
- `student_learning_events.journey_session_id` (which run triggered which write)
- `student_project_history.source_journey_session_id` (which Discovery kicked off a project)

Replay path: if we ever want to re-synthesize a student's profile from scratch, we read their `journey_sessions` in chronological order and pass each through the current synthesis logic.

### 7.6 `profile_dimensions` (dimension registry — extensibility mechanism, §4.5 gap C)

Registered dimensions let a new journey block introduce a new profile field without a migration. Each registered dimension has its own writer class, TTL, visibility rules, and optional synthesis contribution to `pedagogy_preferences`.

```sql
CREATE TABLE profile_dimensions (
  dimension_id TEXT PRIMARY KEY,          -- e.g. 'failure_tolerance', 'aesthetic_risk_appetite'
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN (
    'scalar', 'vector', 'enum', 'tag_list', 'structured_object'
  )),
  data_schema JSONB NOT NULL,             -- JSON Schema describing the payload for this dimension

  -- Ownership
  writer_class TEXT NOT NULL,             -- e.g. 'FailureToleranceBlockWriter'
  owning_journey_id UUID REFERENCES journeys(id),
  declared_by_user_id UUID REFERENCES auth.users(id),

  -- Lifecycle
  ttl_days INT,                            -- null = never stale
  reset_on_profile_reset BOOLEAN NOT NULL DEFAULT true,

  -- Visibility (mirrors the built-in section rules)
  visibility TEXT NOT NULL CHECK (visibility IN (
    'student_visible',  -- student + teacher + system read
    'teacher_only',     -- teacher + system read
    'system_only'       -- only AI touchpoints read
  )),

  -- Synthesis contribution (optional) — how this dimension nudges pedagogy_preferences
  -- Shape: { target_field: 'prefers_visual', formula: 'linear', weight: 0.2 }[]
  synthesis_contributions JSONB NOT NULL DEFAULT '[]',

  -- Narrative rendering — used by profileToNarrative for the student-facing view
  narrative_template TEXT,                -- mustache template with {{value}} placeholder; null = skip in narrative

  -- Status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'deprecated', 'retired')),
  schema_version INT NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_dimensions_active ON profile_dimensions(status) WHERE status = 'active';
CREATE INDEX idx_profile_dimensions_writer ON profile_dimensions(writer_class);

-- Only admins can declare new dimensions in v1 (protects against dimension sprawl)
-- Future: teachers can declare classroom-scoped dimensions with a 'scope' column
REVOKE INSERT, UPDATE, DELETE ON profile_dimensions FROM authenticated;
```

**How it works end-to-end:**

1. A journey author creates a new block type in the Journey Engine admin UI — say, a "failure tolerance scenario" that scores how a student responds to setbacks.
2. They declare a dimension: `dimension_id='failure_tolerance'`, `data_type='scalar'`, `writer_class='FailureToleranceBlockWriter'`, `ttl_days=90`, `visibility='teacher_only'`, `synthesis_contributions=[{target_field:'tolerates_ambiguity', formula:'linear', weight:0.15}]`, `narrative_template='You handle setbacks by {{style}}.'`.
3. The registry row is created. No migration, no code deploy.
4. When a student completes a journey containing this block, the block writes via its declared writer class into `profile.custom.failure_tolerance`. The writer-class gate checks the declaration before allowing the write.
5. `ProfileSynthesisJob` reads `profile_dimensions` at synthesis time, loops through active dimensions with non-empty `synthesis_contributions`, and applies each as a weighted input to its target pedagogy field — with trace entries like `{source: 'custom:failure_tolerance', weight: 0.15, contribution: 0.12}`.
6. `profileToNarrative` reads `profile_dimensions` and appends narrative snippets for each dimension with a template (if visible to the viewer).
7. If the dimension is retired, `status='retired'` stops new writes but preserves existing data in `profile.custom`.

**Invariants:**
- A custom dimension can **never** write to a built-in section. It can only write to its own slot in `profile.custom.<dimension_id>`.
- A custom dimension can **influence** `pedagogy_preferences` via `synthesis_contributions`, but only as additive weighted contributions — it cannot replace a value.
- Custom dimensions are subject to the same COPPA gate as other sections if declared `teacher_only` or `system_only`.
- `profile_dimensions` is read at synthesis time, not cached in code — tuning a weight is a SQL update, not a deploy.
- Bumping `profile_dimensions.schema_version` for a dimension enqueues a synthesis job for every student with data in that dimension.

**v1 ships with 2 seeded dimensions** (as reference implementations, not as the canonical set):
- `metacognition_score` — scalar 0–1, populated by reflection-journey blocks, feeds `preferred_question_depth`
- `feedback_receptiveness` — enum {seeks, accepts, resists, rejects}, populated by Peer Review events via `PeerInteractionWorker`, feeds `scaffolding_intensity`

---

## 8. The Five Sections — Detailed Contracts

Each section below is defined as a TypeScript interface (the canonical shape) and a list of fields with source, update rule, and visibility.

### 8.1 `identity` — Who they want to be as a designer

**Writer:** `ProfilingJourneyWriter`
**Student-visible:** Yes (full)
**Lifecycle:** Persistent; "confirm & adjust" on returning sessions; full reset on teacher request

```typescript
type ArchetypeKey = 'maker' | 'researcher' | 'leader' | 'communicator' | 'systems_thinker' | 'creative';

interface IdentitySection {
  // Core archetype — WEIGHTED MIX of all 6 (§4.2). Weights sum to ~1.
  // Mentor matching uses cosine similarity over this vector.
  archetype_weights: Record<ArchetypeKey, number>;  // e.g. {maker: 0.45, researcher: 0.25, creative: 0.15, leader: 0.10, systems_thinker: 0.03, communicator: 0.02}
  archetype_primary: ArchetypeKey;                   // computed: argmax(archetype_weights) — for display only
  archetype_secondary: ArchetypeKey | null;          // computed: 2nd argmax if gap < 0.15
  archetype_confidence: number;                       // 0–1, computed from weight distribution entropy (lower entropy = higher confidence)

  // Working style (from Station 1 quick-fire)
  working_style: {
    dimensions: {
      morning_vs_night: number;            // -1 to 1
      planner_vs_starter: number;
      solo_vs_team: number;
      read_vs_try: number;
      big_goal_vs_experiments: number;
      talk_vs_write: number;
      win_vs_learn: number;
      passion_vs_discipline: number;
      concrete_vs_abstract: number;
      iterative_vs_finishing: number;
    };
    narrative: string;  // AI-generated 2-sentence summary
  };

  // Interests + values (from Station 3)
  interests: Array<{
    tag: string;               // 'gaming', 'sustainability', 'cooking'
    source: 'self_reported' | 'passive_signal';
    recency_weight: number;    // decays over time
    first_seen: string;
    last_reinforced: string;
  }>;
  irritations: string[];       // What annoys them — authentic interest indicator
  values_hierarchy: string[];  // Ordered, 8 values from Station 3

  // Aesthetic/material/philosophy vectors (if MYP Design or aesthetic-relevant variant)
  aesthetic_vector: Record<string, number> | null;    // { minimal, ornamental, organic, ... }
  material_vector: Record<string, number> | null;     // { wood, metal, digital, ... }
  philosophy_vector: Record<string, number> | null;   // { function, universal, community, ... }
  process_vector: Record<string, number> | null;      // { systematic, intuitive, ... }

  // Empathy signals (from Station 4)
  empathy_targets: string[];        // Who they naturally notice
  problem_orientation: {
    scale: number;                  // 0-100 personal ↔ global
    urgency: number;
    proximity: number;
  };

  // Presentation
  avatar_id: string | null;
  theme: string | null;
  onboarding_signals: Record<string, unknown>;  // First-session quick signals

  // Creative voice / aesthetic fingerprint (§4.5 gap D)
  // Writer: ProfilingJourneyWriter (stated fields) + CreativeVoiceWorker (revealed fields)
  // Powers Designer Mentor matching via cosine similarity over aesthetic_embedding
  creative_voice: {
    aesthetic_embedding: number[] | null;         // 1024-d Voyage AI embedding averaged across recent work submissions
    material_preferences: Array<{                  // what they gravitate to in the studio
      material: string;                            // 'wood', 'textile', 'digital', 'metal', 'found_objects', ...
      affinity: number;                            // 0–1
      source: 'stated' | 'revealed' | 'both';
    }>;
    visual_tags: Array<{                           // extracted from Work Capture vision analysis
      tag: string;                                 // 'minimal', 'playful', 'industrial', 'organic', ...
      frequency: number;                           // 0–1
      last_seen: string;
    }>;
    stated_references: Array<{                     // designers/studios they name in profiling journeys
      name: string;
      reason: string;                              // free text — why this reference resonates
      added_at: string;
    }>;
    revealed_references: Array<{                   // designers whose work matches theirs via embedding similarity
      name: string;
      similarity: number;                          // cosine similarity over aesthetic_embedding
      computed_at: string;
    }>;
    voice_confidence: number;                      // 0–1 — rises with # of work submissions analysed
    last_embedding_update: string | null;
  } | null;

  // Identity trajectory snapshots (§4.5 gap E)
  // Writer: TrajectorySnapshotJob. Append-only. One per term minimum, more on drift.
  // Compressed snapshot for O(1) trend queries — full history is replayable from the event log.
  trajectory_snapshots: Array<{
    snapshot_id: string;
    captured_at: string;
    term_label: string;                            // 'T1-2026', 'T2-2026', ...
    trigger: 'scheduled_termly' | 'drift_detected' | 'manual';
    archetype_weights: Record<ArchetypeKey, number>;
    sdt_summary: {                                 // snapshot of current_state.motivational_state
      autonomy: number;
      competence: number;
      relatedness: number;
      purpose: number;
    } | null;
    self_efficacy_summary: Record<string, number>; // domain → value
    notable_delta: string | null;                  // human-readable: "Shifted toward Systems Thinker since last term"
  }>;

  // Provenance
  last_updated: string;
  last_confirmed_by_student: string;  // Last time they went through "confirm & adjust"
  source_journey_session_id: string;
}
```

**Field-by-field source table:**

| Field | Source | Updated when |
|---|---|---|
| `archetype_*` | Profiling journey synthesis | Full Discovery; not updated on "confirm only" |
| `working_style.dimensions` | Station 1 quick-fire binary choices | Full Discovery; partial on confirm |
| `interests[]` | Station 3 card sort + passive signal enrichment | Union across sessions, recency-weighted |
| `irritations` | Station 3 irritation prompt | Overwritten each Discovery |
| `values_hierarchy` | Station 3 card sort | Overwritten each Discovery |
| `aesthetic_vector` et al. | Aesthetic-variant journey rooms | Only if journey includes those rooms |
| `empathy_targets` | Station 4 scene selection | Overwritten each Discovery |
| `avatar_id` / `theme` | First-time onboarding moment | Student can change anytime |

### 8.2 `cognitive` — How their brain actually processes design

**Writer:** `CognitivePuzzleWriter`
**Student-visible:** Yes (with friendly language — "your designer's brain")
**Lifecycle:** Persistent; slow drift; re-measure annually or on teacher request
**Status in v1:** **Section exists, writer class exists as stub, actual puzzle journeys are a separate project.**

```typescript
interface CognitiveSection {
  // 7 traits — each scored 0–1 with independent confidence
  spatial_reasoning: CognitiveTraitScore;
  flexible_thinking: CognitiveTraitScore;
  visual_memory: CognitiveTraitScore;
  verbal_memory: CognitiveTraitScore;
  processing_speed: CognitiveTraitScore;
  working_memory: CognitiveTraitScore;
  attention: CognitiveTraitScore;

  // Optional import from external assessment (MindPrint etc.) — future path
  external_source: {
    provider: string;
    imported_at: string;
    source_document_ref?: string;
  } | null;

  last_updated: string;
  source_journey_session_id: string | null;
}

interface CognitiveTraitScore {
  score: number;        // 0–1 normalised (1 = high, 0 = low)
  confidence: number;   // 0–1 (how many data points support this)
  measured_at: string;
  measurement_method: 'puzzle_journey' | 'external_import' | 'teacher_override';
}
```

**v1 ships with this entire section `null`.** Phase A and B read it, find null, and fall back to pedagogy-neutral defaults. When the cognitive puzzle journeys are built in a later project, they write into this section without any schema change. The `pedagogy_preferences` synthesis job already handles the null case.

### 8.3 `current_state` — Where they are right now

**Writer:** `ProfilingJourneyWriter` (deliberate parts) + `PassiveSignalWorker` (trajectory parts)
**Student-visible:** Yes
**Lifecycle:** Refreshes per project; trajectory accumulates

```typescript
interface CurrentStateSection {
  // Motivational state — Self-Determination Theory (§4.5 gap A)
  // Deci & Ryan SDT: the strongest evidence base in adolescent motivation.
  // Self-efficacy below captures per-domain confidence (competence at a specific thing).
  // motivational_state captures the four higher-level drivers of engagement.
  // Written by ProfilingJourneyWriter from SDT-tagged blocks in profiling journeys,
  // trajectory updated by PassiveSignalWorker + PeerInteractionWorker from behaviour.
  motivational_state: {
    // Autonomy — "I feel this project is mine"
    autonomy: {
      value: number;                       // 0–1
      trajectory: 'improving' | 'stable' | 'declining';
      confidence: number;                  // 0–1
      last_signals: Array<{                // last 5 things that moved the value
        source: 'journey_response' | 'teacher_override_behaviour' | 'open_studio_behaviour';
        delta: number;
        at: string;
      }>;
    };
    // Competence — "I feel capable in this space"
    // (distinct from self_efficacy: competence is global SDT-level, self_efficacy is domain-specific)
    competence: {
      value: number;
      trajectory: 'improving' | 'stable' | 'declining';
      confidence: number;
      last_signals: Array<{ source: string; delta: number; at: string }>;
    };
    // Relatedness — "I feel connected to peers and teacher"
    relatedness: {
      value: number;
      trajectory: 'improving' | 'stable' | 'declining';
      confidence: number;
      last_signals: Array<{ source: string; delta: number; at: string }>;
    };
    // Purpose — "This work connects to something bigger I care about"
    purpose: {
      value: number;
      trajectory: 'improving' | 'stable' | 'declining';
      confidence: number;
      last_signals: Array<{ source: string; delta: number; at: string }>;
    };
    last_updated: string;
  } | null;

  // Self-efficacy (from Discovery Station 5 sliders)
  self_efficacy: {
    making: { value: number; trajectory: 'improving' | 'stable' | 'declining'; history: Array<{ value: number; at: string }> };
    researching: { value: number; trajectory: string; history: Array<{ value: number; at: string }> };
    presenting: { value: number; trajectory: string; history: Array<{ value: number; at: string }> };
    writing: { value: number; trajectory: string; history: Array<{ value: number; at: string }> };
    collaborating: { value: number; trajectory: string; history: Array<{ value: number; at: string }> };
    iterating: { value: number; trajectory: string; history: Array<{ value: number; at: string }> };
  };

  // Resources (from Station 5 card sort)
  resources: {
    time_budget_hours_per_week: number;
    have: string[];
    can_get: string[];
    dont_have: string[];
    human_resources: string[];  // mentor, collaborator, expert, peer, family
  };

  // Fear areas (from Station 7 fear cards)
  fear_areas: string[];

  // Current project (set when a unit or Open Studio project starts)
  active_project: {
    project_id: string;                    // references student_project_history.id
    project_type: string;
    direction: string;                     // what they chose in Station 6
    success_criteria: string[];            // from Station 7
    commitment_confidence: number;         // 0–100 from Station 7
    feasibility_score: number;             // AI-computed
    started_at: string;
  } | null;

  // Criterion trajectory (written by PassiveSignalWorker from assessment_records)
  criterion_trajectory: {
    criterion: string;           // 'A' | 'B' | 'C' | 'D' or framework-neutral tag
    average_level: number;       // running mean across units
    trend: 'improving' | 'stable' | 'declining';
    last_3_scores: Array<{ unit_id: string; level: number; at: string }>;
  }[];

  // Per-field freshness metadata for rolling-window decay (§4.2).
  // Synthesis applies TTL-based decay using these timestamps; stale fields fade from pedagogy_preferences.
  // TTLs (v1 defaults, tunable in src/lib/profile/staleness-config.ts):
  //   motivational_state: 21 days (fast-moving; adolescents shift quickly)
  //   self_efficacy: 30 days
  //   resources: 60 days
  //   fear_areas: 45 days
  //   active_project: never stale (replaced on unit switch)
  //   criterion_trajectory: 30 days (rolling window on assessment_records)
  //   recent_confusion_topics: 14 days
  //   energy_level: 7 days
  //   goal_for_term: never stale (persists until student updates)
  field_freshness: {
    motivational_state: string | null;
    self_efficacy: string;
    resources: string;
    fear_areas: string;
    active_project: string | null;
    criterion_trajectory: string;
    recent_confusion_topics: string | null;
    energy_level: string | null;
    goal_for_term: string | null;
  };

  // Short-horizon trajectory fields written by PassiveSignalWorker
  recent_confusion_topics: Array<{ topic: string; confidence: number; last_seen: string }> | null;
  energy_level: 'low' | 'neutral' | 'high' | null;
  goal_for_term: string | null;

  last_updated: string;
  last_deliberate_update: string;  // Last time a profiling journey touched this
  last_passive_update: string;     // Last time PassiveSignalWorker touched trajectory
}
```

**The split ownership here is deliberate.** `self_efficacy.value` and `resources` and `fear_areas` are deliberate self-report — only a profiling journey writes them. But `self_efficacy.trajectory` is computed from the history array by the passive signal worker, and `criterion_trajectory` is fully computed from `assessment_records`. The two writers never touch the same field.

### 8.4 `wellbeing` — What's shaping them outside the platform

**Writer:** `TeacherProfileEditor`
**Shape:** ARRAY of notes — NOT a single object (§4.1 OQ-2 decision: author-only with explicit share).
**Student-visible:** NO (teacher-only; students never receive this even in their own profile read).
**AI-visible:** NO (§4.4 — wellbeing does NOT feed `pedagogy_preferences` synthesis).
**Lifecycle:** Manual edits, append-only notes, audit-logged.
**Sensitive:** Yes.
**COPPA:** For students under 13, writes blocked unless `parental_consent.scope` contains `'wellbeing'`.

Wellbeing is stored as `wellbeing: WellbeingNote[]` where each note carries its author and an optional list of teachers the author has explicitly shared it with. RLS visibility: `author_teacher_id = auth.uid() OR auth.uid() = ANY(shared_with)`. No cross-teacher auto-sharing.

```typescript
type WellbeingNoteKind =
  | 'sen_provision'       // Formally documented learning support
  | 'language_profile'    // L1, CEFR, BICS/CALP (usually one per student)
  | 'accessibility'       // Screen reader, high contrast, etc.
  | 'tool_certification'  // Laser cutter cleared, etc.
  | 'software_proficiency'
  | 'pastoral_context'    // "Going through parents' separation"
  | 'pastoral_concern'    // Escalation-worthy
  | 'pastoral_celebration'
  | 'follow_up';

interface WellbeingNote {
  note_id: string;                    // uuid
  kind: WellbeingNoteKind;

  // Free-text body (required for pastoral_*, optional for structured kinds)
  body: string | null;

  // Structured payloads per kind — typed via discriminated union in code
  payload: SenProvisionPayload | LanguageProfilePayload | AccessibilityPayload
    | ToolCertificationPayload | SoftwareProficiencyPayload | null;

  // Authorship + sharing (§4.1 OQ-2)
  author_teacher_id: string;          // who wrote it — never changes
  shared_with: string[];              // array of teacher user_ids explicitly shared with; empty = author only
  author_name_snapshot: string;       // stored at write time so deleted teachers still render

  // Lifecycle
  created_at: string;
  updated_at: string;
  archived_at: string | null;         // soft delete
}

// Structured payloads (kept typed so UI can render them)
interface SenProvisionPayload {
  type: 'adhd' | 'dyslexia' | 'autism' | 'asd' | 'working_memory' | 'other';
  strategies: string[];               // ['chunked instructions', 'extra time', 'visual schedules']
  documented_at: string;
}

interface LanguageProfilePayload {
  l1: string | null;
  cefr_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null;
  bics_calp_estimate: 'BICS_only' | 'BICS_strong_CALP_developing' | 'CALP_proficient' | null;
  requires_scaffolding: boolean;
  scaffolding_tier: 1 | 2 | 3 | null;
  code_switching_observed: boolean;
}

interface AccessibilityPayload {
  type: 'screen_reader' | 'high_contrast' | 'reduced_motion' | 'caption_required' | 'other';
}

interface ToolCertificationPayload {
  tool: string;                       // 'laser_cutter', 'sewing_machine'
  level: 'novice' | 'supervised' | 'independent' | 'teacher';
  certified_at: string;
  expires_at: string | null;
}

interface SoftwareProficiencyPayload {
  software: string;
  level: 'novice' | 'competent' | 'proficient' | 'expert';
}
```

**Ethical guardrails baked into the schema:**
- Every note carries `author_teacher_id` — no anonymous notes.
- `shared_with` is opt-in per note. A note written under implicit Teacher↔student trust never auto-leaks to another teacher.
- No free-text about protected attributes (race, religion, sexual orientation, mental health diagnoses unless formally documented as a `sen_provision` note with payload).
- `pastoral_*` kinds are visually distinguished in UI so "context for teaching" ≠ "concern to escalate."
- This section is **never** sent to any AI prompt. AI systems read `pedagogy_preferences` which is synthesized WITHOUT wellbeing input. The only historical exception (scaffolding_tier, sen strategies flowing to prompts) is explicitly removed in v1 — if we want that behaviour later, it goes through the future pastoral-flags mechanism in §4.3, not via wellbeing notes.
- Teacher UI shows "visible to: you only" vs "visible to: you + 2 others" for every note; share button opens a picker of current teachers for this student.
- Archiving a note sets `archived_at` but keeps the row — full audit trail. A hard delete is only available to admins and writes an event.

### 8.5 `passive_signals` — Behavioural patterns observed by the platform

**Writer:** `PassiveSignalWorker` (nightly batch + real-time triggers)
**Student-visible:** NO (teacher-only, debatable — see open question OQ-3)
**Lifecycle:** Append-only deltas, rolling windows

```typescript
interface PassiveSignalsSection {
  // Engagement patterns
  engagement: {
    avg_session_length_minutes: number;
    avg_time_per_deep_work_page_minutes: number;
    sessions_per_week: number;
    uninterrupted_focus_minutes_p50: number;   // median focus stretch
    active_vs_passive_ratio: number;           // % time on active interaction pages vs reading
    revision_rate: number;                      // % of pages revisited with new responses
  };

  // Toolkit preferences (which tools they gravitate to)
  toolkit: {
    tools_attempted: string[];
    tool_depth_scores: Record<string, number>;  // per-tool engagement depth 0–1
    dominant_tool_category: string;             // 'creative' | 'analytical' | 'visual' | 'collaborative'
  };

  // Response patterns (how they write)
  response_patterns: {
    avg_response_word_count: number;
    specificity_score: number;                  // 0–1 (NLP: presence of concrete details)
    editing_style: 'draft_and_refine' | 'one_shot' | 'fragmented';
    typical_response_time_seconds: number;
  };

  // Pace (from pace feedback 🐢👌🏃)
  pace_profile: {
    self_reported_too_fast_count: number;
    self_reported_matched_count: number;
    self_reported_too_slow_count: number;
    dominant_pace_signal: 'too_fast' | 'matched' | 'too_slow';
  };

  // Cognitive level (from design_conversation_turns)
  cognitive_conversation: {
    avg_bloom_level: number;                    // 1–6
    typical_question_type: string;              // Paul's 6 question types
    effort_score_trajectory: 'improving' | 'stable' | 'declining';
  };

  // AI dependency (conversations per page ratio)
  ai_dependency: {
    conversations_per_page: number;
    dependency_tier: 'low' | 'moderate' | 'high';
    trajectory: 'improving' | 'stable' | 'declining';
  };

  // Divergence signals (where passive contradicts deliberate)
  divergence: {
    archetype_divergence_score: number;         // 0–1, how much toolkit usage disagrees with self-reported archetype
    flagged_for_next_profiling: boolean;        // Kit asks about it next time
  };

  // Resilience signals
  resilience: {
    revision_after_critical_feedback_rate: number;
    abandonment_rate: number;
    help_seeking_threshold: 'early' | 'mid_struggle' | 'late_or_never';
  };

  last_computed_at: string;
  window_days: number;  // Rolling window (default 30)
}
```

**Per the influence-factors research, these are proxies, not measurements.** The schema treats them as signals for a teacher and the AI to interpret, not facts about the student. No passive signal ever becomes a label visible to the student without the student's confirmation in a profiling journey.

### 8.7 `social` — Peer, collaboration, and group-work layer (§4.5 gap B)

**Writer:** `PeerInteractionWorker`
**Student-visible:** Partial (own collaboration_orientation + help_seeking_pattern visible; peer_influences and group_history teacher-only to avoid social comparison harm)
**Lifecycle:** Nightly batch + real-time on Class Gallery / Peer Review / Teaching Mode events
**Sensitive:** Yes (contains references to other students by ID)
**COPPA:** For students under 13, writes blocked unless `parental_consent.scope` contains `'social'`.

```typescript
interface SocialSection {
  // How this student collaborates in general
  collaboration_orientation: {
    mode: 'lone_wolf' | 'small_group' | 'connector' | 'adaptive';
    value: number;                        // 0–1 (0=solo strongly preferred, 1=thrives in groups)
    evidence_count: number;               // how many group projects / peer events feed this
    confidence: number;                   // 0–1
    last_updated: string;
  };

  // Critique quality — both directions
  critique_giving_quality: {
    specificity: number;                  // 0–1 (vague "looks good" vs targeted observations)
    kindness: number;                     // 0–1 (tone analysis of peer review comments)
    actionability: number;                // 0–1 (does feedback suggest next steps?)
    frequency: number;                    // comments per peer review cycle
    last_updated: string;
  };
  critique_receiving_quality: {
    openness: number;                     // 0–1 (does the student revise after feedback?)
    defensiveness: number;                // 0–1 (inverse signal)
    follow_through: number;               // 0–1 (do they act on the feedback they mark helpful?)
    last_updated: string;
  };

  // Help-seeking pattern
  help_seeking_pattern: {
    threshold: 'early' | 'mid_struggle' | 'late_or_never';
    channels: Array<'peer' | 'teacher' | 'ai' | 'self'>;
    preferred_channel: 'peer' | 'teacher' | 'ai' | 'self';
    asymmetry: number;                    // -1 (only gives help) to +1 (only asks for help); 0 = balanced
    last_updated: string;
  };

  // Peer influences — whose work does this student reference, view repeatedly, or mention?
  // Teacher-only. Bidirectional analysis: who influences them, who do they influence.
  // References are anonymised in the student-facing view; teacher sees names.
  peer_influences: Array<{
    peer_student_id: string;              // FK to students
    influence_score: number;              // 0–1 (weight of interaction)
    signals: Array<'views_work' | 'comments' | 'borrows_approach' | 'collaborates' | 'references'>;
    first_seen: string;
    last_reinforced: string;
  }>;

  // Group-work history (§4.5 gap B — "sometimes they work in groups")
  // Written when a group project ends. Captures role played + group dynamics.
  group_history: Array<{
    group_id: string;                     // synthetic id for the group instance
    project_id: string;                   // FK to student_project_history
    unit_id: string | null;
    open_studio_plan_id: string | null;
    members: string[];                    // student_ids of co-members (teacher-only)
    role_played: 'facilitator' | 'maker' | 'researcher' | 'presenter' | 'synthesiser' | 'follower' | 'floater';
    role_confidence: number;              // 0–1 (from teacher observation + peer review tags)
    group_dynamics: {
      contribution_balance: number;       // 0–1 (did this student contribute evenly vs dominate vs coast?)
      conflict_events: number;
      consensus_style: 'collaborative' | 'compromising' | 'competing' | 'accommodating' | 'avoiding';
    };
    outcome: 'strong' | 'mixed' | 'struggled' | 'abandoned';
    started_at: string;
    ended_at: string;
  }>;

  // Active group memberships for in-flight group projects
  current_groups: Array<{
    group_id: string;
    project_id: string;
    members: string[];
    current_role_hypothesis: string;      // live guess, refined by PeerInteractionWorker
    started_at: string;
  }>;

  last_computed_at: string;
  window_days: number;                    // rolling window (default 60)
}
```

**Why it's its own section, not part of `passive_signals`:**
- Different writer (PeerInteractionWorker, not PassiveSignalWorker) — different data sources
- Contains cross-student references (peer_influences, group_history.members) with different visibility rules — teacher sees names, AI sees anonymised weights
- Has distinct lifecycle triggers (Peer Review cycles, group project completion)
- Deserves its own COPPA scope so parents can consent to pedagogy data without consenting to peer-linking data

**Cross-student privacy rule:** when `getStudentProfile` returns `social` to a `system` viewer, `peer_influences[].peer_student_id` and `group_history[].members[]` are replaced with opaque hashes so the AI can reason about "you work well with peer X" without learning the peer's identity. Teacher view sees names.

### 8.8 `custom` — Registered dimensions slot (§4.5 gap C)

**Writer:** Per-dimension writer class declared in `profile_dimensions`
**Student-visible:** Per-dimension (from `profile_dimensions.visibility`)
**Lifecycle:** Per-dimension TTL and reset rules

```typescript
// The `profile.custom` slot is a map keyed by dimension_id.
// Each entry is validated against profile_dimensions.data_schema at write time.
type CustomSection = Record<string, {
  dimension_id: string;                   // mirrors key — redundant but makes entries self-describing
  value: unknown;                         // shape defined by profile_dimensions.data_schema
  confidence: number;                     // 0–1
  last_updated: string;
  writer_class: string;                   // mirrors profile_dimensions.writer_class at write time
  source_journey_session_id: string | null;
}>;
```

See §7.6 for the registry mechanics. At read time, `getStudentProfile` joins `profile.custom` against `profile_dimensions` and filters entries by viewer visibility before returning.

### 8.6 `pedagogy_preferences` — Derived

**Writer:** `ProfileSynthesisJob` (read-only to everyone else, including other writers)
**Student-visible:** Yes (in a simplified "how you learn best" form)
**Lifecycle:** Recomputed after any upstream write

**Inputs (§4.4 + §4.5):** synthesis reads `identity` + `cognitive` + `current_state` (including `motivational_state`) + `passive_signals` + `social` + active registered dimensions from `profile.custom`, with TTL decay applied per §4.2. **`wellbeing` is NOT an input** — wellbeing notes are for human teachers, not AI. If identity is `null`, synthesis returns `cold_start: true` + neutral defaults.

```typescript
interface PedagogyPreferences {
  // Cold-start flag — AI should check this first
  cold_start: boolean;                  // true when profile is too empty for meaningful synthesis

  // Communication style preferences (derived from cognitive + identity)
  prefers_visual: number;               // 0–1 (high spatial + low verbal memory → high)
  prefers_structured: number;           // 0–1 (low flexible thinking → high)
  tolerates_ambiguity: number;          // 0–1 (high flexible thinking → high)
  needs_repetition: number;             // 0–1 (low visual/verbal memory → high)
  benefits_from_analogies: number;      // 0–1 (high verbal memory + low spatial → high)

  // Scaffolding needs (derived from current_state + passive)
  // NOTE: wellbeing is NOT an input. Sentence-starter / visual-schedule needs are
  // inferred from passive signals + current_state only in v1. If a teacher knows
  // better, they use the teacher-nudge mechanism below.
  scaffolding_intensity: 'heavy' | 'moderate' | 'light' | 'minimal';
  needs_sentence_starters: boolean;
  needs_visual_schedule: boolean;

  // Pacing preferences (derived from passive + current_state)
  preferred_session_length_minutes: number;
  preferred_task_chunk_size: 'small' | 'medium' | 'large';

  // AI interaction preferences (derived from passive + cognitive)
  preferred_question_depth: 'surface' | 'apply' | 'analyse' | 'evaluate';
  preferred_explanation_length: 'brief' | 'moderate' | 'thorough';

  // Teacher nudges (§4.2) — applied as weighted biases on each recompute, never hard-override
  teacher_nudges: Array<{
    nudge_id: string;
    field: keyof PedagogyPreferences;   // which field to bias
    direction: number;                   // -1 to +1 (how hard to pull the value)
    weight: number;                      // 0–1 (how much the nudge competes with signal)
    reason: string;                      // required — audited
    author_teacher_id: string;
    created_at: string;
    expires_at: string | null;           // null = until teacher revokes
  }>;

  // Human-readable summary used in AI prompts
  prompt_guidance: string;
  /* Example: "This student learns best with concrete visual examples first,
     then short written explanation. Keep chunks under 15 min. Use analogies
     for abstract concepts. Ask 'apply' level questions — they can handle
     analysis but need to warm up first." */

  computed_at: string;
  last_synthesis_event_id: number;      // FK to student_learning_events — lets teacher UI pull the synthesis_trace
  inputs_snapshot: {
    identity_updated_at: string | null;
    cognitive_updated_at: string | null;
    current_state_updated_at: string | null;
    passive_signals_updated_at: string | null;
    // wellbeing deliberately omitted — not an input
  };
}
```

**This is the field AI prompts actually read.** Design Assistant doesn't look at `cognitive.spatial_reasoning.score`; it looks at `pedagogy_preferences.prefers_visual` and `pedagogy_preferences.prompt_guidance`. That's the whole point of the computed layer — the interpretation logic lives in one place (the synthesis job), and every prompt just reads the cooked-down result.

**Cold-start output:** when `identity` is null, synthesis short-circuits to a canonical neutral record (all preference values = 0.5, `scaffolding_intensity = 'moderate'`, generic `prompt_guidance`), sets `cold_start: true`, and returns. No rules applied, no trace written. See `src/lib/profile/cold-start-defaults.ts`.

---

## 9. Confidence Levels

`meta.confidence_level` is the **minimum** across all populated sections. A section is "populated" when its writer has written to it at least once.

| Level | Meaning | AI behaviour |
|---|---|---|
| `cold_start` | No data in one or more populated sections | Use pedagogy-neutral defaults, ask open questions, don't reference profile |
| `learning` | Data present but low confidence (e.g. fewer than 3 conversations, 1 completed profiling journey) | Reference profile tentatively ("I noticed you mentioned liking..."), verify before adapting heavily |
| `established` | Confident profile across all active sections (≥ 1 completed profiling journey + ≥ 5 conversations + at least 1 project in history) | Adapt freely, reference specifics, trust the profile |

Section-level confidence is independent — `identity: established` + `cognitive: cold_start` is a valid and common state. The pedagogy-preferences synthesis handles partial sections by degrading gracefully (falls back to identity-only inference when cognitive is absent).

---

## 10. Synthesis Logic

Synthesis functions convert raw inputs to canonical profile sections. Each is a pure function: `(inputs) => SectionData`. Pure = testable and replayable. All live under `src/lib/profile/` so tuning doesn't touch prompts or UI.

### 10.1 `synthesizeIdentity(journey_session) → IdentitySection`

**Input:** A completed `journey_sessions` row with `goal_type = 'profiling'`
**Output:** `IdentitySection`

Pseudo:
```
1. Collect block responses by tag (archetype, working_style, interests, etc.)
2. For archetype: sum scenario response weights across Station 2 blocks into a
   Record<ArchetypeKey, number>, normalise so sum = 1 → archetype_weights
3. archetype_primary = argmax(archetype_weights)
4. archetype_secondary = 2nd argmax ONLY if (primary - secondary) < 0.15, else null
5. archetype_confidence = 1 - normalizedEntropy(archetype_weights)
   (peaky distribution = high confidence; flat distribution = low confidence)
6. For working_style: map binary choices to dimension values (-1..1)
7. For interests: union existing identity.interests[] with new selections,
   apply recency weighting (boost new, decay old)
8. Call Haiku to generate working_style.narrative (2 sentences, deterministic template)
9. Return new IdentitySection
```

Returning a profiling journey with `session_type = 'confirm_only'` takes the existing identity, applies only the diffs the student confirmed, and preserves everything else (recency timestamps advance).

**SDT-tagged block handling (§4.5 Gap A).** Profiling journeys may include blocks tagged `motivation:autonomy | competence | relatedness | purpose`. When `synthesizeIdentity` encounters these, it routes the signal to `current_state.motivational_state.<dimension>` rather than identity: appends to `last_signals[]`, recomputes value (rolling mean of last 5 signals), updates trajectory (Δ vs prior value), recomputes confidence (signal count capped at 10 → 0..1). These writes go through `writeCurrentState(student_id, { motivational_state: {...} })` — `ProfilingJourneyWriter` holds the writer grant for current_state per §6.2.

**Stated references capture (§4.5 Gap D).** Blocks tagged `designer_reference` (student names a designer they admire) append to `identity.creative_voice.stated_references[]` with `{name, source: 'self_reported', captured_at}`. De-duped by case-insensitive name match. This is the only `creative_voice` field `ProfilingJourneyWriter` writes — everything else under `creative_voice` is owned by `CreativeVoiceWorker` (§10.7).

### 10.2 `synthesizeCognitive(cognitive_journey_session) → CognitiveSection`

**Input:** A completed cognitive puzzle journey session (doesn't exist yet)
**Output:** `CognitiveSection`

Stub in v1: returns all traits at `null`. Writer class exists so the wiring is in place; puzzle implementation is a separate project.

### 10.3 `computePassiveSignals(student_id, window_days=30) → PassiveSignalsSection`

`PassiveSignalWorker` is **four sub-modules** (§4.2), each owning a slice of `PassiveSignalsSection`. The worker composes them into a single write.

```
PassiveSignalWorker (src/lib/profile/passive/)
├── transcripts.ts        → cognitive_conversation, response_patterns, ai_dependency
├── toolkit.ts            → toolkit, divergence.archetype_divergence_score
├── grading.ts            → (writes to current_state.criterion_trajectory, not passive directly)
└── integrity.ts          → engagement, pace_profile, resilience
```

**Sub-module: `transcripts.ts` (Design Assistant transcripts parser)**
- Inputs: last N `design_conversations` + `design_conversation_turns` in window
- Outputs: avg bloom level (via turn metadata), typical question type, dependency tier (conversations / pages), response word count, specificity score (concrete noun density)
- ~1 day to build; reuses existing transcript schema

**Sub-module: `toolkit.ts` (toolkit completion aggregator)**
- Inputs: `student_tool_sessions` (toolkit tool usage), portfolio entries tagged by tool
- Outputs: tools_attempted, tool_depth_scores, dominant_tool_category, archetype_divergence_score (compares toolkit usage pattern against identity.archetype_weights)
- ~0.5 day

**Sub-module: `grading.ts` (grading scores + feedback aggregator)**
- Inputs: `assessment_records` for this student, teacher feedback text fields
- Outputs: writes into `current_state.criterion_trajectory` directly (not passive_signals — this is trajectory data). Computes running mean + trend per criterion.
- ~1 day — the trajectory math is non-trivial; needs framework-neutral criterion keys

**Sub-module: `integrity.ts` (MonitoredTextarea + Open Studio drift aggregator)**
- Inputs: `student_progress` timing, monitored textarea signals, Open Studio drift events
- Outputs: engagement fields (avg_session_length, uninterrupted_focus, revision_rate), pace_profile (from 🐢👌🏃 feedback), resilience (abandonment_rate, help_seeking_threshold)
- ~0.5 day

**Trigger schedule:**
- Nightly batch at 2am UTC runs all 4 modules
- Real-time triggers:
  - `assessment_records` INSERT → grading.ts only
  - `design_conversations` COMPLETED → transcripts.ts only
  - `student_tool_sessions` COMPLETED → toolkit.ts only
- Every real-time run enqueues a `ProfileSynthesisJob` on completion

### 10.4 `synthesizePedagogyPreferences(profile) → PedagogyPreferences`

**Input:** A full `student_learning_profile` row
**Output:** `PedagogyPreferences` + a `synthesis_trace` written to `student_learning_events`
**Trigger:** Debounced async — enqueued 30s after any upstream write (§4.1 OQ-9)

Deterministic. No AI call in v1 — every rule is a weighted sum with transparent contributions that the teacher UI can render.

Pseudo:
```
1. If identity is null → return COLD_START_DEFAULTS (cold_start: true, all values 0.5,
   scaffolding_intensity='moderate', generic prompt_guidance). No trace written.

2. Build TTL-decayed input bundle (§4.2):
   For each field in current_state + passive_signals:
     age_days = (now - field.last_updated) / 1 day
     ttl_days = staleness_config[field]
     decay_factor = max(0, 1 - age_days / ttl_days)   // linear decay; hits 0 at TTL
     decayed_value = raw_value * decay_factor
   current_unit, goal_for_term: decay_factor always 1 (never stale)

3. Initialise trace = {} (field → list of contributions)

4. For each pedagogy field, apply rules. Each rule records a trace entry:
   trace[field].push({
     source: 'cognitive' | 'passive_signals' | 'current_state' | 'identity',
     path: 'spatial_reasoning',
     raw_value: 0.9,
     weight: 0.4,
     contribution: 0.36
   })

   Example rule set for prefers_visual:
     base = 0.5
     + 0.4 * cognitive.spatial_reasoning.score           (if present)
     + 0.3 * passive.toolkit.visual_tool_usage_share     (if present)
     + 0.3 * (1 - passive.response_patterns.verbal_density)
     − 0.4 * cognitive.verbal_memory.score               (if present)
     clamp to [0, 1]

5. Apply teacher nudges BEFORE clamping final values:
   For each nudge in pedagogy_preferences.teacher_nudges (skip expired):
     nudged = value * (1 - nudge.weight) + nudge.direction * nudge.weight
     trace[nudge.field].push({
       source: 'teacher_nudge',
       path: `nudge:${nudge.nudge_id}`,
       raw_value: nudge.direction,
       weight: nudge.weight,
       contribution: nudged - value
     })

6. scaffolding_intensity:
   - Bucket from weighted sum of (needs_repetition + response_patterns.editing_style
     + pace_profile.dominant_pace_signal + cognitive.working_memory inverse
     + (1 − current_state.motivational_state.competence.value) * 0.3)
   - NOTE: wellbeing language_profile NOT read (decision §4.4).

6b. SDT-based rules (§4.5 Gap A — from current_state.motivational_state):
    - If autonomy.value < 0.4 → prompt_guidance adds "offer 2-3 choices at each
      decision point; avoid prescriptive single-path framing"
    - If relatedness.value < 0.4 → "reference peer work and class examples; use
      'we' framing; avoid isolating 'your individual design'"
    - If purpose.value < 0.4 → "connect every suggestion back to stated interests
      (identity.interests[]) or active_project rationale"
    - If competence.value < 0.4 → scaffolding_intensity += 0.15 bias, "celebrate
      small wins explicitly; break tasks into <10-minute chunks"
    Each rule writes a trace entry with source='current_state',
    path='motivational_state.<dim>.value', weight set per rule. Rules only fire
    when motivational_state.<dim>.confidence >= 0.3 (avoid reacting to noise).

6c. Social-based rules (§4.5 Gap B — from social):
    - If collaboration_orientation.mode == 'lone_wolf' AND current_group present
      → prompt_guidance adds "acknowledge preference for independent work within
      group context; suggest parallel workstreams"
    - If critique_receiving_quality.openness < 0.4 → "frame feedback as
      observations + questions, not directives; avoid public critique framing"
    - If help_seeking_pattern.threshold > 0.7 (delays asking) → "prompt proactive
      check-ins every 15 minutes; don't wait for student to ask"
    - If help_seeking_pattern.asymmetry > 0.5 (asks peers, not AI) → reduce AI
      dependency scaffolding, encourage peer-first help loop
    Rules only fire when evidence_count >= 3 or confidence >= 0.3.

6d. Registered dimension loop (§4.5 Gap C — from profile.custom):
    For each dimension_id in profile.custom where the dimension is registered
    in profile_dimensions AND has synthesis_contributions defined:
      rule = profile_dimensions[dimension_id].synthesis_contributions
      For each target_field, weight in rule:
        value = profile.custom[dimension_id].value
        confidence = profile.custom[dimension_id].confidence
        effective_weight = weight * confidence
        apply weighted contribution to pedagogy_preferences[target_field]
        trace entry: source='custom', path=dimension_id, weight=effective_weight
    This lets new journey blocks declare dimensions (e.g. 'metacognition_score')
    and have them influence pedagogy_preferences without any code change here.

7. Render prompt_guidance from a template against the computed values
   (src/lib/profile/prompt-guidance-templates.ts). Template now branches on SDT
   + social rule hits to compose the final guidance string.

8. Write event to student_learning_events with:
   writer_class = 'ProfileSynthesisJob'
   section = 'pedagogy_preferences'
   synthesis_trace = trace
   new_value = computed PedagogyPreferences

9. Return PedagogyPreferences (with last_synthesis_event_id set to the new event row id)
```

**All rules live in one file** (`src/lib/profile/pedagogy-synthesis.ts`) so they're tunable without touching prompts or UI. Every rule has a unit test (`pedagogy-synthesis.test.ts` seeds fixture profiles and asserts both the value AND the trace shape). Changing a rule bumps `schema_version` and triggers a global re-synthesis job via the debounced queue.

### 10.5 `ProfileSynthesisJob` worker

```
loop:
  job = SELECT FROM profile_synthesis_jobs
        WHERE status='pending' AND scheduled_for <= now()
        ORDER BY scheduled_for
        FOR UPDATE SKIP LOCKED LIMIT 1
  if no job: sleep 5s, continue

  mark job 'running', attempts++
  try:
    profile = getStudentProfile(job.student_id, {viewer: system, sections: all})
    new_prefs = synthesizePedagogyPreferences(profile)
    writePedagogyPreferences(job.student_id, new_prefs)
    mark job 'succeeded'
  catch e:
    if attempts < 3:
      mark 'pending', scheduled_for = now() + backoff(attempts)
    else:
      mark 'failed', alert ops, last_error = e.message
```

**Enqueue rule:** any writer that commits to `identity` / `cognitive` / `current_state` / `passive_signals` / `social` / `custom` calls `enqueueProfileSynthesis(student_id)`. The function tries to insert a `pending` row; if one already exists for this student (via the unique index), it updates `scheduled_for = now() + 30s` (debounce window reset) and marks the incoming duplicate `collapsed` in the return value.

### 10.6 `PeerInteractionWorker` (§4.5 Gap B) — computes `social`

**Inputs:**
- `class_gallery_entries` + `peer_review_records` (critique giving / receiving text + ratings)
- `teaching_mode_check_ins` (pair/small-group check-in events)
- `group_projects` + `group_memberships` (current + historical group rosters)
- `student_progress.help_seeking_events` (when/where student asks for help)
- Design Assistant transcript intent tags (`asked_peer_first`, `asked_ai_first`)

**Output:** writes `social` section via `writeSocial(student_id, SocialSection)`.

**Trigger schedule:**
- Nightly batch at 02:30 UTC (after PassiveSignalWorker) — recomputes collaboration_orientation, help_seeking, peer_influences from rolling 60-day window
- Real-time: `peer_review_records` INSERT → updates critique_giving/receiving quality for both reviewer and reviewee
- Real-time: `group_memberships` INSERT/UPDATE → updates `current_groups[]` immediately, appends snapshot to `group_history[]` on group end

**Algorithm sketch:**
```
collaboration_orientation:
  Score each of the 4 modes from evidence:
    lone_wolf:  high help_seeking.threshold + asymmetry toward AI
                + low peer_review frequency + low current_groups count
    small_group: frequent check-ins with same 2-4 peers + positive group outcomes
    connector:  high breadth of peer interactions + high critique frequency
    adaptive:   mode varies by project type (computed across 3+ projects)
  mode = argmax, confidence = 1 - normalizedEntropy(mode_scores)

critique_giving_quality:
  specificity = avg(len(quoted_work_reference) / len(critique_text)) from peer_review_records
  kindness    = sentiment analysis + presence of affirming clauses (Haiku call, batched)
  actionability = presence of imperative verbs + concrete suggestions
  frequency   = critiques_written / peer_reviews_expected (rolling 30d)

critique_receiving_quality:
  openness       = (revisions made after critique) / (critiques received)
  defensiveness  = sentiment of student's response to critique (Haiku, batched)
  follow_through = time-to-revision after receiving critique

help_seeking_pattern:
  threshold = avg(time_stuck_before_asking) normalized
  channels  = count by {ai, peer, teacher}
  preferred_channel = argmax(channels)
  asymmetry = |peer_asks - ai_asks| / (peer_asks + ai_asks)

peer_influences[]:
  For each peer seen in group_history OR peer_review_records (last 180d):
    signals = [co_selected_archetype, critique_adoption_rate, imitative_design_moves]
    influence_score = weighted sum (0..1)
    Keep top 10 by influence_score.

group_history:
  On group end, append {group_id, members, role_played, outcome}.
  role_played inferred from contribution patterns (facilitator, maker, researcher, etc.)
  group_dynamics = {harmony: 0..1, productivity: 0..1} from check-in sentiment

current_groups:
  Live mirror of group_memberships where status='active'.
  role_hypothesis updated daily from first 3 days of check-ins.
```

**Idempotency:** worker writes a deterministic snapshot per run; re-running produces same result.
**COPPA gate:** all writes blocked for under-13 students without `parental_consent.scope` including `social`.
**Build estimate:** 1.5 days (§4.5 cost breakdown).

### 10.7 `CreativeVoiceWorker` (§4.5 Gap D) — computes `identity.creative_voice`

**Writer class grant exception:** `CreativeVoiceWorker` is granted narrow write access to `identity.creative_voice.*` via a carved-out `writeCreativeVoice(student_id, patch)` SECURITY DEFINER function. This is the only writer class that touches identity besides `ProfilingJourneyWriter` — the grant is surgical (can only write `creative_voice` fields, cannot touch archetype_*, working_style, interests, values_hierarchy).

**Inputs:**
- Work Capture submissions (student photos/videos of their designs) → Voyage AI voyage-3.5 embeddings (1024-dim, stored on `work_items.aesthetic_embedding`)
- Work Capture AI enrichment tags (material tags, visual tags from Claude Vision pipeline)
- `identity.creative_voice.stated_references[]` (set by ProfilingJourneyWriter)
- Designer corpus embeddings (pre-computed reference library — 20 designers from Designer Mentor spec, plus ~200 canonical works)

**Output:** `writeCreativeVoice(student_id, { aesthetic_embedding, material_preferences, visual_tags, revealed_references, voice_confidence })`.

**Trigger schedule:**
- Real-time: `work_items` INSERT with embedding → recompute student's rolling aesthetic_embedding (exponentially weighted mean of last 10 submissions, half-life ~30 days)
- Nightly batch: recompute revealed_references via cosine similarity against designer corpus, keep top-5 with similarity > 0.72

**Algorithm sketch:**
```
aesthetic_embedding:
  embeddings = last 10 work_items.aesthetic_embedding (newest first)
  weights = exp(-age_days / 30) for each
  rolling = Σ(embedding_i * weight_i) / Σ(weight_i)
  L2-normalize.

material_preferences:
  For each material tag in work_items.ai_enrichment.materials (last 60d):
    count frequency, bucket into preference strengths.
  Record as Record<material, 0..1>.

visual_tags:
  Union of work_items.ai_enrichment.visual_tags (last 60d).
  Rank by recency * frequency.

revealed_references:
  For each designer_embedding in designer_corpus:
    similarity = cosine(rolling_aesthetic_embedding, designer_embedding)
  Keep top 5 where similarity > 0.72, with similarity score stored.
  stated_references[] that match revealed_references get marked 'confirmed'.

voice_confidence:
  Increases with: # of work submissions with embeddings (cap at 20)
  Decreases with: variance in embeddings (high variance = unstable voice)
  Range 0..1.
```

**Designer Mentor matching hook:** `src/lib/mentor/matcher.ts` (separate spec) reads `identity.creative_voice.aesthetic_embedding` and does top-K cosine against mentor corpus. This is the primary unblock.

**Idempotency:** rolling embedding is deterministic given the same input set.
**COPPA gate:** creative_voice is treated as part of identity, which does NOT require extra scope — it's student-generated work, so base profile consent covers it. stated_references explicitly self-reported.
**Build estimate:** 1 day (§4.5 cost breakdown) — assumes Work Capture pipeline already emits embeddings.

### 10.8 `TrajectorySnapshotJob` (§4.5 Gap E) — appends to `identity.trajectory_snapshots[]`

**Writer class grant exception:** like §10.7, this writer has a narrow `writeTrajectorySnapshot(student_id, snapshot)` SECURITY DEFINER function that can only append to `identity.trajectory_snapshots[]`.

**Purpose:** over a 6-year student arc, naive audit-log scans become O(N) expensive and AI prompts can't fit the full history. Snapshots compress the state at meaningful moments into O(1) retrievals.

**Trigger schedule:**
- **Scheduled:** end of each academic term (configurable per school calendar) — automatic snapshot
- **Drift-triggered:** when `archetype_weights` change by > 0.15 on any dimension between reads (computed by diff-watcher on every ProfilingJourneyWriter commit)
- **Manual:** teacher can force a snapshot via admin button ("Mark this moment as significant")
- **On project completion:** when `student_project_history` row gains `completed_at`, a snapshot is written with `trigger='project_end'`

**Snapshot shape (per §8.1):**
```typescript
{
  snapshot_id: uuid,
  captured_at: timestamp,
  term_label: 'Year 10 Spring' | 'Year 11 Autumn' | ...,
  trigger: 'term_end' | 'drift' | 'manual' | 'project_end',
  archetype_weights: {...},           // copy of identity.archetype_weights at capture
  sdt_summary: {                      // compressed motivational_state
    autonomy: number, competence: number,
    relatedness: number, purpose: number
  },
  self_efficacy_summary: {            // compressed current_state.self_efficacy
    making: number, researching: number, presenting: number, ...
  },
  notable_delta: string | null        // 1-sentence human-readable delta vs prior
                                       // snapshot ("shifted from Maker to Researcher primary")
}
```

**Invariants:**
- Snapshots are immutable once written (append-only array)
- Array capped at 50 snapshots; when exceeded, oldest non-term-end snapshots are dropped first
- `notable_delta` is computed deterministically from the prior snapshot diff (no AI)

**Read API use:** `getStudentProfile(studentId, {includeTrajectory: true})` returns the full snapshots array. Teacher UI renders a sparkline of archetype_weights over time. Long-horizon AI prompts (e.g. year-end reflection) inject the 3 most recent snapshots into context.

**Build estimate:** 0.5 days (§4.5 cost breakdown).

---

## 11. Read API

Every AI touchpoint and every UI surface reads through one function. Direct `student_learning_profile` reads are grep-enforced in CI (forbidden outside `src/lib/profile/read.ts`).

### 11.1 `getStudentProfile(studentId, options)`

```typescript
interface ProfileReadOptions {
  sections?: ('identity' | 'cognitive' | 'current_state' | 'wellbeing' | 'passive_signals' | 'social' | 'custom' | 'pedagogy_preferences')[];
  viewer:
    | { role: 'student'; user_id: string }
    | { role: 'teacher'; user_id: string }
    | { role: 'system'; touchpoint: string };  // touchpoint = 'design_assistant' | 'open_studio_critic' | 'mentor_matcher' | ...
  includeTrajectory?: boolean;  // default false — trajectory_snapshots[] only hydrated when explicitly requested
}

async function getStudentProfile(
  studentId: string,
  options: ProfileReadOptions
): Promise<StudentLearningProfile>
```

**Rules enforced inside `getStudentProfile`:**

1. **Self-check.** If `viewer.role === 'student'` and `viewer.user_id !== studentId`, throw `ForbiddenError`.
2. **Student stripping.** If `viewer.role === 'student'`, strip `wellbeing` (entire array), `passive_signals`, and `social` from the result, even if requested. `custom` is filtered to only dimensions with `visibility: 'student_visible'` in the `profile_dimensions` registry.
3. **Teacher RLS row-level.** If `viewer.role === 'teacher'`, the underlying SELECT goes through RLS (teacher has an active enrollment for this student via some class).
4. **Teacher wellbeing field-level (§4.1 OQ-2).** If `viewer.role === 'teacher'`, filter the `wellbeing` array in application code to include only notes where:
   - `note.author_teacher_id === viewer.user_id`, OR
   - `viewer.user_id ∈ note.shared_with`
   Archived notes (`archived_at != null`) are excluded unless `includeArchived: true` is passed.
5. **COPPA gate (§4.1 OQ-4 + §4.5 Gap B).** If the student is under 13 (`is_under_13(studentId)`) and `parental_consent.scope` does not include a requested sensitive section, that section returns `null` with a `consent_required: true` flag in `meta`. **Sensitive sections now include:** `wellbeing`, `cognitive`, `passive_signals`, **`social`** (new — peer data is cross-student PII). `social` scope must be explicitly granted for any social-section read, regardless of viewer role.
6. **System viewer.** If `viewer.role === 'system'`, no student-role stripping — AI can read any section — but:
   - Wellbeing is **never** returned to system viewers in v1 (§4.4). AI never sees wellbeing.
   - The caller's `touchpoint` is logged to a lightweight `profile_read_log` for usage analytics.
   - **Cross-student privacy rule (§8.7).** When returning `social` to a system viewer, replace `peer_influences[].peer_student_id` and every `group_history[].members[]` entry with opaque hashes (HMAC-SHA256 of peer_id with a per-request salt). The AI can reason about "peer A influences you" without learning any peer's identity. `current_groups[].members[]` gets the same treatment. Teacher view keeps real names.
   - `mentor_matcher` touchpoint is the ONLY system viewer permitted to read `identity.creative_voice.aesthetic_embedding` — other touchpoints get it stripped to avoid 1024-dim bloat in prompts.
7. **Response shape.** Return sections in the shape defined in §8, with `meta.section_confidence` + `meta.cold_start` attached.
8. **Trajectory gating.** `identity.trajectory_snapshots[]` is only included when `options.includeTrajectory === true`. Default read returns it as `[]` with `meta.trajectory_omitted: true`.
9. **Custom section filtering.** For every viewer role, each `profile.custom[dimension_id]` entry is checked against `profile_dimensions[dimension_id].visibility` (`system_only | teacher_visible | student_visible`). Entries the viewer isn't authorised to see are dropped silently. Unknown dimension_ids (dimension deregistered but data still present) are returned under `meta.orphaned_dimensions[]` for admin cleanup, never in the payload itself.

### 11.2 `profileToNarrative(profile, options)` — Student-facing rendering (§4.2)

Students never see raw JSONB or numeric scores. They see a templated narrative generated from their profile.

```typescript
interface NarrativeOptions {
  tone: 'warm' | 'neutral';             // defaults to 'warm'
  length: 'short' | 'full';             // 'short' = 80 words, 'full' = 250 words
  focus?: 'archetype' | 'strengths' | 'how_ai_helps' | 'all';
}

interface ProfileNarrative {
  headline: string;                      // "You're a Maker, with a strong Researcher streak"
  archetype_paragraph: string;           // 2–3 sentences about archetype_primary + secondary tail
  strengths: Array<{                     // top 3 from pedagogy_preferences + identity
    label: string;                       // "You think in pictures"
    body: string;                        // 1–2 sentences
  }>;
  how_ai_helps: string;                  // Plain-English version of pedagogy_preferences.prompt_guidance
  next_step_hint: string | null;         // If cold_start, nudges toward a profiling journey
}

function profileToNarrative(
  profile: StudentLearningProfile,
  options?: NarrativeOptions
): ProfileNarrative
```

- Pure function. No AI call. Template-driven. Templates live in `src/lib/profile/narrative-templates.ts`.
- One template per archetype for `archetype_paragraph`. One template per `prefers_*` field bucket for `strengths`. One template per `scaffolding_intensity` + `preferred_explanation_length` combo for `how_ai_helps`.
- **No numbers ever appear in the output.** `prefers_visual: 0.82` becomes "You think in pictures — diagrams land better than paragraphs."
- Cold-start case: `headline = "Let's figure out your Design DNA"`, `next_step_hint` points to the profiling journey.
- UX copy pass required — flag for design:ux-copy skill review before Phase C ships.

### 11.3 `resetProfile(studentId, options)` — Soft reset (§4.2)

```typescript
interface ResetOptions {
  sections?: Array<'identity' | 'cognitive' | 'current_state'>;  // default: all three
  reason: string;                        // required — audited
  initiated_by: { role: 'student' | 'teacher' | 'admin'; user_id: string };
}

async function resetProfile(studentId: string, options: ResetOptions): Promise<{
  archived_event_ids: number[];
}>
```

**Behaviour:**
1. For each requested section, write an `student_learning_events` row with:
   - `writer_class = 'ResetOperation'`
   - `section = <section>`
   - `prior_value = <current value>`
   - `new_value = null`
   - `diff_summary = 'Reset initiated by <role>: <reason>'`
2. Zero the section in `student_learning_profile.profile.<section>` and set its `meta.section_confidence` to `cold_start`.
3. **Do not touch** `wellbeing` (teacher-owned) or `passive_signals` (rebuilds from source data automatically).
4. Enqueue a ProfileSynthesisJob so `pedagogy_preferences` recomputes immediately.
5. Return the archived event ids so a future `replayProfileFromEvents(studentId, ids)` can restore.

### 11.4 `GET /api/admin/student/:id/export` — Data export (§4.2)

**Auth:** teacher with active enrollment for the student, or admin.
**Response:** Streaming JSON download with filename `student_<student_id>_profile_<date>.json`.
**Payload:**

```json
{
  "export_metadata": {
    "student_id": "uuid",
    "student_name": "Jane Doe",
    "exported_at": "2026-04-10T14:00:00Z",
    "exported_by": { "user_id": "uuid", "name": "Teacher Name", "role": "teacher" },
    "schema_version": 1
  },
  "human_readable_summary": "Jane Doe is a Year 10 student with a Maker-primary archetype...",
  "profile": { /* full student_learning_profile row */ },
  "project_history": [ /* all student_project_history rows */ ],
  "learning_events": [ /* last 1000 student_learning_events rows */ ],
  "wellbeing_notes_visible_to_exporter": [ /* only notes the exporter is authorised to see */ ]
}
```

- Wellbeing notes are filtered by the same author-only + shared_with rules as `getStudentProfile`.
- Not student-self-serve in v1 — only teacher/admin can trigger.
- Adds a `student_learning_events` row logging the export (`writer_class = 'DataExport'`).
- GDPR-ready within minutes of any subject access request.

---

## 12. User Stories

### Students
1. As a student doing Discovery for the first time, I want my archetype and working style to feel accurate to me so that I trust the AI that follows.
2. As a returning student, I want Discovery's confirm-and-adjust step to remember what I said last time so that I don't re-enter the same information.
3. As a student whose brain works visually, I want the AI mentor to show me diagrams and examples rather than walls of text so that explanations actually land.
4. As a student talking to Design Assistant, I want it to reference my specific interests and recent projects so that its suggestions feel relevant to me, not generic.
5. As a student who resets my profile, I want all my previous profile data cleared and to start a new Discovery journey so that I'm not stuck with an outdated version of myself.

### Teachers
1. As a teacher, I want to see every student's profile on their detail page so that I can personalise my instruction without running 30 separate 1:1s.
2. As a teacher, I want to enter SEN provisions, language profile, and pastoral notes in one place so that the AI and other teachers both benefit from what I know about the student.
3. As a teacher, I want students' pastoral notes to be invisible to the student themselves so that I can record context honestly without fearing the student reads it.
4. As a teacher, I want to flag a student's profile as "needs refresh" so that the next time they use Discovery they get the full experience, not the quick confirm.
5. As a teacher, I want to see the class's archetype distribution and confidence gaps so that I can design the next unit around the actual class, not an average imagined one.
6. As a teacher, I want an audit log for a student's profile so that if a parent asks "why does the AI think my child is X," I can explain exactly where that came from.

### AI systems (internal)
1. As Design Assistant, I want to read `pedagogy_preferences.prompt_guidance` so that I can inject adaptive scaffolding into my system prompt without parsing raw cognitive scores.
2. As the Unit Generator, I want to read an entire class's profiles so that I can weight activities toward the class's strengths and scaffold its gaps.
3. As Drift Detection, I want to compare a student's current project direction to `identity.interests` so that I can flag silent drift from stated motivation.

---

## 13. Requirements

### P0 — Must Have (v1 ships without any of these cut)

**P0-1. Core schema + three satellite tables exist with RLS + write gating**
- [ ] `student_learning_profile`, `student_project_history`, `student_learning_events` tables created via migration
- [ ] RLS policies reject direct `INSERT`/`UPDATE`/`DELETE` from `authenticated` role
- [ ] `SECURITY DEFINER` functions exist for every write path, one per writer class
- [ ] All writes emit a `student_learning_events` row (enforced in the function body)
- [ ] JSONB shape validated via a check constraint against `schema_version`
- [ ] Migration is reversible (down script tested)

**P0-2. Read API with section-level visibility**
- [ ] `getStudentProfile(studentId, options)` function in `src/lib/profile/read.ts`
- [ ] Student role read strips `wellbeing` + `passive_signals` unconditionally
- [ ] Teacher role read enforces class ownership check
- [ ] System role reads are logged to a lightweight telemetry table
- [ ] Grep-level CI check: no other file touches `student_learning_profile` tables directly
- [ ] 100% test coverage of visibility edge cases (cross-class teacher, suspended student, deleted student)

**P0-3. `ProfilingJourneyWriter` writer class + Identity synthesis**
- [ ] `synthesizeIdentity(journey_session)` pure function with unit tests covering all 6 archetypes
- [ ] Writer class invoked when a journey with `goal_type='profiling'` completes
- [ ] Handles full journeys and confirm-only journeys differently per §10.1
- [ ] Writes `identity` section + updates parts of `current_state` (self_efficacy values, resources, fear_areas, active_project)
- [ ] Preserves interests[] across sessions with recency weighting
- [ ] Fires synthesis job after commit

**P0-4. `PassiveSignalWorker` background job**
- [ ] Nightly cron at 02:00 UTC reads existing tables, writes `passive_signals`
- [ ] Real-time trigger: new `assessment_records` → updates `criterion_trajectory` only
- [ ] Real-time trigger: `design_conversations` completion → updates `cognitive_conversation` only
- [ ] All six passive signal groups computed (engagement, toolkit, response_patterns, pace, ai_dependency, resilience)
- [ ] Divergence scoring computed against identity
- [ ] Job is idempotent (re-running produces same result)
- [ ] Runs in under 60s for 1000 students

**P0-5. `ProfileSynthesisJob` → `pedagogy_preferences`**
- [ ] Deterministic synthesis function with every rule unit-tested
- [ ] Triggered within 30s of any upstream write
- [ ] Handles null sections gracefully (cognitive always null in v1)
- [ ] Generates `prompt_guidance` from template (no AI call in v1)
- [ ] Re-synthesis is idempotent
- [ ] Bumping `schema_version` triggers global re-synthesis

**P0-6. Profile-aware Design Assistant (the proof-of-value loop)**
- [ ] `design-assistant-prompt.ts` injects `pedagogy_preferences.prompt_guidance` into system prompt
- [ ] Injects `identity.archetype_primary` + `identity.interests` (top 3) + `current_state.active_project` if present
- [ ] Handles `cold_start` by injecting only safe default scaffolding
- [ ] A/B visible in responses within 3 days of shipping the schema
- [ ] Teacher can preview what the AI sees about a specific student (debug view)

**P0-7. Teacher read-only profile view on student-detail page**
- [ ] New tab "Profile" on student-detail page
- [ ] Renders all five sections in teacher view
- [ ] Shows `student_learning_events` audit log (last 20 events)
- [ ] Links to raw journey session for any event
- [ ] "Reset profile" button (triggers delete + next Discovery will be full)

**P0-8. Migration + cutover**
- [ ] Migration 065 creates tables, functions, RLS policies
- [ ] Old `discovery_sessions.profile_data` reads remain working for backward compatibility of existing journey session display only
- [ ] No bulk data migration (hard cutover — §16.1)
- [ ] Feature flag `student_profile_v1` controls whether the Design Assistant reads the new profile (can roll back instantly)
- [ ] Existing `students.learning_profile` column (if present, added by Journey Engine spec draft) is dropped in the same migration — this spec is the only writer of student profile data

**P0-9. COPPA / parental consent gate (§4.1)**
- [ ] `student_learning_profile.date_of_birth` + `parental_consent` JSONB columns populated at row creation
- [ ] `is_under_13(student_id)` and `parental_consent_covers(student_id, section)` SECURITY DEFINER functions enforced inside every writer function
- [ ] Writes to `wellbeing`, `cognitive`, and `passive_signals` are blocked for under-13 students without matching consent scope
- [ ] Consent grants emit a `student_learning_events` row (immutable audit trail)
- [ ] Read API strips sections the viewer is not authorised to see even after COPPA gating has passed

**P0-10. Teacher nudge mechanism (§4.2)**
- [ ] `pedagogy_preferences.teacher_nudges[]` array with author, direction, weight, expires_at
- [ ] Synthesis applies nudges as weighted bias after deterministic rule computation — never as override
- [ ] Nudges expire automatically; expired nudges are archived in `student_learning_events`
- [ ] Teacher UI surfaces nudges separately from synthesised values
- [ ] Nudge UI ships in Phase C

**P0-11. Narrative renderer + student-facing view (§11.2)**
- [ ] `profileToNarrative(profile, viewer_role)` function renders profile as prose with zero numeric values
- [ ] Cold-start headline path returns the "Let's figure out your Design DNA" variant
- [ ] UX copy pass (design:ux-copy skill) complete before Phase D ships
- [ ] Student-facing view never displays `passive_signals` or `wellbeing` or raw scores

**P0-12. GDPR-ready export route (§11.4)**
- [ ] `GET /api/admin/student/:id/export` streaming JSON
- [ ] Wellbeing filtered by author-only + shared_with rules
- [ ] Export writes a `student_learning_events` row (`writer_class = 'DataExport'`)
- [ ] Teacher-or-admin only — not student-self-serve in v1

**P0-13. SDT motivational_state + SDT-based synthesis rules (§4.5 Gap A, §10.1, §10.4)**
- [ ] `current_state.motivational_state` shape exists with autonomy/competence/relatedness/purpose, each `{value, trajectory, confidence, last_signals[]}`
- [ ] `motivational_state` has 21-day TTL in `field_freshness` staleness config
- [ ] `ProfilingJourneyWriter` routes `motivation:*` tagged blocks to motivational_state
- [ ] `synthesizePedagogyPreferences` §6b SDT rule set implemented with unit tests for each dimension
- [ ] scaffolding_intensity incorporates `(1 − competence.value)` weighted term
- [ ] Rules only fire when per-dimension confidence ≥ 0.3 (noise floor)

**P0-14. Social section + PeerInteractionWorker (§4.5 Gap B, §8.7, §10.6)**
- [ ] `social` section exists in schema with collaboration_orientation, critique_giving/receiving quality, help_seeking_pattern, peer_influences[], group_history[], current_groups[]
- [ ] `PeerInteractionWorker` nightly batch + real-time triggers on peer_review_records and group_memberships
- [ ] Cross-student privacy rule enforced in `getStudentProfile` for system viewers (opaque peer_student_id hashes)
- [ ] COPPA `social` scope required for under-13 students
- [ ] Social-based synthesis rules (§10.4 6c) wired into pedagogy_preferences with unit tests
- [ ] Group work support: current_groups + group_history populated from Teaching Mode + group_memberships
- [ ] Student-role read strips social unconditionally

**P0-15. Dimension registry + custom section (§4.5 Gap C, §7.6, §8.8, §10.4 6d)**
- [ ] `profile_dimensions` table with dimension_id, data_type, data_schema, writer_class, ttl_days, visibility, synthesis_contributions, narrative_template
- [ ] `profile.custom` JSONB slot in student_learning_profile
- [ ] `<RegisteredDimensionWriter>` SECURITY DEFINER function dispatcher (per dimension_id writer_class check)
- [ ] Dimension registry discovery loop in §10.4 (step 6d) reads registered dimensions and applies synthesis_contributions
- [ ] V1 restricts registration to admin role (teacher registration is P2)
- [ ] 2 seeded dimensions shipped: `metacognition_score`, `feedback_receptiveness`
- [ ] `custom` section filtering by visibility in `getStudentProfile`
- [ ] `meta.orphaned_dimensions[]` reported for deregistered dimensions still in data

**P0-16. Creative voice + CreativeVoiceWorker (§4.5 Gap D, §8.1, §10.7)**
- [ ] `identity.creative_voice` shape with aesthetic_embedding (1024-dim), material_preferences, visual_tags, stated_references, revealed_references, voice_confidence
- [ ] `writeCreativeVoice` SECURITY DEFINER function with surgical grant (cannot touch archetype_*, working_style, interests, values_hierarchy)
- [ ] `CreativeVoiceWorker` real-time trigger on `work_items` INSERT with embedding
- [ ] Nightly revealed_references recompute via cosine similarity against designer corpus
- [ ] Designer corpus pre-computed (20 designers from Designer Mentor spec + ~200 canonical works) with voyage-3.5 embeddings
- [ ] `mentor_matcher` touchpoint is the ONLY system viewer that gets aesthetic_embedding in the read response
- [ ] Unblocks Designer Mentor matching (separate spec)

**P0-17. Trajectory snapshots + TrajectorySnapshotJob (§4.5 Gap E, §8.1, §10.8)**
- [ ] `identity.trajectory_snapshots[]` shape (immutable, append-only, capped at 50)
- [ ] `writeTrajectorySnapshot` SECURITY DEFINER function (append-only to trajectory_snapshots array)
- [ ] `TrajectorySnapshotJob` with 4 triggers: term_end (scheduled), drift (archetype Δ > 0.15), manual, project_end
- [ ] `notable_delta` computed deterministically from prior snapshot diff (no AI)
- [ ] `getStudentProfile({includeTrajectory: true})` hydrates snapshots; default read returns empty array with `meta.trajectory_omitted: true`
- [ ] Teacher UI sparkline reads trajectory_snapshots (Phase C)

### P1 — Nice to Have (fast follows, target within 2 weeks of P0)

**P1-1. Teacher wellbeing editor UI**
- Form for SEN provisions, language profile, accessibility, certifications, pastoral notes
- Termly "review prompt" banner
- Change log per field

**P1-2. Student-facing "Your Designer Profile" view**
- Renders student-visible sections in narrative form
- Shows `identity` + `cognitive` (once populated) + `current_state.self_efficacy`
- Opt-in "confirm & adjust" entry point for returning students

**P1-3. Class profile aggregate view**
- Teacher dashboard widget showing class archetype distribution, common fears, efficacy gaps
- Used by v2 of unit generation

**P1-4. Profile-aware Open Studio critic**
- Open Studio prompt reads profile and adapts the 5 interaction modes

**P1-5. Reflection-journey-triggered `current_state` updates**
- Post-project reflection journeys write to `student_project_history` and update `self_efficacy` trajectories

### P2 — Future Considerations (not building, but designing to support)

- **Cognitive puzzle journeys** — writer stub exists, schema shape reserved, synthesis handles nulls
- **AI-generated `prompt_guidance`** — v1 uses a template, v2 could use Haiku for more natural language
- **External assessment import** — `cognitive.external_source` field exists for future MindPrint etc. ingest
- **Group profile dimension** (for PYPx) — can be layered on via a sibling `class_learning_profile` table without touching student profile
- **Parent/guardian view** — could render student-visible sections with additional filters; schema already supports viewer-based stripping
- **Cross-unit trajectory analysis** — `student_project_history` schema supports queries like "find all Year 10 Makers whose Criterion B has declined"
- **Model-based scoring** — deterministic rules ship first; any ML model can replace specific rules while keeping the schema stable

---

## 14. Success Metrics

### Leading indicators (measurable within 1–2 weeks)

| Metric | Target | Measurement |
|---|---|---|
| Profile creation rate | ≥ 90% of students who complete a profiling journey have a populated `identity` section within 30s | Count `student_learning_profile` rows with non-null `identity` / count Discovery completions |
| Read API adoption | 100% of profile reads go through `getStudentProfile` | CI grep + runtime warning if raw table access detected |
| Audit log completeness | 100% of writes produce a `student_learning_events` row | Trigger-enforced + reconciliation job |
| Design Assistant profile injection rate | ≥ 95% of DA conversations with an established profile include `prompt_guidance` in the system prompt | Log sampling |
| Passive signal job reliability | Nightly job success rate ≥ 99% | Cron monitoring |
| Synthesis latency | `pedagogy_preferences` written within 30s of upstream write | p95 timing |

### Lagging indicators (measurable within 1–3 months)

| Metric | Target | Measurement |
|---|---|---|
| Teacher profile review rate | ≥ 50% of teachers view a student's profile tab at least once per student per term | Event logging on profile tab |
| Perceived AI relevance | Teacher survey: "Design Assistant responses feel tailored to this student" ≥ 4/5 | In-app survey after 5+ conversations |
| Student "this actually understands me" signal | Opt-in student survey after Discovery reveal: ≥ 70% "agree" | Post-reveal survey |
| Profile divergence detection | ≥ 1 surfaced divergence per student per term prompts a confirm-and-adjust | Count of `divergence.flagged_for_next_profiling = true` |
| Grading personalisation lift | Teacher-reported time savings on per-student feedback when profile is present vs not | A/B via feature flag |
| Zero cross-writer collisions | 0 production incidents where two writers overwrote each other's sections | Incident log |

---

## 15. Open Questions

| # | Question | Who answers | Blocking? |
|---|---|---|---|
| OQ-1 | Should `passive_signals` ever be student-visible in simplified form (e.g. "you tend to revise your work 3× on average")? Current spec says no. | Matt + Melbourne pilot teachers | Non-blocking (can add later) |
| ~~OQ-2~~ | ~~Multi-class wellbeing visibility~~ | **RESOLVED — see §4.1.** Author-only with explicit `shared_with[]` per WellbeingNote. Wellbeing is now an array, not a single object. |
| OQ-3 | Does the audit log show students their own event history? If so, do we strip the writer class name (too technical)? | Design + Matt | Non-blocking |
| ~~OQ-4~~ | ~~COPPA / under-13 parental consent~~ | **RESOLVED — see §4.1.** `date_of_birth` + `parental_consent` JSONB added to profile; `is_under_13()` + `parental_consent_covers()` helper functions block writes to sensitive sections until consent is granted. |
| OQ-5 | Do `wellbeing` notes get indexed for search (teachers searching "dyslexia" across their class)? Tension with sensitivity. | Matt | Non-blocking |
| OQ-6 | How long do we retain `student_learning_events`? Forever is appealing for explainability but grows unbounded. | Engineering | Non-blocking (default 2 years, revisit) |
| OQ-7 | When `identity` is rewritten on a fresh Discovery, do we preserve the old version somewhere? Students could request to revert. | Matt | Non-blocking (soft reset in §11.3 archives to events, `replayProfileFromEvents` can restore) |
| OQ-8 | Are `passive_signals` computed per class or global? A student might be "high engagement" in Art but "low engagement" in Science. StudioLoom is single-subject for now but Loominary isn't. | Matt + OS lead | Non-blocking for StudioLoom v1, blocking for Loominary OS extraction |
| ~~OQ-9~~ | ~~Synthesis job trigger mechanism~~ | **RESOLVED — see §4.1.** Debounced async job via `profile_synthesis_jobs` queue table; 30s debounce window; app-layer enqueue from each writer function (no DB triggers). Worker spec in §10.5. |
| OQ-10 | Does `pedagogy_preferences.prompt_guidance` have a hard character limit? Large prompts eat token budget. | Engineering | Non-blocking (default 500 chars, can tune) |
| OQ-11 | Dimension sprawl: who polices the `profile_dimensions` registry once teachers can register dimensions (P2)? Need a naming convention, review queue, or cap per school. | Matt + OS lead | Non-blocking for v1 (admin-only) |
| OQ-12 | Creative voice embedding staleness: when a student's aesthetic drifts over years, should we snapshot old embeddings for mentor matching history? Current spec only keeps rolling mean. | Matt + Designer Mentor lead | Non-blocking (trajectory_snapshots cover archetype drift; creative_voice drift is separate) |
| OQ-13 | Cross-student privacy salt: should the HMAC salt for peer_student_id anonymisation rotate per request, per session, or per student? Rotating per request defeats AI reasoning across turns; per-session is the likely answer but needs confirmation. | Engineering + Matt | Blocking P0-14 — must resolve before PeerInteractionWorker ships |
| OQ-14 | Group data cross-student leak risk: if teacher A reads student X's social section and sees group_history including student Y (who teacher A doesn't teach), is that a FERPA violation? Current spec allows it if teacher A has any class overlap. | Legal + Matt | Blocking P0-14 — potential RLS tightening needed |
| OQ-15 | SDT signal source variety: do we have enough tagged profiling blocks to populate motivational_state reliably in v1, or do we need to backfill Discovery Engine blocks with motivation tags first? | Matt | Blocking P0-13 — audit Discovery blocks before Phase A Day 3 |

---

## 16. Migration / Cutover Plan

### 16.1 Hard cutover rules

1. **No bulk migration script.** Existing `discovery_sessions` rows remain untouched.
2. Migration 065 drops `students.learning_profile` (the stub column from migration 048 proposed by the Journey Engine spec). It was never populated in production. See cross-spec note in `docs/specs/journey-engine-spec.md`.
3. On deployment day, every `student_learning_profile` row is created with all sections `null`, `meta.confidence_level: cold_start`, and `parental_consent.granted: false`. `date_of_birth` is backfilled from the existing `students` table where available; students with no DOB are treated as under-13 until proven otherwise.
4. Feature flag `student_profile_v1` defaults to **off** in production; turns on per-class or per-school for gradual rollout.
5. **COPPA gate activation:** For any student flagged as under-13, writes to `wellbeing`, `cognitive`, and `passive_signals` are blocked until a teacher/admin grants parental consent via the admin UI. Writes to `identity` and `current_state` from a profiling journey are permitted because they're initiated by the student's own in-session actions. Teachers are shown a banner on under-13 student detail pages listing which sections are currently gated.
6. First time a student runs Discovery after cutover, `ProfilingJourneyWriter` creates a fully populated `identity` + partial `current_state`. `passive_signals` fills in over the next week via the background worker (subject to COPPA gate).
7. Students who ran Discovery *before* cutover but haven't since will hit an empty profile. Design Assistant behaves safely (cold_start path). They get personalised AI the first time they run the new Discovery.
8. Existing `discovery_sessions` data remains visible in admin/history views for audit and replay, but is never synthesized into the new profile.

### 16.2 Rollback plan

1. Turn off `student_profile_v1` feature flag → Design Assistant reverts to non-profile-aware prompt
2. Writes continue (non-destructive to existing tables)
3. If the schema itself needs a rollback: down migration drops the four new tables. No data loss because no old data was migrated in.

### 16.3 Day-one monitoring

- Dashboard: writes per writer class per hour
- Dashboard: read API calls per viewer type
- Alert: any cross-section write (writer class writing to a section it doesn't own)
- Alert: any direct table access not via `getStudentProfile`
- Alert: synthesis job failures

---

## 17. Phased Build Plan

**Total estimate: 21–25 days of focused work**, broken into four phases. Original estimate was 15–19d; stretched by +6d for the §4.5 structural additions (SDT motivational_state, social/peer + group work, dimension registry, creative_voice, trajectory snapshots). Each phase is independently deployable and provides standalone value.

### Phase A — Schema + Read API + Synthesis + Design Assistant loop (11 days)
*Goal: prove the end-to-end loop with Identity + motivational_state + all four passive signal sub-modules + dimension registry foundation + Design Assistant.*

- Day 1: Migration 065 — `student_learning_profile` (incl. `social`, `custom` slots + `motivational_state` in current_state + `creative_voice` + `trajectory_snapshots[]` in identity), `student_project_history`, `student_learning_events` (+ `synthesis_trace` + `custom_dimension_id`), `profile_synthesis_jobs`, `profile_dimensions` registry, RLS, `SECURITY DEFINER` functions per writer class (7 built-in + dispatcher), write gating, COPPA helper functions (`is_under_13`, `parental_consent_covers` with `social` scope)
- Day 2: `getStudentProfile` read API + 9 enforcement rules (including author-only wellbeing filter, COPPA social gate, cross-student peer hash anonymisation, custom visibility filtering, trajectory gating) + tests
- Day 3: `ProfilingJourneyWriter` + `synthesizeIdentity` (archetype_weights + entropy confidence) + SDT routing to motivational_state + designer_reference capture + unit tests for all 6 archetypes
- Day 4: **SDT synthesis rules + motivational_state wiring (§4.5 Gap A)** — §10.4 6b rule set, scaffolding_intensity competence bias, 21-day TTL config, unit tests per SDT dimension
- Day 5: `ProfileSynthesisJob` worker — debounce queue consumer, TTL decay loop, nudge application, trace recording, cold_start short-circuit, dimension-registry discovery loop (§10.4 6d)
- Day 6: Passive signal sub-module 1 — **transcripts** (`src/lib/profile/passive/transcripts.ts`) reading `design_conversations` + `open_studio_conversations`
- Day 7: Passive signal sub-module 2 — **toolkit** (`src/lib/profile/passive/toolkit.ts`) reading `student_tool_sessions`
- Day 8: Passive signal sub-modules 3 + 4 — **grading** (`grading.ts`) reading `assessment_records`, **integrity** (`integrity.ts`) reading drift/copy-paste events
- Day 9: **Dimension registry seed + custom writer dispatcher (§4.5 Gap C)** — `profile_dimensions` seed rows (`metacognition_score`, `feedback_receptiveness`), `<RegisteredDimensionWriter>` dispatcher SECURITY DEFINER function, custom section read filtering, admin-only registration UI stub
- Day 10: **CreativeVoiceWorker (§4.5 Gap D)** — real-time trigger on `work_items`, rolling aesthetic_embedding math, nightly revealed_references cosine job, designer corpus bootstrap (20 designers + canonical works, voyage-3.5 embeddings), `writeCreativeVoice` SECURITY DEFINER function
- Day 11: Design Assistant integration — inject `pedagogy_preferences.prompt_guidance` + identity + active_project, feature flag `student_profile_v1`, debug view, ship to Matt's pilot class

**Exit criteria:** Matt runs Discovery with a test student, checks the profile tab, starts a Design Assistant conversation, and sees the AI reference the student's archetype, interests, and motivational_state-derived scaffolding. A second test student who has used the platform (tools + conversations + assessments + work submissions) for a few days has all four passive signal groups populated AND a rolling creative_voice embedding. A third test student with an admin-registered `metacognition_score` dimension has it flowing into pedagogy_preferences synthesis.

### Phase B — Current State trajectory + Peer/Social + Divergence detection (5 days)
*Goal: profile stays fresh on its own, peer and group dynamics are captured, identity drift is flagged, long-horizon snapshots are written.*

- Day 12: Trajectory computation (self_efficacy history, criterion trajectory) + field_freshness TTL logic
- Day 13: Divergence scoring (passive signals vs identity) + `flagged_for_next_profiling` trigger
- Day 14: **PeerInteractionWorker (§4.5 Gap B)** — collaboration_orientation scoring, critique quality (specificity + actionability deterministic; kindness + defensiveness batched Haiku calls), help_seeking_pattern, peer_influences top-10, group_history appender
- Day 15: **PeerInteractionWorker group work support** — current_groups live mirror, role_hypothesis inference from first 3 days of check-ins, group_dynamics (harmony/productivity) from sentiment, social-based synthesis rules (§10.4 6c) with unit tests
- Day 16: **TrajectorySnapshotJob (§4.5 Gap E)** — 4 triggers (term_end scheduled, drift diff-watcher, manual, project_end), `writeTrajectorySnapshot` append-only SECURITY DEFINER, notable_delta deterministic computation, 50-snapshot cap with eviction. Real-time enqueue triggers also wired: `assessment_records` insert, `design_conversations` completion, `peer_review_records` insert, `group_memberships` change.

**Exit criteria:** A student whose behaviour drifts from their stated archetype is flagged for a confirm-and-adjust journey. A pilot class with active group projects has `social.current_groups[]` populated and role_hypothesis per student. Term-end snapshots are written automatically on a test cron run.

### Phase C — Teacher UI + Wellbeing + Nudge mechanism + Trajectory view (4 days)
*Goal: teachers can read the full profile (including social + trajectory), manage wellbeing notes with author-only visibility, and bias pedagogy without overriding AI synthesis.*

- Day 17: Student-detail page profile tab — all seven sections in teacher view (identity incl. creative_voice + trajectory sparkline, cognitive, current_state incl. motivational_state, wellbeing, passive_signals, social with real peer names, custom registered dimensions), author-filtered wellbeing notes list, audit log with last 20 events + synthesis_trace drill-down
- Day 18: `TeacherWellbeingEditor` — discriminated-union form for 5 wellbeing payload kinds, `shared_with[]` selector, termly review banner, "Reset profile" button (soft reset per §11.3), manual trajectory snapshot trigger button
- Day 19: **Teacher nudge UI** — weighted-bias controls for pedagogy_preferences fields (e.g. "bias this student toward more scaffolding for 2 weeks"), nudge expiry, nudge audit trail, visible in debug view as a separate bar above synthesised values. SDT dimension nudges supported (bias autonomy/competence framing)
- Day 20: **Group view for teachers** — class-level view of `current_groups[]` across all students, group dynamics heatmap, dead-group detection (harmony < 0.3 flag), teacher quick-action to dissolve/reshuffle groups

**Exit criteria:** A pilot teacher can enter a student's SEN provisions (visible only to them + teachers on the `shared_with` list), see Design Assistant scaffolding adapt within 30s, nudge a student toward more visual examples without the system forgetting the passive-signal evidence, see a trajectory sparkline showing archetype drift over term, and review group dynamics at a class level.

### Phase D — Student-facing narrative + Export + Cleanup (5 days)
*Goal: students see a numbers-free narrative of themselves; GDPR export works; Designer Mentor matching is unblocked; codebase is clean of raw profile reads.*

- Day 21: `profileToNarrative(profile)` renderer + student-facing "Your Designer Profile" view (narrative only, zero numbers) + cold_start headline path + creative_voice narrative ("Your designs are starting to look like...") + trajectory narrative ("Since the start of term, you've been leaning more toward...")
- Day 22: **UX copy pass** (design:ux-copy skill) on narrative strings + confirm-and-adjust returning journey variant writer path + social section narrative (student-visible subset only — never names peers, only patterns)
- Day 23: **Designer Mentor matcher hook (§10.7 unblock)** — `src/lib/mentor/matcher.ts` stub consuming `identity.creative_voice.aesthetic_embedding` via `mentor_matcher` touchpoint, top-K cosine against mentor corpus, returning top 3 matches (full matching system is separate spec — this day just wires the hook)
- Day 24: `GET /api/admin/student/:id/export` streaming JSON route (incl. all sections, anonymised peer hashes for export, trajectory_snapshots full) + audit log entry on export + subject-access-request runbook
- Day 25 (buffer): CI grep rule for raw table access, runtime warnings, telemetry dashboard, OQ cleanup, v1 polish, edge-case tests

**Exit criteria:** Student sees their own profile as a narrative (no percentages, no scores, no peer names), can trigger a "confirm and adjust" flow, a teacher can export a GDPR-ready student dump in under 10 seconds, the Designer Mentor matcher hook returns top 3 mentors given a populated creative_voice, and the codebase has zero direct reads of `student_learning_profile` outside `getStudentProfile`.

---

## 18. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Writer classes drift and two features write to the same section | Medium | High | Enforced via `SECURITY DEFINER` functions + CI grep + explicit writer class parameter |
| Passive signal job gets slow as student count grows | Medium | Medium | Targeted real-time triggers for high-frequency fields; full batch stays bounded; incremental computation where possible |
| Pedagogy_preferences rules produce bad prompt guidance that silently degrades AI quality | High | High | Every rule unit-tested; A/B flag; teacher-visible debug view shows exactly what gets injected; rollback via feature flag |
| Students feel surveilled once they see the audit log | Low | Medium | Audit log shows student only their own events in friendly language; `passive_signals` events are aggregated not per-observation |
| Pastoral notes leak to students via a prompt injection | Low | Critical | Wellbeing section is **never read by synthesis** and never enters any AI prompt (§4.4). `pedagogy_preferences` is computed from cognitive + current_state + passive_signals only. No derivation path exists. |
| Migration cutover leaves existing students with empty profiles → bad first experience | Medium | Medium | Feature flag defaults off; Design Assistant cold_start path is safe and generic; opt-in rollout per class |
| Teachers over-rely on profile and stop forming their own judgement | Low | Medium | UI framing: "conversation starter, not assessment"; profile never shows a single "type" label; narrative view shows archetype as a weighted mix, not a label |
| Teacher nudges drift from evidence — teacher nudges student into a style that the passive signals contradict | Medium | Medium | Nudges are weighted bias, not override (§4.2); nudges expire; debug view shows nudge and synthesis separately; divergence flag fires if nudged values contradict passive signals for >14 days |
| Synthesis debounce queue backs up under load | Low | Medium | `profile_synthesis_jobs` unique active index prevents duplicates; worker scales horizontally; p95 SLO + alert; fallback to on-read synthesis if queue > 500 pending |
| Multi-class wellbeing `shared_with[]` becomes stale as enrolments change | Medium | Medium | Nightly job prunes `shared_with` entries where the teacher is no longer enrolled with the student; author always retains access |
| COPPA consent grants are forged or bypassed | Low | Critical | `parental_consent_covers()` SECURITY DEFINER function is the ONLY write gate for sensitive sections; consent grants write an immutable `student_learning_events` row; quarterly audit of consent records |
| Schema grows as new fields get added ad-hoc | Medium | Medium | `schema_version` field + migration-only field additions + spec updates required before adding anything |
| **Peer data privacy leak to AI** (§4.5 Gap B) — system viewers see peer_student_ids in social section | Medium | **Critical** | Cross-student privacy rule (§11.1 rule 6) HMAC-hashes peer_student_id + group_history.members[] for system viewers. Per-session salt (OQ-13). CI test asserts no raw UUIDs reach AI prompts. |
| **Group FERPA leak** — teacher A reads student X's group_history, sees student Y from a class teacher A doesn't teach | Medium | **High** | OQ-14 blocker — either tighten RLS to require overlap with all members of group_history entries, or anonymise group members the teacher isn't enrolled with. Must resolve before P0-14 ships. |
| **Dimension sprawl** (§4.5 Gap C) — registered dimensions proliferate without governance | Medium | Medium | V1 admin-only registration; naming convention enforced by `dimension_id` regex; OQ-11 for P2 teacher-registration governance; review queue for new dimensions; orphaned dimensions surfaced in `meta.orphaned_dimensions[]` |
| **Creative_voice embedding staleness** (§4.5 Gap D) — student aesthetic evolves but rolling embedding forgets early work | Medium | Low | 30-day half-life is tunable; trajectory_snapshots cover archetype drift; OQ-12 for P2 creative_voice historical snapshots; mentor_matcher re-runs each session so results always reflect current voice |
| **SDT signal sparsity** (§4.5 Gap A) — motivational_state.confidence stays below 0.3 for most students in v1 | High | Medium | Rules only fire at confidence ≥ 0.3 (safe degradation); OQ-15 blocker — audit Discovery Engine blocks for motivation tags before Phase A Day 3; backfill profiling blocks with SDT tags if sparse |
| **Trajectory snapshot drift** (§4.5 Gap E) — drift trigger fires too often, snapshots balloon past 50 cap | Low | Low | 0.15 threshold tunable; eviction drops non-term-end snapshots first; 50-cap preserves worst-case year arc (~6 terms × 8 snapshots) |
| **CreativeVoiceWorker grant scope creep** — worker accidentally writes to non-creative_voice fields | Low | High | `writeCreativeVoice` SECURITY DEFINER function explicitly allowlists only `creative_voice.*` paths; unit test asserts attempts to write archetype_* / working_style / interests / values_hierarchy throw. Same applies to `writeTrajectorySnapshot` (append-only to trajectory_snapshots). |

---

## 19. Dependencies

| Dependency | Status | Required for |
|---|---|---|
| Dimensions3 generation pipeline | Complete (9 Apr 2026) | Nothing directly, but P1-3 class profile aggregate benefits from it |
| Journey Engine Phase 1 | Not started | `ProfilingJourneyWriter` invocation path — **but** Phase A can be built against the existing `discovery_sessions` table and swap to journey_sessions when Journey Engine ships |
| Existing `design_conversations`, `assessment_records`, `student_tool_sessions` tables | Exist | `PassiveSignalWorker` reads |
| `src/types/assessment.ts` `StudentLearningProfile` type | Exists, unwired | Becomes a TypeScript view into sections of the new table, not a separate type |
| Teacher student-detail page | Exists | Profile tab is added to it |

**Unblocked by this spec:**
- Open Studio v2 personalisation
- Cognitive Layer project
- Profile-aware unit generation
- Drift detection in Open Studio
- Loominary OS `StudentContext` service extraction

---

## 20. Related Documents

- `docs/specs/discovery-engine-build-plan.md` — Master Discovery build plan
- `docs/specs/discovery-engine-spec.md` — Data model for DiscoveryProfile (this spec supersedes the storage side; the interaction spec remains)
- `docs/specs/discovery-intelligence-layer-spec.md` — Earlier architectural draft (superseded)
- `docs/brain/student-learning-intelligence.md` — Earlier architectural draft (superseded)
- `docs/projects/discovery-engine-cognitive-layer.md` — The cognitive layer vision that the `cognitive` section is designed to accept
- `docs/research/student-influence-factors.md` — Research foundation for what to measure
- `docs/specs/journey-engine-spec.md` — The Journey Engine schema this reads from
- `docs/brain/ai-intelligence-architecture.md` — How profile data flows into AI prompts
- `docs/education-ai-patterns.md` — Pattern context for how AI adapts to profile data
- `src/types/assessment.ts` `StudentLearningProfile` — Existing type, becomes a view into this schema
- `../Loominary/docs/os/master-architecture.md` — OS context (this becomes the `StudentContext` service seed)
- `../Loominary/docs/adr/001-os-extraction-strategy.md` — Why we build for StudioLoom with OS seams

---

## 21. Appendix — Example AI Prompt Injection

This is what the `ProfilingJourneyWriter → PedagogySynthesisJob → Design Assistant` loop actually produces at the prompt level. It's here so the shape is concrete, not abstract.

**Input profile (after a Discovery + 2 weeks of usage):**
```json
{
  "identity": {
    "archetype_weights": {
      "maker": 0.42,
      "creative": 0.28,
      "researcher": 0.12,
      "communicator": 0.08,
      "leader": 0.06,
      "systems_thinker": 0.04
    },
    "interests": [
      { "tag": "sustainability", "source": "self_reported", "recency_weight": 1.0 },
      { "tag": "gaming", "source": "self_reported", "recency_weight": 1.0 },
      { "tag": "cooking", "source": "passive_signal", "recency_weight": 0.7 }
    ],
    "values_hierarchy": ["creating_things", "helping_others", "independence"],
    "creative_voice": {
      "aesthetic_embedding": "[1024-dim vector, omitted in viewer render]",
      "material_preferences": { "cardboard": 0.8, "recycled_plastic": 0.6, "wood": 0.4 },
      "visual_tags": ["warm", "hand-built", "layered", "organic"],
      "stated_references": [
        { "name": "Dieter Rams", "source": "self_reported", "captured_at": "2026-03-15T10:00:00Z" }
      ],
      "revealed_references": [
        { "name": "Formafantasma", "similarity": 0.81, "source": "cosine_match" },
        { "name": "Jasper Morrison", "similarity": 0.74, "source": "cosine_match" }
      ],
      "voice_confidence": 0.62
    },
    "trajectory_snapshots": [
      {
        "snapshot_id": "snap_001",
        "captured_at": "2026-02-15T00:00:00Z",
        "term_label": "Year 10 Spring",
        "trigger": "term_end",
        "archetype_weights": { "maker": 0.35, "creative": 0.32, "researcher": 0.18, "...": "..." },
        "sdt_summary": { "autonomy": 0.6, "competence": 0.5, "relatedness": 0.4, "purpose": 0.7 },
        "self_efficacy_summary": { "making": 68, "researching": 45, "presenting": 35 },
        "notable_delta": null
      }
    ]
  },
  "cognitive": null,
  "current_state": {
    "self_efficacy": {
      "making": { "value": 75, "trajectory": "stable" },
      "presenting": { "value": 30, "trajectory": "declining" },
      "researching": { "value": 50, "trajectory": "improving" }
    },
    "motivational_state": {
      "autonomy":    { "value": 0.65, "trajectory": "stable",   "confidence": 0.5, "last_signals": ["chose_own_brief", "picked_materials"] },
      "competence":  { "value": 0.72, "trajectory": "improving","confidence": 0.6, "last_signals": ["completed_prototype"] },
      "relatedness": { "value": 0.35, "trajectory": "declining","confidence": 0.4, "last_signals": ["skipped_critique", "worked_alone_3_sessions"] },
      "purpose":     { "value": 0.80, "trajectory": "stable",   "confidence": 0.7, "last_signals": ["sustainability_citation", "school_community_framing"] }
    },
    "active_project": {
      "direction": "Redesign school lunch queuing system",
      "success_criteria": ["reduces waiting by 30%", "students prefer new system"]
    },
    "field_freshness": {
      "self_efficacy": "2026-04-09T10:30:00Z",
      "motivational_state": "2026-04-08T14:20:00Z",
      "active_project": "2026-04-10T08:00:00Z"
    }
  },
  "social": {
    "collaboration_orientation": { "mode": "small_group", "value": 0.7, "evidence_count": 8, "confidence": 0.5 },
    "critique_giving_quality":   { "specificity": 0.6, "kindness": 0.8, "actionability": 0.5, "frequency": 0.4 },
    "critique_receiving_quality":{ "openness": 0.3, "defensiveness": 0.6, "follow_through": 0.4 },
    "help_seeking_pattern":      { "threshold": 0.65, "channels": { "ai": 12, "peer": 3, "teacher": 2 }, "preferred_channel": "ai", "asymmetry": 0.6 },
    "peer_influences": [
      { "peer_student_id": "[hash:a3f9...]", "influence_score": 0.72, "signals": ["critique_adoption"], "first_seen": "2026-02-10", "last_reinforced": "2026-04-05" }
    ],
    "group_history": [],
    "current_groups": [
      { "group_id": "grp_lunch_q", "members": ["[hash:a3f9...]", "[hash:b7c2...]"], "current_role_hypothesis": "maker" }
    ]
  },
  "custom": {
    "metacognition_score": { "dimension_id": "metacognition_score", "value": 0.55, "confidence": 0.4, "last_updated": "2026-04-01", "writer_class": "ReflectionJourneyWriter", "source_journey_session_id": "js_234" }
  },
  "wellbeing": [
    /* NOT READ BY SYNTHESIS — teacher-only pastoral layer */
  ],
  "passive_signals": {
    "response_patterns": { "avg_response_word_count": 18, "preferred_medium": "visual" },
    "ai_dependency": { "dependency_tier": "moderate" },
    "toolkit": { "tool_variety_score": 0.7, "revision_frequency": "high" }
  },
  "pedagogy_preferences": {
    "prefers_visual": 0.8,
    "scaffolding_intensity": "moderate",
    "preferred_explanation_length": "brief",
    "cold_start": false,
    "last_synthesis_event_id": 14823,
    "teacher_nudges": [],
    "prompt_guidance": "This student is a hands-on Maker with a creative secondary lean. They care about sustainability and their current project is redesigning school lunch queues. Self-efficacy in presenting is low and declining — be gentle around sharing/critique. Relatedness is low and declining — reference peer work and class examples, use 'we' framing rather than isolating individual design. Purpose is strong — connect suggestions back to sustainability and school community. They respond in short sentences and prefer visual examples — keep explanations brief, show examples before explaining, and reference concrete wins from making. Frame research as 'finding out' rather than 'academic research.'"
  }
}
```

**What Design Assistant sees in its system prompt:**
```
You are a design teaching assistant.

<student_context>
Name: [first name]
Archetype mix: Maker (dominant) with Creative secondary lean
Active project: Redesign school lunch queuing system
  Success criteria: reduces waiting by 30%; students prefer new system
Interests: sustainability, gaming, cooking
Values: creating things, helping others, independence

Self-efficacy snapshot:
  Making: 75 (stable) — strong, reference this as a foundation
  Researching: 50 (improving) — support the improvement
  Presenting: 30 (declining) — be gentle, avoid critique framing

Motivation snapshot (SDT):
  Purpose: strong (0.80, stable) — connect to sustainability + school community
  Autonomy: moderate (0.65) — keep offering 2-3 choices at decisions
  Competence: growing (0.72, improving) — celebrate small wins
  Relatedness: low (0.35, declining) — reference peer work, use 'we' framing

Pedagogy guidance:
  This student is a hands-on Maker with a creative secondary lean. They care
  about sustainability and their current project is redesigning school lunch
  queues. Self-efficacy in presenting is low and declining — be gentle around
  sharing/critique. Relatedness is low and declining — reference peer work
  and class examples, use 'we' framing rather than isolating individual
  design. Purpose is strong — connect suggestions back to sustainability and
  school community. They respond in short sentences and prefer visual
  examples — keep explanations brief, show examples before explaining, and
  reference concrete wins from making. Frame research as 'finding out' rather
  than 'academic research.'
</student_context>

[rest of standard DA system prompt]
```

**What doesn't get passed:** raw `passive_signals`, the entire `wellbeing` array (teacher-only pastoral layer per §4.4 — does NOT feed synthesis), `synthesis_trace`, `teacher_nudges` raw form (nudges influence `prompt_guidance` during synthesis but the raw nudge payload never reaches the AI), raw `social.peer_influences[]` with peer identities (only aggregate orientation + help-seeking pattern leak into prompt_guidance — never peer names or hashes), raw `identity.creative_voice.aesthetic_embedding` (1024-dim vector — only the `mentor_matcher` touchpoint gets this), `trajectory_snapshots[]` unless `includeTrajectory: true` is set (year-end reflection touchpoint is the primary consumer), raw `custom` section values (only synthesised contributions to pedagogy_preferences surface), any field that isn't derived into `pedagogy_preferences.prompt_guidance` or explicitly listed in the student context block. The boundary is strict.

**EAL / language scaffolding note:** The old draft of this example showed `wellbeing.language_profile.scaffolding_tier` flowing into the prompt. **That is no longer correct.** Per §4.4, any scaffolding the AI applies is derived from `current_state` (short response lengths, confusion patterns) + `passive_signals.response_patterns` — not from the wellbeing note. Teachers who need hard EAL scaffolding ride through the `teacher_nudges` mechanism on `pedagogy_preferences.scaffolding_intensity` instead.

---

*End of spec.*
