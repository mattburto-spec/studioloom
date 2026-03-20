# Timing Research → Questerra Integration Roadmap
## How Real Lesson Timing Data Improves AI Generation (March 2026)

---

## 1. CURRENT QUESTERRA TIMING INFRASTRUCTURE

### What Exists (as of Mar 2026)
- **`src/lib/timing/profile-service.ts`** — Teacher + cohort timing profiles (passive learning from uploads/edits/feedback)
- **`docs/timing-reference.md`** — Cold-start defaults for MYP Y7–11 (grade levels 11–18)
- **Database:** `teacher_timing_profile` + `cohort_timing_adjustment` tables (migration 027 applied)
- **Lesson generation:** Uses timing estimates when creating units/lessons via the AI Unit Builder

### What's Missing
1. **Real validation data** — No published comparison of AI-estimated timings vs. actual lesson delivery timings
2. **Structured debrief/critique timing** — Generated lessons don't consistently include feedback structures with explicit time budgets
3. **Flexible pacing guidance** — AI doesn't offer "if students finish early" extensions indexed by design phase
4. **Multi-lesson sequencing** — Timings for 6–8 week units are vague (e.g., "Week 3: Ideation" but no mini-lesson/work time split per period)
5. **Cognitive load caps enforcement** — No checks for oversized reading/passive phases exceeding 20–30 min
6. **Workshop model alignment** — Generated lessons may not consistently follow Opening/Mini/Work/Debrief structure

---

## 2. RESEARCH FINDINGS → QUESTERRA ENHANCEMENTS

### A. Formalize the Workshop Model as Standard Template

**Current state:** Lesson generation uses flexible JSONB structure; no mandated opening/mini/work/debrief phases.

**Enhancement:**
1. Update `src/lib/ai/prompts.ts` — **`buildDesignTeachingContext()`** to include:
   ```
   Workshop Model Requirement:
   - Opening/Hook (5-10 min): Context, challenge framing, objectives
   - Mini-Lesson (8-15 min for Y7-9, 15-20 min for Y10+): Teach ONE skill/concept
   - Work Time (minimum 30 min, ideally 45-60%+ of period): Independent/group making
   - Debrief (5-10 min): Structured reflection, bridge to next lesson

   Rule: Never exceed (1 + student_age) minutes of direct instruction.
   ```

2. Create new lesson section type `"phases"` with explicit time budgets:
   ```jsonb
   {
     "type": "phases",
     "phases": [
       {
         "name": "Opening",
         "duration_minutes": 7,
         "content": "..."
       },
       {
         "name": "Mini-Lesson",
         "duration_minutes": 12,
         "content": "..."
       },
       {
         "name": "Work Time",
         "duration_minutes": 38,
         "content": "..."
       },
       {
         "name": "Debrief",
         "duration_minutes": 8,
         "content": "..."
       }
     ],
     "total_minutes": 65,
     "period_length": 60,
     "note": "Starts with 5-min buffer for transition"
   }
   ```

3. **Validation in API:** When generating a lesson, check:
   - Does mini-lesson exceed `1 + student_age`? → Flag warning
   - Is work time < 25 minutes? → Flag warning
   - Is debrief missing? → Flag warning
   - Does total exceed period length + 5-min buffer? → Auto-reflow

---

### B. Embed Cognitive Load Caps into Generation

**Current state:** Lessons can include 40+ minutes of reading/analysis in a single block.

**Enhancement:**
1. Add cognitive load checking in **`src/lib/ai/design-assistant-prompt.ts`** and generation endpoints:
   - Flag any single "passive" phase (reading, watching, analysis) > 20 min for Y7-9
   - Flag > 30 min for Y10+
   - Suggest breaking into two chunks with a 5-min break/active phase between

2. Provide a "Cognitive Load Alert" in the lesson editor:
   ```
   ⚠️ Week 1, Day 1: Research Phase is 35 minutes of reading.
   Suggestion: Break into Chunk 1 (15 min research) → 5 min sketching → Chunk 2 (15 min research)
   ```

3. In **`docs/timing-reference.md`**, add table:
   ```
   Cognitive Load by Age (Single Passive Phase Max)
   Y7-8:  15-20 minutes
   Y9:    20-25 minutes
   Y10-11: 25-30 minutes

   If exceeding: insert 5-10 min active/break between chunks
   ```

---

### C. Generate Extensions for Early Finishers (Indexed by Phase)

**Current state:** No guidance on what fast students should do; teacher must improvise.

**Enhancement:**
1. When generating a lesson, add an **`extensions`** field at the end:
   ```jsonb
   {
     "lesson_id": "...",
     "phase_name": "Investigation (Week 2)",
     "extensions": [
       {
         "title": "Interview 2 more stakeholders",
         "duration_minutes": 30,
         "why": "Broaden perspective; richer context for design brief",
         "instructions": "Add 2 more user interviews beyond the initial 3..."
       },
       {
         "title": "Analyze 3 competitor products",
         "duration_minutes": 25,
         "why": "Market research; understand differentiation",
         "instructions": "Compare features, cost, aesthetics..."
       }
     ]
   }
   ```

2. **Criteria for extension auto-generation:**
   - **Investigation phase:** Interview, market research, trend analysis, accessibility audit, secondary user mapping
   - **Ideation phase:** SCAMPER, constraint-based variation, peer feedback, feasibility study
   - **Prototyping phase:** Second prototype variation, alternative materials, scalability exploration
   - **Evaluation phase:** Deeper analysis, cross-cohort comparison, edge-case testing

3. Store extensions in database so teachers can:
   - See them on the lesson page
   - Assign to specific students (future feature)
   - Track completion

---

### D. Explicit Multi-Lesson Unit Sequencing with Phase Timing

**Current state:** Units exist but lesson-by-lesson timing is not detailed.

**Enhancement:**
1. When generating a multi-week unit (e.g., 6-week design cycle), provide a **Phase Breakdown Table:**
   ```
   Week 1-2: Inquiry & Problem Definition (4 periods)
   ├─ Mini-lesson: Design Brief (12 min, Period 1)
   ├─ Work Time: Research (35 min, Periods 1-2)
   ├─ Work Time: Stakeholder Analysis (40 min, Period 2)
   ├─ Expected outcome: 5+ data points, 1-page design brief
   ├─ Early finisher extension: Secondary stakeholder empathy map

   Week 3-4: Ideation (4 periods)
   ├─ Mini-lesson: SCAMPER tool (10 min, Period 3)
   ├─ Work Time: Brainstorm & Ideation (85 min across 2 periods)
   ├─ Work Time: Concept refinement (35 min, Period 4)
   ├─ Expected outcome: 20+ ideas, 3-5 viable concepts selected
   ├─ Early finisher extension: Rapid prototyping of top 3 concepts

   [... etc for Weeks 5-6 ...]

   Flexibility Points:
   - If Week 2 research extends beyond 4 periods, push ideation to Week 4-5
   - If Week 5 prototype fails, allocate Week 5.5 for iteration
   ```

2. Include in **Unit Planner view** (at `/teacher/units`):
   - Gantt view with explicit timing milestones
   - "Expected completion" markers (e.g., "By end of Period 4, students should have selected 3-5 concepts")
   - "Flex points" (e.g., "Week 3-4 can extend to Week 4-5 if ideation runs long")

---

### E. Structured Feedback & Critique Timing

**Current state:** Lessons include "peer feedback" or "critique" but no protocol or time budget.

**Enhancement:**
1. When lesson includes a critique/feedback phase, generate a **Feedback Protocol** with timing:
   ```jsonb
   {
     "feedback_type": "pair-share",
     "duration_total": 15,
     "protocol": [
       {
         "step": 1,
         "name": "Presenter frames work",
         "duration": 3,
         "instructions": "Student explains: What I was trying to do... My main challenge is..."
       },
       {
         "step": 2,
         "name": "Clarifying questions",
         "duration": 3,
         "instructions": "Partner asks: Can you tell us more about...? (No suggestions yet)"
       },
       {
         "step": 3,
         "name": "Structured feedback",
         "duration": 6,
         "protocol": "I like (2 min) + I wish (2 min) + I wonder (2 min)",
         "instructions": "..."
       },
       {
         "step": 4,
         "name": "Presenter response",
         "duration": 2,
         "instructions": "Thanks. I'm taking away..."
       }
     ]
   }
   ```

2. Provide **Feedback Frames** in lesson generation:
   - **10-min whole-class debrief:** "2-3 students share, teacher synthesizes"
   - **15-min pair feedback:** "Structured I like/wish/wonder with timer"
   - **45-60 min design critique:** Full protocol (framing + questions + feedback + synthesis)

3. Teachers can:
   - Copy feedback instructions to lesson slides
   - Set a timer (link to integration with project timer/countdown)
   - Mark completion in lesson plan

---

### F. Teacher Timing Profile Learning (Passive Signal Collection)

**Current state:** System tracks when lessons are edited; timing profile updates on teacher upload feedback.

**Enhancement:**
1. Add explicit **timing audit** fields in teacher dashboard:
   - "How long did the mini-lesson actually take?" (vs. planned 12 min)
   - "How long was work time?" (vs. planned 35 min)
   - "Did you need to extend the period?" → If so, allocate how much?
   - "Did early finishers complete the extension?" (Yes/No/Partial)

2. Calculation (passive learning):
   ```
   teacher_timing_profile.adjustment_factor =
     average(actual_duration / planned_duration) across last 10 lessons

   Example: Teacher consistently takes 15 min for 12-min mini-lessons
   → Adjustment factor = 1.25x
   → Next lesson generation reduces other phases by 3 min to compensate
   ```

3. **Cohort-specific adjustments:**
   - Mixed-ability Y9 class tends to need 35% longer ideation → system learns this
   - ELL cohort needs 10% more instruction time → system learns this
   - Class with 3 SEND students benefits from 15-min extension work time → system learns this

---

## 3. SPECIFIC CODE CHANGES REQUIRED

### 1. Lesson Generation Prompt (Highest Priority)
**File:** `src/lib/ai/prompts.ts`

Current: Generic "create a lesson" prompt
Target: Add workshop model structure requirement

```typescript
export function buildDesignTeachingContext(
  framework: string,
  teacher: TeacherProfile,
  cohort: CohortProfile
): string {
  const workshopRequirement = `
    ## Workshop Model (REQUIRED for ALL lessons)
    Every lesson MUST include these 4 phases:
    1. Opening (5-10 min): Hook, context, objectives
    2. Mini-Lesson (${cohortProfile.instructionMaxMinutes} min max): Teach ONE skill
    3. Work Time (${periodLength - 30} min minimum): Student making/practice
    4. Debrief (5-10 min): Structured reflection

    Rule: Mini-lesson duration must not exceed (1 + student_age_average).

    Work time must be at least 45% of the period.
  `;

  return `${workshopRequirement}\n${existingContext}`;
}
```

### 2. Lesson Validation (API Route)
**File:** `src/app/api/units/[unitId]/lessons/validate-timing/route.ts` (NEW)

```typescript
export async function POST(req: Request) {
  const { lesson } = await req.json();
  const warnings: string[] = [];

  // Check mini-lesson duration
  const instructionDuration = calculatePhaseTime(lesson, 'Mini-Lesson');
  if (instructionDuration > (1 + cohort.avg_age)) {
    warnings.push(
      `Mini-lesson is ${instructionDuration} min (max: ${1 + cohort.avg_age} min)`
    );
  }

  // Check work time percentage
  const workTime = calculatePhaseTime(lesson, 'Work Time');
  const workPercent = workTime / lesson.period_minutes * 100;
  if (workPercent < 45) {
    warnings.push(`Work time is only ${workPercent}% (target: 45%+)`);
  }

  // Check debrief exists
  if (!lesson.phases.find(p => p.name === 'Debrief')) {
    warnings.push('Debrief phase missing');
  }

  // Check cognitive load
  for (const phase of lesson.phases) {
    if (phase.type === 'passive' && phase.duration > 30) {
      warnings.push(
        `${phase.name} is ${phase.duration} min of passive activity (break into chunks)`
      );
    }
  }

  return Response.json({ warnings, valid: warnings.length === 0 });
}
```

### 3. Extension Generation (Lesson Detail Page)
**File:** `src/components/lessons/ExtensionsMenu.tsx` (NEW)

Show generated extensions based on design phase:
```typescript
const extensionsByPhase = {
  'investigation': [
    { title: 'Interview 2 more stakeholders', duration: 30 },
    { title: 'Analyze 3 competitor products', duration: 25 },
    // ...
  ],
  'ideation': [
    { title: 'SCAMPER on top concept', duration: 20 },
    { title: 'Rapid prototyping (3 versions)', duration: 30 },
    // ...
  ],
  // etc
};
```

### 4. Timing Profile Learning (Teacher Dashboard)
**File:** `src/components/dashboard/TeacherTimingAudit.tsx` (NEW)

After each lesson, prompt:
```typescript
<form onSubmit={handleTimingAudit}>
  <label>
    How long did the mini-lesson take?
    <input type="number" name="actual_mini_lesson_minutes" />
  </label>
  <label>
    How long was work time?
    <input type="number" name="actual_work_time_minutes" />
  </label>
  <label>
    Did early finishers complete the extension?
    <select name="extension_completion">
      <option>Yes</option>
      <option>Partial</option>
      <option>No - still working</option>
      <option>No - didn't start</option>
    </select>
  </label>
</form>
```

On submit: Calculate new adjustment factor, store in `teacher_timing_profile.adjustment_factor`.

---

## 4. INTEGRATION WITH EXISTING TIMING SYSTEM

### How This Fits `timing-reference.md` (Existing)
The research synthesis becomes the **source of truth** for cold-start defaults:

**Current `timing-reference.md`:**
```
MYP Y7: mini_lesson_max = 13 minutes, work_time_ratio = 0.6
```

**Enhanced (post-research):**
```
MYP Y7:
  mini_lesson_max = 13 minutes (rule: 1 + student_age)
  work_time_ratio = 0.60-0.70 (target 45% minimum; 60% ideal)
  debrief_min = 5 minutes (structured, not open-ended)
  cognitive_load_passive_max = 20 minutes (research findings)
  extension_avg_duration = 25 minutes (indexed by phase)

Sources:
  - Workshop model (4-phase structure): standard across PBL pedagogy
  - Mini-lesson timing: Cult of Pedagogy, Maneuvering the Middle
  - Cognitive load: Pomodoro research + ASCD pacing research
  - Adolescent attention: Project Zero, cognitive load research (ages 13-17)
```

### How This Feeds `profile-service.ts` (Existing)
```typescript
// src/lib/teacher-style/profile-service.ts

export async function computeTimingAdjustments(
  teacher_id: string,
  last_n_lessons: number = 10
): Promise<TimingAdjustmentProfile> {
  const lessons = await getTeacherLessonsWithAudits(teacher_id, last_n_lessons);

  const adjustmentFactor = average(
    lessons.map(l => l.actual_duration / l.planned_duration)
  );

  // Factor < 1.0: teacher is faster than expected
  // Factor > 1.0: teacher is slower than expected
  // Use this to adjust next lesson generation

  return {
    adjustment_factor: adjustmentFactor,
    confidence: Math.min(last_n_lessons / 10, 1.0),
    last_updated: new Date(),
    cohort_adjustments: {
      // per-cohort learning
    }
  };
}
```

---

## 5. ROLLOUT PLAN (Phases)

### Phase 1 (Weeks 1–2): Foundation
- [ ] Create `research-synthesis-lesson-timing.md` (DONE ✓)
- [ ] Create `lesson-timing-data-tables.md` (DONE ✓)
- [ ] Update `docs/timing-reference.md` with research data
- [ ] Add workshop model requirement to `buildDesignTeachingContext()`

### Phase 2 (Weeks 3–4): Validation
- [ ] Build lesson validation API route
- [ ] Add warning UI in lesson editor (mini-lesson > max, work time < min, no debrief)
- [ ] Test on sample lessons from existing unit library

### Phase 3 (Weeks 5–6): Extensions & Debrief
- [ ] Implement extension generation (indexed by phase)
- [ ] Add feedback protocol templates
- [ ] Integrate structured critique timing into lesson generation

### Phase 4 (Weeks 7–8): Learning Loop
- [ ] Build teacher timing audit form
- [ ] Implement adjustment factor calculation
- [ ] Connect to next lesson generation (feedback loop)

### Phase 5 (Weeks 9–10): Testing & Refinement
- [ ] A/B test with 3–5 pilot teachers
- [ ] Collect feedback: Is the timing guidance helpful? Accurate?
- [ ] Refine adjustment factors based on pilot data

---

## 6. SUCCESS METRICS

| Metric | Target | How Measured |
|--------|--------|--------------|
| **Lessons with complete workshop structure** | 100% | API validation pass rate |
| **Mini-lessons respecting age cap** | 95%+ | Validation check |
| **Work time ≥ 45% of period** | 90%+ | Calculated from phase durations |
| **Debrief included** | 100% | Validation check |
| **Teacher perceived accuracy** | 8/10 or higher | Post-lesson survey |
| **Early finisher extensions used** | 60%+ adoption | Completion tracking |
| **Adjustment factor converges** | Within 10% after 10 lessons | Timing profile learning |

---

## 7. RESEARCH SOURCES TO MAINTAIN

As the system evolves and we collect real data, keep these as reference:

1. **This synthesis** (`research-synthesis-lesson-timing.md`)
2. **Data tables** (`lesson-timing-data-tables.md`)
3. **Updated timing reference** (`docs/timing-reference.md` — keep research citations)
4. **Cognitive load research** — Pomodoro, ASCD, Project Zero
5. **Workshop model** — PBLWorks, Maneuvering the Middle, Cult of Pedagogy
6. **Design education** — Stanford d.school, IDEO, Hetland's Studio Thinking

---

## 8. NOTES FOR FUTURE RESEARCH

- **Gap:** No published real-time timing data comparing AI estimates vs. actual delivery for design lessons. Questerra can collect this and eventually publish (anonymized).
- **Gap:** Limited research on ELL + design timing (likely needs 10–20% more instruction time; could be cohort profile feature).
- **Gap:** SEND timing not well researched; opportunities for differentiation studies.
- **Opportunity:** Makloom (consumer version) can reuse this timing research; calibrate for adult learners (likely longer work time tolerance).

---

**Prepared:** March 2026 | **Research Synthesis Date:** March 2026 | **Next Review:** Q3 2026 (after pilot data)
