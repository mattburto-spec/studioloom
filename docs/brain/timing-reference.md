# StudioLoom Timing Reference
**Date:** 19 March 2026 | **Status:** Living document
**Purpose:** Defines how timing works in StudioLoom — not fixed values, but a learning system.

---

## Core Principles

### 1. The AI must never generate content that fills the full period length.

Real design lessons lose time to transitions, setup, cleanup, attendance, device login, and material distribution. The AI must calculate **usable time** and generate content that fits within it. As of 19 Mar 2026, `buildTimingBlock()` always constructs a `TimingContext` — even when none is explicitly provided — so the AI never generates for the raw period.

```
usableMinutes = periodLength
  - transitionOverhead      (settling, attendance, device login)
  - setupMinutes            (workshop prep, material distribution)
  - cleanupMinutes          (pack away, clean benches, return tools)
```

### 2. Every lesson follows the Workshop Model (MANDATORY)

Research across 25+ sources (d.school, IDEO, PBLWorks, ASCD, Cult of Pedagogy, Project Zero, GCSE, MYP) converges on the same 4-phase structure:

| Phase | Duration | % of Usable | Purpose |
|-------|----------|-------------|---------|
| **Opening** | 5-10 min | 8-12% | Hook, context, connect to prior learning |
| **Mini-Lesson** | max (1+age) min | 13-25% | Teach ONE skill. The "1+age" rule: max instruction = 1 + avg student age |
| **Work Time** | ≥45%, ideally 60%+ | 45-70% | THE MAIN EVENT. One sustained block. Teacher circulates. |
| **Debrief** | 5-10 min | 8-12% | Structured protocol (I Like/I Wish, exit ticket, gallery walk) |

Work Time is one sustained block — never fragment into multiple small activities. The debrief is non-negotiable and must use a structured protocol.

### 3. Extensions are required on every lesson

2-3 extension activities for early finishers, indexed to the current design phase: Investigation → deeper research, Ideation → creative variation, Prototyping → alternative materials, Evaluation → edge-case rigor.

### 4. Server-side validation catches what the AI misses

`timing-validation.ts` checks 8 rules and auto-repairs 6 of them. Don't rely on prompts alone — validate and fix.

## This Is a Learning System, Not a Lookup Table

The values in this document are **initial defaults only** — starting points for cold-start teachers who haven't uploaded anything yet. They exist so the AI isn't completely blind on day one.

As teachers use StudioLoom, the timing model learns from:

1. **Uploaded lesson plans** — when a teacher uploads their own lessons, Pass 1 extracts actual timing per activity. These real values replace the defaults.
2. **Teacher edits** — when the AI generates a 20-min demo and the teacher shortens it to 12, that's a signal. The system tracks these adjustments.
3. **Post-lesson feedback** — "this activity ran over by 10 minutes" or "we finished early" directly updates the model.
4. **Student pacing data** — how long students actually spend on each section (from response timestamps).
5. **School profile** — the teacher tells us their period length, whether they have doubles, workshop access. These are facts, not estimates.

The defaults below get progressively overridden as data accumulates. A teacher with 20 uploaded lessons has a timing model built from THEIR actual teaching, not from a generic table.

---

## School Schedule Presets

| Preset | Period (min) | Doubles? | Typical Countries |
|--------|-------------|----------|-------------------|
| Short singles | 40 | No | Some UK schools |
| Standard singles | 50 | Sometimes | Australia, US, most international |
| Long singles | 60 | Sometimes | Some IB schools |
| Double periods | 80 | Yes | IB MYP Design standard |
| Extended blocks | 90-100 | Yes | Block scheduling (US) |

---

## Overhead Deductions (auto-deducted from usable time)

| Overhead Type | Theory Lesson | Workshop Lesson | Notes |
|---------------|--------------|-----------------|-------|
| Transition (settling, attendance) | 3 min | 3 min | Universal |
| Device login (if digital) | 2 min | 0 min | Only when laptops/tablets used |
| Workshop setup | 0 min | 5-10 min | Distribute materials, safety brief |
| Workshop cleanup | 0 min | 5-10 min | Tools away, benches wiped, safety check |
| Material distribution | 0 min | 3-5 min | Counted separately from setup |

### Usable Time Examples

| Scenario | Raw Period | Overheads | Usable Time |
|----------|-----------|-----------|-------------|
| Y3 theory lesson, 50 min | 50 | 3 (transition) + 2 (devices) | **45 min** |
| Y3 workshop, single 50 min | 50 | 3 + 8 (setup) + 8 (cleanup) | **31 min** |
| Y3 workshop, double 80 min | 80 | 3 + 8 (setup) + 10 (cleanup) | **59 min** |
| Y1 workshop, double 80 min | 80 | 3 + 10 (setup) + 10 (cleanup) | **57 min** |

**Key insight:** A 50-minute workshop lesson has only ~31 usable minutes. The AI currently generates 50 minutes of activities.

---

## Activity Type Timing Ranges (Cold-Start Defaults)

These are starting defaults for new teachers with no uploaded data. They get replaced by learned values as the teacher uploads lesson plans and provides feedback. All values are per-activity instance, not per-lesson.

| Activity Type | Default Min | Default Ideal | Default Max | Cognitive Load | Notes |
|--------------|-----|-------|-----|---------------|-------|
| **Direct instruction** (demo, lecture, explain) | 5 | 10 | 15 | High (passive) | Attention drops sharply after 12 min for Y1-3. Chunk with questions. |
| **Guided practice** (follow-along, worked example) | 8 | 15 | 25 | Medium-High | Needs check-ins every 8-10 min |
| **Independent making** (workshop, prototyping) | 15 | 30 | 50 | Medium (active) | Can sustain if engaged; needs checkpoints |
| **Sketching / ideation** (drawing, brainstorming) | 5 | 12 | 20 | Medium | Quick bursts better than long sessions |
| **Digital work** (CAD, research, documentation) | 10 | 20 | 30 | High | Need structure or students drift; eyes fatigue |
| **Critique / gallery walk** | 5 | 10 | 15 | Medium | Energy drops if too long; 2 min per piece max |
| **Peer review / pair work** | 5 | 12 | 20 | Medium | Social energy is limited for introverts |
| **Research / investigation** | 8 | 15 | 25 | High | Needs guiding questions or students browse aimlessly |
| **Reflection / journaling** | 3 | 5 | 8 | Low-Medium | Best at end of lesson; can combine with exit ticket |
| **Vocabulary / warm-up** | 3 | 5 | 8 | Low | Brief, energising, activates prior knowledge |
| **Assessment / testing** | 10 | 20 | 40 | High | Depends on criterion; formative can be shorter |
| **Station rotation** | 20 | 30 | 45 | Varied | 3-4 stations x 8-12 min each; transitions eat time |
| **Cleanup** | 5 | 8 | 12 | Low | Non-negotiable; schedule it explicitly |

---

## The 1+Age Instruction Cap Rule (19 Mar 2026)

Maximum continuous direct instruction = 1 + average student age. After this, attention drops sharply and instruction becomes counterproductive. This replaces the old `maxHighCognitiveMinutes` lookup table with a simpler, research-backed formula.

| MYP Year | Avg Age | Max Instruction | Source |
|----------|---------|-----------------|--------|
| Year 1 | 11 | **12 min** | PBLWorks, cognitive science |
| Year 2 | 12 | **13 min** | PBLWorks, cognitive science |
| Year 3 | 13 | **14 min** | PBLWorks, cognitive science |
| Year 4 | 15 | **16 min** | PBLWorks, cognitive science |
| Year 5 | 16 | **17 min** | PBLWorks, cognitive science |

**Implementation:** `maxInstructionMinutes(profile)` in `prompts.ts` returns `1 + profile.avgStudentAge`.

## Period-Specific Workshop Templates (19 Mar 2026)

| Period | Opening | Mini-Lesson | Work Time | Debrief | Notes |
|--------|---------|-------------|-----------|---------|-------|
| **45 min** | 5 | 10 (hard limit) | 25 | 5 | Feels rushed; consider double periods for making |
| **60 min** | 5 | 12 | 38 | 5 | Sweet spot. Teacher has time for 3-4 conferences |
| **90 min (instruction)** | 5 | 25 | 25+25 (with 5-min refocus) | 5 | Split work block for new skill sessions |
| **90 min (hands-on)** | 5 | 12 | 65 (with 30/60 min check-ins) | 8 | Best for prototyping and sustained making |

## Cognitive Load Curve by MYP Year (Cold-Start Defaults)

These are developmental starting points. Real values will vary by class, subject, and individual teacher experience. The system learns actual cognitive load patterns from uploaded lessons and teacher feedback.

| MYP Year | Age | Default Focus (theory) | Default Focus (making) | Default Switch Interval | Default Theory:Practical | Scaffolding Level |
|----------|-----|-----|-----|-----|-----|-----|
| Year 1 (Gr 6) | 11-12 | 10-12 min | 25-35 min | Every 10-12 min | 25:75 | Heavy (checklists, starters, templates) |
| Year 2 (Gr 7) | 12-13 | 12-15 min | 30-40 min | Every 12-15 min | 30:70 | Moderate-heavy (starters, some choice) |
| Year 3 (Gr 8) | 13-14 | 15-18 min | 35-45 min | Every 15-18 min | 35:65 | Moderate (exemplars, reference materials) |
| Year 4 (Gr 9) | 14-15 | 20-25 min | 40-50 min | Every 18-22 min | 40:60 | Light (success criteria, peer feedback) |
| Year 5 (Gr 10) | 15-16 | 25-30 min | 45-60 min | Every 20-25 min | 40:60 | Minimal (prompts, self-assessment) |

---

## Energy Sequencing Rules

These rules determine what activity types can follow each other:

1. **Never follow high-cognitive with high-cognitive** — e.g., don't do 15 min analysis → 15 min documentation. Insert an active break (gallery walk, sketch, pair share).
2. **Workshop making can follow theory** — students welcome the hands-on shift after instruction.
3. **Theory should NOT follow long workshop** — students are physically tired; switch to low-demand (gallery walk, reflection, peer share).
4. **Always end with reflection** — even 3 minutes of "what did you learn?" dramatically improves retention.
5. **Vocab/warm-up goes first** — activates prior knowledge, settles the class.
6. **Critique/gallery walk is best mid-lesson** — after students have work to show, before they iterate.
7. **Station rotations need buffer time** — add 2 min per rotation for physical movement between stations.

---

## Workshop-Specific Timing

Design & Technology lessons have unique timing considerations:

### Setup Overhead by Equipment Type

| Equipment Category | Setup (min) | Cleanup (min) | Safety Brief (min) |
|-------------------|-------------|---------------|-------------------|
| Hand tools (saws, files, drills) | 5 | 8 | 2 (first time), 1 (reminder) |
| Power tools (pillar drill, scroll saw) | 8 | 10 | 3 (first time), 2 (reminder) |
| Laser cutter / 3D printer | 5 | 3 | 2 (first time only) |
| Sewing machines | 5 | 8 | 2 (first time), 1 (reminder) |
| Electronics / soldering | 8 | 10 | 3 (first time), 2 (reminder) |
| Food / cooking | 10 | 12 | 3 (hygiene + safety) |
| Digital only (CAD, research) | 2 | 1 | 0 |
| Drawing / sketching | 2 | 3 | 0 |

### Material Distribution Patterns

| Pattern | Time | Best For |
|---------|------|----------|
| Pre-set on benches | 0 min (done before class) | Simple materials, small class |
| Central table collection | 3 min | Mixed materials, moderate class |
| Teacher distributes | 5 min | Expensive/dangerous materials |
| Station rotation (already set) | 0 min per rotation | Station-based lessons |

---

---

## How the Timing Model Learns

### Data Sources (in priority order)

1. **Teacher's own uploaded lessons** (highest authority) — Pass 1 extracts section titles, activity types, and durations from real lesson plans. After 5+ uploads, the teacher's personal timing distribution replaces the cold-start defaults entirely.

2. **Teacher edits to AI output** — when the AI generates a unit and the teacher adjusts timing (shortens a demo from 20→12 min, extends making from 30→45 min), the diff is recorded. Patterns across multiple edits become learned preferences.

3. **Post-lesson feedback** — teachers can flag "ran over" or "finished early" on any lesson section. This is the most direct signal — it tells us what the model got wrong.

4. **Student response timestamps** — if students consistently finish a 15-min research section in 8 minutes, the model learns that this teacher's students work faster on research (or the section was too easy).

5. **School profile facts** — period length, double period availability, workshop access. These are configuration, not learned.

6. **Cold-start defaults** (lowest authority) — the tables in this document. Only used when no other data exists.

### Confidence Levels

| Data Available | Confidence | Behaviour |
|---------------|------------|-----------|
| No uploads, no edits | Cold start | Use defaults from this doc |
| 1-4 uploads | Low | Blend defaults with uploaded data (70/30) |
| 5-10 uploads | Medium | Primarily use uploaded data, defaults as fallback |
| 10+ uploads + edit history | High | Fully learned model, defaults irrelevant |
| + post-lesson feedback | Very high | Calibrated by real classroom outcomes |

### What Gets Learned Per Teacher

```typescript
// Accumulated over time, not configured upfront
interface LearnedTimingProfile {
  // From uploaded lessons
  actualActivityDurations: Record<ActivityType, { mean: number; stddev: number; count: number }>;
  actualLessonLengths: { mean: number; stddev: number; count: number };
  actualTheoryPracticalRatio: number;

  // From teacher edits
  editAdjustments: Array<{ activityType: string; aiSuggested: number; teacherSet: number }>;
  averageAdjustmentDirection: "shorter" | "longer" | "neutral";

  // From post-lesson feedback
  ranOverCount: number;
  finishedEarlyCount: number;
  accurateCount: number;

  // Computed
  confidenceLevel: "cold_start" | "low" | "medium" | "high" | "very_high";
  lastUpdated: string;
}
```

---

## How the AI Uses This Data

### In Unit Generation
When the AI generates a unit skeleton, it should:
1. Know the teacher's period length (from school profile or admin settings)
2. Determine if each lesson is theory or workshop (from the lesson type)
3. Calculate usable time per lesson
4. Generate activities that sum to usable time, not raw period time
5. Follow the energy sequencing rules for activity ordering
6. Respect the cognitive load curve for the student's year level

### In Lesson Generation
When the AI generates a full lesson, it should:
1. Start with usable time (after overhead deductions)
2. Allocate warm-up (3-5 min) and reflection (3-5 min) first — these are non-negotiable
3. Fill the middle with activities that respect the max duration per type
4. Never exceed the cognitive focus limit for the year without an activity switch
5. Include explicit transition notes between activities
6. If workshop: include setup and cleanup as visible lesson phases (not hidden overhead)

### In the System Prompt
The timing context is injected as a structured block. The values come from the learned profile if available, otherwise cold-start defaults:

```
## Timing Context
School schedule: 80-minute double periods
This is a WORKSHOP lesson for MYP Year 3 students (age 13-14)
Usable time: 59 minutes (after 3 min transition, 8 min setup, 10 min cleanup)

[If learned profile exists:]
Based on this teacher's 14 uploaded lessons, their typical activity durations are:
- Direct instruction: avg 11 min (range 8-15)
- Independent making: avg 28 min (range 20-40)
- Critique: avg 8 min (range 5-12)
- Reflection: avg 4 min
This teacher tends to run shorter theory and longer making sessions than average.
They have edited AI timing shorter in 8 of 12 generated lessons — generate conservatively.

[If cold start:]
No uploaded lesson data yet. Using general defaults for MYP Year 3.
Cognitive focus guideline: ~15-18 minutes for theory before activity switch.

Generate activities that sum to 59 minutes. Do NOT generate 80 minutes of content.
```

---

## Sources

- Hattie, J. (2009). Visible Learning. Routledge.
- Sweller, J., Ayres, P., & Kalyuga, S. (2011). Cognitive Load Theory. Springer.
- IB MYP Design Guide (2021). International Baccalaureate Organization.
- Beaumont, C., & Steeg, T. (2019). Design and Technology in your School. Routledge.
- Perkins, D. (2009). Making Learning Whole. Jossey-Bass.
- StudioLoom classroom observations (Matt Burton, Nanjing International School, 2023-2026).
