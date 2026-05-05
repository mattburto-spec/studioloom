# TG.0A Pre-flight Report

**Date:** 5 May 2026
**Worktree:** `/Users/matt/CWORK/questerra-tasks` on branch `task-system-build` (off `origin/main` @ `5bfb14f`)
**Baseline tests:** 3735 passed / 11 skipped (tsc strict clean)
**Pre-flight goal:** validate the brief against actual prod code paths before TG.0B (schema migration) starts. Catch any schema gaps, audit downstream consumers, sketch Lever 0 dependencies. **Stop and report findings before writing migration SQL.**

---

## TL;DR

Three findings. One is a brief amendment, two are clean.

| | Finding | Action |
|---|---|---|
| **F1 — assessment_records missed** | The brief's Layer 1 schema doesn't account for `assessment_records` (a real prod table holding the *published* grade rollup — what students/parents see, data-subject exports include, G1 past-feedback memory feeds from). 8 consumers depend on it. | **Amend the brief** to include `assessment_records` schema additions in TG.0B (add `task_id NOT NULL FK` and `submission_id` reference). Already drafted below — small delta. |
| **F2 — BlockCategory consumers clean** | Only 3 files import or iterate over `BlockCategory`. Adding a new category in TG.0C (Tasks panel) won't ripple. | Proceed as planned. Lever-MM precedent holds. |
| **F3 — Lever 0 schema deps fit cleanly** | Lever 0's CBCI / Structure-of-Process / Paul-Elder output mostly lives ABOVE `assessment_tasks` (on `units` / new `unit_plans`). The Assessment section emits 1-4 `assessment_tasks` rows per unit. Optional CBCI generalization + PE element-standard tagging on tasks goes in `assessment_tasks.config: JSONB` — no schema change needed. | Proceed as planned. Schema is ready for Lever 0. |

**Recommendation: proceed to TG.0B with a small brief amendment for F1.** No structural changes required. ~30-min amendment, then TG.0B can start.

---

## F1 — `assessment_records` table missed by brief

### What I found

Grep audit of grade-writers turned up `assessment_records` — a table the brief's Layer 1 schema doesn't mention. Schema-registry confirms it's real:

```yaml
- name: assessment_records
  source_migration: 019_assessments.sql
  status: applied
  columns:
    id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
    student_id: UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE
    unit_id: UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE
    class_id: UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE
    teacher_id: UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
    data: JSONB NOT NULL
    overall_grade: SMALLINT
    is_draft: BOOLEAN NOT NULL DEFAULT true
    assessed_at: TIMESTAMPTZ DEFAULT now()
    unit_version_id: UUID NULL REFERENCES unit_versions(id) ON DELETE SET NULL
```

Doc comment from `src/app/api/teacher/grading/release/route.ts`:

> Releases a student's per-tile grades into the canonical `assessment_records` row for (student_id, unit_id, class_id). Steps: (1) Read all confirmed tile grades. (2) Compute per-criterion rollup. (3) Map neutral keys → framework-specific labels via FrameworkAdapter. (4) Upsert `assessment_records.data.criterion_scores[]` with the labelled rows. Set `is_draft=false` so the student/parent can see it. (5) Snapshot released_at + released_score + released_criterion_keys onto each tile grade row that fed the rollup.

### Consumers (writers + readers)

```
WRITERS (4):
  src/app/api/teacher/assessments/route.ts                — legacy single-grade page POSTs here
  src/app/api/teacher/grading/release/route.ts            — G1 release flow upserts here
  src/lib/integrity/remove-student-data.ts                — privacy delete
  src/lib/access-v2/data-subject/export-student.ts        — data-subject exports

READERS (4):
  src/app/api/student/grades/route.ts                     — student grades view
  src/app/api/teacher/grading/past-feedback/route.ts      — G1 past-feedback memory
  src/lib/grading/rollup.ts                               — rollup computation
  src/types/assessment.ts                                 — type definitions
```

### Why this matters

`assessment_records` is the **published-grade lifecycle endpoint**. The relationship is:

- `student_tile_grades` — per-tile calibration data (working state)
- `submissions` (new in brief) — student evidence + lifecycle (draft → submitted → graded → returned)
- `grade_entries` (new in brief) — per-criterion grades against a submission (working state for synthesis)
- **`assessment_records`** — the released, published, parent-visible snapshot

Without `assessment_records`, the brief's schema can't represent the "released grade" state that students and parents actually see. Per OQ-2 (no backfill — delete legacy), the existing `assessment_records` rows are dummy data and get deleted in TG.0K. But the table itself stays as the published-result endpoint.

### Brief amendment proposed

Add `task_id` column to `assessment_records` (NOT NULL because legacy data is deleted in TG.0K, then all new rows have a task association):

```sql
ALTER TABLE assessment_records
  ADD COLUMN task_id UUID REFERENCES assessment_tasks(id) ON DELETE CASCADE;

-- After TG.0K delete dummy data:
ALTER TABLE assessment_records
  ALTER COLUMN task_id SET NOT NULL;

CREATE INDEX idx_assessment_records_task ON assessment_records(task_id);
```

Optional second column (deferred — defer to v1.1 unless needed): `submission_id UUID REFERENCES submissions(id)` — would let `assessment_records` point at the specific submission version that was released. For v1, the rollup data is already embedded in `data.criterion_scores[]` so this isn't strictly needed yet.

### Ripple effects

The flow becomes:

1. Teacher grades tiles → `student_tile_grades` (with `task_id`)
2. Teacher synthesizes per-student → `grade_entries` on the student's `submissions` row
3. Teacher releases → upsert `assessment_records` with `task_id` + rollup data; set `is_draft=false`
4. Student views grades → reads `assessment_records` rows where `is_draft=false` (existing flow; just task-scoped)
5. Past-feedback memory (G1 Synthesize view) → reads from `assessment_records.data.overall_comment` for prior tasks the teacher graded for this student

**No new readers/writers required.** Existing consumers continue working — they just see task-scoped rows instead of unit-scoped rows.

### Estimate impact

Adding the column + index + an `ALTER … SET NOT NULL` step in TG.0K = ~15 min of additional migration work. **No estimate change.**

---

## F2 — BlockCategory audit (Lesson #54: never trust WIRING summaries)

### What I checked

```bash
grep -rln "BlockCategory\b" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
grep -rn "BlockCategory\[" src/ --include="*.ts" --include="*.tsx"
```

### Findings

```
3 files reference BlockCategory:
  src/components/teacher/lesson-editor/index.ts        (re-export)
  src/components/teacher/lesson-editor/BlockPalette.tsx (definition + use)
  src/components/teacher/lesson-editor/BlockPalette.types.ts (definition)

1 site iterates over the union:
  BlockPalette.tsx:616  const activeCategories = (Object.keys(CATEGORIES) as BlockCategory[])...
```

### Conclusion

Adding a new category for tasks (TG.0C plans a Tasks panel SIDEBAR not a block palette CATEGORY — slightly different surface, but the precedent matters) won't ripple. Lever-MM's precedent holds: when we added `"new_metrics"` as a category, only those 3 files needed updating. Same boundaries for any future category extension.

**Note on TG.0C placement:** the brief calls for a "Tasks panel sidebar" *above* the lesson list, NOT a category in the existing block palette. So this audit is informational only — TG.0C doesn't actually add a new BlockCategory. Confirmed via brief re-read.

---

## F3 — Lever 0 schema-dependency sketch (OQ-6 deliverable)

### Lever 0 output structure

Per Matt's standalone planner at `studioloom.org/unitplanner` (the spec Lever 0 ports), the output of unit creation has eight sections:

1. **Basics** — title · year/grade · duration · subject/strand · premise (2-4 sentence narrative)
2. **Big Ideas (CBCI)** — conceptual lens · 4-strand concept web · 3 generalizations (Lev1→Lev3) · guiding questions (factual/conceptual/debatable) · essential content
3. **Design Work (Structure of Process)** — processes · strategies (concept-tagged) · skills · concepts→strategies map · process generalizations
4. **Thinking Moves (Paul-Elder)** — 3-4 elements · 4-5 standards · 2-3 virtues · element×standard matrix
5. **Lesson Plan** — 6-8 Learning Experience cards, each tagged with CBCI/SoP/PE
6. **MYP Wrapper** — key concept · related concepts · global context · statement of inquiry · ATL skills
7. **Assessment** — per-criterion (A-D) evidence/task with framework tags
8. **Reflection** — 6 stress-test prompts (pre + post)

### Where each section lives

```
SECTION                          → SCHEMA HOME
─────────────────────────────────────────────────────────────────────
Basics                           → units (existing columns: title, grade_level, duration_weeks, ...)
Big Ideas / CBCI                 → units.unit_planning_state JSONB (NEW — Lever 0 phase, not TG)
Design Work / SoP                → units.unit_planning_state JSONB
Thinking Moves / Paul-Elder      → units.unit_planning_state JSONB
MYP Wrapper                      → units (existing: global_context, key_concept) + units.unit_planning_state
Reflection                       → units.unit_planning_state JSONB
Lesson Plan (6-8 cards)          → units.content_data.pages[] (existing)
   each card's CBCI/SoP/PE tags  → page.config or new page-level JSONB field
Assessment (1-4 tasks per unit)  → assessment_tasks (THIS BRIEF) — emits 1 row per criterion-section grouping
   GRASPS, rubric, criteria      → assessment_tasks.config JSONB
   linked Learning Experiences   → task_lesson_links join table (THIS BRIEF)
```

### Implications for `assessment_tasks` schema

| Lever 0 Assessment-section field | Where it lives in `assessment_tasks` |
|---|---|
| Criterion (A/B/C/D) | `task_criterion_weights` (one row per criterion the task assesses) |
| Evidence/task description | `assessment_tasks.config.grasps` (Goal/Role/Audience/Situation/Performance/Standards) |
| Framework tags | `task_criterion_weights.criterion_key` + framework adapter at render time |
| **CBCI generalization being assessed** (e.g., "this task tests Generalization 3 from the unit") | `assessment_tasks.config.cbci_generalization_id` ← OPTIONAL field in JSONB; Lever 0 sets it at creation, future grading UI can surface it |
| **Paul-Elder element × standard tag** (e.g., "this task assesses the Information × Depth checkpoint") | `assessment_tasks.config.paul_elder_intersection` ← OPTIONAL field in JSONB |
| **Linked Learning Experience cards** | `task_lesson_links` rows pointing to specific `page_id` values |

### Conclusion: schema is READY for Lever 0

**No new columns required on `assessment_tasks`.** The brief's `config: JSONB` extensibility point handles the optional CBCI generalization + PE intersection tagging. Lever 0's output writes those into the JSONB at creation time; v1 grading UI doesn't need to surface them but they're queryable from prod.

**One small recommendation for the brief:** add a § note that `assessment_tasks.config` is the canonical extension point for cross-framework (CBCI, Paul-Elder, Toulmin, etc.) tagging surfaced by Lever 0. Documents intent so the next dev doesn't try to add columns.

### What lives ABOVE `assessment_tasks` (Lever 0's own work)

- `units.unit_planning_state` (NEW JSONB on existing units table) — holds CBCI lens, generalizations, SoP processes/strategies/skills, PE elements/standards/virtues, MYP wrapper, reflection
- New page-level JSONB field (or `page.config`) — holds the per-lesson CBCI/SoP/PE tags for the Learning Experience cards

These are Lever 0's responsibility, NOT TG.0B. The brief's schema doesn't need to anticipate them.

---

## Other items checked (no findings to report)

### Report query SQL sketch (Cowork's call)

The brief's `§ Pre-flight ritual` step 7 sketched a "MYP report for student X" query. Re-validated against the schema with `assessment_records` added:

```sql
-- MYP report for student X across this term — RECOMMENDED revised version
-- (uses assessment_records as the source of published data)
SELECT
  ge.criterion_key,
  AVG(ge.numeric_score)::numeric(4,2) AS avg_score,
  COUNT(DISTINCT ar.id) AS released_assessments,
  ARRAY_AGG(t.title ORDER BY ar.assessed_at) AS task_titles
FROM assessment_records ar
JOIN assessment_tasks t ON t.id = ar.task_id
JOIN grade_entries ge ON ge.submission_id IN (
  SELECT id FROM submissions
  WHERE source_kind = 'task'
    AND source_id = t.id
    AND student_id = ar.student_id
)
WHERE ar.student_id = $1
  AND ar.school_id = $2
  AND ar.is_draft = false
  AND t.task_type = 'summative'
  AND ar.assessed_at >= $3   -- term start
  AND ar.assessed_at <  $4   -- term end
  AND ge.is_published = true
GROUP BY ge.criterion_key
ORDER BY ge.criterion_key;
```

Joins are clean. Indexes cover all filter columns:
- `idx_assessment_records_student_unit` (student_id)
- `idx_assessment_records_task` (task_id, NEW from F1 amendment)
- `idx_grade_entries_submission` (submission_id)
- `idx_submissions_source` (source_kind, source_id)

**Schema passes the report-query test.** Single query, no UNION, no subquery explosion.

### Lessons #67-#71 re-read

| Lesson | Application to TG.0B |
|---|---|
| **#67** Tool-schema vs validator pattern bug | N/A this phase — no AI tool schemas changing |
| **#68** Repo migrations ≠ applied prod schema | **CRITICAL** — TG.0B applies new tables; verify `information_schema.columns` after migration applies. Probe-before-INSERT pattern for any seed data |
| **#69** `SET LOCAL session_replication_role = 'replica'` for fixture seeds | Applies if TG.0I writes a smoke-fixture seed (Lever-MM precedent). Use this if any tasks-grading triggers exist on the new tables |
| **#70** Push feature branch → Vercel preview when smoke surface IS deployed UI | Applies to TG.0C-G smoke (5-tab modal, Tasks panel render, student submission page). Use Vercel preview pattern |
| **#71** Pure logic in `.tsx` files isn't testable | Applies to ANY pure helper inside the new task UI components. Extract to `.ts` siblings before writing tests. Lever-MM's `lib/nm/checkpoint-ops.ts` precedent |

### Existing grade-writer audit (continued)

Beyond the legacy single-grade page (TG.0K target — delete) and G1 code (rolls forward — TG.0G), three other grade-touching files surfaced:

```
src/app/(student)/unit/[unitId]/grades/page.tsx          → student grades VIEW (reader; reads from /api/student/grades)
src/app/api/student/grades/route.ts                      → reads assessment_records (where is_draft=false)
src/types/assessment.ts                                   → type definitions for assessment_records.data shape
src/lib/criterion-scores/normalize.ts                    → score normalisation helper (framework-agnostic)
```

These all KEEP their existing behavior. They read `assessment_records`; that table stays. The student grades view will see task-scoped rows after TG.0B+TG.0G ship, but its rendering logic doesn't care whether the rollup came from "the unit's single summative" or "task X" — same JSONB shape.

---

## Recommendation

**Proceed to TG.0B with a small brief amendment.**

Steps:
1. Amend `docs/projects/task-system-architecture.md` to add `assessment_records.task_id` to TG.0B's schema additions (~30 min)
2. Amend the data-model section to document `assessment_records` as the published-grade endpoint
3. Amend `assessment_tasks.config` doc to note it's the canonical extension point for cross-framework tagging (Lever 0's CBCI/PE)
4. Commit + push the amendment
5. **Then** start TG.0B — schema migration

Alternative: skip the amendment and discover the gap during TG.0B implementation when the release route refactor doesn't compile against new schema. **Don't recommend** — Lesson #54 says catch the drift up front, not in flight.

### Estimate impact

- F1 amendment: ~30 min (brief edits + commit)
- TG.0B schema additions: +15 min for `ALTER TABLE assessment_records` migration step
- **No phase-level estimate change.** TG.0B remains ~1 day. Total brief estimate stays ~15.5 days.

---

## What I am NOT doing (per build methodology)

- Writing migration SQL (TG.0B work)
- Modifying any application code
- Touching the schema-registry beyond the audit read
- Setting up CI workflows (worktree-only)
- Pushing without a PR

Stop here. Wait for review of this report + the brief amendment. Then start TG.0B.
