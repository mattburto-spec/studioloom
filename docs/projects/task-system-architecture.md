# Task System Architecture

**Status:** ✅ BRIEF SIGNED OFF 5 May 2026 + TG.0A pre-flight COMPLETE. Two findings landed as brief amendments (`assessment_records` schema addition; `assessment_tasks.config` cross-framework extension docs). Ready for TG.0B (schema migration). Pre-flight report: [`task-system-tg0a-preflight.md`](task-system-tg0a-preflight.md).
**Worktree:** `/Users/matt/CWORK/questerra` (or split into `/Users/matt/CWORK/questerra-tasks` if parallel-session collision becomes likely)
**Branch:** `task-system-architecture` (off `main` @ today's tip)
**Baseline tests:** 3700 passed / 11 skipped (post-Lever-MM + Tasks v1 prototype merge)
**Deadline:** None hard — replaces the half-shipped G1 grading work and unblocks Lever 0 (manual unit designer) when its build starts.
**Supersedes:**
- [`docs/projects/grading-phase-g1-brief.md`](grading-phase-g1-brief.md) — G1 was a 3-day cut that explicitly sidestepped the assessment_tasks question. This brief picks it back up.
- The would-be `summative-tasks.md` brief I almost wrote on 4 May (correctly absorbed into this larger architecture).

---

## What this is

The unified architecture for **gradeable events in StudioLoom**. Replaces the current single-grade-per-unit model with a **task-based primitive** that handles formative checks, summative projects, peer review, and self-assessment under one schema with type-aware UX surfaces. Schema-locks the foundation that **Lever 0 (manual unit designer)**, **G1 grading UI** (rolling forward), **ManageBac export**, and the **future inquiry-mode** all consume.

The brief locks the architecture *before* implementation. Once locked, structured-classes tasks-grading and Lever 0 can build in parallel, both writing to the same schema.

---

## TL;DR

- **Data model:** UNIFIED `assessment_tasks` table with `task_type` discriminator. Confirmed by Cowork + Gemini independent reviews + ManageBac/Canvas/Schoology industry pattern.
- **Teacher UI:** SPLIT surfaces — inline-row formative quick-check OR 5-tab summative project config. Per Tasks v1 prototype verdict ([`docs/prototypes/tasks-v1/`](../prototypes/tasks-v1/)).
- **Student UI:** focused submission page with self-assessment-before-submit gate (Hattie d=1.33).
- **G1 code:** roll forward — keep Calibrate/Synthesize UX, parent tiles to tasks via `task_id NOT NULL` FK on `student_tile_grades`. The half-shipped state closes cleanly when this lands.
- **ManageBac:** export-as-file, NOT API integration. Same pattern serves Schoology, Canvas, Google Classroom, future LMS changes.
- **NM checkpoints:** stay parallel — NOT a `task_type` of `assessment_tasks`. Different competency-tracking concept.
- **Inquiry mode (PYP, PP, Service):** sister project, future brief. Shared infrastructure via polymorphic `submissions`. Three-layer architecture explicit.
- **Build estimate:** ~16 days end-to-end (~14 days tasks-grading + 2 days export adapters). Schema lock = ~1 day. After schema, Lever 0 + tasks-grading build in parallel.

---

## Scope

### IN scope (this brief)

- Data schema for `assessment_tasks`, `task_submissions`, `task_lesson_links`, `task_criterion_weights`, plus reshaped `student_tile_grades`
- Teacher create-task UX (inline-row formative + 5-tab summative)
- Tasks panel sidebar in the lesson editor (above lesson list)
- Student-facing summative submission page with self-assessment gate
- Persistent "Builds toward..." chip on lesson cards (same pattern as Lever-MM NM chip)
- Backfill of existing single-grade-per-unit data into 1 task-per-unit summative records
- ManageBac export adapters (teacher task brief + student portfolio)
- Roll-forward integration with G1 Calibrate/Synthesize UI — `student_tile_grades.task_id` FK + scoping
- Migration of legacy `/teacher/classes/[classId]/grading/[unitId]` page → redirect to new task-scoped marking surface

### OUT of scope (sister projects + future FUs)

| | Project / FU | Reason |
|---|---|---|
| Inquiry mode (PYP, PP, Service Learning, capstones) | Sister brief — `docs/projects/inquiry-mode-architecture.md` (placeholder) | Different concrete primitive (`inquiry_projects` not `assessment_tasks`); needs PM overlay layer; different teacher-as-supervisor relationship |
| Layer 2 shared PM tools (evidence log, milestone tracker, time log, goal widget, health score, journal) | `docs/projects/pm-tools-layer.md` (placeholder) | Cross-mode shared layer. Not blocking structured tasks-grading; built incrementally based on teacher demand |
| Manual unit designer (Lever 0) | `docs/projects/manual-unit-designer.md` (placeholder, brief pending) | Sister project. Consumes this brief's locked schema. Builds in parallel after schema lock. |
| Peer review tasks (`task_type='peer'`) | FU — extends data model later | Discriminator handles the type but peer-review needs evaluator pairings table; deferred to v2 |
| Self-assessment as standalone tasks (`task_type='self'`) | FU — extends data model later | Self-assessment is currently embedded INTO summative submission flow (the gate); standalone self-assessment tasks are v2 |
| Group submissions | FU — `submissions` schema can extend | One student per submission for v1; `submissions.group_id` added later |
| Multi-stage milestones within a single task | FU | Single due-date per task in v1; multi-milestone is more naturally an inquiry-mode concept |
| Plagiarism / AI detection | Out of scope, separate compliance project | |
| Drag-and-drop section-to-task linking | FU `FU-TG-DND-LINKING` (P3) | Click-to-link sufficient for v1 |
| Multi-task cross-unit (one task → N units) | Schema supports it via nullable `unit_id` + `task_units` join | UI deferred to inquiry mode (where it matters more) |
| `assessment_tasks` API integration with ManageBac | Decided file-as-artifact pattern instead | OAuth + per-school setup + ongoing maintenance vs. manual upload — cost/benefit favors files |

---

## Three-layer architecture

This is the canonical mental model. The brief commits to it, even though only Layer 1 + structured Layer 3 ship in this phase.

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 3 — MODE-SPECIFIC CONCRETE                                    │
│                                                                      │
│ STRUCTURED (THIS BRIEF):                                            │
│   assessment_tasks · task_submissions · task_lesson_links ·         │
│   task_criterion_weights · Calibrate/Synthesize grading UI ·        │
│   Tasks panel sidebar · 5-tab summative config · inline formative   │
│                                                                      │
│ INQUIRY (SISTER BRIEF, FUTURE):                                     │
│   inquiry_projects · inquiry_milestones · inquiry_evidence_log ·    │
│   supervisor_checkins · IPARD scaffolding · health score model ·    │
│   project canvas / journey map UX                                   │
└─────────────────────────────────────────────────────────────────────┘
                                ▲
                                │ both consume Layer 2
                                │
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 2 — SHARED PM TOOLS  (cross-mode, dashboard-resident)         │
│                              (placeholder; built incrementally)     │
│                                                                      │
│   evidence_log         (chronological capture of student work)      │
│   milestone_tracker    (mode-agnostic "what's next")                │
│   time_log             (optional opt-in time-on-task)               │
│   goal_widget          (student-set intention; teacher-visible)     │
│   health_score         (composite signal: pace, capture, concern)   │
│   notes_journal        (running journal — student/teacher dual-view)│
│                                                                      │
│ Lessons reference these via a "Project Tools" block category        │
│ (same pattern as Lever-MM "New Metrics" block category, gold dot).  │
└─────────────────────────────────────────────────────────────────────┘
                                ▲
                                │ both consume Layer 1
                                │
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 1 — SHARED INFRASTRUCTURE  (designed-for-both from day one)   │
│                                                                      │
│   rubric_descriptors        (criterion + achievement-level descriptors)│
│   submissions               (POLYMORPHIC: source_kind = task |       │
│                              milestone | project)                    │
│   grade_entries             (criterion-scored against a submission)  │
│   self_assessment_responses (Hattie d=1.33; locked-on for summative) │
│   manage_bac_export         (file-as-portable-artifact; any LMS)    │
│   teacher_feedback          (existing; works against any submission) │
└─────────────────────────────────────────────────────────────────────┘
```

The polymorphic `submissions` table is the load-bearing piece. It's designed in this brief but used only by structured-mode (`source_kind='task'`) initially. Inquiry-mode adds `source_kind='milestone'` later without schema migration.

**Adding the polymorphism now costs nothing. Retrofitting it later is painful.**

---

## Verdict — Tasks v1 prototype design probe

The full prototype lives at [`docs/prototypes/tasks-v1/`](../prototypes/tasks-v1/). Three artboards explored unified-vs-split surfaces. Verdict locked: **split surfaces, unified data**.

### Key quotes from `artboard3.jsx` (the decision panel)

> "The data model staying unified is fine — it's an implementation detail. But the teacher's *create* surface should follow the shape of the work, not the shape of the table. A formative check and a summative project are different jobs done by the same person at different cognitive budgets, and the UI should respect that asymmetry."

> "Underneath, both still write to `assessment_tasks`. The discriminator earns its keep at query time, not at create time."

### The three friction moments

The decision panel argues from named teacher moments. Quoting verbatim:

**Friction 01 — *Tuesday, 11:42am · Ms. Okafor, between Y9 periods 3 and 4***

> "Wants to add an exit ticket on Newton's 2nd Law before Period 4 walks in. Opens the unified surface, sees the type toggle pre-set to summative because that was her last task. Switches it. Watches GRASPS, Rubric, Self-assessment collapse into 'not used for formative' rows. Wonders if she's missing something. Scrolls. Loses 90 seconds of a 5-minute window deciding whether to trust the collapsed state."

**Friction 02 — *Sunday, 8:15pm · Mr. Patel, planning a 6-week unit***

> "Designing the roller-coaster brief that anchors the whole unit. Backward design wants him to define summative first and design lessons backwards. The unified surface starts at title and lets him save with the rubric blank — because formative tasks save with it blank. He drafts the unit, returns Wednesday, finds three lessons already written and a rubric still empty. The shape of the form didn't push him."

**Friction 03 — *Wednesday, 9:03am · A first-year MYP teacher***

> "Knows GRASPS exists in theory, has never written one. On the unified surface, GRASPS is one accordion among many, framed as 'type-specific, optional below.' She skips it. On the split surface, GRASPS is tab 1 of 5 — the first thing the project flow asks her to do. **The UI taught her the practice.**"

The third one is the load-bearing argument: split UI isn't just easier, it's *pedagogically active*.

---

## Independent review summary (Cowork + Gemini, 4 May 2026)

Both reviewers independently confirmed Option A (unified data primitive) with industry-pattern evidence (Canvas, Schoology, ManageBac, Toddle all use unified-with-discriminator). Cowork pushed back hard on spec details — corrections applied below.

### Cowork's spec corrections (all applied to this brief's data model)

| # | Issue Cowork flagged | How this brief addresses it |
|---|---|---|
| 1 | `status` conflated task-state with submission-state | Separate `task_submissions` table with its own status enum; task's status is "is teacher done designing this?" |
| 2 | `page_ids[]` array on tasks was backwards | Replaced with `task_lesson_links(task_id, page_id, lesson_id)` join table — queryable from either side |
| 3 | `weight: 0-100` on tasks was wrong shape | Weight lives on the criterion-task EDGE: `task_criterion_weights(task_id, criterion_key, weight)` — MYP samples criteria across tasks, doesn't weight tasks within a unit |
| 4 | Nullable mega-column anti-pattern | Type-specific config via `assessment_tasks.config: JSONB` validated by application layer based on `task_type`. Universal columns stay relational. |
| 5 | No version model for resubmissions | `task_submissions.version` + `version_of_submission_id` self-FK. Don't mutate a single row through "draft → submitted → resubmitted." |
| 6 | Single `unit_id` FK painted into corner for cross-unit summative | Made nullable + `task_units(task_id, unit_id)` join table. Capstones / PP / coursework spanning units supported from day 1. |
| 7 | `task_type: 'peer' \| 'self'` undermodels peer-eval | Out of scope for v1. `task_type` enum extensible; peer-eval entities (`peer_evaluator_pairings`, `peer_evaluations`) added when peer-review ships. |

### Gemini's reinforcement

- "Mature systems almost universally use Option A" — ManageBac, Canvas, Schoology, Google Classroom all converge here
- "There is no `summative_tasks` table in these systems"
- Wiggins/McTighe + Hattie research framing: "formative and summative are not different things; they are different *purposes for gathering evidence*"
- "Imposing a hard database-level split between formative and summative contradicts the reality that a teacher might decide to use a 'summative' quiz formatively if the whole class bombs it"

---

## Data model — the locked schema

All tables get RLS. Migrations get timestamp prefixes (`scripts/migrations/new-migration.sh`). Schema-registry yaml updated as part of TG.0B.

### `assessment_tasks` — the unified primitive

```sql
CREATE TABLE assessment_tasks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Universal columns (every task has these regardless of type)
  unit_id              UUID REFERENCES units(id) ON DELETE CASCADE,  -- nullable for cross-unit
  class_id             UUID REFERENCES classes(id) ON DELETE CASCADE, -- NULL = template
  school_id            UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  task_type            TEXT NOT NULL DEFAULT 'formative',
                       -- 'formative' | 'summative' | 'peer' | 'self' (v1 ships first 2)
  status               TEXT NOT NULL DEFAULT 'draft',
                       -- task's own status: 'draft' | 'published' | 'closed'
                       -- (NOT student's submission status — that lives on task_submissions)
  created_by           UUID NOT NULL REFERENCES auth.users(id),
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),

  -- Type-specific config — validated in application layer based on task_type.
  -- Avoids the nullable-mega-column anti-pattern (Cowork correction #4).
  config               JSONB DEFAULT '{}'::jsonb
  -- Shape varies by task_type. Examples:
  --
  -- task_type='formative':
  --   { criteria: ['B'],
  --     due_date: '2026-05-20',
  --     submission_format: 'text',
  --     ai_use_policy: 'allowed' }
  --
  -- task_type='summative':
  --   { criteria: ['A','B','C','D'],
  --     due_date: '2026-06-15',
  --     submission_format: 'multi',
  --     word_count_max: 2000,
  --     grasps: { goal: '...', role: '...', audience: '...',
  --               situation: '...', performance: '...', standards: '...' },
  --     ai_use_policy: 'allowed_with_citation',
  --     late_policy: { kind: 'penalty', penalty_pct_per_day: 10 },
  --     resubmission: { open: true, until: '2026-07-01', max_attempts: 2 },
  --     self_assessment_required: true }
);

CREATE INDEX idx_assessment_tasks_unit ON assessment_tasks(unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX idx_assessment_tasks_class ON assessment_tasks(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX idx_assessment_tasks_school ON assessment_tasks(school_id);
CREATE INDEX idx_assessment_tasks_type ON assessment_tasks(task_type);
CREATE INDEX idx_assessment_tasks_status ON assessment_tasks(status);
```

### `task_lesson_links` — many-to-many lessons ↔ tasks (Cowork correction #2)

```sql
CREATE TABLE task_lesson_links (
  task_id              UUID NOT NULL REFERENCES assessment_tasks(id) ON DELETE CASCADE,
  unit_id              UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  page_id              TEXT NOT NULL,  -- 'L01' style identifier inside content_data
  PRIMARY KEY (task_id, unit_id, page_id)
);

CREATE INDEX idx_task_lesson_links_task ON task_lesson_links(task_id);
CREATE INDEX idx_task_lesson_links_unit_page ON task_lesson_links(unit_id, page_id);
```

This lets us answer both directions of the question:
- *"What tasks does this lesson contribute to?"* → `WHERE unit_id = ? AND page_id = ?`
- *"What lessons feed this task?"* → `WHERE task_id = ?`

### `task_criterion_weights` — weight on the edge (Cowork correction #3)

```sql
CREATE TABLE task_criterion_weights (
  task_id              UUID NOT NULL REFERENCES assessment_tasks(id) ON DELETE CASCADE,
  criterion_key        TEXT NOT NULL,  -- 'A' | 'B' | 'AO1' | etc., framework-neutral
  weight               INTEGER NOT NULL DEFAULT 100 CHECK (weight BETWEEN 0 AND 100),
  rubric_descriptors   JSONB,
                       -- Structure: { level1_2: '...', level3_4: '...',
                       --              level5_6: '...', level7_8: '...' }
                       -- For non-MYP frameworks (GCSE %, A-Level AO),
                       -- MYPflex resolves the level-band labels at render time.
  PRIMARY KEY (task_id, criterion_key)
);
```

This decouples: a task can assess Criterion A at weight 100 (sole criterion) AND a different task assess Criterion B at weight 100. MYP's "sample each criterion across multiple tasks" pattern works without forcing tasks to sum to 100% within a unit.

### `submissions` — POLYMORPHIC (designed for inquiry mode from day one)

```sql
CREATE TABLE submissions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic source — Cowork's flag, structured/inquiry future-proofing
  source_kind          TEXT NOT NULL CHECK (source_kind IN ('task', 'milestone', 'project')),
  source_id            UUID NOT NULL,
  -- For source_kind='task': source_id → assessment_tasks(id)
  -- For source_kind='milestone': source_id → inquiry_milestones(id) [future]
  -- For source_kind='project': source_id → inquiry_projects(id) [future]
  -- FK enforcement happens in application layer (not database) due to polymorphism.

  student_id           UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id            UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Versioning (Cowork correction #5)
  version              INTEGER NOT NULL DEFAULT 1,
  version_of_submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  -- NULL for v1; set for v2+ to point at the prior version

  -- Submission content
  text_response        TEXT,
  uploads              JSONB DEFAULT '[]',
                       -- [{ url, filename, mime, size_bytes, uploaded_at }, ...]
  ai_use_declaration   TEXT,

  -- Self-assessment (Hattie d=1.33 — the high-leverage move)
  self_assessment      JSONB,
                       -- [{ criterion: 'A', level: '5-6', evidence_note: '...' }, ...]

  -- Lifecycle
  status               TEXT NOT NULL DEFAULT 'draft',
                       -- 'draft' | 'submitted' | 'graded' | 'returned'
  draft_saved_at       TIMESTAMPTZ,
  submitted_at         TIMESTAMPTZ,

  -- Late tracking
  late_days            INTEGER DEFAULT 0,

  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),

  -- One active submission per student per source per version
  UNIQUE(source_kind, source_id, student_id, version)
);

CREATE INDEX idx_submissions_source ON submissions(source_kind, source_id);
CREATE INDEX idx_submissions_student ON submissions(student_id);
CREATE INDEX idx_submissions_school ON submissions(school_id);
CREATE INDEX idx_submissions_status ON submissions(status);
```

The polymorphism is the structured-vs-inquiry future-proofing. v1 only sees `source_kind='task'` rows; inquiry mode adds the rest later.

### `grade_entries` — criterion-scored grades (against a submission)

```sql
CREATE TABLE grade_entries (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id        UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  criterion_key        TEXT NOT NULL,
  achievement_level    TEXT NOT NULL,
                       -- '1-2' | '3-4' | '5-6' | '7-8' for MYP;
                       -- MYPflex maps to scale at render
  numeric_score        NUMERIC,  -- normalised numeric for analytics; optional
  feedback_text        TEXT,
  graded_by            UUID NOT NULL REFERENCES auth.users(id),
  graded_at            TIMESTAMPTZ DEFAULT now(),
  is_published         BOOLEAN NOT NULL DEFAULT false,
                       -- separate from task.status; controls student visibility
  UNIQUE(submission_id, criterion_key)
);

CREATE INDEX idx_grade_entries_submission ON grade_entries(submission_id);
```

### `assessment_records` — published-grade endpoint (TG.0A finding F1, 5 May 2026)

The brief's first draft missed this table. TG.0A audit caught it: `assessment_records` is the canonical published-grade lifecycle endpoint — what students/parents actually see, what data-subject exports include, what feeds G1's past-feedback memory. Stays as today; gains a task association.

The flow: `student_tile_grades` (calibration working state) → `grade_entries` on `submissions` (synthesis working state) → **`assessment_records` (released, parent-visible snapshot, `is_draft=false`)**.

```sql
-- Existing schema preserved (migration 019_assessments.sql). Add task association:
ALTER TABLE assessment_records
  ADD COLUMN task_id UUID REFERENCES assessment_tasks(id) ON DELETE CASCADE;

-- After TG.0K deletes legacy dummy data:
ALTER TABLE assessment_records
  ALTER COLUMN task_id SET NOT NULL;

CREATE INDEX idx_assessment_records_task ON assessment_records(task_id);
```

Existing columns (preserved): `id`, `student_id`, `unit_id`, `class_id`, `teacher_id`, `data: JSONB NOT NULL` (holds `criterion_scores[]`, `overall_comment`, framework labels, snapshot data), `overall_grade: SMALLINT`, `is_draft: BOOLEAN NOT NULL DEFAULT true` (flips false on release), `assessed_at`, `created_at`, `updated_at`, `unit_version_id`.

The release route (`/api/teacher/grading/release`) flow becomes task-scoped: reads `student_tile_grades` for `(student_id, task_id)` instead of `(student_id, unit_id, class_id)`; upserts `assessment_records` with `task_id`. No new readers/writers required — the 8 existing consumers (4 writers + 4 readers, per TG.0A F1 audit) keep working with task-scoped rows.

Optional `submission_id UUID REFERENCES submissions(id)` column **deferred to v1.1** — not strictly needed since rollup data is embedded in `data.criterion_scores[]`. Add when reporting needs to cite the specific submission version.

### `assessment_tasks.config` — extension point for cross-framework tagging (TG.0A finding F3, 5 May 2026)

When **Lever 0 (manual unit designer)** ships, its Assessment section emits 1-4 `assessment_tasks` rows per unit. Lever 0 may also tag tasks with cross-framework context (CBCI generalization references, Paul-Elder element × standard intersections, Toulmin warrants, etc.). These tags don't get their own columns — they live in `assessment_tasks.config` JSONB:

```typescript
// Example task config from a Lever 0-authored unit:
{
  // Standard summative fields:
  criteria: ['B', 'C'],
  due_date: '2026-06-15',
  submission_format: 'multi',
  grasps: { goal: '...', role: '...', ... },
  
  // Lever 0 cross-framework tagging (extension point):
  cbci_generalization_id: 'gen-3',  // FK-like reference into units.unit_planning_state.generalizations
  paul_elder_intersection: { element: 'Information', standard: 'Depth' },
  // ... future framework tags as new pedagogies arrive
}
```

This is the canonical extension point for cross-framework tagging surfaced by Lever 0 (and any future pedagogy-aware unit-design surface). v1 grading UI doesn't need to surface these tags but they're queryable. Documented here so future devs don't try to add columns for each new framework.

### `student_tile_grades` — re-mint with task FK (G1 roll-forward)

The G1 migration was rolled back. Re-mint with the task FK that was missing:

```sql
CREATE TABLE student_tile_grades (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id              UUID NOT NULL REFERENCES assessment_tasks(id) ON DELETE CASCADE,
  -- ^ NEW: this is what was missing in the rolled-back migration
  student_id           UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id              UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  class_id             UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  page_id              TEXT NOT NULL,
  tile_id              TEXT NOT NULL,
                       -- 'activity_<nanoid>' or 'section_<idx>' per existing pattern
  criterion_key        TEXT NOT NULL,
  achievement_level    TEXT NOT NULL,
  ai_pre_score         NUMERIC,
  ai_evidence_quote    TEXT,
  ai_confidence        NUMERIC,
  confirmed            BOOLEAN NOT NULL DEFAULT false,
  override_note        TEXT,
  graded_by            UUID NOT NULL REFERENCES auth.users(id),
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, student_id, page_id, tile_id, criterion_key)
);
```

**The G1 prototype's React components, lib helpers (ScorePill, extractTilesFromPage, computeStudentRollup), and the `/teacher/marking` page all roll forward** — they consume `student_tile_grades` rows scoped by `task_id` rather than by unit. Calibrate becomes "calibrate the tiles within this task." Synthesize aggregates per criterion per task per student.

---

## Teacher UI — the split surfaces (Tasks v1 verdict)

### Tasks panel — sidebar in the lesson editor

Lives **above** the lesson list in the existing Phase 0.5 lesson editor. Same architectural slot as the (existing) skill panel and the (Lever-MM) NM block category.

```
┌─────────────────────────────────┐
│ 📋 TASKS (3)                    │
│ ┌─────────────────────────────┐ │
│ │ ⚡ Quiz 1 (formative)       │ │
│ │ A · Mon 12 May              │ │
│ ├─────────────────────────────┤ │
│ │ ⚡ Quiz 2 (formative)       │ │
│ │ B · Wed 14 May              │ │
│ ├─────────────────────────────┤ │
│ │ 🎯 Roller Coaster Brief    │ │
│ │ A·B·C·D · Fri 23 May        │ │
│ │ [Configure →]               │ │
│ └─────────────────────────────┘ │
│ [+ Add task]                    │
│                                 │
│ Lessons                         │
│ • L01 — Investigate            │
│ • L02 — Develop                │
│ • L03 — Create                 │
└─────────────────────────────────┘
```

Empty state: "No tasks configured yet. Backward design starts here →"

Click `+ Add task` opens a chooser (matching Tasks v1 prototype Artboard 2): **Quick check** (formative, inline) vs **Project task** (summative, multi-step config).

### Quick check — inline row form

Click `Quick check` → a row expands inline in the tasks panel with 4 fields:

1. Title (text input, focused)
2. Criteria (single-select pill picker)
3. Due date (date picker)
4. Linked sections (optional — defaults to "any work in this unit")

↵ to save. Stays in the panel; no modal. Total interaction <30 seconds.

The row format mirrors the existing block-palette block style (compact, single-line, click to expand).

### Project task — 5-tab modal/drawer

Click `Project task` → a focused configuration surface opens as a drawer or modal. **5 tabs in fixed order** (per Tasks v1 verdict — backward-design-forcing):

| # | Tab | Contents |
|---|---|---|
| 1 | **GRASPS** | Goal · Role · Audience · Situation · Performance · Standards. Wiggins/McTighe authentic-task framing. Each as a small text area with example placeholder. |
| 2 | **Submission** | Format (text / upload / multi), word count cap, AI-use policy radio (allowed / allowed_with_citation / not_allowed), academic integrity declaration toggle |
| 3 | **Rubric** | Per-criterion descriptors at 4 achievement levels. **Self-assessment locked-on** toggle next to it (Hattie d=1.33 — locked-on for summative by default; teacher can disable but UI nudges away). |
| 4 | **Timeline** | Due date, late policy, resubmission window (off / open until X / max N attempts), linked lessons (multi-select from unit's lessons) |
| 5 | **Policy** | Group/individual, peer-evaluator config (greyed out — "Coming soon"), notification settings |

Tab 1 of 5 means: a teacher who's never written GRASPS gets it presented FIRST, before any other configuration. The UI teaches the practice (per Friction Moment 03).

Save behavior:
- "Save as draft" — config saves, task status stays `draft`, students can't see it
- "Publish" — task status flips to `published`, students see it; greys out a few destructive fields (e.g. can't change criteria after publish without explicit confirmation)

### Lesson card chip — "Builds toward..."

Top of every lesson card (same vertical slot as Lever-MM's NM checkpoint chip). Auto-shown when a task's `task_lesson_links` row exists for that lesson:

```
📋 BUILDS TOWARD
   ⚡ Quiz 1 · Due Mon 12 May
   🎯 Roller Coaster Brief · Due Fri 23 May
```

Click a chip → drawer opens at the corresponding task's config page.

---

## Student UI

### Lesson page — task chip at top

Real student page (`/(student)/unit/[unitId]/[pageId]`) gets a chip strip at the top showing tasks this lesson contributes to:

```
🎯 BUILDS TOWARD: Roller Coaster Design Brief · Due Fri 23 May (in 8 days)
   You are: a roller-coaster designer pitching to a theme-park exec
   [View task →]
```

Click "View task" → opens the task overview (rubric + GRASPS + due date + progress).

### Student dashboard — sticky task cards

For every active task in any of the student's classes, a card appears on the dashboard:

```
┌─────────────────────────────────┐
│ 🎯 ROLLER COASTER DESIGN BRIEF │
│ Y8 Design · Due Fri 23 May      │
│ in 8 days                       │
│                                 │
│ Goal: Design a marble run...    │
│                                 │
│ Progress against rubric:        │
│ [A: ▓▓▓░░] [B: ▓▓░░░] [C: ░░░] │
│                                 │
│ [Continue work →]               │
└─────────────────────────────────┘
```

Progress bars source: percentage of linked-lesson sections completed + criterion-tagged tile grades. Same algorithm as Lever-MM's competency rollup.

### Submission page — `/(student)/tasks/[taskId]/submit`

Focused single-page flow. Renders only when `task.config.submission_format` requires explicit submission (most summatives).

Layout:
- **GRASPS as story** at top (renders the 6 fields as a narrative paragraph)
- **Rubric** in a sticky right panel
- **Submission form** on the left:
  - Text editor (if format includes text)
  - Upload area (if format includes upload)
  - AI-use declaration text area (visible if `ai_use_policy != 'not_allowed'`)
- **Self-assessment scaffold** below the submission form. Required-before-submit gate:
  - Per criterion: rate yourself + write a one-line evidence note
  - "Submit final" button stays disabled until self-assessment is complete

Save flow:
- "Save draft" — auto-saves on blur
- "Submit final" — requires self-assessment complete; commits row to `submissions` with `status='submitted'`

### Teacher submission monitor — `/teacher/marking`

The existing `/teacher/marking` page is the natural surface; refactors to be **task-scoped** instead of unit-scoped.

```
Tasks needing your attention
─────────────────────────────────────────────────────
🎯 Roller Coaster Brief — Y8 Design     12 / 24 graded   [Open]
⚡ Quiz 2 — Y8 Design                   24 / 24 graded   [Done]
⚡ Quiz 1 — Y8 Design                   24 / 24 returned [Reports]
```

Click a task → drops into G1's existing Calibrate view, scoped to that task's tiles. Synthesize view aggregates per criterion per task per student.

---

## ManageBac export — file-as-portable-artifact

**Decision: export, NOT integration.** Same model serves Schoology, Canvas, Google Classroom, OneDrive, parent emails, archival folders. ManageBac is the first consumer.

### Path 1 — Teacher exports task definition (after creating it)

**Trigger placement:**
- Button in task config modal: "Export → ManageBac"
- Button on each task row in the Tasks panel sidebar

**Content:**
- Task title
- GRASPS rendered as a story (Goal · Role · Audience · Situation · Performance · Standards)
- Due date + submission requirements (format, word count, AI policy)
- Rubric formatted as a clean per-criterion table
- Late policy + resubmission window
- Linked lessons (toggle — default off; toggle on for context appendix)

**Output formats:**

| Format | Use case |
|---|---|
| **PDF** | Print/distribute; rubric as table; matches StudioLoom visual identity |
| **Plain text / Markdown** | Paste directly into MB's task description field |
| **DOCX** | Editable; teachers can tweak before posting |
| **PPT** | Optional — for projecting at start of class |

Filename: `[task-title]-[unit-name]-task-brief.[ext]` (sanitised).

### Path 2 — Student exports completed work (for upload to MB)

**Trigger placement:**
- Persistent button on submission page
- Emphasised after the submit confirmation: "Now download your portfolio for ManageBac"
- Available from student's completed-tasks list

**Single PDF format — recommended default:**

```
[STUDENT NAME] — [TASK TITLE] — [DATE]
─────────────────────────────────────────
COVER
  Class · Unit · Task · Submitted-at
  
TASK BRIEF (so the grader has context)
  GRASPS · Rubric · Submission requirements

YOUR WORK ALONG THE WAY (linked-lesson contributions)
  Lesson 1 / Section 1: [response text]
  Lesson 1 / Section 3: [upload — embedded thumbnail]
  Lesson 2 / Section 2: [response]
  ...

FINAL SUBMISSION
  Text response: [...]
  Uploads: [embedded preview + filenames]
  
SELF-ASSESSMENT
  Criterion A: 5-6 — "I demonstrated this by..."
  ...
  
AI USE DECLARATION (if applicable)
  [student's narrative]
```

**Output options:**

| Format | When |
|---|---|
| **PDF (single file)** | Default for ≤3MB total uploads — easiest for MB upload |
| **ZIP bundle** | Auto-prompted when uploads exceed 3MB; structure: `cover.pdf` + `submission/` + `appendix/` + `originals/` |

Filename: `[student-name]-[task-title]-portfolio.[ext]`.

### Implementation — `lib/tasks/export-renderer.ts` (pure module)

Same architectural pattern as Lever-MM's `lib/nm/checkpoint-ops.ts`. Pure functions, tested in isolation, called by format-specific renderers.

```typescript
// Pure shape transformation — no side effects.
// Format-specific renderers (PDF, DOCX, PPT, ZIP) consume this.
export function taskToTeacherExportShape(task, opts): ExportShape;
export function submissionToStudentExportShape(submission, opts): ExportShape;
```

Format-specific routes:

```
POST /api/teacher/tasks/[taskId]/export?format=pdf|txt|docx|pptx
POST /api/student/submissions/[submissionId]/export?format=pdf|zip
```

Each route resolves the data, calls `export-renderer.ts` for the shape, then dispatches to a format-specific generator. Reuse the existing `pdf` / `docx` / `pptx` skills from the toolkit.

### Auditing

Optional `tasks.last_exported_at` / `submissions.last_exported_at` fields could track export timing for audit/analytics. **Defer to v1.1** — exports are derived from the data; auditing is a P3 nice-to-have.

---

## NM checkpoints — explicitly stay parallel

Per Matt's call (4 May session, paraphrased): "NM is competency tracking, not graded summative work. Keep parallel."

**Why NM is NOT a `task_type='nm_observation'`:**

| | Tasks | NM observations |
|---|---|---|
| Purpose | Grade student work against criteria | Track competency development over time |
| Lifecycle | Discrete (create → publish → submit → grade → return) | Continuous (snapshot at any lesson with checkpoints) |
| Output | A grade against criteria | A competency-element observation rating |
| Reporting | MYP report card / GCSE grade | Competency portfolio / Melbourne Metrics dashboard |
| Submission flow | Student submits work | Student self-rates element + teacher observes |
| Frameworks | MYP A-D, GCSE %, AO1-AO5 | Melbourne Metrics elements (Agency, Communication, etc.) |
| Audience | Grader | Mentor / advisor / future-self |

The two systems share infrastructure (rubric descriptors, criterion tagging, submissions for student-side capture) but the conceptual primitive is different. NM has its own JSONB column on `class_units.nm_config` and its own UI surfaces (Lever-MM block category in editor, results panel in class settings).

**Implication for the brief:** the Tasks panel sidebar in the lesson editor sits *next to* (not replacing) the NM block category. Both surface independently. Teachers can use either, neither, or both per lesson.

---

## Backfill plan — NONE (Matt's call, 5 May 2026 OQ-2 resolution)

**Decision: no backfill. Existing single-grade-per-unit data is dummy / test data and gets deleted.**

This is a simplification from the original draft (which proposed auto-migrating ~62 prod grades into `task_type='summative'` records). Matt confirmed: all existing graded units are dummy accounts in dev/test. Nothing to preserve. No teachers / students rely on the legacy data.

**Cleanup steps in TG.0K:**

```sql
-- After TG.0B-J have shipped + smoke-tested:
DELETE FROM student_progress WHERE ...test data...;       -- if applicable
DELETE FROM legacy_grade_table_rows WHERE ...;            -- per-criterion scores from legacy /teacher/classes/[classId]/grading/[unitId]
-- Existing units / classes themselves stay — only the grade records get nuked.
```

The legacy `/teacher/classes/[classId]/grading/[unitId]` page is **deleted, not redirected** — code removed, route 404s for the rare deep-link, nav refactored to point at the new task-scoped marking surface only.

**Implications of this simplification:**
- TG.0B is purely additive (new tables) — no migration logic to write, no row-count smoke gate, no concurrency concerns about legacy writers
- TG.0K reduces from "redirect + soak" to "delete + remove route file"
- Estimate drops by ~0.5 day (was ~16 days; now ~15.5 days)
- One stop trigger removed: "Backfill produces fewer task records than grade rows = data loss" — N/A since no backfill
- Risk: nuking dummy data in prod — gets a manual sanity check (count rows + verify they're test accounts) before the DELETE runs

---

## G1 code disposition — roll forward

The G1 prototype + half-shipped code is salvage-worthy:

| Asset | Disposition |
|---|---|
| `docs/prototypes/grading-v2/` (Calibrate / Synthesize / Studio Floor design) | **KEEP** — canonical UX. Just gets task-scoped. |
| `ScorePill`, `ScoreSelector` components | **KEEP** — reusable atoms |
| `extractTilesFromPage`, `tileProgress` (`lib/grading/lesson-tiles.ts`) | **KEEP** — section/tile extraction pattern proven |
| `computeStudentRollup` (`lib/grading/rollup.ts`) | **REVISE** — operates per-task instead of per-unit |
| `computeCriterionCoverage` (`lib/grading/criterion-coverage.ts`) | **REVISE** — task-scoped |
| `save-tile-grade.ts` | **REVISE** — writes `task_id` column (currently writes to a non-existent table after the migration was rolled back) |
| `/teacher/marking` page | **REFACTOR** — task list at top, click a task to drop into Calibrate scoped to that task |
| `/api/teacher/grading/tile-grades` | **REVISE** — task-scoped endpoint |
| `student_tile_grades` migration (rolled back, status: dropped) | **RE-MINT** with `task_id NOT NULL` FK |

**No code deleted, no design thrown away.** The half-shipped state closes cleanly when this brief's TG.0G (G1 roll-forward) phase lands.

---

## Sequence

1. **Brief sign-off** (this doc, Matt review)
2. **TG.0A** — pre-flight ritual + decision-log entries + handoff prep + Lever 0 schema-dependency check (per OQ-6)
3. **TG.0B** — schema migration (assessment_tasks, task_lesson_links, task_criterion_weights, submissions, grade_entries, student_tile_grades). **Purely additive — no backfill** per OQ-2 resolution; legacy dummy-data deletion deferred to TG.0K.
4. **TG.0C** — Tasks panel sidebar in editor + chooser + inline-row formative form
5. **TG.0D** — 5-tab summative project config drawer
6. **TG.0E** — lesson card "Builds toward..." chip integration (same pattern as Lever-MM)
7. **TG.0F** — student-side surfaces (lesson chip, dashboard sticky cards, submission page with self-assessment gate)
8. **TG.0G** — G1 roll-forward: refactor /teacher/marking to be task-scoped + revise rollup/coverage helpers + re-wire ScorePill writers
9. **TG.0H** — ManageBac export adapters (teacher task brief PDF/TXT/DOCX/PPT + student portfolio PDF/ZIP)
10. **TG.0I** — tests + fixtures + smoke seed (analogue of Lever 1's seed-test-unit.sql)
11. **TG.0J** — registry sync (WIRING, schema-registry, api-registry, doc-manifest)
12. **TG.0K** — legacy single-grade page DELETION (per OQ-2 resolution: no redirect; route file removed, dummy data DELETE'd from prod after manual sanity check, nav refactored)
13. **Matt Checkpoint TG.1** — full smoke (create formative + summative; student submits with self-assessment; teacher Calibrate/Synthesize; Manage Bac export round-trip)

**Estimated effort:** ~15.5 days end-to-end (was ~16; OQ-2's no-backfill resolution shaved ~0.5 day off TG.0B + TG.0K).

After **TG.0B (schema lock)**, Lever 0 (manual unit designer) build can start in parallel — it consumes the locked schema. Tasks-grading and Lever 0 implementation overlap; they don't step on each other.

| Phase | Est | Parallelizable? |
|---|---|---|
| TG.0A — pre-flight | 0.5 day | No |
| TG.0B — schema + backfill | 1 day | No (gates Lever 0) |
| TG.0C — tasks panel + formative inline | 2 days | Yes (after 0B) |
| TG.0D — summative 5-tab config | 2 days | Yes |
| TG.0E — lesson chip | 0.5 day | Yes |
| TG.0F — student surfaces | 2 days | Yes |
| TG.0G — G1 roll-forward | 3 days | Yes |
| TG.0H — ManageBac export | 2 days | Yes |
| TG.0I — tests + smoke seed | 1.5 days | Yes |
| TG.0J — registry sync | 0.5 day | Yes |
| TG.0K — legacy DELETE + route removal (per OQ-2) | 0.25 day | Yes |
| **Total** | **~15.5 days** | |

---

## Stop triggers (any of these → pause + report)

- Schema drift between this brief and prod (after migration applies, columns missing) — surfaces if FU-EE / migration backlog hasn't been resolved
- ~~Backfill of existing grades produces fewer task records than existing grade rows~~ — RESOLVED (no backfill per OQ-2; existing data is dummy/test, gets deleted in TG.0K)
- G1 code refactor breaks the existing /teacher/marking page UX (regression on a shipped surface)
- ManageBac export PDF doesn't pass a manual upload smoke (real teacher uploads it; rejected by MB) — would require format adjustments
- Polymorphic `submissions.source_kind` field isn't sufficient — surfaces if inquiry-mode design forces a different shape
- Tile-grades migration gets rolled back again — investigate root cause before re-attempting
- Lever 0 work surfaces a schema requirement we missed (e.g. unit_template-level task fields) — requires brief amendment

## Don't stop for

- Visual polish on the chooser / 5-tab modal (functional first; polish in v1.1)
- Legacy single-grade page styling tweaks (it's being deprecated)
- Schoology / Canvas / Google Classroom export support (architecture supports it; ManageBac first)
- Group submissions, peer-eval pairings, multi-stage milestones — all FU
- Layer 2 PM tools — separate phases
- Inquiry mode anything

---

## Pre-flight ritual (before TG.0B)

1. Working tree clean — `git status` shows nothing unrelated to this brief
2. Tests green at baseline 3700 — `npm test -- --run`
3. Re-read relevant Lessons:
   - **#39** — pattern bug across N call sites (check both validators + tool-schemas)
   - **#54** — never trust WIRING summaries; grep for actual file paths
   - **#67** — tool-schema vs validator pattern bug (applies if any AI tool returns task structure)
   - **#68** — repo migrations ≠ applied prod schema; probe `information_schema.columns` before any seed/INSERT
   - **#69** — `SET LOCAL session_replication_role = 'replica'` for fixture seeds
   - **#70** — push feature branch → Vercel preview when smoke surface IS deployed UI
   - **#71** — pure logic in `.tsx` files isn't testable in this repo's vitest config; extract to `.ts` siblings

4. Audit `BlockCategory` consumers — if Tasks panel is implemented as a category alongside `new_metrics`, every file that switches on category must handle the new variant or fall through safely (Lever-MM precedent)

5. Audit existing grade-writers — every code path that writes to legacy single-grade tables needs to be flagged for migration

6. **Mock the teacher surfaces in static HTML before committing the schema** — Cowork's call: "Mock up the teacher view for both interactions BEFORE locking the schema. If they fight to share a surface, that's a signal." Tasks v1 prototype already did this; verified split surfaces work. **No additional mocking needed unless the 5-tab config raises questions during build.**

7. **Spec the report query before locking schema** — Cowork's call: "What does 'MYP report card for student X' look like as a SQL query against your tables? If it's painful, the schema is wrong."

   ```sql
   -- Sketch: MYP report for student X across all assessed units this term
   SELECT
     ge.criterion_key,
     COALESCE(ROUND(AVG(ge.numeric_score)::numeric, 2), NULL) AS avg_score,
     COUNT(DISTINCT s.id) AS submissions_count,
     COUNT(DISTINCT t.id) AS tasks_count
   FROM submissions s
   JOIN grade_entries ge ON ge.submission_id = s.id
   JOIN assessment_tasks t ON t.id = s.source_id AND s.source_kind = 'task'
   WHERE s.student_id = $1
     AND s.school_id = $2
     AND ge.is_published = true
     AND t.status = 'closed'
     AND t.task_type = 'summative'
     AND t.created_at >= $3  -- term start
     AND t.created_at <  $4  -- term end
   GROUP BY ge.criterion_key
   ORDER BY ge.criterion_key;
   ```

   Joins are clean. Single query, no UNION. Indexes cover the filter columns. **Schema passes the report-query test.**

---

## Open questions resolved (Matt sign-off, 5 May 2026)

| OQ | Resolution | Notes |
|---|---|---|
| **1. Brief scope confirmed?** | ✅ **CONFIRMED** | Structured classes only; inquiry / Layer 2 / Lever 0 = sister projects |
| **2. Backfill of existing grades?** | ✅ **NO BACKFILL — DELETE LEGACY DATA** | Existing single-grade-per-unit rows are dummy/test data on dummy accounts. Nothing to preserve. TG.0B is purely additive; TG.0K deletes the dummy data + the legacy `/teacher/classes/[classId]/grading/[unitId]` page outright. Estimate dropped ~0.5 day. (Departed from my original "auto-migrate" recommendation per Matt's call.) |
| **3. Self-assessment default-on for summative?** | ✅ **DEFAULT ON** | Hattie d=1.33. Teacher can disable per-task via Tab 5 (Policy). |
| **4. ManageBac class-level grade-book export?** | ✅ **DEFER TO v1.1** | Per-task PDFs + student portfolio in v1. Class-level bulk export when teacher demand surfaces. |
| **5. 5-tab config — drawer or full-page?** | ✅ **DRAWER** | Slides in from right; lessons stay visible behind. If rubric editor (Tab 3) cramps, escalate to full-page at TG.0D. |
| **6. Lever 0 schema dependency check?** | ✅ **REQUIRED PRE-TG.0B** | 30-min Lever 0 sketch BEFORE TG.0B applies. Captures any CBCI / SoP / Paul-Elder fields that need to live on `assessment_tasks`. Folded into TG.0A pre-flight ritual. |
| **7. Dedicated worktree?** | ✅ **YES** | `/Users/matt/CWORK/questerra-tasks` for the ~15.5-day TG build. Matches existing pattern (`questerra-preflight`, `questerra-dashboard`). |

All decisions logged in [`docs/decisions-log.md`](../decisions-log.md) under "Task System Architecture — OQ resolutions (5 May 2026)".

**Brief is locked. TG.0A pre-flight is the next step.**

---

## Reading order if you're picking this up

1. **This brief** (you're here) — top to bottom; sub-phase plan especially
2. **`docs/prototypes/tasks-v1/README.md`** — verdict + 3 friction moments + visual reference
3. **`docs/prototypes/tasks-v1/artboard3.jsx`** lines 25-95 — the verbatim decision-panel argument
4. **`docs/projects/grading.md`** — the original master spec (the source of `assessment_tasks` concept; this brief picks it back up)
5. **`docs/projects/grading-phase-g1-brief.md`** — what G1 was supposed to ship; this brief supersedes that one
6. **`docs/prototypes/grading-v2/`** — the G1 Calibrate / Synthesize design that rolls forward
7. **`docs/decisions-log.md`** entries from 4-5 May 2026 — the architectural calls that informed this brief
8. **`docs/lessons-learned.md` #67-#71** — recent lessons that affect implementation
9. **The chat transcripts** at `docs/prototypes/tasks-v1/chats/chat1.md` for design intent
10. **Cowork + Gemini reviews** in the 4-5 May conversation history (key spec corrections)

---

## What success looks like

After **Checkpoint TG.1** passes:

- A teacher creates a 6-week unit, opens the Tasks panel, adds 2 formative quick-checks (inline, ~30 sec each), then opens the summative project config (~12 min). The 5 tabs walk her through GRASPS → Submission → Rubric → Timeline → Policy. She publishes the unit.
- Each lesson card shows a "Builds toward..." chip listing relevant tasks with due dates.
- A student opens the unit, sees the summative task on their dashboard, works through the lessons (each lesson chip linking back to the task overview), arrives at the summative submission page, completes self-assessment per criterion, hits Submit.
- The teacher's `/teacher/marking` page shows the task with `12 / 24 graded` progress. She drops into Calibrate (existing G1 UX, now task-scoped). AI evidence quotes for each tile let her confirm or override per criterion. She switches to Synthesize per-student, writes feedback drafts assembled from her own evidence quotes, clicks Return.
- The student gets the graded task back, sees per-criterion feedback, and downloads a portfolio PDF for ManageBac upload.
- The teacher exports the task brief as DOCX, edits formatting, uploads to ManageBac with the rubric attached.
- All of this works without touching any inquiry-mode primitives (PYP, PP, Service students see their own different surfaces, built later, sharing the same `submissions` table).

That's v1. Layer 2 PM tools and inquiry mode follow in their own briefs.

---

## Final notes

- **This brief is the architectural decision moment.** Once signed off, it locks the schema for both tasks-grading and Lever 0 implementation. Future amendments should be careful about whether they break the polymorphic `submissions` boundary (which inquiry mode depends on).
- **Push discipline:** standard rules. Don't push to main until checkpoint signed off + migrations applied to prod. Use `task-system-architecture` branch (this branch) until TG.0B applies; then use the dedicated `questerra-tasks` worktree if recommended in OQ #7.
- **No code in this brief.** All implementation lives in the TG.0B-K phases. Stop reading and write code only after sign-off.
- **The brief replaces the would-be `summative-tasks.md`** that was never written. The summative-task feature is fully captured here as `task_type='summative'` with the 5-tab config.
