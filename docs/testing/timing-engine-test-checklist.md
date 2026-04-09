# Lesson Timing Engine — Test Checklist
**Created:** 19 March 2026 | **Status:** Partially tested (19 Mar 2026)

This checklist covers everything built in the timing engine session. Tests are ordered by priority — start at the top.

---

## Test Results — 19 Mar 2026 (Live Browser Testing)

### Admin Sandbox (Single Lesson Generation) — PASS
Tested: Year 3, 60-min Research lesson, "Sustainable Packaging Design"

| Check | Result |
|-------|--------|
| workshopPhases present | **PASS** — all 4 phases generated natively |
| Opening duration | 8 min |
| Mini-Lesson duration | 12 min (under 14 cap for age 13) |
| Work Time duration | 32 min (56% of 57 usable) |
| Debrief duration | 5 min, protocol: "quick-share" |
| Total = usable time | 57 min (NOT 60 raw period) |
| Checkpoints | 2 checkpoints at 15 and 25 min |
| Extensions | 3 extensions, all "investigation" phase |
| timingValidation.valid | true (0 issues — no auto-repair needed) |
| configApplied | Yes |

### Backward Compatibility — PASS
Tested: Existing "Coffee Table" unit (15 lessons, Timeline mode, pre-timing-engine)
- Lesson cards render normally without workshopPhases
- No MiniPhaseBar shown (correct — no data)
- No crashes, no missing content
- Zero console errors

### Console Errors — PASS
- Admin AI Config page: 0 errors
- Unit detail page: 0 errors
- Units list page: 0 errors (including hard reload)
- No timing-related or PhaseTimelineBar errors anywhere

### Journey Wizard PhaseTimelineBar — NOT YET TESTED
- Requires completing full 7-step wizard + AI generation
- PhaseTimelineBar component is mounted in JourneyLessonCard; will render when workshopPhases data exists
- The admin sandbox confirmed workshopPhases data is generated correctly, so the component will have data to render

### Items Still Needing Manual Testing
- [ ] PhaseTimelineBar drag-to-resize interaction
- [ ] Phase lock/unlock toggle
- [ ] Preset buttons (Balanced/Hands-On/Instruction/Critique)
- [ ] MiniPhaseBar on lesson cards (needs unit generated with new engine)
- [ ] Extension display in collapsible section

---

## 1. Prompt-Level Changes (Highest Priority)

These affect every lesson the AI generates. Test by generating content and inspecting the output.

### 1.1 Workshop Model in generated lessons
- [ ] Generate a journey-mode unit (any topic, Year 3, 60-min lessons)
- [ ] Each lesson JSON should contain a `workshopPhases` object with:
  - `opening` (5-10 min)
  - `miniLesson` (≤14 min for Year 3)
  - `workTime` (≥26 min for 57 usable minutes = 45%)
  - `debrief` (≥5 min, with `protocol` field)
- [ ] Work Time should be one block, not fragmented into multiple small sections
- [ ] Debrief should have a named protocol (e.g. "quick-share", "i-like-i-wish", "exit-ticket")

### 1.2 Extensions generated
- [ ] Each lesson should have an `extensions` array with 2-3 items
- [ ] Each extension has: `title`, `description`, `durationMinutes`, `designPhase`
- [ ] Extensions match the lesson's design phase (research lesson → deeper research extensions, not random busywork)

### 1.3 Usable time (never raw period)
- [ ] Generate a lesson and check: section durations sum to ~57 min (for 60-min theory) not 60
- [ ] Generate a workshop lesson: durations should sum to ~41 min (for 60-min workshop with 8 setup + 8 cleanup)
- [ ] The AI prompt should show "Usable time: **57 minutes**" not "60 minutes"

### 1.4 1+age instruction cap
- [ ] Year 1 (age 11): mini-lesson ≤ 12 min
- [ ] Year 3 (age 13): mini-lesson ≤ 14 min
- [ ] Year 5 (age 16): mini-lesson ≤ 17 min

### How to test prompts
**Admin sandbox** (`/admin` → AI Model Config → Test Sandbox):
- Select a grade level, generate a single lesson
- Response now includes `timingValidation` with issues and stats
- Compare `lessonRaw` (AI output) vs the auto-repaired version

**Journey wizard** (Teacher → Create Unit → Journey mode):
- Generate a multi-lesson unit
- Response includes `timingValidation` per page

---

## 2. Server-Side Validation (High Priority)

Validation runs automatically on every generation. Verify the auto-repair works.

### 2.1 Validation fires on all routes
- [ ] `generate-journey` — response includes `timingValidation` when issues found
- [ ] `test-lesson` (admin sandbox) — response includes `timingValidation`
- [ ] `generate-unit` — response includes `timingValidation` when issues found
- [ ] `regenerate-page` — response includes `timingValidation` when issues found

### 2.2 Auto-repair scenarios
Test these by examining the `timingValidation.issues` array in API responses:

- [ ] **Missing workshopPhases**: If AI returns lesson without workshopPhases, validation should create them (look for `MISSING_WORKSHOP_PHASES` issue with `autoFixed: true`)
- [ ] **Instruction over cap**: If mini-lesson > 1+age, should be clamped (look for `INSTRUCTION_OVER_CAP`)
- [ ] **Work time too short**: If work time < 45%, instruction should be compressed (look for `WORK_TIME_TOO_SHORT`)
- [ ] **Missing debrief**: If debrief < 5 min, should be bumped to 5 with protocol (look for `DEBRIEF_TOO_SHORT`)
- [ ] **Missing checkpoints**: Long work blocks (≥30 min) should get midpoint check-in (look for `MISSING_CHECKPOINTS`)

### 2.3 Validation stats
- [ ] `timingValidation.stats` should include: `usableMinutes`, `workTimeMinutes`, `workTimePercent`, `instructionMinutes`, `instructionCap`, `hasDebrief`, `extensionCount`
- [ ] `workTimePercent` should be ≥ 45 after repair
- [ ] `instructionMinutes` should be ≤ `instructionCap` after repair

---

## 3. Teacher UI — PhaseTimelineBar (Medium Priority)

The interactive timing bar is mounted in the journey wizard lesson editor.

### 3.1 PhaseTimelineBar renders in JourneyLessonCard
- [ ] Generate a journey-mode unit
- [ ] Expand a lesson card in the wizard
- [ ] A horizontal phase bar should appear showing Opening (purple), Mini-Lesson (blue), Work Time (green), Debrief (amber)
- [ ] Phase durations shown in the bar match workshopPhases data
- [ ] If no workshopPhases data, bar should not render

### 3.2 Drag to resize
- [ ] Drag the boundary between Mini-Lesson and Work Time
- [ ] Mini-Lesson should shrink, Work Time should grow (or vice versa)
- [ ] Total usable time stays constant
- [ ] Phase durations never go below minimums (Opening: 3min, Mini-Lesson: 3min, Work Time: 15min, Debrief: 5min)

### 3.3 Lock/unlock
- [ ] Click the lock button row below the bar
- [ ] Locked phase should show a lock icon and colored border
- [ ] Dragging adjacent boundary should NOT resize the locked phase

### 3.4 Timing warnings
- [ ] If mini-lesson exceeds instruction cap: red outline + "over cap" warning
- [ ] If work time < 45%: red outline + "too short" warning
- [ ] If debrief < 5 min: warning shown

### 3.5 Preset buttons
- [ ] Click "Balanced" — phases redistribute to default proportions
- [ ] Click "Hands-On" — work time maximised, instruction minimised
- [ ] Click "Instruction" — mini-lesson gets full instruction cap
- [ ] Click "Critique" — debrief extended to ~25% of usable time

### 3.6 Extensions display
- [ ] Below the timeline bar, extensions appear in a collapsible `<details>` section
- [ ] Shows count ("2 extensions for early finishers") and each extension with duration

---

## 4. Teacher UI — Unit Detail Page (Medium Priority)

The read-only timing visualisation on the unit overview.

### 4.1 MiniPhaseBar renders on lesson cards
- [ ] Go to `/teacher/units/[unitId]` for a journey-mode unit with workshopPhases
- [ ] Each lesson card should show a thin colored bar: purple → blue → green → amber
- [ ] Hovering bar segments shows phase name + duration tooltip
- [ ] Total minutes shown at the end of the bar

### 4.2 Extension count badge
- [ ] Lesson cards with extensions show a green "N ext" badge
- [ ] Cards without extensions show no badge

---

## 5. Types & Compilation (Verification)

### 5.1 TypeScript compiles
- [ ] Run `npx tsc --noEmit` — zero errors in timing-related files
- [ ] `WorkshopPhases` and `LessonExtension` types exist on `PageContent` interface
- [ ] `timing-validation.ts` imports resolve from `prompts.ts`

### 5.2 No regressions
- [ ] Pre-existing unit generation still works (backward compatible — workshopPhases is optional)
- [ ] Lessons without workshopPhases render normally (no crash, no timeline bar)
- [ ] Admin sandbox still works
- [ ] Journey wizard still works end-to-end

---

## 6. Not Yet Wired (Track for future)

These are built but not connected. Don't test yet — they'll fail.

- [ ] **TimingFeedbackPrompt** — component exists at `src/components/lesson-timing/TimingFeedbackPrompt.tsx` but not mounted anywhere. Needs: trigger mechanism, storage, feedback→profile pipeline.
- [ ] **Timeline mode validation** — `generate-timeline` does not call `validateLessonTiming()`. Activities are flat, not lesson objects. Needs different approach.
- [ ] **PhaseTimelineBar in timeline mode** — not mounted in `TimelineLessonCard` or `TimelineBuilder`.
- [ ] **Timing presets via API** — `applyTimingPreset()` function exists but no API route exposes it. Presets work client-side via PhaseTimelineBar buttons.
- [ ] **Multi-lesson pacing** — milestones, flex points, progress gates. Research done, not built.

---

## Quick Smoke Test (5 minutes)

If you only have 5 minutes, do this:

1. Open admin sandbox → generate a test lesson for Year 3, 60 minutes
2. Check response: does it have `workshopPhases`? Does `timingValidation` appear?
3. Open teacher wizard → create a journey unit → expand a lesson
4. Is the PhaseTimelineBar visible? Can you drag it?
5. Open unit detail page → do lesson cards show the mini phase bar?

If all 5 pass, the core system is working.
