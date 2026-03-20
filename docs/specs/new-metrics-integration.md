# New Metrics (Melbourne Metrics) Integration Spec

*Created: 20 March 2026*
*Status: Phase 1 — Trial-Ready Build*
*Author: Matt Burton + Claude*

## Overview

New Metrics (NM) is the University of Melbourne's competency assessment framework. It defines 7 competencies, each with 5 progression levels and 12 foundational elements. StudioLoom integrates NM as a **parallel assessment layer** alongside existing MYP criterion grading — it does not replace or compete with criterion scores.

### Key Framework Facts
- **7 competencies:** Agency in Learning (foundational), Acting Ethically, Active Citizenship, Communication, Collaboration, Quality Thinking, Personal Development
- **5 progression levels per competency:** 1 (Directed Learner) → 2 (Diligent) → 3 (Self-Regulated) → 4 (Extended) → 5 (Unbound)
- **3 year bands:** K-4, 5-8, 9-12 (StudioLoom targets Years 5-8 and 9-12)
- **12 elements of Agency in Learning:** Acting with Autonomy, Acting with Courage, Being Open to the New, Being Reflective, Building Social Alliances, Demonstrating Drive, Developing Skill or Craft, Engaging in Dialogue, Generating Feedback Loops, Managing Ambiguity or Uncertainty, Striving for Mastery, Using Reason
- **Assessment frequency:** 1-2 times per year per competency (micro-judgements over time, not every lesson)
- **Assessment sources:** Teacher observation (micro-judgements via Ruby platform) + Student self-reflection

### Core Design Principle

NM assessment is **observational and longitudinal** — watch the learner over time across contexts. Data collection moments must be intentionally placed, not sprinkled on every activity. The teacher decides which unit activities naturally surface observable competency behaviors.

---

## Architecture: Two Instruments, One Data Pipeline

### Instrument 1: Student Competency Pulse (student-facing)

**Purpose:** Quick self-reflection at teacher-configured checkpoints within a unit.

**When it appears:** After the student submits their work on a page that the teacher has tagged as an NM checkpoint. Appears inline below submitted work — not a popup.

**UX Flow:**
1. Student completes and submits activity on a tagged page
2. A card slides in below the submission: "Quick reflection"
3. For each element the teacher selected (2-3 max per checkpoint):
   - Element name + plain-English description
   - 3-point self-placement: "This was hard for me" / "I'm getting there" / "I did this well"
4. One optional open comment: "What's one thing you noticed about yourself as a learner?"
5. Submit → done (20-30 seconds)

**Why 3-point not 5-point:** The 5 NM levels are teacher judgements over a year. A 3-point scale captures direction (struggling / developing / confident) for triangulation against teacher observations. Level mapping happens on the backend.

**Why element-level not competency-level:** Elements are building blocks. A student may be strong on "Demonstrating Drive" but weak on "Managing Ambiguity." Element-level granularity makes data actionable.

### Instrument 2: Teacher Observation Snap (teacher-facing)

**Purpose:** Quick structured observation capture with minimal friction.

**Access points:**
1. **Unit progress page** — "Record Observation" button next to each student
2. **Teaching Mode** (Phase 2) — tap student in live grid → observation panel slides out

**UX Flow:**
1. Select student (pre-filled if accessed from student row)
2. Competency defaults to the one configured for this unit (e.g., Agency in Learning)
3. 2-4 element sliders appear (matching the unit's configured elements)
4. Each slider: element name + 4-point scale (Emerging → Developing → Applying → Extending)
5. Optional comment per element for evidence: "What did you observe?"
6. One-tap submit (under 60 seconds per student)

**Why 4-point for teacher but 3-point for student:** Teachers are trained assessors using professional judgement with framework language. Students are doing self-reflection. Different instruments, different granularity, same data pipeline.

---

## Configuration: Teacher Setup

Located on the **unit detail page** as a new "New Metrics" section:

- **Toggle:** NM tracking on/off for this unit (off by default)
- **Competency selector:** Which competency to track (defaults to Agency in Learning, supports multiple but start with one for trial)
- **Element picker:** Checkboxes for 2-4 elements most relevant to this unit's activities. Shows plain-English definitions from the NM kit.
- **Checkpoint placer:** List of unit pages/activities. Teacher taps to toggle which ones get a student self-assessment. Badge appears on tagged pages showing "NM checkpoint."

Setup time: ~2 minutes during unit planning.

---

## Data Model

### New Table: `competency_assessments`

```sql
CREATE TABLE competency_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  unit_id UUID NOT NULL REFERENCES units(id),
  page_id UUID REFERENCES unit_pages(id),  -- nullable for teacher obs not tied to a page
  competency TEXT NOT NULL,  -- e.g., 'agency_in_learning'
  element TEXT NOT NULL,     -- e.g., 'acting_with_autonomy'
  source TEXT NOT NULL CHECK (source IN ('student_self', 'teacher_observation')),
  rating INTEGER NOT NULL,   -- 1-3 for student, 1-4 for teacher
  comment TEXT,
  context JSONB DEFAULT '{}',  -- lesson name, activity type, design phase
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_competency_assessments_student ON competency_assessments(student_id);
CREATE INDEX idx_competency_assessments_unit ON competency_assessments(unit_id);
CREATE INDEX idx_competency_assessments_source ON competency_assessments(source);

-- RLS
ALTER TABLE competency_assessments ENABLE ROW LEVEL SECURITY;
```

### Unit NM Config (JSONB column on units table)

```sql
ALTER TABLE units ADD COLUMN nm_config JSONB DEFAULT NULL;
```

Shape:
```json
{
  "enabled": true,
  "competencies": ["agency_in_learning"],
  "elements": ["acting_with_autonomy", "being_reflective", "demonstrating_drive"],
  "checkpoints": {
    "page-uuid-1": { "elements": ["acting_with_autonomy", "being_reflective"] },
    "page-uuid-3": { "elements": ["demonstrating_drive", "being_reflective"] }
  }
}
```

---

## NM Reference Data

### Competencies
| ID | Name |
|----|------|
| `agency_in_learning` | Agency in Learning |
| `acting_ethically` | Acting Ethically |
| `active_citizenship` | Active Citizenship |
| `communication` | Communication |
| `collaboration` | Collaboration |
| `quality_thinking` | Quality Thinking |
| `personal_development` | Personal Development |

### Elements of Agency in Learning
| ID | Name | Definition |
|----|------|-----------|
| `acting_with_autonomy` | Acting with Autonomy | The ability to govern one's own actions |
| `acting_with_courage` | Acting with Courage | The ability to act in the pursuit of a worthwhile goal in the face of adversity |
| `being_open_to_the_new` | Being Open to the New | The ability to embrace or harness new ideas, experiences and ways of doing things |
| `being_reflective` | Being Reflective | The ability to evaluate and learn from experience |
| `building_social_alliances` | Building Social Alliances | The ability to build social networks or groups to learn, grow or achieve a purpose |
| `demonstrating_drive` | Demonstrating Drive | The ability to propel the pursuit of social, personal or community ambitions |
| `developing_skill_or_craft` | Developing Skill or Craft | The ability to hone, sharpen, polish or improve skill or craft |
| `engaging_in_dialogue` | Engaging in Dialogue | The ability to engage in dialogue to connect to others, explore, negotiate meaning, or develop new perspectives |
| `generating_feedback_loops` | Generating Feedback Loops | The ability to generate and use feedback for improved performance |
| `managing_ambiguity_or_uncertainty` | Managing Ambiguity or Uncertainty | The ability to operate in the face of things that are unknown, uncertain, or undecidable |
| `striving_for_mastery` | Striving for Mastery | The ability to develop deep expertise in a field or domain |
| `using_reason` | Using Reason | The ability to use thinking skills to explain, argue, analyse or evaluate |

### Student-Facing Descriptions (Plain English)
| Element | Student sees |
|---------|-------------|
| Acting with Autonomy | Making your own choices about how to learn |
| Acting with Courage | Trying things even when they feel risky or uncomfortable |
| Being Open to the New | Being willing to try new ideas and approaches |
| Being Reflective | Thinking about what worked and what didn't |
| Building Social Alliances | Working with others to learn and grow |
| Demonstrating Drive | Pushing yourself to do your best work |
| Developing Skill or Craft | Getting better at making and designing things |
| Engaging in Dialogue | Talking with others to share and develop ideas |
| Generating Feedback Loops | Seeking and using feedback to improve |
| Managing Ambiguity or Uncertainty | Staying comfortable when things are unclear |
| Striving for Mastery | Going deep into a topic or skill |
| Using Reason | Using evidence and logic to make decisions |

### Broad Development Levels (for Teacher Slider Labels)
| Level | Label | Description |
|-------|-------|-------------|
| 1 | Emerging | Responds to structure and guidance |
| 2 | Developing | Engages with support and encouragement |
| 3 | Applying | Independently applies the element |
| 4 | Extending | Initiates, leads, and goes beyond |

### Student Self-Rating Scale
| Value | Label | Internal Mapping |
|-------|-------|-----------------|
| 1 | This was hard for me | Lower range |
| 2 | I'm getting there | Mid range |
| 3 | I did this well | Upper range |

---

## API Routes

### `POST /api/teacher/nm-config` — Save unit NM configuration
- Auth: Teacher (Supabase Auth)
- Body: `{ unitId, enabled, competencies, elements, checkpoints }`
- Updates `units.nm_config` JSONB column

### `GET /api/student/nm-checkpoint/[pageId]` — Get checkpoint config for a page
- Auth: Student token
- Returns: elements to assess + student-facing descriptions, or null if no checkpoint

### `POST /api/student/nm-assessment` — Submit student self-assessment
- Auth: Student token
- Body: `{ unitId, pageId, assessments: [{ element, rating, comment? }] }`
- Rate limited: 10/min per student

### `POST /api/teacher/nm-observation` — Submit teacher observation
- Auth: Teacher (Supabase Auth)
- Body: `{ studentId, unitId, pageId?, assessments: [{ element, rating, comment? }] }`

### `GET /api/teacher/nm-data/[unitId]` — Get all NM data for a unit
- Auth: Teacher (Supabase Auth)
- Returns: all assessments grouped by student, source counts, latest ratings per element

---

## Component Architecture

### Shared: `src/lib/nm/constants.ts`
- Competency definitions, element definitions, student-facing descriptions
- Rating scale constants
- Helper functions for label lookups

### Student-facing: `src/components/nm/CompetencyPulse.tsx`
- Props: `{ pageId, unitId, elements, onComplete }`
- Inline card below activity submission
- 3-point scale per element + optional comment
- Slide-in animation, auto-dismiss on submit

### Teacher-facing: `src/components/nm/ObservationSnap.tsx`
- Props: `{ studentId, unitId, elements, onComplete }`
- Modal or slide-out panel
- 4-point slider per element + optional comment per element
- Student name header, one-tap submit

### Config: `src/components/nm/NMConfigPanel.tsx`
- Props: `{ unitId, pages, currentConfig, onSave }`
- Toggle, competency selector, element checkboxes, page checkpoint toggles
- Mounted on unit detail page

---

## Build Phases

### Phase 1: Trial-Ready (~3-4 days)
- [x] Spec document (this file)
- [ ] Database migration (competency_assessments table + nm_config column)
- [ ] NM constants file (competencies, elements, descriptions)
- [ ] NMConfigPanel on unit detail page
- [ ] CompetencyPulse on student activity pages
- [ ] ObservationSnap on unit progress page
- [ ] API routes (config, student assessment, teacher observation, data retrieval)
- [ ] Basic data table on unit progress page showing collected assessments

### Phase 2: Teaching Mode Integration (~2 days)
- [ ] ObservationSnap panel in Teaching Mode (tap student → observe)
- [ ] NM observation indicators on live student grid
- [ ] Quick-observation mode (swipe through students)

### Phase 3: Reporting (~3 days)
- [ ] Student Competency Profile page
- [ ] Element radar/bar chart visualization
- [ ] Evidence trail with context (unit, activity, design phase)
- [ ] Student vs Teacher alignment view
- [ ] Export to CSV/PDF for NM reporting

### Phase 4: Intelligence (future)
- [ ] AI suggests observable elements per design activity
- [ ] AI detects competency signals from Design Assistant conversations
- [ ] Auto-populate suggested NM checkpoints during unit creation

---

## Alignment with Existing Systems

### Open Studio
Open Studio naturally surfaces Agency in Learning behaviors. Students who are self-directed in Open Studio are demonstrating Level 4-5 agency. Future: Open Studio session data (drift flags, productivity scores, check-in responses) could feed NM profiles automatically.

### Design Assistant
Student conversations with the AI mentor contain competency signals. A student who pushes back on AI suggestions = Acting with Courage. A student who asks "what do you think?" repeatedly = low Acting with Autonomy. Future: passive signal collection from conversation metadata.

### Portfolio
NM assessment data enriches the portfolio view. Each piece of student work can show both the MYP criterion score AND the NM self-reflection captured at that moment. Over time, the portfolio becomes evidence of both subject achievement and competency growth.

### Teaching Mode
The live student grid in Teaching Mode is the natural place for teacher observations during class. Phase 2 adds observation capabilities directly into the teaching cockpit.

---

## Design Decisions

1. **NM is a parallel layer, not a replacement** — MYP criteria and NM competencies coexist. Different purposes, different timescales.
2. **3-point student scale, 4-point teacher scale** — appropriate to each audience's assessment capability.
3. **Element-level assessment, not competency-level** — granularity makes data actionable for teaching.
4. **Teacher configures checkpoints, not the system** — the teacher knows which activities naturally surface observable behaviors. AI suggestions come in Phase 4.
5. **JSONB config on units table** — lightweight, no new config table needed. Easy to extend.
6. **Student self-assessment is reflection, not grading** — framed as "quick reflection" not "rate yourself." Students shouldn't feel tested.
7. **Start with Agency in Learning only** — it's the foundational competency and the one Matt is trialling. Architecture supports all 7 but UI focuses on one.
8. **Inline card, not popup** — respects the student's flow. The pulse appears after submission as a natural next step, not an interruption.
