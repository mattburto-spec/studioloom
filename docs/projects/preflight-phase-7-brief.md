# Preflight Phase 7 — Lab Tech Pickup + Completion

**Status:** DRAFT — 9 open questions pending Matt sign-off (§11). First sub-phase (7-1) opens after decisions locked.
**Date drafted:** 23 April 2026 PM
**Spec source:** `docs/projects/fabrication-pipeline.md` §10 (Lab Tech UX), §13 Phase 7
**Predecessor:** Phase 6 SHIPPED + Checkpoint 6.1 PASSED all 4 scenarios (main HEAD `5a3b801`).
**Blocks:** Full pilot — this phase closes the loop (student → scan → teacher approve → **lab tech picks up + runs + marks done**). Without Phase 7, approved jobs accumulate in the DB with no way for the lab tech to act.
**Estimated duration:** ~1–2 days (5 sub-phases, each gated, separate commits).
**Worktree:** `/Users/matt/CWORK/questerra-preflight`, branch `preflight-active`.

---

## 1. What this phase ships

The first lab-tech-facing Preflight surface. Phase 1B-2 stubbed `/fab/queue` as a "you're signed in" placeholder — this phase replaces the stub with a real queue + pickup + completion workflow. Fabricator (lab tech) auth already ships (Argon2id + opaque session tokens + `/fab/login` + `/fab/set-password` from Phase 1A-5).

**Ships:**

1. **Per-machine queue page** `/fab/queue` — replaces the placeholder. Shows approved jobs filtered by the fabricator's machine assignments (`fabricator_machines` junction from migration 097). Row per job: student name, class, unit (if linked), filename, thumbnail, approved-at time, file size. Two tabs: `Ready to pick up` (status=approved) and `In progress` (status=picked_up, this fabricator only). Sorted oldest-approved first so the earliest waiters run first (FIFO lab etiquette).
2. **Per-job detail page** `/fab/jobs/[jobId]` — teacher note (if any) + read-only scan summary (no radios, just the severity counts + teacher's review comment) + machine name + file metadata + prominent **Download + Start** button. Optional: "Mark failed" before running (file doesn't open, damaged upload) with a required note.
3. **Download handler** `GET /api/fab/jobs/[jobId]/download` — streams the file from Supabase Storage with `Content-Disposition: attachment; filename="{student}-{class}-{unit}.{ext}"` using the Phase 6-6k `buildFabricationDownloadFilename()` helper. Marks `status` → `picked_up` + writes `lab_tech_picked_up_by` + `lab_tech_picked_up_at` in the same round-trip (idempotent on repeat — second download returns the file again without re-writing status, so lab techs can re-download if they close the browser).
4. **Completion actions** — 3 new API routes:
   - `POST /api/fab/jobs/[jobId]/start` — optional explicit "I'm starting the print now" transition. Writes `printing_started_at` but keeps status=picked_up. Useful for load-time analytics later. v1 optional — can skip the button if lab tech just wants to download-and-go.
   - `POST /api/fab/jobs/[jobId]/complete` — transitions `picked_up` → `completed`. Writes `completion_status='printed'|'cut'` (derived from `machine_category`), `completion_note?`, `completed_at`.
   - `POST /api/fab/jobs/[jobId]/fail` — transitions `picked_up` → `completed` with `completion_status='failed'`, requires `completion_note` (student + teacher need to know WHY: "warped off the bed", "laser didn't cut through"). Note propagates to student's status page as a red card.
5. **Fabricator queue orchestration** — new `listFabricatorQueue(db, { fabricatorId, tab })` in a new `src/lib/fabrication/fab-orchestration.ts`. Returns rows joined with student + class + unit + machine + thumbnail signed URL, scoped by `fabrication_jobs.machine_profile_id IN (fabricator's assigned machines)`. Tab filter: `ready` (status=approved) or `in_progress` (status=picked_up + picked_up_by = this fabricator). No cross-fabricator visibility of in-progress jobs (privacy — a lab tech shouldn't see what another lab tech picked up).
6. **Student-side completion visibility** — when `status='completed'` + `completion_status='printed'|'cut'`, student's `/fabrication/jobs/[jobId]` renders a green "Your file is ready to collect" card with timestamp + optional note. When `completion_status='failed'`, renders a red "The lab tech couldn't run this" card with the required note + "Start a fresh submission →" CTA. Extends the Phase 6-5 `TeacherReviewNoteCard` pattern (new `LabTechCompletionCard` component, similar shape).
7. **Optional pickup notification email** — when status → `picked_up`, fire the Resend helper (Phase 1B-2) to the student's opt-in email (`students.fabrication_notify_email`). Body: "Your file was picked up by [lab tech]. You'll get another email when it's done." Idempotent via the existing `notifications_sent` JSONB tracker (migration 098). Gated behind the existing student opt-out. Decision flag below — could be deferred to Phase 8 if we want to keep Phase 7 tight.

## 2. Infrastructure

**No new migrations.** Every column Phase 7 writes already exists:
- `fabrication_jobs.lab_tech_picked_up_by` / `lab_tech_picked_up_at` / `completion_status` / `completion_note` / `completed_at` — migration 095 (initial `fabrication_jobs` table)
- `fabrication_jobs.printing_started_at` / `notifications_sent` — migration 098
- `fabricator_machines` junction — migration 097

**No new storage buckets.** Files are already in `fabrication-uploads` (migration 102, service-role RLS). Phase 7 just reads from it with a fresh signed URL OR streams bytes through the route handler (see open question §11 Q3).

**New npm tests target:** ~40–60 (orchestration + 4 route tests + 1 completion-card component helper).

## 3. Sub-phase split (5 instruction blocks)

### 7-1 — Fab orchestration lib + queue endpoint

**Goal:** Backend only. Pure logic, no UI.

**Files:**
- `src/lib/fabrication/fab-orchestration.ts` (NEW) — `listFabricatorQueue`, `getFabJobDetail`, `pickupJob`, `markComplete`, `markFailed`. `loadFabricatorAssignedJob` ownership helper (analog of `loadTeacherOwnedJob`). Share `OrchestrationError` / `isOrchestrationError` from student-side orchestration.ts.
- `src/lib/fabrication/__tests__/fab-orchestration.test.ts` (NEW) — pure unit coverage for all five functions across happy + 404 (not-owned / machine-not-assigned) + 409 (bad-status transition) paths.

**Key design decision:** ownership check = `fabrication_jobs.machine_profile_id IN (fabricator's assigned machines)`. NOT by teacher_id, NOT by class_id. Cross-teacher by design (Phase 6 §10 Q5 decision).

**Commit:** `feat(preflight): Phase 7-1 fab orchestration lib`. **Est:** ~0.3 day.

### 7-2 — 4 fab action routes + download handler

**Goal:** API surface. 5 routes total.

**Files:**
- `src/app/api/fab/jobs/[jobId]/download/route.ts` (NEW) — GET. Marks picked_up on first call, streams file on every call. Content-Disposition header with `buildFabricationDownloadFilename()`.
- `src/app/api/fab/jobs/[jobId]/start/route.ts` (NEW) — POST. Writes `printing_started_at`.
- `src/app/api/fab/jobs/[jobId]/complete/route.ts` (NEW) — POST. Body: `{ completion_note?: string }`. Derives `completion_status` from machine category.
- `src/app/api/fab/jobs/[jobId]/fail/route.ts` (NEW) — POST. Body: `{ completion_note: string }` (required).
- `src/app/api/fab/queue/route.ts` (NEW) — GET with `?tab=ready|in_progress`.
- `src/app/api/fab/jobs/[jobId]/route.ts` (NEW) — GET detail.
- Tests for each route: 401 (no session) + 404 (not-assigned machine) + 409 (bad status) + 200 success path.

**Auth:** every route calls `requireFabricatorAuth(request)` from `src/lib/fab/auth.ts` (already ships). Cache headers: `private, no-store` per Lesson #11.

**Commit:** `feat(preflight): Phase 7-2 fab action + queue + download endpoints`. **Est:** ~0.4 day.

### 7-3 — Fabricator queue page UI

**Goal:** Real `/fab/queue` replacing the Phase 1B-2 placeholder.

**Files:**
- `src/app/fab/queue/page.tsx` (REWRITE) — 2-tab layout (`Ready to pick up` / `In progress`), row list with per-job card, click row → `/fab/jobs/[jobId]`. Dark-theme continues (fab surface is slate-*, differentiates from the teacher/student surfaces which are bg-gray-50). Same 2-col pattern optional if it matches the lab-tech workflow; probably a single scroll list is fine here since lab techs act on one job at a time.
- `src/app/fab/layout.tsx` — may need a minimal top nav (currently blank). Sign-out link + fabricator name.
- Fabricator queue tests: helper for tab state, row formatter.

**Commit:** `feat(preflight): Phase 7-3 fabricator queue page`. **Est:** ~0.3 day.

### 7-4 — Fabricator detail page + completion actions UI

**Goal:** `/fab/jobs/[jobId]` page — the one place the lab tech does everything: downloads, marks failed pre-run, starts, completes, fails post-run.

**Files:**
- `src/app/fab/jobs/[jobId]/page.tsx` (NEW) — header: student name · class · unit · machine · approved-at. Body: read-only scan summary (severity counts only, not the full 3-bucket viewer — lab tech doesn't care about individual rules, that's the teacher's concern), teacher's note (if any), optional pickup-blocking flags. Actions: Download + Start (primary purple), Mark Failed (red outline), Mark Complete (green) after pickup.
- `src/components/fabrication/LabTechActionBar.tsx` (NEW) — completion + fail buttons with note modal (reuse the canned-notes chip pattern from 6-6l — file `PH7-FU-FABRICATOR-CANNED-NOTES` P3 for curated fail reasons like "warped", "stringing", "didn't cut through").
- `src/components/fabrication/LabTechCompletionCard.tsx` (NEW) — **student-side** green/red result card. Green: "Your file is ready to collect — completed [date/time]". Red: "Couldn't run this one — [note] — Start a fresh submission →".
- Tests: orchestration + component helper.

**Commit:** `feat(preflight): Phase 7-4 fabricator detail page + completion UI`. **Est:** ~0.4 day.

### 7-5 — Student-side completion visibility + Checkpoint 7.1 prod smoke + saveme

**Goal:** Thread completion state through to the student status page. Run the end-to-end smoke. Close the checkpoint.

**Files:**
- `src/app/(student)/fabrication/jobs/[jobId]/page.tsx` — render `<LabTechCompletionCard>` when status=completed. Hide scan viewer (same pattern as rejected).
- `src/lib/fabrication/orchestration.ts` — `getJobStatus` returns `completionStatus`, `completionNote`, `completedAt` in the `?include=results` payload (student page consumes them).
- `docs/projects/preflight-phase-7-checkpoint-7-1.md` (NEW) — report template with ⏳ placeholders, 12-criterion matrix, 3 smoke scenarios.
- Tests: status endpoint payload shape + LabTechCompletionCard helper.

**Smoke scenarios:**

1. **Happy path (print)** — student submits STL to Bambu X1C, teacher approves, fabricator downloads + marks Complete → student sees "ready to collect" card.
2. **Failed run** — fabricator marks Failed with note ("Warped off the bed after layer 3"), student sees red card + note + Start Fresh link.
3. **Two fabricators race** — if Matt has 2 fabricator accounts to test with, verify the DB-level status guard rejects the second pickup with 409. Optional if only one fabricator exists.

**Pre-smoke checklist:** Matt creates a Fabricator account via `/teacher/preflight/fabricators` → Invite. Assigns the Fabricator to the STL + laser-cutter machines used by his `test` student.

**Commit:** `feat(preflight): Phase 7-5 student completion view + Checkpoint 7.1 report`. **Est:** ~0.4 day.

## 4. Success criteria (Checkpoint 7.1)

- [ ] `listFabricatorQueue` scopes by `machine_profile_id IN (fabricator_machines)` — no cross-fabricator leakage. Tested.
- [ ] Pickup action atomic: status transition + `lab_tech_picked_up_by` + `lab_tech_picked_up_at` all written in the same update. Idempotent on re-download.
- [ ] Download handler streams file with correct `Content-Disposition: attachment; filename="..."` using the 6-6k helper. Verified against Chrome + Safari.
- [ ] `/fab/queue` renders 2 tabs with accurate per-tab counts + row fields (student, class, unit, file, machine, approved time).
- [ ] Click row → `/fab/jobs/[jobId]` detail page with teacher note + scan summary + download/completion actions.
- [ ] Complete + Fail actions write `completion_status` + `completion_note` + `completed_at` correctly. Tested.
- [ ] Student `/fabrication/jobs/[jobId]` shows green "ready to collect" card on `completed + printed|cut`, red "couldn't run" card with note on `completed + failed`.
- [ ] `ScanResultsViewer` correctly hidden on `completed` + `failed` statuses (terminal, same pattern as `rejected`).
- [ ] Race condition: double-pickup attempt returns 409 on the second call. DB-level guard (UPDATE ... WHERE status='approved').
- [ ] Prod smoke: all 3 scenarios verified from Matt (teacher) + Matt Burton / test (student) + a real Fabricator account (new: Matt invites one for himself, or uses existing if one exists).
- [ ] `npm test`: +40–60 tests. Zero regressions.
- [ ] `docs/projects/WIRING.yaml` — new `fabricator-queue` system entry with deps + affects + change_impacts. Dashboard synced.
- [ ] ALL-PROJECTS.md + CLAUDE.md + changelog updated.

## 5. Stop triggers

- **Double-pickup race allows both writes.** If the DB guard fails (WHERE status='approved' + no row-level lock), both fabricators get the file. Stop and design a proper guard (likely `SELECT ... FOR UPDATE` in a transaction, or a unique conditional index on machine_profile_id+picked_up_by).
- **Download filename leaks PII via browser history.** If Content-Disposition is ignored by a particular browser + the signed URL ends with the raw `original_filename`, a student's unredacted name could end up in another user's browser history. Spec assumes we stream BYTES through the route handler (not a signed URL redirect) to keep the filename controlled. Verify on mobile Safari.
- **Student opt-out email bug.** If the optional Phase 7 pickup email fires to a student who opted out of fabrication notifications (`students.fabrication_notify_email = null`), stop. The existing helper respects opt-out but verify before shipping.
- **Completion note is empty on fail.** If the route accepts `fail` without a note, stop — students need to know WHY a run failed, empty notes are user-hostile.

## 6. Don't stop for

- Lab tech queue length > 50 (we're well below the 200-row cap; follow-up when a school hits it).
- Multi-select / batch download (Phase 8 or 9 polish — v1 one at a time).
- Integration with Cura / Bambu Studio / Lightburn (spec §15 explicitly defers to post-v1).
- Job priority reordering (FIFO is fine for pilot).

## 7. Out of scope (deferred)

| Item | Where it lands |
|------|----------------|
| Multi-job batch download (zip) | Phase 9 |
| Fabricator-to-teacher chat / escalation | Phase 9 |
| Printer pause / resume / live status | Never in v1 — requires machine integration |
| Job priority override | Phase 9 |
| Per-lab-tech completion analytics | Phase 9 |
| `PH7-FU-FABRICATOR-CANNED-NOTES` P3 | Post-pilot (like `PH6-FU-TEACHER-CANNED-NOTES-EDITABLE`) |
| Teacher visibility of which fabricator picked up | Phase 8 (simple: surface `lab_tech_picked_up_by.display_name` on the teacher detail page) |

## 8. Lessons to re-read (every sub-phase)

- **#4** — Fab auth uses token sessions, NOT Supabase Auth. Use `requireFabricatorAuth` from `src/lib/fab/auth.ts`. Never `supabase.auth.getUser()` in a /fab/* route.
- **#11** — Route handlers that set any mutable state must use `Cache-Control: private, no-store` — prevents Vercel CDN caching. Already the pattern on all teacher routes, enforce on fab routes too.
- **#24** — No new migrations in Phase 7, but the ownership check uses `IN (SELECT machine_profile_id FROM fabricator_machines WHERE fabricator_id = auth.fabricatorId)`. Verify that subquery returns rows in practice — an empty `fabricator_machines` table would silently return an empty queue (not obvious to the fabricator). Add a "no machines assigned yet" empty state that tells them to ask their teacher.
- **#29** — RLS on `fabrication_jobs` already filters by teacher_id. Fabricators hit the DB via service-role (createAdminClient), so RLS isn't relevant server-side — but verify no client-side query ever uses the anon key on these tables.
- **#38** — Tests assert expected values. When testing the pickup action, don't just assert `status` is truthy — assert it equals `'picked_up'` specifically, and that `lab_tech_picked_up_by` equals the fabricator's UUID.
- **#43–46** — Karpathy discipline. Surface assumptions, don't abstract prematurely, touch only what you must, verify against a goal.
- **#50** — Route handler (`route.ts`) and Page (`page.tsx`) can't coexist at the same path. `/api/fab/jobs/[jobId]/download` is a route handler; `/fab/jobs/[jobId]` is a page. Different parent folders — no conflict. Double-check.
- **#52** — REVOKE FROM PUBLIC, anon, authenticated. No new RPCs in Phase 7 but if one lands, revoke all three.
- **#53** — Denormalised columns need explicit writes. `lab_tech_picked_up_at` + `completion_status` + `completion_note` + `completed_at` are all explicit column writes, NOT a JSONB blob. Teacher queue summary reads these columns directly.

## 9. Execution note

Phase 7 is pure app — no migrations, no seeds, no scanner changes. All five sub-phases can land back-to-back on the same day. Checkpoint 7.1 smoke wants a real Fabricator account, which Matt can create in ~1 min via the existing `/teacher/preflight/fabricators` admin page (Phase 1B-2).

Main worktree stays reserved — all work on `preflight-active`, daily merges to main.

## 10. Wiring trace (upstream + downstream)

**Upstream (what feeds Phase 7):**
- `fabrication_jobs.status = 'approved'` rows produced by Phase 6-1 teacher approve action
- `fabricator_machines` junction populated via `/teacher/preflight/fabricators` admin page (Phase 1B-2)
- Fabricator auth sessions minted by `/fab/login` (Phase 1A-5)

**Downstream (what Phase 7 feeds):**
- Student `/fabrication/jobs/[jobId]` status page — new completion card (`LabTechCompletionCard`)
- Student `/fabrication` overview — rows with `completed` status pill (existing, no change)
- Teacher queue `/teacher/preflight?tab=completed` — rows moved here when fabricator marks done
- (Future) Student Work Pipeline / portfolio integration — tight coupling not required in v1

**Choke points (where Phase 7 code wires in):**
- `src/lib/fab/auth.ts` — single source of truth for fab auth. All 5 new routes call `requireFabricatorAuth`.
- `src/lib/fabrication/orchestration.ts` — `getJobStatus` needs `completionStatus` + `completionNote` + `completedAt` added to its `?include=results` payload shape. One line.
- `src/components/fabrication/` — new `LabTechActionBar.tsx` + `LabTechCompletionCard.tsx`. Parallel to existing `TeacherActionBar` + `TeacherReviewNoteCard`.

**WIRING.yaml updates required:**
- New system `fabricator-queue` (`/fab/queue` page + API surface + orchestration). Deps: `fabrication-jobs`, `fabricator-auth`. Affects: `student-job-status` (new completion card render), `teacher-preflight-queue` (rows move to completed tab).

## 11. Open questions (to resolve pre-build)

1. **Explicit "Start print" button?** Or download-and-go (skip `printing_started_at`)? Pro: separate timestamp = load-time analytics later. Con: extra button = friction. **Recommend: skip for v1.** `printing_started_at` stays NULL until Phase 9 analytics land.

2. **Pickup email to student?** Current `students.fabrication_notify_email` opt-out exists. Phase 1B-2 Resend helper exists. **Recommend: ship in Phase 7** (one-line invocation at the pickup callsite, Resend helper is already tested, student opt-out is already respected). Low cost, high value — students want to know "did the lab tech get my file?".

3. **Download = stream bytes through route handler, or signed-URL redirect?** Signed URL is lighter (no bandwidth through our serverless). BUT: filename comes from the URL path, not controlled by our server, so Content-Disposition rename doesn't work — browser saves `job-uuid/v1.stl` instead of `kai-10-design-coaster.svg`. **Recommend: stream bytes.** Auto-rename is explicitly why the 6-6k filename helper exists. Serverless bandwidth cost is negligible for small design files (~1–50 MB each).

4. **Idempotent pickup — what exactly is idempotent?** First download of a status=approved job → transition to picked_up + log. Subsequent downloads of the same jobId → should we log a second pickup event (audit trail)? **Recommend: no.** Single pickup-event per job is simpler and matches spec §10. If a re-download needs auditing later, Phase 9 adds a pickup_events table.

5. **Completion — printed / cut / failed. What about "partially completed" (3 copies on one plate, 2 worked 1 failed)?** **Recommend: no for v1.** One submission = one completion state. Multi-copy plates can be split into multiple submissions.

6. **Fail → what happens to the job?** Terminal (like rejected) — student must start fresh? Or return-for-revision-like (student can re-upload on the same jobId)? **Recommend: terminal.** Lab tech fail ≠ scan fail. Fresh submission is cleaner UX. Student gets red card + "Start a fresh submission →" link (same pattern as rejected).

7. **Retention — when do completed jobs disappear from fabricator queue?** Never auto-hide — teacher + fabricator keep seeing completed jobs in the "Completed" tab of each surface. **Recommend: never auto-hide in v1.** Add archive/hide in Phase 9 if teacher queue gets noisy.

8. **What if fabricator is UNASSIGNED from a machine mid-flight?** Lab tech downloaded a job for Machine X at 9am, picked_up. At 10am teacher revokes their Machine X assignment. At 11am they try to mark it complete. **Recommend: allow complete-on-own-picked-up regardless of current assignment** (edge case; if they already downloaded, they probably already ran it — let them log the outcome). 404 only on NEW pickups for unassigned machines.

9. **Lab tech visibility of teacher review note?** Teacher's `pending_approval` comments via `/note` endpoint don't land in `teacher_review_note` differently than approve/return/reject notes — it's one TEXT column. Fabricator CAN read this note (it's on the job row). **Recommend: surface it** — "Teacher's note: [note]" on the fab detail page so the lab tech sees any heads-up the teacher left.

---

## Decision prompt for Matt

Answer the 9 questions in §11. `recommend` is marked on each — typing `"all recommended"` accepts the defaults and moves us to 7-1 opening. Individual overrides: answer by number (e.g., `"2: no email in Phase 7"`, `"3: signed URL redirect"`).

Once locked, I'll flip Status to READY, open 7-1, and start implementing.
