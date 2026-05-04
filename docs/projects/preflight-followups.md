# Preflight — Follow-up Tickets

> Items surfaced during Preflight phase work that are NOT blockers for the
> phase they were found in, but should be picked up before Preflight is
> declared "v1 done." Each entry: short title, when surfaced, symptom,
> suspected cause, suggested investigation, target phase or trigger.
>
> See also: pre-existing inline FU references in
> [`ALL-PROJECTS.md`](./ALL-PROJECTS.md), [`dashboard.html`](./dashboard.html),
> [`docs/handoff/preflight-active.md`](../handoff/preflight-active.md), and
> the [`docs/changelog.md`](../changelog.md). This file is the canonical
> tracker going forward (created 28 Apr 2026 evening after Phase 8 closure
> consolidated enough FUs to deserve a single home).

---

## FU-FAB-DEVICE-AUTH — Code-based fabricator login for shared lab workstations
**Surfaced:** Post-Access-v2 retest setup, Matt prepping a 3rd account for Preflight smoke
**Target phase:** Post-pilot UX expansion (gated on first school feedback that email-per-fab is friction)

**Origin:** Matt setting up a fabricator account for testing realised the
current "every fab is a person with an email" model assumes a dedicated
lab tech — which most secondary DT departments don't have. The lab
computer is shared, used by whoever the teacher delegates or by the
teacher themselves after school. His instinct: `studioloom.org/fab` →
type a "lab code" + "access code" → logged in. No email tied to it.

**Current state (Phase 1B-2):** `fabricators` table requires
`email NOT NULL` (Argon2id password auth, opaque session tokens). The
invite flow generates a set-password URL but only sends it via email —
URL is not in the API response, so without a real receivable email
address you can't complete setup. Workaround for testing today:
`+`-aliased email like `mattburton+fab1@nanjing-school.com`.

**Proposed v1 design:**

Two login_kinds on the same `fabricators` table:

- `login_kind = 'email'` (today's pattern) — for schools with a
  dedicated lab tech. Email-based auth, set-password via emailed link.
  Accountability + named-person audit log.
- `login_kind = 'device_code'` (new) — for shared workstations.
  Teacher generates a 6–8 char code via the fab admin page (e.g.
  `ALPHA7`, `LABMAC1`). Email column NULL. Login UX:
  `/fab/login` has a "Use lab code instead?" toggle that swaps the
  email field for a 6-char code field. No password — the code IS the
  credential (rotatable by teacher at any time).

Each fab still has a `display_name` ("DT Lab Mac" / "Cynthia") for
the queue UI. School scoping (Phase 8-1) unchanged — both flavours
gate by `current_teacher_school_id()` via the inviting teacher.

**Schema changes:**
- `fabricators.email` → nullable (currently NOT NULL UNIQUE)
- Add `fabricators.login_kind` enum (`'email' | 'device_code'`,
  default `'email'`)
- Add `fabricators.device_code_hash` (Argon2id hash of the code,
  same as existing `password_hash`)
- Mutex constraint: exactly one of (email + password_hash) or
  device_code_hash must be set per row
- Migration: existing rows = `login_kind = 'email'`, no data
  migration needed

**Login flow:**
- `/fab/login` UI: email/password by default, toggle to "Lab code"
- API: `POST /api/fab/login` accepts EITHER `{email, password}` OR
  `{deviceCode}` — returns same opaque session token shape, no other
  downstream change
- Session table (`fabricator_sessions`) unchanged

**Audit / accountability concerns:**

Device codes lose the "who-did-what" trail since a code is shared.
Mitigation:
- For destructive actions (mark-failed, permanent-delete), prompt
  for the requesting teacher's initials in a confirm modal — logged
  on the action row alongside the device fabricator_id
- The Phase 7 `lab_tech_picked_up_by` column would track the device
  fabricator_id, not a person — schools with strict audit needs use
  email-based accounts instead

**Why defer:**
- Zero paying customers today — same wider-not-deeper trap as
  FU-CNC-CATEGORY
- The `+` alias workaround is functional for testing + early pilot
- Adding a second auth path doubles the surface area of `/fab/login`
  + invite admin + tests (~1.5–2 days build, real schema migration)
- Worth doing the moment the FIRST pilot school says "we don't have
  someone with an email for the lab" — direct customer pull

**Definition of done:** (a) a pilot school has explicitly requested
non-email fab login OR Matt onboards his own NIS lab and finds the
email-per-fab friction unacceptable in real classroom flow, and (b)
schema migration + login UX + invite admin updates ship together,
and (c) audit-trail mitigation (teacher initial on destructive
actions) is wired.

**Workaround for Matt's smoke test today:** use
`mattburton+fab1@nanjing-school.com` (+ alias routes to your inbox
on most modern MX). Setup invite → email arrives → set password →
log in on lab device with the aliased email + password.

---

## FU-CNC-CATEGORY — CNC router as a third Preflight machine category
**Surfaced:** 28 Apr 2026 evening, post Phase 8 closure
**Target phase:** Post-pilot expansion (gated on ≥3 paying schools on 3D/laser)

**Origin:** Comment from a DT teacher in a CNC router software thread:
> "Predominantly Onshape for 3D CAD models and 2D DXF, and Vectric VCarve
> for CAM/GCode (in my opinion, nothing else comes close to the
> functionality of the Vectric software, it's in a league of its own.)
> The above works for 95% of the jobs that I do, but I occasionally use
> AutoCAD or Illustrator if I have specific 2D drawing requirements that
> I can't easily achieve in Onshape."

**Why this matters strategically:** CNC routers (ShopBot, AXYZ, similar)
are present in a meaningful share of secondary DT departments. Adding a
third machine category to Preflight roughly doubles the addressable
pitch ("we check 3D printer + laser + CNC submissions before they hit
the queue") vs the current 3D-printer-only or 3D+laser story. **But:**
zero paying customers on the existing categories. Building wider before
selling deeper is the same anti-pattern that put 7 unmonetised projects
on the master index. Trigger is **paying customer pull**, not technical
readiness.

**Scope (proposed v1 for CNC category):**

Preflight would NOT try to be Vectric — that's a 20-year-old commercial
tool teachers already trust. The value-add is "is this safe to submit
to the school CNC, and is the student demonstrating competence?" Not
"did you CAM correctly." Checks would include:

- **Toolpath bounds vs machine envelope** (small ShopBot Buddy can't run
  a full sheet)
- **Tool numbers match school's tool library** (no calls to T7 if the
  carousel has T1–T5)
- **Tabs / onion-skin present on through-cuts** (parts flying off
  mid-cut is the classic CNC failure mode)
- **Spindle RPM + feed rate sanity for the material** (kid sets
  cherry-wood feeds for MDF, snaps a bit)
- **Estimated runtime** (avoid 4-hour jobs queued at 3pm Friday)
- **Stock thickness vs plunge depth**

Most of these parse from the GCode itself (bounds, tool calls, runtime,
feeds). The rules-engine pattern from the existing STL/SVG modules
ports cleanly — `R-NC-01: bounds_within_envelope`, `R-NC-02:
tools_in_library`, etc. Soft-gate UX (acknowledge-and-submit) more
appropriate than hard-block — most CNC errors don't crash the machine,
they ruin the part.

**Technical hurdles:**

- **GCode dialect variance** — Vectric, Fusion CAM, Mach3, Shopbot
  OpenSBP. Same conceptually, different headers/comments. v1 should
  probably support Vectric + generic G-code, expand later.
- **School-specific machine setups vary widely** — tool libraries,
  post-processors, work-holding conventions. More config per school
  than 3D/laser needed (machine_profiles would gain CNC-specific
  fields: spindle_max_rpm, tool_library_jsonb, max_cut_depth_mm, etc).
- **Hybrid file submission** — students might upload .nc + the source
  DXF as evidence. Scanner cross-references? Or only the GCode?

**Validation step before any code:** ask the DT teacher who triggered
this whether their school would *pay* for a "submission gate that
catches CNC errors before the kid hits Run." Direct customer-pull
signal is worth more than any code Claude could write speculatively.

**Definition of done:** (a) A pilot school has formally requested CNC
support, (b) the proposed rule set is validated against 5+ real
school-submitted CNC jobs (no theoretical-only rules), and (c) a third
`machine_category = 'cnc_router'` value lands in the
machine_category enum with the corresponding rule module mounted on
the scanner.

**Related:** filed as the canonical follow-up; consolidates the
strategic angle that surfaced today. See also
[`docs/projects/access-model-v2.md`](./access-model-v2.md) — multi-school
deployment is gated on Access Model v2 anyway, so CNC category v1
realistically lands no earlier than 2026 Q3.
