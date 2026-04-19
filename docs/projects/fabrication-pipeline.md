# Project: Fabrication Submission Pipeline

**Created:** 19 April 2026
**Status:** 🟢 SPEC — ready to build
**Loominary OS alignment:** OS Pipeline 3 — Fabrication Submission (sibling of Pipeline 1 teacher content and Pipeline 2 student work)
**Depends on:** Storage service (exists), job queue (new — or first consumer of the deferred `job-queue` OS service), Python scanner worker infra (new)
**Blocks:** Nothing. This is independent of Dimensions3 and can ship in parallel.

---

## 1. What This Is

The pipeline that moves a student's digital design file (.stl for 3D print, .svg for laser cut) from "I think it's ready" to "on the machine's bed" — with a deterministic file-scan gate in the middle that catches the errors students always ship and lab techs always absorb.

Every school with a fabrication lab has the same three-person problem:

- **Students** upload files they haven't checked. The checklist on the wall is aspirational. They ask the lab tech if it'll work. It won't.
- **Lab tech / DT teacher** becomes the human validator for every job. They open the file in Cura / Bambu Studio / xTool Studio / Lightburn, spot the problem, send the student back, repeat. This consumes hours per week per machine.
- **Teacher** has no view of the submission queue, no data on which students are making repeat errors, no way to connect fabrication failures back to teaching.

This pipeline puts a deterministic file scanner between upload and fabrication, gates the student on a real check (not a self-report checklist), surfaces pass/fail reasoning the student can learn from, routes cleared files to a per-machine pickup folder, and gives the teacher and lab tech a queue view. The scanner is **not AI** — it's trimesh for STL and svgpathtools for SVG, both mature open-source libraries. Explainable, fast, cheap, and the output can point directly at the offending geometry.

### Why it's different from "upload + checklist"

Every competitor tool in this space does one of two things: (a) an unchecked upload portal with a checkbox list the student clicks through, or (b) "upload here, lab tech will look at it." Neither catches a non-watertight mesh or a mis-coloured laser stroke before it burns 45 minutes of machine time. Because the scan is deterministic and file-based, we can show the student *where* the problem is, not just *that* there is one. That's the pedagogical win — they learn why their wall was too thin, not just that it "didn't pass."

---

## 2. Why Now

- **#1 reported pain point** from DT teachers. Every school with fabrication hardware has this bottleneck. Solving it is an immediate, demonstrable value prop.
- **No serious competitor.** The fabrication-adjacent tools in edtech (Fusion 360 for Education, TinkerCAD) stop at design. Slicing/printing tool chains (Cura, Bambu, Lightburn, Glowforge) stop at machine control. Nothing sits in the middle handling *student* submissions specifically.
- **Mature tooling.** `trimesh` (STL) and `svgpathtools` (SVG) do 90% of the work. We don't have to invent mesh analysis — we have to wrap it in the right pedagogy and workflow.
- **Independent of Dimensions3.** Can ship without blocking or being blocked by the generation pipeline work.
- **Self-contained OS pipeline.** Can be extracted into Loominary OS as Pipeline 3 with clean seams — equally useful in Makloom (maker community), future CTE/vocational apps.

---

## 3. Scope & Non-Goals

### In scope (v1)

- `.stl` scanning for FDM 3D printers (Bambu, Prusa, Ender, Creality class)
- `.svg` scanning for laser cutters (Glowforge, xTool, Gweike, generic CO2)
- Machine profile registry (bed size, nozzle, kerf, operation colour map) — per teacher or per school
- Soft-gate student submission flow with explained results
- Teacher approval queue (optional per machine profile)
- Lab tech per-machine pickup queue
- Revision history per submission (every re-upload is a version)
- Audit log of all submissions, scans, approvals, pickups

### Out of scope (v1 — explicit non-goals)

- **`.3mf` / `.step` / `.f3d` / `.dxf` / `.ai` formats.** STL + SVG cover ~90% of student submissions. Add others in v2 based on real demand.
- **Direct integration with slicer software** (Cura API, Bambu API, Lightburn API). Pickup is a file landing in a folder. The lab tech still opens the slicer manually. The slicer integration is a tempting rabbit hole — say no.
- **In-browser 3D viewer / preview.** A rendered preview is nice-to-have but adds a lot of weight (Three.js, GPU cost, mobile performance). V1 uses static rendered thumbnails from the worker.
- **Automatic fixing / repair.** We detect and explain — we don't auto-repair. Auto-repair on a watertight mesh sometimes "fixes" away the student's actual intent. Teaching moment > convenience.
- **CNC / vinyl / embroidery / sublimation.** Not in v1. The rule catalogue architecture should accommodate them later.
- **Materials inventory / consumable tracking.** Separate problem, separate spec.
- **AI chat about the scan results.** Per the no-chatbot principle — students get structured, deterministic, explainable feedback. Not a chat. If they want to know more about *why* a rule exists, there's a Skills Library link.

---

## 4. Pipeline Overview

```
Upload ──→ Scan ──→ Gate ──→ Route ──→ Pickup ──→ Complete
File       trimesh/  Soft-     Per-       Lab tech    Machine
stored     svgpath   gate UI   machine    downloads   done
                     on student pickup    + marks
                               folder     printed
```

Five stages. Each stage owns one responsibility and hands structured data to the next.

### Stage 1: Upload

Student picks: which project this is for, which machine type (3D printer / laser), which specific machine profile (if multiple configured). Drags file. Upload goes straight to Supabase Storage via a signed URL (large STLs — up to 200MB — don't fit through a Vercel serverless function).

Storage path: `fabrication/{school_id}/{teacher_id}/{student_id}/{job_id}/v{version}.{ext}`

Row written to `fabrication_jobs` with `status='uploaded'`, scan job enqueued.

### Stage 2: Scan

A background Python worker picks up the scan job, downloads the file, runs the machine-profile-aware rule catalogue, produces a structured result, uploads a rendered thumbnail (STL: isometric view; SVG: layer-separated preview) back to Storage, writes results to `fabrication_jobs.scan_results`, flips status to `scanned`.

Typical time: STL 3–15s, SVG <1s. The student sees a "Checking your file…" loading state that tells them what's being checked (builds trust that it's real analysis, not theatre).

### Stage 3: Gate

Student is shown their results in three buckets: **must-fix** (block), **should-fix** (warn, must acknowledge each one), **FYI** (info only). Blocked submissions can't progress — student re-uploads a new file (Stage 1 again, revision counter increments). Acknowledged warnings are logged. Once the student clears the gate, submission becomes `pending_approval` or `approved` depending on machine profile config.

### Stage 4: Route

Approved submission gets its file copied to a machine-specific pickup location. Could be:

- **Option A (simple):** a Supabase Storage pickup folder per machine (`fabrication-pickup/{machine_profile_id}/`) that the lab tech opens in the browser and downloads from.
- **Option B (power user):** a sync client (future) that mirrors the pickup folder to a folder on the lab computer — drop target for Cura/Bambu/Lightburn.

V1 ships Option A. Option B is a later enhancement.

### Stage 5: Pickup + Complete

Lab tech (or student with lab access) downloads the file from the machine queue, marks the job as `picked_up`, cuts/prints it, marks as `completed` (or `failed` with notes). Teacher sees the whole arc in their dashboard. Analytics surfaces patterns (which student profiles repeatedly fail which rules — coachable moments).

---

## 5. Scanner Rules Catalogue — STL

Rules run against the trimesh-loaded mesh plus the active machine profile. Each rule returns `{ id, severity, title, explanation, evidence, fix_hint }`. `evidence` can include coordinates, face indices, or a rendered callout image.

### Geometry integrity

| ID | Rule | Severity | What it checks |
|----|------|----------|----------------|
| R-STL-01 | Non-watertight mesh | **BLOCK** | `mesh.is_watertight` false. #1 cause of print failures. |
| R-STL-02 | Inconsistent winding / flipped normals | **BLOCK** | `mesh.is_winding_consistent` false. Slicer will misinterpret solid vs air. |
| R-STL-03 | Self-intersecting geometry | WARN | Faces intersect each other. Usually prints but results unpredictable. |
| R-STL-04 | Floating disconnected islands | WARN | Mesh split into multiple components that don't touch. Needs supports or merging. |
| R-STL-05 | Zero-volume / degenerate mesh | **BLOCK** | Mesh has <100 faces, zero volume, or NaN coordinates. File is broken. |

### Machine fit

| ID | Rule | Severity | What it checks |
|----|------|----------|----------------|
| R-STL-06 | Exceeds bed size | **BLOCK** | Bounding box X/Y/Z > machine profile bed dimensions. |
| R-STL-07 | Suspected unit mismatch (mm vs inch) | WARN | Bounding box diagonal < 5mm OR > 2m (statistical outlier). Classic "came out 25× too big / small." |
| R-STL-08 | Print time > machine profile max | WARN | Rough estimate from bounding box volume × default speed. Exceeds machine's per-job ceiling. |

### Printability

| ID | Rule | Severity | What it checks |
|----|------|----------|----------------|
| R-STL-09 | Wall thickness below nozzle × 1.5 | **BLOCK** | Ray-cast wall thickness sampling. Walls under ~0.6mm on a 0.4mm nozzle won't form. |
| R-STL-10 | Wall thickness below nozzle × 3 | WARN | Thin but printable; flag for single-perimeter wall awareness. |
| R-STL-11 | Overhang > 45° without support consideration | WARN | Face normal analysis. Flag regions + show heatmap in thumbnail. |
| R-STL-12 | Feature size below 1mm | WARN | Small pins, thin holes — edge of printer resolution. |
| R-STL-13 | No flat base for bed adhesion | WARN | Bottom face area < 10% of bounding box footprint. Will want a brim/raft. |
| R-STL-14 | Tall & thin instability risk | WARN | Height-to-base-footprint ratio > 5. Likely to tip mid-print. |

### Informational

| ID | Rule | Severity | What it checks |
|----|------|----------|----------------|
| R-STL-15 | Estimated print time | FYI | Rough time estimate. |
| R-STL-16 | Estimated filament | FYI | Volume × density → grams/metres. |
| R-STL-17 | Triangle count | FYI | Flag >500k triangles (slicer pain, slow preview). |

---

## 6. Scanner Rules Catalogue — SVG

Rules run against the parsed SVG DOM (lxml) + path geometry (svgpathtools) + the active laser machine profile (which includes operation colour map, kerf, bed dimensions).

### Machine fit

| ID | Rule | Severity | What it checks |
|----|------|----------|----------------|
| R-SVG-01 | Exceeds bed size | **BLOCK** | Drawing bounding box > machine bed. |
| R-SVG-02 | Unit mismatch — viewBox vs stated dimensions | **BLOCK** | `width/height` in mm but viewBox units don't align. Classic "came out tiny." |
| R-SVG-03 | No explicit units (px only) | WARN | SVG has no mm/in declaration — machine will guess, usually wrong. |

### Operation mapping

| ID | Rule | Severity | What it checks |
|----|------|----------|----------------|
| R-SVG-04 | Stroke colour not in machine operation map | **BLOCK** | Glowforge / xTool use stroke colour to distinguish cut/score/engrave. Any stroke colour that isn't mapped in the machine profile is ambiguous — machine won't know what to do. |
| R-SVG-05 | Cut-layer strokes have non-hairline width | WARN | On most lasers, cuts must be stroke width ≤0.001" / 0.01mm. Wider strokes get interpreted as fill engrave. |
| R-SVG-06 | Fill set on cut layer | WARN | Filled shapes on a cut layer get engraved as fill, not cut. Usually not what the student meant. |

### Geometry integrity

| ID | Rule | Severity | What it checks |
|----|------|----------|----------------|
| R-SVG-07 | Open paths on cut layer | **BLOCK** | Cuts should form closed loops. Open paths produce half-cut pieces that don't release. |
| R-SVG-08 | Duplicate / overlapping cut lines | WARN | Same path drawn twice. Double burn, wasted time, charred edge. Dedup on geometry hash. |
| R-SVG-09 | Features below kerf width | WARN | Any feature narrower than the machine's kerf (0.1–0.2mm typical) will vaporise. |
| R-SVG-10 | Un-outlined text on cut/engrave layer | **BLOCK** | Text as `<text>` element instead of outlined paths breaks on machines without the same font installed. |
| R-SVG-11 | Orphan / zero-length paths | FYI | Empty `<path>` elements, stray points. Usually harmless but clutter. |

### Raster (embedded images)

| ID | Rule | Severity | What it checks |
|----|------|----------|----------------|
| R-SVG-12 | Embedded raster resolution < 150 DPI | WARN | Raster engraves will look pixelated. |
| R-SVG-13 | Embedded raster in RGB with transparency | WARN | Most lasers want grayscale; transparency gets flattened unpredictably. |

### Informational

| ID | Rule | Severity | What it checks |
|----|------|----------|----------------|
| R-SVG-14 | Estimated cut time | FYI | Total path length × default speed per operation. |
| R-SVG-15 | Layer summary | FYI | Counts per operation — "3 cut paths, 2 score paths, 1 engrave region." |

### Rule versioning

Every rule carries a `version` string. Scan results record the ruleset version used. When we tune thresholds (e.g. lower R-STL-09 threshold from nozzle×1.5 to nozzle×1.3 based on real-world data) we bump the version rather than silently changing behaviour. This is a Dimensions3-style discipline and matters because teachers will ask "why did my file pass last week and fail this week?" — we need a clean answer.

---

## 7. Machine Profiles

Every scan runs against an active machine profile. Profile data lives in `machine_profiles` and is editable per teacher, with a copy-from-school-default action for new teachers.

### Profile schema (high level)

```typescript
interface MachineProfile {
  id: uuid
  school_id: uuid | null        // future — gated on FU-P school entity
  teacher_id: uuid              // owner
  name: string                  // "Bambu X1C (Room 204)"
  machine_category: '3d_printer' | 'laser_cutter'
  machine_model: string         // Free text — "Bambu X1 Carbon"
  is_active: boolean
  requires_teacher_approval: boolean

  // Bed
  bed_size_x_mm: number
  bed_size_y_mm: number
  bed_size_z_mm: number | null  // null for lasers

  // 3D printer specific
  nozzle_diameter_mm: number | null
  supported_materials: string[] | null
  max_print_time_min: number | null
  supports_auto_supports: boolean | null

  // Laser specific
  kerf_mm: number | null
  operation_color_map: {           // stroke hex → operation
    [hex: string]: 'cut' | 'score' | 'engrave'
  } | null
  min_feature_mm: number | null

  // Rule tuning overrides (optional)
  rule_overrides: {
    [rule_id: string]: { severity?: 'block' | 'warn' | 'fyi' | 'off'; threshold?: number }
  } | null

  notes: string | null
}
```

### Seeded defaults

We ship defaults for the 12 most common school machines (Bambu X1C/P1P, Prusa MK4, Creality Ender 3, Ultimaker, Makerbot, Glowforge Pro/Plus, xTool M1/P2/S1, Gweike Cloud, Epilog). Teacher clones a default → names it → done in 30 seconds. No "configure your machine from scratch" experience.

### Rule overrides

Teachers can soften specific rules without disabling scanning entirely. Example: R-STL-10 (wall thickness < nozzle×3) might be demoted from WARN to FYI for a teacher who's happy with single-perimeter walls. Overrides are per-profile, audited, and visible to the student ("Your teacher has set this rule to informational for this machine").

---

## 8. Soft-Gate UX — The Teaching Moment

This is the pedagogical heart of the system. Every other fabrication upload tool treats the scan as a pass/fail gate. We treat it as a teaching moment. Structured, not a chat.

### Student flow

```
1. Upload file
2. "Checking your file…" (real work — show what's being checked, build trust)
3. Results screen:

   ┌─────────────────────────────────────────────────────────┐
   │  [Thumbnail]   my_phone_stand.stl                       │
   │                Bambu X1C · v1 · 3.2 MB                  │
   │                                                         │
   │  🛑 2 MUST FIX                                          │
   │  • Wall too thin (0.3mm at back) — show evidence image  │
   │  • Model has holes — show evidence image                │
   │  → Re-upload after fixing. Your teacher can see your    │
   │    attempts. Here's how this usually gets fixed: [link] │
   │                                                         │
   │  ⚠️  1 SHOULD FIX — acknowledge each                    │
   │  • Overhang at 52° on underside — support needed        │
   │    [ ] I've checked — this is intentional               │
   │    [ ] I'll add supports in the slicer                  │
   │                                                         │
   │  ℹ️  FYI                                                │
   │  • Estimated print time: 2h 47min                       │
   │  • Estimated filament: 18g                              │
   │                                                         │
   │  [Submit] — disabled until must-fixes cleared           │
   └─────────────────────────────────────────────────────────┘
```

Key principles (per `docs/education-ai-patterns.md`):

- **Effort-gating.** Student can't skip ahead. Must-fix blocks submission. Must-fix with an acknowledge-checkbox is a choice we explicitly rejected — blockers should be unambiguous.
- **Socratic feedback.** Explanations include *why* the rule exists, not just that it failed. Link to the relevant Skills Library card for deeper learning.
- **Staged cognitive load.** Must-fix first, should-fix next, FYI last. Never dump all results at once.
- **Micro-feedback loops.** Each re-upload is a new scan — fast iteration.
- **Soft gating (warnings).** Should-fix items require a click per item, not a blanket "I agree" — forces them to read each one.

### Revision history

Each re-upload creates a new `fabrication_job_revision`. Student sees their own history (learning signal: "my third attempt — each time a different problem"). Teacher sees history for any student (coaching signal: "this student has 8 revisions, most failing on wall thickness — that's a 3D-modelling lesson we need to revisit").

### When they pass

Clear progression UI: "Submitted — waiting for teacher approval" (if required) or "Ready for [machine name] — [lab tech name] will queue it." No celebration overkill — it's a normal step, not a reward moment.

---

## 9. Teacher UX

### Submissions queue (`/teacher/fabrication`)

Tabs per state: `Pending approval` · `Approved / queued` · `Completed` · `Revisions in progress` · `All`.

Row per submission with:
- Student name, unit, project name
- Machine profile + thumbnail
- Revision count (flag at 3+: "may need coaching")
- Scan result summary (0 blocks, 1 warning, 2 FYI)
- Time waiting
- Actions: Approve · Add note · Return for revision · View scan results

### Per-student fabrication history

On a student's profile page, a fabrication tab shows:
- All submissions across all units
- Pass rate over time
- Most common failure rules (coachable patterns)
- Link to portfolio view of successful prints/cuts

### Analytics (class-level)

- Rule failure heatmap — which rules trip which students most
- Machine utilisation — how backed up is each machine
- Revision distribution — median re-uploads per submission per class
- Time-to-fabrication — upload → picked-up p50/p95

These feed into teaching decisions and into the long-running "why is this class struggling with this skill" question.

---

## 10. Lab Tech UX

Minimal, deliberately. Lab techs are busy and often non-technical.

### Per-machine queue (`/fabrication/machine/{profile_id}`)

Login via a lightweight pickup token (no Supabase account needed). Shows:

- Ordered list of approved jobs for this machine
- Student name, project, submitted time, file size
- Thumbnail + rendered preview
- Download button — on click, marks `picked_up`, logs lab tech ID, downloads file
- "Mark printed" / "Mark failed + note" when job is done

That's it. No dashboards, no analytics, no config. It's a to-do list with download buttons.

---

## 11. Data Model

```sql
-- One row per logical submission (revisions share the row via fabrication_job_revisions)
CREATE TABLE fabrication_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID,                       -- nullable until FU-P
  teacher_id UUID NOT NULL,
  student_id UUID NOT NULL,
  class_id UUID,                        -- NULL-safe per FU-N dual-visibility pattern
  unit_id UUID,
  project_id UUID,                      -- work_items.id if Pipeline 2 exists, else null
  machine_profile_id UUID NOT NULL REFERENCES machine_profiles(id),

  file_type TEXT NOT NULL CHECK (file_type IN ('stl', 'svg')),
  original_filename TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'uploaded',
  -- uploaded → scanning → needs_revision → pending_approval → approved
  --         → picked_up → completed
  --         → rejected (terminal) / cancelled (terminal)

  current_revision INT NOT NULL DEFAULT 1,
  latest_scan_results JSONB,            -- denormalised from latest revision for query speed
  scan_ruleset_version TEXT,
  acknowledged_warnings JSONB,          -- [{rule_id, ack_at}]

  teacher_reviewed_by UUID,
  teacher_reviewed_at TIMESTAMPTZ,
  teacher_review_note TEXT,

  lab_tech_picked_up_by UUID,
  lab_tech_picked_up_at TIMESTAMPTZ,
  completion_status TEXT,               -- 'printed' | 'cut' | 'failed'
  completion_note TEXT,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- One row per upload attempt (student re-uploads on revision)
CREATE TABLE fabrication_job_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES fabrication_jobs(id) ON DELETE CASCADE,
  revision_number INT NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  file_size_bytes BIGINT,

  scan_started_at TIMESTAMPTZ,
  scan_completed_at TIMESTAMPTZ,
  scan_ruleset_version TEXT,
  scan_results JSONB,                  -- full structured results with all rules + evidence
  scan_status TEXT,                    -- 'pending' | 'running' | 'done' | 'error'
  scan_error TEXT,

  uploaded_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(job_id, revision_number)
);

-- Editable per-teacher (future per-school) machine configs
CREATE TABLE machine_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID,
  teacher_id UUID NOT NULL,
  name TEXT NOT NULL,
  machine_category TEXT NOT NULL CHECK (machine_category IN ('3d_printer', 'laser_cutter')),
  machine_model TEXT,
  is_active BOOLEAN DEFAULT true,
  requires_teacher_approval BOOLEAN DEFAULT false,

  bed_size_x_mm NUMERIC NOT NULL,
  bed_size_y_mm NUMERIC NOT NULL,
  bed_size_z_mm NUMERIC,

  nozzle_diameter_mm NUMERIC,
  supported_materials JSONB,
  max_print_time_min INT,

  kerf_mm NUMERIC,
  operation_color_map JSONB,
  min_feature_mm NUMERIC,

  rule_overrides JSONB,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: lab tech access tokens (no full auth account required)
CREATE TABLE fabrication_pickup_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_profile_id UUID NOT NULL REFERENCES machine_profiles(id),
  token_hash TEXT NOT NULL UNIQUE,      -- bcrypt'd
  label TEXT,                           -- "Ms Chen's iPad" etc.
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### RLS

Per CLAUDE.md and Lesson #29 (FU-N dual-visibility UNION pattern):

- `fabrication_jobs` — student sees own; teacher sees own teacher_id rows UNION class rows (covers NULL class_id); lab tech sees via pickup token scope.
- `machine_profiles` — teacher sees own; future school admin sees all in school (gated on FU-O/P).
- `fabrication_job_revisions` — inherit from parent `fabrication_jobs`.
- Scan results contain no PII — safe to include in audit exports.

### WIRING.yaml entries

Three new systems: `fabrication-pipeline` (orchestration), `fabrication-scanner-worker` (Python worker), `machine-profiles` (config). Dependencies: `storage`, `job-queue`, `auth`. Affects: `teacher-dashboard`, `student-dashboard`, `audit-log`.

---

## 12. Infrastructure — Scanner Worker

The scanner is Python (trimesh + svgpathtools are Python-only best-in-class). Vercel serverless can't run it in-process — 10s/60s timeouts and 50MB bundle limits are fatal.

### Options

| Option | Pros | Cons | Rec |
|--------|------|------|-----|
| **A. Fly.io Python worker** | Cheap ($5–20/mo), easy deploy, already a pattern in Loominary plans | New infra surface | ✅ v1 |
| **B. Railway Python worker** | Similar to Fly | Railway pricing less predictable | Backup |
| **C. Supabase Edge Function (Deno)** | Same stack | Deno doesn't have a trimesh equivalent; would have to rebuild mesh analysis | ❌ |
| **D. AWS Lambda** | Battle-tested | New infra surface, more ops overhead | ❌ for v1 |
| **E. Vercel Python runtime** | Same deploy target | Still has 60s timeout ceiling; big STLs run long | ❌ |

**Recommendation:** Fly.io for v1. Single small VM running a Python process that polls the `fabrication_scan_jobs` queue table (or listens via Supabase Realtime). Cheap, simple, isolated failure surface. If it goes down, uploads still succeed — they just wait in queue with clear status messaging.

### Worker responsibilities

1. Poll / listen for new jobs
2. Download file from Supabase Storage (signed URL)
3. Load active machine profile
4. Run rule catalogue
5. Render thumbnail (matplotlib for STL isometric, cairo for SVG)
6. Upload thumbnail to Storage
7. Write results + update job status
8. On error: mark scan failed, surface structured error code for student UI

### Cost envelope

- Fly.io: ~$15/mo shared-cpu-1x with 512MB RAM (plenty for trimesh on typical student STLs).
- Storage: negligible at class scale — even 500MB per student per term is rounding error.
- No AI cost. This is the nice part.

### Observability

- Every scan run writes a row to `fabrication_scan_runs` with timing, file size, ruleset version, outcome.
- Failed scans alert via the existing `system_alerts` system (Dimensions3 Phase 4 plumbing).
- Weekly rollup: p50/p95 scan time by file size bucket, error rate by file type.

---

## 13. Build Phases

Following `docs/build-methodology.md` — phased with named Matt Checkpoints. Scaffolding (sandbox, simulator, dryRun, cost tracking) baked into specs from Phase 0.

### Phase 0 — Spec & Pre-Build Checklist (~1 day)

- Decide scanner worker host (Fly.io vs alternative)
- Gather real STL + SVG samples from DT teachers (known-good + known-bad) → golden fixture set
- Seed machine profile defaults list (the 12 common machines)
- Finalise rule catalogue v1 thresholds with a teacher review pass
- **Matt Checkpoint 0.1** — sign off scope + infra + fixtures before any code

### Phase 1 — Data Model & Storage (~1–2 days)

- Migration: `fabrication_jobs`, `fabrication_job_revisions`, `machine_profiles`, `fabrication_pickup_tokens`, `fabrication_scan_jobs` (queue table if not using Realtime)
- RLS policies — dual-visibility pattern per Lesson #29
- Supabase Storage buckets: `fabrication-uploads/`, `fabrication-thumbnails/`, `fabrication-pickup/` with signed URL policies
- Seed 12 default machine profiles as system-owned templates
- Registry sync: schema-registry.yaml, WIRING.yaml entries, api-registry.yaml
- **Matt Checkpoint 1.1** — migrations applied, RLS verified end-to-end before scanner work

### Phase 2 — Scanner Worker: STL (~2–3 days)

- Python worker scaffold on Fly.io
- trimesh integration + full R-STL-01..17 rule catalogue
- Thumbnail rendering (matplotlib isometric + overhang heatmap)
- Deterministic structured output schema
- **Sandbox mode:** worker can be run locally against fixture files, outputs JSON to stdout for inspection
- **Simulator:** golden STL fixtures cover every rule firing both positive and negative (NC — per Karpathy discipline)
- Unit tests: each rule with known-good + known-bad inputs, expected values asserted (Lesson #38, not just "non-null")
- **Matt Checkpoint 2.1** — every STL rule demonstrated green on known-good fixture, red on known-bad fixture, in CI

### Phase 3 — Scanner Worker: SVG (~1–2 days)

- Same worker process, SVG rule set (R-SVG-01..15)
- svgpathtools + lxml
- Thumbnail: layered preview with colour-coded operations
- Golden SVG fixture set
- Same test + checkpoint discipline as Phase 2
- **Matt Checkpoint 3.1** — scanner worker signed off end-to-end

### Phase 4 — Upload + Job Orchestration (~2 days)

- Student upload component (drag-drop, signed URL upload, progress)
- Job orchestration: create job row → enqueue scan → student polls (or Realtime subscribes)
- Loading UI with staged messaging ("uploading" → "checking geometry" → "checking fit" → "rendering preview")
- Error handling: upload failure, scan worker down, scan timeout
- Revision history tracking
- **Matt Checkpoint 4.1** — student can upload → scan → get results, with a known-good and known-bad file, on prod infrastructure

### Phase 5 — Soft-Gate Results UI (~2–3 days)

- Results screen with three buckets (must-fix / should-fix / FYI)
- Per-rule evidence viewer (thumbnail callouts, coordinates)
- Acknowledge-each-one flow for should-fix
- Re-upload flow with revision counter + history viewer
- Skills Library deep links per rule (stub initially if Skills Library not yet populated for fabrication topics)
- **Matt Checkpoint 5.1** — a real student on a real file reaches a clean pass state and the transitions look right

### Phase 6 — Teacher Queue + Approval (~2 days)

- `/teacher/fabrication` with status tabs
- Approve / reject / return-for-revision actions
- Per-student fabrication history
- Approval-required toggle per machine profile
- **Matt Checkpoint 6.1** — a teacher can triage a queue of 10+ submissions end-to-end

### Phase 7 — Lab Tech Pickup + Completion (~1–2 days)

- Pickup token auth (non-Supabase, lightweight)
- Per-machine queue view
- Download → mark picked_up action
- Mark complete / failed + note
- Pickup folder structure on Storage
- **Matt Checkpoint 7.1** — full loop: student → teacher approve → lab tech download + complete

### Phase 8 — Machine Profiles Admin UI (~1–2 days)

- Teacher UI: create profile from template, customise, manage active profiles
- Operation colour map editor for laser profiles
- Rule overrides UI (advanced — collapsed by default)
- **Matt Checkpoint 8.1** — a teacher can configure their school's 3 machines in under 5 minutes

### Phase 9 — Analytics + Polish (~1–2 days)

- Rule failure heatmap, revision distribution, utilisation views
- Docs (teacher onboarding, lab tech quickstart)
- Integration pass (link from unit page, from project view)
- **Matt Checkpoint 9.1** — docs signed off, ready to pilot

**Total: ~15–19 days.** Plus buffer ~2 days for discoveries-during-build per methodology.

---

## 14. OS-Seam Considerations

This pipeline is a strong Loominary OS candidate — the same shape applies anywhere students submit a file that has to work on a physical machine.

- **Scanner rules engine is pluggable.** StudioLoom ships STL + SVG. Makloom or a future CTE app can add CNC (.dxf / gcode), vinyl (.studio3), embroidery (.pes), sublimation. Each format is a registered scanner with its own rule set. The pipeline orchestration is unchanged.
- **Machine profile registry is multi-tenant from day one** — keep `school_id` column even though we can't populate it yet (gates on FU-P). When the school entity lands, no schema change.
- **Pipeline flow (upload → scan → gate → route → pickup) is generic.** Don't hardcode "student" — use `ServiceContext`. In a future consumer app, an adult hobbyist submits the same way with the same gate.
- **No StudioLoom-specific vocabulary in the core.** "Unit," "project," "class" go into adapter columns — the scanner doesn't know about any of them.
- **Activity Block integration is optional.** The pipeline works without Dimensions3. If activity_blocks exist, submissions can attach; if not, standalone submission is fine. Do NOT block this project on Dimensions3.

Per ADR-001: build for StudioLoom with clean seams, don't prematurely extract. The time to promote this to OS Pipeline 3 is when product #2 (Makloom) has a user who needs to submit to a makerspace — probably 6+ months out.

---

## 15. Integration Points

### With existing StudioLoom systems

- **Unit / project page.** Add "Submit for fabrication" button on applicable activity blocks (block metadata flag: `supports_fabrication_submission`).
- **Student work pipeline (Pipeline 2).** A completed fabrication job can optionally attach the photo of the final print/cut as a new work_version. Tight coupling not required; loose integration via event.
- **Skills Library.** Each scanner rule links to a skill card (e.g. R-STL-09 → "Minimum wall thickness" card). When Skills Library lands the rules already know where to point.
- **Portfolio.** Completed fabrication jobs with photos → portfolio entries automatically.
- **Teaching Mode.** Live status on student cards: "waiting on scan", "needs revision", "queued for machine."
- **Safety alerts.** If someone uploads, e.g., a weapon-shaped STL (classifier hit) — routes to the existing safety alert feed, not the fabrication queue. Reuses Phase 6 moderation plumbing.

### External tooling (read-only touch points)

- No integration with Cura / Bambu / Lightburn / xTool Studio in v1. Lab tech opens files manually. Integration is post-v1 and should be spec'd only after a pilot surfaces which software the actual schools use.

---

## 16. Dependencies & Risks

### Dependencies

| Thing | State |
|-------|-------|
| Supabase Storage | ✅ exists, already used |
| Job queue | ⚠️ first proper consumer — v1 can use a simple queue table + worker poll; graduate to OS `job-queue` service when it exists |
| Python worker infra | 🆕 new — Fly.io decision in Phase 0 |
| Auth | ✅ exists (student token sessions + teacher Supabase auth) |
| RLS patterns (FU-N dual-visibility) | ✅ proven in Dimensions3 |
| Skills Library | ⚠️ links can be stubs until it ships — not a blocker |
| FU-O/P (school entity) | ⚠️ nullable columns now, retrofit when school entity lands |

### Risks

- **Scanner false positives frustrate students.** A student whose file is actually fine gets blocked. Mitigation: teacher override, rule override per profile, clear evidence showing *what* we think we saw. Track override rate as an operational KPI.
- **Scanner false negatives waste machine time.** A file passes and then fails on the machine. Mitigation: lab tech can mark completion status `failed` with reason → feeds into rule catalogue tuning. Rule version bumps track changes.
- **File size.** 200MB STLs break naive upload paths. Signed URL direct-to-Storage is the answer; never pipe through a serverless function.
- **Worker down-time.** If the Python worker is offline, uploads stack up. Mitigation: status UI tells students honestly ("Scanner is temporarily offline — we'll process your file as soon as it's back"), teacher sees degraded-state indicator, alerting via `system_alerts`.
- **Machine profile diversity.** Schools have custom/unusual machines. Mitigation: seed 12 common profiles, allow custom profile creation, rule overrides per profile. Don't try to be exhaustive at launch.
- **Unit confusion creep.** Students uploading in inches instead of mm is the #1 scan fail. R-SVG-02 and R-STL-07 are safety nets but imperfect. Mitigation: unit selector on upload with default remembered, plus visual "this is how big it'll actually be on the bed" preview in Phase 5.
- **Lab tech adoption.** If the lab tech prefers the old "student brings a USB stick" workflow, nothing works. Mitigation: pickup UX is deliberately minimal, and the first pilot school's lab tech is a design partner before build starts.

---

## 17. Success Metrics

Measured at the first pilot school after Phase 9, then at class-level across the platform.

### Load-bearing

- **% of scans that block bad files** — target: 70%+ of submissions that would have failed on the machine get caught at scan
- **Lab tech time saved per week** — target: 2+ hours per lab tech per machine
- **Revision convergence** — target: median <2 revisions per successful submission
- **Machine utilisation** — target: 15%+ more jobs per machine per week (bad files take machines out of service)

### Secondary

- Teacher approval queue handling time p50/p95
- Student self-resolve rate (% who fix without teacher help)
- Rule false-positive rate (overrides / total rule firings)
- Repeated failure patterns per student (coaching trigger)

### Operational

- Scanner p50/p95 latency by file size
- Scanner error rate
- Worker uptime

---

## 18. Pre-Build Checklist

Per `docs/build-methodology.md`, actions before writing any code:

- [ ] Gather 20+ real STL files from 3+ DT teachers (mix of known-good, known-broken, borderline)
- [ ] Gather 20+ real SVG files across at least Glowforge + xTool conventions
- [ ] Pick scanner worker host — Fly.io decision sign-off
- [ ] Finalise v1 rule catalogue thresholds with 2–3 DT teacher reviewers
- [ ] Seed machine profile defaults data (12 machines, verified specs)
- [ ] Agree on pickup token auth approach (bcrypt'd random tokens vs something heavier)
- [ ] Decide whether to dual-write a `work_item` for Pipeline 2 coupling or keep strictly separate in v1 (recommend: separate v1, loose coupling later)
- [ ] Identify one pilot school + one pilot teacher + one pilot lab tech as design partners
- [ ] Matt Checkpoint 0.1 — sign off on all of the above before Phase 1

---

## 19. Open Questions

1. **Pickup token lifespan.** Lab tech iPad tokens — session-duration, 7-day, 90-day? Leaning 90-day with easy revoke.
2. **Student upload from phone (camera-sourced STL)?** Rare today but coming (mobile CAD apps). Not a v1 requirement — assume desktop upload.
3. **Multi-file submissions** (e.g. an SVG with a companion README). Not in v1. One file per job.
4. **Should we render in-browser 3D preview?** Nice-to-have, heavy (Three.js, GPU). Decision: v1 static thumbnail from the worker, consider viewer in v2.
5. **Slicer integration.** Worth speccing a v2 hook where approved STLs land in a Cura-watched folder via a local sync client? Post-pilot decision.
6. **Material selection at upload.** Adds cognitive load but affects scan (kerf varies by material on laser). Decision: v1 assumes default material per profile; advanced teachers can create per-material profiles.
7. **Fabrication as a separate nav item vs nested under unit?** Probably both — accessible from unit context and from a top-level `/teacher/fabrication` queue.
8. **What about sketchy content?** (students uploading inappropriate designs). Phase 6 moderation tooling already handles this — scan flags a file to safety queue before it enters the fabrication queue. Not a new problem.
9. **Lab tech pickup authentication without Supabase accounts — FERPA OK?** They're seeing student names + project thumbnails. Probably fine within the school context but confirm with legal if required for US deployments.
10. **What counts as a "submission" for portfolio credit?** The passed scan, or the successful print/cut? Student feels they've done work when they upload; teacher cares about the physical outcome. Decision: both visible in portfolio, with the scan-pass as intent and the completion as outcome.

---

## 20. Notes

- This spec assumes the build discipline from `docs/build-methodology.md` — phased with Matt Checkpoints, scaffolding baked into specs, audit-before-touch, verify-expected-values. If a phase slips, tell Matt, don't paper over.
- Rule catalogue versioning is non-negotiable. Bump the version whenever a threshold moves, and record the version in every scan result. Teachers will ask "why different" — there has to be a clean answer.
- Every scanner rule should have a one-paragraph explanation and a Skills Library link stub, written at the point of build. Don't defer the explanations to "polish" — they are the pedagogy.
- The scanner is not AI. Don't bolt AI on for its own sake. If in future we find there are patterns the deterministic rules miss, then an AI layer can run *after* the deterministic scan — never before it, never as the gate.
- Name the pipeline "Fabrication Pipeline" in the UI and internal naming. Not "3D Printing Queue" (too narrow) or "Fabrication Hub" (too marketing).
