# WorkshopPhases Type & workshopPhases Field — Complete Usage Audit

**Last updated:** 2 April 2026
**Search pattern:** `workshopPhases`, `WorkshopPhases`, `.opening`, `.miniLesson`, `.workTime`, `.debrief`
**Total files found:** 26 source files + 1 usage guide + 1 test file

---

## Type Definition

### `WorkshopPhases` Interface (2 definitions)

**Primary definition:** `src/lib/ai/timing-validation.ts:36`
```typescript
export interface WorkshopPhases {
  opening: {
    durationMinutes: number;
    hook?: string;
  };
  miniLesson: {
    durationMinutes: number;
    focus?: string;
  };
  workTime: {
    durationMinutes: number;
    focus?: string;
    checkpoints?: string[];
  };
  debrief: {
    durationMinutes: number;
    protocol?: string;
    prompt?: string;
  };
}
```

**Secondary definition (re-export):** `src/types/index.ts:415`
Exports the same interface and adds it to `PageContent` as optional field `workshopPhases?: WorkshopPhases` (line 442).

---

## Usage by Category

### 1. TYPE IMPORTS (Where WorkshopPhases is imported)

| File | Line(s) | Usage |
|------|---------|-------|
| `src/types/index.ts` | 415 | Definition (imported from timing-validation.ts) |
| `src/app/teacher/teach/[unitId]/page.tsx` | 15, 291 | Type annotation for local variable |
| `src/app/teacher/teach/[unitId]/projector/page.tsx` | 7, 105 | Type annotation |
| `src/components/teach/PhaseTimer.tsx` | 4, 23 | Type annotation for prop |
| `src/app/teacher/units/[unitId]/page.tsx` | 23, 680 | Type annotation |
| `src/components/teacher/lesson-editor/LessonEditor.tsx` | 26, 308, 309 | Type annotation for state updates |
| `src/components/teacher/wizard/JourneyLessonCard.tsx` | 4 | Type annotation |

---

### 2. PHASE PROPERTY ACCESS (Reading specific phase fields)

These files access the 4 phases and their sub-properties:

#### Opening Phase (.opening.durationMinutes, .opening.hook)
| File | Lines | Purpose |
|------|-------|---------|
| `src/components/teacher/lesson-editor/LessonEditor.tsx` | 379, 537, 840, 846 | Reads duration, reads hook for editing, renders timeline bar |
| `src/components/teach/PhaseTimer.tsx` | 61-65 | Extracts opening duration and hook for phase timer |
| `src/components/lesson-timing/PhaseTimelineBar.tsx` | 73 | Sets default duration for timeline bar |
| `src/components/teach/QuickEdit.tsx` | 41, 48, 87 | Reads hook and duration from content |
| `src/app/teacher/teach/[unitId]/page.tsx` | 820 | Displays hook on projector |
| `src/app/teacher/teach/[unitId]/projector/page.tsx` | 203 | Displays hook on projector |
| `src/app/api/teacher/lesson-editor/suggest/route.ts` | 61 | Includes in context for AI suggestions |
| `src/app/api/teacher/teach/quick-edit/route.ts` | 68 | Updates duration in quick-edit |
| `src/lib/ai/__tests__/timing-validation.test.ts` | 139, 160 | Tests opening duration validation |

#### Mini-Lesson Phase (.miniLesson.durationMinutes, .miniLesson.focus)
| File | Lines | Purpose |
|------|-------|---------|
| `src/components/teacher/lesson-editor/LessonEditor.tsx` | 380, 538, 909, 915 | Reads duration, reads focus for editing |
| `src/components/teach/PhaseTimer.tsx` | 70-74 | Extracts for phase timer |
| `src/components/lesson-timing/PhaseTimelineBar.tsx` | 74 | Sets default duration |
| `src/components/teach/QuickEdit.tsx` | 42, 49, 90 | Reads focus and duration |
| `src/app/teacher/teach/[unitId]/page.tsx` | 831 | Displays focus on dashboard |
| `src/app/teacher/teach/[unitId]/projector/page.tsx` | 214 | Displays focus on projector |
| `src/app/api/teacher/lesson-editor/suggest/route.ts` | 62 | Includes in context |
| `src/app/api/teacher/teach/quick-edit/route.ts` | 69 | Updates duration |
| `src/lib/ai/__tests__/timing-validation.test.ts` | 140, 161 | Tests validation |
| `src/lib/ai/timing-validation.ts` | 168-211 | Instruction cap validation, clamping, redistribution |

#### Work Time Phase (.workTime.durationMinutes, .workTime.focus, .workTime.checkpoints)
| File | Lines | Purpose |
|------|-------|---------|
| `src/components/teacher/lesson-editor/LessonEditor.tsx` | 381, 965, 1059-1064 | Reads duration for timeline + activity overflow warning |
| `src/components/teach/PhaseTimer.tsx` | 79-83, 368, 374 | Extracts for timer, displays checkpoints if exist |
| `src/components/lesson-timing/PhaseTimelineBar.tsx` | 75 | Sets default duration |
| `src/components/teach/QuickEdit.tsx` | 50, 106 | Reads and updates duration |
| `src/app/teacher/teach/[unitId]/page.tsx` | 507, 814-842 | Displays focus and hooks on teaching dashboard |
| `src/app/teacher/teach/[unitId]/projector/page.tsx` | 226, 249, 254 | Displays focus and checkpoints on projector |
| `src/app/api/teacher/teach/quick-edit/route.ts` | 70 | Updates duration |
| `src/lib/ai/__tests__/timing-validation.test.ts` | 141, 162, 176-177 | Tests work time floor validation |
| `src/lib/ai/timing-validation.ts` | 183-211, 285, 293, 326 | Work time floor checks, checkpoint generation, stats |

#### Debrief Phase (.debrief.durationMinutes, .debrief.protocol, .debrief.prompt)
| File | Lines | Purpose |
|------|-------|---------|
| `src/components/teacher/lesson-editor/LessonEditor.tsx` | 382, 540, 541, 1112, 1129 | Reads duration, protocol, prompt for editing |
| `src/components/teach/PhaseTimer.tsx` | 88-92 | Extracts for phase timer |
| `src/components/lesson-timing/PhaseTimelineBar.tsx` | 76 | Sets default duration |
| `src/components/teach/QuickEdit.tsx` | 43, 51, 97, 98 | Reads prompt and duration |
| `src/app/teacher/teach/[unitId]/page.tsx` | 842 | Displays protocol/prompt on dashboard |
| `src/app/teacher/teach/[unitId]/projector/page.tsx` | 271, 276 | Displays protocol and prompt on projector |
| `src/app/api/teacher/lesson-editor/suggest/route.ts` | 63 | Includes in context |
| `src/app/api/teacher/teach/quick-edit/route.ts` | 71 | Updates duration |
| `src/lib/ai/__tests__/timing-validation.test.ts` | 142, 163 | Tests debrief duration |
| `src/lib/ai/timing-validation.ts` | 217-257 | Debrief presence checks, auto-generation |

---

### 3. WORKSHOPPHASES FIELD WRITE/UPDATE OPERATIONS

These files CREATE or MODIFY `workshopPhases` on page objects:

| File | Lines | Operation | Context |
|------|-------|-----------|---------|
| `src/components/teacher/lesson-editor/useLessonEditor.ts` | 279 | Creates workshopPhases structure during page creation | Lesson editor new page |
| `src/components/teacher/lesson-editor/LessonEditor.tsx` | 313-315, 731 | Updates phase properties via `updatePhaseData()` function | Lesson editor inline edits |
| `src/components/teacher/wizard/JourneyLessonCard.tsx` | 337-342 | Creates new WorkshopPhases with updated durations | Timeline bar phase resize |
| `src/lib/ai/timing-validation.ts` | 161 | Auto-generates missing workshopPhases via `inferWorkshopPhases()` | Timing repair after generation |
| `src/lib/ai/timing-validation.ts` | 168-257 | Modifies phase durations during validation/repair | Auto-repair rules (cap, floor, etc.) |
| `src/app/api/teacher/generate-unit/route.ts` | 217 | Applies repaired workshopPhases back to page | Generation pipeline |
| `src/app/api/teacher/regenerate-page/route.ts` | 216 | Applies repaired workshopPhases | Page regeneration |
| `src/app/api/teacher/teach/quick-edit/route.ts` | 66-71 | Updates phase durations from quick-edit form | Mid-lesson duration adjustment |

---

### 4. WORKSHOPPHASES READS (Reading full structure or checking existence)

| File | Lines | Purpose |
|------|-------|---------|
| `src/components/teacher/lesson-editor/LessonEditor.tsx` | 311, 377 | Checks existence, reads for phase calculations |
| `src/components/teacher/wizard/JourneyLessonCard.tsx` | 320-343 | Reads full structure for timeline bar rendering |
| `src/app/teacher/units/[unitId]/page.tsx` | 680, 1222-1227 | Reads for MiniPhaseBar component |
| `src/app/teacher/teach/[unitId]/page.tsx` | 291, 470, 535, 542 | Reads and checks existence, passes to PhaseTimer |
| `src/app/teacher/teach/[unitId]/projector/page.tsx` | 105, 189-192 | Reads and passes to PhaseTimer |
| `src/components/teach/PhaseTimer.tsx` | 23, 108 | Receives as prop and extracts phase data |
| `src/app/api/teacher/generate-journey/route.ts` | 233 | Checks if workshopPhases exists before validation |
| `src/lib/ai/__tests__/timing-validation.test.ts` | 54, 61 | Reads and validates structure in tests |

---

### 5. GENERATION SCHEMAS (AI output structure)

These files define the JSON schema that tells Claude AI to output `workshopPhases`:

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/ai/schemas.ts` | 238 | Defines workshopPhases in page content schema for AI tool |
| `src/lib/ai/prompts.ts` | 1079, 1131 | Instructs AI to include workshopPhases with timing details |
| `src/lib/ai/unit-types.ts` | 393, 445 | Type-specific instructions for workshopPhases generation |
| `src/app/api/teacher/convert-lesson/route.ts` | 596 | Notes workshopPhases as observation, not mandate |

---

### 6. VALIDATION & AUTO-REPAIR (Critical functions)

**`src/lib/ai/timing-validation.ts`** — The central validation and repair engine:

| Function | Lines | Purpose |
|----------|-------|---------|
| `validateLessonTiming()` | 119-340+ | Main validation entry point, checks 8 rules, auto-repairs |
| `inferWorkshopPhases()` | 470+ | Generates default workshopPhases if missing |
| `repairWorkshopPhases()` | 145-300+ | Core repair logic: validates instruction cap, work time floor, debrief presence, total time match, adds checkpoints |
| `validateUnitTiming()` | 358-410+ | Unit-level validation across all lessons |

**Rules implemented in repair logic (lines 168-257):**
1. **Instruction cap** (line 168): Clamps miniLesson to 1+age formula
2. **Work time floor** (line 183): Ensures work time ≥ 45% of usable time (or per structure)
3. **Debrief presence** (line 217): Guarantees debrief if required (5+ min)
4. **Total time match** (line 249): Redistributes excess time back to work time
5. **Checkpoint generation** (line 285): Adds midpoint check-in if work time ≥ 30 min
6. **Auto-protocol** (line 237): Assigns default debrief protocol if none exists

---

### 7. TESTS

**`src/lib/ai/__tests__/timing-validation.test.ts`**

| Test | Lines | Coverage |
|------|-------|----------|
| "auto-repairs missing workshopPhases" | 57-64 | Generates structure from inferred phases |
| "clamps instruction to 1+age rule" | 65-81 | Instruction cap validation |
| "ensures minimum debrief" | 82-95 | Debrief presence check |
| "enforces work time floor (45%)" | 96-125 | Work time floor validation |
| "validates unit timing across lessons" | 126-165 | Multi-lesson validation |
| "timing presets scale work time" | 166-182 | Preset application |

All tests access phase properties via dot notation: `.opening.durationMinutes`, `.miniLesson.focus`, etc.

---

### 8. USAGE GUIDE DOCUMENTATION

**`src/components/teacher/lesson-editor/USAGE-GUIDE.md`**

Lines 136-461 show example code patterns for:
- Reading phase durations (`workshopPhases?.opening.durationMinutes`)
- Reading phase content (`workshopPhases.miniLesson?.focus`)
- Updating phase data via lesson editor state

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| **Total files with workshopPhases references** | 26 |
| **Total references to workshopPhases property** | ~150+ |
| **Total references to phase sub-properties** | ~160+ |
| **Phase duration accesses** | ~70+ |
| **Phase content accesses (hook/focus/protocol/prompt)** | ~45+ |
| **workshopPhases writes/updates** | 8 files |
| **workshopPhases reads/checks** | 18+ files |
| **Validation/repair functions** | 4 major functions in timing-validation.ts |
| **Test cases** | 7 test suites |

---

## Critical Dependencies

### Files that MUST NOT break:

1. **`src/lib/ai/timing-validation.ts`** — Core repair logic. Changes here cascade to all generation routes.
2. **`src/types/index.ts`** — Type definition. Must stay compatible with PageContent interface.
3. **`src/components/teach/PhaseTimer.tsx`** — Reads all 4 phase properties. Used in Teaching Mode + Projector.
4. **`src/components/teacher/lesson-editor/LessonEditor.tsx`** — Reads and writes all phases. Used in lesson editing.
5. **`src/components/teacher/wizard/JourneyLessonCard.tsx`** — Reads and updates phases. Used in unit builder review.

### API routes affected by workshopPhases changes:

- `src/app/api/teacher/generate-unit/route.ts` — Validates/repairs on save
- `src/app/api/teacher/generate-journey/route.ts` — Validates on generation
- `src/app/api/teacher/regenerate-page/route.ts` — Repairs on regeneration
- `src/app/api/teacher/teach/quick-edit/route.ts` — Updates phase durations mid-lesson
- `src/app/api/teacher/lesson-editor/suggest/route.ts` — Includes phases in AI context

---

## Common Patterns

### Pattern 1: Safe reads with nullish coalescing
```typescript
const duration = content?.workshopPhases?.opening?.durationMinutes || 10;
const hook = workshopPhases?.opening?.hook || "";
```

### Pattern 2: Phase iteration
```typescript
const phases = [
  { key: "opening", durationMinutes: wp.opening.durationMinutes },
  { key: "miniLesson", durationMinutes: wp.miniLesson.durationMinutes },
  { key: "workTime", durationMinutes: wp.workTime.durationMinutes },
  { key: "debrief", durationMinutes: wp.debrief.durationMinutes },
];
```

### Pattern 3: Phase update via lesson editor
```typescript
const updatePhaseData = (phase: keyof WorkshopPhases, partial: Partial<WorkshopPhases[keyof WorkshopPhases]>) => {
  if (!pageContent?.workshopPhases) return;
  setPageContent({
    ...pageContent,
    workshopPhases: {
      ...pageContent.workshopPhases,
      [phase]: { ...pageContent.workshopPhases[phase], ...partial },
    },
  });
};
```

### Pattern 4: Repair after AI generation
```typescript
if (lessonPage.workshopPhases) {
  const result = validateLessonTiming(lessonPage, usableMinutes, instructionCap, gradeProfile, structure);
  if (result.isValid === false) {
    lessonPage.workshopPhases = result.repairedLesson.workshopPhases;
  }
}
```

---

## Recommendations

### For any change to workshopPhases:

1. **Update the type definition** in both `timing-validation.ts` and `types/index.ts`
2. **Update AI schemas** in `schemas.ts` and `prompts.ts` so Claude outputs the new structure
3. **Update repair logic** in `timing-validation.ts` if adding new validation rules
4. **Update UI components** that read/display phases (PhaseTimer, LessonEditor, JourneyLessonCard, QuickEdit)
5. **Update tests** in `timing-validation.test.ts` to cover new fields
6. **Update all API routes** that generate/save content (generate-unit, regenerate-page, teach/quick-edit)
7. **Update the usage guide** in `USAGE-GUIDE.md` with new patterns

### For removing/renaming fields:

1. Add migration logic in `timing-validation.ts` to handle old schemas
2. Use `.maybeSingle()` patterns to handle missing columns gracefully
3. Add try/catch around phase field access in all components

