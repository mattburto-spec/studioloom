# StudioLoom Grading & Assessment Ecosystem
*Spec written 24 March 2026*

## The Problem

Grading in StudioLoom isn't just a page — it's a workflow that touches every part of the platform. A teacher's grading journey starts the moment a student submits work and doesn't end until a report lands in a parent's inbox. Right now the grading page exists (1,311 lines, migration 019, functional) but it's an island — disconnected from evidence collection, AI assistance, integrity data, reporting, and the student experience.

This spec designs the full ecosystem so that every piece is built with awareness of how it connects to everything else. The goal: **world's best criterion-based assessment workflow** that makes a teacher's grading life dramatically faster and better, not just digital instead of paper.

---

## What Already Exists

| Component | Status | Location |
|-----------|--------|----------|
| Grading page (3-column, per-student, criterion scores 1-8, tags, targets, moderation, evidence panel) | ✅ Built, untested | `/teacher/classes/[classId]/grading/[unitId]` |
| AssessmentRecord type (criterion scores, tags, targets, moderation, strengths/areas) | ✅ Built | `src/types/assessment.ts` |
| assessment_records table (JSONB data, RLS, indexes) | ✅ Migration 019 applied | `supabase/migrations/019_assessments.sql` |
| Assessments API (GET class+unit, PUT upsert) | ✅ Built | `/api/teacher/assessments` |
| GRADING_SCALES (IB MYP 1-8, GCSE 0-100%, ACARA A-E) | ✅ Built | `src/lib/constants.ts` |
| Progress page grading status badges (Draft/Published) | ✅ Built | Progress page loads assessment status |
| ClassPerformanceSummary type | ✅ Type only | `src/types/assessment.ts` — not computed anywhere |
| StudentLearningProfile type | ✅ Type only | `src/types/assessment.ts` — not wired to UI |
| MonitoredTextarea + IntegrityReport | ✅ Built, unwired | Not connected to student responses |
| Exemplar upload category in Knowledge Base | ✅ Category exists | No special metadata, no retrieval during grading |

---

## Design Principles

### 1. Best-Fit, Not Average
IB MYP uses criterion-referenced assessment with a best-fit approach. A student's score on Criterion A isn't the average of all their Criterion A work — it's the teacher's professional judgment of where the student sits on the 1-8 scale, considering all evidence. The system must support this by showing all evidence together and letting the teacher make a holistic judgment, not by computing an average.

### 2. Evidence Before Judgment
Teachers shouldn't be asked to score a criterion until there's enough evidence. The system should collect evidence passively (student responses, uploads, toolkit outputs, portfolio entries) and present it at grading time. Minimum 2-3 pieces of evidence per criterion before allowing a final score.

### 3. AI Accelerates, Never Replaces
AI can suggest a score range, generate draft feedback, group similar responses, and flag inconsistencies. But every AI suggestion must be reviewed by a human before it reaches a student. The teacher's professional judgment is always the final word.

### 4. Grading Is Formative AND Summative
Formative assessment (ongoing check-ins, feedback, progress tracking) feeds into summative assessment (end-of-unit criterion scores). They're not separate systems — they're two views of the same data. A quick "checkpoint grade" during a unit should flow into the final assessment view.

### 5. Process Over Product
Design education values the journey. A student who documents 5 failed prototypes and explains what they learned demonstrates more Criterion C understanding than a student who submits a perfect final product with no process documentation. The evidence panel must surface process work (drafts, iterations, reflections) not just final submissions.

### 6. Reports Are the Output, Not an Afterthought
The entire grading workflow should be designed backward from the report. What does the parent need to see? What does the student need to hear? What does the IB moderator need to verify? Build the data model to support these outputs from day one.

---

## The Full Ecosystem Map

```
Evidence Collection (passive, throughout unit)
  │
  ├── Student responses (text, uploads, canvas, toolkit tools)
  ├── Integrity metadata (MonitoredTextarea signals)
  ├── Portfolio entries (auto-captured)
  ├── Toolkit tool sessions (SCAMPER ideas, Decision Matrix scores, etc.)
  ├── Pace feedback (timing data)
  ├── NM competency self-assessments
  └── Open Studio session logs + reflections
        │
        ▼
Evidence Dashboard (teacher sees all evidence per student per criterion)
        │
        ▼
Formative Checkpoints (quick mid-unit scores, optional)
  │
  ├── Checkpoint grade on specific pages (teacher scores 1 criterion quickly)
  ├── AI draft feedback per checkpoint
  └── Student sees feedback + "Where am I?" indicator
        │
        ▼
Summative Assessment (end-of-unit grading)
  │
  ├── Grading Page (existing 3-column layout, enhanced)
  │     ├── Evidence aggregation per criterion
  │     ├── Criterion descriptors sidebar (IB rubric text)
  │     ├── AI pre-score suggestion (with confidence + evidence citations)
  │     ├── AI feedback draft (per criterion, rubric-aligned)
  │     ├── Integrity report inline (writing behavior data)
  │     ├── Best-fit judgment (teacher selects level + writes justification)
  │     ├── Tags + targets + strengths/areas
  │     └── Save as Draft → Publish (finalise)
  │
  ├── Batch Mode (grade all students for one criterion at a time)
  │     ├── AI groups similar responses
  │     ├── Grade one, apply to cluster
  │     └── Review outliers individually
  │
  └── Grade Boundary Auto-Calculation
        ├── Sum 4 criteria (max 32) → IB 1-7 grade boundary
        └── Display with "On track for Grade X" projection
              │
              ▼
Moderation (multi-teacher consistency)
  │
  ├── Same-unit cross-teacher comparison
  ├── Blind scoring (teacher doesn't see peer's score first)
  ├── Disagreement flagging (>2 level spread)
  └── Calibration conversation log
        │
        ▼
Reporting (multiple audiences)
  │
  ├── Student Report Card (criterion trajectories, strengths, next steps)
  ├── Parent Report (overall grade, criterion scores, plain-English descriptors, growth)
  ├── Teacher Summary (ClassPerformanceSummary — averages, distributions, gaps)
  ├── IB Moderator View (evidence + scores + justification, exportable)
  └── Export (PDF, CSV, ManageBac grade push)
```

---

## Entry Points: How Teachers Access Grading

Grading shouldn't live behind 4 clicks. Teachers need to get to it from wherever they are.

| Context | Entry Point | What Opens |
|---------|-------------|------------|
| **Teacher Dashboard** | "Grade" button on unit row (alongside Teach/Manage/Edit) | Grading page for that unit + first assigned class |
| **Manage Class page** | "Grade" tab | Grading page scoped to that class + unit |
| **Teaching Mode** | "Quick Grade" on student card (during class) | Lightweight modal — one criterion, one student, 10-second interaction |
| **Progress page** | "Grade" column per student + "Grade All" button at top | Grading page with that student pre-selected |
| **Student detail page** | Criterion score cards with "Update" button | Grading page with that student pre-selected |
| **After "Publish" on grading page** | "Generate Reports" CTA | Report generation flow |

### Quick Grade (from Teaching Mode)
During a live class, the teacher watches a student present their prototype. They want to record a quick Criterion C score right now, not after class. The "Quick Grade" button on the student card in Teaching Mode opens a small modal:
- Criterion selector (A/B/C/D pills)
- Level picker (1-8 buttons)
- One-line note field
- Save (stores as formative checkpoint, feeds into evidence for summative)

This is a **formative checkpoint**, not a final grade. It appears in the evidence aggregation when the teacher does the full summative assessment later.

---

## Phase 0: Test & Fix What Exists (~1-2 days)

Before building anything new, verify the existing grading page works:

1. **Load test:** Open `/teacher/classes/[classId]/grading/[unitId]` with a unit that has student responses. Does the student list populate? Do criterion sections render?
2. **Score entry test:** Select a student, enter scores for all 4 criteria, add comments, tags, and targets. Click "Save Draft." Reload. Are scores preserved?
3. **Publish test:** Click "Publish" on a saved draft. Does `is_draft` flip to false? Does the progress page show "✓ Graded"?
4. **Evidence panel test:** Click "View Evidence" on a criterion. Does it load the student's responses for relevant pages?
5. **Forked content test:** Open grading for a class with forked content. Does the page correctly resolve which pages to show as evidence (class-local content, not master)?
6. **Class-students junction test:** Does the student list use the `class_students` junction table (migration 041) or the old `students.class_id` FK? If old FK, student list may be wrong for multi-class students.
7. **Scale test:** If using GCSE or ACARA scale (not just IB MYP), do the level pickers render correctly?

**Fix anything broken before proceeding.**

---

## Phase 1: Evidence & Rubric Foundation (~5-7 days)

### 1A. Criterion Descriptors Sidebar
**What:** Show the IB MYP criterion descriptor text alongside the scoring UI so the teacher doesn't need a separate document open.

- Collapsible sidebar (or right panel) showing the full descriptor bands for the criterion being scored
- Highlight the band matching the teacher's current selection (e.g., if teacher selects Level 6, highlight the 5-6 band)
- Descriptor text sourced from `CurriculumFramework` type (already built in `curriculum.ts`)
- Framework-adaptive: IB MYP shows bands, GCSE shows mark scheme, ACARA shows achievement standard

**Data:** `src/types/curriculum.ts` already has `CriterionDefinition` with descriptor text. Wire it into the grading page.

### 1B. Evidence Aggregation Panel
**What:** Replace the current "View Evidence" per-page approach with a unified evidence view per criterion.

- When teacher clicks a criterion (A/B/C/D), show ALL evidence for that student on that criterion:
  - Student responses from pages tagged with that criterion
  - Uploaded files (images, PDFs, videos) from those pages
  - Toolkit tool sessions (if a SCAMPER session was on a Criterion B page, show it)
  - Quick Capture entries tagged to that criterion's pages
  - Formative checkpoint scores (from Quick Grade or earlier assessments)
- Evidence items shown as cards with: thumbnail/preview, page title, submission date, time spent
- Sorted reverse-chronological (most recent first)
- Click to expand any evidence card to full view

**Data change:** Need to map pages → criteria. The unit's `content_data` already has `criterionTags` on each page. The evidence panel reads `student_progress` for all pages where `criterionTags` includes the selected criterion.

### 1C. Evidence Count Enforcement
**What:** Soft warning when a criterion has fewer than 2 pieces of evidence.

- Amber warning badge: "Only 1 piece of evidence for Criterion A — consider assigning more tasks before finalising"
- Does NOT block scoring (teacher may have valid reasons for fewer evidence points)
- Count displayed on each criterion tab: "A (4)" "B (2)" "C (5)" "D (1 ⚠️)"

### 1D. Progress Trajectory Chart
**What:** Per-student, per-criterion mini line chart showing score history over time.

- X-axis: assessment dates (formative checkpoints + summative)
- Y-axis: levels 1-8
- One line per criterion, color-coded (indigo/emerald/amber/violet matching CRITERIA colors)
- Shown at top of grading form when student is selected
- Shows growth trajectory: "Started at 3 in September, now consistently 6"
- Helps teacher make best-fit judgment (recent performance may matter more than early scores)

**Data:** Requires storing formative checkpoint scores. New table `formative_assessments` or extend `assessment_records` with an `assessment_type` field ("formative" | "summative"). Formative records are lightweight: student_id, unit_id, criterion_key, level, page_id, note, created_at.

### 1E. Grade Boundary Auto-Calculation
**What:** When all 4 criteria have scores, auto-calculate the IB 1-7 overall grade.

- Sum of 4 criterion scores (max 32)
- Apply IB MYP grade boundaries: 1 (1-5), 2 (6-9), 3 (10-14), 4 (15-18), 5 (19-23), 6 (24-27), 7 (28-32)
- Display prominently: "Overall: Grade 5 (21/32)"
- Non-editable (derived from criterion scores, not manual override)
- GCSE/ACARA: different rollup logic per framework (percentage average, letter grade mapping)

---

## Phase 2: AI-Assisted Grading (~6-8 days)

### 2A. Integrity Data Inline
**What:** Wire MonitoredTextarea into student responses and show integrity signals during grading.

**Pre-requisite:** Wire MonitoredTextarea into ResponseInput (Tier 1 action from audit — ~2 hours).

- During grading, each text response shows a small integrity indicator: 🟢 High confidence / 🟡 Review / 🔴 Flagged
- Click to expand IntegrityReport (writing playback, paste log, typing speed, focus loss)
- Teacher can factor integrity data into their assessment judgment
- Integrity data stored in `student_progress.responses` JSONB alongside the response text

### 2B. AI Pre-Score Suggestion
**What:** AI reads the student's evidence for a criterion and suggests a level with reasoning.

- Button: "AI Suggest" next to each criterion's level picker
- AI receives: criterion descriptors (all 8 levels), student's evidence (all responses for that criterion's pages), any exemplars at adjacent levels
- AI returns: `{ suggested_level: 6, confidence: "medium", reasoning: "Student demonstrates strong analysis of user needs (Level 6 descriptor: 'explains and justifies the need for a solution') but evaluation of sources is surface-level (closer to Level 5 descriptor). Best fit: 6.", evidence_citations: [{ page_id, quote }] }`
- Teacher sees suggestion as a highlighted button (e.g., Level 6 glows) with reasoning in a tooltip/popover
- Teacher can accept (one click), adjust (click different level), or dismiss
- **Cost control:** Haiku 4.5 for pre-scoring (~300 tokens response, ~$0.001 per student per criterion). Full class of 25 × 4 criteria = ~$0.10 per unit.

**Exemplar dependency:** Pre-scoring is 60% accurate without exemplars, 80% with exemplars. Show confidence accordingly. If no exemplars uploaded for this criterion, show: "No exemplars available — suggestion is based on rubric descriptors only (lower confidence)."

### 2C. AI Feedback Draft
**What:** AI generates per-criterion feedback text that the teacher can edit and send to the student.

- Button: "Draft Feedback" on each criterion section
- AI receives: criterion, level, descriptor at that level, student's evidence, teacher's tags
- AI returns: 60-80 word feedback that:
  - Names what the student did well (cites specific evidence)
  - Identifies the gap between current level and next level up
  - Gives one actionable next step
  - Uses student-appropriate language (not teacher-speak)
- Appears in an editable textarea — teacher reviews, edits if needed, saves
- Feedback stored in `AssessmentRecord.criterion_scores[x].comment`

**Tone rules:**
- Levels 1-3: encouraging + specific ("You've made a start on... Next, try...")
- Levels 4-5: balanced ("You're showing solid... To reach the next level, focus on...")
- Levels 6-8: challenging ("Strong work on... To push further, consider...")

### 2D. Batch Grading Mode
**What:** Grade all students for one criterion at a time (instead of one student at a time).

- Toggle: "Grade by Student" (current default) ↔ "Grade by Criterion"
- In criterion mode:
  - Teacher selects Criterion A
  - System shows a list of all students with their Criterion A evidence side by side
  - AI optionally groups similar responses into clusters
  - Teacher can "Apply Level X to selected students" (multi-select checkboxes)
  - Outliers (AI flags students whose work doesn't fit any cluster) shown separately for individual review
- Best for: short-answer responses, structured tasks. Less useful for open-ended design portfolios.

---

## Phase 3: Formative Assessment Integration (~4-5 days)

### 3A. Formative Checkpoint API
**What:** Lightweight scoring during a unit (not just at the end).

- New table: `formative_checkpoints` (student_id, unit_id, class_id, criterion_key, level, page_id, note, teacher_id, created_at)
- API: POST to create, GET to retrieve per student per unit
- Feeds into evidence aggregation (Phase 1B) and trajectory chart (Phase 1D)

### 3B. Quick Grade Modal (Teaching Mode)
**What:** Score one criterion for one student in 10 seconds during class.

- Accessible from: student card in Teaching Mode, progress page per-student row
- Modal contents: student name, criterion pills (A/B/C/D), level buttons (1-8), note field, save
- Saves as formative checkpoint (not summative)
- Toast confirmation: "Criterion B: Level 5 saved for [Student]"

### 3C. Student "Where Am I?" Indicator
**What:** Students see their current criterion trajectory (without seeing the final grade before it's published).

- On student dashboard or unit progress view: 4 criterion cards showing latest formative score
- Phrased as growth language, not raw numbers: "Criterion A: You're developing strong analysis skills" (maps to Level 5-6 range)
- Only shows formative data — summative scores hidden until teacher publishes
- Teacher controls visibility toggle (some teachers may not want students seeing formative scores)

---

## Phase 4: Moderation (~4-5 days)

### 4A. Cross-Teacher Comparison Dashboard
**What:** When multiple teachers teach the same unit, show scoring patterns side by side.

- Accessible from: unit detail page (where "Assigned Classes" are shown)
- Shows: per-criterion average score per teacher's class, distribution chart (how many students at each level)
- Flags: if one teacher's Criterion B average is 6.2 and another's is 4.1, highlight the gap
- Does NOT auto-adjust — just surfaces the data for professional conversation

### 4B. Blind Moderation Workflow
**What:** Two teachers independently grade the same student work sample, then compare.

- Teacher A selects 3-5 student work samples from their class
- Teacher B receives the samples without seeing Teacher A's scores
- Teacher B grades them independently
- System shows side-by-side: Teacher A's scores vs Teacher B's scores per criterion
- Disagreements (>1 level difference) highlighted for discussion
- Resolution: teachers agree on a moderated score, stored with `moderation_status: "moderated"`

### 4C. Moderation History
**What:** Audit trail of all moderation activities.

- Who moderated, when, original vs moderated scores
- Exportable for IB quality assurance requirements
- Stored in assessment_records JSONB (`moderation_history` array)

---

## Phase 5: Reporting (~5-7 days)

### 5A. Student Report Card
**What:** Per-student, per-unit report showing achievement and growth.

- **Header:** Student name, unit title, class, date range
- **Criterion Section (×4):**
  - Criterion name + final level (1-8) with colored badge
  - Descriptor text for that level (what "Level 6" means in plain English)
  - Teacher comment (from grading)
  - Trajectory mini-chart (formative → summative scores over time)
  - "Next Steps" (from targets in assessment record)
- **Overall:** Grade (1-7) with boundary calculation shown
- **Strengths & Areas for Growth:** From teacher's assessment record
- **Process Documentation Score:** How well the student documented their design process (based on portfolio completeness)
- **Export:** PDF (styled, printable) + in-app view

### 5B. Parent Report
**What:** Simplified report for parent audience.

- **Header:** School logo (if available), student name, subject, unit, reporting period
- **Overall Grade:** Large, prominent (1-7 with descriptor: "Grade 5: Proficient")
- **Criterion Breakdown:** 4 rows showing criterion name, score, one-line descriptor, one-line comment
- **Growth Summary:** "Compared to the start of this unit, [Student] has improved most in [Criterion X]"
- **Next Steps:** 2-3 actionable items the parent can understand
- **No:** percentile rankings, class averages, integrity data, raw response text
- **Export:** PDF matching school report template format

### 5C. Class Performance Summary
**What:** Teacher-facing analytics for the whole class on a unit.

- **ClassPerformanceSummary** type already exists — compute it from assessment_records
- Per-criterion: average, median, distribution chart (histogram of levels 1-8), range
- Common strengths (most-used positive tags across class)
- Common gaps (most-used negative tags)
- "Students needing attention" list: anyone scoring ≤3 on any criterion
- Feeds into next unit's AI generation: "Last unit, this class struggled with Criterion B (avg 4.2) — emphasize idea development"

### 5D. Bulk Report Generation
**What:** Generate all student reports for a class in one action.

- "Generate Reports" button on grading page (appears after all students published)
- AI generates the "Growth Summary" and "Next Steps" narrative per student (~50 words each)
- Teacher reviews all reports in a scrollable list, edits any, then exports
- Export options: individual PDFs, combined PDF (one per page), CSV (for ManageBac import)

### 5E. ManageBac Grade Push (future)
**What:** Push criterion scores directly to ManageBac gradebook via API.

- ManageBac has a REST API for grade entry
- Map: StudioLoom criterion A-D → ManageBac criterion A-D, levels 1-8
- One-click sync after publishing
- Requires ManageBac API key (teacher enters in settings)

---

## Phase 6: Exemplar System (~3-4 days)

### 6A. Exemplar Upload with Achievement Metadata
**What:** When uploading student exemplars to Knowledge Base, capture scoring metadata.

- Extended upload form: criterion (A/B/C/D), achievement level (1-8), year/grade, teacher annotation
- Stored as metadata on knowledge chunks (not just raw text)
- Exemplars indexed by criterion + level for retrieval during grading

### 6B. Exemplar Retrieval During Grading
**What:** When grading Criterion A, show "Here's what Level 5 and Level 7 look like."

- Adjacent-level retrieval: if teacher is considering Level 6, show exemplars at Level 5 and Level 7
- Displayed in a collapsible "Exemplar Reference" section below the scoring UI
- Teacher can toggle on/off (not everyone wants to see exemplars every time)

### 6C. AI Learns from Graded Submissions
**What:** After enough graded data accumulates, AI calibrates its pre-score suggestions.

- After ~50 graded responses per criterion per grade level, AI uses the teacher's past scoring as calibration data
- Pre-score suggestions improve from 60% → 80% accuracy
- Teacher sees confidence indicator: "Based on rubric only" vs "Based on rubric + 73 past assessments"
- Privacy: student work used for calibration is anonymised within the AI prompt

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` / `2` / `3` / `4` | Select Criterion A / B / C / D |
| `↑` / `↓` | Increase / decrease level for selected criterion |
| `Enter` | Save and move to next student |
| `Shift+Enter` | Save and stay on current student |
| `E` | Toggle evidence panel |
| `F` | Generate AI feedback draft for selected criterion |
| `S` | AI suggest score for selected criterion |
| `N` | Add note/comment to selected criterion |
| `?` | Show shortcuts cheat sheet |

---

## Build Order (Total: ~30-35 days across 6 phases)

| Phase | Days | What | Depends On |
|-------|------|------|------------|
| **0** | 1-2 | Test existing grading page, fix bugs | Nothing |
| **1** | 5-7 | Evidence panel, descriptors sidebar, trajectory chart, grade boundaries | Phase 0 passing |
| **2** | 6-8 | Integrity wiring, AI pre-score, AI feedback draft, batch mode | Phase 1 (evidence panel), MonitoredTextarea wiring |
| **3** | 4-5 | Formative checkpoints, Quick Grade modal, student "Where Am I?" | Phase 1 (trajectory chart needs formative data) |
| **4** | 4-5 | Cross-teacher comparison, blind moderation, moderation history | Phase 1 (needs published scores to compare) |
| **5** | 5-7 | Student/parent/class reports, bulk generation, export | Phase 1 + 2 (needs scores + AI feedback) |
| **6** | 3-4 | Exemplar upload metadata, retrieval during grading, AI calibration | Phase 2 (AI pre-score), Knowledge Base |

**Critical path:** Phase 0 → 1 → 2 → 5 (test → evidence → AI → reports). Phases 3, 4, 6 can be done in parallel after Phase 1.

**What to build first for maximum impact:**
1. Phase 0 (test) — eliminates uncertainty about foundation
2. Phase 1B (evidence panel) — transforms grading from "guess" to "informed judgment"
3. Phase 2C (AI feedback draft) — single biggest time-saver for teachers
4. Phase 5A+5B (reports) — this is what parents and admin actually see

---

## Data Model Changes

### New: `formative_checkpoints` table
```sql
CREATE TABLE formative_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL,  -- "A", "B", "C", "D"
  level SMALLINT NOT NULL,      -- 1-8
  page_id TEXT,                 -- which page this was observed on (nullable)
  note TEXT,                    -- optional teacher note
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_level CHECK (level >= 1 AND level <= 8)
);
```

### Extended: `assessment_records.data` JSONB
Add to AssessmentRecord type:
- `feedback_published_at`: timestamp when feedback was released to student
- `ai_suggestions`: `{ criterion_key, suggested_level, confidence, reasoning }[]` — audit trail of AI suggestions
- `moderation_history`: `{ moderated_by, original_level, moderated_level, criterion_key, timestamp, note }[]`
- `report_generated_at`: timestamp of last report generation

### Extended: `student_progress.responses` JSONB
Add integrity metadata field per response:
- `integrityMetadata`: `{ humanConfidenceScore, level, flags, pasteCount, typingSpeed, focusLosses }`

---

## How This Connects to Everything Else

| System | Connection to Grading |
|--------|----------------------|
| **Student responses** | Evidence source. Every response is potential criterion evidence. |
| **MonitoredTextarea** | Integrity signals shown during grading. Teacher sees writing behavior. |
| **Toolkit tools** | Toolkit session outputs (SCAMPER ideas, Decision Matrix) are evidence for criteria. |
| **Open Studio** | Session reflections + productivity scores feed into process assessment. |
| **NM / Melbourne Metrics** | Competency self-assessments shown alongside criterion scores. Not the same thing (NM = metacognitive, criteria = subject-specific) but complementary. |
| **Teaching Mode** | Quick Grade modal for formative checkpoints during class. |
| **Knowledge Base** | Exemplar uploads with achievement metadata retrieved during grading. |
| **Unit Forking** | Grading page must resolve class-local content (which pages belong to this class's version). |
| **Student Dashboard** | "Where Am I?" trajectory cards. Published feedback shown in portfolio. |
| **Reporting** | Student + parent reports generated from assessment data. |
| **AI Generation** | ClassPerformanceSummary feeds next unit's generation ("this class struggles with Criterion B"). |
| **Pace Feedback** | Timing data on progress page, not directly in grading, but informs lesson pacing. |
| **Safety Badges** | Independent system. Not graded. |

---

## What This Replaces in the Roadmap

This spec supersedes:
- "Phase 0 Grading MVP" (already built — just needs testing)
- "Teacher Marking & Grading Assistance" (Phase 4 in roadmap — covered by Phases 2-4 here)
- "Exemplar-Aware Grading & AI Learning" (covered by Phase 6 here)
- "Report Generation" (covered by Phase 5 here)

This spec does NOT cover:
- Peer review / Class Gallery (separate spec at `docs/specs/class-gallery-peer-review.md`)
- AI Insights Dashboard (separate feature — uses ClassPerformanceSummary data)
- Turnitin integration (deferred — MonitoredTextarea provides in-house integrity monitoring)
