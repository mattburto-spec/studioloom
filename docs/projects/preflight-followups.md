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
