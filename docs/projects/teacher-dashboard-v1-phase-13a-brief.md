# Phase 13a — PYPX Schema + Teacher Setup UI

Gate phase for 13b (PypxView v2 consuming real data) and 13c (student PYPX dashboard). Until teachers can save Exhibition dates + per-student projects somewhere, neither of those phases has data to read.

## Scope

### 1. Data model

**`class_units.exhibition_config JSONB`** (NEW column, not new table) — mirrors the existing `nm_config` + schedule-overrides pattern. Single JSONB per class+unit:

```json
{
  "exhibition_date": "2026-05-21",
  "mentor_checkin_interval_days": 7,
  "milestones": [
    { "id": "m1", "label": "Rehearsal",        "date": "2026-05-14", "type": "rehearsal" },
    { "id": "m2", "label": "Boards due",       "date": "2026-05-19", "type": "deliverable" },
    { "id": "m3", "label": "Research checkpoint", "date": "2026-04-28", "type": "checkpoint" }
  ]
}
```

`exhibition_date` is the top-level "big day" — special-cased in PypxView for countdown. `milestones[]` is a flexible array so teachers can add any number of dated checkpoints with a label + type (rehearsal / deliverable / checkpoint / other). No migration needed to add new dates later.

Keeping it JSONB rather than a separate `exhibition_events` table because:
- Same pattern as existing per-class-unit config (nm_config, schedule overrides).
- Zero new FK management for v1.
- Flexible `milestones[]` covers every date teachers want today without pre-committing to specific columns.
- If teachers later need queryable milestone search or notifications, we migrate `milestones[]` to a `class_unit_milestones` table — cheap to do later, cheap to delay.

**`student_projects`** (NEW table) — one row per (student × class × unit):

```sql
CREATE TABLE student_projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  class_id      UUID NOT NULL REFERENCES classes(id)   ON DELETE CASCADE,
  unit_id       UUID NOT NULL REFERENCES units(id)     ON DELETE CASCADE,
  title                      TEXT    NULL,
  central_idea               TEXT    NULL,
  lines_of_inquiry           TEXT[]  NULL,              -- unbounded array of short strings
  transdisciplinary_theme    TEXT    NULL,              -- PYP's 6 themes, free text for now (enum later)
  mentor_teacher_id          UUID    NULL REFERENCES teachers(id) ON DELETE SET NULL,
  current_phase              TEXT    NULL CHECK (current_phase IN ('wonder','findout','make','share','reflect')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, class_id, unit_id)
);
```

RLS (mirrors 041 junction pattern):
- Teachers: full CRUD if they own the class OR they're the `mentor_teacher_id`.
- Students: read-only on their own row (via student_sessions).
- Nobody else.

### 2. API routes

- `GET  /api/teacher/exhibition?classId=…&unitId=…` → `{ exhibition_config }` from class_units.
- `PATCH /api/teacher/exhibition` → body `{ classId, unitId, exhibition_date?, mentor_checkin_interval_days?, milestones? }`, upserts into `class_units.exhibition_config`. Full-array replacement on `milestones` (simpler than diff-patch for v1).
- `GET  /api/teacher/student-projects?classId=…&unitId=…` → `[StudentProject]` for all enrolled students (joins `class_students` to include students without a project row yet, returning an empty placeholder per student).
- `POST /api/teacher/student-projects` → body `{ studentId, classId, unitId, title?, central_idea?, lines_of_inquiry?, transdisciplinary_theme?, mentor_teacher_id?, current_phase? }`, upsert on `(student_id, class_id, unit_id)`.

All routes use `requireTeacherAuth` + standard createAdminClient pattern after auth check (same as `/api/teacher/schedule/today`).

### 3. Teacher UI — `/teacher/classes/[classId]/exhibition`

New route, reachable via a new "Exhibition" button on `/teacher/classes/[classId]` that **only shows when `class.framework === "IB_PYP"`** (keeps the UI scoped to PYP classes). Page contents:

- **Header** — breadcrumb `Classes ▸ {Class Name} ▸ Exhibition`. Unit picker dropdown if the class has >1 active unit (else auto-picked).
- **Dates card** — Exhibition date (top-level, prominent countdown chip) + "Add milestone" button that appends a row `{ label, date, type }` to the milestones array. Each milestone row has delete. Wired to `/api/teacher/exhibition`.
- **Student projects table** — one row per enrolled student with inline-editable columns: project title, central idea (textarea-expand), transdisciplinary theme (dropdown or text), mentor (dropdown of teachers in this school), phase (pill picker — wonder/findout/make/share/reflect). Auto-save on blur. Adds a new student_projects row on first edit.
- **"Lines of inquiry" editor** — click a student row → drawer/expand with up to 4 short text fields + delete buttons.

Bold-styled to fit TeacherShell. No new navigation chrome required — TeacherShell provides it.

### 4. Out of scope for 13a

- PypxView v2 (Phase 13b) reads this data; Phase 13a does not touch it.
- Student-facing PYPX dashboard (Phase 13c).
- Mentor-side workflow (mentors viewing assigned students, check-ins).
- Enforced lines-of-inquiry count (unbounded — any number).
- Transdisciplinary-theme enum (free text; enum in a later cleanup).
- Multi-teacher mentoring (single `mentor_teacher_id` for now).

## Teacher vs student ownership

| Field | Set by teacher in 13a | Student edits in 13c | Notes |
|-------|----------------------|---------------------|-------|
| Exhibition date + milestones | ✅ always | ❌ | Class-level; dates affect everyone. |
| Mentor assignment | ✅ always | ❌ | Teacher picks a mentor for each student from the school's teacher list. |
| Mentor check-in cadence | ✅ always | ❌ | Drives Kit nudges later. |
| Project title | ✅ MVP (13a) | ✅ (13c primary) | Teacher scaffolds early, student takes over. Teacher retains override forever. |
| Central idea | ✅ MVP (13a) | ✅ (13c primary) | Same as title. |
| Lines of inquiry | ✅ MVP (13a) | ✅ (13c primary) | Same. |
| Transdisciplinary theme | ✅ MVP (13a) | ✅ (13c primary) | Same. |
| Current phase | ✅ (override) | ✅ (self-report in 13c) | Student self-reports, teacher nudges/overrides. |

Rule of thumb: in 13a (no student UI yet) the teacher can edit everything so PypxView v2 (13b) has real data to render. When 13c ships, student-owned fields become primary-student-edit + teacher-override.

## Sub-phases

| Step | Scope | Stop trigger |
|------|-------|--------------|
| 13a-1 | Migration 115 — add `exhibition_config` column + create `student_projects` table + RLS. (Originally 111; renumbered 25 Apr 2026 after parallel branches claimed 111–114.) | Any SQL validation error, FK conflict. |
| 13a-2 | API routes — `exhibition` GET/PATCH + `student-projects` GET/POST. Tests for auth + basic payload shape. | Any RLS denies a happy path. |
| 13a-3 | Route scaffold — `/teacher/classes/[classId]/exhibition` page + "Exhibition" entry-point button on class detail (PYP-only). | Route doesn't render under TeacherShell. |
| 13a-4 | Dates card — exhibition_date + flexible milestones[] + check-in cadence. | Save round-trips fail. |
| 13a-5 | Student projects table inline editor — title / central idea / theme / mentor / phase. | Auto-save storms server, stale state overwrites fresh edits. |
| 13a-6 | Lines-of-inquiry drawer per student (unbounded). | None — cosmetic, skippable if 13a-5 takes longer than expected. |

## Don't stop for

- ESLint warnings on inline styles.
- Imperfect typography on the new table (Phase 9b polish has the responsibility).
- Missing empty state for "no students enrolled" — show a basic "Enrol students first" banner, move on.
- Transdisciplinary-theme autocomplete — plain text input is fine.

## Checkpoint 13a.1 — what "done" looks like

1. Matt creates/opens an IB_PYP class with students.
2. Clicks "Exhibition" button → lands on the new page.
3. Sets Exhibition date, rehearsal date → saves, refresh persists them.
4. Edits project title + central idea + theme + assigns a mentor + sets phase for ≥2 students → rows persist, no RLS errors.
5. Another teacher in the same org (without ownership) cannot read these rows.

## Push discipline

Migration needs to be applied to prod Supabase **before** this lands on main. Matt applies the migration file manually via the Supabase dashboard when he's ready. Until then, code lives on `dashboard-v2-build`, commits stack up, and we push migrations + app code to main together.
