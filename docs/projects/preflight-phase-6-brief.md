# Preflight Phase 6 — Teacher Queue + Approval

**Status:** DRAFT — awaiting Matt sign-off on §10 open questions before first sub-phase opens
**Date drafted:** 22 April 2026 PM late
**Spec source:** `docs/projects/fabrication-pipeline.md` §9 (Teacher UX), §13 Phase 6
**Predecessor:** Phase 5 SHIPPED + Checkpoint 5.1 PASSED 14/14 (preflight-active HEAD `3580cad`).
**Blocks:** Phase 7 (Fabricator pickup — consumes `fabrication_jobs.status='approved'` rows this phase produces), full pilot.
**Estimated duration:** ~2 days (6 sub-phases, each gated, separate commits).
**Worktree:** `/Users/matt/CWORK/questerra-preflight`, branch `preflight-active`.

---

## 1. What this phase ships

The first teacher-facing Preflight surface. Phases 1–5 built the student flow from upload to submit; this phase lets the teacher actually see and act on submissions. Without Phase 6, approved scans pile up in the DB with nobody watching — `fabrication_jobs.status = 'pending_approval'` rows are invisible.

**Ships:**

1. **Queue page** `/teacher/preflight` — replaces the current Phase 1B-2 redirect-to-fabricators with a real submissions queue. Status tabs (Pending approval / Approved / Completed / Revisions in progress / All). Row per submission: student name + class, unit/project (if known), machine profile + mini-thumbnail, revision count (flag at 3+), scan-result summary pill (`1B · 2W · 3I` style from Phase 5-5), time-waiting. Sorted oldest-first by default (FIFO triage).
2. **Per-job detail page** `/teacher/preflight/jobs/[jobId]` — full scan results (read-only variant of `ScanResultsViewer` from Phase 5-3), revision history panel (reuse Phase 5-5 `RevisionHistoryPanel`), teacher-notes thread, action buttons (Approve · Return for revision · Reject · Add note).
3. **4 teacher actions** exposed via new API routes:
   - **`POST /api/teacher/fabrication/jobs/[jobId]/approve`** — transitions `fabrication_jobs.status` from `pending_approval` → `approved`. Writes `teacher_reviewed_by` + `teacher_reviewed_at`. Optional `teacher_review_note`.
   - **`POST /api/teacher/fabrication/jobs/[jobId]/return-for-revision`** — transitions to `needs_revision`. Requires `note` (student needs to know what to fix). Student's status page renders an amber card keyed on this status + note.
   - **`POST /api/teacher/fabrication/jobs/[jobId]/reject`** — transitions to `rejected`. Hard stop — student cannot re-upload on this jobId. (Student can start a fresh job from `/fabrication/new`.)
   - **`POST /api/teacher/fabrication/jobs/[jobId]/note`** — append a note without changing status. Useful during review. Stored in the same `teacher_review_note` field (string, overwritten; history via audit log is a Phase 9 follow-up).
4. **Per-student fabrication history tab** on `/teacher/students/[studentId]`. New tab alongside existing Overview / Discovery. Shows: all submissions by this student across all classes (ordered by recency), pass rate %, most common failure rule (coaching signal). Rule breakdown: count by rule_id across all revisions.
5. **Per-class fabrication tab** on `/teacher/classes/[classId]`. Same structure but scoped to the class. Useful for a teacher to see "which of my Period 3 kids are blocked on fabrication today?".
6. **Read-only `ScanResultsViewer` variant** — add `readOnly` prop to the existing Phase 5-3 component. When true: hide Submit + Re-upload buttons, disable radio interactions, still render buckets + acks + rule details. Teacher uses this on the detail page.
7. **Queue API** — `GET /api/teacher/fabrication/queue?status=...` returns paginated list with server-side filtering by status. Reuses the teacher auth pattern + `verifyTeacherOwnsClass`.
8. **Student-side status visibility** — when `fabrication_jobs.status = 'needs_revision'`, the existing `/fabrication/jobs/[jobId]` page (Phase 5) renders a new amber "Your teacher has asked for a revision" card with the teacher's note + re-upload CTA. Small addition to Phase 5-3's `ScanResultsViewer`.
9. **pytest / npm test coverage** — route tests for 4 teacher actions + queue endpoint + per-student aggregation + status-keyed UI rendering.
10. **WIRING.yaml + dashboard + ALL-PROJECTS.md** — saveme at Checkpoint 6.1.

**Does NOT ship in Phase 6:**

- Lab Tech / Fabricator pickup UI → **Phase 7**.
- Full machine-profile admin UI (CRUD for teacher-owned profiles, operation color map editor, rule overrides) → **Phase 8**. Phase 6 uses whatever seed + Phase 1B-2 admin page provides.
- Toggle `requires_teacher_approval` per machine — deferred to Phase 8, OR handled via a one-off SQL pre-pilot (`UPDATE machine_profiles SET requires_teacher_approval = true WHERE machine_category = 'laser_cutter'`).
- Bulk actions (select N submissions, approve all) → Phase 9 polish.
- Scan-failure heatmap, revision distribution, utilisation views → Phase 9.
- Teacher email notification on new submission → file as `PH6-FU-TEACHER-EMAIL` P3 during 6-1.
- Audit log of teacher reviews (who approved when with what note history) → Phase 9.
- `PH5-FU-REUPLOAD-POLL-STUCK` P2 fix — **should land BEFORE Phase 6 ships** so students re-uploading via teacher-requested revision don't hit the hard-refresh UX. See §9 execution note.

---

## 2. Infrastructure

**No new infra. No migration.**

Every column Phase 6 needs already exists on `fabrication_jobs` (migration 095):
- `status` — CHECK constraint already includes all target values (`approved`, `needs_revision`, `rejected`)
- `teacher_reviewed_by UUID REFERENCES auth.users(id)` — nullable, set by Phase 6
- `teacher_reviewed_at TIMESTAMPTZ` — nullable, set by Phase 6
- `teacher_review_note TEXT` — nullable, set by Phase 6
- `teacher_id UUID NOT NULL REFERENCES auth.users(id)` — already scoped via Phase 4-1 createUploadJob

**Auth:** teacher Supabase Auth session (NOT student token sessions). All 4 new action routes + queue endpoint use `requireTeacherAuth` from `src/lib/auth/verify-teacher-unit.ts`. Pattern matches existing `/api/teacher/*` routes (35+ already in place).

**Authorization scope:** every action verifies `fabrication_jobs.teacher_id = requireTeacherAuth().teacherId`. No cross-teacher visibility. If `fabrication_jobs.class_id` is set AND drifts from `teacher_id` (shouldn't happen but defensive), also verify via `verifyTeacherOwnsClass`. 404 not 403 for "not yours" (same pattern as Phase 5 student-side).

**Cache hygiene:** Lesson #11 — every new route sets `Cache-Control: private, no-cache, no-store, must-revalidate`. Teacher dashboard is highly dynamic.

**RLS note:** `fabrication_jobs` has a teacher SELECT/UPDATE policy (migration 095) that lets an authenticated teacher see their own rows. API routes use `createAdminClient` which bypasses RLS, so we control scoping in application code. The RLS policy is belt-and-braces in case future client-direct queries happen.

---

## 3. Sub-phase split (6 instruction blocks)

Each sub-phase: pre-flight → audit → write → test → NC → commit → report cycle. Separate commits.

### 6-0 — (prerequisite) Fix PH5-FU-REUPLOAD-POLL-STUCK P2

Not strictly Phase 6, but blocks safe pilot. Dispatch RESET synchronously before any async work in ReuploadModal's onSuccess handler (fix option A from the follow-up), OR make the hook auto-reset when polled `currentRevision` changes (option B). Option B is more robust. ~1–2 hours.

**Commit:** `fix(preflight): PH5-FU-REUPLOAD-POLL-STUCK — hook auto-reset on revision change`

**Est:** ~0.2 day

---

### 6-1 — Teacher action endpoints + queue endpoint

**Goal:** Ship the 4 teacher action API routes + the queue listing endpoint.

**Files touched:**
- `src/app/api/teacher/fabrication/jobs/[jobId]/approve/route.ts` (NEW)
- `src/app/api/teacher/fabrication/jobs/[jobId]/return-for-revision/route.ts` (NEW)
- `src/app/api/teacher/fabrication/jobs/[jobId]/reject/route.ts` (NEW)
- `src/app/api/teacher/fabrication/jobs/[jobId]/note/route.ts` (NEW)
- `src/app/api/teacher/fabrication/queue/route.ts` (NEW)
- `src/lib/fabrication/teacher-orchestration.ts` (NEW — shared helpers for teacher actions, parallel to the student orchestration.ts)
- Tests for each (5 route tests + orchestration lib tests)

**Shape:**
```ts
// Action routes
POST /api/teacher/fabrication/jobs/[jobId]/approve   body: { note?: string }
POST .../return-for-revision                          body: { note: string }  // required
POST .../reject                                        body: { note?: string }
POST .../note                                          body: { note: string }

// Queue endpoint
GET  /api/teacher/fabrication/queue?status=pending_approval&limit=50&offset=0
  → { total: number, rows: QueueRow[] }

interface QueueRow {
  jobId: string;
  studentName: string;      // display_name || username
  studentId: string;
  className: string;
  classId: string;
  unitTitle?: string;       // if unit_id linked (optional)
  machineLabel: string;     // "Bambu X1C" from machine_profiles.name
  machineCategory: "3d_printer" | "laser_cutter";
  thumbnailUrl: string | null;  // 10-min signed URL for latest rev's thumbnail_path
  currentRevision: number;
  ruleCounts: { block: number; warn: number; fyi: number };
  jobStatus: string;
  createdAt: string;
  updatedAt: string;        // for "time waiting"
}
```

**Audit first:** existing `/api/teacher/fabricators/[id]/route.ts` (from Phase 1B-2) for the auth + error-response shape; `verifyTeacherOwnsClass`; Phase 5-1 `submitJob` for the status transition pattern; `loadOwnedJob` for the ownership-gate pattern.

**Commit:** `feat(preflight): Phase 6-1 teacher action + queue endpoints`

**Est:** ~0.5 day

---

### 6-2 — Read-only ScanResultsViewer variant + per-job detail page

**Goal:** Teacher's per-submission detail page. Reuses Phase 5-3/5-5 components with a `readOnly` mode.

**Files touched:**
- `src/components/fabrication/ScanResultsViewer.tsx` (add `readOnly` prop — disables radios, hides Submit/Re-upload)
- `src/components/fabrication/RuleCard.tsx` (respect readOnly — `onAcknowledge` no-op)
- `src/app/teacher/preflight/jobs/[jobId]/page.tsx` (NEW)
- Tests: +2 on the readOnly behaviour

**Page layout (spec §9):**
- Header: student name + class + machine + submitted-at
- Scan Results viewer (readOnly) — 3 buckets + acks (teacher sees student's radio choices)
- Revision History panel — reuse Phase 5-5, current revision highlighted
- Teacher Notes — shows `teacher_review_note` if set, editable via Add note action
- Action bar: Approve / Return for revision / Reject (w/ note modal)

**Commit:** `feat(preflight): Phase 6-2 per-job detail page + read-only viewer variant`

**Est:** ~0.5 day

---

### 6-3 — Queue page with status tabs

**Goal:** `/teacher/preflight` queue — the landing page teachers hit from the sidebar.

**Files touched:**
- `src/app/teacher/preflight/page.tsx` (rewrite — kill the redirect from 1B-2, render queue)
- `src/components/fabrication/TeacherQueueTable.tsx` (NEW — table rendering QueueRow[])
- `src/components/fabrication/TeacherQueueTabs.tsx` (NEW — status-tab switcher w/ counts)
- Tests: status-tab state logic, pure row-label helpers

**Features:**
- Status tab bar with per-tab count (e.g., "Pending approval (7)")
- Inline row actions: View · Approve · Return for revision (each opens a modal OR deep-links to detail page — §10 decides)
- Click row → detail page (6-2)
- Sort: oldest-first by default; "Time waiting" column shows relative
- Empty state per tab ("No pending submissions" / "Nothing completed yet" / etc.)

**Commit:** `feat(preflight): Phase 6-3 teacher queue page with status tabs`

**Est:** ~0.4 day

---

### 6-4 — Per-student + per-class fabrication history tabs

**Goal:** Add a "Fabrication" tab to the existing student profile page + class page.

**Files touched:**
- `src/app/teacher/students/[studentId]/page.tsx` (extend tabs from overview/discovery → overview/discovery/fabrication)
- `src/app/teacher/classes/[classId]/page.tsx` (add fabrication section)
- `src/components/fabrication/StudentFabricationHistory.tsx` (NEW — list + pass-rate + top-failure-rule)
- `src/app/api/teacher/fabrication/students/[studentId]/history/route.ts` (NEW)
- Tests

**Student-view metrics (spec §9):**
- Total submissions
- Pass rate % (jobs reaching `approved`/`completed` / total jobs)
- Most common failure rule (top BLOCK or WARN across all revisions)
- Revision count distribution (N-revision jobs — "this student averages 2.3 revisions")

**Class-view metrics:**
- Same but aggregated across class
- Per-student drill-down list

**Commit:** `feat(preflight): Phase 6-4 student + class fabrication history tabs`

**Est:** ~0.4 day

---

### 6-5 — Student-side "needs_revision" UI + teacher-note display

**Goal:** Close the loop — when teacher clicks "Return for revision", the student sees it on their own status page with the teacher's note.

**Files touched:**
- `src/components/fabrication/ScanResultsViewer.tsx` (extend — new amber card for `needs_revision` status + `teacher_review_note` render)
- `src/app/(student)/fabrication/jobs/[jobId]/page.tsx` (thread `jobStatus` + `teacherNote` into the viewer)
- `src/lib/fabrication/orchestration.ts` — `getJobStatus` includes `teacher_review_note` + `teacher_reviewed_at` in the status payload
- Tests

**Student UX when `status = 'needs_revision'`:**
- Green/amber header: "Your teacher has asked for a revision"
- Teacher's note rendered as a card (preserved whitespace / markdown if we want — start plain text)
- Existing Re-upload modal + revision history below — student can iterate

**Commit:** `feat(preflight): Phase 6-5 needs_revision student view + teacher note`

**Est:** ~0.3 day

---

### 6-6 — Checkpoint 6.1 prod smoke + saveme

**Goal:** End-to-end teacher-approves-10+-submissions verification per spec §13 Matt Checkpoint 6.1. Draft the Checkpoint 6.1 report with `⏳` placeholders that Matt fills in.

**Prod smoke scenarios:**
1. **Happy path** — student submits via Phase 5 flow (laser, `requires_teacher_approval=true`) → appears in teacher queue under "Pending approval" → teacher clicks Approve → row moves to "Approved / queued" tab → student's submitted page reflects `approved` status.
2. **Return for revision** — student submits → teacher clicks "Return for revision" with a note → student's status page shows the teacher's note + re-upload CTA → student re-uploads → new revision appears in queue.
3. **Reject** — student submits intentionally bad file → teacher rejects → student's status page shows "Rejected" + teacher note.
4. **Per-student history** — teacher opens `/teacher/students/[studentId]` → clicks Fabrication tab → sees all submissions + pass rate.

**Checkpoint 6.1 report:** `docs/projects/preflight-phase-6-checkpoint-6-1.md` — 14-ish criterion matrix.

**Commit:** `feat(preflight): Phase 6-6 Checkpoint 6.1 — teacher triage end-to-end`

**Est:** ~0.4 day

---

## 4. Success criteria (Checkpoint 6.1)

- [ ] 4 teacher action endpoints (approve / return-for-revision / reject / note) validate ownership + transition status correctly. Tested.
- [ ] Queue endpoint paginates + filters by status + scopes to teacher's classes. Tested.
- [ ] `/teacher/preflight` renders status tabs with accurate counts + table rows with all required fields (student, machine, thumbnail, revision count, scan summary, time waiting).
- [ ] Click row → detail page with read-only ScanResultsViewer + revision history + action bar.
- [ ] Approve → student's submitted page reflects new status within one poll cycle.
- [ ] Return for revision (with note) → student's status page shows teacher's note + re-upload CTA → student re-uploads → new revision visible in teacher queue.
- [ ] Reject → student's status page shows rejected state (no re-upload option).
- [ ] Student profile page (`/teacher/students/[studentId]`) has Fabrication tab showing pass rate + top failure rule + submission list.
- [ ] Class page (`/teacher/classes/[classId]`) has Fabrication section with aggregate metrics.
- [ ] `ScanResultsViewer` `readOnly` mode: no radios interactive, no Submit/Re-upload buttons, bucket rendering unchanged.
- [ ] Prod smoke: all 4 scenarios run end-to-end as Matt (teacher) + Matt Burton / test (student).
- [ ] `npm test`: +N tests (target ~60–80 — 5 routes + orchestration lib + viewer readOnly).
- [ ] `docs/projects/WIRING.yaml` + dashboard + ALL-PROJECTS.md updated.
- [ ] Checkpoint 6.1 report doc filed.

---

## 5. Stop triggers (halt, report, wait for Matt)

1. **`fabrication_jobs.class_id` is NULL on some rows after Phase 4.** The teacher visibility scope uses `teacher_id` primarily but `verifyTeacherOwnsClass` is belt-and-braces. If rows have class_id but drifted teacher_id from class, ownership might fail weirdly. Audit for consistency at 6-1 open.
2. **Teacher auth uses Supabase Auth session, NOT `getUser()` directly inside API routes.** If any new route bypasses `requireTeacherAuth` and uses `supabase.auth.getUser()` inline (a copy-paste pattern that predates the auth helper), stop and refactor. Lesson #4 + #9 have both recurred.
3. **`teacher_review_note` is a single TEXT field, not a thread.** If the design-review decides multiple notes per review history are needed, stop — that needs a new table + migration (Phase 9 followup). Phase 6 ships single-note v1.
4. **Queue endpoint performance on 100+ rows.** The signed-URL mint per row (thumbnail_path) is a round-trip per row. Test with pagination (offset/limit) before declaring queue done. If signed-URL mint is too slow, defer thumbnails to an on-hover lazy fetch — file as `PH6-FU-QUEUE-THUMB-LAZY` P2.
5. **Real-time push vs poll.** Queue page is currently polled by the teacher's browser (or manual refresh). Supabase Realtime could push updates when a student submits. Not worth doing in Phase 6 — document as `PH6-FU-QUEUE-REALTIME` P3 and leave teachers on manual refresh. Revisit post-pilot.
6. **Race: teacher approves while student re-uploads.** Student creates Rev N+1 at T1; teacher clicks Approve at T2 on the Rev N view. Approve transitions status to `approved`, but Rev N+1's scan_job is still pending. Does approving "freeze" the revision or does Rev N+1 still scan + land? Spec is silent. Recommend: submit endpoint (Phase 5-1) already guards against submitting a job with active revisions needing ack; teacher approve should NOT freeze future revisions — teacher can approve Rev N, student's re-upload creates Rev N+1 which has its own scan, teacher sees the new one in queue. Flag for decision if unclear.

---

## 6. Don't stop for

- Exact table pagination UX — ship server-side limit/offset, client rendering default 50 rows.
- Rich teacher-note markdown — plain text v1, markdown / rich text Phase 9.
- Drill-down from class/student fabrication tab to individual jobs — just a link per row; full detail lives in `/teacher/preflight/jobs/[jobId]`.
- Email to student on teacher action — Resend helper exists (Phase 1B-2), wire in Phase 9 or as follow-up.
- Mobile layout for teacher queue — school laptops are the target; mobile polish in Phase 9.
- Bulk actions ("approve 10 at once") — Phase 9.

---

## 7. Out of scope (deferred)

| Item | Defer to |
|---|---|
| Full machine-profile CRUD admin UI | Phase 8 |
| `requires_teacher_approval` toggle UI per machine | Phase 8 (one-off SQL flip pre-pilot) |
| Lab Tech / Fabricator pickup UI | Phase 7 |
| Class-level rule-failure heatmap + utilisation | Phase 9 |
| Audit log of teacher reviews (note history) | Phase 9 |
| Teacher email notifications on new submission | `PH6-FU-TEACHER-EMAIL` P3 |
| Queue Realtime pushes | `PH6-FU-QUEUE-REALTIME` P3 |
| Bulk teacher actions | Phase 9 |
| Export / reporting | Phase 9 |

---

## 8. Lessons to re-read (every sub-phase)

- **#3 Client components can't import server-only modules** — `createAdminClient` stays server-side. Teacher pages are mostly client components fetching via API.
- **#4 Student auth uses token sessions, NOT Supabase Auth** — teachers ARE Supabase Auth users. Use `requireTeacherAuth`, not `requireStudentAuth`. Recurring bug pattern — Lessons #4 + #9.
- **#9 Student-facing components must use student auth routes** — and symmetrically, teacher-facing must use teacher auth. No cross-pollination.
- **#11 Vercel CDN strips Set-Cookie from Cache-Control:public** — every new route sets `private, no-cache, no-store, must-revalidate`.
- **#38 Verify = assert expected values, not just non-null** — status transition tests assert exact new status value; error tests assert specific 403/404/409 codes + message text.
- **#39 For pattern bugs, audit all similar sites and fix in the same phase** — if the queue endpoint has an N+1 query (fetch jobs → for each, fetch student + class + machine), audit the student-side status endpoint for similar.
- **#45 Surgical changes** — don't refactor `ScanResultsViewer` into a mega-component; add a `readOnly` prop.
- **#52 REVOKE FROM PUBLIC, anon, authenticated** — Phase 6 doesn't add RPCs but if one lands, revoke all three.
- **#53 Denormalised columns need explicit writes; JSONB doesn't fan out** — teacher action endpoints update `status` + `teacher_reviewed_*` fields — all columns, all explicit.
- **Route-group URL discipline** (PH4-FINDING-01) — teacher routes are NOT under `(student)`. `/teacher/preflight` lives at `src/app/teacher/preflight/page.tsx` (no parens group needed; `teacher/` is the URL segment).
- **Test-file JSX import discipline** — pure helpers in `.ts` siblings.

---

## 9. Execution note

- All commits on `preflight-active` branch. Push after each clean sub-phase.
- **Sub-phase 6-0 (PH5-FU-REUPLOAD-POLL-STUCK fix) should land FIRST** so return-for-revision → re-upload flow doesn't hit the hard-refresh UX during Checkpoint 6.1 smoke.
- After 6-6 Checkpoint passes: saveme, update ALL-PROJECTS.md / CLAUDE.md / WIRING.yaml / dashboard.html, file the Checkpoint 6.1 report, then merge preflight-active → main for deploy.
- Next phase on Matt's desk after 6.1 sign-off: **Phase 7 (Lab Tech Pickup + Completion)**. Brief drafted on phase open.

---

## 10. Open questions for Matt before 6-1 opens

1. **Route naming** — spec says `/teacher/fabrication` but Phase 1B-2 shipped `/teacher/preflight/*`. Stick with `/teacher/preflight` (existing, consistent with Fabricator admin) or split (`/teacher/fabrication` = queue, `/teacher/preflight/fabricators` = fabricator admin)? **Recommendation: stay with `/teacher/preflight` — `/teacher/preflight/jobs/[jobId]` for detail, `/teacher/preflight/fabricators` stays as-is.**
2. **"Return for revision" vs "Reject" semantics** — both push the submission back. Return = "fix this and resubmit, keeps the job alive". Reject = "no, this submission won't happen". Student UX differs:
   - Return: amber card + teacher note + Re-upload CTA (goes to Rev N+1)
   - Reject: red card, read-only, "Start a fresh submission" link to `/fabrication/new`
   **Recommendation: both ship in Phase 6 with the semantics above. Reject is rarer but needed for safety-flagged content (weapon STLs) or plagiarism etc.**
3. **Teacher-note single field vs thread** — `teacher_review_note` is a single TEXT column in migration 095. V1 ships single-field (overwritten on each action). A history/thread needs a new table. Ship v1 as-is, file `PH6-FU-NOTE-HISTORY` P3 for post-pilot?
4. **Teacher email on new submission** — every time a student submits, email the teacher? Opt-in per teacher? No email by default? **Recommendation: no email in Phase 6, file `PH6-FU-TEACHER-EMAIL` P3. Teacher checks queue when they're ready to triage. Email can be added when real-world use shows the pain.**
5. **Approve flow — does teacher need to see the scan results first?** Options:
   - A (cheap): Approve button on the queue row, no detail page view required → fastest triage
   - B (safer): Approve button only on the detail page → forces the teacher to look at the rules before approving
   **Recommendation: ship both. Row-level Approve for already-seen submissions, detail-page Approve for new ones. Queue can indicate which rows the teacher has already viewed (e.g., clicked through to detail at least once).**
6. **Class-level fabrication tab in Phase 6 vs deferred** — spec §9 lists it under teacher UX but Phase 6 scope is tight. Include (6-4) or defer to Phase 9 polish?
7. **Class_id NULL handling** — some jobs might have NULL class_id (if a student uploads without a class context — but Phase 4-1 always sets class_id). Defensive: teachers see their own jobs by `teacher_id` regardless of class_id. Confirm this scope is correct.
8. **`requires_teacher_approval` seed flip** — Phase 5 §10 decision 6 said "flip lasers to true via one-off SQL". Has this been run? If not, Phase 6's whole reason to exist (teacher-approves-pending submissions) won't have data to show unless the seed is flipped OR a teacher-owned machine has the flag set. Matt should run the SQL before Checkpoint 6.1 smoke.

Answer inline before opening 6-1 (or 6-0 if you want the PH5 reupload fix first).
