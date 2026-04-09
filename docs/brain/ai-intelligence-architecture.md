# StudioLoom AI Intelligence Architecture
**Date:** 18 March 2026 | **Status:** Living document — update as systems evolve
**Owner:** Matt Burton | **Scope:** All AI-powered subsystems across StudioLoom

---

## 1. Source-Aware Knowledge Ingestion

### Problem
The current 3-pass analysis pipeline treats every uploaded document as a lesson plan. A rubric, a safety document, a textbook chapter, and a lesson plan all get the same Structure → Pedagogy → Design Teaching passes. This produces garbage analysis for non-lesson sources — a rubric has no "lesson flow," a safety doc has no "pedagogical approach."

### Solution: Pass 0 — Source Classification

Add a lightweight classification pass **before** the existing 3 passes. This pass determines the document type, which then selects the appropriate analysis pipeline.

```
Upload → Pass 0 (Classification) → Route to pipeline → Store typed profile
```

**Pass 0 runs on Haiku (fast, cheap).** It receives the first ~2000 tokens of extracted text plus the filename and user-selected category. It returns:

```json
{
  "detected_type": "lesson_plan | rubric | safety_doc | textbook_section | scheme_of_work | student_exemplar | reference_image | resource_handout",
  "confidence": 0.92,
  "signals": ["contains learning objectives", "has timed phases", "references criteria A-D"],
  "override_category": null
}
```

If `detected_type` disagrees with the user-selected `source_category`, the system flags it: "You categorised this as a rubric, but it looks like a lesson plan. Which is correct?" This catches mis-categorisation early.

### Analysis Pipelines by Type

| Source Type | Passes | What's Extracted |
|-------------|--------|-----------------|
| **Lesson Plan** | Pass 1 (Structure) → Pass 2 (Pedagogy) → Pass 3 (Design Teaching) | Full `LessonProfile` — current pipeline, no change |
| **Rubric / Assessment** | Pass 1 (Structure) → Pass 2R (Rubric Intelligence) | Criterion descriptors, achievement levels, command verbs, strand breakdown, grade boundaries, what "excellent" looks like per criterion |
| **Safety Document** | Pass 1 (Structure) → Pass 2S (Safety Intelligence) | Equipment list, hazard types, PPE requirements, age restrictions, supervision ratios, risk mitigation steps, emergency procedures |
| **Textbook / Reference** | Pass 1 (Structure) → Pass 2T (Content Intelligence) | Key concepts, vocabulary, difficulty level, prerequisite knowledge, visual assets described, which criteria/topics it supports |
| **Scheme of Work** | Pass 1 (Structure) → Pass 2W (Scope Intelligence) | Unit sequence, term/semester mapping, time allocations, criterion coverage across the year, spiral curriculum patterns |
| **Student Exemplar** | Pass 1 (Structure) → Pass 2E (Exemplar Intelligence) | Achievement level (1-8 for MYP), criterion demonstrated, strengths visible, areas for growth, what makes it this level vs. the one above |
| **Resource / Handout** | Pass 1 (Structure) only | Basic metadata — topic, grade suitability, format, linked criteria. Lightweight. |

### Implementation Priority
1. Add Pass 0 to the upload pipeline (modify `src/lib/knowledge/analyse.ts`)
2. Create rubric-specific prompts (highest value — rubrics are the most mis-analysed)
3. Create exemplar-specific prompts (second highest — feeds into grading)
4. Others can follow iteratively

### Database Changes
- Add `source_type_detected` and `source_type_confidence` columns to `knowledge_uploads`
- Add `analysis_pipeline` column to `lesson_profiles` (or create separate profile tables per type)
- Consider a unified `knowledge_profiles` table with a `profile_type` discriminator and JSONB `profile_data`

---

## 2. Timing Model for Design Classes

### Problem
The current timing system uses hard block limits per MYP year (e.g., "Year 3 max 6 sections, 50 min each"). This is too rigid. Real design classes have:

- **Variable lesson lengths** (40 min theory block vs. 80 min double for workshop)
- **Transition overhead** (5 min for workshop setup, 10 min cleanup, 3 min for device login)
- **Cognitive load curves** (attention peaks at ~15 min, needs break/activity switch)
- **Activity type dependencies** (a 20-min sketch session after a 30-min demo = fine; a 20-min sketch session after 60-min workshop = students are tired)
- **School schedule constraints** (some schools have 45-min periods, others have 80-min blocks)

### Proposed Model: Context-Aware Timing Engine

Replace hard limits with a **timing context** object that the AI consults when generating units:

```typescript
interface TimingContext {
  // School schedule
  periodLength: number;          // minutes per standard period (40-80)
  doublePeriods: boolean;        // does the school timetable doubles?
  periodsPerWeek: number;        // how many design periods per week (2-5)

  // Transition overhead (auto-deducted from usable time)
  setupMinutes: number;          // workshop setup (0 for theory, 5-10 for practical)
  cleanupMinutes: number;        // workshop cleanup (0 for theory, 5-15 for practical)
  transitionMinutes: number;     // device login, settling, attendance (2-5)

  // Cognitive load parameters
  maxSustainedFocusMinutes: number;  // per age group: Y1=12, Y3=18, Y5=22
  activitySwitchAfter: number;       // switch activity type after N minutes

  // Activity-type timing ranges (min-max minutes)
  activityRanges: Record<ActivityType, { min: number; max: number; ideal: number }>;

  // Energy sequencing rules
  heavyCognitiveLoadAfterPhysical: boolean;  // can you do theory after workshop? (usually no)
  endWithReflection: boolean;                // always end with 5-min reflection? (best practice)
}
```

### Activity Type Timing Research

Based on design education research and classroom observation:

| Activity Type | Min | Ideal | Max | Notes |
|--------------|-----|-------|-----|-------|
| **Direct instruction** (demo, lecture) | 5 | 12 | 20 | Attention drops sharply after 15 min for Y1-3 |
| **Guided practice** (follow-along) | 10 | 20 | 30 | Needs chunking with check-ins |
| **Independent making** (workshop) | 15 | 30 | 60 | Can sustain if engaged; needs setup/cleanup |
| **Sketching / ideation** | 5 | 15 | 25 | Quick bursts > long sessions |
| **Critique / gallery walk** | 5 | 10 | 20 | Energy drops if too long |
| **Research / investigation** | 10 | 20 | 30 | Needs structure or students drift |
| **Collaboration / pair work** | 5 | 15 | 25 | Social energy is limited |
| **Reflection / journaling** | 3 | 5 | 10 | Best at end of lesson |
| **Assessment / testing** | 10 | 20 | 40 | Depends on criterion |
| **Vocabulary / warm-up** | 3 | 5 | 8 | Brief, energising |
| **Station rotation** | 20 | 30 | 50 | 3-4 stations × 8-12 min each |

### Cognitive Load Curve by MYP Year

| MYP Year | Age | Max Sustained Focus | Recommended Activity Switch | Theory:Practical Ratio |
|----------|-----|--------------------|-----------------------------|----------------------|
| Year 1 (Grade 6) | 11-12 | 10-12 min | Every 12 min | 30:70 |
| Year 2 (Grade 7) | 12-13 | 12-15 min | Every 15 min | 35:65 |
| Year 3 (Grade 8) | 13-14 | 15-18 min | Every 18 min | 40:60 |
| Year 4 (Grade 9) | 14-15 | 18-22 min | Every 20 min | 40:60 |
| Year 5 (Grade 10) | 15-16 | 20-25 min | Every 22 min | 45:55 |

### Usable Time Formula

```
usableMinutes = periodLength - transitionMinutes - (isWorkshop ? setupMinutes + cleanupMinutes : 0)
```

For a typical Y3 double period (80 min) with workshop:
- 80 - 3 (transition) - 8 (setup) - 10 (cleanup) = **59 usable minutes**
- Not 80. The AI currently generates content for 80 minutes and teachers wonder why it doesn't fit.

### Admin Panel Changes
- Replace the hard "max blocks" number inputs with the `TimingContext` form
- Add school schedule presets: "45-min singles," "60-min singles," "80-min doubles"
- Add a "Workshop overhead" section with setup/cleanup sliders
- The AI uses `TimingContext` when generating units and individual lessons

### Reference Document
Create `docs/timing-reference.md` as the canonical source for all timing values. This feeds into the AI system prompt and the admin panel defaults.

---

## 3. Design Teaching Authority Model

### Problem
There's no single "authority document" that defines what great design teaching looks like. The AI currently has generic pedagogical knowledge from training data, plus the emphasis dials in the admin panel. But it doesn't have deep, opinionated expertise about design-specific teaching — the kind of knowledge a veteran design teacher has built over 15 years.

### Solution: The Design Teaching Corpus

Build a layered knowledge system:

```
Layer 1: Universal Design Pedagogy (built-in, read-only)
    ↓ overridden by
Layer 2: Framework-Specific Rules (IB MYP, GCSE, etc.)
    ↓ overridden by
Layer 3: School/Department Norms (uploaded by admin)
    ↓ overridden by
Layer 4: Individual Teacher Style (learned over time — see §4)
```

**Layer 1: Universal Design Pedagogy** — a curated reference document embedded in the system prompt. Contains:

- The 14 lesson phase types and when to use each (warm-up → vocabulary → introduction → demonstration → guided practice → independent work → making → collaboration → critique → gallery walk → presentation → testing → reflection → cleanup)
- The design cycle as non-linear process (students jump between phases)
- Workshop management principles (noise curves, safety checkpoints, material distribution patterns)
- Critique protocols (warm/cool feedback, I like/I wish/What if, the Austin Butterfly progression)
- The difference between formative and summative assessment in design (process portfolios vs. final products)
- How to scaffold making (demo → guided → independent, with "I do, we do, you do" pattern)
- When to use direct instruction vs. discovery learning in design context
- Gallery walk protocols and when they work vs. when they're a waste of time

**Sources for Layer 1:**
- IB MYP Design Guide (official IB publication) — criterion descriptors, ATL skills, design cycle
- Hattie's Visible Learning — effect sizes for teaching strategies (already referenced in codebase)
- Richard Paul's 6 question types (already referenced)
- Bloom's taxonomy applied to design (already referenced)
- David Perkins "Making Learning Whole" — design is inherently a "whole game" subject
- Ron Berger "An Ethic of Excellence" — critique protocols, beautiful work, Austin's Butterfly
- "Design and Technology in your School" (Beaumont & Steeg, Routledge) — DT-specific pedagogy
- Stanford d.school facilitator guides — workshop structure, timeboxing, diverge/converge rhythms
- IDEO "Design Thinking for Educators" toolkit

**Layer 2: Framework-Specific Rules** — already partially implemented via the `curriculumFramework` setting. Needs expansion:
- IB MYP: criterion descriptors, command verbs, ATL skill integration, global contexts
- GCSE DT: AO weighting, NEA structure, iterative design requirements
- Each framework has different emphasis on process vs. product

**Layer 3: School Norms** — uploaded via the Knowledge Base as "scheme_of_work" or "resource" type. The new source-aware ingestion (§1) would extract department-level preferences.

**Layer 4: Individual Teacher Style** — see §4 below.

### Implementation — DONE (18 March 2026)
Created `docs/design-teaching-corpus.md` as the Layer 1 reference. 10 sections covering: non-linear design cycle, lesson phase types, gradual release, workshop management, Perkins' "whole game," assessment principles, studio culture, differentiation, technology integration.

Wired into generation prompts via `buildDesignTeachingContext()` in `src/lib/ai/prompts.ts` — injected into all 3 generation prompt builders (unit, journey, timeline). 9 key principles distilled into a prompt-sized block.

---

## 4. Per-Teacher Style Learning

### Problem
Currently, every teacher gets the same AI output modulated only by the global admin dials. But teachers have wildly different styles — one teacher does 60% workshop time and short punchy theory; another does deep Socratic questioning with minimal making; a third runs everything as station rotations. The AI should learn each teacher's style and adapt.

### Solution: Teacher Style Profiles

Each teacher accumulates a `TeacherStyleProfile` over time, built from their actual usage:

```typescript
interface TeacherStyleProfile {
  teacherId: string;

  // Accumulated from units they've created/edited
  preferredLessonStructure: {
    typicalPhaseSequence: string[];     // e.g. ["warm_up", "demo", "independent_work", "critique", "reflection"]
    averageTheoryPracticalRatio: number; // 0.0 - 1.0
    typicalLessonLength: number;
    prefersDoublePeriodsFor: string[];   // ["making", "testing"]
  };

  // Accumulated from edits they make to AI-generated content
  editPatterns: {
    frequentlyDeletedSections: string[];  // sections they always remove → don't generate these
    frequentlyAddedElements: string[];    // things they always add → include by default
    vocabularyLevel: "simplified" | "standard" | "advanced";  // based on edit direction
    scaffoldingPreference: "heavy" | "moderate" | "light";    // how much they keep vs. strip
  };

  // Accumulated from knowledge base uploads
  resourcePreferences: {
    topUploadCategories: string[];
    referencedFrameworks: string[];
  };

  // Accumulated from grading patterns
  gradingStyle: {
    averageStrictness: number;          // 0-1 (lenient to strict)
    criterionEmphasis: Record<string, number>;  // which criteria they weight in practice
    feedbackLength: "brief" | "moderate" | "detailed";
    feedbackTone: "encouraging" | "balanced" | "direct";
  };

  // Accumulated from student interaction patterns
  mentorStyle: {
    interventionFrequency: "low" | "moderate" | "high";
    preferredQuestionTypes: string[];    // from Richard Paul's taxonomy
  };

  // Meta
  totalUnitsCreated: number;
  totalLessonsEdited: number;
  totalGradingSessions: number;
  lastUpdated: string;
  confidenceLevel: "cold_start" | "learning" | "established";  // < 5 units = cold_start, 5-20 = learning, 20+ = established
}
```

### How It Learns

**Passive signals (no explicit input needed):**
1. **Unit creation:** After a teacher generates a unit and edits it, diff the AI output vs. the saved version. What did they change? This tells us their preferences.
2. **Lesson editing:** Same — diff generated vs. final. If they always delete the vocab warm-up section, stop generating it.
3. **Grading patterns:** Track average scores per criterion. If a teacher consistently scores Criterion B higher than Criterion A, they may emphasise ideation over research.
4. **Time spent:** If a teacher always shortens the AI-suggested lesson from 50 to 35 minutes, they probably have shorter periods.

**Active signals (explicit input):**
1. **Style questionnaire** (onboarding): 5-6 questions when they first sign up. "How long are your typical lessons?" "Do you prefer workshop-heavy or theory-balanced?" "How much scaffolding do your students need?"
2. **Feedback buttons:** After generating a unit, "Too much scaffolding / Just right / Not enough." After generating a lesson, "Too long / Just right / Too short."
3. **Emphasis dials per teacher:** The global admin dials set defaults; each teacher can override specific dials for their own generation.

### Cold Start Strategy

New teachers start with the global defaults (admin dials). After 3 units, the system starts showing "Based on your editing patterns, you seem to prefer X. Should I adjust?" After 10 units, the profile is established enough to auto-adapt without asking.

### Database Changes
- New table: `teacher_style_profiles` with JSONB `profile_data`
- New table: `teacher_edit_diffs` — stores before/after diffs of AI-generated content
- Add `teacher_overrides` JSONB column to `ai_model_config` (per-teacher dial overrides)

### System Prompt Injection

When generating content for a teacher, the system prompt includes:

```
<teacher_context>
This teacher typically structures lessons as: warm-up (5 min) → demonstration (12 min) → independent making (25 min) → critique (8 min) → reflection (5 min).
They prefer moderate scaffolding, simplified vocabulary, and workshop-heavy lessons.
They tend to remove vocabulary warm-up sections and add more making time.
Confidence: established (23 units created, 45 lessons edited).
</teacher_context>
```

---

## 5. Presentation Export Style Guide

### Problem
When StudioLoom eventually exports lesson content to PowerPoint, the default tendency is text-heavy slides with bullet points. Design teachers use presentations as visual prompts — a full-screen image with one word, a diagram with no text, a video embed. Not "5 bullet points about the design cycle."

### Presentation Design Principles for StudioLoom Exports

1. **One idea per slide.** Never more. If there are 3 things to say, that's 3 slides.
2. **Full-bleed imagery.** Use the entire slide for visuals. Text overlays on image, not beside it.
3. **Maximum 6 words per slide** for instructional content. (Exception: driving questions, criteria descriptors.)
4. **Visual hierarchy through scale, not bullets.** Big thing = important. Small thing = detail.
5. **Consistent colour coding.** Criterion A = indigo, B = emerald, C = amber, D = violet (matching StudioLoom UI).
6. **Activity slides are different from content slides.** Activity slides have: task instruction (big), time allocation (visible timer/badge), grouping mode (icon). Content slides have: image + keyword.
7. **No clip art, no generic stock.** Use design-specific imagery: sketches, prototypes, workshop environments, material samples.
8. **Teacher notes in speaker notes, not on slides.** The slide is what students see. Everything else goes in notes.
9. **Slide types taxonomy:**

| Slide Type | Visual Treatment | Text Max |
|-----------|-----------------|----------|
| **Title** | Full-bleed image + unit title overlay | 8 words |
| **Learning Objective** | Criterion colour background + objective text | 15 words |
| **Driving Question** | Dark background + large italic question | 20 words |
| **Vocabulary** | Term large + image/icon + definition in notes | 3 words visible |
| **Demonstration** | Step-by-step visual sequence (3-4 images) | Labels only |
| **Activity** | Task instruction + timer badge + grouping icon | 10 words |
| **Exemplar** | Student work photo full-bleed + annotation markers | Annotations only |
| **Critique Prompt** | Question on dark background | 8 words |
| **Reflection** | Prompt text + lined writing space visual | 12 words |
| **Timer/Transition** | Large countdown number or "Switch stations" | 3 words |

### Implementation
When PPT export is built, the generation prompt includes this style guide. The AI generates a slide deck structure (JSON), then the PPT builder renders it using the `pptx` npm library with pre-built slide templates matching each type above.

Create `docs/presentation-style-guide.md` as the reference for this.

---

## 6. Unified AI Learning Across Touchpoints

### Problem
The student-facing Design Assistant (Haiku, Socratic mentor) operates in isolation from:
- The teacher-facing unit generator (Sonnet)
- The knowledge base intelligence
- The grading system
- The per-teacher style profiles

A student asks the AI for help on Criterion A, but the AI doesn't know what the teacher emphasises for Criterion A, what rubric descriptors the school uses, what exemplars are in the knowledge base, or what feedback the teacher gave to other students on similar work.

### Solution: Shared Intelligence Context

All AI touchpoints should draw from the same **intelligence pool** for a given class/unit:

```
┌─────────────────────────────────────────────┐
│              Intelligence Pool               │
│                                              │
│  Knowledge Base chunks (RAG)                 │
│  + Rubric descriptors (from analysed rubric) │
│  + Teacher style profile (§4)                │
│  + Exemplar analysis (from analysed uploads) │
│  + Unit-specific context (learning goals)    │
│  + Class-specific context (grade level, ELL) │
│  + Design Teaching Corpus (§3, Layer 1)      │
│                                              │
└──────┬──────────┬──────────┬────────────────┘
       │          │          │
  ┌────▼───┐ ┌───▼────┐ ┌──▼──────┐
  │Student │ │Teacher │ │Grading  │
  │Mentor  │ │Unit Gen│ │Assistant│
  └────────┘ └────────┘ └─────────┘
```

### How This Works in Practice

**Student asks:** "How can I improve my Criterion A research?"

**Current system:** Generic Socratic response about Criterion A.

**With unified intelligence:**
1. RAG retrieves the school's Criterion A rubric descriptors (from analysed rubric upload)
2. RAG retrieves any exemplars tagged as Criterion A (from analysed exemplar uploads)
3. Teacher style profile indicates this teacher emphasises primary source research over internet search
4. The student's own portfolio shows they've done 3 internet sources but 0 interviews/surveys
5. **AI response:** "You've found some good online sources. Your teacher values primary research — have you considered interviewing someone who actually uses [the product/system you're investigating]? Look at [exemplar student]'s work — they did a survey of 15 people and that's what lifted their Criterion A to a 7."

This is the vision. The student AI becomes a true teaching assistant that knows the teacher's expectations, the school's standards, and the student's own work.

### Implementation Path
1. **Already done:** RAG retrieval from knowledge base, unit context injection
2. **Next:** Wire rubric intelligence into student mentor (when rubric-specific analysis pipeline is built per §1)
3. **Next:** Wire teacher style profile into student mentor (when profiles are built per §4)
4. **Later:** Wire exemplar analysis into student mentor (when exemplar pipeline is built per §1)
5. **Later:** Cross-student learning — "students who struggled here usually benefited from X" (aggregate, never individual)

---

## Summary: Build Order

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | Pass 0: Source classification | 1 day | Fixes all non-lesson analysis |
| 2 | Rubric analysis pipeline (§1) | 2 days | Unlocks rubric-aware grading + mentoring |
| 3 | Timing context model (§2) | 2 days | Fixes lesson length accuracy |
| 4 | Design Teaching Corpus Layer 1 (§3) | 3 days | Transforms AI output quality |
| 5 | Teacher style profiles — passive signals (§4) | 3 days | Personalisation begins |
| 6 | Wire rubric + style into student mentor (§6) | 2 days | Student AI gets smart |
| 7 | Exemplar analysis pipeline (§1) | 2 days | Unlocks exemplar-aware feedback |
| 8 | Teacher style profiles — active signals (§4) | 2 days | Onboarding + feedback buttons |
| 9 | Presentation style guide implementation (§5) | When PPT export is built |
| 10 | Full unified intelligence pool (§6) | Ongoing |

---

## Sources & References

- [RAG Pipeline Best Practices 2025](https://www.dhiwise.com/post/build-rag-pipeline-guide)
- [Dynamic Profile Modeling for Personalized Alignment](https://arxiv.org/abs/2505.15456)
- [Adaptive Learning Systems with LLM Analytics](https://arxiv.org/html/2507.18949v1)
- [IB MYP Design Guide](https://www.ibo.org/programmes/middle-years-programme/curriculum/design/)
- [Fostering Computational & Design Thinking in IB](https://ibo.org/contentassets/318968269ae5441d8df5ae76542817a0/ct-and-dt-full-report.pdf)
- [Design and Technology in your School (Routledge)](https://www.routledge.com/Design-and-Technology-in-your-School-Principles-for-Curriculum-Pedagogy-and-Assessment/Beaumont-Steeg/p/book/9780367441593)
- [MYP Design Pacing — Le Jardin Academy](https://www.lejardinacademy.org/uploaded/Middle_School/Documents/Scope__Pacing_Documents/Design-MYP3-S_S-.pdf)
- [Edutopia: Designing a Well-Crafted Pacing Guide](https://www.edutopia.org/article/designing-a-well-crafted-pacing-guide/)
- [Stanford SCALE: Pedagogical LLM Agents](https://scale.stanford.edu/ai/repository/investigating-pedagogical-teacher-and-student-llm-agents-genetic-adaptation-meets)
