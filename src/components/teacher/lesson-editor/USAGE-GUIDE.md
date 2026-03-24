# Lesson Editor Components — Usage Guide

Quick reference for using the Phase 0.5 core components.

## Hook: useLessonEditor

**Entry point for the entire editor.**

```tsx
"use client";
import { useLessonEditor } from "@/components/teacher/lesson-editor";

export default function MyEditorPage({ unitId, classId }) {
  const {
    content,
    loading,
    error,
    selectedPageIndex,
    setSelectedPageIndex,
    updatePage,
    addPage,
    removePage,
    reorderPages,
    isFork,
    undo,
    redo,
    canUndo,
    canRedo,
    saveStatus,
  } = useLessonEditor({ unitId, classId });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!content) return null;

  const currentPage = content.pages[selectedPageIndex!];

  return (
    <div>
      <h1>{content.pages.length} pages</h1>
      {/* Render components here */}
    </div>
  );
}
```

### Returned State

```typescript
type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseLessonEditorReturn {
  // Content
  content: UnitContentData | null;          // Full unit content
  loading: boolean;                         // Initial load state
  error: string | null;                     // Load error message

  // Selection
  selectedPageIndex: number | null;         // Currently editing page
  setSelectedPageIndex: (index: number) => void;

  // Mutations (all automatically saved)
  updatePage: (pageIndex: number, partial: Partial<PageContent>) => void;
  addPage: (defaultTitle?: string) => void;
  removePage: (pageIndex: number) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;

  // Fork state
  isFork: boolean;                          // Is this a class fork or master?

  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Auto-save status
  saveStatus: SaveStatus;                   // "idle" | "saving" | "saved" | "error"
}
```

### Key Points

- **All mutations push to undo stack** — Every `updatePage()`, `addPage()`, etc. is undoable
- **Auto-save is automatic** — Debounced at 800ms, no Save button needed
- **Fork state is tracked** — Check `isFork` to show/hide "Reset to Master" button
- **Save status is reactive** — Use for showing "Saving...", "✓ Saved" indicators

---

## Component: LessonHeader

**Renders title and learning goal at the top of the editor.**

```tsx
import { LessonHeader } from "@/components/teacher/lesson-editor";

<LessonHeader
  page={currentPage}
  onUpdate={(partial) => updatePage(selectedPageIndex!, partial)}
/>
```

### Props

```typescript
interface LessonHeaderProps {
  page: {
    id: string;
    type: string;
    title: string;
    content: PageContent;
  };
  onUpdate: (partial: Partial<PageContent>) => void;
}
```

---

## Component: PhaseSection

**Collapsible wrapper for each phase of the Workshop Model.**

```tsx
import { PhaseSection } from "@/components/teacher/lesson-editor";

const [openPhases, setOpenPhases] = useState({
  opening: true,
  miniLesson: true,
  workTime: true,
  debrief: true,
});

<PhaseSection
  phase="opening"
  phaseDuration={currentPage.content.workshopPhases?.opening.durationMinutes || 5}
  onDurationChange={(mins) =>
    updatePage(selectedPageIndex!, {
      workshopPhases: {
        ...currentPage.content.workshopPhases!,
        opening: {
          ...currentPage.content.workshopPhases!.opening,
          durationMinutes: mins,
        },
      },
    })
  }
  isOpen={openPhases.opening}
  onToggle={() =>
    setOpenPhases((prev) => ({
      ...prev,
      opening: !prev.opening,
    }))
  }
>
  {/* Activity blocks go here */}
</PhaseSection>
```

### Props

```typescript
interface PhaseSectionProps {
  phase: "opening" | "miniLesson" | "workTime" | "debrief";
  phaseDuration: number;                    // Current duration in minutes
  onDurationChange: (newDuration: number) => void;
  isOpen: boolean;                          // Collapse state
  onToggle: () => void;                     // Toggle collapse
  children: React.ReactNode;                // Activity blocks, etc.
}
```

---

## Component: ActivityBlock

**Single activity card with inline editing.**

```tsx
import { ActivityBlock } from "@/components/teacher/lesson-editor";
import { Reorder } from "framer-motion";

// Inside PhaseSection, with Reorder for drag-and-drop:
<Reorder.Group
  axis="y"
  values={activities}
  onReorder={(newActivities) => {
    // Reorder activities within this phase
    const newSections = [...currentPage.content.sections];
    // ... update logic
  }}
>
  {activities.map((activity, index) => (
    <Reorder.Item
      key={activity.activityId || index}
      value={activity}
      dragListener={false}
    >
      <ActivityBlock
        activity={activity}
        index={index}
        onUpdate={(partial) => {
          // Update this activity
          const newSections = [...currentPage.content.sections];
          const sectionIndex = newSections.findIndex((s) => s === activity);
          if (sectionIndex >= 0) {
            newSections[sectionIndex] = {
              ...activity,
              ...partial,
            };
            updatePage(selectedPageIndex!, { sections: newSections });
          }
        }}
        onDelete={() => {
          // Delete this activity
          const newSections = currentPage.content.sections.filter(
            (s) => s !== activity
          );
          updatePage(selectedPageIndex!, { sections: newSections });
        }}
      />
    </Reorder.Item>
  ))}
</Reorder.Group>
```

### Props

```typescript
interface ActivityBlockProps {
  activity: ActivitySection;
  index: number;                           // Position in list (for display)
  onUpdate: (partial: Partial<ActivitySection>) => void;
  onDelete: () => void;
}
```

### ActivitySection Structure

```typescript
interface ActivitySection {
  prompt: string;                          // Main activity text
  scaffolding?: EllScaffolding;           // ELL tier support
  responseType?: ResponseType;             // text, upload, voice, etc.
  exampleResponse?: string;                // Optional example
  portfolioCapture?: boolean;              // Auto-include in portfolio
  criterionTags?: string[];                // Assessment criteria (A/B/C/D)
  durationMinutes?: number;                // Activity duration
  activityId?: string;                     // Stable ID for response mapping
  media?: ActivityMedia;                   // Image/video URL
  links?: ActivityLink[];                  // Reference links
  contentStyle?: ContentStyle;             // Visual emphasis
  toolId?: string;                         // Toolkit tool ID
  toolChallenge?: string;                  // Pre-filled challenge
}
```

---

## Component: ExtensionBlock

**Extension activity for early finishers.**

```tsx
import { ExtensionBlock } from "@/components/teacher/lesson-editor";

{currentPage.content.extensions?.map((ext, index) => (
  <ExtensionBlock
    key={index}
    extension={ext}
    index={index}
    onUpdate={(partial) => {
      const newExtensions = [...(currentPage.content.extensions || [])];
      newExtensions[index] = { ...ext, ...partial };
      updatePage(selectedPageIndex!, { extensions: newExtensions });
    }}
    onDelete={() => {
      const newExtensions = (currentPage.content.extensions || []).filter(
        (_, i) => i !== index
      );
      updatePage(selectedPageIndex!, { extensions: newExtensions });
    }}
  />
))}
```

### Props

```typescript
interface ExtensionBlockProps {
  extension: LessonExtension;
  index: number;
  onUpdate: (partial: Partial<LessonExtension>) => void;
  onDelete: () => void;
}

interface LessonExtension {
  title: string;
  description: string;
  durationMinutes: number;
  designPhase?: "investigation" | "ideation" | "prototyping" | "evaluation";
}
```

---

## Component: InlineEdit

**Reusable click-to-edit input.**

```tsx
import { InlineEdit } from "@/components/teacher/lesson-editor";

<InlineEdit
  value={someText}
  onChange={(newValue) => {
    // Called when user commits (blur or Enter)
    updateSomeState(newValue);
  }}
  placeholder="Enter text..."
  multiline={false}
  as="h2"
  className="text-2xl font-bold"
/>
```

### Props

```typescript
interface InlineEditProps {
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  multiline?: boolean;                    // textarea if true, input if false
  className?: string;                     // Tailwind classes
  as?: "h1" | "h2" | "p" | "span";       // Display element type
}
```

### Behavior

- **Display mode:** Renders as specified element, hover shows bg-gray-50
- **Click:** Switches to input/textarea with autoFocus
- **Blur or Enter:** Commits change, calls onChange
- **Escape:** Cancels edit, reverts to original value

---

## Utility: UndoManager

**Pure logic class for undo/redo (rarely used directly).**

```typescript
import { UndoManager } from "@/components/teacher/lesson-editor";

const manager = new UndoManager<MyStateType>();

manager.push(state1);  // Add to stack
manager.push(state2);

const prev = manager.undo();  // Go back to state1
const next = manager.redo();  // Go forward to state2

if (manager.canUndo) {
  // Show undo button
}

if (manager.canRedo) {
  // Show redo button
}
```

---

## Keyboard Shortcuts (To Implement)

| Shortcut | Action |
|----------|--------|
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Cmd+D` | Duplicate current activity |
| `Cmd+Backspace` | Delete current activity |
| `Tab` | Next editable field |
| `Shift+Tab` | Previous editable field |
| `Escape` | Exit inline editing |
| `Cmd+N` | Add new activity |
| `Cmd+Shift+N` | Add new lesson |
| `↑` / `↓` | Navigate lessons (sidebar focus) |
| `/` | Command palette |

---

## Auto-Save Status Indicator

```tsx
import { useAutoSave } from "@/components/teacher/lesson-editor";

<div className="text-sm text-gray-500">
  {saveStatus === "saving" && "Saving..."}
  {saveStatus === "saved" && "✓ Saved"}
  {saveStatus === "error" && "⚠ Save failed"}
  {saveStatus === "idle" && ""}
</div>
```

---

## Complete Example: Minimal Editor

```tsx
"use client";

import { useState } from "react";
import {
  useLessonEditor,
  LessonHeader,
  PhaseSection,
  ActivityBlock,
  ExtensionBlock,
  InlineEdit,
} from "@/components/teacher/lesson-editor";

export default function MinimalEditor({ unitId, classId }: { unitId: string; classId: string }) {
  const { content, loading, selectedPageIndex, setSelectedPageIndex, updatePage, saveStatus } =
    useLessonEditor({ unitId, classId });

  const [openPhases, setOpenPhases] = useState({
    opening: true,
    miniLesson: true,
    workTime: true,
    debrief: true,
  });

  if (loading) return <div>Loading...</div>;
  if (!content) return null;

  const page = content.pages[selectedPageIndex!];

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Status */}
      <div className="mb-6 text-sm text-gray-500">
        {saveStatus === "saving" && "Saving..."}
        {saveStatus === "saved" && "✓ Saved"}
      </div>

      {/* Lesson header */}
      <LessonHeader
        page={page}
        onUpdate={(partial) => updatePage(selectedPageIndex!, partial)}
      />

      {/* Opening phase */}
      <PhaseSection
        phase="opening"
        phaseDuration={page.content.workshopPhases?.opening.durationMinutes || 5}
        onDurationChange={(mins) => {
          // Update phase duration
        }}
        isOpen={openPhases.opening}
        onToggle={() => setOpenPhases((p) => ({ ...p, opening: !p.opening }))}
      >
        {/* Activities in opening phase go here */}
      </PhaseSection>

      {/* Similar for miniLesson, workTime, debrief... */}

      {/* Extensions */}
      <div className="mt-8 pt-6 border-t">
        <h3 className="font-semibold mb-4">Extensions</h3>
        {page.content.extensions?.map((ext, idx) => (
          <ExtensionBlock
            key={idx}
            extension={ext}
            index={idx}
            onUpdate={(partial) => {
              // Update extension
            }}
            onDelete={() => {
              // Delete extension
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Common Patterns

### Update Page Title

```tsx
updatePage(selectedPageIndex!, { title: newTitle })
```

### Update Activity Prompt

```tsx
const newSections = [...currentPage.content.sections];
newSections[activityIndex] = {
  ...newSections[activityIndex],
  prompt: newPrompt,
};
updatePage(selectedPageIndex!, { sections: newSections });
```

### Add Activity

```tsx
const newActivity: ActivitySection = {
  prompt: "New activity prompt",
  responseType: "text",
  durationMinutes: 10,
  criterionTags: [],
  activityId: `activity-${Date.now()}`,
};
const newSections = [...currentPage.content.sections, newActivity];
updatePage(selectedPageIndex!, { sections: newSections });
```

### Delete Activity

```tsx
const newSections = currentPage.content.sections.filter((_, i) => i !== activityIndex);
updatePage(selectedPageIndex!, { sections: newSections });
```

---

**Last updated:** 24 March 2026
