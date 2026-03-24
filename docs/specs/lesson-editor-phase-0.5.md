# Phase 0.5: Lesson Editor — "Best Lesson Planning Experience in the World"

**Author:** Claude + Matt · **Date:** 24 March 2026
**Status:** SPEC · **Est. build:** 8-10 days
**Depends on:** All Tier 0-1 audit items (✅ DONE)

---

## Why This Matters

Teachers rejected Planboard/Common Curriculum not for missing features but for **friction**. They default to Google Slides because it's already in their workflow. StudioLoom's advantage: Workshop Model pre-enforces structure, AI generates a solid skeleton, and teachers inherit rather than starting from zero.

**The editor's job:** Get out of the way. Make existing lessons better. Support fast tweaking. Enforce the Workshop Model so teachers feel confident. Make it **enjoyable**, not just functional.

---

## Design Principles

1. **Inline editing, not modal editing.** Click text → type → blur saves. No "Edit" button → modal → "Save" button. The content IS the editor.
2. **Always-visible timing constraint.** Teachers edit knowing whether they fit in the period. Green/yellow/red feedback at all times.
3. **Drag-and-drop with instant feedback.** Notion-style: six-dot handle on hover, thin drop-line, 100ms spring animation. Framer Motion `Reorder` for all draggable lists.
4. **Undo/redo creates safety.** Cmd+Z just works. Teachers experiment freely because they can always undo.
5. **AI on demand, never pushy.** "Need an extension?" button — not auto-suggestions that interrupt flow.
6. **Auto-save, no Save button.** Changes persist on blur with debounced writes to the fork-on-write API.
7. **No blank canvas.** Every lesson starts with Workshop Model structure. Teachers refine, not create from scratch.

---

## Data Model — What We're Editing

### Current PageContent shape (types/index.ts)
```typescript
interface PageContent {
  title: string;
  learningGoal: string;
  vocabWarmup?: VocabWarmup;
  introduction?: { text: string; media?; links? };
  sections: ActivitySection[];     // ← the activities
  reflection?: Reflection;
  workshopPhases?: WorkshopPhases; // ← timing
  extensions?: LessonExtension[];  // ← early finishers
}

interface ActivitySection {
  prompt: string;
  scaffolding?: EllScaffolding;
  responseType?: ResponseType;
  exampleResponse?: string;
  portfolioCapture?: boolean;
  criterionTags?: string[];
  durationMinutes?: number;
  activityId?: string;     // ← stable key (v4), use for response mapping
  media?: ActivityMedia;
  links?: ActivityLink[];
  contentStyle?: ContentStyle;
  toolId?: string;
  toolChallenge?: string;
}
```

### Critical Invariants (DO NOT BREAK)
- **Page IDs are immutable** — 40+ files reference them
- **Section reordering must use activityId** — not array index (backfill needed)
- **workshopPhases 4-phase structure is locked** — can extend fields, not restructure
- **content_data is never null** — 95+ files assume it exists

### Safe Changes
- ✅ Add fields to ActivitySection
- ✅ Add new response types
- ✅ Modify prompt/scaffolding/duration/learningGoal text
- ✅ Reorder sections IF activityId-based response mapping is in place
- ✅ Add/remove sections (new ones get fresh activityId)
- ✅ Modify workshopPhases durations
- ✅ Add/edit/remove extensions

### Migration Needed First
**Backfill activityId on all existing sections.** Without this, drag-to-reorder breaks student responses.

```sql
-- Migration 042: Backfill activityId on existing page sections
-- This is a CODE migration, not SQL — run as a script that:
-- 1. Reads all units.content_data
-- 2. For each page.content.sections[i], if no activityId, assign nanoid(8)
-- 3. Writes back to units.content_data
-- 4. Same for class_units.content_data (forks)
```

Also update `usePageResponses` to key by activityId with index fallback.

---

## The Editor — Screen Architecture

### Entry Points
1. **Class-local editor** at `/teacher/units/[unitId]/class/[classId]/edit` (existing page, enhanced)
2. **Master unit editor** at `/teacher/units/[unitId]/edit` (existing page, enhanced)
3. **Quick Edit from Teaching Mode** (future — same component, embedded in modal)

### Layout: Split-Pane

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Unit    Biomimicry: Plastic Pouch    ⟲ Undo │  ← sticky header
├──────────────────────────┬──────────────────────────────┤
│                          │                              │
│   LESSON LIST            │   LESSON EDITOR              │
│   (left sidebar)         │   (main area)                │
│                          │                              │
│   ┌──────────────────┐   │   ┌────────────────────────┐ │
│   │ 1. Getting to    │   │   │ PHASE TIMELINE BAR     │ │  ← sticky, always visible
│   │    Know You ✓    │   │   │ [Opening|Mini|Work|Deb]│ │
│   ├──────────────────┤   │   └────────────────────────┘ │
│   │ 2. Embroidery    │◄──│                              │
│   │    Techniques    │   │   Title: [inline editable]   │
│   ├──────────────────┤   │   Goal:  [inline editable]   │
│   │ 3. Orthogonal    │   │                              │
│   │    Drawing       │   │   ── OPENING (5 min) ────── │
│   ├──────────────────┤   │   Hook: [inline editable]    │
│   │ + Add Lesson     │   │   Vocab: [tag chips]         │
│   └──────────────────┘   │                              │
│                          │   ── WORK TIME (25 min) ──── │
│                          │   ⠿ Activity 1 [drag handle] │
│                          │   ⠿ Activity 2 [drag handle] │
│                          │   + Add Activity              │
│                          │                              │
│                          │   ── EXTENSIONS ────────────  │
│                          │   ▸ Extension 1               │
│                          │   + Add Extension             │
│                          │                              │
│                          │   ── DEBRIEF (5 min) ──────  │
│                          │   Protocol: [inline editable] │
│                          │   Prompt: [inline editable]   │
│                          │                              │
└──────────────────────────┴──────────────────────────────┘
```

### Right-click Preview (Phase 2)
Click "Preview as Student" button → split pane shows student view on right, editor on left.

---

## Component Architecture

### 1. LessonEditor (main orchestrator)
```
src/components/teacher/lesson-editor/
├── LessonEditor.tsx              // orchestrator: state, undo stack, auto-save
├── LessonSidebar.tsx             // left sidebar: lesson list, drag-to-reorder
├── LessonHeader.tsx              // title, learning goal — inline editable
├── PhaseSection.tsx              // collapsible phase wrapper (Opening/Mini/Work/Debrief)
├── ActivityBlock.tsx             // single activity — inline editable, draggable
├── ActivityBlockAdd.tsx          // + Add Activity button + type picker
├── ExtensionBlock.tsx            // extension activity — inline editable
├── TimingBar.tsx                 // always-visible phase timeline (enhanced PhaseTimelineBar)
├── UndoManager.ts                // undo/redo stack (pure logic, no React)
├── useAutoSave.ts                // debounced save to fork-on-write API
└── useLessonEditor.ts            // main state hook (content + undo + selection)
```

### 2. Framer Motion Interactions

**Drag-and-drop activities (within a phase):**
```tsx
import { Reorder, useDragControls } from "framer-motion";

<Reorder.Group axis="y" values={activities} onReorder={handleReorder}>
  {activities.map((activity) => (
    <Reorder.Item
      key={activity.activityId}
      value={activity}
      dragListener={false}
      dragControls={controls}
    >
      <ActivityBlock
        activity={activity}
        dragControls={controls}
        onEdit={handleEdit}
      />
    </Reorder.Item>
  ))}
</Reorder.Group>
```

**Drag handle (six-dot grip, visible on hover):**
```tsx
<motion.div
  className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
  onPointerDown={(e) => controls.start(e)}
  whileTap={{ scale: 1.05 }}
>
  <GripVertical size={16} className="text-gray-400" />
</motion.div>
```

**Phase collapse animation:**
```tsx
<motion.div
  initial={false}
  animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
  transition={{ type: "spring", damping: 25, stiffness: 300 }}
>
  {children}
</motion.div>
```

**Drop indicator line:**
```tsx
// Framer Motion Reorder handles this automatically via layout animations
// The thin blue line appears between items during drag
```

**Activity add animation:**
```tsx
<motion.div
  initial={{ opacity: 0, height: 0 }}
  animate={{ opacity: 1, height: "auto" }}
  exit={{ opacity: 0, height: 0 }}
  transition={{ type: "spring", damping: 20, stiffness: 300 }}
>
  <ActivityBlock ... />
</motion.div>
```

### 3. Inline Editing Pattern

Every editable field uses the same pattern:
```tsx
function InlineEdit({ value, onChange, placeholder, multiline = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLElement>(null);

  // Click to edit
  const startEdit = () => { setEditing(true); setDraft(value); };

  // Blur or Enter to save
  const commitEdit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);  // triggers auto-save
  };

  // Escape to cancel
  const cancelEdit = () => { setEditing(false); setDraft(value); };

  if (!editing) {
    return (
      <div
        onClick={startEdit}
        className="cursor-text hover:bg-gray-50 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
      >
        {value || <span className="text-gray-400">{placeholder}</span>}
      </div>
    );
  }

  return multiline ? (
    <textarea
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitEdit}
      onKeyDown={(e) => e.key === "Escape" && cancelEdit()}
      autoFocus
      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
    />
  ) : (
    <input ... />
  );
}
```

### 4. Undo/Redo Manager

```typescript
// UndoManager.ts — framework-agnostic, operates on content snapshots
class UndoManager<T> {
  private stack: T[] = [];
  private pointer: number = -1;
  private maxDepth = 30;

  push(state: T) {
    // Trim future on new action
    this.stack = this.stack.slice(0, this.pointer + 1);
    this.stack.push(structuredClone(state));
    if (this.stack.length > this.maxDepth) this.stack.shift();
    this.pointer = this.stack.length - 1;
  }

  undo(): T | null {
    if (this.pointer <= 0) return null;
    this.pointer--;
    return structuredClone(this.stack[this.pointer]);
  }

  redo(): T | null {
    if (this.pointer >= this.stack.length - 1) return null;
    this.pointer++;
    return structuredClone(this.stack[this.pointer]);
  }

  get canUndo() { return this.pointer > 0; }
  get canRedo() { return this.pointer < this.stack.length - 1; }
}
```

Keyboard shortcuts:
```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      const prev = undoManager.undo();
      if (prev) setContent(prev);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
      e.preventDefault();
      const next = undoManager.redo();
      if (next) setContent(next);
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

### 5. Always-Visible Timing Bar

Enhanced from existing PhaseTimelineBar:

```
┌──────────────────────────────────────────────────────────────┐
│ ■■■■■ Opening  ■■■■■■■■■ Mini-Lesson  ■■■■■■■■■■■■■■■■■■■ Work Time  ■■■■ Debrief │
│  5 min            10 min                   25 min              5 min    │
│                                                              45/50 min │
└──────────────────────────────────────────────────────────────┘
```

- **Sticky** at top of editor (below header)
- **Draggable phase boundaries** (existing feature from PhaseTimelineBar)
- **Color feedback:** green border when total ≤ period, amber at 90-100%, red when over
- As teacher adds activities with durations, Work Time bar updates in real-time
- **Click a phase** → scroll to that phase section in the editor
- **Activity duration chips** visible inside the Work Time segment

### 6. Auto-Save

```typescript
// useAutoSave.ts
function useAutoSave(unitId: string, classId: string, content: PageContent) {
  const saveTimerRef = useRef<NodeJS.Timeout>();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const save = useCallback(async (data: PageContent) => {
    setSaveStatus("saving");
    try {
      await fetch(`/api/teacher/class-units/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, classId, content: data }),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }, [unitId, classId]);

  // Debounced save on content change
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => save(content), 800);
    return () => clearTimeout(saveTimerRef.current);
  }, [content, save]);

  return saveStatus;
}
```

Status shown in header: subtle "Saving..." → "✓ Saved" → fades to invisible.

---

## Activity Block — The Core Unit

Each activity renders as a card:

```
┌─────────────────────────────────────────────────────┐
│ ⠿  Activity Title [inline editable]        ⏱ 8 min │
│                                                     │
│ [Prompt text — inline editable, multiline]          │
│                                                     │
│ Response: [text ▾]  Criterion: [A] [B]  📎 Capture │
│                                                     │
│ ▸ Scaffolding (3 tiers)    ▸ Example    ▸ Media     │
│                                          ⋮ ✕       │
└─────────────────────────────────────────────────────┘
```

- **⠿** = drag handle (6-dot grip), visible on hover only
- **Title** = inline editable (click → type → blur saves)
- **⏱ 8 min** = click to change duration (number input, updates timing bar live)
- **Prompt** = multiline inline editable
- **Response type** = dropdown selector (text, upload, voice, canvas, decision-matrix, pmi, toolkit-tool, etc.)
- **Criterion tags** = toggleable pills (A/B/C/D)
- **📎 Capture** = portfolio capture toggle
- **Scaffolding** = expandable accordion with 3 ELL tiers
- **⋮** = overflow menu (duplicate, delete, move to different phase)
- **✕** = delete (with undo toast, not confirmation dialog)

### Adding Activities

The "+ Add Activity" button shows a compact type picker:

```
┌────────────────────────────────────────────────┐
│  What kind of activity?                        │
│                                                │
│  📝 Written Response    🎨 Creative/Upload     │
│  🎤 Voice Recording     🖼️ Canvas Drawing      │
│  📊 Toolkit Tool        📋 Content Block       │
│  🔄 Decision Matrix     ➕ Custom              │
│                                                │
│  ── or ──                                      │
│  🤖 AI: Generate an activity for [this phase]  │
└────────────────────────────────────────────────┘
```

Selecting a type creates a new ActivitySection with sensible defaults and focuses the prompt field.

The "AI: Generate" option calls the existing generation API with context (phase, lesson topic, existing activities) and inserts the result. Teacher can then edit inline.

---

## Lesson Sidebar — Left Panel

```
┌──────────────────────────┐
│  INVESTIGATION           │
│  ┌────────────────────┐  │
│  │ ⠿ 1. Getting to    │  │  ← drag to reorder
│  │    Know You    ✓   │  │
│  └────────────────────┘  │
│  CREATION                │
│  ┌────────────────────┐  │
│  │ ⠿ 2. Embroidery ●  │  │  ← ● = currently editing
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ ⠿ 3. Orthogonal    │  │
│  └────────────────────┘  │
│                          │
│  [+ Add Lesson]          │
│  [⚡ AI: Generate Next]  │
└──────────────────────────┘
```

- **Drag-to-reorder** lessons (Framer Motion Reorder)
- **Phase labels** group lessons visually
- **Active lesson** highlighted with indigo left border + dot
- **Completion status** checkmark on published/reviewed lessons
- Click lesson → loads in editor pane (no page navigation, just state swap)
- **+ Add Lesson** creates a blank lesson with Workshop Model structure
- **⚡ AI: Generate Next** uses context of previous lessons to generate the logical next lesson

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Cmd+D` | Duplicate current activity |
| `Cmd+Backspace` | Delete current activity (with undo toast) |
| `Tab` | Next editable field |
| `Shift+Tab` | Previous editable field |
| `Escape` | Exit inline editing / close picker |
| `Cmd+N` | Add new activity at cursor position |
| `Cmd+Shift+N` | Add new lesson |
| `↑` / `↓` | Navigate between lessons (when sidebar focused) |
| `/` | Quick command palette (type to search: "add video", "change to upload", etc.) |

---

## AI Assistance (On-Demand Only)

AI never auto-suggests. It waits to be asked:

1. **"Generate Activity"** — button in Add Activity picker. Uses lesson context + phase + existing activities to create a new one.
2. **"Improve This"** — overflow menu per activity. AI rewrites the prompt to be more specific/engaging while keeping the intent.
3. **"Generate Extension"** — button in Extensions section. Creates a phase-appropriate extension for early finishers.
4. **"Fill Scaffolding"** — button on empty scaffolding accordion. Generates 3 ELL tiers based on the activity prompt.
5. **"Suggest Hook"** — button on empty Opening hook field. Generates an engaging opener based on the lesson topic.
6. **"Generate Debrief Protocol"** — button on empty Debrief section. Creates a structured debrief protocol (Think-Pair-Share, Gallery Walk, Exit Ticket, etc.)

All AI calls use Haiku 4.5 (fast, cheap). Results appear inline and are immediately editable.

---

## Build Order (8-10 days)

### Week 1: Core Editor

**Day 1-2: Foundation**
- [ ] Migration script: backfill `activityId` on all existing sections (v2/v3 pages)
- [ ] Update `usePageResponses` to key by activityId with index fallback
- [ ] `LessonEditor.tsx` orchestrator shell
- [ ] `useLessonEditor.ts` state hook (content loading, lesson selection)
- [ ] `useAutoSave.ts` with debounced fork-on-write
- [ ] `UndoManager.ts` (pure logic)

**Day 3-4: Inline Editing**
- [ ] `InlineEdit` component (text + multiline variants)
- [ ] `LessonHeader.tsx` (title + learning goal inline editable)
- [ ] `PhaseSection.tsx` (collapsible phase wrappers with Workshop Model structure)
- [ ] `ActivityBlock.tsx` (full activity card with all inline fields)
- [ ] Response type dropdown selector
- [ ] Criterion tag pills (toggleable A/B/C/D)
- [ ] Duration chip (click to edit, updates timing bar)

**Day 5: Drag-and-Drop**
- [ ] Framer Motion `Reorder` for activities within phases
- [ ] Drag handle (six-dot grip, hover-visible)
- [ ] Spring animations for reorder + add/remove
- [ ] `LessonSidebar.tsx` with drag-to-reorder lessons
- [ ] AnimatePresence for activity add/remove transitions

### Week 2: Polish + AI

**Day 6: Timing Bar**
- [ ] Enhanced `TimingBar.tsx` (sticky, draggable, color feedback)
- [ ] Real-time duration computation as activities change
- [ ] Phase click → scroll to section
- [ ] Over-time warning indicator

**Day 7: Add/Delete/Duplicate**
- [ ] `ActivityBlockAdd.tsx` type picker
- [ ] Delete with undo toast (not confirmation)
- [ ] Duplicate activity (Cmd+D)
- [ ] Add Lesson (+ AI: Generate Next)
- [ ] Extensions section (add/edit/remove)

**Day 8: AI Assistance**
- [ ] Generate Activity API (context-aware, per-phase)
- [ ] "Improve This" per activity
- [ ] Generate Extension
- [ ] Fill Scaffolding
- [ ] Suggest Hook / Generate Debrief Protocol

**Day 9-10: Integration + Testing**
- [ ] Wire into class-local editor page (replace current basic editor)
- [ ] Wire into master unit editor
- [ ] Keyboard shortcuts (Cmd+Z, Tab, Escape, /)
- [ ] Student preview mode (render as student would see)
- [ ] Backward compat testing (v1/v2/v3/v4 all render in editor)
- [ ] Fork-on-write testing (edits trigger fork correctly)
- [ ] Existing student responses survive activity reorder (activityId mapping)

---

## What This Replaces

The current class-local editor (`/teacher/units/[unitId]/class/[classId]/edit/page.tsx`) can only:
- Edit page titles
- Reorder pages
- Add/remove pages

After Phase 0.5, it becomes a full lesson editor with:
- Inline editing of every field
- Drag-and-drop activity reorder
- Always-visible timing feedback
- Workshop Model phase structure
- AI-assisted content generation
- Undo/redo
- Auto-save
- Extensions management

---

## Files Affected

| File | Change | Risk |
|------|--------|------|
| `src/types/index.ts` | Ensure activityId on all ActivitySection instances | LOW |
| `src/hooks/usePageResponses.ts` | Key by activityId with index fallback | HIGH |
| `src/app/teacher/units/[unitId]/class/[classId]/edit/page.tsx` | Replace with LessonEditor mount | MEDIUM |
| `src/app/teacher/units/[unitId]/edit/page.tsx` | Replace with LessonEditor mount | MEDIUM |
| `src/app/api/teacher/class-units/content/route.ts` | Handle per-page PATCH (not just full content) | MEDIUM |
| `src/lib/units/resolve-content.ts` | No changes needed | — |
| `src/lib/ai/timing-validation.ts` | No changes needed (validator stays the same) | — |
| All student rendering code | No changes needed (reads same data shape) | — |
| Progress/NM/Schedule | No changes needed (page IDs preserved) | — |

**New files:** ~12 components in `src/components/teacher/lesson-editor/`

---

## Success Criteria

1. Teacher can edit any field of any activity in under 2 seconds (click → type → done)
2. Drag-and-drop reorder feels smooth (spring animation, no flicker)
3. Timing bar updates live as durations change
4. Undo works for any action (Cmd+Z)
5. Auto-save is invisible (no Save button, just "✓ Saved" indicator)
6. Existing units (all versions) render correctly in the editor
7. Student responses survive activity reorder (activityId mapping)
8. Fork-on-write triggers correctly (class edits don't affect master)
9. AI generates useful activities/extensions on demand (not auto)
10. The whole thing feels **fast** — no loading spinners, no page navigations
