# Build Brief — TFL3-FU-STUDENTS-FALLING-BEHIND

> Status: DRAFT — awaiting Matt sign-off before FB.0 pre-flight.
> Worktree: `/Users/matt/CWORK/questerra-grading`
> Branch: `feature/falling-behind-dashboard`
> Drafted: 15 May 2026

## Why

Matt smoke 14 May 2026:
> *"how do i catch the students falling behind? some students haven't
> done some of the work. whats the best way to raise that to my
> attention when im not in teaching mode?"*

Filed as `TFL3-FU-STUDENTS-FALLING-BEHIND` (P1) in
[`docs/projects/grading-followups.md`](grading-followups.md) lines 162-192.

Trigger phrase: **"falling behind"** / **"students behind"**.

## Audit findings — what already ships

This is the critical finding that reshaped the brief. Five existing
surfaces touch this space; one of them already does most of the work:

| Surface | Status | Reuse |
|---|---|---|
| `/api/teacher/dashboard` route | ✅ **Already computes 48h stuck students** | Primary data source — extend payload |
| `DashboardInsight` type=`stuck_student` | ✅ Already emitted with priority + href | Used by Insights stream |
| Bold dashboard **"Act now" bucket** (`insight-buckets.ts`) | ✅ Already renders stuck students | UI host — extend with drilldown |
| `/api/teacher/teach/live-status` (Teaching Mode) | ✅ Real-time per-class+unit cockpit | Different scope — leave alone |
| `/api/teacher/student-attention` (AG.4.1) + `UnitAttentionPanel` | ✅ CO2 Racers Three Cs panel | Different scope — leave alone |
| `/api/teacher/pypx-cohort` | ✅ PYP Exhibition cohort with status logic | Different scope — leave alone |

**Critical:** the 48h threshold computation already exists in
`src/app/api/teacher/dashboard/route.ts` lines 290-326:

```ts
const cutoffMs = Date.now() - 48 * 60 * 60 * 1000;
// ... filter student_progress where status === "in_progress"
//     and updated_at < cutoffMs
//     emit StuckStudent with lastPageId, hoursSinceUpdate, etc.
stuckStudents.sort(/* oldest first */);
stuckStudents.splice(20);  // capped
```

This matches the FU spec EXACTLY (48h, status != complete, last-active
timestamp, deep-link via lastPageId). No new threshold logic needed.

**The real gap is UI surface + new actions**, not data computation.

## v1 scope (locked 15 May 2026)

Four narrow pieces, all building on the existing `stuckStudents` payload:

1. **Per-class "Behind: K" badge** on `UnitsGrid` class cards.
   Group the existing `stuckStudents[]` by `classId` and show a
   subtle red/amber chip on each card with the count.

2. **Drilldown drawer** on the "Act now" bucket click. Expands to show
   per-class breakdown:
   - Class name + count
   - Student rows: name, lastActivity ("3 days ago"), currentLesson
     title, [Send Nudge] [Open last work] buttons

3. **Send Nudge** — new flow:
   - Teacher clicks → dialog with pre-filled message + free-text edit
   - POST `/api/teacher/dashboard/nudge` writes `student_nudges` row
   - Student sees toast on next `/dashboard` load via
     `PendingNudgesToast` component reading `/api/student/nudges/pending`
   - Student dismisses → POST `/api/student/nudges/[id]/dismiss`
   - No email channel in v1 (deferred to v2)

4. **Open last work** — deep-link from drilldown row to
   `/teacher/marking?classId=X&unitId=Y&studentId=Z` (route already
   handles these params; verify in pre-flight).

## v2 deferred (explicit non-goals)

- **Thin-responses sub-tier** — word-count threshold per criterion.
  Adds design decisions (per-criterion thresholds, what "thin" means
  for image-based IB tiles). Wait for v1 pilot data.
- **Email Nudge channel** via Resend. Reuse Preflight's helper when
  v2 lands; needs new email-pref opt-out.
- **Cross-unit rollup per class.** v1 assumes the active class_unit
  is the one to evaluate; existing `/api/teacher/dashboard` already
  reads `class_units` for the joined units, so multi-unit classes
  surface multiple stuck rows — acceptable for v1.
- **Teacher-configurable threshold** per class. Add when a teacher
  asks for it.
- **Snooze/dismiss management UI** for nudges that didn't land. v1
  treats nudges as fire-and-forget.

## Architecture

### Data flow (mostly reuse)

```
existing /api/teacher/dashboard       
  → DashboardData {                   
      classes[],                      ←-- DashboardClass.stuckCount (NEW field)
      stuckStudents[],                ←-- existing, group by classId
      insights[],                     ←-- existing
      ...
    }                                 
  → TeacherDashboardClient
      → UnitsGrid (per-class card)
          + ClassCardBehindBadge      ←-- NEW component, reads stuckCount
      → Insights "Act now" bucket
          + ActNowDrawer              ←-- NEW: expandable drilldown
              + StuckStudentRow       ←-- NEW: per-student row w/ actions
                  + SendNudgeDialog   ←-- NEW: confirmation dialog
                      → POST /api/teacher/dashboard/nudge (NEW route)
```

```
student /dashboard
  → existing layout
      + PendingNudgesToast            ←-- NEW: mounted at /dashboard root
          → GET /api/student/nudges/pending (NEW route)
          → POST /api/student/nudges/[id]/dismiss (NEW route, on close)
```

### New schema — single migration

`supabase/migrations/<timestamp>_student_nudges.sql` (timestamp prefix
per Migration discipline v2):

```sql
CREATE TABLE public.student_nudges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id     UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  unit_id      UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  page_id      TEXT NULL,           -- the lastPageId at nudge time (for deep-link)
  message      TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_student_nudges_student_undismissed
  ON public.student_nudges (student_id) WHERE dismissed_at IS NULL;
CREATE INDEX idx_student_nudges_teacher_recent
  ON public.student_nudges (teacher_id, created_at DESC);

ALTER TABLE public.student_nudges ENABLE ROW LEVEL SECURITY;

-- Teacher: read + insert nudges for students in their classes
-- (reuses class_members pattern from Access Model v2)
CREATE POLICY student_nudges_teacher_read
  ON public.student_nudges FOR SELECT TO authenticated
  USING (
    teacher_id = (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  );
CREATE POLICY student_nudges_teacher_insert
  ON public.student_nudges FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = (SELECT id FROM public.teachers WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.class_members cm
      WHERE cm.class_id = student_nudges.class_id
        AND cm.user_id = auth.uid()
    )
  );

-- Student: read own undismissed + update dismissed_at on own rows
-- Student auth is custom token-session — student-side endpoints use
-- service-role with route-level authorisation. RLS denies all to
-- anon and authenticated paths for student-keyed reads. The two
-- student endpoints (pending + dismiss) authorise via
-- requireStudentAuth() and use the admin client. Document this
-- pattern in the route file header per Lesson #29.
```

Migration mint: `bash scripts/migrations/new-migration.sh student_nudges`.
**Apply to prod inside the FB.2 sub-phase** and log to
`applied_migrations` table per Lesson #83.

### New endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/teacher/dashboard/needs-attention` | `requireTeacher` | OPTIONAL — only if Matt wants a richer payload than the existing `/api/teacher/dashboard` route can emit. Default: extend existing route instead. |
| `POST` | `/api/teacher/dashboard/nudge` | `requireTeacher` + verify owns class | Write nudge row |
| `GET` | `/api/student/nudges/pending` | `requireStudentAuth` | List undismissed nudges for current student |
| `POST` | `/api/student/nudges/[id]/dismiss` | `requireStudentAuth` | Set `dismissed_at = now()` if row.student_id == current student |

**Decision point inside FB.3:** check the existing
`/api/teacher/dashboard` payload size. If groupBy-classId stuckCount
fits cleanly (it should — one INT per class), extend that payload
instead of adding `/needs-attention`. The "Recommended" path is
extension to avoid endpoint sprawl. Sub-phase brief documents the
chosen path.

### New UI components

| File | Purpose | Owner |
|---|---|---|
| `src/components/teacher-dashboard-v2/ClassCardBehindBadge.tsx` | Red/amber chip on class card | FB.1 |
| `src/components/teacher-dashboard-v2/ActNowDrawer.tsx` | Expanding drilldown panel | FB.4 |
| `src/components/teacher-dashboard-v2/StuckStudentRow.tsx` | Per-student row in drawer | FB.4 |
| `src/components/teacher-dashboard-v2/SendNudgeDialog.tsx` | Confirmation + edit dialog | FB.4 |
| `src/components/student-dashboard/PendingNudgesToast.tsx` | Student-side toast | FB.6 |

All consume existing types from `src/types/dashboard.ts` plus a new
`Nudge` type (defined alongside the migration).

## Sub-phases (commit boundaries)

Per build-methodology: separate commits, no squashing. Each sub-phase
is its own commit on `feature/falling-behind-dashboard`.

### FB.0 — Pre-flight (no code)
- `git status` clean ✓ (verified at brief time)
- Baseline `npm test` count — capture in commit message
- Re-read Lessons #29 (UNION pattern for NULL class_id), #38 (assert
  expected), #54 (registry drift)
- Audit-before-touch: spot-check ONE entry per registry against code.
  Registries to consult:
  - `schema-registry.yaml` — verify class_members + students + classes shape
  - `api-registry.yaml` — verify no `/api/teacher/dashboard/nudge` exists yet
  - `feature-flags.yaml` — confirm no falling-behind flag
  - `data-classification-taxonomy.md` — review nudge message field for PII concerns
- STOP and report findings before FB.1.

### FB.1 — Per-class "Behind" badge (UI only, no new data)
- Group `data.stuckStudents` by `classId` in `TeacherDashboardClient`
- New component `ClassCardBehindBadge` — pure presentational
- Wire into `UnitsGrid` class card header
- Source-static tests for the component (4-5 assertions)
- tsc strict clean on touched files

### FB.2 — Schema migration + RLS
- Mint timestamp-prefix migration via `new-migration.sh`
- SQL per architecture above
- Apply to prod inside this sub-phase + INSERT into `applied_migrations`
- Verify with `scripts/migrations/check-applied.sh`
- Update `schema-registry.yaml` student_nudges entry
- Re-run `scan-rls-coverage.py` — ensure new table appears with 2 policies

### FB.3 — Teacher Nudge POST endpoint + tests
- `POST /api/teacher/dashboard/nudge`
- Auth via `requireTeacher` + verify `class_members` membership
- Insert row, return `{ ok: true, nudgeId }`
- Tests: auth (403 wrong teacher, 401 anon, 400 missing fields, 200 happy path)
- Decide on extending `/api/teacher/dashboard` payload with per-class
  `stuckCount` here OR keep groupBy on client (default: client-side
  groupBy from existing `stuckStudents[]` keeps the change tight)

### FB.4 — Teacher drilldown UI
- `ActNowDrawer` — expandable below the "Act now" bucket card
- `StuckStudentRow` — name, lastActivity ("3 days ago"), currentLesson,
  action buttons
- `SendNudgeDialog` — opens on Send Nudge click; pre-fills with canned
  message ("Just checking in — saw you haven't worked on {{lesson}} for
  {{days}} days. Need help getting unstuck?"); free-text editable
- `Open last work` button → router.push to
  `/teacher/marking?classId=X&unitId=Y&studentId=Z` (verify in
  FB.0 audit)
- Source-static + interaction tests where useful

### FB.5 — Student Nudge GET/POST endpoints + tests
- `GET /api/student/nudges/pending` → list undismissed for current student
- `POST /api/student/nudges/[id]/dismiss` → set dismissed_at
- Auth via `requireStudentAuth` + ownership check
- Tests: empty list, one pending, dismiss flips state, can't dismiss
  another student's nudge (403)

### FB.6 — Student toast renderer
- `PendingNudgesToast` mounted in student `/dashboard` layout
- Fetches pending nudges, renders top-3 as stacked toasts with the
  teacher's message + a Dismiss button
- Dismiss calls POST + removes from local state
- Toast uses existing toast/banner pattern (audit `src/components/ui`
  for the prevailing pattern)

### FB.7 — Matt Checkpoint FB.1 (named gate)
**Smoke scenarios (Matt drives):**
- **S1 — Per-class badge:** confirm a student stale >48h shows up
  with a "Behind: 1" badge on their class card
- **S2 — Drilldown:** click "Act now" → drawer expands → see correct
  student + class + lastActivity
- **S3 — Send Nudge:** click Send Nudge → dialog opens → submit →
  202/200 → row visible in `student_nudges` table
- **S4 — Student-side toast:** log in as the nudged student →
  toast appears with teacher's message → click Dismiss → toast gone
- **S5 — Open last work:** click Open last work → lands on marking page
  scoped to that student
- **S6 — Empty states:** teacher with no stuck students → no badge,
  no drawer entry, "Act now: 0"

**Gate criteria:**
- All 6 smoke scenarios PASS
- All tests green
- tsc strict clean
- Migration applied to prod + logged in `applied_migrations`
- Registries synced via `saveme`
- Followups filed for anything surfaced

After sign-off: merge `feature/falling-behind-dashboard` → main.

## Pre-flight ritual (gates FB.1 code)

Before writing any code:

1. **`git status` clean.** Verify before each sub-phase commit.
2. **Baseline `npm test`.** Capture the green count. After every
   sub-phase: must stay green or improve.
3. **Lessons re-read:** #29 (UNION for NULL class_id), #38 (assert
   expected not non-null), #54 (registry drift).
4. **Registry spot-checks** (per build-methodology Step 5c):
   - `class_members` table shape vs auth code
   - `class_students` is_active filter
   - Existing nudge or notification table presence (`notifications_sent`
     is Preflight-scoped, separate)
5. **`.active-sessions.txt` check** for parallel sessions in this
   worktree.
6. **STOP and report** findings before FB.1.

## "Don't stop for" list

Per build-methodology: small surprises that should NOT pause the build.

- Pixel-perfect dashboard placement (Matt confirms during smoke)
- Whether canned message text is "Just checking in" vs "Hey,
  noticing you haven't…" — author's choice, Matt adjusts at smoke
- Whether the badge is red, amber, or neutral grey — author's
  choice within existing palette
- Whether to show last-activity as "3 days ago" or absolute date —
  use relative; Matt swaps if he prefers
- Tests covering more than the listed cases — add at will

## Stop triggers

Per build-methodology: surprises that DO pause and require Matt input.

- **Three Cs / kanban / pypx data unexpectedly required** → STOP.
  v1 is staleness-only.
- **RLS test fails** → STOP. Don't bypass.
- **`requireStudentAuth` doesn't exist** → STOP. Surface and ask if
  we use the token-session admin-client pattern (see student-side
  routes in `src/app/api/student/*`).
- **More than ~5% of test classes have NO active unit** → STOP. Empty
  state UX needs Matt input.
- **`class_members` policy join cost > 200ms on a 20-class teacher**
  → STOP. Performance ceiling for a dashboard route.
- **Existing `/api/teacher/dashboard` payload structure can't carry
  per-class stuckCount cleanly** → STOP. May indicate splitting into
  a new endpoint.

## Tests

| Test file | Cases |
|---|---|
| `src/components/teacher-dashboard-v2/__tests__/ClassCardBehindBadge.test.ts` | renders count, hides when zero, color thresholds |
| `src/components/teacher-dashboard-v2/__tests__/ActNowDrawer.test.ts` | groups by class, renders rows, empty state |
| `src/components/teacher-dashboard-v2/__tests__/SendNudgeDialog.test.ts` | open/close, pre-fill, submit, error handling |
| `src/app/api/teacher/dashboard/nudge/__tests__/route.test.ts` | auth, ownership, insert, validation |
| `src/app/api/student/nudges/__tests__/pending.test.ts` | empty list, one pending, dismissed filtered out |
| `src/app/api/student/nudges/__tests__/dismiss.test.ts` | happy path, 403 wrong student, idempotency |
| `src/components/student-dashboard/__tests__/PendingNudgesToast.test.ts` | renders top-3, dismiss flow |

Target test deltas: +28 to +35 net.

## Registries to sync at end (saveme)

- `schema-registry.yaml` — `student_nudges` entry with columns, RLS,
  writers (POST nudge route, dismiss route), readers (GET pending,
  GET dashboard if extended)
- `api-registry.yaml` — 3 new routes picked up by scanner
- `ai-call-sites.yaml` — no-op (no AI calls)
- `feature-flags.yaml` — no flags this phase
- `vendors.yaml` — no-op
- `data-classification-taxonomy.md` — student_nudges classified as
  EdU + Operational + Teacher-internal (PII = student_id FK + free-text
  teacher message)
- `scanner-reports/rls-coverage.json` — new table appears with 2
  policies

## Estimated effort

**1.5-2 days** for FB.0 through FB.6 (plus FB.7 smoke). Notably
smaller than my pre-audit estimate because the data layer (48h
staleness compute) already ships.

## Open questions left for build-time decision

These are smaller than the v1 architectural calls already made — they
get answered during the relevant sub-phase, not before code starts:

- **Q-CANNED-COPY:** exact wording of the pre-filled Nudge message.
  Lean toward warm + specific ("Just checking in — saw you haven't
  worked on **{{lessonTitle}}** for **{{days}} days**. Need help getting
  unstuck?"). Matt can edit at smoke time.
- **Q-BADGE-PALETTE:** badge color — neutral grey, amber, or red? Lean
  amber (matches existing "Act now" accent in Bold theme).
- **Q-TOAST-AUTO-DISMISS:** does the student toast auto-dismiss after
  N seconds, or stay until explicit click? Lean stay-until-click — a
  nudge that auto-dismisses can be missed.

---

## Sign-off

This brief is locked once Matt replies "go" or equivalent. FB.0
pre-flight starts immediately after. No code before sign-off.

Open the door: any of the locked v1 calls or v2 deferrals you want to
reconsider before we start?
