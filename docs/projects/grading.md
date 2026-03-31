# Project: Grading System Overhaul

**Status:** Planning
**Priority:** After Project Dimensions Phase 3-4
**Estimated effort:** ~8-12 days (5 phases)
**Created:** 30 March 2026

---

## Problem Statement

The current grading system treats each unit as a single summative grade (one score per criterion A-D, one overall grade 1-8). Real MYP assessment is far more granular — teachers set multiple tasks per unit, each task assesses specific criteria, and grades roll up differently for formative vs summative work. The current UI also lacks the infrastructure for report writing, moderation, and the assessment lifecycle that schools require.

## Current State

**What exists:**
- Grading page at `/teacher/classes/[classId]/grading/[unitId]` (~1,311 lines)
- Per-student criterion scores (1-8 for MYP, 0-100% for GCSE/A-Level/IGCSE via MYPflex Phase 1)
- Per-criterion teacher comments
- Overall grade (1-8 MYP)
- Tags and targets per student
- Draft/Published states
- IntegrityReport (MonitoredTextarea evidence) in evidence panel
- Framework-flexible scales via `getGradingScale()` / `getFrameworkCriteria()`
- Grades scoped to (student_id, unit_id, class_id) — do NOT travel between classes

**What's missing:**
- Multiple assessable tasks per unit (currently one grade per unit)
- Task types (formative vs summative)
- Per-task criterion mapping (which criteria does this task assess?)
- Grade aggregation / rollup logic
- Teacher ability to mark tasks as "gradable" in the lesson editor
- Report writing (semester/term report comments generated from grade data)
- Moderation support (cross-teacher marking consistency)
- Grade history / versioning
- Student-visible grade feedback
- Rubric attachment to tasks

---

## Architecture Vision

### Data Model

```
units
  └── class_units (per-class config)
        └── assessment_tasks (NEW)
              ├── task_id (nanoid)
              ├── title ("Bridge Design Portfolio", "Research Report")
              ├── task_type: "formative" | "summative" | "peer" | "self"
              ├── criteria: string[] (["A", "B"] — which criteria this task assesses)
              ├── weight: number (0-100, for rollup)
              ├── due_date?: ISO string
              ├── page_ids: string[] (which lesson pages contain this task)
              ├── rubric?: JSONB (task-specific rubric descriptors)
              ├── max_score_override?: number (for non-standard scales)
              └── status: "draft" | "active" | "graded" | "returned"

student_grades (replaces current single-grade model)
  ├── student_id
  ├── task_id (FK to assessment_tasks)
  ├── class_id
  ├── unit_id
  ├── criterion_scores: JSONB { "A": 5, "B": 6 }
  ├── overall_score?: number
  ├── teacher_comments: JSONB { "A": "...", "B": "..." }
  ├── feedback_text?: string (student-visible comment)
  ├── status: "draft" | "published" | "returned"
  ├── graded_at: timestamp
  └── integrity_metadata?: JSONB (from MonitoredTextarea)
```

### Grade Rollup Logic

For MYP:
- Summative tasks carry full weight in criterion best-fit judgement
- Formative tasks provide supporting evidence but don't numerically average
- Final criterion grade = teacher's professional judgement (MYP doesn't average — it's "best fit")
- Overall grade = sum of criterion grades → MYP grade boundary table (1-28 → 1-7)

For GCSE/percentage frameworks:
- Weighted average of task scores per criterion
- Overall = weighted sum across criteria

### Lesson Editor Integration

The Phase 0.5 lesson editor needs a way for teachers to mark activities as assessable:
- Toggle on ActivityBlock: "This is an assessment task"
- When toggled, shows: task name, criteria assessed (checkboxes), task type dropdown, weight
- Assessment tasks appear in a sidebar summary showing coverage (which criteria are assessed and how many times)
- Warning if a criterion has zero assessment tasks in the unit

### Report Writing

AI-generated report comments using:
- Per-criterion scores across all tasks
- Teacher comments per task
- Student progress trajectory (improving/declining/stable per criterion)
- Integrity data (effort indicators)
- Framework-specific language (MYP command terms, GCSE AO language)
- Configurable: tone, length, pronouns (he/she/they), reporting period

This builds on the existing Report Writer free tool at `/tools/report-writer` but uses actual grade data instead of manual ratings.

---

## Phases

### Phase 1: Assessment Tasks Data Model (~2 days)
- Migration: `assessment_tasks` table on `class_units`, `student_grades` table
- CRUD API for assessment tasks
- Backward compatibility: existing single-grade data migrated as one "Unit Assessment" task
- Assessment tasks visible on Class Hub Grade tab

### Phase 2: Lesson Editor Assessment Marking (~2 days)
- ActivityBlock gets "assessable" toggle
- Assessment task creator/editor in editor sidebar
- Criteria coverage summary panel
- Assessment tasks saved in `content_data` (forks with unit content)

### Phase 3: Multi-Task Grading UI (~3 days)
- Grading page redesign: task selector tabs/sidebar
- Per-task grading with criterion-specific rubric display
- Grade rollup computation (framework-aware)
- Student-visible feedback (published grades appear on student dashboard)
- Integrity data per task (already wired via MonitoredTextarea)

### Phase 4: Report Writing (~2 days)
- AI report generation from actual grade data
- Per-student, per-term reports
- Template system (school letterhead, formatting)
- Bulk generation with review/edit before publish
- Export as PDF or DOCX

### Phase 5: Moderation & Analytics (~2 days)
- Cross-teacher marking: share anonymised student work + grades for consistency checking
- Grade distribution visualisation per task/criterion/class
- Trend analysis (student trajectory across units)
- Exemplar tagging: mark graded work as grade-level exemplars for future reference

---

## Key Decisions to Make

1. **MYP best-fit vs averaging** — MYP explicitly says criterion grades are NOT averaged; they're professional judgement. The UI should show task-level data as evidence but let the teacher set the final criterion grade manually. Other frameworks can auto-calculate.

2. **Assessment tasks on content_data vs separate table** — Tasks reference page_ids in content, so they're tightly coupled to unit content. But they also have per-class configuration (weights, due dates). Decision: separate `assessment_tasks` table on `class_units` (forks independently of content).

3. **Formative grade visibility** — Should students see formative grades? MYP philosophy says formative is for learning, not ranking. Default: formative grades visible to teacher only, summative published to students. Teacher can override.

4. **Grade boundaries** — MYP 1-7 from criterion totals (1-28) uses official IB grade boundaries. These change slightly per year. Store as configuration, not hardcoded.

5. **Rubric format** — Per-task rubric descriptors or per-criterion level descriptors (MYP standard)? MYP uses criterion-level descriptors that are the same across all tasks. GCSE uses mark schemes per task. Need both.

---

## Dependencies

- **MYPflex Phase 1** (DONE) — Framework-flexible scales
- **Project Dimensions Phase 4** (DONE 31 Mar) — Activity-level metadata (bloom_level, grouping, ai_rules, timeWeight) now on every activity. Assessment importance can auto-suggest from Dimensions data.
- **Phase 0.5 Lesson Editor** (DONE) — Assessment marking needs to integrate with existing editor components
- **MonitoredTextarea Pipeline** (DONE) — Integrity data already flows to grading page

## Related Files

- `src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx` — Current grading page (~1,311 lines)
- `src/app/teacher/units/[unitId]/class/[classId]/page.tsx` — Class Hub Grade tab
- `src/lib/constants.ts` — `getFrameworkCriteria()`, `getGradingScale()`, `getCriterionDisplay()`
- `src/components/teacher/IntegrityReport.tsx` — Already wired into grading evidence panel
- `src/app/tools/report-writer/page.tsx` — Free report writer (reference for AI generation patterns)
