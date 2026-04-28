# Project: Grading System Overhaul

**Status:** ACTIVE — G1 brief drafted, awaiting sign-off (27 Apr 2026)
**Priority:** P0 (Matt deadline: 3 days from 27 Apr)
**Estimated effort:** Full vision ~14-18 days (7 phases). **v1 cut (G1) = 3 days.**
**Created:** 30 March 2026

> **27 Apr 2026 — v1 scope cut + brief**
> Matt asked for "best grading experience in the world" with AI assist, **needed in 3 days**. The full 7-phase plan below is ~14-18 days. The v1 cut (G1) ships only the three ergonomics that make grading *feel* world-class — marking queue, split-view marking, AI pre-score + draft comment. Phase brief: [`grading-phase-g1-brief.md`](grading-phase-g1-brief.md).
>
> **27 Apr 2026 — Grading v2 design landed.** Claude Design returned a horizontal-first → vertical-synthesis model with three views: **A · Calibrate** (default, per-question across class), **B · Synthesize** (per-student, auto-assembled rubric, past-feedback memory), **C · Studio Floor** (clustered, deferred to G2). Pivotal design decision: **8–15-word AI evidence quotes** are what makes horizontal viable — transparent reasoning, not hidden authority. Prototype + README at [`docs/prototypes/grading-v2/`](../prototypes/grading-v2/). The design's per-tile granularity sidesteps the original "single-grade vs `assessment_tasks`" question — each tile becomes its own gradeable item; per-criterion rubric scores are computed at synthesis time. **G1 brief refreshed accordingly: Q3 closed, Q1 refined, 1 open question remaining (multi-tile data model audit).**

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

### Teacher Marking Experience — "What Needs My Attention?"

The grading page assumes the teacher already knows which unit and student to grade. The real workflow starts earlier: *something happened that needs marking*. This section defines the surfaces that make marking discoverable and efficient.

#### Marking Queue

A dedicated `/teacher/marking` page (also surfaced as a card on the teacher dashboard) that aggregates all pending assessment work across every class. Each item shows:
- Student name + avatar
- Task title + unit name + class
- Submission timestamp (or "overdue" if past due_date)
- AI pre-scan status: "AI suggestions ready" / "Pending scan" / "No AI" (teacher preference)
- AI confidence indicator (high/medium/low — low confidence = needs more teacher attention)

Sorting/filtering: by class, by due date, by AI confidence, by criterion, by "new submissions since last session". Teachers with 5 classes and 3 active units each need to see the 10 most urgent items at a glance, not hunt through each unit individually.

Data model addition on `student_grades`:
```
submitted_at?: timestamp    -- when student completed the assessable activity
viewed_by_teacher?: boolean -- has teacher opened this submission
ai_pre_score?: JSONB        -- { criterion_scores: {...}, confidence: number, reasoning: string }
```

#### In-Context Marking (Split View)

When a teacher clicks "Mark" on a submission (from the queue or grading page), they get a split-pane view:
- **Left pane:** The student's actual work — their toolkit outputs, written responses, uploaded images, MonitoredTextarea content with integrity indicators. Rendered as the student saw it, but read-only.
- **Right pane:** The rubric + scoring interface. Per-criterion score selectors, comment fields, AI suggestions (if available). Teachers can pin comments to specific parts of the student's work (a comment anchored to a paragraph or image, not just a generic per-criterion note).

This replaces the current pattern of grading "blind" on a separate page. The student's work and the assessment happen in the same view.

#### Batch Marking Flow

Teachers typically mark one task across the whole class, not one student across all tasks. The batch flow:
1. Teacher selects a task (e.g. "Bridge Design Portfolio") from the marking queue or grading page
2. UI shows student 1 of N in the split view, with prev/next navigation
3. Rubric stays persistent on the right; student work scrolls on the left
4. AI pre-scores visible as ghost values in the score selectors — teacher confirms or overrides
5. Quick actions: "Accept AI suggestion", "Copy feedback to similar students", "Flag for moderation"
6. Progress bar: "12/24 marked" with ability to skip and return

#### Criteria Coverage Heatmap

On the Class Hub (per-unit view), a visual grid showing:
- Rows = criteria (A, B, C, D or framework equivalent)
- Columns = assessment tasks in this unit
- Cells = colour-coded: green (task assesses this criterion and is graded), amber (task assesses this criterion, not yet graded), grey (task doesn't assess this criterion)
- A row that's entirely grey = "you haven't assessed this criterion at all in this unit" — a planning signal, not just a grading signal

This helps teachers see at a glance whether their assessment coverage is balanced before grades are due.

### AI Role in Grading

AI never decides grades. It reduces teacher workload, improves consistency, and generates feedback drafts. The teacher always has final authority. All AI grading features are opt-in per teacher (some teachers will want to mark without AI; the system must respect that).

#### AI Pre-Scoring

When a student submits assessable work (completes an activity linked to an assessment_task), AI reads the work against the rubric and produces a suggested score per criterion with reasoning.

Pipeline:
1. Student completes assessable activity → `submitted_at` set on `student_grades`
2. Background job (or on-demand when teacher opens the submission): AI reads student work + rubric + criterion descriptors + any teacher-uploaded exemplars
3. AI produces: `{ criterion_scores: { "A": 5, "B": 4 }, confidence: 0.72, reasoning: { "A": "Student identified 3 stakeholders and analysed needs, but didn't connect to design specs — threshold for 6 requires that connection.", "B": "..." } }`
4. Stored in `ai_pre_score` JSONB on `student_grades`
5. Teacher sees ghost scores in the marking UI — faded numbers in the score selectors that the teacher can accept (one click) or override

Model: Haiku 4.5 for cost efficiency (marking happens at volume — 24 students × 4 criteria × multiple tasks). Rubric + student work + 1-2 exemplars fit in a single prompt. Estimated ~$0.002 per student per task.

Confidence scoring: AI self-reports confidence based on rubric clarity and work ambiguity. Low-confidence items bubble to the top of the marking queue ("AI isn't sure about these — your judgement needed").

#### Consistency Checker

After a teacher has marked 5+ students on the same task, AI reviews the pattern:
- Compares score distributions against the rubric descriptors
- Flags potential inconsistencies: "Student A received a 5 for Criterion A with work structurally similar to Student F who received a 3. The key difference appears to be [X]. Want to review both side-by-side?"
- Runs as a one-click "Check my marking" action on the grading page, not automatically (teachers should feel in control, not surveilled)

This is automated internal moderation — something schools currently do manually across departments once per term. StudioLoom does it in real-time for a single teacher, then extends to cross-teacher moderation in Phase 5.

#### Feedback Draft Generation

For each graded submission, AI drafts a student-facing feedback comment:
- References specific parts of the student's work ("Your stakeholder analysis identified three user groups, which shows strong investigating skills.")
- Identifies the gap to the next level ("To reach a 6, try connecting each user group's needs to specific design requirements — this shows you can apply your research.")
- Tone: encouraging, specific, actionable. Not generic ("good work" is never acceptable from the AI).
- Teacher reviews, edits, and publishes. The draft is a starting point, not a final product.

This is different from Report Writing (Phase 4) — feedback drafts are per-task, immediate, and formative. Report writing is per-term, cumulative, and formal.

#### Class-Level Insights (Post-Marking)

After a teacher finishes marking a task, AI summarises patterns:
- Score distribution: "14/24 students scored below 4 on Criterion B (Designing). Common gap: students jumped to solutions without exploring alternatives."
- Teaching recommendation: "Consider revisiting the SCAMPER or Six Hats tool in the next lesson to strengthen divergent thinking before the next design task."
- Improvement signals: "6 students improved by 2+ levels on Criterion A compared to the last assessed task — your research skills mini-lesson appears to have had impact."

These insights feed into the existing Smart Insights panel on Teaching Mode and could also appear on the Class Hub. They close the loop between assessment and instruction — marking informs the next lesson.

#### Integrity-Informed Grading

MonitoredTextarea data already flows to the grading page via IntegrityReport. AI can synthesise this further:
- Flag sudden style changes within a response ("Writing style changed significantly in paragraphs 3-4 — integrity score dropped from 0.85 to 0.4. May warrant review.")
- Correlate effort indicators with grade: "Student spent 2 minutes on this 500-word response — significantly below class average of 18 minutes."
- Surface these as non-intrusive indicators in the marking split view, not as accusations. The teacher decides what to do with the information.

### Student Feedback Experience

The current student grades page (`/unit/[unitId]/grades`) is a flat, read-only dump of scores. Students deserve a feedback experience that's discoverable, contextual, and actionable.

#### Notification & Discovery

When a teacher publishes grades or returns work:
- Student dashboard shows a prominent card: "Your [Task Name] has been marked. Tap to see feedback." Badge count on the dashboard nav item.
- If the teacher included a feedback comment, the card previews the first line.
- Notification clears after the student has viewed the feedback.

Data model addition on `student_grades`:
```
returned_at?: timestamp     -- when teacher published/returned this grade
student_viewed_at?: timestamp -- when student first opened the feedback
```

This creates a "feedback receipt" loop — the teacher can see on the grading page which students have actually read their feedback (currently invisible).

#### Inline Feedback (In-Context)

The most powerful model: feedback appears where the work happened.
- When a student revisits a lesson page that contains assessed work, they see their teacher's comments anchored to the specific activity — next to their empathy map output, below their written response, overlaid on their uploaded image.
- Comments are visually distinct (teacher avatar, accent colour, "Teacher feedback" label) but non-intrusive — collapsible, not blocking the content.
- Pinned comments (from the split-view marking UI) appear at the exact location the teacher pinned them.
- General per-criterion comments appear at the bottom of the page in a feedback summary card.

This means students read feedback *in the context of their work*, not on a disconnected grades page. The grades page still exists as an overview, but the primary feedback experience is inline.

Data model: `feedback_anchors` — a JSONB array on `student_grades`:
```
feedback_anchors?: [
  { anchor_id: string, activity_id: string, position?: string, comment: string }
]
```

#### Growth Trajectory

Over time, students see their progression per criterion:
- On the grades overview page: a simple line/bar chart showing criterion scores across assessed tasks in this unit: "Criterion A: 3 → 4 → 5 (improving)"
- Visual framing: upward arrows, encouraging language ("You've grown 2 levels in Investigating this unit")
- Cross-unit view (future): progression across the whole year, feeding into the Student Learning Profile

This is not a leaderboard or ranking — it's private, self-referenced growth. Aligns with the existing Designer Level concept (quality-weighted, not volume) and the Student Learning Profile architecture.

#### AI-Powered "What To Do Next"

After viewing feedback, the student gets an actionable next step:
- "Your teacher suggested improving your analysis. Try reopening the PMI tool and adding two more 'Minus' points to deepen your critique." (Links directly to the tool.)
- "You scored a 4 on Designing. To reach a 5, review the exemplar your teacher shared and notice how they used annotated sketches to communicate design intent."
- Generated by AI from: the teacher's feedback comment + the criterion descriptors + the student's current score + available toolkit tools.

This bridges grading and learning — feedback becomes a prompt to re-engage with the toolkit, not a dead-end number. Follows the "no chatbot" principle: it's a structured nudge, not an open conversation.

Guardrails: the AI suggestion is read-only (not a chat), references the teacher's actual feedback (not independent judgement), and links to existing tools/activities (not invented tasks). Teacher can disable AI suggestions per class if preferred.

#### Formative vs Summative Framing

The UI tone and layout should differ based on task type:
- **Formative feedback:** Feels like coaching. Card-based, conversational tone, emphasis on "here's how to improve", no prominent score display (score available on tap but not the hero element). Colour: warm, encouraging.
- **Summative feedback:** Feels like a milestone. More formal layout, score prominently displayed with criterion breakdown, growth trajectory, teacher's overall comment. Colour: neutral, professional.

Default visibility (from Key Decision #3): formative grades visible to teacher only, summative published to students. Teacher can override per task. When formative feedback IS shared with students, it appears only as comments — no scores — unless the teacher explicitly enables score visibility.

---

## Phases (Revised)

The original 5 phases are updated to incorporate the three new areas. Estimated effort increases from ~8-12 days to ~14-18 days.

### Phase 1: Assessment Tasks Data Model (~2 days)
*Unchanged from original spec.*
- Migration: `assessment_tasks` table on `class_units`, `student_grades` table (with new fields: `submitted_at`, `viewed_by_teacher`, `ai_pre_score`, `returned_at`, `student_viewed_at`, `feedback_anchors`)
- CRUD API for assessment tasks
- Backward compatibility: existing single-grade data migrated as one "Unit Assessment" task
- Assessment tasks visible on Class Hub Grade tab

### Phase 2: Lesson Editor Assessment Marking (~2 days)
*Unchanged from original spec.*
- ActivityBlock gets "assessable" toggle
- Assessment task creator/editor in editor sidebar
- Criteria coverage summary panel (heatmap)
- Assessment tasks saved in `content_data` (forks with unit content)

### Phase 3: Multi-Task Grading UI + Marking Queue (~3-4 days)
*Expanded to include marking queue and split-view marking.*
- `/teacher/marking` page — aggregated marking queue across all classes
- Marking queue card on teacher dashboard
- Split-view marking: student work (left) + rubric/scoring (right)
- Batch marking flow with prev/next navigation
- Pinned comments (feedback anchors)
- Per-task grading with criterion-specific rubric display
- Grade rollup computation (framework-aware)
- Criteria coverage heatmap on Class Hub

### Phase 4: AI-Assisted Grading (~2-3 days)
*New phase — AI pre-scoring, consistency checking, feedback drafts.*
- AI pre-scoring pipeline (background job on student submission)
- Ghost scores in marking UI (accept/override)
- Confidence-based queue sorting
- Consistency checker ("Check my marking" action)
- AI feedback draft generation (per-task, teacher-editable)
- Teacher opt-in/opt-out per class
- Cost tracking integration (existing Dimensions3 cost infrastructure)

### Phase 5: Student Feedback Experience (~2-3 days)
*New phase — replaces the single line item "student-visible feedback" from old Phase 3.*
- Notification system: dashboard card when grades are returned
- Inline feedback on lesson pages (anchored comments)
- Grades overview page redesign: per-task breakdown, growth trajectory charts
- Formative vs summative UI framing
- AI "What to do next" nudge generation
- Feedback receipt tracking (student_viewed_at)

### Phase 6: Report Writing (~2 days)
*Was Phase 4. Now uses richer data from AI-assisted grading.*
- AI report generation from actual grade data + AI pre-score reasoning + teacher comments
- Per-student, per-term reports
- Template system (school letterhead, formatting)
- Bulk generation with review/edit before publish
- Export as PDF or DOCX

### Phase 7: Moderation, Analytics & Class Insights (~2 days)
*Was Phase 5. Now includes AI class-level insights.*
- Cross-teacher marking: share anonymised student work + grades for consistency checking
- AI class-level insights after marking (score patterns, teaching recommendations)
- Grade distribution visualisation per task/criterion/class
- Trend analysis (student trajectory across units)
- Exemplar tagging: mark graded work as grade-level exemplars for future reference

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

6. **AI pre-scoring opt-in granularity** — Per-teacher? Per-class? Per-task? Recommendation: per-class toggle with per-task override. Some teachers may want AI help on written tasks but not on visual/portfolio tasks where rubric interpretation is more subjective.

7. **Inline feedback anchoring precision** — Should teachers be able to pin comments to specific paragraphs/sentences within student text, or just to whole activities? Paragraph-level is more useful but significantly more complex (needs content addressability). Recommendation: start with activity-level anchoring, add paragraph-level in a future pass.

8. **AI "What to do next" — who generates?** — Should the AI nudge be generated from the teacher's feedback comment (more aligned with teacher intent) or independently from the rubric gap (more consistent)? Recommendation: primarily from teacher feedback, with rubric gap as fallback when teacher comment is empty.

9. **Feedback receipt — teacher visibility** — Should teachers see which students have read their feedback? Yes — this closes the feedback loop. But display it as information ("8/24 viewed"), not as a compliance tool. No "remind students to read feedback" automation.

10. **Marking queue scope** — Cross-unit (all pending work across all units in all classes) or per-unit? Recommendation: cross-unit by default (the teacher's real question is "what do I need to mark?" not "what do I need to mark in this specific unit?"), with per-unit filtering.

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
