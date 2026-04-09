# Phase 3 Wizard Integration Guide

## What You Built
Two new components for the 3-lane unit creation wizard:

1. **ModeSelector.tsx** (rewritten) — 3-lane card selector
2. **ArchitectForm.tsx** (new) — Power-user full form view

## Files Changed
- `/src/components/teacher/wizard/ModeSelector.tsx` — Completely rewritten
- `/src/components/teacher/wizard/ArchitectForm.tsx` — New file

## Integration Steps

### Step 1: Import Components
In `src/components/teacher/wizard/GoalInput.tsx`, add:

```typescript
import { ModeSelector } from "./ModeSelector";
import { ArchitectForm } from "./ArchitectForm";
```

### Step 2: Add Architect to Conditional Rendering
In the JSX of GoalInput, replace the mode-based rendering with:

```typescript
{state.mode === "undecided" && (
  <ModeSelector onSelectMode={(mode) => {
    dispatch({ type: "SET_MODE", mode });
    if (mode !== "undecided") {
      dispatch({ type: "SET_PHASE", phase: mode === "build-for-me" ? "goal" : mode === "guide-me" ? "guided" : "architect" });
    }
  }} />
)}

{state.mode === "build-for-me" && (
  <BuildForMeFlow state={state} dispatch={dispatch} onSelectMode={onSelectMode} />
)}

{state.mode === "guide-me" && (
  <GuidedConversation state={state} dispatch={dispatch} onSelectMode={onSelectMode} />
)}

{state.mode === "architect" && (
  <ArchitectForm
    state={state}
    dispatch={dispatch}
    onGenerate={() => {
      // Same generation handler as Express/Guided
      // Typically: dispatch({ type: "SET_PHASE", phase: "skeleton" }); handleGenerateSkeleton();
    }}
  />
)}
```

### Step 3: Phase Handling
Ensure GoalInput handles the "architect" phase. The phase flow should be:

```
goal → undecided (mode select) → {build-for-me|guide-me|architect} → approaches → ...
```

When user selects Architect:
1. `SET_MODE` dispatches "architect"
2. `SET_PHASE` dispatches "architect"
3. ArchitectForm renders

When user clicks "Generate Unit":
1. Call the same generation handler as Express/Guided
2. Transition to "skeleton" or "approaches" phase

### Step 4: Type Verification
The types are already in place. No changes needed to:
- `WizardMode` type (includes "architect")
- `WizardPhase` type (includes "architect")
- `WizardState` interface (supports all fields)
- Reducer actions (SET_INPUT, SET_JOURNEY_INPUT, SET_EMPHASIS all exist)

## Component API Reference

### ModeSelector Props
```typescript
interface Props {
  onSelectMode: (mode: WizardMode) => void;
}
```

### ArchitectForm Props
```typescript
interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onGenerate: () => void;
}
```

## Data Flow

### Express → Build for me (existing)
- User selects Express
- Mode = "build-for-me"
- Phase = "goal"
- Form shows: topic + grade only
- Generation auto-decides everything else

### Guided → Guide me (existing)
- User selects Guided
- Mode = "guide-me"
- Phase = "guided"
- Conversational flow with turns
- Each turn updates state, then user proceeds

### Architect → Power user (NEW)
- User selects Architect
- Mode = "architect"
- Phase = "architect"
- ArchitectForm renders all fields at once
- User can adjust any field before generating

## Dispatch Actions Used by ArchitectForm

### SET_INPUT
Updates main wizard input. Auto-resets type-specific fields when unitType changes.
```typescript
dispatch({ type: "SET_INPUT", key: "topic", value: "User's topic text" })
dispatch({ type: "SET_INPUT", key: "unitType", value: "design" })
```

### SET_JOURNEY_INPUT
Updates journey-specific fields (durationWeeks, lessonsPerWeek, etc.).
```typescript
dispatch({ type: "SET_JOURNEY_INPUT", key: "durationWeeks", value: 8 })
```

### SET_EMPHASIS
Updates criteria emphasis sliders.
```typescript
dispatch({ type: "SET_EMPHASIS", criterion: "A", value: 75 })
```

## Unit Type Behavior

ArchitectForm conditionally shows type-specific fields based on `state.input.unitType`:

- **design** (default) — Shows MYP-specific Design fields
- **service** — Shows Service Learning fields (community context, SDG, outcomes, partner)
- **personal_project** — Shows PP fields (interest, goal type, presentation format)
- **inquiry** — Shows Inquiry fields (central idea, theme, lines of inquiry)

Changing unitType automatically:
1. Resets `selectedCriteria` to the new type's criterion set
2. Resets `criteriaFocus` to "standard" for all criteria
3. Clears all type-specific fields in both `input` and `journeyInput`
4. This happens via the reducer's SET_INPUT handler (no special dispatch needed)

## Responsive Design

Both components are mobile-responsive:

### ModeSelector
```
Mobile:   1 column (100% width)
Tablet:   1 column (wider cards)
Desktop:  3 columns
```

### ArchitectForm
```
Mobile:   Single column, full-width fields
Tablet:   2 columns in Duration & Grade section, others single
Desktop:  As above
```

## Styling Notes

- **No lucide-react** — All icons are inline SVGs
- **Tailwind only** — No CSS-in-JS or separate stylesheets
- **Brand colors** — `bg-brand-purple`, `hover:bg-brand-violet`
- **Consistent spacing** — `p-6` on cards, `gap-4` between sections
- **Focus states** — `focus:ring-2 focus:ring-brand-purple/20`

## Testing Checklist

- [ ] ModeSelector displays 3 cards
- [ ] Clicking Express dispatches "build-for-me"
- [ ] Clicking Guided dispatches "guide-me"
- [ ] Clicking Architect dispatches "architect"
- [ ] ArchitectForm loads when mode = "architect"
- [ ] Unit type selector shows 4 cards
- [ ] Changing unit type hides/shows correct type-specific fields
- [ ] All form fields update state correctly
- [ ] Criteria sliders work (0-100)
- [ ] ATL Skills pills toggle correctly
- [ ] Generate button triggers onGenerate callback
- [ ] Mobile responsive (test at 640px and 1024px)
- [ ] No console errors

## Common Issues & Solutions

### Form fields not updating
**Cause:** Dispatch action incorrect or field key mismatch
**Solution:** Check that dispatch uses `SET_INPUT` (unit fields) vs `SET_JOURNEY_INPUT` (journey fields)

### Type-specific fields not hiding
**Cause:** `state.input.unitType` not set or wrong value
**Solution:** Ensure unitType is set before rendering conditional sections

### Criteria not showing
**Cause:** `getCriteriaForType` not getting correct unitType
**Solution:** Check that unitType is passed correctly to getCriteriaForType()

### Generate button not working
**Cause:** `onGenerate` callback not passed or not doing anything
**Solution:** Ensure GoalInput passes onGenerate prop and implements generation logic

## Next Steps After Integration

1. **E2E Testing** — Test the full wizard flow (all 3 lanes)
2. **Generation Testing** — Verify generated units from Architect lane
3. **Unit Type Testing** — Test each unit type (Design, Service, PP, Inquiry)
4. **Mobile Testing** — Test on phone, tablet, desktop
5. **Edge Cases** — Test with empty/invalid inputs, character limits, etc.

## Rollback Plan

If you need to revert to 2-lane mode:
1. Restore original ModeSelector.tsx from git
2. Remove ArchitectForm import from GoalInput
3. Remove architect mode conditional from JSX
4. Architect mode will never be selected

## Questions?

Refer to:
- `WIZARD_PHASE3_BUILD_NOTES.md` — Detailed component documentation
- Component files themselves — Inline comments and clear variable names
- `src/hooks/useWizardState.ts` — Action types and reducer logic
- `src/lib/constants.ts` — All option arrays (MYP, Service, PP, Inquiry)
