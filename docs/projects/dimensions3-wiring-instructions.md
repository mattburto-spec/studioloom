# Dimensions3 — Wire Pipeline to Wizard Routes

## CRITICAL: Git & File Rules

1. **Work directly on the `main` branch.** Do NOT use worktrees, do NOT create a new branch.
2. **All file paths use the full path from `/questerra/`.** Not relative paths.
3. **When all tasks are complete, `git add` the new/changed files and `git commit` them on main.**
4. **Verify the commit exists with `git log --oneline -3` before reporting done.**

---

## Context

The Dimensions3 pipeline rebuild is COMPLETE (Phases A-E). The 6-stage generation pipeline (`src/lib/pipeline/orchestrator.ts`) is built and tested, but the wizard UI still shows "Unit Builder is Being Rebuilt" because the old generation routes were quarantined (returning 410 Gone) on 3 Apr 2026. This task wires the new pipeline to the existing wizard UI so teachers can generate units again.

**The approach:** Don't rewrite the wizard UI. The existing 3-lane wizard (Express/Guided/Architect) with `useWizardState` and `ConversationWizard` works. We just need to:
1. Un-quarantine the wizard page
2. Replace the old generation API route with a new one that calls the Dimensions3 pipeline
3. Map the wizard's `UnitWizardInput` → pipeline's `GenerationRequest`
4. Map the pipeline's `TimedUnit` output → the wizard's `UnitContentDataV2`/`UnitPage` format that gets saved to the `units` table
5. Re-enable the "Build with AI" button

---

## What Already Exists

**Pipeline (on `main`, all working):**
- `/questerra/src/lib/pipeline/orchestrator.ts` — `runPipeline(request, config)` → `OrchestratorResult`
- `/questerra/src/types/activity-blocks.ts` — `GenerationRequest`, `TimedUnit`, `QualityReport`, etc.
- `/questerra/src/lib/pipeline/stages/` — 6 real stages
- `/questerra/src/lib/feedback/edit-tracker.ts` — `computeEditDiffs()` for tracking teacher changes

**Wizard UI (quarantined but code intact):**
- `/questerra/src/app/teacher/units/create/page.tsx` — Wizard page (currently returns "Being Rebuilt" message, but full wizard code is below the early return)
- `/questerra/src/hooks/useWizardState.ts` — State machine (73 reducer actions, `WizardMode`: undecided/build-for-me/guide-me/architect)
- `/questerra/src/hooks/useWizardSuggestions.ts` — AI suggestions for wizard input
- `/questerra/src/components/teacher/wizard/` — 30 UI components (ConversationWizard, GuidedConversation, ArchitectForm, ModeSelector, etc.)

**Quarantined routes (all return 410 Gone):**
- `/questerra/src/app/api/teacher/generate-unit/route.ts` — Main generation endpoint
- `/questerra/src/app/api/teacher/generate-outlines/route.ts` — Approach outlines
- `/questerra/src/app/api/teacher/generate-timeline/route.ts` — Timeline generation
- `/questerra/src/app/api/teacher/generate-timeline-skeleton/route.ts` — Skeleton generation
- `/questerra/src/app/api/teacher/generate-timeline-outlines/route.ts` — Timeline outlines
- `/questerra/src/app/api/teacher/generate-timeline-outline-single/route.ts` — Single outline
- `/questerra/src/app/api/teacher/generate-journey/route.ts` — Journey generation
- `/questerra/src/app/api/teacher/generate-journey-outlines/route.ts` — Journey outlines
- `/questerra/src/app/api/teacher/regenerate-page/route.ts` — Page regeneration
- `/questerra/src/app/api/teacher/wizard-suggest/route.ts` — Wizard suggestions
- Plus 4 more (see `/questerra/docs/quarantine.md` lines 138-153)

**Key types (old wizard):**
- `UnitWizardInput` at `/questerra/src/types/index.ts` line 635 — what the wizard collects from teachers
- `UnitContentDataV2` / `UnitPage` — what gets saved to `units.content_data`

**Key types (new pipeline):**
- `GenerationRequest` at `/questerra/src/types/activity-blocks.ts` line 159 — what the pipeline expects
- `TimedUnit` — what the pipeline outputs (lessons with timed activities)

---

## Tasks

### Task W1: Input Adapter — UnitWizardInput → GenerationRequest

**Purpose:** Bridge between what the wizard collects and what the pipeline expects.

The wizard collects `UnitWizardInput` (title, topic, gradeLevel, durationWeeks, criteria, concepts, resources, unit type, framework, etc.). The pipeline expects `GenerationRequest` (topic, unitType, lessonCount, gradeLevel, framework, constraints, context, preferences).

**Create:** `/questerra/src/lib/pipeline/adapters/input-adapter.ts`

```typescript
export function wizardInputToGenerationRequest(input: UnitWizardInput): GenerationRequest
```

**Mapping logic:**
- `topic` ← `input.topic` (or fallback to `input.title`)
- `unitType` ← `input.unitType || 'design'`
- `lessonCount` ← derive from `input.durationWeeks` (e.g., weeks × lessons-per-week, default 2 per week, cap at 20)
- `gradeLevel` ← `input.gradeLevel`
- `framework` ← `input.framework || 'IB_MYP'` (default for legacy data)
- `constraints.availableResources` ← parse from `input.specialRequirements` or default `[]`
- `constraints.periodMinutes` ← default 60 (can be enhanced later with class timetable data)
- `constraints.workshopAccess` ← parse from `input.specialRequirements` or default `true`
- `constraints.softwareAvailable` ← default `[]`
- `context.realWorldContext` ← `input.realWorldContext`
- `context.studentContext` ← `input.studentContext`
- `context.classroomConstraints` ← `input.classroomConstraints`
- `preferences.emphasisAreas` ← `input.selectedCriteria`
- `preferences.criteriaEmphasis` ← `input.criteriaFocus` converted to numeric weights
- `curriculumContext` ← `input.curriculumContext`

### Task W2: Output Adapter — TimedUnit → UnitContentData

**Purpose:** Convert the pipeline's output format into the format the existing unit save/display code expects.

The pipeline produces `TimedUnit` (lessons → phases → activities with timing metadata). The units table stores `content_data` as JSONB matching `UnitContentDataV2` (pages array with content per criterion).

**Create:** `/questerra/src/lib/pipeline/adapters/output-adapter.ts`

```typescript
export function timedUnitToContentData(
  timedUnit: TimedUnit,
  qualityReport: QualityReport,
  wizardInput: UnitWizardInput
): { contentData: UnitContentDataV2; pages: UnitPage[] }
```

**This is the hardest part.** Read the existing `UnitContentDataV2` type at `/questerra/src/types/index.ts` (search for `UnitContentDataV2`) and the `UnitPage` type to understand what fields the lesson editor, Teaching Mode, and student experience expect. The adapter must produce data that these downstream consumers can render.

Key output structure the system expects:
- Each "page" = one criterion's worth of lessons (or one lesson depending on content version)
- Activities need: title, description/prompt, duration, grouping, materials
- The content_data should include lesson structure that Teaching Mode can display

**Important:** If the mapping isn't perfect, that's OK for v1 — the lesson editor lets teachers fix anything. But the generated content MUST be renderable without crashes.

### Task W3: New Generation API Route

**Purpose:** Replace the quarantined `/api/teacher/generate-unit` with a new route that calls the Dimensions3 pipeline.

**Modify:** `/questerra/src/app/api/teacher/generate-unit/route.ts`

Remove the quarantine early return. Replace the old generation logic with:

1. Auth check (existing pattern — `supabase.auth.getUser()`)
2. Parse request body to get `wizardInput` (and optionally `criterion`, `selectedOutline`)
3. Convert via `wizardInputToGenerationRequest(wizardInput)`
4. Call `runPipeline(generationRequest, config)` from the orchestrator
5. Convert via `timedUnitToContentData(result.timedUnit, result.qualityReport, wizardInput)`
6. Save the unit to `units` table (existing save logic can be reused — look at the code below the quarantine return in the current file)
7. Return the generated pages + quality report + cost info

**For SSE streaming:** The old route supported `stream: true` with Server-Sent Events. For v1, it's OK to NOT support streaming — just return the full result as JSON. The wizard handles both paths (check `contentType.includes("text/event-stream")` in the wizard page). If `stream` is false or absent, it falls through to the JSON path.

**Config for orchestrator:**
```typescript
const config: OrchestratorConfig = {
  supabase,
  teacherId: user.id,
  apiKey: process.env.ANTHROPIC_API_KEY!,
  sandboxMode: false,
  modelId: 'claude-sonnet-4-20250514', // or read from admin settings
};
```

### Task W4: Un-quarantine the Wizard Page

**Modify:** `/questerra/src/app/teacher/units/create/page.tsx`

Remove the early return that shows "Unit Builder is Being Rebuilt". The full wizard code is below it and should work once the API route is live.

Specifically, delete lines 16-36 (the quarantine message + early return). The existing wizard code from line 38 onward should then execute.

### Task W5: Re-enable UI Buttons

**Modify:** `/questerra/src/app/teacher/units/page.tsx`

1. Find the "Build with AI (Coming Soon)" `<span>` (around line 533) — change it back to a `<Link href="/teacher/units/create">` with the original styling (purple gradient button)
2. Find the empty-state "Build with AI (Coming Soon)" (search for the second occurrence) — same change
3. Find "Import (Coming Soon)" buttons — leave these quarantined for now (unit import is via `/teacher/knowledge/import`, a different flow)

**Also check:** `/questerra/src/components/teacher/TeacherAIFAB.tsx` line ~46 — the "Build Unit" FAB action was commented out. Un-comment `window.location.href = '/teacher/units/create'` so the floating button works again.

### Task W6: Handle Remaining Quarantined Routes

Some of the quarantined routes are called by the wizard during its multi-step flow. These need to either be un-quarantined and connected to the new pipeline, or gracefully handled:

**Routes the wizard actually calls (un-quarantine these):**
- `/api/teacher/generate-outlines` — Called when wizard generates approach options. For v1, this can call the pipeline in sandbox mode to generate 2-3 outline variants, OR use a simpler Haiku call to suggest approaches. The wizard's `generateOutlines()` function posts `wizardInput` and expects `{ options: OutlineOption[] }`.
- `/api/teacher/wizard-suggest` — Called by `useWizardSuggestions` hook. Provides AI suggestions as teacher types. This is a lightweight Haiku call — can be un-quarantined as-is (it doesn't use the generation pipeline).

**Routes that can stay quarantined for now:**
- `generate-timeline`, `generate-timeline-outlines`, `generate-timeline-skeleton`, `generate-timeline-outline-single` — These were for the old timeline-based generation flow. The new pipeline replaces them entirely.
- `generate-journey`, `generate-journey-outlines` — Journey-based generation (v3 flow). Not part of the current pipeline.
- `regenerate-page` — Page-level regeneration. Can be added later.
- `convert-lesson` — Lesson plan converter. Now handled by unit import (Phase E).
- `activity-cards/generate-modifiers` — Activity modifier generation. Low priority.
- `admin/ai-model/test`, `admin/ai-model/test-lesson` — Admin test routes. Can be connected to sandbox mode later.

### Task W7: Edit Tracking Integration

**Purpose:** When a teacher saves edits to a pipeline-generated unit, track the diffs for the feedback system.

**Modify:** The unit save/update route (find where units are saved after editing — likely in the lesson editor save flow).

After a teacher saves changes to a generated unit:
1. Check if the unit was pipeline-generated (`units.pipeline_metadata` is not null, or `created_via_pipeline` flag)
2. If yes, call `computeEditDiffs(originalActivities, editedActivities)` from `/questerra/src/lib/feedback/edit-tracker.ts`
3. Store the diffs in `generation_feedback` table

This can be a lightweight addition — just import `computeEditDiffs` and call it in the existing save handler. Don't restructure the save flow.

### Task W8: Tests

Write tests covering:
1. Input adapter: `wizardInputToGenerationRequest()` — test with minimal input, full input, each unit type
2. Output adapter: `timedUnitToContentData()` — test that output matches expected UnitContentDataV2 shape
3. Route integration: mock the orchestrator, verify the route calls it correctly and returns valid response
4. At least 15 tests total

**Where:** `/questerra/src/lib/pipeline/adapters/__tests__/adapters.test.ts`

---

## Spec References (READ THESE)

- **Dimensions3 spec:** `/questerra/docs/projects/dimensions3.md`
  - Section 3 "Stage 0: Input Collection" (line ~60) — what GenerationRequest should contain
  - Section 3 end — full pipeline flow
- **Quarantine register:** `/questerra/docs/quarantine.md` — all 42 quarantined entry points
- **Pipeline orchestrator:** `/questerra/src/lib/pipeline/orchestrator.ts` — `runPipeline()` API
- **Pipeline types:** `/questerra/src/types/activity-blocks.ts` — `GenerationRequest`, `TimedUnit`, etc.
- **Wizard state machine:** `/questerra/src/hooks/useWizardState.ts` — all wizard phases and modes
- **Wizard page:** `/questerra/src/app/teacher/units/create/page.tsx` — full wizard code (below quarantine return)
- **Old generation route:** `/questerra/src/app/api/teacher/generate-unit/route.ts` — shows auth pattern + old generation flow
- **Unit types:** `/questerra/src/types/index.ts` — `UnitWizardInput` (line 635), `UnitContentDataV2`, `UnitPage`
- **Edit tracker:** `/questerra/src/lib/feedback/edit-tracker.ts` — `computeEditDiffs()`
- **Format profiles:** `/questerra/src/lib/ai/unit-types.ts` — `getFormatProfile()`

## Critical Constraints

1. **Haiku model ID:** `claude-haiku-4-5-20251001`
2. **Sonnet model ID:** `claude-sonnet-4-20250514`
3. **Build must pass clean** — `npx next build`
4. **Don't break the lesson editor, Teaching Mode, or student experience.** The output adapter MUST produce data these systems can render. If unsure about a field, look at how existing units store their `content_data` and match that shape.
5. **Don't modify the wizard UI components** unless strictly necessary. They work — we're just reconnecting the backend.
6. **Existing manual unit creation must keep working.** The "Manual" button flow is separate and untouched.
7. **When un-quarantining, remove the quarantine comment and the early return.** Don't leave dead quarantine code.
