# Preflight — Phase 0 Decisions Log

> **Purpose:** Canonical record of every decision locked during Phase 0. Every decision has an owner, date, rationale, and either a concrete design or a deferred-to flag.
> **Spec source:** `docs/projects/fabrication-pipeline.md`
> **Brief:** `docs/projects/fabrication-pipeline-phase-0-brief.md`
> **Checkpoint:** Checkpoint 0.1 passes when every item below is either ✅ RESOLVED or ⏸️ DEFERRED with a trigger.

---

## D-01 — Product name

**Decision:** **Preflight** — used everywhere user-facing (student UI, teacher UI, admin UI, nav labels, route paths `/teacher/preflight`, `/fab/login`).

**Schema-level naming:** Tables stay `fabrication_*` (describes the domain; grep-distinct from UI strings). API routes `/api/*/fabrication/*` stay descriptive. Worker repo: `preflight-scanner` (brand-forward because it's a deploy artifact).

**Rationale:** "Preflight" is already a term of art in the print and design industry — Adobe Acrobat has a built-in Preflight tool for checking PDFs before press, InDesign has live preflight panels, print shops talk about "preflight errors" every day. DT teachers recognise the word from graphics work. The aviation metaphor (pre-flight check before a flight) is a bonus that pairs cleanly with the **Fabricator** role name. Clean verb/noun: "run preflight", "passed preflight", "preflight failed", "waiting on preflight". Professional, domain-native, no cultural baggage.

**Naming history (for audit trail):**
- Considered: Kiln, Platen, Tolerance, Sorter, Filter, Gate, Clearance, Greenlight, Bouncer.
- **Initial pick (2026-04-19):** Bouncer — chosen for stickiness + free verb ("got bounced"). Concerns: nightclub association, slightly adversarial metaphor, possibly unprofessional in enterprise sales.
- **Revised (2026-04-19):** Preflight — same-day revision. Better fit because it's already domain vocabulary in print/design; aviation metaphor lines up with Fabricator; cleaner for any future enterprise sale conversation. No external announcements had been made under the Bouncer name.

**Status:** ✅ RESOLVED — 2026-04-19 (Matt).

---

## D-02 — Lab tech role name

**Decision:** **Fabricator.**

**Rationale:** Job-title-y, dignified, clean paired with Preflight. A Fabricator logs into Preflight to pick up queued jobs for their machines.

**Status:** ✅ RESOLVED — 2026-04-19 (Matt).

---

## D-03 — Scanner host

**Decision:** **Fly.io.** Small shared-cpu-1x VM, 512MB RAM, auto-suspend when idle.

**Rationale:** Cheap (~$5–15/mo), Python runtime (trimesh/svgpathtools are Python-only best-in-class), isolated failure surface. Vercel serverless can't run trimesh (50MB bundle + 60s timeout = fatal). AWS Lambda/Railway considered and rejected — new infra surface without clear wins vs Fly for this workload.

**Cost envelope at pilot (30 students) / one school (200 students) / multi-school (1000 students):** ~$5–10 / ~$10–16 / ~$25–35 per month total (including Supabase storage).

**Status:** ✅ RESOLVED — 2026-04-19 (Matt).

---

## D-04 — File retention policy

**Decision:** **Raw files deleted 30 days after terminal state (`completed` or `rejected`). Scan results + thumbnails + metadata retained indefinitely for analytics.**

**Trigger:** When `fabrication_jobs.status` transitions to `completed` or `rejected`, set `retention_clock_started_at = now()`. Pending / in-revision / paused jobs do NOT start the clock.

**Cron:** Daily Fly.io job scans `fabrication_job_revisions WHERE retention_clock_started_at < now() - interval '30 days' AND storage_path IS NOT NULL`. Deletes file from Storage, nulls `storage_path`, writes audit entry.

**On error:** log to `system_alerts`, do not retry blindly — human review.

**Student-facing language (for consent banner / privacy page):**
> "Your scan results and preview thumbnails are kept permanently. Your original design file is deleted 30 days after the job is completed or rejected."

**Open:** FERPA/GDPR implications for any pilot school — flagged for pre-pilot legal check (not a v1 code blocker).

**Status:** ✅ RESOLVED — 2026-04-19 (Matt).

---

## D-05 — Fabricator auth architecture

**Decision:** **Own account type, separate from teachers and students.**

**Design:**

```
fabricators (
  id UUID PRIMARY KEY,
  school_id UUID,               -- nullable until FU-P school entity
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,   -- bcrypt
  display_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  invited_by_teacher_id UUID     -- audit
)

fabricator_sessions (
  id UUID PRIMARY KEY,
  fabricator_id UUID REFERENCES fabricators(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,  -- bcrypt'd cookie value
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ
)

fabricator_machines (
  fabricator_id UUID REFERENCES fabricators(id) ON DELETE CASCADE,
  machine_profile_id UUID REFERENCES machine_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (fabricator_id, machine_profile_id)
)
```

**Login:** `/fab/login` — email + password.

**Invite flow:** Teacher invites a Fabricator from their machine profile settings. System emails a one-time password set link. No self-signup.

**Layout:** `src/app/fab/layout.tsx` — own nav, no teacher chrome. Public paths allowlist per Lesson #49 for login/set-password.

**RLS:** Fabricator token → Fabricator UUID → queries scoped to their assigned machines only.

**Why not Supabase Auth:** Same reason students aren't on Supabase Auth (Lesson #4). Cheap token sessions, simple invite flow, no email-confirmation friction for non-technical lab staff.

**Deferred — pickup tokens (spec §10):** Originally proposed token auth for walk-up iPads. Now deferred to Phase 8+ as an optional escape hatch on top of Fabricator accounts. v1 requires an account.

**Status:** ✅ RESOLVED — 2026-04-19 (Matt).

---

## D-06 — Pipeline 2 (student work) coupling

**Decision:** **Separate v1. No FK column on `fabrication_jobs` pointing to `work_items`.** Loose coupling (event-based) when both pipelines are in production.

**Rationale:** Spec §15 — Preflight is independent of Dimensions3 and Pipeline 2. Premature coupling risks locking into a shape that the other pipeline evolves past.

**Future hook:** When a job hits `completed`, emit an event `fabrication.job.completed`. Pipeline 2 can subscribe later to auto-attach photos of the print/cut to the student's work item. No v1 engineering.

**Status:** ✅ RESOLVED — 2026-04-19 (Matt).

---

## D-07 — Rule override UX timing

**Decision:** **Move from Phase 8 → Phase 1.**

**Rationale:** Solo-reviewer mitigation. Any rule Matt calibrated wrong can be softened per-profile by the next teacher who hits it, without waiting weeks. Cheap to ship in Phase 1 (one JSONB column on `machine_profiles`, one admin UI section).

**Status:** ✅ RESOLVED — 2026-04-19 (Matt).

---

## D-08 — Ambiguous rule severity

**Decision:** **High-uncertainty rules ship at WARN, not BLOCK.**

**Specific rules to soften from spec §5/§6 defaults (pending Matt's full §5+§6 review in sub-task 0.2):**

- [ ] Awaiting Matt's per-rule review pass
- Expected candidates based on solo-reviewer risk: R-STL-11 (45° overhang — support-dependent), R-STL-13 (flat base — brim/raft-dependent), R-STL-14 (tall-and-thin — genuinely printable with tuning), R-SVG-05 (hairline stroke width — tool-dependent)

**Override-rate KPI:** Any v1 rule overridden >20% of the time in pilot → flagged for threshold revision.

**Status:** ⏳ IN PROGRESS — awaiting sub-task 0.2 completion.

---

## D-09 — Spec §19 open questions

| Q | Decision | Status |
|---|---|---|
| Q1 Pickup token lifespan | Deferred — tokens themselves deferred to Phase 8+ (see D-05) | ⏸️ DEFERRED |
| Q2 Phone upload (camera-sourced STL) | Defer. V1 is desktop-only. `<input type="file">` is device-agnostic — mobile upload works; camera capture does not. | ⏸️ DEFERRED to v2 |
| Q3 Multi-file submissions | No. One file per job in v1. | ✅ RESOLVED |
| Q4 In-browser 3D preview | No. Static worker-rendered thumbnail only. Reconsider post-pilot if demand is real. | ⏸️ DEFERRED to v2 |
| Q5 Slicer integration | No. Post-pilot decision only. Don't spec until pilot surfaces which slicer software actual schools use. | ⏸️ DEFERRED post-pilot |
| Q6 Material selection at upload | No in v1. Default material per profile. Advanced teachers create per-material profiles ("Glowforge Pro — 3mm ply" vs "Glowforge Pro — 1/8 acrylic"). | ✅ RESOLVED |
| Q7 Nav placement | Both — `/teacher/preflight` top-level queue + "Submit to Preflight" button on applicable activity blocks / unit pages. | ✅ RESOLVED |
| Q8 Inappropriate content | Handled by existing Phase 6 moderation plumbing (spec §15). No new decision. | ✅ RESOLVED |
| Q9 FERPA for Fabricator seeing student names | Defer — fine within school context. Flag for legal review on first US deployment. | ⏸️ DEFERRED |
| Q10 Portfolio credit (scan-pass vs physical completion) | Both visible. Scan-pass = intent, physical completion = outcome. Portfolio reads both — no v1 engineering. | ✅ RESOLVED |

---

## D-10 — WIRING.yaml draft entries (for Phase 1 commit)

Three new systems to register in Phase 1's first commit (per methodology — WIRING updates land with the code, not deferred to saveme).

```yaml
- id: preflight-pipeline
  name: Preflight — Fabrication Submission Pipeline
  category: Submission
  status: in-progress  # will be 'complete' post-v1
  currentVersion: 1
  summary: "Upload → scan → gate → route → pickup → complete pipeline for student fabrication submissions (3D print, laser). Product-facing name: Preflight. Schema tables: fabrication_*."
  depends_on: [storage, preflight-scanner, auth-system, machine-profiles]
  affects: [teacher-dashboard, student-dashboard, audit-log]
  docs:
    - path: docs/projects/fabrication-pipeline.md
      purpose: Full spec
    - path: docs/projects/fabrication-pipeline-phase-0-brief.md
      purpose: Phase 0 checklist
  data_fields:
    - table: fabrication_jobs
      columns: [id, teacher_id, student_id, class_id, machine_profile_id, file_type, status, current_revision, latest_scan_results, retention_clock_started_at]
      notes: One row per logical submission; revisions in separate table
    - table: fabrication_job_revisions
      columns: [job_id, revision_number, storage_path, thumbnail_path, scan_results, scan_ruleset_version]
      notes: One row per upload attempt
  key_files:
    - src/app/teacher/preflight/page.tsx
    - src/app/student/preflight/submit/page.tsx
    - src/app/fab/queue/page.tsx
    - src/app/api/student/fabrication/**
    - src/app/api/teacher/fabrication/**
  future_needs: "Pipeline 2 coupling (auto-attach completion photos to work_items). Slicer integration. Pickup tokens for walk-up tablets."
  adrs: []
  os_seam: ready
  change_impacts: "Changes to status transitions affect Fabricator queue + teacher dashboard. Changes to scan result shape require worker redeploy in lockstep."

- id: preflight-scanner
  name: Preflight Scanner Worker (Python / Fly.io)
  category: Infrastructure
  status: in-progress
  currentVersion: 1
  summary: "Python worker on Fly.io. Pulls jobs from queue, loads file from Storage, runs rule catalogue (trimesh for STL, svgpathtools for SVG), uploads thumbnail, writes scan results."
  depends_on: [storage, preflight-pipeline, machine-profiles]
  affects: [preflight-pipeline]
  docs:
    - path: docs/projects/fabrication-pipeline.md
      purpose: Spec §12 (worker infra) + §5/§6 (rule catalogues)
  external_deps:
    - trimesh (Python)
    - svgpathtools (Python)
    - lxml (Python)
    - matplotlib (thumbnail rendering — STL)
    - cairo (thumbnail rendering — SVG)
    - supabase-py
  future_needs: "CNC / vinyl / embroidery scanners. Auto-repair (deliberately deferred — teaching moment over convenience)."
  adrs: []
  os_seam: pluggable-scanner  # registered scanner pattern, other consumers can add file types
  change_impacts: "Worker deploys are tied to rule catalogue version. Changing thresholds = ruleset version bump + worker redeploy."

- id: machine-profiles
  name: Machine Profiles Registry
  category: Configuration
  status: in-progress
  currentVersion: 1
  summary: "Per-teacher (future: per-school) machine configurations. Bed dimensions, nozzle/kerf, operation colour maps, rule overrides."
  depends_on: [auth-system]
  affects: [preflight-pipeline, preflight-scanner]
  docs:
    - path: docs/projects/fabrication-pipeline.md
      purpose: Spec §7
    - path: docs/projects/fabrication/machine-profile-defaults-v0.md
      purpose: 12 seeded machine profiles
  data_fields:
    - table: machine_profiles
      columns: [id, school_id, teacher_id, name, machine_category, bed_size_x_mm, bed_size_y_mm, bed_size_z_mm, nozzle_diameter_mm, kerf_mm, operation_color_map, rule_overrides]
      notes: "rule_overrides JSONB holds per-profile rule severity/threshold changes (Phase 1 feature per D-07)"
  future_needs: "Per-material profiles (e.g., 'Glowforge Pro — 3mm ply'). Per-school shared library when FU-P school entity lands."
  adrs: []
  os_seam: ready
  change_impacts: "Profile schema changes propagate to scanner worker input. Rule-override JSONB shape must match worker's expected contract."
```

**Status:** ⏳ DRAFT — needs Matt review before Phase 1 commit.

---

## D-11 — NIS Fabricator kickoff

**Status:** ⏳ PENDING — 20-minute call to be scheduled and notes logged.

**Template:**

```
Date: YYYY-MM-DD
Attendees: [names]

Q1 — Current workflow pain points
1. <pain point 1>
2. <pain point 2>
3. <pain point 3>

Q2 — Would they switch from current workflow to Preflight?
  What would make them NOT switch?

Q3 — Ideal per-machine queue view
  Order by: submitted time / student name / priority / other?
  Information shown per job: <list>

Q4 — Completion marking
  Mark-printed button? Or teacher-marked?
  Failed-print reasons they want to capture?

Q5 — Device preference
  Desktop / iPad / phone?

Willingness-to-switch rating (1-5): <n>
Show-stopper concerns: <list or "none">

Decision: PROCEED / HOLD / REDESIGN
```

---

## D-12 — Free public "Preflight Check" page timing

**Decision:** **Scoped into Phase 4+ of main pipeline build.** Not a separate parallel track.

**Rationale:** Shares machine-profile presets, question pre-check UX, and results-UI component with the logged-in version. One codebase. Scope:

- Public page at `/preflight` (or similar — confirm in Phase 4)
- Client-side JS scanner (no Fly.io worker — deliberately shallower)
- Covers ~30% of real student errors (mm/cm/inch, bed fit, basic SVG issues)
- CTA: "Want saved history + deeper scan + teacher queue? → StudioLoom"
- Acts as top-of-funnel / free marketing tool

**Status:** ⏸️ DEFERRED to Phase 4+.

---

## Checkpoint 0.1 — Sign-off gate

When every item above is ✅ RESOLVED or explicitly ⏸️ DEFERRED, and sub-task 0.1–0.8 are all complete per the brief:

- [ ] All D-01 through D-12 in final state
- [ ] Fixtures catalogued (≥15 STL + ≥10 SVG minimum)
- [ ] Rule catalogue per-rule sign-off complete (sub-task 0.2)
- [ ] Machine profile seed verified against manufacturer sources
- [ ] Fabricator kickoff call completed
- [ ] WIRING.yaml entries reviewed

Matt reports in chat: **"Checkpoint 0.1 — GO"** or **"Checkpoint 0.1 — PAUSE, reason: <...>"**

Only after GO does Phase 1 begin (first schema migrations, RLS, Storage buckets).
