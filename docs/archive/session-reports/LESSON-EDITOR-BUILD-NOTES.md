# Lesson Editor — Phase 0.5 Build Notes

**Date:** 24 March 2026
**Status:** Core Components Built
**Est. Time to Complete:** 3-5 more days (integration + AI helpers + polish)

---

## What Was Built Today

### 1. **UndoManager.ts** (~60 lines)
Pure logic class for undo/redo stack management.

**Key Features:**
- Max depth: 30 snapshots (configurable)
- `push(state)` — adds new state, clears future on new action
- `undo()` / `redo()` — returns cloned states
- `canUndo` / `canRedo` getters for UI state
- Uses `structuredClone()` to prevent mutations

**Usage in Component:**
```typescript
const undoManagerRef = useRef(new UndoManager<UnitContentData>());
const previous = undoManagerRef.current.undo();
```

---

### 2. **useAutoSave.ts** (~110 lines)
React hook for debounced API auto-save.

**Key Features:**
- Accepts `unitId`, `classId`, `content`
- Debounced at 800ms
- Calls PATCH `/api/teacher/class-units/content` with full `content_data`
- Returns `saveStatus`: "idle" | "saving" | "saved" | "error"
- Auto-resets to "idle" after 2 seconds on success
- Change-detection to avoid redundant saves

**Note:** Fork-on-write is handled server-side by the API. This hook just sends the content.

---

### 3. **useLessonEditor.ts** (~250 lines)
Main state hook managing the entire editor session.

**Key Features:**
- Loads resolved content from `GET /api/teacher/class-units/content`
- Tracks page selection (selectedPageIndex)
- Integrates UndoManager and useAutoSave internally
- Provides mutation functions: `updatePage()`, `addPage()`, `removePage()`, `reorderPages()`
- Returns undo/redo functions + `canUndo`/`canRedo` booleans
- Returns `isFork` status and `saveStatus` from useAutoSave

**State:**
```typescript
interface UseLessonEditorReturn {
  content: UnitContentData | null;
  loading: boolean;
  error: string | null;
  selectedPageIndex: number | null;
  setSelectedPageIndex: (index: number) => void;
  updatePage: (pageIndex: number, partial: Partial<PageContent>) => void;
  addPage: (defaultTitle?: string) => void;
  removePage: (pageIndex: number) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  isFork: boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
}
```

---

### 4. **InlineEdit.tsx** (~150 lines)
Reusable click-to-edit component.

**Key Features:**
- Display mode: renders as h1/h2/p/span with hover bg-gray-50
- Edit mode: switches to input/textarea with autoFocus on click
- Blur or Enter (single-line) commits → calls `onChange`
- Escape cancels and reverts to original value
- No modal, no confirmation dialog — seamless mode switch
- `multiline` prop toggles textarea vs input

**Usage:**
```tsx
<InlineEdit
  value={content.title}
  onChange={(newTitle) => onUpdate({ title: newTitle })}
  placeholder="Lesson title"
  as="h2"
  className="text-2xl font-bold"
/>
```

---

### 5. **LessonHeader.tsx** (~80 lines)
Top section of editor showing title, learning goal, page type badge.

**Props:**
```typescript
interface LessonHeaderProps {
  page: { id: string; type: string; title: string; content: PageContent };
  onUpdate: (partial: Partial<PageContent>) => void;
}
```

**Features:**
- Title: InlineEdit h2, bold
- Learning Goal: InlineEdit p, gray-600
- Page type badge (Strand/Context/Skill/Reflection/Custom/Lesson)

---

### 6. **PhaseSection.tsx** (~200 lines)
Collapsible phase wrapper for each of the 4 Workshop Model phases.

**Props:**
```typescript
interface PhaseSectionProps {
  phase: "opening" | "miniLesson" | "workTime" | "debrief";
  phaseDuration: number;
  onDurationChange: (newDuration: number) => void;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}
```

**Features:**
- Color-coded left border per phase (indigo/blue/emerald/amber)
- Animated collapse (Framer Motion spring)
- Duration chip: click to inline-edit
- Helper text per phase ("Hook & engage", "Direct instruction", etc.)
- Chevron animates on toggle

**Styling:**
- Opening: violet (bg-violet-50, border-violet-400)
- Mini-Lesson: blue (bg-blue-50, border-blue-400)
- Work Time: emerald (bg-emerald-50, border-emerald-400)
- Debrief: amber (bg-amber-50, border-amber-400)

---

### 7. **ActivityBlock.tsx** (~420 lines)
Single activity card in the editor — the core unit.

**Props:**
```typescript
interface ActivityBlockProps {
  activity: ActivitySection;
  index: number;
  onUpdate: (partial: Partial<ActivitySection>) => void;
  onDelete: () => void;
}
```

**Features:**
- **Drag handle**: 6-dot grip icon (opacity-0 on hover, visible on group-hover)
  - Uses `useDragControls()` from Framer Motion
  - `onPointerDown={(e) => dragControls.start(e)}`
- **Title**: First line of prompt, inline editable
- **Duration chip**: Click to edit number input, updates live
- **Prompt**: Multiline inline editable (the main content)
- **Response type**: Dropdown selector (10 types)
- **Criteria**: Toggleable A/B/C/D pills (background changes on select)
- **Portfolio capture**: Checkbox toggle
- **Expandable sections**: Scaffolding (3 ELL tiers), Example Response, Media
  - Each uses its own Framer Motion height animation
  - Accordion-style with smooth expand/collapse
- **Delete button**: Right side, hover-visible
  - Click shows confirmation dialog (Cancel/Delete buttons)
  - On delete, calls `onDelete()` callback
- **Animations**:
  - Entry: spring fade-in from opacity 0, height 0
  - Exit: spring fade-out to opacity 0, height 0
  - Hover effects: subtle shadow

**CSS Structure:**
```
┌─────────────────────────────────────────────┐
│ ⠿  Title / Duration / Delete Button         │  ← drag handle on hover
├─────────────────────────────────────────────┤
│ Prompt (multiline inline edit)              │
├─────────────────────────────────────────────┤
│ Response: [dropdown] | Criteria: [A][B]...  │
├─────────────────────────────────────────────┤
│ ▸ Scaffolding  ▸ Example  ▸ Media           │
└─────────────────────────────────────────────┘
```

---

### 8. **ExtensionBlock.tsx** (~200 lines)
Extension activity card (compact, for early finishers).

**Props:**
```typescript
interface ExtensionBlockProps {
  extension: LessonExtension;
  index: number;
  onUpdate: (partial: Partial<LessonExtension>) => void;
  onDelete: () => void;
}
```

**Features:**
- **Title**: Inline editable
- **Description**: Multiline inline editable
- **Duration chip**: Click to edit
- **Design phase**: Dropdown (investigation/ideation/prototyping/evaluation)
- **Delete button**: Hover-visible with confirmation
- **Styling**: Gradient background (amber-50 → orange-50) with amber border

---

### 9. **index.ts** — Barrel Exports
Centralized exports for all components and hooks:
```typescript
export { default as InlineEdit } from "./InlineEdit";
export { default as LessonHeader } from "./LessonHeader";
export { default as PhaseSection } from "./PhaseSection";
export { default as ActivityBlock } from "./ActivityBlock";
export { default as ExtensionBlock } from "./ExtensionBlock";
export { useLessonEditor } from "./useLessonEditor";
export { useAutoSave } from "./useAutoSave";
export { UndoManager } from "./UndoManager";
```

---

## Architecture Overview

### Data Flow

```
useLessonEditor Hook
├── Loads content from API on mount
├── Maintains undo/redo stack (UndoManager)
├── Provides mutation functions (updatePage, addPage, etc.)
├── Integrates useAutoSave for debounced saves
└── Returns all state + functions

LessonEditor.tsx (Orchestrator — NOT YET BUILT)
├── Uses useLessonEditor
├── Manages selectedPageIndex
├── Renders LessonHeader
├── Renders PhaseSection for each phase
│   └── PhaseSection contains ActivityBlock instances
├── Renders ExtensionBlock instances
├── Mounts PhaseTimelineBar (sticky, always visible)
├── Handles keyboard shortcuts (Cmd+Z, Cmd+Shift+Z, etc.)
└── Shows auto-save status indicator
```

### State Mutations

Every mutation goes through the same flow:
1. Component calls `onUpdate(partial)` or similar
2. Hook merges the partial into the state
3. UndoManager captures the full state snapshot
4. useAutoSave triggers a debounced save
5. On blur/Enter, the change commits to API

---

## Key Design Patterns

### 1. **Inline Editing**
- No modal, no separate "edit mode" UI
- Click text → input appears → blur to save
- Escape cancels → reverts to original
- Works seamlessly with autoSave

### 2. **Framer Motion Animations**
All transitions use spring physics:
```typescript
transition={{ type: "spring", damping: 25, stiffness: 300 }}
```
This gives a natural, responsive feel without feeling slow.

### 3. **Drag Handles**
- Visible on group-hover only (not always visible)
- Uses `useDragControls()` from Framer Motion
- Paired with Reorder.Group/Reorder.Item (to be integrated)

### 4. **Expandable Sections**
Using `motion.div` with `height: "auto" / 0` transition:
```typescript
<motion.div
  animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
  transition={{ type: "spring", damping: 25, stiffness: 300 }}
>
  {children}
</motion.div>
```

---

## What's NOT Yet Built (Next Phase)

### 1. **LessonEditor.tsx** (Main Orchestrator)
- Mounts all components together
- Integrates Framer Motion Reorder for activity drag-and-drop
- Handles keyboard shortcuts (Cmd+Z, Tab, Escape, /)
- Renders PhaseTimelineBar sticky at top
- Shows auto-save status in header

### 2. **LessonSidebar.tsx**
- Left panel with lesson list
- Drag-to-reorder lessons
- Active lesson indicator
- + Add Lesson button
- ⚡ AI: Generate Next button

### 3. **ActivityBlockAdd.tsx**
- Type picker modal (Written Response, Upload, Voice, etc.)
- "AI: Generate Activity" option
- Creates blank activity with defaults

### 4. **TimingBar.tsx** (Enhanced)
- Sticky at top of editor
- Shows phase timeline with durations
- Draggable phase boundaries
- Color feedback (green/amber/red)
- Click phase → scroll to that section

### 5. **AI Assistance Routes** (API)
- `POST /api/teacher/lesson/generate-activity` — context-aware activity generation
- `POST /api/teacher/lesson/improve-activity` — rewrite activity prompt
- `POST /api/teacher/lesson/generate-extension` — create extension activity
- `POST /api/teacher/lesson/fill-scaffolding` — generate ELL tiers
- And more...

### 6. **Integration into Pages**
- Wire `useLessonEditor` into `/teacher/units/[unitId]/class/[classId]/edit`
- Wire into `/teacher/units/[unitId]/edit` (master unit editor)
- Replace current basic editor with full LessonEditor component

### 7. **Migration Script**
- Backfill `activityId` on all existing sections (v2, v3, v4 content)
- Without this, drag-to-reorder will break student responses
- Should be a code migration (not SQL), running in Node

### 8. **Tests & Polish**
- Backward compat testing (v1/v2/v3/v4 all render correctly)
- Fork-on-write testing
- Activity reorder response mapping test
- Keyboard shortcut tests
- Visual Polish pass (hover states, animations, colors)

---

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `UndoManager.ts` | 60 | Undo/redo stack logic |
| `useAutoSave.ts` | 110 | Debounced auto-save hook |
| `useLessonEditor.ts` | 250 | Main state + mutations |
| `InlineEdit.tsx` | 150 | Click-to-edit component |
| `LessonHeader.tsx` | 80 | Title + learning goal |
| `PhaseSection.tsx` | 200 | Collapsible phase wrapper |
| `ActivityBlock.tsx` | 420 | Single activity card |
| `ExtensionBlock.tsx` | 200 | Extension activity card |
| `index.ts` | 20 | Barrel exports |
| **TOTAL** | **1,490** | **Core editor components** |

---

## Next Steps (Priority Order)

### Immediate (1-2 days)
1. Build `LessonEditor.tsx` orchestrator (mount all components, handle Reorder)
2. Build `LessonSidebar.tsx` with lesson selection
3. Integrate into `/teacher/units/[unitId]/class/[classId]/edit` page

### Short-term (2-3 days)
4. Build `ActivityBlockAdd.tsx` type picker
5. Build `TimingBar.tsx` enhanced timeline
6. Add ActivityBlock to PhaseSection with Framer Motion Reorder

### Medium-term (1-2 days)
7. Keyboard shortcuts (Cmd+Z, Tab, Escape, /)
8. AI Assistance API routes
9. Migration script for activityId backfill

### Polish (1 day)
10. Visual polish, hover states, animations
11. Error handling + validation
12. Backward compat testing

---

## Testing Checklist (Phase 2)

- [ ] Load existing unit → renders all pages correctly
- [ ] Edit title → saves immediately (no Save button)
- [ ] Add activity → creates blank section with defaults
- [ ] Delete activity → shows undo toast (not confirmation)
- [ ] Drag activity → reorders within phase
- [ ] Drag across phases → activity moves to new phase
- [ ] Edit duration → timing bar updates live
- [ ] Toggle criterion → pill changes color
- [ ] Click phase duration → inline edit
- [ ] Undo (Cmd+Z) → reverts last action
- [ ] Redo (Cmd+Shift+Z) → redoes action
- [ ] Fork-on-write → class edits don't affect master
- [ ] Student responses survive activity reorder → use activityId mapping
- [ ] All response types render correctly
- [ ] Scaffolding tiers expand/collapse smoothly
- [ ] Extension blocks render and edit correctly
- [ ] Auto-save indicator shows "Saving..." → "✓ Saved"
- [ ] Existing v1/v2/v3/v4 units load without errors

---

## Critical Dependencies

- **Framer Motion:** Already in package.json ✓
- **React 19:** Already in package.json ✓
- **Tailwind CSS 4.1:** Already in package.json ✓
- **`useDragControls` from Framer Motion** — for drag handles
- **`Reorder` components from Framer Motion** — for activity reordering
- **Supabase client** — for API calls (already imported)
- **CRITERIA constant** — for criterion pills (imports from constants.ts)

---

## Styling Notes

### Color Scheme
- **Indigo:** Primary interactive color (#6366F1)
- **Emerald:** Positive/success (#10B981)
- **Amber:** Warning/extension (#F59E0B)
- **Violet:** Accent (#8B5CF6)
- **Blue:** Secondary (#2563EB)

### Spacing
- Card padding: `p-4` or `p-5`
- Section margins: `mb-4` or `mb-6`
- Gap between elements: `gap-3` or `gap-4`

### Borders
- Cards: `border border-gray-200`
- Hover: `hover:shadow-md`
- Phase sections: `border-l-4` with phase color

---

## Known Limitations & Future Improvements

1. **Activity Type Picker** — Not yet built. Currently dropdown only.
2. **AI Assistance** — Routes not yet built. "Generate Activity" button will be added.
3. **Media Upload** — Input exists but no upload handler.
4. **Scaffolding Editor** — Currently just textarea. Could be richer editor later.
5. **Response Preview** — No student preview mode yet (Phase 2).
6. **Keyboard Navigation** — Tab/arrow keys not yet implemented.
7. **Command Palette** — `/` command search not yet built.
8. **Bulk Actions** — Can't duplicate activity or move between phases via menu.

---

## References

- **Spec:** `docs/specs/lesson-editor-phase-0.5.md`
- **API Route:** `src/app/api/teacher/class-units/content/route.ts` (fork-on-write)
- **Existing Editor:** `src/app/teacher/units/[unitId]/class/[classId]/edit/page.tsx` (basic version)
- **PhaseTimelineBar:** `src/components/lesson-timing/PhaseTimelineBar.tsx` (reference for timing bar)
- **Types:** `src/types/index.ts` (PageContent, ActivitySection, WorkshopPhases, LessonExtension)

---

**Build completed:** 24 March 2026, ~1.5 hours
**Next build session:** Integration + LessonEditor orchestrator
