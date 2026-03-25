# Year Planner & Curriculum Connection — Feature Spec

**Author:** Claude + Matt
**Date:** 25 March 2026
**Status:** Draft
**Estimate:** ~8-11 days (Year Planner ~4d, Curriculum Layer 1 ~2-3d, Materials ~3-4d)

---

## 1. Problem Statement

Teachers have no bird's-eye view of their year. Units are assigned to classes but there's no visual way to see when each unit runs, how long it takes, whether there are gaps or overlaps, and whether curriculum requirements are covered across the year. MYP coordinators specifically ask for this during programme reviews ("Show me your scope and sequence").

Currently, teachers plan on paper, in spreadsheets, or in their heads. StudioLoom has all the data (units, classes, terms, timetables) but no way to see it as a whole.

## 2. Goals

- Teachers can visually plan their entire year across all classes on one screen
- Drag-and-drop unit placement with real lesson count calculation
- Curriculum coverage gaps are visible at a glance
- Works with the existing term/timetable system (no new infrastructure needed)
- Feels fast and fluid (Framer Motion throughout)

## 3. Non-Goals (for v1)

- Cross-teacher collaboration / department-wide planning
- Automated unit sequencing / dependency resolution
- Curriculum builder / authoring (Layer 2 — future)
- Student-visible year plan
- Import from ManageBac/Toddle scope & sequence exports

---

## 4. Year Planner

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Year Planner                              2026 ▾   + Add Unit  │
├────────┬───────────────┬───────────────┬───────────────┬────────┤
│        │    Term 1     │    Term 2     │    Term 3     │ Term 4 │
│        │ Jan  Feb  Mar │ Apr  May  Jun │ Jul  Aug  Sep │ Oct... │
├────────┼───────────────┼───────────────┼───────────────┼────────┤
│ 8A DT  │ ██ Packaging ██  ██ Furniture █│               │        │
│        │               │               │ ████ Personal Project ██│
├────────┼───────────────┼───────────────┼───────────────┼────────┤
│ 9B DT  │    ██ Sustainable Design ██   │ ██ Product ██ │        │
│        │               │               │               │ ██App██│
├────────┼───────────────┼───────────────┼───────────────┼────────┤
│ 7C DT  │ ██ Intro ██   │ ██ Shelter ██ │  ██ Game ██   │        │
└────────┴───────────────┴───────────────┴───────────────┴────────┘
```

**Rows:** One per class (sorted by grade level, then name). Each class row is a swimlane.

**Columns:** Weeks of the academic year, grouped by terms. Term boundaries shown as vertical dividers with shaded backgrounds. Week numbers along the top.

**Unit blocks:** Colored bars (class color from CLASS_COLORS) positioned at their start week and spanning their lesson count. Each block shows unit title (truncated), lesson count badge, and criterion tags as tiny dots.

**Today marker:** Vertical red dashed line at current week.

**Unassigned units:** Sidebar panel (collapsible) showing units not yet placed on any class. Drag from sidebar onto a class row to assign.

### 4.2 Interactions

**Drag to move:** `motion.div` with `drag="x"` + `dragConstraints` bound to the timeline. Snaps to week boundaries on drop. Updates `planned_start_date` on `class_units`.

**Drag edges to resize:** Right edge handle. Dragging extends/shrinks the unit block. Shows live lesson count as you resize (computed via cycle engine: "X weeks × Y meetings/week = Z lessons"). Updates `planned_lesson_count` on `class_units`.

**Drag from sidebar:** HTML5 DnD (same pattern as lesson editor BlockPalette → DropZone). Dropping a unit onto a class row creates the `class_units` assignment + sets start date to the drop position.

**Click to open:** Clicking a unit block opens a popover with: unit title, lesson count, date range, criterion coverage, quick links (Edit Unit, Manage Class, Teach).

**Hover:** Shows tooltip with unit title, date range, lesson count.

### 4.3 Visual Polish (Framer Motion)

- `layoutId` on unit blocks for smooth transitions when moving between rows
- Spring physics on drop (`type: "spring", stiffness: 300, damping: 30`)
- `AnimatePresence` for sidebar unit list (units disappear when placed, reappear when removed)
- Resize handle uses `useMotionValue` + `useTransform` for real-time width feedback
- Week columns subtly highlight on hover (shows drop target)
- Term dividers use `motion.div` with `initial={{ scaleY: 0 }}` on first render

### 4.4 Data Model Changes

Add to `class_units` table (migration):

```sql
ALTER TABLE class_units
  ADD COLUMN planned_start_date DATE,
  ADD COLUMN planned_lesson_count INTEGER;
```

- `planned_start_date`: The Monday of the week the unit starts (or first class meeting date in that week). NULL = unscheduled.
- `planned_lesson_count`: Teacher's intended lesson count for this unit. NULL = use the unit's page count as default.

The cycle engine + term dates compute the actual end date from `(start_date, lesson_count, timetable)`. No need to store end date — it's derived.

### 4.5 API Endpoints

**GET `/api/teacher/year-planner`**
- Params: `academicYear` (optional, defaults to current)
- Returns: classes with their class_units (including planned_start_date, planned_lesson_count, unit title, criterion tags, page count), terms, timetable summary (meetings per week per class)

**PATCH `/api/teacher/year-planner/place`**
- Body: `{ classId, unitId, plannedStartDate, plannedLessonCount }`
- Updates class_units row

**POST `/api/teacher/year-planner/assign`**
- Body: `{ classId, unitId, plannedStartDate, plannedLessonCount }`
- Creates class_units row + places on timeline

### 4.6 Entry Point

- New tab on teacher dashboard: "Year Plan" (calendar icon)
- Also accessible from `/teacher/year-planner`
- Deep link: `/teacher/year-planner?year=2026&highlight=unitId` (scrolls to and pulses the unit)

---

## 5. Curriculum Connection (Layer 1 — Coverage Map)

### 5.1 Concept

Rather than building a full curriculum authoring system, Layer 1 adds **curriculum coverage tracking** as an overlay on the year planner. Teachers see which curriculum requirements are met by their planned units and where gaps exist.

### 5.2 Data Model

```sql
CREATE TABLE curriculum_frameworks (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  name TEXT NOT NULL,                    -- 'IB MYP Design'
  code TEXT NOT NULL UNIQUE,             -- 'myp-design'
  structure JSONB NOT NULL,              -- framework-specific structure
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE unit_curriculum_tags (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  unit_id TEXT REFERENCES units(id) ON DELETE CASCADE,
  framework_code TEXT NOT NULL,
  tag_type TEXT NOT NULL,                -- 'criterion', 'strand', 'concept', 'skill'
  tag_value TEXT NOT NULL,               -- 'A', 'B.iii', 'systems', etc.
  coverage_depth TEXT DEFAULT 'touched', -- 'touched', 'developed', 'assessed'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**`curriculum_frameworks.structure`** is framework-specific JSONB. For MYP Design:

```json
{
  "criteria": [
    { "key": "A", "name": "Inquiring & Analysing", "strands": ["A.i", "A.ii", "A.iii", "A.iv"] },
    { "key": "B", "name": "Developing Ideas", "strands": ["B.i", "B.ii", "B.iii"] },
    { "key": "C", "name": "Creating the Solution", "strands": ["C.i", "C.ii", "C.iii"] },
    { "key": "D", "name": "Evaluating", "strands": ["D.i", "D.ii", "D.iii", "D.iv"] }
  ],
  "concepts": {
    "key": ["adaptation", "collaboration", "ergonomics", "evaluation", ...],
    "related": ["innovation", "sustainability", "function", "form", ...]
  },
  "approaches_to_learning": ["communication", "social", "self-management", "research", "thinking"],
  "global_contexts": ["identities", "orientation", "personal_cultural", "scientific_technical", "globalisation", "fairness"]
}
```

This is seeded data — StudioLoom ships with MYP Design, GCSE DT, ACARA, A-Level pre-loaded. Teachers select which framework(s) their classes follow.

### 5.3 Coverage Overlay on Year Planner

When the teacher toggles "Show Coverage" on the year planner:

- A **coverage heatmap row** appears below each class swimlane
- Shows criterion/strand coverage across the year as colored cells
- Green = assessed, amber = touched but not assessed, gray = gap
- Hovering a gap cell shows: "Criterion C not addressed in Terms 2-3"
- Clicking a gap suggests: "These units cover Criterion C: [list]"

```
┌────────┬───────────────┬───────────────┬───────────────┐
│ 8A DT  │ ██ Packaging ██  ██ Furniture █│               │
│Coverage│ A● B● C○ D○   │ A○ B● C● D○   │ A○ B○ C○ D●   │
│        │ ▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ▓▓▓░░░▓▓▓▓▓▓ │ ░░░░░░▓▓▓▓▓▓ │
└────────┴───────────────┴───────────────┴───────────────┘
  ● = assessed   ○ = touched   (blank) = gap
```

### 5.4 Unit Tagging UI

On the unit detail page (or class-local editor), a "Curriculum" panel lets teachers tag which criteria/strands/concepts a unit addresses and at what depth (touched/developed/assessed). This is quick tagging, not detailed alignment — checkboxes and pills.

Units created by the AI wizard already have criterion mapping in their content. An auto-tag script can backfill `unit_curriculum_tags` from existing `content_data.criteria` arrays.

### 5.5 Year-End Coverage Report

A printable/exportable summary: "Year 8 Design Technology — 2026 Curriculum Coverage Report." Shows each criterion/strand with coverage status across the year, which units addressed it, and at what depth. This is the document MYP coordinators want for programme evaluation.

---

## 6. Materials & Purchasing Management

### 6.1 Problem

Design & Technology teachers spend significant time planning material purchases. Every unit needs specific materials (MDF, acrylic, foam board, electronic components, fabric, etc.) and the quantities depend on class size. Teachers currently track this in spreadsheets or their heads. When you can see all units across the year, you should also be able to see what you need to buy and when.

### 6.2 Unit Materials List

Each unit has a materials list stored as JSONB on the unit (or class-unit fork). Teachers add materials during unit creation or editing.

```typescript
interface UnitMaterial {
  id: string;                    // nanoid
  name: string;                  // "3mm MDF sheet (A3)"
  category: MaterialCategory;    // 'wood' | 'metal' | 'plastic' | 'electronics' | 'textile' | 'paper' | 'adhesive' | 'finishing' | 'consumable' | 'other'
  quantityPerStudent: number;    // 2
  unit: string;                  // 'sheets' | 'metres' | 'grams' | 'ml' | 'pieces' | 'rolls' | 'packs'
  estimatedCostPerUnit?: number; // 3.50 (in teacher's currency)
  currency?: string;             // 'AUD' | 'USD' | 'GBP' | 'CNY' etc
  supplier?: string;             // "Bunnings" or "Taobao" — free text
  supplierUrl?: string;          // Link to product page
  notes?: string;                // "Cut to 200×300mm before class"
  isOptional?: boolean;          // Extension materials vs required
  lessonPageId?: string;         // Which lesson needs this (null = whole unit)
}
```

**Data storage:** `units.content_data.materials: UnitMaterial[]` (travels with content, forks with content via copy-on-write). No new table needed.

### 6.3 Materials Editor (in Unit Editor)

A "Materials" tab/section in the lesson editor sidebar (below thumbnail, above lessons):

```
┌─────────────────────────┐
│ [Unit Thumbnail]        │
├─────────────────────────┤
│ Materials (7)     + Add │
│ ┌─────────────────────┐ │
│ │ 🪵 3mm MDF ×2/student│ │
│ │ 🔩 M3 bolts ×4      │ │
│ │ 🎨 Acrylic paint ×1  │ │
│ │ ...                  │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ Lessons               │ │
│ 1. Introduction         │
│ 2. Research             │
│ ...                     │
└─────────────────────────┘
```

Clicking "+ Add" opens a quick-add row: name, category (dropdown with icons), quantity, unit, optional cost. Clicking a material expands inline for full editing (supplier, notes, linked lesson). Materials can be dragged to reorder. Delete via swipe or × button.

**Per-lesson linking:** Teachers can optionally tag which lesson page needs each material. The lesson editor then shows a "Materials needed" chip on relevant lesson cards. Useful for multi-lesson units where different materials arrive at different stages.

### 6.4 Year Planner Materials Overlay

When the teacher toggles "Show Materials" on the year planner:

- A **materials row** appears below each class swimlane (or below coverage if both active)
- Shows material category icons at the weeks they're needed
- Hovering shows the full material list for that unit
- A summary panel at the right edge shows: total estimated cost per term, total per year

```
┌────────┬───────────────┬───────────────┬───────────────┐
│ 8A DT  │ ██ Packaging ██  ██ Furniture █│               │
│Material│ 🪵🎨          │ 🪵🔩🎨        │               │
│  Cost  │ ~$180         │ ~$340         │               │
└────────┴───────────────┴───────────────┴───────────────┘
```

### 6.5 Purchasing Dashboard

A dedicated view at `/teacher/purchasing` (also linked from year planner):

**Term Shopping List:** Aggregated across all classes for a selected term. Groups by material category. Shows:
- Material name
- Total quantity needed (sum of quantityPerStudent × class size, across all units in the term)
- Which units/classes need it
- Estimated total cost
- Supplier links (if provided)
- "Ordered" checkbox (local state, persisted)

```
Term 2 Shopping List                          Total: ~$1,240
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Wood
  3mm MDF A3 sheets    48 sheets   $168    8A(24) + 7C(24)    ☐ Ordered
  Pine dowel 8mm       24 metres   $36     8A(24)             ☐ Ordered

Electronics
  Arduino Nano         24 pcs      $192    9B(24)             ☐ Ordered
  LED 5mm assorted     96 pcs      $12     9B(24)             ☐ Ordered

Consumables
  PVA glue 500ml       6 bottles   $24     8A + 7C            ☐ Ordered
  Sandpaper 120g       48 sheets   $19     8A(24) + 7C(24)    ☐ Ordered
```

**Export:** CSV/Excel export of the shopping list for sending to school purchasing departments. This is the document finance offices want.

**Budget tracking (future):** Set a yearly budget, track actual spend against planned. Show remaining budget per term.

### 6.6 AI Material Suggestions

When the AI wizard generates a unit, it can suggest materials based on the unit topic and activities. The teacher reviews and adjusts. The prompt already knows the teacher's workshop spaces and available tools (from Teacher Settings) — it can infer appropriate materials.

For existing units without materials lists: an "Auto-suggest materials" button calls the AI with the unit content and returns a draft materials list. Teacher confirms/edits.

### 6.7 Data Model

No new tables needed for v1. Materials stored as JSONB on unit content:

```sql
-- Already exists: units.content_data is JSONB
-- Materials live at content_data.materials (array of UnitMaterial objects)
-- Forks via copy-on-write: class_units.content_data.materials

-- For the purchasing "ordered" state (per-teacher, not per-unit):
ALTER TABLE class_units
  ADD COLUMN purchasing_state JSONB DEFAULT '{}';
-- Shape: { ordered: { [materialId]: boolean }, notes: string }
```

### 6.8 Connection to Existing Systems

- **Workshop & Equipment tab (Teacher Settings):** Already stores workshop spaces, tools & machines, available software. The materials system reads this context — if a teacher has a laser cutter listed, the AI can suggest materials compatible with laser cutting.
- **Safety Badges:** Materials that require specific workshop access (e.g., "acrylic — needs laser cutter → requires Laser Cutter Safety badge") can show a safety badge indicator on the material row.
- **Unit Forking:** Materials fork with content via the existing copy-on-write system. Class A might use MDF while Class B uses cardboard for the same unit.
- **Lesson Scheduling:** When materials are linked to specific lessons, the purchasing dashboard can show "need by" dates derived from the lesson schedule.

---

## 7. Implementation Phases

### Phase 1: Year Planner Core (~3-4 days)
- Migration: `planned_start_date` + `planned_lesson_count` on class_units
- `YearPlanner` component: swimlanes, week grid, term markers, today line
- Unit blocks with drag-to-move (Framer Motion `drag="x"`, snap to week)
- Resize handle (drag right edge, live lesson count)
- API: GET planner data, PATCH placement
- Entry point: teacher dashboard tab + `/teacher/year-planner`

### Phase 2: Assign & Unassign (~1 day)
- Unassigned units sidebar with drag-to-assign
- Right-click/long-press to unassign (removes from timeline, keeps class_units row)
- Unit popover with quick links
- Empty state: "Drag units onto class rows to plan your year"

### Phase 3: Curriculum Coverage Layer 1 (~2-3 days)
- Migration: `curriculum_frameworks` + `unit_curriculum_tags` tables
- Seed MYP Design, GCSE DT, ACARA, A-Level framework data
- Unit tagging UI (criterion/strand checkboxes on unit detail page)
- Auto-tag backfill from existing content_data criterion arrays
- Coverage overlay toggle on year planner
- Coverage heatmap row per class
- Gap detection + suggestions

### Phase 4: Materials Management (~2-3 days)
- `UnitMaterial` type + materials array on content_data
- Materials editor section in unit editor sidebar (add/edit/delete/reorder)
- Per-lesson material linking (optional tag on each material)
- Materials overlay on year planner (category icons per unit block, cost summaries)
- Purchasing dashboard at `/teacher/purchasing` (term aggregation, quantity × class size, supplier links, ordered checkboxes)
- CSV/Excel export for school purchasing departments
- `purchasing_state` JSONB column on class_units (ordered checkboxes)

### Phase 5: AI Material Suggestions (~1 day)
- AI suggests materials during unit wizard generation (reads workshop/equipment context)
- "Auto-suggest materials" button on existing units without materials lists
- Teacher reviews/edits suggestions before saving

### Phase 6: Polish & Reports (~1 day)
- Year-end coverage report (printable HTML or PDF)
- Keyboard shortcuts (arrow keys to move selected unit, Shift+arrows to resize)
- Undo/redo for placements
- Mobile-friendly: horizontal scroll with momentum
- Print view (simplified, no interactivity)

---

## 7. Existing Infrastructure Used

| Component | How it's used |
|-----------|---------------|
| `school_calendar_terms` | Term boundaries for the grid |
| `class_units` junction | Already links units to classes — just add date/count columns |
| `class_meetings` + cycle engine | Computes actual lesson dates from (start_date, lesson_count) |
| `CLASS_COLORS` | Unit block colors per class |
| Framer Motion | Already in project — `motion.div`, `Reorder`, `AnimatePresence` |
| `UnitThumbnail` | Mini thumbnail on unit blocks |
| Content resolution chain | Shows forked unit titles correctly |
| Workshop & Equipment settings | Teacher's available tools/spaces inform AI material suggestions |
| Unit forking (copy-on-write) | Materials fork with content — Class A uses MDF, Class B uses cardboard |
| AI wizard + Haiku 4.5 | Material suggestion generation from unit content |

---

## 8. Key Design Decisions

- **Week-based grid, not day-based.** Teachers think in weeks, not days. A day-based grid would be too zoomed in for a year view.
- **Lesson count derived from cycle engine, not stored as end date.** Same class can have different meeting frequencies in different terms. The engine handles this correctly.
- **Coverage is overlay, not primary view.** The year planner is useful even without curriculum tagging. Coverage adds value but shouldn't be required to use the planner.
- **Framework data is seeded, not user-created (Layer 1).** Teachers select from pre-loaded frameworks. Custom framework authoring is Layer 2.
- **Unit tagging is manual + auto-backfilled.** AI-generated units already have criterion data. Teachers can adjust. Full auto-classification is future work.
- **No cross-teacher view in v1.** This is a single-teacher tool. Department-wide planning (multiple teachers on one view) is a coordinator feature for later.
- **Materials on content_data, not a separate table.** Materials are unit content — they fork with the unit, travel with exports, and don't need independent querying. The purchasing aggregation is computed at read time from class_units × class size. Only the "ordered" checkbox state needs its own column (`purchasing_state` on class_units).
- **Quantity per student, not total quantity.** Teachers think "2 sheets per kid" not "48 sheets." The system multiplies by class size for purchasing. If the same unit runs for two classes, both are summed automatically.
- **Material categories use simple enum, not taxonomy.** 10 categories (wood, metal, plastic, electronics, textile, paper, adhesive, finishing, consumable, other) cover D&T needs without overcomplicating. Teachers can always use "other" + notes.

---

## 9. Dependencies

- **School calendar terms must exist** — teacher needs at least one academic year with terms defined. Show setup prompt if missing.
- **Timetable must exist** — need class meetings to compute lesson counts from weeks. Show estimated count (based on 1 meeting/week default) if no timetable configured.
- **Units must be assigned to classes** — existing `class_units` rows populate the planner. Unassigned units appear in the sidebar.

---

## 10. Future Expansion (Layer 2+)

- **Curriculum-as-template:** A curriculum defines a sequence of units with dependencies. Schools share curriculum templates. "Import the MYP Year 8 Design scope & sequence."
- **Cross-teacher coordination:** Department view showing all teachers' year plans. Identify where shared resources (workshop spaces, equipment) create scheduling conflicts.
- **AI-suggested sequencing:** "Based on your curriculum tags, Unit B should come before Unit D because it develops prerequisite skills."
- **ManageBac/Toddle sync:** Import/export scope & sequence data from school management systems.
- **Multi-year view:** See progression from Year 7 → Year 8 → Year 9. Ensure vertical articulation of skills.
- **Student-visible roadmap:** Students see "Here's what we're doing this year" with progress indicators per unit.
- **Budget tracking:** Set yearly/termly budget, track actual spend against planned, remaining budget alerts.
- **Supplier management:** Preferred supplier list with saved links, price history, lead time estimates. "Last ordered from Bunnings at $3.50/sheet on 15 March."
- **Material templates:** Common material sets for popular unit types (e.g., "Electronics starter kit: Arduino + breadboard + jumper wires + LEDs + resistors"). One-click add to a unit.
- **Purchase order generation:** Auto-generate PO documents from the shopping list in school's required format.
- **Inventory tracking:** Track what's already in the workshop stockroom. Purchasing dashboard shows "need to buy" = required minus in stock.
