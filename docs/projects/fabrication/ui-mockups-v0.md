# Preflight — UI Mockups v0

> **Purpose:** Validate that the Phase 1A schema (7 tables, 13 RLS policies) carries every field the UI needs — and that every column has a home in the UI. Wireframes are intentionally ASCII to keep field annotations tight. Visual polish comes in Phase 1B–2 build.
> **Scope:** Free public user, logged-in student, Fabricator (lab tech), and teacher surfaces.
> **Purpose of this doc:** Cross-walk UI elements ↔ schema columns. Any element without a column = schema gap. Any column without an element = either orphan or future-phase.
> **Author:** Code (draft) · **Reviewer:** Matt · **Target:** pre-Phase-1B design sign-off.

---

## Legend

Every field in a wireframe is annotated with its source schema column:

- `⟨table.column⟩` — value comes from this column
- `⟨derived: explanation⟩` — computed on the server (not a direct column)
- `⟨new?⟩` — proposed new column / schema gap
- `⟨decision?⟩` — element needs a product decision before build
- Square brackets `[like this]` = buttons
- Slashes at end of route = dynamic ID (e.g. `/jobs/[jobId]`)

---

## Surface 1: Logged-in Student — full submission flow

### 1.1 List page — `/student/preflight`

All my Preflight submissions, newest first. Entry point for revisiting in-flight jobs.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Preflight                                   [ + New Submission ]         │
│  Send your designs to a machine — with a check first.                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  FILTER  [ All ]  [ Needs revision ]  [ Awaiting approval ]  [ Queued ]  │
│          [ Picked up ]  [ Completed ]  [ Rejected ]                      │
│                                                                          │
│ ┌───────┬────────────────────────┬───────────────┬───────────────┬─────┐ │
│ │ THUMB │ phone-stand-v3.stl     │ Bambu X1C     │ Needs revision│  ⚠  │ │
│ │ [img] │ Unit: Phone accessories│ Rev 2 / 3     │ 2 min ago     │     │ │
│ │       │ ⟨revisions.          │ ⟨jobs.current │ ⟨jobs.status⟩ │     │ │
│ │       │  thumbnail_path⟩     │  _revision⟩   │               │     │ │
│ │       │ ⟨jobs.original_     │               │               │     │ │
│ │       │  filename⟩ / ⟨units │               │               │     │ │
│ │       │  .title⟩            │               │               │     │ │
│ └───────┴────────────────────────┴───────────────┴───────────────┴─────┘ │
│                                                                          │
│ ┌───────┬────────────────────────┬───────────────┬───────────────┬─────┐ │
│ │ THUMB │ bookmark.svg           │ Glowforge Pro │ Picked up     │  🟢 │ │
│ │       │ Unit: Laser intro      │ Rev 1 / 1     │ by Cynthia    │     │ │
│ │       │                       │               │ 1h ago        │     │ │
│ └───────┴────────────────────────┴───────────────┴───────────────┴─────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

**Field coverage:**
| UI element | Source |
|---|---|
| thumbnail | `fabrication_job_revisions.thumbnail_path` (latest revision via `current_revision`) |
| filename | `fabrication_jobs.original_filename` |
| unit label | JOIN via `fabrication_jobs.unit_id` → `units.title` |
| machine name | JOIN via `fabrication_jobs.machine_profile_id` → `machine_profiles.name` |
| status | `fabrication_jobs.status` |
| revision number | `fabrication_jobs.current_revision` |
| "2 min ago" | `fabrication_jobs.updated_at` |
| "Picked up by Cynthia" | JOIN via `fabrication_jobs.lab_tech_picked_up_by` → `fabricators.display_name` — **⟨schema gap: no FK, raw UUID. Resolution today: teacher server-side lookup, accept the untyped JOIN. Hardening FU already filed.⟩** |
| filter tabs | `fabrication_jobs.status` grouped |

### 1.2 New Submission — `/student/preflight/new`

Pre-check + machine picker + drop zone. Step-by-step to reduce cognitive load.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  New Preflight submission                                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Step 1 — Which machine will make this?                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 3D Printer    ● Bambu Lab X1 Carbon  (Room 204)                  │   │
│  │                ○ Prusa MK4S  (Room 201)                          │   │
│  │ Laser Cutter  ○ Glowforge Pro  (Room 205)                        │   │
│  │                ○ xTool P2  (Room 205)                            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ⟨machine_profiles WHERE is_active AND (is_system_template OR teacher_id │
│                                           in student's teachers)⟩       │
│                                                                          │
│  Step 2 — Quick check (30 seconds)                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ What's this for?                                                 │   │
│  │ [ Unit dropdown: Phone accessories ▼ ]  ⟨units.id, units.title⟩ │   │
│  │                                                                  │   │
│  │ How big should it be (roughly)?                                  │   │
│  │ (○) Fits in your hand  (●) A4 or smaller  (○) Bigger             │   │
│  │ ⟨new? — not persisted to schema yet; drives scanner expectations⟩│   │
│  │                                                                  │   │
│  │ What units did you design in?                                    │   │
│  │ (●) Millimetres  (○) Centimetres  (○) Inches                     │   │
│  │ ⟨new? — same — helps scanner catch R-STL-07 unit mismatch⟩      │   │
│  │                                                                  │   │
│  │ What material are you planning to use?                           │   │
│  │ [ Material dropdown: PLA ▼ ]                                     │   │
│  │ ⟨derived from machine_profiles.supported_materials⟩             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Step 3 — Upload your file                                               │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │         ⬇  Drag .stl or .svg here, or [ Browse ]                │   │
│  │           Max 200 MB. STL for 3D printer, SVG for laser.         │   │
│  │ ⟨jobs.file_type CHECK ('stl' | 'svg')⟩                           │   │
│  │ ⟨new? — "intended_size_bucket" + "designed_in_units" +           │   │
│  │   "chosen_material" fields to persist student pre-check answers⟩ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│                                      [ Cancel ]  [ Submit & Check ]      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Schema gap flagged:** The 3 pre-check answers (size bucket, units, material) aren't captured in `fabrication_jobs` yet. They're not load-bearing for RLS or status but they ARE inputs to the scanner's decision — if a student says "A4 or smaller" and the bounding box is 900mm × 600mm, that's a louder error than if they didn't specify. **Proposed new JSONB column on `fabrication_jobs`:**

```sql
ALTER TABLE fabrication_jobs ADD COLUMN student_intent JSONB;
-- Shape: { size_bucket: "a4_or_smaller"|"hand"|"bigger", designed_units: "mm"|"cm"|"inch", chosen_material: "PLA"|... }
```

Migration 098 candidate for Phase 1B.

### 1.3 Scanning state — same route, loading overlay

Student just clicked "Submit & Check". File uploaded; scanner running. Staged messaging builds trust that it's real analysis, not theatre.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│             Checking phone-stand-v3.stl against Bambu X1C                │
│                                                                          │
│               ● Uploading ──────── (3.2 MB of 3.2 MB)  ✓                 │
│               ● Checking geometry integrity…                             │
│               ○ Checking fit on the bed                                  │
│               ○ Checking wall thickness                                  │
│               ○ Rendering preview                                        │
│                                                                          │
│                   Usually takes 5–15 seconds.                            │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Polling source:**
- `fabrication_job_revisions.scan_status` transitions `pending → running → done | error`.
- Stage labels are static (client-side), but could be driven by `fabrication_scan_jobs` milestones if we split the worker into named phases later. **⟨decision?⟩ — drive stages from scanner progress events, or keep as "theatre"? For v1, client-side sequence is fine.**

### 1.4 Results page — `/student/preflight/[jobId]`

The pedagogical heart. Three buckets. Must-fix blocks submission; should-fix requires per-item acknowledge; FYI is info only.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  phone-stand-v3.stl · Bambu X1C · Revision 1 · 3.2 MB                    │
│  ⟨jobs.original_filename⟩ · ⟨machine_profiles.name⟩ ·                    │
│    ⟨jobs.current_revision⟩ · ⟨revisions.file_size_bytes⟩                │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  [ 3D preview thumbnail ]   ⟨revisions.thumbnail_path⟩          │   │
│  │  Bounding box: 58 × 32 × 12 mm                                  │   │
│  │  Estimated print time: 2h 47min · Filament: 18g                 │   │
│  │  ⟨jobs.latest_scan_results.bbox⟩ ⟨...estimates⟩                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  🛑 2 MUST FIX  — your file can't run on the machine until these clear   │
│                                                                          │
│  R-STL-09 Wall too thin at back panel                                    │
│    Your wall is 0.3mm thick. The X1C's 0.4mm nozzle can't form walls    │
│    thinner than 0.6mm. [ Show where ]                                   │
│    → How other students fixed this: [ Skills Library → wall thickness ] │
│    ⟨latest_scan_results.findings[] where severity="block"                │
│       .rule_id, .title, .explanation, .evidence, .skills_library_url⟩   │
│                                                                          │
│  R-STL-01 Model has holes (not watertight)                               │
│    The mesh isn't closed — the slicer won't know what's solid vs air.   │
│    [ Show where ]  [ Skills Library → watertight meshes ]               │
│                                                                          │
│  ⚠  1 SHOULD FIX  — acknowledge each before submitting                   │
│                                                                          │
│  R-STL-11 Overhang at 52° on underside                                   │
│    Overhangs steeper than 45° usually need support structure or will    │
│    droop. [ Show where ]                                                │
│    [ ] I'll add supports in the slicer                                  │
│    [ ] This is intentional — I want the droop                           │
│    ⟨jobs.acknowledged_warnings JSONB: [{rule_id, ack_at, option}]⟩      │
│                                                                          │
│  ℹ️  FYI                                                                 │
│  · Estimated print time: 2h 47min                                        │
│  · Estimated filament: 18g                                               │
│  · Triangle count: 41,203                                                │
│  ⟨...severity="fyi" findings⟩                                            │
│                                                                          │
│  Scanner ruleset: v1.0.0 (Bambu X1C · teacher overrides: 0)              │
│  ⟨jobs.scan_ruleset_version⟩ ⟨derived: count of machine_profiles        │
│                                       .rule_overrides keys⟩              │
│                                                                          │
│  [ Re-upload fixed file ]          [ Submit ] (disabled until must-fix   │
│                                      cleared + all warnings ack'd)       │
└──────────────────────────────────────────────────────────────────────────┘
```

**Revision history strip** (below the results):

```
  Your attempts on this project:
  Rev 3 — Just now — needs revision (2 must-fix)       [ view ]
  Rev 2 — 12 min ago — needs revision (1 must-fix)     [ view ]
  Rev 1 — 25 min ago — needs revision (3 must-fix)     [ view ]
```

Sourced from all `fabrication_job_revisions WHERE job_id = current.job_id ORDER BY revision_number DESC`.

**Schema check for findings shape** — `fabrication_jobs.latest_scan_results` JSONB and `fabrication_job_revisions.scan_results` JSONB need to encode:

```jsonc
{
  "ruleset_version": "1.0.0",
  "bbox": { "x_mm": 58, "y_mm": 32, "z_mm": 12 },
  "estimates": { "print_time_min": 167, "filament_g": 18, "triangle_count": 41203 },
  "findings": [
    {
      "rule_id": "R-STL-09",
      "severity": "block" | "warn" | "fyi",
      "title": "Wall too thin at back panel",
      "explanation": "Your wall is 0.3mm thick…",
      "evidence": { "type": "coordinates", "points": [[x,y,z]], "thumbnail_path": "…" },
      "fix_hint": "Increase wall to 0.6mm+ in Tinkercad.",
      "skills_library_slug": "wall-thickness"
    }
  ]
}
```

No schema change needed — JSONB is flexible. Document this shape in a TypeScript type definition when Phase 2 scanner worker is built.

### 1.5 Passed state — queued for teacher or ready for machine

After must-fixes clear and warnings acknowledged, student hits [ Submit ]. Two possible landing states:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ✅  phone-stand-v3.stl is clear                                         │
│                                                                          │
│  ⟨if machine_profiles.requires_teacher_approval⟩                         │
│    Waiting for Mr Burton to approve. Usually < 1 day.                   │
│    Status: pending_approval   ⟨jobs.status⟩                             │
│                                                                          │
│  ⟨else⟩                                                                  │
│    Queued for Bambu X1C. Cynthia (lab tech) will print it.               │
│    You'll get a notification when it starts and when it finishes.        │
│    Status: approved           ⟨jobs.status⟩                             │
│                                                                          │
│  [ Back to my submissions ]                                              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Surface 2: Fabricator (lab tech) — queue + pickup

Minimal UI. Fabricators are busy, often non-technical. One screen does 80% of the work.

### 2.1 Login — `/fab/login`

```
┌──────────────────────────────────────────┐
│            Preflight — Fabricator        │
│                                          │
│  Email:    [ _________________________ ] │
│  Password: [ _________________________ ] │
│                                          │
│            [        Sign in        ]     │
│                                          │
│  Forgot password? Ask your teacher to    │
│  send you a new invite.                  │
└──────────────────────────────────────────┘
```

**Backend:**
- POST → lookup `fabricators WHERE LOWER(email) = LOWER(:email)` → bcrypt verify against `password_hash` → create `fabricator_sessions` row with bcrypt-hashed token → set cookie, redirect to `/fab/queue`.
- Update `fabricators.last_login_at`.

### 2.2 Queue — `/fab/queue`

Per-machine lists. A Fabricator assigned to multiple machines sees them stacked.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Preflight · Cynthia Chen   ⟨fabricators.display_name⟩     [ Sign out ]  │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  Bambu Lab X1 Carbon — Room 204                                          │
│  ⟨machine_profiles.name⟩   (3 waiting)                                   │
│                                                                          │
│  ┌───────┬────────────────────┬─────────┬──────────┬──────────┬───────┐ │
│  │ THUMB │ Ella Chen          │ phone-  │ submitted│ 3.2 MB   │ [PICK │ │
│  │       │ Yr 10 · Phone acc. │ stand-  │ 14 min   │          │  UP]  │ │
│  │       │ ⟨student.name⟩     │ v3.stl  │ ago      │          │       │ │
│  │       │ ⟨units.title⟩      │         │ ⟨jobs.  │⟨revisions│       │ │
│  │       │                    │         │ updated │ .file_   │       │ │
│  │       │                    │         │ _at⟩    │ size_    │       │ │
│  │       │                    │         │         │ bytes⟩   │       │ │
│  └───────┴────────────────────┴─────────┴──────────┴──────────┴───────┘ │
│  ┌───────┬────────────────────┬─────────┬──────────┬──────────┬───────┐ │
│  │ THUMB │ Oliver Li          │ keychain│ 1h ago   │ 480 KB   │ [PICK │ │
│  │       │ Yr 9 · Gift design │ -v2.stl │          │          │  UP]  │ │
│  └───────┴────────────────────┴─────────┴──────────┴──────────┴───────┘ │
│                                                                          │
│  Currently printing                                                      │
│  ┌───────┬────────────────────┬─────────┬──────────┬───────────────────┐│
│  │ THUMB │ Jisoo Park         │ chess-  │ 2h ago   │ [ Mark printed ]  ││
│  │       │ Yr 11 · Chess set  │ king.stl│          │ [ Failed + note ] ││
│  │       │                    │         │ ⟨jobs.  │                   ││
│  │       │                    │         │ lab_    │                   ││
│  │       │                    │         │ tech_   │                   ││
│  │       │                    │         │ picked_ │                   ││
│  │       │                    │         │ up_at⟩  │                   ││
│  └───────┴────────────────────┴─────────┴──────────┴───────────────────┘│
├──────────────────────────────────────────────────────────────────────────┤
│  Glowforge Pro — Room 205                                                │
│  (2 waiting)                                                             │
│                                                                          │
│  ┌───────┬────────────────────┬─────────┬──────────┬──────────┬───────┐ │
│  │ THUMB │ Mika Tanaka        │ name-   │ 25 min   │ 120 KB   │ [PICK │ │
│  │       │ Yr 7 · Laser intro │ tag.svg │ ago      │          │  UP]  │ │
│  └───────┴────────────────────┴─────────┴──────────┴──────────┴───────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

**Query shape (service-role, scoped by session):**
```sql
-- For each machine in fabricator_machines where fabricator_id = :me
SELECT j.*, r.thumbnail_path, s.display_name AS student_name, u.title AS unit_title
FROM fabrication_jobs j
JOIN fabrication_job_revisions r ON r.job_id = j.id AND r.revision_number = j.current_revision
LEFT JOIN students s ON s.id = j.student_id
LEFT JOIN units u ON u.id = j.unit_id
WHERE j.machine_profile_id = :machine_id
  AND j.status IN ('approved', 'picked_up')
ORDER BY
  CASE j.status WHEN 'picked_up' THEN 0 ELSE 1 END,  -- currently printing at top
  j.updated_at;
```

Fabricator RLS returns nothing for this query (`auth.uid()` is NULL on Fabricator requests). The app layer runs this query with service role, scoped via `fabricator_sessions` → `fabricator_id` → `fabricator_machines` join.

### 2.3 Per-job view — `/fab/jobs/[jobId]`

Pickup flow. Open file, check it looks right, download, mark picked up.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Back to queue                                                         │
│                                                                          │
│  phone-stand-v3.stl                                                      │
│  Ella Chen · Yr 10 · Phone accessories                                   │
│  For: Bambu Lab X1 Carbon                                                │
│                                                                          │
│  [ Large 3D preview thumbnail ]                                          │
│  ⟨revisions.thumbnail_path⟩                                              │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Preflight check                                                 │   │
│  │  ✓ Passed all must-fix rules                                     │   │
│  │  ⚠ 1 warning acknowledged: Overhang at 52° — student added       │   │
│  │    supports in slicer                                            │   │
│  │  Bounding box: 58 × 32 × 12 mm · Est. 2h 47min                   │   │
│  │  Ruleset v1.0.0                                                  │   │
│  │  ⟨jobs.latest_scan_results summary⟩ + ⟨jobs.acknowledged_warnings⟩│  │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Teacher note (if any):                                                  │
│  "Please use PLA+ for this — I've set aside a spool in the drawer."      │
│  ⟨jobs.teacher_review_note⟩ (nullable)                                   │
│                                                                          │
│                                                                          │
│  [ Download .stl ]   (clicking logs lab_tech_picked_up_by + _at,         │
│                       flips status to 'picked_up')                       │
│                                                                          │
│  After printing:                                                         │
│  ( ) Printed — all good                                                  │
│  ( ) Failed — needs reprint. Reason: [________________________]         │
│  ⟨jobs.completion_status, jobs.completion_note⟩                          │
│                          [ Submit outcome ]                              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Surface 3: Teacher — review & admin

### 3.1 Queue — `/teacher/preflight`

Teacher view of all submissions across their classes.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Preflight queue                                                         │
│  4 pending approval · 12 in machine queue · 38 completed this term       │
│                                                                          │
│  TABS  [ Pending approval (4) ]  [ In queue ]  [ Needs revision ]        │
│        [ Completed ]  [ All ]                                            │
│                                                                          │
│  FILTER  Class: [ All ▼ ]  Machine: [ All ▼ ]  Unit: [ All ▼ ]           │
│                                                                          │
│ ┌───────┬──────────────────────┬───────────┬────────┬─────────┬────────┐│
│ │ THUMB │ Ella Chen            │ Bambu X1C │ Rev 1  │ 2 warns │[REVIEW]││
│ │       │ Y10 · Phone access.  │           │        │ ack'd   │        ││
│ │       │ phone-stand-v3.stl   │           │        │         │        ││
│ └───────┴──────────────────────┴───────────┴────────┴─────────┴────────┘│
│ ┌───────┬──────────────────────┬───────────┬────────┬─────────┬────────┐│
│ │ THUMB │ Marcus Wong  🚩      │ Glowforge │ Rev 5  │ Repeat  │[REVIEW]││
│ │       │ Y10 · Phone access.  │           │        │ fails   │        ││
│ │       │ phone-case-final.svg │           │        │ R-SVG-02│        ││
│ │       │                      │           │        │ (coach!)│        ││
│ └───────┴──────────────────────┴───────────┴────────┴─────────┴────────┘│
│                                                                          │
│ (🚩 = "this student has 3+ revisions with repeating failures —           │
│        coaching signal". Derived client-side from revision count +       │
│        rule recurrence across revisions.)                                │
└──────────────────────────────────────────────────────────────────────────┘
```

**Field coverage:**
| Element | Source |
|---|---|
| Student name | JOIN `students.display_name` |
| Class + unit label | JOIN `classes.name` + `units.title` |
| Filename | `fabrication_jobs.original_filename` |
| Machine | JOIN `machine_profiles.name` |
| Revision count | `fabrication_jobs.current_revision` |
| "Warnings ack'd" summary | `fabrication_jobs.acknowledged_warnings` length |
| Coaching flag 🚩 | **⟨derived⟩** from: revisions count + same rule firing in multiple revisions |
| [ Review ] | links to `/teacher/preflight/[jobId]` |

RLS on this query: standard `teacher_id = auth.uid() OR class_id ∈ teacher's classes` — policy already in place from migration 095.

### 3.2 Per-submission review — `/teacher/preflight/[jobId]`

Full scan results + student history + action panel.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Back to queue                                                         │
│                                                                          │
│  phone-stand-v3.stl · Ella Chen · Y10 · Phone accessories                │
│  Machine: Bambu X1C · Revision 3 of 3 · 3.2 MB · submitted 14 min ago   │
│                                                                          │
│  ┌──────────────────────────┬──────────────────────────────────────────┐ │
│  │ [ large 3D thumbnail ]   │ REVISION HISTORY                         │ │
│  │                          │ Rev 3 — 14m ago — passed ✅              │ │
│  │ Bbox 58×32×12mm         │ Rev 2 — 28m ago — 1 must-fix (walls)     │ │
│  │ Est. 2h 47min · 18g      │ Rev 1 — 42m ago — 3 must-fix (walls,    │ │
│  │                          │                    holes, overhang)      │ │
│  │                          │                                          │ │
│  │                          │ Ella's pattern: walls mostly. Might be   │ │
│  │                          │ worth a 10-min refresher in next class.  │ │
│  │                          │ ⟨derived from findings across            │ │
│  │                          │  fabrication_job_revisions⟩              │ │
│  └──────────────────────────┴──────────────────────────────────────────┘ │
│                                                                          │
│  SCAN RESULT (current revision)                                          │
│  ✓ 0 must-fix                                                           │
│  ⚠ 1 should-fix — acknowledged:                                          │
│     · R-STL-11 Overhang at 52° — "I'll add supports in the slicer"      │
│     ⟨jobs.acknowledged_warnings[].option⟩                                │
│  ℹ 3 fyi (print time, filament, triangle count)                         │
│                                                                          │
│  Ruleset v1.0.0 · No teacher overrides on this profile.                  │
│                                                                          │
│  TEACHER NOTES                                                           │
│  [                                                                    ]  │
│  [                                                                    ]  │
│  ⟨jobs.teacher_review_note⟩                                              │
│                                                                          │
│  ACTIONS                                                                 │
│  [ Approve & queue for printing ]   sets status=approved,               │
│                                      teacher_reviewed_by = me,           │
│                                      teacher_reviewed_at = now()         │
│  [ Return for revision ]             sets status=needs_revision          │
│                                      (student sees explanation)          │
│  [ Reject (terminal) ]               sets status=rejected                │
│                                                                          │
│  ADVANCED                                                                │
│  [ Override a rule for this machine profile ] — opens side drawer,      │
│     writes to machine_profiles.rule_overrides JSONB                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Rule override drawer (modal)

Opens from the Per-submission view OR from machine profile settings.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Rule overrides — Bambu X1C                                              │
│                                                                          │
│  Each rule can be softened or switched off for this machine. Changes    │
│  apply to all future scans against this profile.                         │
│                                                                          │
│  R-STL-09  Wall thickness < nozzle × 1.5                                 │
│  Current severity: BLOCK (default)                                       │
│  Override: ( ) BLOCK  (●) WARN  ( ) FYI  ( ) OFF                         │
│  Threshold: nozzle × [ 1.2 ]   (default 1.5)                             │
│                                                                          │
│  R-STL-11  Overhang > 45° without supports                               │
│  Current severity: WARN (default)                                        │
│  Override: ( ) BLOCK  (●) WARN  ( ) FYI  ( ) OFF                         │
│  Threshold: [ 50 ] degrees  (default 45)                                 │
│                                                                          │
│  R-STL-17  Triangle count > 500k                                         │
│  Current severity: FYI                                                   │
│  Override: ( ) BLOCK  ( ) WARN  (●) FYI  ( ) OFF                         │
│                                                                          │
│  [ ... 14 more rules ... ]                                               │
│                                                                          │
│                                      [ Cancel ]  [ Save overrides ]      │
│                                                                          │
│  Writes to: machine_profiles.rule_overrides JSONB                        │
│  Shape: { "R-STL-09": { severity: "warn", threshold: 1.2 },              │
│           "R-STL-11": { threshold: 50 },                                 │
│           "R-STL-17": {} }                                               │
└──────────────────────────────────────────────────────────────────────────┘
```

**Field coverage:**
| Element | Source |
|---|---|
| Rule list | Static from scanner ruleset (defined in Python worker) |
| Current severity "default" | Static |
| Override severity + threshold | `machine_profiles.rule_overrides` JSONB |

**Override-rate KPI** (from Phase 0 D-08) lives on an admin analytics dashboard, not here.

### 3.4 Fabricator admin — `/teacher/preflight/fabricators`

Invite, deactivate, assign to machines.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Fabricators                                [ + Invite a Fabricator ]    │
│                                                                          │
│  Fabricators are lab techs who pick up scanned jobs and run them on the  │
│  machines. They have their own login and only see jobs for machines you  │
│  assign them to.                                                         │
│                                                                          │
│  ┌──────────────┬──────────────────────┬──────────────────────┬────────┐│
│  │ Cynthia Chen │ cynthia@nis.edu      │ Bambu X1C,           │ Active ││
│  │              │ last login: 2h ago   │ Glowforge Pro        │ [...]  ││
│  │              │ invited: 10 Mar 2026 │                      │        ││
│  │              │                      │                      │        ││
│  │ ⟨fabricators│ ⟨fabricators.email,  │ ⟨fabricator_machines │ ⟨fabri-││
│  │  .display_  │  .last_login_at,     │  joined on            │  cators││
│  │  name⟩      │  .created_at⟩        │  machine_profiles⟩    │  .is_  ││
│  │              │                      │                      │  active││
│  └──────────────┴──────────────────────┴──────────────────────┴────────┘│
│                                                                          │
│  [...] menu:                                                             │
│    Edit machines assigned                                                │
│    Reset password (emails new invite link)                               │
│    Deactivate (is_active = false; keeps audit trail)                     │
│                                                                          │
│  Invite modal:                                                           │
│    Email: [__________________________]                                   │
│    Display name: [___________________]                                   │
│    Assign to machines: [x] Bambu X1C  [ ] Prusa MK4S  [x] Glowforge Pro  │
│    [ Send invite ]                                                       │
│                                                                          │
│  Invite flow backend:                                                    │
│    1. INSERT fabricators (email, password_hash=placeholder, display_name,│
│                           invited_by_teacher_id=auth.uid())              │
│    2. INSERT fabricator_machines (one per selected machine)              │
│    3. Email one-time set-password link to the Fabricator                 │
│       (links to /fab/set-password?token=…)                               │
└──────────────────────────────────────────────────────────────────────────┘
```

**Schema gaps flagged:**
1. **No `password_reset_tokens` mechanism** for Fabricators in the Phase 1A schema. Option A: reuse `fabricator_sessions` with a special `is_setup=true` flag + 24h TTL. Option B: add a dedicated `fabricator_invite_tokens` table. **⟨decision?⟩** — recommend Option A, add a nullable `is_setup` column on `fabricator_sessions`.
2. **No `email_verified_at` column** on `fabricators`. Not critical for v1 but a gap if school admin needs to audit who actually logged in vs who never redeemed their invite. **⟨new?⟩**

### 3.5 Machine profile settings — `/teacher/settings/machines`

Lists the 12 system templates + teacher's cloned profiles. Clone-to-customise pattern.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Machine profiles                                                        │
│                                                                          │
│  SYSTEM TEMPLATES (cloned from manufacturer defaults — can't edit)       │
│  ┌────────────────────┬─────────────┬─────────────────────────────────┐  │
│  │ Bambu Lab X1 Carbon│ 3D Printer  │ 256×256×256 · 0.4mm · [ CLONE ] │  │
│  │ Prusa MK4S         │ 3D Printer  │ 250×210×220 · 0.4mm · [ CLONE ] │  │
│  │ Glowforge Pro      │ Laser       │ 495×279 · 0.2mm kerf · [ CLONE ]│  │
│  │ ... 9 more ...     │             │                                 │  │
│  └────────────────────┴─────────────┴─────────────────────────────────┘  │
│                                                                          │
│  MY PROFILES (cloned and customised — visible only to me)                │
│  ┌────────────────────┬─────────────┬─────────────────────────────────┐  │
│  │ Bambu X1C (Room    │ 3D Printer  │ 256×256×256 · 0.4mm · 2        │  │
│  │ 204, PETG only)    │             │ rule overrides  [ EDIT ] [DEL] │  │
│  │ ⟨machine_profiles │ ⟨.machine_  │⟨.rule_overrides keys count⟩    │  │
│  │  .name where       │  category⟩  │                                 │  │
│  │  teacher_id = me⟩  │             │                                 │  │
│  └────────────────────┴─────────────┴─────────────────────────────────┘  │
│                                                                          │
│  [ + Create custom profile (no template) ]                               │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Surface 4: Free public user — `/preflight` (Phase 4+)

Shared codebase with logged-in Student, different presentation. Hides everything that requires an account.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Preflight — check your file before the machine                          │
│                                                                          │
│  Drop a .stl (for 3D printers) or .svg (for laser cutters) and we'll    │
│  tell you in seconds whether it'll run. No sign-up, nothing saved.       │
│                                                                          │
│  Pick a machine:                                                         │
│  [ Bambu X1C ▼ ]  ( or pick any of 12 common school machines )           │
│                                                                          │
│  Size check: [ A4 or smaller ▼ ]                                         │
│  Units: [ Millimetres ▼ ]                                                │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │             ⬇  Drag .stl or .svg here                              │  │
│  │             or [ Browse ]                                          │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Checking your file runs entirely in your browser. We don't upload,      │
│  store, or train on anything.                                            │
│                                                                          │
│  ───────────────────────────────────────────────────────────────────     │
│                                                                          │
│  (Results screen identical to logged-in student §1.4 — same 3-bucket    │
│   layout, same rule explanations, same evidence images.)                 │
│                                                                          │
│  ───────────────────────────────────────────────────────────────────     │
│                                                                          │
│  Want to save your submissions, get a teacher queue, or deeper checks    │
│  like wall-thickness and watertight meshes?                              │
│                                                                          │
│           [  Check out StudioLoom for schools  ]                         │
└──────────────────────────────────────────────────────────────────────────┘
```

**What's hidden vs logged-in:**
- No "which unit / project" picker (no `unit_id`)
- No "your submissions" list (no persistence)
- No teacher approval state (no `requires_teacher_approval` flow)
- No revision history (no replay)
- No Fabricator routing
- No Skills Library deep links (unless we add a lightweight standalone glossary)

**Scanner for free version** is purely client-side JavaScript — parse binary STL for bbox + triangle count + file-size sanity; parse SVG for viewBox + units + stroke-color convention. The deep checks (watertightness, wall thickness, overhang heatmap) stay behind the login as a value-prop.

**No schema columns written.** No DB activity at all for this path. Shared codebase is in `src/components/preflight/*` consumed by both surfaces.

---

## Gap analysis

### Schema columns that have NO UI element yet (orphans or future phase)

| Table.column | Status | Why |
|---|---|---|
| `fabrication_jobs.school_id` | future | Gates on FU-P (school entity). No UI picker yet. |
| `fabrication_jobs.retention_clock_started_at` | internal | Cron-managed. Not shown to any user. |
| `fabrication_job_revisions.scan_error` | internal | Shown only if scan worker errors — Phase 2+ UI. |
| `fabrication_scan_jobs.*` | internal | Entire table is service-role. No UI. |
| `fabricator_sessions.*` | internal | Cookie plumbing. No UI. |
| `machine_profiles.supported_materials` | future | Shown to student on Material dropdown — see §1.2. |
| `machine_profiles.max_print_time_min` | future | Shown as "estimated too long" warning — rule-catalogue driven. |
| `machine_profiles.rule_overrides` | **has UI** | §3.3 rule-override drawer. |
| `fabricators.school_id` | future | Gates on FU-P. |

**No orphan columns** outside expected internal/future cases. Schema has no dead weight.

### UI elements that are NOT covered by the current schema

| UI element | Surface | Proposed resolution |
|---|---|---|
| Pre-check answers (size bucket, units, chosen material) | §1.2 New submission | **Add `fabrication_jobs.student_intent JSONB`** column in Phase 1B migration 098. Shape `{size_bucket, designed_units, chosen_material}`. |
| Fabricator password-reset / invite flow | §3.4 Fabricator admin | **Reuse `fabricator_sessions`** with a new nullable `is_setup BOOLEAN` column (24h TTL invite link) OR add `fabricator_invite_tokens` table. Recommend the former — one less table. |
| Email verified / last login sanity for Fabricators | §3.4 | `fabricators.last_login_at` is already there. No additional schema needed; "never redeemed" = `last_login_at IS NULL`. |
| Coaching flag 🚩 on teacher queue | §3.1 | Client-side derived from revision count + rule recurrence. No schema change. |
| Per-student fabrication pattern summary | §3.2 sidebar | Server-side derived from scan results JSONB across revisions. No schema change, but needs a helper function. |
| "Staged messaging" during scan | §1.3 | No schema change; client sequence with timer, fine for v1. |

### Recommended schema changes for Phase 1B

**Migration 098 candidates (all additive, low risk):**

```sql
-- 098a: Capture student's pre-check intent for scanner context
ALTER TABLE fabrication_jobs
  ADD COLUMN student_intent JSONB;
-- Shape: { size_bucket: "hand" | "a4_or_smaller" | "bigger",
--          designed_units: "mm" | "cm" | "inch",
--          chosen_material: string,
--          description: string }       -- optional free text e.g. "phone stand for my Pixel 7"

-- 098b: Fabricator invite / password-reset flow
ALTER TABLE fabricator_sessions
  ADD COLUMN is_setup BOOLEAN NOT NULL DEFAULT false;
-- is_setup=true means "this is an invite / reset link, not a login session".
-- TTL via expires_at. Consumed by /fab/set-password.

-- 098c: "Currently printing" sub-state without a new status value
ALTER TABLE fabrication_jobs
  ADD COLUMN printing_started_at TIMESTAMPTZ;
-- status=picked_up + printing_started_at=NULL → "Downloaded, not started"
-- status=picked_up + printing_started_at IS NOT NULL → "Currently printing"
-- status=completed → done

-- 098d: Notification dispatch audit (idempotency + support)
ALTER TABLE fabrication_jobs
  ADD COLUMN notifications_sent JSONB;
-- Shape: { approved_at?, returned_at?, rejected_at?, picked_up_at?,
--          printing_started_at?, completed_at? }
-- Used by email routes to not double-send on retries.

-- 098e: Student email preference (preflight-specific)
ALTER TABLE students
  ADD COLUMN fabrication_notify_email BOOLEAN NOT NULL DEFAULT true;

-- 098f: AI enrichment cost tracking (governance / kill-switch enforcement)
ALTER TABLE fabrication_job_revisions
  ADD COLUMN ai_enrichment_cost_usd NUMERIC;
-- NULL if AI enrichment was disabled or skipped. Populated per revision
-- by the scanner worker after the Haiku call. Summed to enforce the
-- daily cap admin setting (see below).
```

All six are `ADD COLUMN` with safe defaults — no backfill needed, Lesson #24 pattern.

**Admin settings keys (no migration; use existing `admin_settings` key/value table from migration 077):**

| Key | Value | Purpose |
|---|---|---|
| `preflight.ai_enrichment_enabled` | boolean | Platform-wide kill switch. If false, worker skips Haiku call entirely. |
| `preflight.ai_enrichment_daily_cap_usd` | numeric (default 5.00) | Max AI spend per day platform-wide. When day's total `ai_enrichment_cost_usd` exceeds cap, worker skips AI for rest of the day and emits a `system_alerts` row. |
| `preflight.ai_enrichment_tiers_enabled` | jsonb e.g. `["tier1"]` | Which tiers to run. Defaults to tier 1 only until pilot validates cost envelope. |

---

## AI enrichment — rule catalogue R-AI-\*

Runs **after** the deterministic scanner (R-STL-\* / R-SVG-\*), never before — per spec §20's no-AI-before-gate rule. Findings land in the same `scan_results.findings[]` array with rule IDs prefixed `R-AI-*`, same severity grading (block/warn/fyi). From the student's perspective they look like any other finding except for the purple ✨ icon and "AI check" micro-badge.

### Tier 1 — ship with Phase 2 scanner worker

One Haiku call per submission. Inputs: deterministic scan summary (bbox, triangle count, estimates, findings so far), student_intent (description, size bucket, units, material), filename, machine profile. Outputs findings across 4 rule types:

| Rule ID | What it catches | Severity range | Example |
|---|---|---|---|
| **R-AI-01** | Size reasonableness vs product archetype | warn (if strongly off) / fyi | "Phone stands are usually 90–140mm tall. Yours is 250mm. Is this intentional?" |
| **R-AI-02** | Intent mismatch (filename/description vs geometry shape) | warn (strong mismatch) / fyi (clean) | "Your description says phone stand but the geometry is a flat plate. Did you upload the right file?" |
| **R-AI-03** | Functional plausibility | fyi (or warn if clearly wrong) | "A bookmark at 6mm thick is unusual — most are 1–2mm. Is this intentional (decorative) or did you mean it thinner?" |
| **R-AI-04** | Material vs design | warn / fyi | "Your design includes hinges. PLA is stiff; hinges generally work better in TPU or PETG. Is the hinge meant to flex?" |

**Prompt engineering notes:**
- System prompt is static and cacheable — enumerates the 4 rule checks, output schema, "never block, only warn/fyi", "be concise".
- User turn is the per-submission context (scan summary + student intent + machine profile).
- Output is structured JSON matching the existing findings schema with `rule_id: "R-AI-XX"`.
- Prompt caching on system prompt → ~90% cache hit → ~$0.001–0.0015/submission.

**Cost envelope (Tier 1 only):**
- 200-student school, 3 submissions/week → ~600 calls/week
- ~$0.90/week, ~$47/year
- Cheaper than Fly.io worker hosting.

### Tier 2 — evaluate post-pilot

Gated on pilot data showing Tier 1 is useful. Adds a second Haiku call per submission, only when Tier 1 doesn't find a clear issue (no double-dipping):

| Rule ID | What it catches | Why it needs its own call |
|---|---|---|
| **R-AI-05** | Fabrication orientation hint — "would print 30% faster rotated 90° around Z" | Requires geometry features beyond bbox (face-normal distribution) |
| **R-AI-06** | Decorative feature recognition — "chess_king.stl has no crown" | Requires semantic understanding of filename tropes |
| **R-AI-07** | Unit / project coherence — "unit asks for parametric design; this is a primitive box" | Requires unit context + semantic reasoning |

**Additional cost:** +~$0.002/submission, ~50% hit rate → +$40/year.

### Tier 3 — post-Phase-3, careful about chatbot creep

Weekly batch aggregations, not per-submission:

| Rule ID | What it catches | When it runs |
|---|---|---|
| **R-AI-08** | Peer-error clustering — "4 Y10s had wall-thickness issues this week" | Weekly cron |
| **R-AI-09** | Pedagogical acknowledgement — "You fixed all 3 issues from rev 2. Nice work on the walls particularly." | Per revision, only when coming from a failed rev (non-first) |

**R-AI-09 is the slippery-slope risk** — every line of warm AI text bleeds toward "chatbot at the results screen" which spec §3 rejects. Only include if pilot feedback says students feel the results page is cold. Guardrail: the output is ONE sentence, NEVER engages in back-and-forth, no follow-up prompts, never uses "you" more than twice.

### AI guardrails (day-1)

- **Kill switch:** `admin_settings.preflight.ai_enrichment_enabled` — flip to false, worker stops calling Haiku immediately. Existing scan results in DB are unchanged.
- **Daily cap:** `admin_settings.preflight.ai_enrichment_daily_cap_usd` — worker checks SUM of `fabrication_job_revisions.ai_enrichment_cost_usd` for today. If over cap, skip AI + emit `system_alerts` row.
- **Skip if deterministic blocks:** if the deterministic scanner already produced ≥1 BLOCK finding, skip AI — student has to fix files regardless, AI enrichment is noise.
- **Skip if no student intent:** if `student_intent` is NULL (legacy submissions), skip — AI needs the intent data to do its job. R-AI-01 in particular is useless without a description.
- **Skip on file-type mismatch:** SVG-specific tier-1 checks (R-AI-03 functional plausibility is mostly STL-focused; R-AI-04 material check is 3D-only).
- **Rate limit per student:** max 3 AI-enriched scans per student per 5-minute window. Prevents a student spam-uploading 50 files and racking cost.

### Override-rate tracking for AI findings

AI findings are scored like deterministic ones against the override-rate KPI from D-08:
- Rate = (warnings overridden as "I meant it this way") ÷ (warnings shown)
- AI rules have a separate table entry since their thresholds come from the prompt, not a machine profile override JSONB
- If R-AI-01 is overridden >30% of the time (higher threshold than deterministic's 20% — AI is fuzzier), that's a prompt-tuning signal, logged to a weekly review report

**Schema for AI override tracking:** uses same `acknowledged_warnings` JSONB on `fabrication_jobs` — no new column. Summed via SQL when the KPI runs.

---

## Problem-location visualization

The "[ Show where ]" button on each rule finding needs to actually point at the problem. Two delivery strategies, both in Phase 2 scope:

### For STL — multi-angle annotated thumbnails + heatmaps

Scanner worker produces 4 standard views per scan using matplotlib's 3D axes, then 2 heatmap variants for walls and overhangs:

| View | What it shows | Cost |
|---|---|---|
| Isometric | Default. Problem regions circled/arrowed in red. | 1 PNG |
| Front | Same rendering, different camera angle. | 1 PNG |
| Side | Same again. | 1 PNG |
| Top | Same again. | 1 PNG |
| **Wall-thickness heatmap** | Isometric with colour overlay: red = too thin, green = ok, blue = very thick. Generated from trimesh ray-cast sampling. | 1 PNG |
| **Overhang heatmap** | Isometric with colour overlay on faces whose normal angle exceeds the machine's threshold. | 1 PNG |

Total: **6 PNGs per scan, ~300–400 KB.** Stored at `fabrication_job_revisions.thumbnail_path` as the base + sibling paths derived via suffix (`..._front.png`, `..._walls.png`). Or a JSON structure:

```json
{
  "views": {
    "iso": "…/iso.png",
    "front": "…/front.png",
    "side": "…/side.png",
    "top": "…/top.png",
    "walls": "…/walls_heatmap.png",
    "overhangs": "…/overhangs_heatmap.png"
  },
  "annotations": [
    { "view": "iso", "bbox": [x, y, w, h], "rule_id": "R-STL-09" },
    { "view": "front", "bbox": [x, y, w, h], "rule_id": "R-STL-09" }
  ]
}
```

**Schema note:** promote `thumbnail_path` from a single TEXT to this JSONB structure, OR add a sibling column `thumbnail_views JSONB` and keep `thumbnail_path` as the iso view for backward-compat. Recommend the latter — minimal schema change.

```sql
-- 098g: Multi-angle thumbnail metadata
ALTER TABLE fabrication_job_revisions
  ADD COLUMN thumbnail_views JSONB;
-- thumbnail_path stays as the primary (iso) view; thumbnail_views adds the rest.
```

Effort: ~1 day of Python in the scanner worker. All deterministic, no AI cost.

### For SVG — inline rendering with path overlays

SVG is already a browser-native vector format. For laser-file results:

- Browser embeds the student's SVG directly (`<object>` or inline `<svg>`).
- On top, render a transparent overlay SVG with red dashed rectangles around problem paths.
- Toggles: "Your SVG with problems highlighted" (default), "Just the file", "Layer breakdown" (each operation type on its own colour).

Output of the scanner: problem-location metadata in `scan_results.findings[].evidence`:

```json
{
  "rule_id": "R-SVG-10",
  "evidence": {
    "type": "svg_bbox",
    "x": 80, "y": 185, "width": 140, "height": 40
  }
}
```

Effort: ~1 day of frontend + minor scanner emit changes. No new schema.

### R3F interactive 3D viewer — deferred

Build only if pilot feedback says "I can't tell from the static multi-angle views". Reasons to defer:

- School iPads / Chromebooks often have weak GPUs
- Big STLs (50MB+) load slow in-browser
- Per-face annotation data contract is non-trivial to build and test
- 2D multi-angle thumbnails give 85% of the "where is it" value at 5% of the R3F cost
- 3D Elements / Designville project has R3F in its Phase 3 capability layer — if we do build R3F, do it once for both Preflight and 3D Elements, not twice

Phase 3+ call. No Phase 2 schema impact.

---



### Open design decisions before Phase 1B

1. **Pre-check question set** — size bucket + units + material is 3 questions. Should we add: "Is anyone else going to see this print?" (privacy flag for Fabricator queue — e.g., gift designs)? Probably no for v1, captures complexity.
2. **Coaching flag 🚩 threshold** — what qualifies? Current proposal: ≥3 revisions with ≥2 repeating rule IDs. Matt to confirm or tune.
3. **"Currently printing" vs "picked up"** — spec §11 has `picked_up` as a single status. The Fabricator UI shows a distinction between "job downloaded but not yet on machine" and "actively printing". Do we need a sub-state? Recommend: no new status, but `lab_tech_picked_up_at` + `completed_at` together give the range visually.
4. **Teacher approval-or-not** — `machine_profiles.requires_teacher_approval` is a boolean. Do teachers want per-class override (some classes trust students more)? **⟨decision?⟩** — probably yes eventually, but not in v1. Flag as FU.
5. **Re-upload UX** — when a student clicks "Re-upload fixed file" on the results page, does the new file create a new revision on the same job, or a new job? Current schema assumes **new revision on same job** (increment `current_revision`). Confirm.
6. **Notification triggers** — when does a student get a push/email? On teacher approval? On lab tech pickup? On printed? None of this is in Phase 1A schema but may need a `fabrication_notifications` table or similar in Phase 1B.

---

## Next step

Matt reviews this doc, flags:
- Any UI element that doesn't match his mental model
- Any missing surface we didn't cover
- Decision on the 6 open design questions above
- Sign-off on migration 098 candidates (or reject)

Once signed off, Phase 1B brief includes:
- Migration 098 (student_intent + is_setup columns)
- Storage bucket setup
- Retention cron stub
- Start on teacher Fabricator-invite UI (§3.4) — highest-value Phase 1B surface to pilot with Cynthia

Free public Preflight Check (§4) stays deferred to Phase 4+ as agreed in D-12.
