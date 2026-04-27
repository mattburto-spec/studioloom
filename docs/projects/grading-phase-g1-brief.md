# Grading Phase G1 — Phase Brief

> "Best grading experience in the world" — v1 (3-day cut).
>
> Drafted: 27 April 2026
> Updated: 27 April 2026 (design landed via Claude Design — Calibrate/Synthesize/Studio-Floor model)
> Status: **G1 PLAN SIGNED OFF + Q1 RESOLVED 27 Apr 2026.** Option B (new `student_tile_grades` table) confirmed by Matt. Tile-ID stability verified at source level (see §13.G). Worktree scaffolded at `/Users/matt/CWORK/questerra-grading` on `grading-v1`. Pre-flight complete. **Next action: mint the migration stub via `new-migration.sh grading_v1_student_tile_grades` and commit-claim. Body authoring + application to prod is the next session's first task.**
>
> Canonical design: [`docs/prototypes/grading-v2/`](../prototypes/grading-v2/) — open `Grading v2.html` in a browser. Three views, ~937 lines of JSX, framework-agnostic React + Framer Motion. **Locked-in mode model:** horizontal-first calibration → vertical synthesis. Studio Floor as power-user third tab.
> Canonical spec: [`docs/projects/grading.md`](grading.md) (412 lines, full 7-phase plan).
> Build methodology: [`docs/build-methodology.md`](../build-methodology.md).

---

## 0. Design landed (27 Apr 2026) — what this changes

Matt fed the UX prompt into Claude Design and the result is the canonical mental model for G1. Three artboards: **A · Calibrate** (horizontal, the default), **B · Synthesize** (vertical, per-student), **C · Studio Floor** (clustered, deferred to G2). Files at [`docs/prototypes/grading-v2/`](../prototypes/grading-v2/) with full README.

**Locked-in decisions (these answer questions the brief originally left open):**

1. **Mode = horizontal-first → vertical synthesis.** Days 1–2 of marking is calibration (AI pre-scores per tile, teacher confirms/overrides per-question across class). Day 3 is synthesis (per-student rubric assembled from calibrated tile scores, AI drafts feedback comments from the same evidence quotes). This sequencing replaces the abstract "marking queue + split view" framing in §2 below.
2. **The pivotal UI move = tight 8–15-word evidence quotes** pulled from the student's response. That is what makes horizontal viable — enough to trust the AI score, not so much that horizontal becomes vertical.
3. **Studio Floor (clustered bulk-score) = G2 deferred.** "Teachers who pattern-match UX will bounce off a zoomable canvas. They won't bounce off a list."
4. **The unconventional feature = past-feedback memory** in Synthesize view. Amber callout: *"You said 3 weeks ago: …"* — the system surfaces the teacher's own prior feedback to that student.

**G1 sub-tasks reframe accordingly:**
- **G1.1 was "Marking Queue" → now "Calibrate view + tile-strip queue."** The tile strip across the top IS the queue. Each tile button shows criterion, title, and confirmed/24 progress bar.
- **G1.2 was "Split-view marking" → now "Calibrate row + expandable override panel."** The row IS the split view (student avatar + AI quote + AI score + Confirm). Override expands inline with full work + 1–8 grid + override note.
- **G1.3 was "AI pre-score + draft" → now "AI pipeline: pre-score + evidence quote + per-criterion draft."** Same model, but the evidence quote is the load-bearing artifact — without it the row reads as blind authority.
- **NEW: G1.4 (~0.5d, optional) Synthesize view.** Per-student vertical with auto-assembled rubric and past-feedback callout. If the deadline is tight, ship Calibrate alone in G1 and push Synthesize to G1.5 — but the design is meaningfully weaker without Synthesize, because per-criterion rubric assembly + feedback comment writing don't happen in Calibrate.

**Visual language to match:** cream/parchment `#F5F1EA` background, paper `#FBF8F2` cards, Manrope (sans) + Instrument Serif italic accents + JetBrains Mono tabular numbers, extrabold (800) display, 0.14em-tracked caps, **dashed-border-when-unconfirmed/solid-when-confirmed score pills** (the `ScorePill` component is the most reusable atom — extract first).

See the prototype's [README](../prototypes/grading-v2/README.md) for the full implied data shape, component extraction order, and notes on what NOT to copy from the prototype's React structure.

---

## 1. Goal

Ship the three ergonomics that make grading *feel* world-class — **find work, no context switch, less typing** — in a 3-day window. AI assist is part of "less typing" via pre-scored ghost values + draft feedback comments.

A teacher with 5 classes and 3 active units can:
1. Open a single page that shows everything needing their attention, sorted by urgency.
2. Click one item → see the student's actual work and the rubric in the same screen.
3. Score in 1-2 clicks per criterion (accept AI ghost or override) and edit a pre-drafted comment instead of writing from scratch.
4. Move to the next student with one keystroke; the rubric stays put.

**Estimated effort:** 3 days (G1.1 ≈ 1d, G1.2 ≈ 1d, G1.3 ≈ 1d).
**Constraint:** Real deadline — Matt needs this usable in 3 days. Scope is non-negotiable; if a sub-task threatens the deadline, cut polish, not features.

---

## 2. What's IN scope

### G1.1 — Marking Queue (~1 day)
- New page at `/teacher/marking` aggregating work needing grading across **all** the teacher's classes.
- Per-row: student name + avatar, unit + class context, "submitted X ago" or "overdue", AI confidence badge (if pre-scored).
- Filters: class, due date, criterion, "since last session". Default sort: low AI confidence + overdue first.
- Card on the existing teacher dashboard linking to `/teacher/marking` with unread count.

### G1.2 — Split-View Marking (~1 day)
- Click "Mark" on a queue item → split-pane page.
  - **Left:** student's actual work, read-only, rendered as the student saw it (text responses, toolkit outputs, MonitoredTextarea content with integrity indicators).
  - **Right:** rubric + scoring controls. Per-criterion score selector + comment field. Persistent — does not scroll with the work.
- Prev/Next navigation across the same task scope (e.g. all unmarked students in this unit's grading queue). Keyboard shortcuts (`j`/`k` or `←`/`→`).
- Uses the existing grading data model — **no new `assessment_tasks` table in G1**. See Open Question Q1.

### G1.3 — AI Pre-Score + Feedback Draft (~1 day)
- When a teacher opens a submission, fire a Haiku 4.5 call (background or on-demand) producing:
  - Suggested per-criterion scores
  - Confidence (0-1)
  - Reasoning per criterion
  - Draft student-facing feedback comment (single string, ~80 words, references specific work)
- Store in new `student_grades.ai_pre_score` JSONB + `ai_feedback_draft TEXT` (or equivalent — depends on G1.1 schema audit).
- UI: ghost numbers in the score selectors (faded). 1-click "Accept AI" per criterion. Feedback draft pre-fills the comment textarea — teacher edits and saves.
- Per-class opt-in toggle (default OFF in G1; opt-in by Matt for his own classes).
- Cost track via existing Dimensions3 cost infrastructure. Estimated $0.002/student/criterion-set.

---

## 3. What's OUT of scope (deferred to G2+)

Hard list — Code must NOT silently expand into these:

- **`assessment_tasks` data model rewrite** (multi-task per unit). Original spec Phase 1. G1 reuses the existing single-grade-per-unit model. See Q1.
- **Lesson editor "assessable" toggle.** Original spec Phase 2.
- **Criteria coverage heatmap** on Class Hub. Original spec Phase 3.
- **AI consistency checker** ("review my marking"). Original spec Phase 4.
- **Inline anchored feedback** on student lesson pages. Original spec Phase 5.
- **Notifications + badges** when grades returned. Original spec Phase 5.
- **Growth trajectory charts** for students. Original spec Phase 5.
- **Report writing** (term/semester reports from grade data). Original spec Phase 6.
- **Cross-teacher moderation.** Original spec Phase 7.
- **Class-level insights** ("14/24 below 4 on Criterion B"). Original spec Phase 7.
- **AI "what to do next" student nudge.** Original spec Phase 5.
- **Per-rubric / per-task rubric attachment.** Pairs with Q1.

If a sub-task surfaces "this would be much cleaner with X from G2", the answer is: file as `GRADING-FU-<n>` and continue.

---

## 4. Spec sections to re-read (Code must read before any code)

| Section | Path | Why |
|---|---|---|
| Full spec | [grading.md](grading.md) (lines 1-412) | Master plan; G1 cherry-picks Phases 1+3+4 essentials |
| §"Teacher Marking Experience" | grading.md ~line 106 | Marking queue + split view requirements |
| §"AI Role in Grading" | grading.md ~line 156 | Pre-scoring pipeline, model choice (Haiku 4.5), confidence model |
| §"Key Decisions to Make" | grading.md ~line 374 | All 10 open questions — Q1, Q3, Q6, Q9, Q10 are most relevant to G1 |
| Existing grading page | [src/app/teacher/classes/\[classId\]/grading/\[unitId\]/page.tsx](../../src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx) (1,311 lines) | What "current grading" actually does; G1 sits next to / extends this |
| MYPflex helpers | [src/lib/constants.ts](../../src/lib/constants.ts) → `getGradingScale()`, `getFrameworkCriteria()` | Framework-aware scale rendering; G1 must respect this |
| MonitoredTextarea | [src/components/teacher/IntegrityReport.tsx](../../src/components/teacher/IntegrityReport.tsx) | Already wired to grading; G1 split-view must surface integrity indicators |
| Build methodology | [docs/build-methodology.md](../build-methodology.md) | Pre-flight ritual + stop triggers + Lessons re-read list |

---

## 5. Lessons re-read list

- **Lesson #34** — Test assumptions drift silently. Capture baseline `npm test` BEFORE touching code.
- **Lesson #38** — Verify = assert expected values, not just non-null. Every G1 test asserts captured-from-real-run values.
- **Lesson #39** — Silent `max_tokens` truncation in Anthropic `tool_use` calls. The G1.3 AI pre-score call MUST land with `stop_reason === 'max_tokens'` throw guard + defensive destructure.
- **Lesson #29** — UNION-pattern RLS for dual-visibility (if RLS is touched in G1.1 schema migration).
- **Lesson #22** — Junction-first-fallback for student lookup. G1.1 marking queue spans classes — query via `class_students` junction first.

---

## 6. Pre-flight ritual (mandatory — STOP and report after)

Before writing any code:

1. `git status` clean on a fresh `grading-v1` branch in a fresh worktree at `/Users/matt/CWORK/questerra-grading`.
2. `npm test` baseline captured. Record the count — it becomes the new baseline at end of G1.
3. Re-read lessons #22, #29, #34, #38, #39.
4. **Audit the existing grading data model** before designing the G1.1 migration:
   - Where do per-criterion scores actually persist today? (`student_grades` table? `class_units.content_data` JSON? `student_progress`?)
   - What's the existing primary key shape — `(student_id, unit_id, class_id)`?
   - Are there existing `submitted_at`-equivalent fields we can reuse?
   - What RLS policies cover the existing surface?
5. Read `/Users/matt/CWORK/.active-sessions.txt` to confirm no parallel session is mid-migration.
6. **STOP and report the audit findings before writing any migration or code.** This is a Matt Checkpoint gate.

The pre-flight has caught more problems than any test suite. Skipping it is the most common failure mode.

---

## 7. Migration discipline

If G1.1 needs new columns (`submitted_at`, `viewed_by_teacher`, `ai_pre_score`, `ai_feedback_draft`) or a new index for the marking queue:

- Mint with `bash scripts/migrations/new-migration.sh grading_g1_marking_queue`.
- Commit + push the empty stub to `grading-v1` IMMEDIATELY after minting. Don't write SQL body until the timestamp is reserved on origin.
- Before merging G1 to main: `bash scripts/migrations/verify-no-collision.sh` exits clean.
- Don't apply to prod Supabase until Checkpoint G1.1 signs off.
- Migration .down.sql pair (per GOV-3 standards even though GOV-3 hasn't shipped — set the precedent).

---

## 8. Stop triggers

Code stops and reports if:

- Audit finds the existing grading data model is **not** `student_grades`-shaped (e.g. lives in JSON on `class_units.content_data`). G1.1 migration shape changes radically — needs re-spec.
- Existing grading page state-management is so coupled it can't be re-used for the split view without a rewrite. G1.2 may need to ship as a parallel page rather than an extension.
- AI pre-score Haiku call returns confidence < 0.3 across the test fixture (signal that prompt or rubric injection is wrong).
- Test count drops below baseline at any sub-task gate.
- New code requires changes to MonitoredTextarea internals (out of scope).
- An obvious second bug surfaces while fixing a first one — file as FU-N and stop.

## 9. Don't stop for

- Existing ESLint warnings (FU-6 already filed).
- Cosmetic alignment of comment box widths (polish at end if time).
- Score-selector micro-animations (polish at end).
- Pre-existing TypeScript `any` in adjacent files.
- "This component would be cleaner with G2's X" thoughts — file as `GRADING-FU-<n>` and continue.

---

## 10. Sub-task → Checkpoint gates

| Sub-task | Definition of done | Gate |
|---|---|---|
| **G1.0 Pre-flight + audit** | Audit findings reported. Baseline test count captured. Existing data model documented. Migration shape pre-decided with Matt. | Matt sign-off before any code |
| **G1.1 Marking queue** | `/teacher/marking` lists pending work across all classes. Filters work. Dashboard card lands. Migration applied to local supabase. Tests for query + filter logic. | Checkpoint G1.1: smoke + report |
| **G1.2 Split-view marking** | Click queue → split pane. Prev/Next works. Save round-trips per criterion. Integrity indicator visible inline. Tests for save + nav. | Checkpoint G1.2: smoke + report |
| **G1.3 AI pre-score + draft** | Haiku call wired with `stop_reason` guard. Ghost values render. 1-click accept works. Draft pre-fills comment. Per-class toggle works. Cost tracked. Tests with mocked AI + 1 live integration test. | Checkpoint G1.3 + final G1 sign-off |

Each checkpoint = code pauses, full report, wait for explicit sign-off before next sub-task.

---

## 11. Open questions — status after design landed

**Q1. Multi-task per unit — REFINED, needs confirmation.**
The Grading v2 design sidesteps the original "one-grade-per-unit vs assessment_tasks per unit" question by going **per-tile**: each lesson tile is a gradeable item with its own AI score + confidence + evidence quote. Per-criterion rubric scores are computed at synthesis time from the tiles tagged to that criterion, NOT stored. This is more granular than the spec's `assessment_tasks` model and arguably better — assessment criteria already attach to tiles in `class_units.content_data`. **Likely answer:** add `student_tile_grades` table keyed `(student_id, page_id, tile_id)` with score, confirmed flag, AI metadata. Per-criterion rollup is a query, not a column. **Confirm during G1.0 audit** — needs to be checked against the actual current tile schema in `content_data` to see if tiles already carry stable IDs and criterion mappings, or if a tile registry is needed. Original "deferred multi-task" answer is now obsolete — the design assumes per-tile granularity from day 1.

**Q2. Per-class AI opt-in default.** *Unchanged.*
G1.3 ships with the AI off by default to avoid surprise costs. That means even your own classes won't have the AI ghost values until you flip the toggle. Default: off; you flip on for your classes during smoke. Confirm.

**Q3. Existing grading page — extend or parallel.** ✅ **CLOSED by design.**
Calibrate + Synthesize are fundamentally different UX from the current `/teacher/classes/[classId]/grading/[unitId]` page (1,311-line form). The design implies a new dedicated route — recommended landing: **`/teacher/marking`** (no params) opens Calibrate scoped to the teacher's most-recently-active lesson. Drill-down route: `/teacher/marking?lesson=<lessonId>` for direct entry. The existing grading page stays as-is for now and we redirect from it once G1 is signed off, OR keep it as the deep "bulk class grading" view if Matt prefers (low priority — Calibrate covers that workflow better). The Class Hub Grade tab continues to point at the existing page until cutover.

**Q4. Worktree + push discipline.** *Unchanged.*
Per CLAUDE.md, parallel work happens in dedicated worktrees. Recommend: `/Users/matt/CWORK/questerra-grading` worktree, branch `grading-v1`. Push to `grading-v1-wip` for backups. Don't push to `origin/main` until G1 final checkpoint signs off and migration applied to prod. Confirm.

---

## 12. After G1 ships — the path to "world-class"

The G1 cut intentionally shipswithout: multi-task per unit, criteria coverage heatmap, consistency checker, anchored inline feedback, report writing, moderation. The full vision in [grading.md](grading.md) is a ~14-18 day build. G1 is the minimum-viable "best ergonomics" + AI assist; G2 onwards is the depth that makes it actually defensible vs Toddle / ManageBac / Curipod over the long term.

After G1 sign-off, expected next-phase priorities (informed by smoke):
1. **G2 — Multi-task data model** (if Q1 returns "needed") — 2-3 days.
2. **G3 — Inline anchored feedback** (student-facing, closes the feedback loop) — 2-3 days.
3. **G4 — Class-level insights + consistency checker** (the "patterns AI sees that you can't" features) — 2 days.

Don't start G2+ planning until G1 ships. Premature scope expansion is the failure mode.

---

## 13. Pre-flight audit findings (27 Apr 2026, in worktree)

Pre-flight ritual run in `/Users/matt/CWORK/questerra-grading` on branch `grading-v1` (forked from main `b53649c`). Reporting before any migration or code write per §6.

### A. Baseline test count
**`npm test` → 2215 passed | 9 skipped (2224 total) | 141 test files | 6.00s.** This is the new baseline. Lock at end of G1; deltas reported per sub-task gate.

### B. Existing grading data model — the load-bearing finding

**The brief's working assumption was wrong.** The previous grading work doesn't write to a `student_grades` table — it writes to **`assessment_records`** (migration [`019_assessments.sql`](../../supabase/migrations/019_assessments.sql)). Schema:

```sql
CREATE TABLE assessment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,         -- AssessmentRecord blob (criterion_scores, comments, targets, tags)
  overall_grade SMALLINT,      -- denormalized, framework-agnostic (no CHECK)
  is_draft BOOLEAN NOT NULL DEFAULT true,
  assessed_at TIMESTAMPTZ DEFAULT now(),
  ...
  UNIQUE(student_id, unit_id, class_id)
);
```

**Critical implication:** existing grading is **unit-level**, ONE row per (student × unit × class). The Grading v2 design's per-tile granularity is **NOT a sidestep of the original Q1** — it's a fundamentally new data layer on top of `assessment_records`. The grading.md spec's `assessment_tasks` proposal was the architecturally correct prediction; the design's per-tile model is its concrete instantiation.

API write site: [`src/app/api/teacher/assessments/route.ts`](../../src/app/api/teacher/assessments/route.ts) (lines 50, 61, 113, 136 — `from("assessment_records")`).
Existing grading page: [`src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx`](../../src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx) (1,311 lines) — reads `student_progress` for responses + presumably `assessment_records` for grades.

Supporting infrastructure already in place:
- `src/types/assessment.ts` — canonical `CriterionScore` interface (criterion_key, level, strand_scores, comment, evidence_page_ids, tags). Already includes `evidence_page_ids` — useful for G1's per-criterion rollup pointers.
- `src/lib/criterion-scores/normalize.ts` — Phase 2 absorber for 4 historical shapes (Lesson #42, FU-K). Whatever G1 ships must round-trip through this.

### C. Data-model decision required (Q1 — recommendation)

Three viable paths:

| Option | Shape | Pro | Con |
|---|---|---|---|
| **A** Extend `assessment_records.data` JSONB | Add `tile_grades: TileGrade[]` inside the JSONB blob | Zero migration. Backward compat trivial. | Marking queue cross-class scan = JSONB scan. Won't scale past ~50-100 records. Loses the speed Calibrate is designed for. |
| **B** New `student_tile_grades` table (RECOMMENDED) | `(student_id, unit_id, page_id, tile_id, class_id)` UNIQUE + per-tile fields | Indexable + queryable. Marking queue + per-criterion rollup are real SQL queries. RLS pattern reuses `assessment_records`. | Real migration. Per-criterion rollup needs join to `class_units.content_data` for tile→criterion mapping. |
| **C** Hybrid (B + write rollups to A) | New table for live state, sync overall to `assessment_records.data.tile_grades` on release | Backward compat with student-snapshot route + existing teacher unit-grade UI. | Two writers to keep in sync. More moving parts. |

**Recommendation: Option B.** Calibrate's marking-queue performance demands an indexed table; the design's "8 tiles × 24 students = 192 micro-judgements per lesson" workload makes JSONB-scan performance unacceptable. Migration is small and well-shaped:

```sql
CREATE TABLE student_tile_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  page_id UUID NOT NULL,                                         -- references the lesson page
  tile_id TEXT NOT NULL,                                         -- string ID inside content_data
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  score SMALLINT,                                                -- 1-8 (or 0-100 for percentage frameworks)
  confirmed BOOLEAN NOT NULL DEFAULT false,                      -- teacher confirmed AI suggestion or override
  ai_pre_score SMALLINT,
  ai_quote TEXT,                                                 -- 8-15 word evidence quote
  ai_confidence TEXT CHECK (ai_confidence IN ('high','med','low')),
  ai_reasoning TEXT,
  override_note TEXT,                                            -- private teacher note

  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(student_id, unit_id, page_id, tile_id, class_id)
);
```

Per-criterion rollup at Synthesize time: `SELECT score FROM student_tile_grades WHERE (student_id,unit_id,class_id)=$1 JOIN tile→criterion mapping FROM content_data → group by criterion → AVG or best-fit`. Computed at query time, not stored. **`assessment_records.data.criterion_scores[]` continues to be the canonical "released grade" record**; G1 writes to it on Synthesize "Release to <student>" with the rolled-up criterion scores + overall comment. Backward compat preserved without dual-writer hazard.

**Open sub-question for Q1:** Does `class_units.content_data` already give tiles stable string IDs (likely from the lesson editor's nanoid pattern), or do tiles get re-IDed on each edit? **This is the #1 thing G1.0 must verify** before authoring the migration. If tile IDs are unstable, we need a tile registry or per-tile slug normalization first. Initial signal: the Phase 0.5 lesson editor doc (`docs/specs/lesson-layer-architecture.md`) and `src/types/activity-blocks.ts` line 72 show ActivityBlocks DO carry stable string IDs, but Activity Blocks (library entities) ≠ tiles in `content_data`. **Verification step before migration: read 3 real production class_units rows and inspect content_data tile IDs across an edit.**

### D. Open questions — final state before code write

- **Q1.** ⛔ **Code-write BLOCKED.** Need Matt sign-off on Option B + verification that lesson tiles have stable IDs in production `content_data`. Without this, the migration is unsafe.
- **Q2.** Per-class AI opt-in default = OFF. Matt to flip ON for his own classes during smoke. *Default applied in code unless overridden.*
- **Q3.** ✅ Closed — new dedicated `/teacher/marking` route.
- **Q4.** ✅ Closed — worktree + push discipline confirmed by sign-off action.

### E. Lessons re-read confirmation

Verified the following lessons exist in [`docs/lessons-learned.md`](../lessons-learned.md) (re-read at G1.0 start of next session):
- #22 — Junction-first-fallback for student lookup (relevant to marking queue cross-class scan)
- #29 — UNION-pattern RLS for dual-visibility (relevant if G1 needs school-admin visibility, deferred)
- #34 — Test baseline drift (just captured: 2215)
- #38 — Verify = assert exact values, not non-null
- #39 — Audit-then-fix-all for pattern bugs (relevant to the criterion_scores 4-shape absorber sites)
- #42 — Dual-shape persistence (the existing absorber pattern — G1 writes must round-trip cleanly)

### F. WHAT HAPPENS NEXT (the actual STOP)

Code-write is blocked. The right path forward:

1. ✅ **Matt confirms Option B.** Locked in 27 Apr 2026.
2. ✅ **Tile-ID stability verified at source level** (see §13.G below). Live-data verification (count of legacy tiles lacking `activityId` in prod `class_units.content_data`) deferred to next session — informs whether migration includes a backfill step.
3. **Next session opens in this worktree** (`/Users/matt/CWORK/questerra-grading`), runs `bash scripts/migrations/new-migration.sh grading_v1_student_tile_grades` to mint the empty timestamp-prefixed stub, commits to claim, then authors the migration body using the schema in §13.C. Apply to local Supabase, verify via probe, then apply to prod.
4. After migration applied to prod + verified, code writes begin with G1.1 (Calibrate view) — first extracted component is `ScorePill`.

### G. Tile-ID stability verification (source-level — completed this session)

**Result: GREEN with one open data-question.**

- **`ActivitySection.activityId`** ([src/types/index.ts:368](../../src/types/index.ts)) is documented as: *"Stable activity ID from v4 timeline — used for response keys that survive rebalancing."* That's exactly G1's requirement.
- **Lesson editor preserves activityId on save round-trip.** [src/components/teacher/lesson-editor/LessonEditor.tsx:275](../../src/components/teacher/lesson-editor/LessonEditor.tsx) — `handleAddActivity` does `activityId: activity.activityId || nanoid(8)` (preserves existing). [Line 297](../../src/components/teacher/lesson-editor/LessonEditor.tsx) — `handleDuplicateActivity` mints a fresh nanoid (correct: a duplicate is a new tile). Reorder ([line 285](../../src/components/teacher/lesson-editor/LessonEditor.tsx)) just spreads sections — preserves activityId.
- **Production canonical response key format** ([src/app/(student)/unit/[unitId]/[pageId]/page.tsx:277](../../src/app/(student)/unit/[unitId]/[pageId]/page.tsx)):
  ```js
  const responseKey = section.activityId
    ? `activity_${section.activityId}`
    : `section_${i}`;
  ```
  This same key drives `responses` map, `integrityMetadataRef`, engagement tracking (`registerActivity`, `recordInteraction`), and React `key` prop. **G1's `student_tile_grades.tile_id` should use the SAME format** — that way join paths line up: `student_tile_grades.tile_id ↔ student_progress.responses[<that key>]`. No translation layer.
- **Legacy fallback** (`section_${idx}`) exists in two read-only views: [src/components/student/ExportPagePdf.tsx:49](../../src/components/student/ExportPagePdf.tsx) and [src/components/portfolio/NarrativeView.tsx:104](../../src/components/portfolio/NarrativeView.tsx). These don't write — they read whatever shape exists. So legacy tiles persist with positional keys; new tiles persist with activityId keys. Both shapes coexist in prod today.
- **`ActivitySection.criterionTags?: string[]`** ([src/types/index.ts:375](../../src/types/index.ts)) already carries criterion mapping per tile. Comment: *"Assessment criteria this activity addresses — e.g. ['A','B'] or ['AO1','AO3']. Framework-agnostic."* This means **per-criterion rollup at Synthesize time = JOIN against `class_units.content_data` reading `criterionTags` per tile**. Zero new metadata required.

**Live-data probe (run 27 Apr 2026 against prod via [`scripts/grading/probe-tile-id-coverage.ts`](../../scripts/grading/probe-tile-id-coverage.ts)):**

```
Total tiles:              635 (across 11 units)
With stable ID:           571 (89.9%)
Legacy (no stable ID):    64  (10.1%)

By content version: v2 = 1 unit, v3 = 2 units, v4 = 7 units, v? = 1 unit
By tile shape:      pages-with-content-sections = 3 units, timeline-flat = 7 units, other = 1 unit

Criterion-tag coverage: 163 tiles tagged (25.7%) — see §13.H below
```

**Stable-ID conclusion:** V4 `TimelineActivity.id` and V2/V3 `ActivitySection.activityId` are equivalent nanoid(8) strings — both flow through to the rendered `responseKey` via the converter at [`src/lib/timeline.ts:142`](../../src/lib/timeline.ts) (`activityId: a.id`). Counting both: 89.9% of prod tiles already carry stable IDs. **Backfill is required** for the 10.1% legacy (64 tiles across the 4 v2/v3/v? units), but the volume is small enough that the migration body handles it inline.

### H. Second probe finding — criterion-tag coverage + framework-neutral schema (NEW design constraint)

**74.3% of prod tiles have NO `criterionTags` field.** The design's per-criterion rollup only works for ~26% of existing tiles via JOIN. The other 74.3% need a different criterion source.

Two candidate sources to fall back to:
1. **`UnitPage.criterion: CriterionKey`** — V2/V3 only. Pages are tagged per criterion. Every tile on the page inherits.
2. **Teacher-assigned at marking time** — Calibrate's row already shows criterion in the question header. Teacher pins during the first scoring pass.

**Schema implication: denormalize criterion identifiers onto `student_tile_grades`.** Don't re-resolve from `content_data` at every read.

#### Framework-neutral key choice (Path A — locked in 27 Apr 2026)

The values stored MUST be **neutral keys**, not framework-specific labels. Otherwise this same migration would need to re-run when an NSW or GCSE teacher onboards. StudioLoom already has the architecture:

- **8 universal neutral keys** ([docs/specs/neutral-criterion-taxonomy.md](../specs/neutral-criterion-taxonomy.md)): `researching`, `analysing`, `designing`, `creating`, `evaluating`, `reflecting`, `communicating`, `planning`.
- **`FrameworkAdapter`** ([src/lib/frameworks/adapter.ts](../../src/lib/frameworks/adapter.ts)) — `fromLabel(label, framework)` maps framework code (e.g. `"A"`, `"AO2"`, `"DT5-2"`) → neutral keys; `toLabel(neutralKey, framework, opts)` maps the other direction for render.

**Critical nuance from the API:** `fromLabel()` returns `readonly NeutralCriterionKey[]` — **plural**. MYP "Criterion A" maps to BOTH `researching` AND `analysing` (the criterion is a unified whole — best-fit semantics). So the column must be an **array**, not a scalar. A single tile graded at 6 on a "Criterion A" task contributes 6 to BOTH neutral keys.

#### Updated migration body shape (REVISED §13.C — superseded)

```sql
CREATE TABLE student_tile_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  page_id UUID NOT NULL,
  tile_id TEXT NOT NULL,                                 -- "activity_<nanoid>" or "section_<idx>"
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  score SMALLINT,                                        -- framework-neutral; rendered scale per class.framework
  confirmed BOOLEAN NOT NULL DEFAULT false,
  ai_pre_score SMALLINT,
  ai_quote TEXT,
  ai_confidence TEXT CHECK (ai_confidence IN ('high','med','low')),
  ai_reasoning TEXT,
  override_note TEXT,

  -- Framework-neutral criterion identifiers. ALWAYS neutral keys from the
  -- 8-key taxonomy (researching/analysing/designing/creating/evaluating/
  -- reflecting/communicating/planning). Render via FrameworkAdapter.toLabel().
  criterion_keys TEXT[] NOT NULL DEFAULT '{}',

  graded_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,                               -- when "Release to <student>" rolled this up to assessment_records
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(student_id, unit_id, page_id, tile_id, class_id)
);

-- GIN index on the array — supports `WHERE 'designing' = ANY(criterion_keys)`
CREATE INDEX idx_student_tile_grades_crit_keys
  ON student_tile_grades USING GIN(criterion_keys);

-- Standard indexes
CREATE INDEX idx_student_tile_grades_class_unit ON student_tile_grades(class_id, unit_id);
CREATE INDEX idx_student_tile_grades_teacher ON student_tile_grades(teacher_id);
CREATE INDEX idx_student_tile_grades_unconfirmed ON student_tile_grades(class_id, confirmed) WHERE NOT confirmed;
```

#### Write-time normalization path

When a teacher confirms a score in Calibrate, the writer (next session's task — likely `src/lib/grading/save-tile-grade.ts`) does:

1. Resolve raw criterion source: `tile.criterionTags[0]` → fallback `page.criterion` → fallback teacher's pinned value.
2. If raw is a framework code, normalize: `FrameworkAdapter.fromLabel(rawLabel, class.framework)` → `NeutralCriterionKey[]`.
3. If raw is already neutral (rare today, common in newer Dimensions3-generated content), pass through.
4. Persist `criterion_keys` as the array result.

Per-criterion rollup at Synthesize time:
```sql
SELECT k AS neutral_key, AVG(score) AS avg_score
FROM student_tile_grades, UNNEST(criterion_keys) AS k
WHERE class_id = $1 AND unit_id = $2 AND student_id = $3
GROUP BY k;
```

#### Dual-shape with `assessment_records` (Lesson #42 territory)

`assessment_records.data.criterion_scores[]` (the canonical "released grade" record) currently stores **framework-specific** values (`"A"`, `"AO2"`). When Synthesize "Release to <student>" rolls up neutral scores into assessment_records, the rollup writer maps neutral → framework via `FrameworkAdapter.toLabel(neutralKey, class.framework, { format: "short" })`. Existing assessment_records data stays as-is. **`src/lib/criterion-scores/normalize.ts` gains a 5th shape**: when reading a `student_tile_grades` row, the criterion identifier is neutral; when reading `assessment_records.data.criterion_scores[]`, it's framework-specific. The absorber documents the boundary.

**Acceptance:** the design's per-tile model is implementable on existing prod tiles with (a) inline backfill for 10% legacy stable IDs, (b) `criterion_keys TEXT[]` denormalization handling 74% missing tile-level tags via fallback chain, and (c) framework-neutral storage future-proofing for NSW/GCSE/A-Level/IGCSE/ACARA/PLTW/NESA/Victorian. Authoring + application is next session's first task.

---

## Pickup snippet (for the next session that builds G1)

```
Read /Users/matt/CWORK/questerra-grading/docs/projects/grading-phase-g1-brief.md
§13 (audit findings). G1 plan signed off 27 Apr 2026. Code-write blocked
on Q1 (data-model decision — recommendation: Option B, new student_tile_grades
table). Worktree: /Users/matt/CWORK/questerra-grading on grading-v1, baseline
2215 tests passing. Do NOT write code until Q1 confirmed AND tile-ID stability
verified in prod content_data.
```
