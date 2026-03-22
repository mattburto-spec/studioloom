# Unit Forking: Class-Local Content with Version History

**Status:** Phase 1 COMPLETE (22 March 2026) — copy-on-write forking, class-local editor, content resolution chain, dashboard 3-button layout, tabbed Manage page. Migration 040 APPLIED. P1 remaining: version history UI, reset-to-master, diff viewer.
**Author:** Matt Burton + Claude
**Date:** 22 March 2026
**Priority:** High — resolves core UX confusion on teacher dashboard

---

## Problem Statement

When a teacher clicks "Edit" on a class-unit card in the dashboard, they expect to edit the unit **for that class**. Instead, they're taken to the master unit template page — a global view that affects every class using that unit. This creates two problems: (1) teachers are confused about what they're editing ("am I changing this for all my classes?"), and (2) teachers can't make class-specific content tweaks without affecting other classes (e.g., adding an extra scaffolding page for a struggling Year 8 group while keeping Year 9's version lean).

The current architecture treats units as shared templates with per-class *configuration* (NM settings, due dates, scheduling) but not per-class *content*. This is the wrong abstraction for how teachers actually work — they iterate on lessons as they teach them, and those iterations are class-specific.

**Who is affected:** Every teacher using StudioLoom with multiple classes on the same unit.

**Cost of not solving:** Teachers either (a) avoid editing units because they're scared of breaking other classes, (b) create duplicate units manually (losing the parent relationship), or (c) get confused and accidentally change content for classes they didn't intend to.

---

## Goals

1. **Class-local editing:** When a teacher edits a unit from a class context, they edit a copy that belongs to that class — not the master template.
2. **Version history on the master:** The master unit page shows all versions (original + class-derived), so teachers can see how the unit evolved and assign proven versions to new classes.
3. **Zero-friction assignment:** Assigning a unit to a class creates a deep copy of the content automatically. No extra steps.
4. **Backward compatibility:** Existing class_units rows without forked content continue to work — they read from the master unit's `content_data` as a fallback until the teacher makes their first edit.
5. **Clean dashboard flow:** Dashboard card buttons become: **Teach** (purple, primary), **Manage Class** (class-colored), **Edit Unit** (goes to class-local content editor).

---

## Non-Goals

1. **Real-time collaborative editing** — Two teachers editing the same class-unit simultaneously. Out of scope; StudioLoom targets individual teachers. (Too complex, separate initiative.)
2. **Automatic conflict resolution** — If the master unit is updated, class forks don't auto-merge. The teacher manually chooses to pull changes. (Premature — teachers don't work this way.)
3. **Diff viewer between versions** — Showing a side-by-side diff of what changed between two versions. (Nice-to-have for v2; the version list with labels is sufficient for v1.)
4. **Student-visible version info** — Students never see version numbers or know the unit was forked. (No user value.)
5. **Forking units across teachers** — This spec covers forking within a single teacher's workspace. Community sharing / cross-teacher forking is a separate feature. (Already partially exists via `fork_count` / `forked_from` on the `units` table, but that's a different flow.)

---

## User Stories

### Teacher (class context)

- **As a teacher viewing my dashboard,** I want to click "Edit Unit" on a class card and go directly to editing that class's version of the unit, so that I don't accidentally change content for other classes.

- **As a teacher editing a class unit,** I want my changes to only affect the class I'm editing, so that my Year 9 group keeps their version while I add scaffolding to Year 8's version.

- **As a teacher assigning a unit to a new class,** I want the unit content to be copied automatically when I assign it, so that I start with the full content and can customize from there without extra steps.

- **As a teacher reviewing my unit library,** I want to see all versions of a unit (original + class-derived) on the master unit page, so that I can track how the unit evolved and pick the best version for a new class.

- **As a teacher assigning a unit to next year's class,** I want to choose which version to assign (original, or the one I refined while teaching Year 9 last term), so that I benefit from my past iterations.

### Teacher (library context)

- **As a teacher on the units page,** I want to see my unit templates as a clean library — not cluttered with class-specific copies, so that my workspace stays organized.

- **As a teacher editing the master template,** I want to update the "blessed" version that new classes will get by default, without affecting classes already running their own forks.

### Edge cases

- **As a teacher who hasn't edited a class unit yet,** I want the class to transparently use the master content (no unnecessary data duplication), so that storage isn't wasted on identical copies.

- **As a teacher who wants to reset a class unit,** I want to revert to the master version (or any saved version), so that I can undo my changes if they didn't work.

- **As a teacher deleting a class,** I want the class-local content to be cleaned up, but the version snapshot to remain available in the master's history if I previously saved it back.

---

## Requirements

### Must-Have (P0) — Ship-blocking

**P0.1: Lazy fork on first edit (copy-on-write)**
When a teacher navigates to edit a class-unit and makes their first change, the system deep-copies `units.content_data` into `class_units.content_data`. Subsequent edits modify the class-local copy. No content is copied at assignment time — only on first edit.

*Acceptance criteria:*
- [ ] Assigning a unit to a class does NOT copy content_data (current behavior preserved)
- [ ] `class_units.content_data` defaults to NULL (inherits from master)
- [ ] When teacher opens class-unit editor and saves any change, if `class_units.content_data` is NULL, deep-copy from `units.content_data` first, then apply the edit
- [ ] After fork, all reads for that class-unit use `class_units.content_data`, not `units.content_data`
- [ ] Editing the master unit does NOT affect class-units that have their own `content_data`
- [ ] Class-units with NULL `content_data` continue to read from master (backward compat)

**P0.2: Content resolution chain**
All code that reads unit content for a class context must follow the chain: `class_units.content_data` (if not NULL) → `units.content_data` (fallback).

*Acceptance criteria:*
- [ ] Student lesson pages resolve content via the chain (not direct from `units`)
- [ ] Teacher class-unit settings page resolves content via the chain
- [ ] Teaching Mode resolves content via the chain
- [ ] Projector view resolves content via the chain
- [ ] Lesson scheduling uses page list from resolved content
- [ ] NM checkpoint config references page IDs from resolved content
- [ ] `getPageList()` adapter works identically regardless of source

**P0.3: Class-unit content editor**
New page at `/teacher/units/[unitId]/class/[classId]/edit` — edits the class-local content. Replaces the current "Edit" button behavior from dashboard.

*Acceptance criteria:*
- [ ] Editor loads content from `class_units.content_data` (or master fallback)
- [ ] Teacher can reorder, add, remove, and edit pages
- [ ] Save writes to `class_units.content_data` (triggers fork if first edit)
- [ ] Editor shows a banner: "Editing for [Class Name] only" with link to master
- [ ] Editor shows "forked" badge if content has diverged from master
- [ ] Page IDs are preserved during fork (so progress, NM checkpoints, due dates all still work)

**P0.4: Dashboard button simplification**
Dashboard class-unit cards show 3 buttons: **Teach** (purple), **Manage Class** (class-colored), **Edit Unit** (goes to class-local editor).

*Acceptance criteria:*
- [ ] "Teach" links to `/teacher/teach/[unitId]?classId=[classId]`
- [ ] "Manage Class" links to `/teacher/units/[unitId]/class/[classId]` (existing settings page — rename from "Settings" to "Manage Class")
- [ ] "Edit Unit" links to `/teacher/units/[unitId]/class/[classId]/edit` (new class-local editor)
- [ ] Remove separate "Settings", "Progress", "Grade" buttons (fold into Manage Class page)
- [ ] Progress and Grade become tabs or sections within Manage Class

**P0.5: Migration — add content_data column to class_units**
Add `content_data JSONB DEFAULT NULL` to `class_units`. Add `forked_at TIMESTAMPTZ DEFAULT NULL` (timestamp of when content was first copied). Add `forked_from_version INTEGER DEFAULT NULL` (which master version was copied).

*Acceptance criteria:*
- [ ] Migration is additive-only (no column drops or renames)
- [ ] NULL `content_data` means "inherit from master" (backward compat)
- [ ] Existing class_units rows are unaffected
- [ ] Index on `class_units(class_id, unit_id)` already exists (composite PK)

### Nice-to-Have (P1) — Fast follow

**P1.1: Version history on master unit page**
The master unit detail page shows a "Versions" section listing all snapshots: the original, plus any class-derived versions that teachers have saved back.

*Acceptance criteria:*
- [ ] Master unit page shows version list (version number, label, date, source class)
- [ ] Teacher can label versions (e.g., "Refined for Year 9 2026")
- [ ] When assigning a unit to a new class, teacher can pick which version to use
- [ ] Default assignment uses the latest "blessed" version (or original if none promoted)

**P1.2: Save back to master**
Teacher can promote their class-local content to a new version of the master template. This doesn't overwrite the original — it adds a new version.

*Acceptance criteria:*
- [ ] "Save as new version" button on class-unit editor
- [ ] Creates a version snapshot on the master unit (`units.versions` JSONB array)
- [ ] Teacher provides a label for the version
- [ ] Original content is never overwritten — versions are append-only
- [ ] Master unit page shows the new version in the version list

**P1.3: Reset to master**
Teacher can reset a class-unit's content back to the master (or any saved version).

*Acceptance criteria:*
- [ ] "Reset to master" button on class-unit editor
- [ ] Confirmation dialog: "This will replace your class-specific changes. Are you sure?"
- [ ] Sets `class_units.content_data = NULL` (reverts to inheritance)
- [ ] Or: sets `class_units.content_data` to a specific version's content
- [ ] Progress data is preserved (page IDs don't change if resetting to same structure)

**P1.4: Fork indicator on dashboard cards**
Class-unit cards show a small badge when content has been forked from master.

*Acceptance criteria:*
- [ ] "Customized" badge appears when `class_units.content_data IS NOT NULL`
- [ ] Badge links to the class-unit editor
- [ ] No badge when using master content (default state)

### Future Considerations (P2) — Design for but don't build

**P2.1: Diff viewer**
Side-by-side comparison of two versions showing added/removed/changed pages.

**P2.2: Auto-suggest updates**
When master is updated, notify teachers with forked class-units: "The master unit was updated. Review changes?"

**P2.3: Merge tool**
Selectively pull changes from master into a fork (e.g., take the new Page 3 but keep my customized Page 5).

**P2.4: Cross-teacher version sharing**
A teacher publishes a version to the school library. Other teachers can assign it to their classes.

---

## Technical Design

### Database Changes

#### Migration 039: `class_units` content fork support

```sql
-- Add content_data column for class-local content (NULL = inherit from master)
ALTER TABLE class_units
  ADD COLUMN IF NOT EXISTS content_data JSONB DEFAULT NULL;

-- Track when the fork happened and which master version was copied
ALTER TABLE class_units
  ADD COLUMN IF NOT EXISTS forked_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE class_units
  ADD COLUMN IF NOT EXISTS forked_from_version INTEGER DEFAULT NULL;

-- Add version history to master units
ALTER TABLE units
  ADD COLUMN IF NOT EXISTS versions JSONB DEFAULT '[]';
-- Shape: [{ version: 1, label: "Original", content_data: {...}, created_at: "...", source_class_id: null },
--          { version: 2, label: "Refined for Year 9", content_data: {...}, created_at: "...", source_class_id: "abc" }]

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;
```

**Notes:**
- `class_units.content_data` is the same JSONB shape as `units.content_data` — it IS a full `UnitContentData` object. No partial diffs.
- `units.versions` stores full content snapshots. For a 15-lesson unit, each version is ~50-100KB of JSON. 10 versions = 0.5-1MB. Acceptable for PostgreSQL JSONB.
- `forked_from_version` lets us track lineage: "this class fork came from version 2 of the master."

#### Why full copy, not diffs?

Content diffs would be smaller but introduce massive complexity: applying diffs to evolving content, handling conflicts, maintaining diff format across content versions (v1/v2/v3/v4). Full copy is simpler, more reliable, and storage is cheap. A unit's `content_data` is typically 20-100KB — even 50 class forks would be 5MB total. PostgreSQL handles this effortlessly.

### Content Resolution Function

New utility at `src/lib/units/resolve-content.ts`:

```typescript
/**
 * Resolves unit content for a class context.
 * Returns class-local content if forked, otherwise master content.
 */
export function resolveClassUnitContent(
  unitContentData: UnitContentData,
  classUnitContentData: UnitContentData | null
): UnitContentData {
  return classUnitContentData ?? unitContentData;
}

/**
 * Server-side: fetches resolved content for a class-unit.
 * Used by student routes and teacher class-context routes.
 */
export async function getResolvedContent(
  supabase: SupabaseClient,
  unitId: string,
  classId: string
): Promise<{ content: UnitContentData; isForked: boolean }> {
  const { data: classUnit } = await supabase
    .from("class_units")
    .select("content_data")
    .eq("unit_id", unitId)
    .eq("class_id", classId)
    .single();

  if (classUnit?.content_data) {
    return { content: classUnit.content_data, isForked: true };
  }

  const { data: unit } = await supabase
    .from("units")
    .select("content_data")
    .eq("id", unitId)
    .single();

  return { content: unit!.content_data, isForked: false };
}
```

### Fork-on-Write Function

```typescript
/**
 * Ensures a class-unit has its own content_data.
 * If not yet forked, deep-copies from master and returns the fork.
 * If already forked, returns existing content.
 */
export async function ensureForked(
  supabase: SupabaseClient,
  unitId: string,
  classId: string
): Promise<UnitContentData> {
  const { data: classUnit } = await supabase
    .from("class_units")
    .select("content_data")
    .eq("unit_id", unitId)
    .eq("class_id", classId)
    .single();

  if (classUnit?.content_data) {
    return classUnit.content_data;
  }

  // Fork: copy master content
  const { data: unit } = await supabase
    .from("units")
    .select("content_data, current_version")
    .eq("id", unitId)
    .single();

  const forkedContent = JSON.parse(JSON.stringify(unit!.content_data));

  await supabase
    .from("class_units")
    .update({
      content_data: forkedContent,
      forked_at: new Date().toISOString(),
      forked_from_version: unit!.current_version ?? 1,
    })
    .eq("unit_id", unitId)
    .eq("class_id", classId);

  return forkedContent;
}
```

### Code Changes Required

#### Files that read unit content in a class context (MUST update to use resolution chain):

| File | Current behavior | Required change |
|------|-----------------|-----------------|
| `src/app/api/student/unit/route.ts` | Reads `units.content_data` directly | Read `class_units.content_data` first, fallback to `units.content_data` |
| `src/app/api/student/units/route.ts` | Reads `units.content_data` for all class units | Join `class_units.content_data`, use it if non-null |
| `src/contexts/UnitNavContext.tsx` | Receives unit content from API | No change needed — API returns resolved content |
| `src/app/teacher/units/[unitId]/class/[classId]/page.tsx` | Reads `units.content_data` | Use `getResolvedContent()` |
| `src/app/teacher/teach/[unitId]/page.tsx` | Reads `units.content_data` | Use `getResolvedContent()` when class is selected |
| `src/app/teacher/teach/[unitId]/projector/page.tsx` | Reads unit content | Use resolved content from dashboard postMessage |
| `src/app/api/teacher/teach/live-status/route.ts` | References page IDs | Page IDs unchanged — no change needed |
| `src/app/api/teacher/nm-config/route.ts` | References page IDs for checkpoints | Page IDs unchanged — no change needed |
| `src/components/teacher/LessonSchedule.tsx` | Receives pages as prop | Parent must pass resolved pages — update parent |
| `src/app/api/student/nm-checkpoint/[pageId]/route.ts` | Reads NM config referencing page IDs | Page IDs unchanged — no change needed |

#### Files that write unit content (MUST update to write to correct location):

| File | Current behavior | Required change |
|------|-----------------|-----------------|
| `src/app/api/teacher/generate-unit/route.ts` | Generates and returns pages (not saved) | No change — generates to master during wizard |
| `src/app/api/teacher/regenerate-page/route.ts` | Regenerates a page in unit content | Must accept `classId` param; if provided, write to `class_units.content_data` |
| Unit wizard save flow | Saves to `units.content_data` | No change — wizard creates the master template |
| **NEW: Class-unit editor save** | N/A | Writes to `class_units.content_data` via `ensureForked()` |

#### New files to create:

| File | Purpose |
|------|---------|
| `src/lib/units/resolve-content.ts` | `resolveClassUnitContent()`, `getResolvedContent()`, `ensureForked()` |
| `src/app/teacher/units/[unitId]/class/[classId]/edit/page.tsx` | Class-local content editor |
| `src/app/api/teacher/class-units/content/route.ts` | GET resolved content, PATCH to save edits (triggers fork) |
| `src/app/api/teacher/units/[unitId]/versions/route.ts` | GET version history, POST to save back a class version |
| `supabase/migrations/039_unit_forking.sql` | Schema changes |

### Page ID Preservation (Critical)

When forking, page IDs MUST be preserved. Multiple systems reference page IDs:
- `student_progress` rows (student_id + unit_id + page_id)
- `competency_assessments` rows (page_id for NM checkpoints)
- `class_units.page_due_dates` (pageId → date)
- `class_units.page_settings` (pageId → settings)
- `class_units.schedule_overrides` (pageId → extra sessions / notes)
- `class_units.nm_config.checkpoints` (pageId → elements)

Since `ensureForked()` does a deep copy, all page IDs remain identical. This is a **hard invariant** — any future content editing that adds or removes pages must handle ID allocation carefully:
- New pages get new IDs (nanoid)
- Removed pages: the page is removed from content but progress/assessment rows persist (orphaned but harmless)
- Reordered pages: IDs don't change, only the array position changes

### Dashboard Button Changes

The class-unit cards in `TwoColumnDashboard` simplify to 3 buttons:

```
┌─────────────────────────────────────────┐
│ [CLASS COLOR]  │  Unit Title      [50%] │
│  Class Name    │  3 working, NM, 🛡️1    │
│  5 students    │                        │
│                │  [▶ Teach] [Manage] [Edit] │
└─────────────────────────────────────────┘
```

- **Teach** → `/teacher/teach/[unitId]?classId=[classId]` (unchanged)
- **Manage Class** → `/teacher/units/[unitId]/class/[classId]` (existing page, absorbs Progress + Grade as tabs)
- **Edit Unit** → `/teacher/units/[unitId]/class/[classId]/edit` (new class-local editor)

The "Manage Class" page gets 4 tabs:
1. **Overview** — class info, term picker, schedule, NM config (current content)
2. **Progress** — student progress grid (currently at `/teacher/classes/[classId]/progress/[unitId]`)
3. **Grade** — grading interface (currently embedded in progress page)
4. **Safety** — badge requirements and results

This consolidation means every class-related action is reachable from one page, not scattered across 4 different URLs.

### Master Unit Page Changes

The unit detail page (`/teacher/units/[unitId]`) becomes a pure library view:

1. **Unit info** — title, description, metadata
2. **Assigned Classes** — which classes are using this unit (with fork indicator)
3. **Versions** (P1) — version history with labels, dates, source class
4. **Edit Master** — button to edit the master template (affects new assignments only)

---

## Success Metrics

### Leading Indicators (1-2 weeks post-launch)
- **Adoption:** >50% of dashboard "Edit" clicks go to class-local editor (not master)
- **Fork rate:** >30% of class-units get at least one content edit within 2 weeks
- **Task completion:** Teachers can edit a class-unit's content in <3 clicks from dashboard

### Lagging Indicators (1-2 months)
- **Reduced confusion:** Teacher support questions about "which version am I editing?" drop to near zero
- **Content iteration:** Average forked class-unit has >3 edits (teachers are actively iterating)
- **Version reuse (P1):** >20% of new class assignments use a non-original version

### Measurement
- Track via `class_units.forked_at` (non-null = forked)
- Track via `class_units.updated_at` (edit frequency)
- Track via `units.versions` array length (version creation rate)
- Dashboard click tracking via existing Sentry breadcrumbs

---

## Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Should the class-local editor be a full page editor or a simplified version? | Design + Matt | **RESOLVED: Full editor.** Teachers get full power to reorder, add/remove, and edit all page content. |
| 2 | When a teacher assigns a unit, should they always get the latest version, or choose? For v1, "always latest" is simpler. Version picker is P1. | Product | Open (non-blocking) |
| 3 | What happens to student progress when a teacher removes a page from a forked unit? Proposed: progress rows orphaned but preserved (student still gets credit). | Engineering | Open (non-blocking) |
| 4 | Should the "Manage Class" page absorb the progress page entirely, or just link to it? | Design + Matt | **RESOLVED: Same page with tabs.** Manage Class becomes a tabbed page: Overview, Progress, Grade, Safety. |
| 5 | Max versions per unit? Proposed: 20 (prevents unbounded JSONB growth). | Engineering | Open (non-blocking) |
| 6 | Should regenerating a single page in a class-unit auto-fork? Proposed: yes — any content change triggers fork. | Engineering | Open (non-blocking) |

---

## Timeline & Phasing

### Phase 1: Foundation (~3 days)
- Migration 039 (content_data + forked_at + forked_from_version on class_units, versions + current_version on units)
- `resolve-content.ts` utility (resolveClassUnitContent, getResolvedContent, ensureForked)
- Update student API routes to use resolution chain
- Update teacher class-unit routes to use resolution chain
- Dashboard button simplification (3 buttons)

### Phase 2: Class-Local Editor (~3-4 days)
- New page at `/teacher/units/[unitId]/class/[classId]/edit`
- Content editor UI (reorder pages, edit page content, add/remove pages)
- API route for saving class-unit content (triggers fork-on-write)
- "Editing for [Class Name]" banner with fork indicator

### Phase 3: Manage Class Consolidation (~2 days)
- Restructure class-unit settings page into tabbed layout
- Absorb Progress view into Manage Class
- Absorb Grade view into Manage Class
- Absorb Safety badge status into Manage Class
- Update all internal links

### Phase 4: Version History (P1, ~2 days)
- "Save as new version" flow on class-unit editor
- Version list on master unit page
- Version picker when assigning unit to class
- "Reset to master/version" on class-unit editor

**Total estimate:** ~10-11 days across 4 phases. Phases 1-2 are the critical path. Phase 3 is UX consolidation. Phase 4 is the version history feature.

### Dependencies
- Migration 037 (school calendar) should be applied first — it also modifies `class_units`
- No external dependencies
- No breaking changes to student-facing routes (resolution chain is transparent)

---

## Appendix: Data Flow Diagrams

### Current Flow (Unit Content)
```
Teacher creates unit → units.content_data = {...}
Teacher assigns to Class A → class_units row (no content)
Teacher assigns to Class B → class_units row (no content)
Student in Class A loads lesson → reads units.content_data
Student in Class B loads lesson → reads units.content_data
Teacher edits unit → changes units.content_data → BOTH classes affected
```

### New Flow (With Forking)
```
Teacher creates unit → units.content_data = {...}, versions = [v1]
Teacher assigns to Class A → class_units row (content_data = NULL)
Teacher assigns to Class B → class_units row (content_data = NULL)

Student in Class A loads lesson → class_units.content_data is NULL → falls back to units.content_data ✓
Student in Class B loads lesson → same fallback ✓

Teacher edits Class A's unit → ensureForked() copies units.content_data into class_units.content_data
→ class_units.forked_at = now, forked_from_version = 1

Student in Class A loads lesson → class_units.content_data is NOT NULL → uses class-local content ✓
Student in Class B loads lesson → class_units.content_data is NULL → still uses master ✓
Teacher edits master → ONLY affects Class B (Class A has its own copy)

Teacher promotes Class A's version → units.versions gets v2 with Class A's content
Teacher assigns to Class C → can choose v1 (original) or v2 (Class A's refinement)
```

### Resolution Chain (Priority Order)
```
1. class_units.content_data  (class-local fork, if exists)
2. units.content_data         (master template fallback)
```

This is the same inheritance pattern already used for NM config:
```
1. class_units.nm_config      (class-local, if exists)
2. units.nm_config            (unit-level fallback)
3. DEFAULT_NM_CONFIG          (hard-coded default)
```

---

## Appendix: JSONB Storage Estimates

| Item | Typical Size | Notes |
|------|-------------|-------|
| Unit content_data (15 lessons) | 50-100 KB | Includes all page content, scaffolding, response types |
| Version snapshot | 50-100 KB | Full copy of content_data |
| 10 versions per unit | 0.5-1 MB | Stored in units.versions JSONB array |
| 50 class forks of one unit | 2.5-5 MB | Across all class_units rows |
| PostgreSQL JSONB limit | 255 MB per value | Not a concern |

Storage growth is linear and bounded. Even an aggressive teacher with 10 units × 10 versions × 5 class forks = ~50 MB total. PostgreSQL handles this comfortably.
