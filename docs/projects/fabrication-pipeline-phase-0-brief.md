# Preflight — Phase 0 Brief: Spec & Pre-Build Checklist

> **Goal:** Lock in scope, infra, fixtures, rule thresholds, and pilot partners so Phase 1 can start clean — no mid-build discoveries that invalidate the schema, rule catalogue, or UX model.
> **Spec source:** `docs/projects/fabrication-pipeline.md` (§13 Phase 0, §18 Pre-Build Checklist, §19 Open Questions)
> **Estimated effort:** ~1 day elapsed (most work is Matt-owned: fixtures, rule review, lab tech kickoff, decision log). Code assists on scaffold drafts.
> **Checkpoint:** **Checkpoint 0.1** — sign off scope + fixtures + rule thresholds + pilot partners + account architecture + retention BEFORE any Phase 1 code or migration.
> **Product name:** **Preflight** — used everywhere user-facing (student UI, teacher UI, admin UI, nav labels, route paths like `/teacher/preflight`, `/fab/login`). Schema-level tables stay `fabrication_*` (describes the domain, grep-distinct from "Preflight" UI strings). `/api/*/fabrication/*` routes stay descriptive.
> **Lab tech role name:** **Fabricator** — own account type (separate login surface, separate permission tier, per-machine scope).

---

## Decisions already locked (carried forward from planning chat)

| Decision | Value | Rationale |
|---|---|---|
| Scanner host | Fly.io | Cheap ($5–15/mo), Python runtime (trimesh/svgpathtools), isolated failure surface |
| File retention | 30 days post-terminal state for raw files | Scan results + thumbnails kept indefinitely for analytics. Pending/in-revision jobs don't start the clock. |
| Pipeline 2 coupling | Separate v1, loose coupling later | No `work_item_id` FK on `fabrication_jobs` in v1. Event-based integration post-pilot. |
| Fabricator auth | Own role, new `fabricators` table + `/fab/login` | Per-machine scope, real audit trail, no nightclub-tablet token mgmt in v1 |
| Pickup tokens (spec §10) | **Deferred to Phase 8+** | Fabricator accounts cover the audit-trail and UX need. Tokens remain a future "walk-up shared iPad" escape hatch. |
| Rule-override UX | **Moved from Phase 8 → Phase 1** | Solo-reviewer mitigation: future teachers can self-soften any rule Matt got wrong without waiting a month |
| Ambiguous judgment rules | Default to WARN, not BLOCK | Solo-reviewer mitigation: over-blocking burns trust faster than over-warning |
| Override rate | Day-1 operational KPI | Crowdsourced calibration signal — any rule overridden >20% of the time is mis-tuned |
| Objective thresholds | Stay as-specced from manufacturer sheets | Bed size, nozzle × 1.5, kerf — these are physics, not opinion |
| Free public "Preflight Check" page | Shares codebase with logged-in version, scoped into Phase 4+ | One codebase, two entry points. Don't build free-first and throw away. |

---

## Pre-work ritual (confirm before starting Phase 0 work)

1. `git status` — clean tree, on `main`, HEAD recent.
2. `npm test` — capture current baseline (expected: 1254 passing, 8 skipped per CLAUDE.md 14 Apr 2026). If it's drifted, note the new count — the new baseline is what Phase 1 measures against.
3. Re-read spec sections: §5 (STL rules), §6 (SVG rules), §8 (Soft-Gate UX), §11 (data model), §16 (Risks), §19 (Open Questions).
4. Re-read lessons listed below — full text, not just titles (per Lesson #43).
5. Confirm no existing fabrication code beyond the spec doc and this brief (pre-flight audit already verified this — no `src/` entries, no migrations, no API routes).
6. Latest migration is `092_gallery_v2_spatial_canvas.sql`. Phase 1's first migration = **093**.

---

## Lessons to re-read before Phase 0 work starts

- **#24** (`docs/lessons-learned.md:86`) — `ADD COLUMN` with DEFAULT silently overrides conditional backfills. Relevant: machine profile seed data will be inserted in Phase 1 — no conditional backfill needed, but the discipline carries over for any defaulted column.
- **#29** (`docs/lessons-learned.md:101`) — RLS dual-visibility UNION pattern. `fabrication_jobs.class_id` is NULL-safe, must follow migration 078's pattern.
- **#36–38** (`docs/lessons-learned.md:122-149`) — Verify queries assert expected values, not non-null. Every seed insert (12 machines) needs an assertion for count + key fields, not just `COUNT(*) > 0`.
- **#43–46** (`docs/lessons-learned.md:241-311`) — Karpathy discipline. Especially **#45 (surgical)**: v1 ships STL + SVG only — do not sneak in `.3mf` / `.dxf` / `.step` / CNC / vinyl. And **#44 (simplicity)**: no `MachineProfileFactory<T>` or `RuleEngine<Rule, Profile>` generics — concrete types, one consumer each.
- **#47** (`docs/lessons-learned.md:315`) — Adding schema to existing yaml requires auditing every writer. Relevant when Phase 1 adds 3 new systems to WIRING.yaml — make sure scanners don't strip the new entries.

---

## Sub-tasks

### 0.1 — Fixture corpus

**Owner:** Matt (file gathering) + Code (catalog template).

**Deliverable:** `docs/projects/fabrication/fixtures/README.md` (template drafted by Code in this phase) filled with ≥20 STL + ≥20 SVG files organised into 3 buckets:

- `known-good/` — real student / Matt files that SHOULD pass v1 scan on their intended machine
- `known-broken/` — files that SHOULD be caught by a specific rule (name each rule)
- `borderline/` — files where reasonable people disagree; used for threshold-tuning discussion

**Per-file metadata** (YAML sidecar `<filename>.meta.yaml`):
- `source`: who provided it, anonymised if student
- `intended_machine`: e.g., `bambu_x1c`
- `expected_result`: `pass | warn | block`
- `triggers_rules`: list of rule IDs (e.g., `[R-STL-07, R-STL-09]`) — for broken/borderline
- `notes`: free text context

**SVG coverage** — include at least 2 files each from:
- Glowforge convention (stroke-colour layers)
- xTool Creative Space convention (layer panel)
- Inkscape / Illustrator generic export (px-only, no units — triggers R-SVG-03)
- LightBurn export
- Files with embedded raster images (tests R-SVG-12/13)

**STL coverage** — include at least 1 file each demonstrating:
- Non-watertight (R-STL-01)
- Inconsistent winding (R-STL-02)
- Exceeds bed on Bambu X1C (R-STL-06)
- Unit mismatch (mm vs inch — R-STL-07) ← #1 student error
- Wall thickness < nozzle × 1.5 (R-STL-09)
- >45° overhang without support (R-STL-11)
- No flat base (R-STL-13)
- Tall + thin (R-STL-14)
- Known-good reference (multiple — different complexity levels)

**Stop trigger:** If Matt can't assemble ≥15 STL + ≥10 SVG after searching his archives, downgrade v1 rule catalogue scope BEFORE Phase 1 — don't tune thresholds on 5 files.

---

### 0.2 — Rule threshold sign-off (solo-reviewer mode)

**Owner:** Matt.

**Deliverable:** Inline annotations on §5 and §6 of the spec OR a separate `docs/projects/fabrication/rule-thresholds-v1.md` listing every rule with:

- Keep-as-specced / soften-to-WARN / drop-from-v1
- Uncertainty flag (high / medium / low) — high-uncertainty rules ship at WARN regardless

**Specific decisions needed (every rule in §5 and §6):** confirm severity, threshold, and whether to include in v1.

**Acceptance:** Every rule in the final v1 catalogue has `matt_signoff: YYYY-MM-DD` and an uncertainty flag. The "mark as WARN" judgment calls are explicitly logged — this is the audit trail for when override rates start coming in.

**Stop trigger:** None — this is a judgment pass, not a blocker. If Matt is uncertain about many rules, ship more at WARN than at BLOCK.

---

### 0.3 — Machine profile seed drafts (12 machines)

**Owner:** Code drafts → Matt verifies against manufacturer sheets.

**Deliverable:** `docs/projects/fabrication/machine-profile-defaults-v0.md` — drafted by Code in this phase. Matt walks through it with manufacturer docs open and confirms each number, flagging any `VERIFY` marker.

**Acceptance:** Every field either has a `source:` citation (manufacturer URL or PDF reference) or an explicit `default: inferred` with Matt's sign-off.

**Stop trigger:** If >2 machines have specs Matt can't verify (e.g., machine EOL, docs missing), drop them from v1 seed and let teachers build custom profiles for those.

---

### 0.4 — Fabricator kickoff call (NIS lab tech)

**Owner:** Matt.

**Deliverable:** 20-minute call, notes logged to `docs/projects/fabrication/phase-0-decisions.md` (template drafted by Code in this phase).

**Capture:**
1. 3 current workflow pain points (what happens today when a student's file is wrong?)
2. Would they switch from "USB stick on my desk" to Preflight queue? What would make them NOT switch?
3. What does their ideal per-machine queue view look like — order by submitted time, student name, priority?
4. Print/cut completion — do they want a "Mark Printed" button, or is it OK if the teacher marks it when they see the outcome?
5. Mobile / tablet / desktop preference? Lab computer probably desktop, but an iPad near the machine is common.

**Stop trigger — project-level risk:** If the lab tech says they won't use this workflow, **halt Phase 1**. This is spec §16's #1 risk. Re-evaluate: can the teacher do the download step themselves? Is there a different lab-tech persona at a different school?

---

### 0.5 — Fabricator auth architecture decision doc

**Owner:** Code drafts → Matt reviews.

**Deliverable:** One section inside `docs/projects/fabrication/phase-0-decisions.md` covering:

- **Auth mechanism:** Fabricator accounts are a new table separate from `teachers` and `students`. Not Supabase Auth. Use the same pattern as student token sessions (Lesson #4): cookie session → `fabricator_sessions` table → `fabricator_id`.
- **Login flow:** `/fab/login` — email + password. Password set via invite link from teacher/admin (no self-signup).
- **Schema sketch:** `fabricators`, `fabricator_sessions`, `fabricator_machines` (junction).
- **Layout:** `src/app/fab/layout.tsx` — own layout, no teacher nav, no student nav. Public paths allowlist per Lesson #49.
- **RLS pattern:** Fabricator token → queries scoped to `machine_profile_id IN (SELECT machine_profile_id FROM fabricator_machines WHERE fabricator_id = :me)`.
- **Why not Supabase Auth:** Same reason students aren't on Supabase Auth — cheap tokens, simple invite flow, no email-confirmation friction for non-technical users.

**Acceptance:** Matt signs off on the design OR flags a preference for Supabase Auth instead (triggers a redesign before Phase 1).

---

### 0.6 — Spec §19 open questions — resolve Q1–Q7

**Owner:** Matt (decisions) + Code (captures).

**Deliverable:** A section in `docs/projects/fabrication/phase-0-decisions.md` with dated answers to:

- **Q1 Pickup token lifespan:** Deferred — tokens themselves deferred to Phase 8+.
- **Q2 Phone upload:** Defer. V1 desktop-only upload flow. `<input type="file">` is device-agnostic anyway — worst case students can upload from phone, just no camera capture pipeline in v1.
- **Q3 Multi-file submissions:** No. One file per job in v1.
- **Q4 In-browser 3D preview:** No. Static worker-rendered thumbnail only. Reconsider for v2 if pilot feedback demands it.
- **Q5 Slicer integration:** No. Post-pilot decision only.
- **Q6 Material selection at upload:** No in v1. Default material per machine profile. Advanced teachers can create per-material profiles (e.g., "Glowforge Pro — 3mm plywood" vs "Glowforge Pro — 1/8 acrylic") using the existing profile system.
- **Q7 Nav placement:** Both — `/teacher/preflight` top-level queue view + "Submit to Preflight" button on applicable activity blocks / unit pages.
- **Q8 Inappropriate content:** Already handled by existing Phase 6 moderation plumbing (spec §15). No new decision.
- **Q9 FERPA for Fabricator seeing student names:** Defer — fine within school context. Flag for legal review if/when US deployments happen.
- **Q10 Portfolio credit (scan-pass vs physical completion):** Both visible — scan-pass as intent marker, physical completion as outcome. No v1 engineering needed; portfolio layer reads both.

**Acceptance:** All 10 have a dated resolution or an explicit `defer: <condition>`. No "we'll figure it out in Phase X" hand-waves.

---

### 0.7 — Retention policy — concrete design

**Owner:** Matt (policy) + Code (SQL sketch).

**Deliverable:** A section in `phase-0-decisions.md` with:

- **Trigger column:** `fabrication_jobs.retention_clock_started_at` (set by trigger when status → `completed` or `rejected`)
- **Delete target:** raw file in Storage at `fabrication/{school_id}/{teacher_id}/{student_id}/{job_id}/v{version}.{ext}`
- **Keep:** thumbnail, scan_results JSONB, all metadata rows
- **Cron:** daily job scans `fabrication_job_revisions WHERE retention_clock_started_at < now() - interval '30 days' AND storage_path IS NOT NULL` — deletes files, nulls `storage_path`, writes to audit log.
- **Abort path:** any error logs to `system_alerts`, doesn't retry blindly — human review.
- **Student-visible:** "Your scan results and thumbnail are kept permanently. Your original file is deleted 30 days after the job is completed."

**Acceptance:** Matt signs off on the policy language AND the 30-day trigger from terminal state.

---

### 0.8 — WIRING.yaml draft entries (for Phase 1 commit)

**Owner:** Code drafts → Matt reviews.

**Deliverable:** Draft YAML in `phase-0-decisions.md` for 3 new systems to add to `docs/projects/WIRING.yaml` in Phase 1's first commit:

- `preflight-pipeline` — orchestration (status transitions, upload → scan → gate → route → pickup → complete). Depends on `storage`, `preflight-scanner`, `auth-system`. Affects `teacher-dashboard`, `student-dashboard`.
- `preflight-scanner` — Python Fly.io worker. Depends on external: trimesh, svgpathtools, matplotlib, cairo, supabase-py. Affects `preflight-pipeline`.
- `machine-profiles` — per-teacher profile registry. Depends on `auth-system`. Affects `preflight-pipeline`, `preflight-scanner`.

Note: `preflight-pipeline` is the system name; the table is `fabrication_jobs`. Naming split is intentional — brand-forward in WIRING systems (user-adjacent), domain-descriptive in schema.

**Acceptance:** Matt signs off on system names + dep graph. Entries land in WIRING.yaml in Phase 1's first commit per methodology (not deferred to saveme).

---

## Success criteria (Checkpoint 0.1 — all must be true to start Phase 1)

- [ ] Fly.io confirmed as scanner host ✅ (locked)
- [ ] 30-day retention policy signed off with concrete SQL sketch
- [ ] ≥15 STL fixtures catalogued (downgraded threshold if full 20 not available)
- [ ] ≥10 SVG fixtures catalogued across ≥2 manufacturer conventions
- [ ] Every rule in §5 + §6 has `matt_signoff` date + uncertainty flag
- [ ] High-uncertainty rules confirmed as WARN (not BLOCK) in v1 catalogue
- [ ] 12 machine profile seed specs verified against manufacturer sources
- [ ] NIS Fabricator kickoff call completed — notes logged, willingness-to-switch confirmed
- [ ] Fabricator auth architecture signed off (own table, `/fab/login`, no Supabase Auth)
- [ ] Spec §19 Q1–Q7 resolved with dated decisions
- [ ] WIRING.yaml draft entries for `preflight-pipeline`, `preflight-scanner`, `machine-profiles` reviewed
- [ ] `npm test` baseline captured (expected 1254 passing) for Phase 1 delta measurement

---

## Stop triggers (halt Phase 0, report, wait for decision)

- **Project-level:** Fabricator says they won't switch from current workflow → halt, reconsider scope.
- **Fixtures:** Matt has <15 STL files after archive search → trim v1 rule catalogue before Phase 1 commits to thresholds.
- **Machine specs:** >2 of the 12 machines have unverifiable specs → drop those from v1 seed (teachers create custom profiles for them).
- **Rule reviewer:** Matt flags >10 rules as "high uncertainty" → audit whether the spec's rule catalogue is premature; may need a scoped-down v1.
- **Retention conflict:** 30-day deletion raises FERPA/GDPR concern for any pilot school → halt, get legal read before Phase 1.

## Don't stop for

- Missing `.3mf` / `.step` / `.dxf` / `.ai` samples (out of scope v1 per §3).
- Machine profile gaps for unusual hardware (custom-profile creation is a Phase 1 feature — teachers can make their own).
- Spec §19 Q9–Q10 (post-pilot decisions — deferred).
- Minor rule threshold disagreements among hypothetical future reviewers (override KPI handles calibration).
- WIRING.yaml entries not being perfect first draft (they're drafts — polish in Phase 1 commit).

---

## Checkpoint 0.1 — what to report

When all success criteria are met, Matt produces a summary:

1. Fixture counts (STL / SVG, per bucket)
2. Rule catalogue diff from spec (rules dropped / softened / kept) with counts
3. Machine profile verification status (verified count / inferred count / dropped count)
4. Fabricator kickoff notes (link or embed)
5. Decisions doc link (`phase-0-decisions.md`)
6. WIRING.yaml draft entries (link or embed)
7. Any risks that emerged during Phase 0 work that weren't in §16 of the spec
8. Explicit "GO Phase 1" or "PAUSE" with reason

**Do NOT start Phase 1 until Checkpoint 0.1 is signed off in chat.** Phase 1 = schema migrations, RLS, Storage buckets — irreversible on main. Phase 0 is cheap; pre-flight pays for itself.

---

## Phase 0 ≠ Code writing to main

Everything in Phase 0 lands in `docs/projects/fabrication/*` or `docs/projects/fabrication-pipeline-phase-0-brief.md`. No `src/` changes. No migrations. No schema touches. No test-count changes.

If you find yourself editing a file in `src/` during Phase 0, stop — you've drifted into Phase 1.
