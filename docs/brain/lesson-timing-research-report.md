# Lesson Timing Research & Architecture
**StudioLoom / Questerra — March 2026**
*Research compiled from 25+ sources across MYP, GCSE, d.school, IDEO, PBL, and cognitive science*

---

## Executive Summary

The AI-generated lessons in StudioLoom consistently produce timing that doesn't match how real design teachers structure their classes. After extensive research across 25+ sources spanning IB MYP, GCSE D&T, Stanford d.school, IDEO, PBLWorks, cognitive science, and practising teacher resources, this report identifies the root causes and proposes a concrete architecture for fixing them.

**The core problem:** The current system knows WHAT activities to generate and roughly HOW LONG each should take, but it doesn't understand the SHAPE of a real lesson. Real design lessons follow a universal 4-phase workshop model (Opening → Mini-Lesson → Work Time → Debrief) that the AI doesn't enforce. The AI also lacks the concept of teacher-driven modification — real teachers constantly adjust timing on the fly, and the system provides no mechanism for this.

**Key findings:**

- **The Workshop Model is universal.** Every credible source — from d.school to GCSE to MYP to PBL literature — uses the same 4-phase structure. Work Time must be at least 45% of the period, ideally 60%+. The AI currently doesn't enforce this.

- **The "1 + age" rule is well-established.** Direct instruction should never exceed (1 + student's age in years) minutes. A 12-year-old maxes out at 13 minutes of teacher talk. The AI has max limits but doesn't use this specific, research-backed formula.

- **Lessons need structured flexibility, not rigid timing.** Real teachers don't follow timing to the minute. They need check-in points, early finisher extensions, and the ability to drag-and-drop phases. The system needs to generate a timing SKELETON that teachers can easily modify.

- **The debrief is non-negotiable but often missing.** Research consistently shows that a 5-10 minute structured debrief dramatically improves retention. Many AI-generated lessons either skip it or leave too little time.

- **Multi-lesson pacing is the bigger gap.** Individual lesson timing is fixable with the workshop model. But the real challenge is timing across a 6-8 week design unit — when to transition from research to ideation, how many periods for prototyping, when to schedule critique sessions.

---

## 1. What's Wrong with Current Timing

Six specific gaps between what the system produces and what real design lessons look like:

### 1.1 No Enforced Lesson Shape

The current system generates activities with durations, but doesn't enforce a structural template. A generated lesson might have three 15-minute activities and a 5-minute reflection, but there's no guaranteed Opening hook, no Mini-Lesson phase, and the Work Time might be fragmented into small chunks instead of one sustained block.

**What real teachers do:** Every lesson follows Opening (5-10 min) → Mini-Lesson (8-15 min) → Work Time (30-60+ min) → Debrief (5-10 min). This is non-negotiable in design education because making requires sustained focus.

### 1.2 Overstuffed Content, Undersized Work Time

The AI tends to generate too many instructional activities and not enough making time. In a 60-minute lesson, the AI might produce 25 minutes of instruction/setup and only 25 minutes of student work. Real teachers flip this ratio: 12 minutes of teaching, 38 minutes of work.

> **AI typical:** Opening (5) + Instruction (15) + Activity 1 (10) + Activity 2 (15) + Reflection (5) = lots of small chunks
>
> **Real teacher:** Opening (5) + Mini-Lesson (12) + Work Time (38) + Debrief (5) = one sustained work block

### 1.3 No Workshop Overhead Awareness at Generation Time

While `timing-reference.md` documents workshop overhead (setup, cleanup, safety briefs), the system doesn't reliably deduct these before generating content. The code for context-aware timing exists in `buildTimingBlock()`, but it requires a `TimingContext` to be passed in. If no `TimingContext` is provided, the legacy path fires and generates content for the full period length.

**The result:** A 50-minute workshop lesson gets 50 minutes of activities, but real usable time is only 31 minutes after transitions, setup, and cleanup.

### 1.4 No Structured Debrief Protocols

When the AI generates "reflection" sections, they're typically a single prompt like "Reflect on what you learned today." Real teachers use structured protocols with time budgets: 3 minutes for presenter framing, 6 minutes for I Like/I Wish/I Wonder feedback, 2 minutes for synthesis. The current system doesn't generate these protocols.

### 1.5 No Early Finisher Extensions

Design classes have extreme pace variation. One student finishes the empathy map in 15 minutes; another needs 40. The AI generates no guidance for what fast finishers should do. This forces the teacher to improvise, which usually means those students sit idle or get generic busywork.

Research shows that effective extensions are indexed by design phase: investigation-phase extensions deepen the research, ideation-phase extensions push for more creative variation, prototyping extensions explore alternative materials. These aren't "extra work" — they're productive deepening.

### 1.6 Rigid Timing with No Teacher Modification Path

The biggest gap: the current system produces timing as a fixed output. There's no drag-and-drop phase adjustment, no "this ran over" feedback loop, no way to stretch work time and compress instruction on the fly. The learned timing profile system exists in concept (`timing-reference.md` describes it beautifully), but the teacher-facing modification UI doesn't exist.

---

## 2. What Real Teachers Actually Do

### 2.1 The Universal Workshop Model

Across every source reviewed — from Stanford d.school to British GCSE to Australian ACARA to American PBL — the same fundamental structure appears:

| Phase | Duration | % of Period | Purpose & Teacher Actions |
|-------|----------|-------------|--------------------------|
| **Opening / Hook** | 5-10 min | 8-12% | Set context, frame the challenge, connect to prior learning. Activate curiosity. Teacher sets expectations. |
| **Mini-Lesson** | 8-15 min | 13-25% | Teach ONE skill or concept. Demo a technique. Short, focused, check for understanding. Maximum: (1 + student age) minutes. |
| **Work Time** | 30-60+ min | 45-70% | THE MAIN EVENT. Students create, research, prototype, test. Teacher circulates: 1-on-1 conferences, formative assessment, just-in-time teaching. Check-ins at 30-min and 60-min marks. |
| **Debrief** | 5-10 min | 8-12% | Structured reflection. 2-3 students share, teacher synthesises patterns, bridge to next lesson. Use protocols (I Like/I Wish/I Wonder, Two Stars & a Wish). |

*Sources: PBLWorks, Cult of Pedagogy, Maneuvering the Middle, Stanford d.school, Project Zero (Hetland), ASCD pacing research*

### 2.2 Period-Specific Templates

The workshop model scales to any period length, but the proportions shift:

**45-Minute Period (Tight):** Opening (5) + Mini-Lesson (10 hard limit) + Work Time (25) + Debrief (5). Teachers report this feels like a race. For design work requiring sustained making, schools should use double periods or combine sessions.

**60-Minute Period (Standard):** Opening (5) + Mini-Lesson (12) + Work Time (38) + Debrief (5). The sweet spot. Teacher has time for 3-4 individual conferences during work time.

**90-Minute Block (Ideal for Design):** Two variants emerged from research:
- *Instruction-Heavy:* Split into two work chunks with a 5-minute refocus checkpoint at the midpoint. Best for introducing complex new skills.
- *Hands-On-Heavy:* One long 60-65 minute work block with scheduled check-ins at 30 and 60 minutes. This is what most design teachers prefer for prototyping and making sessions.

### 2.3 The "1 + Age" Rule

Multiple sources converge on this formula for maximum continuous direct instruction: take the student's age and add 1. That's the ceiling in minutes.

| Year Group | Age | Max Instruction |
|-----------|-----|-----------------|
| Year 7 | 12 | 13 minutes |
| Year 8 | 13 | 14 minutes |
| Year 9 | 14 | 15 minutes |
| Year 10 | 15 | 16 minutes |
| Year 11 | 16 | 17 minutes |

This is stricter than the current system's `maxHighCognitiveMinutes` values (12 for Year 1, scaling up). The values are close but the formula gives a cleaner, more memorable rule the AI can apply without a lookup table.

### 2.4 Cognitive Load Boundaries

Research on adolescent working memory and focus capacity reveals consistent patterns:

- **Pure desk work** (reading, writing, analysis): 25-30 minutes max, then 5-minute break
- **High-cognitive design work** (problem-solving, concept development): 30-40 minutes, then 5-10 minute break
- **Hands-on making** (prototyping, building, testing): 45-60 minutes possible because physical engagement sustains attention, but still needs 10-15 minute break
- **Passive viewing** (video, lecture): 15 minutes max before discussion pause. Never show a 30-minute video straight through
- **Group discussion:** 20-30 minutes before social fatigue sets in

### 2.5 How Teachers Handle Pace Variation

The research revealed a critical insight: real teachers don't solve pace variation by generating different timing for different students. They solve it with **extension activities indexed to the current design phase**. Fast finishers get deepening work, not extra work.

This maps perfectly to the design cycle: if a student finishes investigation early, they interview more stakeholders or do a competitor analysis. If they finish ideation early, they SCAMPER on their top concept or rapid-prototype three variations. The extensions aren't busywork — they produce better final outcomes.

---

## 3. Gap Analysis: Current System vs Research

| Area | Current State | Research Says | Priority |
|------|--------------|---------------|----------|
| Lesson shape | Flexible JSONB; no enforced phases | 4-phase workshop model is universal and non-negotiable | **CRITICAL** |
| Work time ratio | No minimum enforced; often <40% | Minimum 45%, ideal 60%+ of period | **CRITICAL** |
| Instruction cap | `maxHighCognitiveMinutes` per profile | 1 + student age (simpler, research-backed) | HIGH |
| Workshop overhead | Code exists but requires TimingContext | Must ALWAYS deduct before generation | HIGH |
| Debrief protocol | Generic reflection prompt | Structured protocols with time budgets | HIGH |
| Extensions | None generated | Phase-indexed deepening activities | MEDIUM |
| Teacher modification | No UI for adjusting timing | Drag-and-drop phases, feedback loop | **CRITICAL** |
| Multi-lesson pacing | Unit skeleton with vague timing | Milestone check-ins, flex points, expected outcomes per week | MEDIUM |
| Check-in points | Not generated | Mandatory at 30-min and 60-min marks for long blocks | MEDIUM |
| Feedback loop | Designed in timing-reference.md but not built | Post-lesson "how long did it actually take?" drives future generation | HIGH |

---

## 4. Proposed Architecture: Lesson Timing Engine

The fix isn't just changing prompts. It's building a timing engine that enforces the workshop model at generation time, validates output, and gives teachers a modification interface.

### 4.1 Generation-Time Workshop Model Enforcement

The AI must generate lessons that conform to the 4-phase workshop model. This means changing the system prompt to require phases, not just activities with durations.

**New Lesson Phase Structure:**

```json
{
  "lessonId": "L01",
  "phases": [
    { "name": "Opening", "type": "opening", "durationMinutes": 7, "content": {} },
    { "name": "Mini-Lesson", "type": "instruction", "durationMinutes": 12, "content": {} },
    {
      "name": "Work Time", "type": "work", "durationMinutes": 38,
      "checkpoints": [{ "at": 20, "prompt": "Check: have you completed..." }],
      "content": {}
    },
    { "name": "Debrief", "type": "debrief", "durationMinutes": 5, "protocol": "i-like-i-wish", "content": {} }
  ],
  "totalUsableMinutes": 62,
  "periodMinutes": 70,
  "overheadMinutes": 8,
  "extensions": [
    { "title": "Interview 2 more stakeholders", "duration": 30, "phase": "investigation" },
    { "title": "Competitor product analysis", "duration": 25, "phase": "investigation" }
  ]
}
```

**Validation Rules (Server-Side):**

After the AI generates a lesson, a validation pass checks:

- **Workshop model conformance:** All 4 phases present? If not, auto-insert missing ones.
- **Instruction cap:** Mini-Lesson duration <= (1 + average student age)? If exceeded, flag warning.
- **Work time floor:** Work Time >= 45% of usable time? If below, suggest compressing instruction.
- **Debrief presence:** Debrief >= 5 minutes? If missing, auto-append 5-min structured debrief.
- **Cognitive load:** Any single passive phase > 20 min (Y7-9) or > 30 min (Y10+)? Suggest splitting.
- **Total time:** Phase durations sum to usable time (not period time)? Auto-adjust if off.

### 4.2 Teacher Timing Modification UI — The Phase Timeline Bar

This is the highest-impact feature. Teachers need to adjust timing quickly and intuitively.

**Visual concept:**

```
[Setup 8m |  Opening 5m  |  Mini-Lesson 12m  |       Work Time 38m        | Debrief 5m | Cleanup 8m]
                         ^                    ^                             ^
                    drag boundaries between phases to redistribute time
           overhead zones (setup/cleanup) separately adjustable in settings
```

**Interaction model:**

1. **Drag phase boundaries:** Pull the border between Mini-Lesson and Work Time to give more or less instruction time. Total usable time stays constant; other phases auto-adjust proportionally.

2. **Lock a phase:** Click a lock icon to fix a phase's duration. Other phases absorb the adjustment.

3. **Split Work Time:** For 90-minute blocks, split the work phase into two chunks with a check-in point. Drag to position the checkpoint.

4. **Quick presets:** One-click buttons for common patterns:
   - "Instruction-Heavy" (10/25/25/25/5 for 90-min)
   - "Hands-On-Heavy" (5/10/65/10 for 90-min)
   - "Balanced" (7/15/35/8 for 65-min)

5. **Per-phase content visibility:** Expanding a phase shows its generated content. The teacher can edit content inline without affecting timing.

**Post-Lesson Feedback:**

After teaching a lesson, a lightweight prompt appears:

- Per-phase slider: Too Short / About Right / Too Long
- Optional: actual duration input per phase
- "Did early finishers complete the extension?" Yes / Partial / No

This data feeds the learned timing profile, nudging future generation toward the teacher's real-world patterns.

### 4.3 Extension Generation Engine

Every generated lesson should include 2-3 extension activities indexed to the current design phase:

| Design Phase | Extension Examples | Typical Duration |
|-------------|-------------------|-----------------|
| **Investigation** | Interview more stakeholders, competitor analysis, accessibility audit, trend research, secondary empathy map | 20-45 min each |
| **Ideation** | SCAMPER on top concept, rapid prototyping 3 versions, constraint-based variation, peer feedback session, feasibility study | 15-30 min each |
| **Prototyping** | Alternative materials version, scale variation, user testing with different demographic, manufacturing research | 20-45 min each |
| **Evaluation** | Edge-case testing, cross-cohort comparison, sustainability analysis, long-term durability plan | 15-25 min each |

### 4.4 Multi-Lesson Pacing Intelligence

For multi-week units, the system should generate:

- **Milestone markers:** "By end of Week 2, students should have 5+ data points and a 1-page design brief." Visible on the unit timeline.

- **Flexibility points:** "If Week 2 research extends beyond 4 periods, push ideation to Week 4-5." Conditional branching points the teacher can activate.

- **Progress gates:** Soft gates asking "Have 80% of students completed the research phase?" before auto-advancing. Teacher can override.

- **Phase proportion guidance:** For a 6-week unit: Research 20%, Ideation 20%, Concept Development 15%, Prototyping 25%, Testing 10%, Exhibition 10%.

---

## 5. Implementation Plan

### Phase 1: Prompt Engineering (1-2 days, immediate impact)

The fastest win. Change the system prompts to enforce the workshop model. This alone will fix ~60% of the timing issues.

1. **Update `buildDesignTeachingContext()`:** Add explicit workshop model requirement with the 4 phases.
2. **Update `buildTimingBlock()`:** Always calculate usable time (make TimingContext non-optional by constructing defaults).
3. **Add the 1+age rule:** Replace raw `maxHighCognitiveMinutes` with the formula for instruction cap.
4. **Add debrief protocol templates:** 3 options (5-min whole-class, 15-min pair feedback, 45-min full critique) injected into generation prompt.
5. **Add extension generation:** Prompt the AI to generate 2-3 phase-indexed extensions per lesson.

### Phase 2: Validation API (2-3 days)

Build a server-side validation layer that checks every generated lesson against workshop model rules. Auto-fix what can be fixed, flag what can't.

- New API route: `/api/units/[unitId]/lessons/validate-timing`
- Checks: workshop structure, instruction cap, work time floor, debrief presence, cognitive load, total time
- Auto-repair: if debrief missing, append 5-min protocol; if work time too short, compress instruction
- Warning UI in lesson editor showing specific timing issues

### Phase 3: Teacher Timing UI (3-5 days)

Build the Phase Timeline Bar and modification interface described in section 4.2.

- Horizontal phase bar component with drag-to-resize
- Phase lock/unlock toggle
- Quick preset buttons
- Work Time split for long blocks
- Connect to lesson editor so timing changes update content

### Phase 4: Feedback Loop (2-3 days)

Wire post-lesson timing feedback into the teacher profile so it improves future generation.

- Post-lesson timing prompt on teacher dashboard
- Adjustment factor calculation (actual/planned duration ratio)
- Per-cohort timing adjustments
- Confidence level tracking (cold start → very high)

### Phase 5: Multi-Lesson Intelligence (3-5 days)

Build the milestone, flex point, and progress gate system for multi-week units.

- Unit timeline view with phase proportion bars
- Milestone markers with expected outcomes
- Conditional flex points ("if X, then shift Y")
- Progress gate prompts

---

## 6. Quick Wins (Can Ship This Week)

Three changes to `prompts.ts` that will immediately improve timing quality:

### Quick Win 1: Enforce the Workshop Model in System Prompt

Add to `buildDesignTeachingContext()`:

```
## LESSON STRUCTURE (MANDATORY)
Every lesson MUST follow the Workshop Model:
1. Opening (5-10 min): Hook, context, connect to prior learning
2. Mini-Lesson (max: 1 + avg_student_age minutes): Teach ONE skill or concept
3. Work Time (minimum 45% of usable time): Students create, research, build, test
4. Debrief (5-10 min): Structured reflection using a protocol

Work Time is THE MAIN EVENT. Everything else exists to support it.
Never fragment Work Time into multiple small activities. One sustained block.
```

### Quick Win 2: Always Use Usable Time

In the legacy path of `buildTimingBlock()` (when no `TimingContext` is provided), construct a default `TimingContext` assuming theory lesson with 3-minute transition overhead. This ensures the AI never generates for the full period length.

### Quick Win 3: Add Extension Prompting

Append to the lesson generation prompt:

```
## EXTENSIONS (REQUIRED)
For EVERY lesson, generate 2-3 extension activities for students who finish early.
Extensions must match the current design phase:
- Investigation phase: deepen research (more interviews, competitor analysis)
- Ideation phase: push creativity (SCAMPER, constraint variation, rapid prototype)
- Prototyping phase: explore alternatives (different materials, scale, user groups)
- Evaluation phase: rigor (edge cases, cross-cohort testing, sustainability)
Extensions are NOT extra work. They are productive deepening of the same design challenge.
```

---

## 7. Recommendations Summary

| # | Recommendation | Effort | Impact | Priority |
|---|---------------|--------|--------|----------|
| 1 | Enforce workshop model in prompts | 1 day | Very High | **P0** |
| 2 | Always use usable time (never raw period) | 0.5 day | Very High | **P0** |
| 3 | Add extension generation to prompts | 0.5 day | High | **P0** |
| 4 | Build validation API with auto-repair | 2-3 days | High | P1 |
| 5 | Phase Timeline Bar (teacher modification) | 3-5 days | Very High | P1 |
| 6 | Post-lesson timing feedback loop | 2-3 days | High | P2 |
| 7 | Structured debrief protocols | 1 day | Medium | P2 |
| 8 | Multi-lesson pacing with milestones | 3-5 days | High | P2 |

**Total estimated effort:** 13-20 days across all phases. The first 3 items (prompt changes) can ship in 1-2 days and will immediately improve every lesson the AI generates.

---

## The Bottom Line

The AI knows *what* to teach but not *how a real classroom flows*. The workshop model is the missing structure. Enforce it in prompts (day 1), validate it server-side (week 1), and give teachers a drag-and-drop timeline bar (week 2). Then close the loop with post-lesson feedback so the system gets smarter over time. The research is clear, the architecture is ready, and items 1-3 can ship immediately.

---

## Supporting Research Files

The raw research data that informed this report is available in the project:

- `docs/timing-reference.md` — Current timing reference (the learning system architecture)
- `research-synthesis-lesson-timing.md` — Full narrative synthesis from 25+ sources
- `lesson-timing-data-tables.md` — 10 structured data tables for reference
- `timing-research-to-questerra-integration.md` — Technical integration roadmap with code examples
- `QUICK-REFERENCE-TIMING-CARD.md` — Printable one-page card for teachers

*Research sources: Stanford d.school, IDEO, PBLWorks, Project Zero (Hetland), ASCD, Cult of Pedagogy, Maneuvering the Middle, Pomodoro technique research, IB MYP Design Guide, GCSE D&T specifications, and 15+ practising teacher resources.*
