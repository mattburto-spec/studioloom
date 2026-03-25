# Unit Editing, Versioning & Navigation — Feature Spec

**Author:** Claude + Matt · **Date:** 25 March 2026
**Status:** SPEC · **Est. build:** 3-4 days
**Depends on:** Phase 0.5 Lesson Editor (✅ BUILT), Unit Forking Architecture (✅ BUILT)

---

## The Problem

Three connected UX issues discovered during testing (25 March 2026):

### 1. "Edit Unit" takes teachers to the wrong page
Dashboard → class card → "Edit Unit" navigates to `/teacher/units/[unitId]/class/[classId]` — the **manage/settings page** (term picker, schedule, NM config). Teachers expect "Edit Unit" to mean editing lesson content — the lesson editor. The settings page is a setup task done once per semester, not a daily action.

### 2. No way to edit the master unit from the editor
When a teacher edits content in a class context, ALL changes silently fork (copy-on-write). There's no way to improve a lesson and have the improvement flow to all classes. Teachers need two modes: "improve the unit for everyone" vs "customize for this class."

### 3. Version history is hidden
The version history (Save as Version, Reset to Master) exists but lives behind buttons on the editor page. Teachers can't easily see what changed, when, or roll back. The history should be visible and lightweight.

---

## Design Principles

1. **"Edit" means editing content.** Not settings, not scheduling, not NM config. Pencil icon = lesson content.
2. **"Who sees this change?" is the only question.** Not "which fork am I on?" or "what version is this?" Teachers choose: all classes or just this one.
3. **Settings are setup, not daily work.** Term assignment, timetable, NM config — these are done once per semester. Don't put them in the teacher's daily path.
4. **History is a timeline, not a version tree.** No developer concepts (fork, branch, merge). Just: what changed, when, who sees it.

---

## Change 1: Dashboard Buttons

### Current (3 buttons)
```
[▶ Teach]  [📋 Manage]  [✏️ Edit Unit]
```
- Teach → Teaching Mode ✅
- Manage → class-unit settings page (term, schedule, NM)
- Edit Unit → ALSO the class-unit settings page ❌ (confusing)

### New (2 buttons)
```
[▶ Teach]  [✏️ Edit]
```
- **Teach** (purple solid) → Teaching Mode cockpit (`/teacher/teach/[unitId]?classId=[classId]`)
- **Edit** (outline) → Lesson Editor (`/teacher/units/[unitId]/class/[classId]/edit`)

### Where does Manage go?
The settings page is accessible from two places:
1. **Inside the lesson editor** — `⚙ Class Settings` link at bottom of sidebar (see Change 3)
2. **Unit detail page** — the "Assigned Classes" cards still link to the manage page

This removes it from the daily-use dashboard without hiding it. Teachers set up terms and schedules once, then live in the editor.

---

## Change 2: Edit Mode Toggle

### The Toggle
At the top of the lesson editor sidebar, a clear mode selector:

```
┌──────────────────────────┐
│  EDITING                 │
│  ○ All classes            │
│  ● This class only        │
│                          │
│  "Changes to all classes  │
│   update the unit         │
│   template. Customized    │
│   classes keep their own  │
│   version."               │
└──────────────────────────┘
```

### Behavior

**"All classes" mode:**
- Writes directly to `units.content_data` (the master template)
- All classes where `class_units.content_data IS NULL` see the update immediately
- Classes that have been customized (have their own fork) are NOT affected
- If the current class HAS a fork, show a note: "This class has its own version. Changes here won't affect it. [Switch to 'This class only' to edit the class version]"
- API: `PATCH /api/teacher/units/[unitId]` with content update (new route, or extend existing)

**"This class only" mode (default when entering from a class context):**
- Current behavior: writes to `class_units.content_data` via fork-on-write
- First edit triggers the copy-on-write if no fork exists yet
- Badge shows: "Customized for [Class Name]" (amber)

### Edge Cases
- **Entering from unit detail page (no class context):** Only "All classes" mode available. No toggle needed.
- **Entering from dashboard (class context):** Defaults to "This class only." Toggle available.
- **Class has no fork:** "This class only" starts a fork on first edit. "All classes" writes to master directly.
- **Class already has a fork:** Both modes available. "All classes" writes to master (fork unaffected). "This class only" writes to fork.

### "Apply to All Classes" Action
When editing in "This class only" mode, a button in the sidebar:

```
[↑ Apply to All Classes]
```

This promotes the current class fork to the master template:
1. Copies `class_units.content_data` → `units.content_data`
2. Optionally saves the current master as a version first (auto-prompt: "Save current master as a version before overwriting?")
3. Resets this class's fork (`class_units.content_data = NULL`, `forked_at = NULL`)
4. Other non-forked classes now see the updated master
5. Other forked classes see a subtle indicator on their manage page: "Master template was updated"

API: `POST /api/teacher/units/[unitId]/promote-fork` with `{ classId, saveVersionFirst: boolean }`

---

## Change 3: Editor Sidebar Redesign

The left sidebar currently shows the lesson list + "New" button. Expand it to include the edit mode toggle, version history, and settings link:

```
┌──────────────────────────┐
│  [Unit Thumbnail]        │
│  Biomimicry: Plastic...  │
│                          │
│  ─── EDITING ──────────  │
│  ○ All classes            │
│  ● This class only        │
│                          │
│  ─── LESSONS ──────────  │
│  ⠿ 1. Getting to Know    │
│  ⠿ 2. Embroidery   ●     │
│  ⠿ 3. Orthogonal Drawing │
│  [+ New]                 │
│                          │
│  ─── HISTORY ──────────  │
│  Today     You (all)  ↺  │
│  Mar 23    Class 8B   ↺  │
│  Mar 20    Original   ↺  │
│  [See all]               │
│                          │
│  ─── ─── ─── ─── ─── ── │
│  ⚙ Class Settings        │
│  ↑ Apply to All Classes  │
└──────────────────────────┘
```

### History Section
- Shows last 3 changes (collapsed by default, expandable)
- Each entry: date, context label (class name or "all classes" or "Original"), restore button
- `↺` button shows a confirmation: "Restore this version? Your current changes will be saved as a version first."
- "See all" expands to full history or opens a modal with diff preview (P2)

### Settings Link
- `⚙ Class Settings` navigates to the manage page (`/teacher/units/[unitId]/class/[classId]`)
- Only shown when editing in a class context
- Opens in same tab (Back button returns to editor)

### "Apply to All Classes" Button
- Only visible when the class has a fork AND editing in "This class only" mode
- Opens a confirmation dialog explaining what will happen
- Tip in dialog: "Other classes with their own customizations won't be affected"

---

## Change 4: Version History Details

### Inline Preview (in sidebar)
Hovering a history entry shows a tooltip with:
- Change summary: "3 activities modified, 1 added"
- Who: "Edited in 10 Design context"
- Timestamp

### Full Version View (P2 — future)
"See all" opens a panel/modal showing:
- Complete timeline of all versions
- Click any version to see full content in a read-only preview
- Side-by-side diff view: selected version vs current content
- "Use this version" button to restore

### How Versions Are Created
Versions are created automatically when:
1. Teacher switches from "This class only" to "All classes" mode (saves current state first)
2. Teacher uses "Apply to All Classes" (saves current master first, if they choose)
3. Teacher explicitly clicks "Save as Version" in the editor header (existing feature)

Versions are NOT created on every auto-save — that would be noise. Only on intentional actions.

---

## Technical Changes

### New API Routes
- `PATCH /api/teacher/units/[unitId]/content` — direct master content update (for "All classes" mode). Uses `requireTeacherAuth` + ownership check.
- `POST /api/teacher/units/[unitId]/promote-fork` — copies class fork to master. Accepts `{ classId, saveVersionFirst }`.

### Modified Components
- `src/app/teacher/dashboard/page.tsx` — 2 buttons instead of 3. "Edit" links to `/class/[classId]/edit`.
- `src/components/teacher/lesson-editor/LessonEditor.tsx` — Add edit mode toggle state. Pass mode to auto-save hook to determine write target.
- `src/components/teacher/lesson-editor/LessonSidebar.tsx` — Add edit mode toggle, history section, settings link, promote button.
- `src/components/teacher/lesson-editor/useAutoSave.ts` — Accept `editMode: "all" | "class"` parameter. Route saves to different API endpoints based on mode.
- `src/components/teacher/lesson-editor/useLessonEditor.ts` — Load version history from API. Track edit mode state.

### Modified API Routes
- `GET /api/teacher/class-units/content` — Also return version history metadata (last 5 versions).
- `GET /api/teacher/units/versions` — Already exists. May need to include auto-generated version labels.

### No Database Changes
All changes use existing tables and columns:
- `units.content_data` — master content (already exists)
- `class_units.content_data` — fork content (already exists)
- `unit_versions` — version history (already exists)
- `units.current_version`, `units.versions` — version metadata (already exists)

---

## Build Order (~3-4 days)

### Day 1: Edit Mode Toggle + Master Write API
- [ ] New `PATCH /api/teacher/units/[unitId]/content` route for direct master updates
- [ ] Edit mode toggle component in sidebar
- [ ] `useAutoSave` accepts edit mode, routes saves to correct endpoint
- [ ] Dashboard buttons: 2 instead of 3, "Edit" links to lesson editor

### Day 2: Promote Fork + History UI
- [ ] `POST /api/teacher/units/[unitId]/promote-fork` route
- [ ] "Apply to All Classes" button with confirmation dialog
- [ ] History section in sidebar (last 3 versions, restore button)
- [ ] Auto-version creation on mode switch and promote

### Day 3: Polish + Edge Cases
- [ ] Handle edge case: class has fork, teacher switches to "All classes" mode (show note)
- [ ] Handle edge case: no fork exists, "This class only" first edit triggers fork
- [ ] Restore version flow (save current first, then replace)
- [ ] Manage page link from editor sidebar
- [ ] Unit detail page: update "Assigned Classes" cards to show fork status clearly

### Day 4: Testing
- [ ] Test: edit in "All classes" → non-forked class sees update
- [ ] Test: edit in "All classes" → forked class NOT affected
- [ ] Test: promote fork → master updates, fork clears, other classes see new master
- [ ] Test: restore version → current saved first, old version applied
- [ ] Test: dashboard "Edit" button → goes to lesson editor, not settings page
- [ ] Test: backward compat — units without any forks work normally

---

## What This Replaces

| Before | After |
|--------|-------|
| "Edit Unit" → settings page | "Edit" → lesson editor |
| 3 dashboard buttons (Teach/Manage/Edit) | 2 buttons (Teach/Edit) |
| All class edits silently fork | Teacher chooses: all classes or this class |
| Version history behind a button | Visible in sidebar, last 3 entries |
| No way to push improvements to master | "Apply to All Classes" one-click promote |
| Manage page in the daily workflow | Manage page via ⚙ link (setup task) |

---

## Success Criteria

1. Teacher clicking "Edit" from dashboard lands in the lesson editor, ready to edit content
2. Teacher can toggle between "All classes" and "This class only" with one click
3. Changes in "All classes" mode immediately visible to non-forked classes
4. "Apply to All Classes" promotes fork to master with version safety
5. Version history visible in sidebar without extra navigation
6. Settings page accessible but not in the daily path
7. No teacher ever needs to understand the words "fork," "master," or "version"
