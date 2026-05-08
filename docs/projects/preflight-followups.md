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

## FU-PILOT-FLAGGED-API-TEST — Add unit tests for /api/admin/preflight/flagged
**Surfaced:** 8 May 2026, Pilot Mode P3
**Target phase:** Trigger when the surface gains a mutation action (not before)
**Severity:** 🟢 LOW (read-only Matt-only triage; deeper coverage on rule-buckets + teacher-orch already covers shape contract)

**Origin:** PR #113 P3 commit message flagged this. Route over-fetches
recent jobs (4× cap) then filters in TS for the rule-count predicate
that doesn't translate cleanly to SQL. No test harness for it today.

**When to revisit:** if/when this surface gains an action button (e.g.
"Mark this rule as known false-positive" → updates a rules registry),
add a route test before the action ships. While read-only the
filtering logic is straightforward enough that a regression would
surface immediately on any visit.

---

## FU-PILOT-MODE-FLIP-CRITERIA — Decide when to flip PILOT_MODE_ENABLED to false
**Surfaced:** 8 May 2026, Pilot Mode P1
**Target phase:** Pilot review milestone (~2-4 weeks of real usage)
**Severity:** 🟡 MEDIUM (every override past the safe threshold is a teaching-moment cost)

**Origin:** [src/lib/fabrication/pilot-mode.ts](../../src/lib/fabrication/pilot-mode.ts)
embeds the criteria in its docstring: ≥100 real submissions through,
override rate <5%, zero "scanner was wrong" stories, ruleset tuned
based on histogram. Set as a PR-flippable boolean for v1.

**Action when criteria met:** flip the constant to `false`, ship the
PR, prod redeploy. Pre-pilot data on `/admin/preflight/flagged` should
inform the call.

**Promote to admin_settings flag IF:** multiple schools land on the
codebase with different pilot windows. Today there's one school + one
Matt who can ship a flip in 2 commits — runtime flag would be premature.

---

## FU-PILOT-AUTO-ORIENT — Server-side STL auto-orientation
**Surfaced:** 8 May 2026, deferred at start of Pilot Mode build
**Target phase:** Post-pilot, gated on histogram data
**Severity:** 🟢 LOW until pilot data shows otherwise

**Origin:** Conversation about David's wheel rejection raised the
question of building auto-orient into the scanner itself. Matt's
estimate: 5 seconds in Bambu Studio vs 2-3 days server-side build.
Deferred.

**Build when:** R-STL-13 (flat-base coverage) shows up as the top
firer in `/admin/preflight/flagged` rule histogram AND students
consistently override it on files that print fine.

**Implementation sketch:** trimesh `convex_hull` → score each face by
contact-area / overhang-ratio / support-volume → return best face's
rotation matrix → re-export STL → re-scan. Would land as a "Re-scan
with auto-orient" button on the BLOCK rule card; auto-applies the
rotation, replaces the storage path, increments revision_number.

**Risk:** silently overrides student-intentional orientation on
artistic models. Mitigation: opt-in (button, not auto-apply) + side-
by-side preview (original vs proposed) before commit.

---

## FU-COLOR-PREFERENCE — Per-machine `available_colors` filter (v2 of preferred-color)
**Surfaced:** 4 May 2026 night, while building color-preference v1
**Target phase:** Post-pilot UX expansion (gated on first fab feedback that the v1 hardcoded list is too generic)
**Severity:** 🟢 LOW (feature growth, no current bug)

**Origin:** v1 (shipped 5 May 2026, PR #25, commit `b52fe72`) gives
students a hardcoded dropdown of common school-makerspace filament
colors + an "Other (specify)" free-text escape hatch. Stored as plain
text on `fabrication_jobs.preferred_color`. Works fine for the NIS pilot
where the lab's filament library is broadly stable.

**v2 promise (deferred):** *"later on it could be upgraded so that the
fab can adjust the colours available on each machine but thats more
work."*

**v2 scope:**

Move the canonical color list off `src/lib/fabrication/preferred-color-options.ts`
(static array) and onto `machine_profiles.available_colors` (JSONB
array of `{value, label}` per machine). The student picker would then:

1. Read `available_colors` for the selected machine
2. Show the union of "common defaults" + that machine's overrides
3. Filter to only what's actually loaded on that printer
4. Fab admin page gains a per-machine "Currently loaded" editor

**Schema sketch:**

```sql
ALTER TABLE machine_profiles
  ADD COLUMN available_colors JSONB
    DEFAULT '[]'::jsonb
    NOT NULL;

-- shape: [{ "value": "PLA — Black", "label": "PLA — Black" }, ...]
-- empty array means "fall back to platform defaults from preferred-color-options.ts"
```

**Why defer:**

- v1 covers the actual student → fab handoff gap (fab knows what color
  to load). v2 only solves the *"the dropdown is too long / has stuff
  we don't stock"* problem, which Matt's NIS lab hasn't hit yet.
- Adding per-machine config gives the fab another admin surface to
  maintain — friction worth absorbing only when v1 friction is real.
- v1 already has the `preferred_color` column + free-text fallback,
  so v2 is purely additive (no data migration, no breaking change to
  what's stored).

**Trigger to revisit:**
- A fab/teacher says "the dropdown shows stuff we don't carry" or "kids
  keep picking colors we never stock"
- Pilot expansion to a school with a heterogeneous machine fleet (one
  printer is PETG-only, one is multi-material, etc)
- "continue color v2" / "FU-COLOR-PREFERENCE" in any session

**Definition of done:**
(a) at least one pilot fab has formally requested machine-specific
color filtering, (b) `machine_profiles.available_colors` JSONB column
lands with admin editor UI, (c) student picker reads from the bound
machine's list (with platform defaults as fallback), (d) v1 hardcoded
list in `preferred-color-options.ts` becomes the platform-default seed.

---

## FU-FAB-INVITE-SCHOOL-SCOPED — Fabricator invite still gates on teacher_id, not school_id (Phase 8-1 audit gap)
**Status: ✅ RESOLVED 4 May 2026** (along with 4 sibling fab admin routes; see closure note at bottom)
**Surfaced:** 29 Apr 2026, post-Access-v2 Preflight retest setup
**Severity:** 🟠 MED (workflow-friction; not data-leak)

**Symptom:** Matt couldn't invite his teacher email (`mattburton@nanjing-school.com`)
as a fab because an `INVITE_PENDING` row from 24 Apr (invited by his
other NIS persona `mattburto@gmail.com`) was still sitting in the
table. Error returned: *"A fabricator with that email already belongs
to another teacher."* Hard-block, no resend path.

**Root cause:** `src/app/api/teacher/fabricators/route.ts` line 174:

```ts
if (existing.invited_by_teacher_id !== user.id) {
  return privateJson(
    { error: "A fabricator with that email already belongs to another teacher." },
    409
  );
}
```

This check is **teacher-scoped** — pre-Phase-8-1 era code. Under flat
school membership (Phase 8-1 + 8-2 + 8-3 contract), any teacher at
the same school should be able to take over / re-invite / delete an
existing fab row. The `invited_by_teacher_id` should be audit-only,
not access-control, mirroring the `created_by_teacher_id` pattern
established for labs (Phase 8-2) and machines (Phase 8-3).

**Audit:** missed during the Phase 8-1 + Round 1 audit (28 Apr).
Caught today (29 Apr) when it blocked Matt's own multi-persona
testing. The audit doc preflight-audit-28-apr.md is closed 12/12 ✅
but THIS site wasn't on the surface — fab-orchestration's queue + job
paths got swept (HIGH-2/3/4) but the invite/admin route wasn't
audited because it didn't directly touch jobs.

**Fix:**

Replace the teacher-id check with a school check via the established
helpers:

```ts
import { loadTeacherSchoolId } from "@/lib/fabrication/lab-orchestration";

// ... inside POST handler, after auth:
const schoolResult = await loadTeacherSchoolId(admin, user.id);
if (isOrchestrationError(schoolResult)) {
  return privateJson({ error: schoolResult.error.message }, schoolResult.error.status);
}
const schoolId = schoolResult.schoolId;

// When loading existing fab, also check its school via the inviting teacher chain:
const { data: existing } = await admin
  .from("fabricators")
  .select(`
    id, invited_by_teacher_id, password_hash,
    inviter:teachers!fabricators_invited_by_teacher_id_fkey(school_id)
  `)
  .ilike("email", email)
  .maybeSingle();

if (existing) {
  const inviterSchoolId = pickFirst(existing.inviter)?.school_id;
  if (inviterSchoolId !== schoolId) {
    return privateJson(
      { error: "A fabricator with that email already belongs to another school." },
      409
    );
  }
  // Same school → fall through to resend path (no per-teacher gate).
  // ... existing resend logic continues unchanged
}
```

The error message also gets clearer: "another school" is the right
boundary; "another teacher" was wrong because flat membership means
any teacher at the school should take over a teammate's pending
invite without ceremony.

**Audit-while-here:** the same teacher_id check probably exists on
the reset-password + deactivate + machine-assign routes for fabs.
Sweep `/api/teacher/fabricators/[id]/*` for the same pattern when
fixing this. Likely also `/api/teacher/labs/[id]/bulk-approval`...
no, that one was Phase 8-3 swept. But verify all `/api/teacher/fabricators/*`.

**Workaround for testing today (Matt's current state):** hand-delete
the stale row in SQL:
```sql
DELETE FROM fabricators
WHERE id = '2df7d022-51b3-4c73-9b35-e0fd0a80e397';
```
Then re-invite fresh from the new persona. The `INVITE_PENDING` row
was old test debris; no real data lost.

**Definition of done:** (a) `/api/teacher/fabricators/route.ts`
invite path uses `loadTeacherSchoolId` + school-id comparison via
the inviter's teachers FK chain, (b) all sibling routes under
`/api/teacher/fabricators/[id]/*` audited for the same pattern
(reset-password + deactivate + machines/[machineId]), (c) at least
one new route test locks in the school-scoped behavior
(cross-school 409, same-school resend works), and (d) audit doc gets
a P.S. entry noting the late-found gap that Phase 8-1 audit missed.

---

### Closure note (4 May 2026)

Resolved alongside 4 sibling routes in a single sweep. All 5
`/api/teacher/fabricators/*` admin routes flipped to school-scoped.

**Routes swept:**

1. `GET /api/teacher/fabricators` — list now scopes by every
   teacher at the school (previously: only the calling teacher's
   own invitees).
2. `POST /api/teacher/fabricators` (invite) — same-school existing
   fab → resend hint as before; cross-school existing fab → new
   error `"belongs to another school"` (replaces the
   pre-flat-membership `"belongs to another teacher"` hard-block).
3. `PATCH /api/teacher/fabricators/[id]` (deactivate) — uses
   `loadSchoolOwnedFabricator`. Cross-school → 404.
4. `POST /api/teacher/fabricators/[id]/reset-password` — same.
   Also fixed an incidental TS strict error from the helper return
   type (display_name became nullable; falls back to "Fabricator").
5. `PATCH /api/teacher/fabricators/[id]/machines` — DOUBLE fix:
   the fab ownership check AND the per-machine validation. Machines
   are now validated as school-template OR school-school (matches
   the calling teacher's school_id, which was already what
   Phase 8-3 enforced on machine_profiles).

**Schema:** unchanged. `invited_by_teacher_id` stays as legacy
audit-only column (same pattern as `machine_profiles.teacher_id`
post Phase 8-3). Future cleanup migration could rename to
`created_by_teacher_id` for consistency, but not blocking.

**New helpers in `src/lib/fabrication/fab-orchestration.ts`:**

- `loadSchoolOwnedFabricator(db, schoolId, fabricatorId)` —
  mirrors `loadSchoolOwnedLab` from lab-orchestration. Returns
  `{ fabricator: SchoolOwnedFabricator } | OrchestrationError`.
  Cross-school → 404 (no existence leak).
- `findFabricatorByEmail(db, email)` — variant for the invite
  path that needs to disambiguate "no fab anywhere" vs "fab at
  same school" vs "fab at other school". Returns the row + the
  inviter's `school_id`; caller compares.

**Tests:**

- `src/app/api/teacher/fabricators/__tests__/invite.test.ts`
  rewritten: 7 → 9 cases. Mock fixture now provides
  `school_id` on teachers + `inviterSchoolId` on existing
  fabricator state. New cases:
  - "another school" (cross-school 409 with new error message)
  - "same school different teacher persona" (resend hint applies)
  - "same school different teacher persona with resend=true"
    (cross-persona takeover succeeds — locks in flat-membership
    contract)
- The 3 sibling routes (`[id]/route.ts`,
  `[id]/reset-password/route.ts`, `[id]/machines/route.ts`)
  had no pre-existing route tests (`audit-skip: routine teacher
  pedagogy ops, low audit value` annotation was on all three).
  Helper unit tests on `loadSchoolOwnedFabricator` could be
  added later but the integration paths are exercised by the
  invite test's mock pattern.

**Verification:**
- `tsc --noEmit --project tsconfig.check.json` clean (one
  pre-existing unrelated `BugReportButton.tsx` error from Access
  v2 Phase 6 work that's not gated in CI).
- Targeted: 103 fab-related tests pass. Full suite: 3494 → 3496
  (no regressions; +2 from new invite cases).
- Smoke (Matt): logged in as `mattburton@nanjing-school.com`,
  expected to see fab originally invited by `mattburto@gmail.com`
  persona AT THE SAME NIS SCHOOL — works under flat membership.

**Lessons surfaced:**
- The 28 Apr audit doc was correct in its scope (queue + jobs +
  admin pages) but the "admin pages" framing was too narrow —
  excluded `/api/teacher/fabricators/*` because they don't list
  jobs. Future audits should explicitly scope by **route prefix**
  not by feature concept, to avoid this kind of gap.
- Pattern recognition: every "teacher_id ownership check" in
  Preflight admin/management surfaces should be school-scoped
  under flat membership. The contract is uniform; the audit
  noise was per-route. A future dimension audit could
  programmatically grep for `invited_by_teacher_id !==` and
  `teacher_id !== teacherId` patterns to surface the rest.

---

## FU-GUEST-UPLOAD — Per-school anonymous upload page (no StudioLoom account)
**Surfaced:** 4 May 2026 night, post-Round-2 closure conversation
**Target phase:** Post-validation (customer-pull-gated, see below)
**Severity:** 🟢 LOW (feature growth, no current bug)

**Origin:** Matt asked: *"how hard would it be to have a page for each
school that any student can go to to upload stl or svg files that
then make it into the fab pipeline. it could be a simple 3 digit
code to input to allow uploads. and there would be a space to type
student name in. workaround for students who want to get jobs done
but dont yet have studioloom accounts."*

**Why this matters strategically:**

Real product gap. Schools have students who want lab access without
onboarding to the platform — siblings, MYP kids not in the Design
class but using the makerspace, after-school club kids, one-off
projects. Guest mode would unblock them.

Also a **pilot acquisition lever**: "print a poster with a code,
kids drop files" answers the common pilot objection "I don't want
to onboard 30 kids to evaluate your platform." Zero
account-creation friction.

**Why it's GATED on customer pull, not built now:**

Same anti-pattern that put 7 unmonetised projects on Matt's master
index. Building features on a product with 0 paying customers
doesn't fix the customer problem. The validation step is cheap and
should come first.

**Validation (do BEFORE any code):** Next 3 DT teachers Matt talks
to, ask: *"If you could put a poster in your lab with a code, and
any kid could drop an STL/SVG without onboarding to the platform,
would you use that?"* If 2+ say yes → build. If <2 → it's a
Matt-projection. ~10 min of conversation.

**Two implementation paths once validated:**

### Path A — Pragmatic shortcut (~half day)

SQL-create one "Guest" student per school + one "Guest" class.
Public-classcode flow: `/upload/<schoolCode>` → typed name becomes
new student row's display_name → existing student auth issues a
session → same upload UI as authenticated students.

- **Schema:** None (or minimal — maybe one column on `schools` for
  the upload code).
- **Code:** A single new public route + a thin wrapper around
  existing student-classcode auth.
- **Pros:** Zero orchestration changes; scanner, queue, fab pickup
  all work unchanged.
- **Cons:** Data model messier (guest student rows accumulate);
  no real distinction between "guest" and "real student" in the
  DB.

### Path B — Proper guest mode (~1–1.5 days)

| Layer | Work |
|---|---|
| Schema | New migration: `schools.upload_code` (4–6 chars), nullable `fabrication_jobs.student_id` + `class_id`, new `guest_name` text column, new `guest_email` (optional, for completion notification) |
| Public route | `/upload/[code]` — no auth, school-scoped via code lookup |
| Public API | `POST /api/public/fabrication/upload` — code → school_id, write job with NULL student_id + populated guest_name |
| Teacher queue | New "Guest jobs" tab or filter — school-scoped, any teacher reviews |
| Approval flow | Most likely **pending teacher review** for v1 (anonymous = abuse risk); could later add hybrid (auto under thresholds, pending over) |
| Rate limiting | Per-IP throttle on the public endpoint; codes rotatable by school admin |
| Tests + smoke | ~2h |

**Real concerns to think through:**

- **Abuse vector** — anonymous uploads can carry inappropriate
  content, spam, oversized files. School liability concern. Pending
  teacher review mitigates but doesn't eliminate.
- **No notification path** — without an email/account, lab tech
  finishes the print and the kid has to physically check back at
  the lab. Optional email field could help.
- **No revisions** — each guest upload is its own job; no iteration
  loop possible without an account.
- **Quota** — one IP could spam 50 jobs. Need per-IP-per-day limit.
- **Lifecycle** — guest jobs probably auto-expire after some window
  (no one's tracking them long-term).
- **Code design** — 3 chars × ~36 alphanumeric = ~46k codes,
  trivially brute-forceable. 5–6 chars is more reasonable. Visible
  on a poster in the lab → casual brute-forcing wouldn't help
  anyway because they'd need physical access to know what files to
  upload to what machine.

**Strategic angle for kill-or-promote signal:**

If guest-mode usage at a pilot school exceeds authenticated student
usage by >10×, the model is wrong (kids don't want accounts; lab is
just a service). If <10%, accounts are valuable (history, badges,
integrity monitoring all matter). Either signal is useful.

**Definition of done:** (a) at least one pilot school has formally
requested guest upload OR Matt's own NIS lab has run the half-day
shortcut for ≥1 week with measurable usage, (b) Path A or Path B
implementation lands with rate-limiting + per-IP quota, (c)
moderation/review flow chosen and documented, (d) abuse policy +
content moderation surface specified before public launch.

**Trigger to revisit:** "continue guest upload" / "FU-GUEST-UPLOAD"
in any session.

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
