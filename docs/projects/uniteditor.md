# Project: Unit Editor — Fix & Improve the Lesson Editor

> **Created:** 29 Mar 2026
> **Status:** Planned
> **Goal:** Fix known drag-and-drop issues and design problems in the Phase 0.5 lesson editor
> **Estimated effort:** ~6-10 hours

---

## 1. The Problem

The Phase 0.5 lesson editor (~3,962 lines across 12 components) was built quickly and has several known issues:

### Drag & Drop Problems

- **Cross-container drag (palette → phase) can be unreliable** — HTML5 DnD events don't always fire correctly, especially when dragging over nested Framer Motion Reorder containers. The DropZone components sometimes don't activate.
- **Activity reorder within a phase can jump unexpectedly** — Framer Motion's `Reorder.Group` occasionally miscalculates position during fast drags, especially in short lists (1-2 items).
- **Drag handle hit area is small** — the `⠿` drag handle on activity blocks is 24px and hard to grab on touch devices. Mobile/tablet experience is poor.
- **No visual feedback during drag** — dragged item doesn't show a ghost/preview of what's being moved. Just the browser's default drag image.

### Design Problems

- **Phase sections all look the same** — Opening, Mini-Lesson, Work Time, and Debrief phases use the same visual treatment (collapsible sections with colored left borders). Should be more visually distinct to reinforce the Workshop Model structure.
- **Empty phase state is confusing** — when a phase has no activities, it shows nothing. Should show a clear "add an activity" prompt or drop zone.
- **Activity type selector is a plain dropdown** — selecting response type (text, upload, canvas, toolkit-tool, etc.) uses a basic `<select>`. Should be a visual picker showing what each type looks like.
- **Inline editing can be fiddly** — click-to-edit fields (InlineEdit component) sometimes need a double click or don't properly focus. The editable area doesn't always look editable (no visual affordance until clicked).
- **No preview of student view** — teachers can't see what the student will experience. The editor shows the data structure, not the rendered lesson.
- **Toolbar/action bar positioning** — the save status, undo/redo, and version controls are in the sticky bar at top but can feel disconnected from the editing area.

### Missing Features (from Phase 0.5 spec)

- Debrief protocol library (preset protocols: "Gallery Walk", "Exit Ticket", "Think-Pair-Share", etc.)
- Prompt enrichment (AI suggests improvements to teacher-written prompts)
- Student preview mode
- Activity duplication (copy an activity within or between phases)
- Bulk operations (select multiple activities → move to different phase)

---

## 2. What's Already Built

| Component | Lines | Status |
|-----------|-------|--------|
| LessonEditor.tsx | 870 | Working, main orchestrator |
| useLessonEditor.ts | ~300 | Working, state management |
| useAutoSave.ts | ~100 | Working, 800ms debounce |
| UndoManager.ts | ~80 | Working, 30-snapshot depth |
| LessonSidebar.tsx | ~200 | Working, lesson reorder |
| ActivityBlock.tsx | ~350 | Working but needs DnD fixes |
| ActivityBlockAdd.tsx | ~200 | Working, 6 templates + toolkit tool |
| PhaseSection.tsx | ~150 | Working but visually bland |
| LessonHeader.tsx | ~100 | Working |
| ExtensionBlock.tsx | ~100 | Working |
| InlineEdit.tsx | ~80 | Working but fiddly UX |
| AITextField.tsx | ~200 | Working, # button for suggestions |
| DndContext.tsx | ~60 | Working but unreliable cross-container |
| DropZone.tsx | ~80 | Working but activation issues |
| BlockPalette.tsx | ~150 | Working, draggable blocks |

---

## 3. Phases

### Phase 1: Fix Drag & Drop (~3-4 hours)

- **Replace HTML5 DnD with dnd-kit for cross-container** — HTML5 DnD is fundamentally limited (no custom drag previews, poor touch support, unreliable event bubbling in nested containers). `@dnd-kit/core` + `@dnd-kit/sortable` handles both within-list reorder AND cross-container drag with one unified system. This means replacing Framer Motion Reorder for activity ordering too (keep Framer for animations, use dnd-kit for drag logic).
- **Better drag handles** — larger hit area (40px+), visible on hover, distinct grab cursor. Touch-friendly.
- **Drag preview** — show a simplified card preview during drag (activity title + type icon) instead of browser default.
- **Empty phase drop zones** — always-visible drop target in empty phases with "Drag an activity here or click +" prompt.

### Phase 2: Visual Design Improvements (~2-3 hours)

- **Phase visual identity** — each Workshop Model phase gets a distinct visual treatment:
  - Opening: warm amber background, sunrise icon
  - Mini-Lesson: blue background, lightbulb icon
  - Work Time: green background, tools icon (largest section, most prominent)
  - Debrief: purple background, speech bubble icon
- **Activity type visual picker** — replace dropdown with a grid of type cards (icon + label + brief description). Group by category (text responses, media, toolkit, interactive).
- **InlineEdit affordance** — show subtle edit icon on hover, dotted underline on editable text, smooth focus transition with highlight animation.
- **Empty states** — each phase shows its purpose when empty ("This is where students settle in and connect to prior learning" for Opening).

### Phase 3: Missing Features (~3-4 hours)

- **Student preview** — side-by-side or toggle view showing how the lesson renders for students. Reuses existing student lesson page components in read-only mode.
- **Activity duplication** — right-click or ⋯ menu on activity block → "Duplicate" (copies within same phase) or "Move to..." (select target phase).
- **Debrief protocol library** — preset debrief protocols (Gallery Walk, Exit Ticket, Think-Pair-Share, 3-2-1, Whip Around, Rose-Thorn-Bud). Teacher picks from list → auto-populates debrief section.
- **Prompt enrichment** — AI reviews teacher-written prompts and suggests improvements (clearer language, better scaffolding, higher Bloom's level). Uses existing AITextField pattern.

---

## 4. Key Decisions

1. **dnd-kit over continuing with HTML5 DnD** — the current approach layers HTML5 DnD (cross-container) on top of Framer Motion Reorder (within-list). Two separate drag systems = two sets of bugs. dnd-kit replaces both with one unified system. It's also the standard choice for complex React DnD (used by Notion, Linear, etc.).

2. **Phase visual identity reinforces Workshop Model** — the lesson editor should TEACH the Workshop Model structure through its design. A teacher using the editor should internalize "Opening → Mini-Lesson → Work Time → Debrief" just by seeing the visual flow.

3. **Student preview is read-only reuse, not a new renderer** — don't build a separate preview system. Import the actual student lesson page components and render them with `readOnly` props. What teachers see in preview is exactly what students see.

4. **Don't break auto-save during refactor** — the useAutoSave hook (800ms debounce, PATCH to content API with fork-on-write) is the most critical piece. Any DnD refactor must preserve the content_data shape that auto-save expects.

---

## 5. Files to Modify

| File | Change |
|------|--------|
| `src/components/teacher/lesson-editor/LessonEditor.tsx` | Replace Reorder.Group with dnd-kit, add preview toggle |
| `src/components/teacher/lesson-editor/ActivityBlock.tsx` | New drag handle, DnD integration, duplication menu |
| `src/components/teacher/lesson-editor/PhaseSection.tsx` | Visual identity per phase, empty state |
| `src/components/teacher/lesson-editor/DndContext.tsx` | Replace with dnd-kit provider |
| `src/components/teacher/lesson-editor/DropZone.tsx` | Replace with dnd-kit droppable |
| `src/components/teacher/lesson-editor/BlockPalette.tsx` | dnd-kit draggable |
| `src/components/teacher/lesson-editor/InlineEdit.tsx` | Better affordance, focus handling |
| NEW: `src/components/teacher/lesson-editor/ActivityTypePicker.tsx` | Visual type selector grid |
| NEW: `src/components/teacher/lesson-editor/DebriefLibrary.tsx` | Protocol presets |
| NEW: `src/components/teacher/lesson-editor/StudentPreview.tsx` | Read-only student view |

---

*Last updated: 29 Mar 2026*
