# Wizard Phase 3: 3-Lane Selector & Architect Form — Build Notes

## Overview
Built two components for the Unit Creation Wizard's Phase 3 — the 3-lane selector system and Architect form.

## Files Created/Modified

### 1. ModeSelector.tsx (Rewritten)
**Location:** `src/components/teacher/wizard/ModeSelector.tsx`

Replaced 2-button layout with 3-lane card selector:
- **Express** (⚡ icon) — Purple filled, primary CTA
- **Guided** (💬 icon) — White bordered
- **Architect** (🔧 icon) — White bordered

Each card shows:
- Icon in icon box
- Title (large)
- Tagline (small)
- Subtitle with details

Exports as `ModeSelector` for backward compatibility.

**Props:**
```typescript
interface Props {
  onSelectMode: (mode: WizardMode) => void;
}
```

**Action:**
- Express → `onSelectMode("build-for-me")`
- Guided → `onSelectMode("guide-me")`
- Architect → `onSelectMode("architect" as WizardMode)`

Import link to `/teacher/units/import` preserved.

---

### 2. ArchitectForm.tsx (New)
**Location:** `src/components/teacher/wizard/ArchitectForm.tsx`

Single-page scrollable form showing ALL wizard fields at once. Designed for power users who want full control.

**Sections:**

#### Section 1: Unit Identity
- Unit type selector (4 cards — Design/Service/PP/Inquiry)
- Topic/goal textarea (required)
- Unit title input (required)
- Curriculum context (optional)

#### Section 2: MYP Framework
- Global Context dropdown (6 MYP options)
- Key Concept dropdown (16 IB concepts)
- Related Concepts comma-separated input
- Statement of Inquiry textarea
- ATL Skills pills (Communication, Social, Self-management, Research, Thinking)

#### Section 3: Type-Specific Fields
Show/hide based on `state.input.unitType`:

**Service Learning:**
- Community Context dropdown
- SDG Connection dropdown
- Service Outcomes dropdown
- Partner Type dropdown

**Personal Project:**
- Personal Interest text input
- Goal Type dropdown
- Presentation Format dropdown

**Inquiry Unit:**
- Central Idea textarea
- Transdisciplinary Theme dropdown
- Lines of Inquiry textarea (one per line)

#### Section 4: Duration & Grade
4 fields in 2-column grid:
- Grade Level dropdown (1-13)
- Duration weeks (number, 1-52)
- Lessons per week (number, 1-7)
- Lesson length minutes (number, 15-240, step=5)

#### Section 5: Criteria Emphasis
Sliders for each criterion (0-100) with labels:
- Light (0-33%)
- Standard (34-66%)
- Emphasis (67-100%)

Criteria set depends on unitType (via `getCriteriaForType(unitType)`).

#### Generate Button
Purple button spanning full width at bottom.

**Props:**
```typescript
interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onGenerate: () => void;
}
```

**Dispatch Helpers:**
- `dispatch({ type: "SET_INPUT", key, value })` for unit input fields
- `dispatch({ type: "SET_JOURNEY_INPUT", key, value })` for journey-specific fields
- `dispatch({ type: "SET_EMPHASIS", criterion, value })` for criteria emphasis

**Unit Type Change Behavior:**
Setting `unitType` via SET_INPUT automatically:
- Resets selectedCriteria to the new type's full criterion set
- Resets criteriaFocus to "standard" for all criteria
- Clears all type-specific fields (via reducer logic in useWizardState.ts)
- Syncs both `input` and `journeyInput` state

No manual reset dispatch needed.

---

## Design Patterns

### Styling
- Tailwind classes only (no lucide-react — project doesn't use it)
- White cards with `rounded-2xl border border-border`
- Section headers: `text-sm font-bold text-text-secondary uppercase tracking-wide`
- Purple brand color: `bg-brand-purple`, `hover:bg-brand-violet`
- Input focus: `focus:ring-2 focus:ring-brand-purple/20`
- All icons: inline SVGs (no external icon library)

### Field Updates
- Textarea fields use `rows={N}` for height
- Range inputs use accent color `accent-brand-purple`
- Number inputs have sensible min/max/step values
- Pills/chips toggle selection state

### Responsive
- Section 4 (Duration & Grade) uses `grid grid-cols-2` (2 columns)
- Section 1 (Unit Type) uses `grid grid-cols-2 sm:grid-cols-4`
- Main container: `max-w-3xl mx-auto`
- Full animation on mount: `animate-slide-up`

---

## Integration Notes

### In GoalInput.tsx
Replace the import and component usage:
```typescript
// Change from:
import { ModeSelector } from "./ModeSelector";

// To:
import { ModeSelector } from "./ModeSelector";
import { ArchitectForm } from "./ArchitectForm";

// In JSX:
{state.mode === "undecided" && <ModeSelector onSelectMode={onSelectMode} />}
{state.mode === "build-for-me" && <BuildForMeFlow ... />}
{state.mode === "guide-me" && <GuidedConversation ... />}
{state.mode === "architect" && <ArchitectForm state={state} dispatch={dispatch} onGenerate={onGenerate} />}
```

### Type Definition
WizardMode type already includes "architect":
```typescript
export type WizardMode = "undecided" | "build-for-me" | "guide-me" | "architect";
```

No type changes needed.

### Phase Handling
When user selects Architect, typically you'd:
1. Set `state.phase` to "architect" (via SET_PHASE action)
2. Render ArchitectForm
3. On "Generate Unit" click, call the same generation function as Express/Guided

---

## Testing Checklist
- [ ] Unit type selector updates form fields
- [ ] Changing unit type clears type-specific fields
- [ ] All required fields have appropriate validators
- [ ] Criteria sliders update state
- [ ] ATL skills pills toggle correctly
- [ ] All dropdowns populate correctly
- [ ] Generate button doesn't appear in "undecided" mode
- [ ] Mobile responsive (check grid layout at 640px breakpoint)
- [ ] No TypeScript errors in full build

---

## Next Steps
1. Integrate ArchitectForm into GoalInput flow
2. Add phase handling for "architect" phase
3. Wire generation button to same handler as Express/Guided
4. Test with actual unit generation
5. Consider adding "Reset Form" button for Architect users
6. Consider adding inline help tooltips for complex fields
