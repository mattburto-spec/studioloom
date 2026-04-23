# Preflight Phase 6 — Checkpoint 6.1 Report

**Status:** ⏳ DRAFT — awaiting prod smoke sign-off
**Date signed off:** _(pending — fill in after smoke passes)_
**Signed off by:** _(pending)_
**Date drafted:** 23 April 2026 AM
**Brief:** [`preflight-phase-6-brief.md`](./preflight-phase-6-brief.md)
**Phase scope:** Teacher queue + approval — triage UI, 4 teacher actions, per-student/class fabrication history, student-side needs-revision view.
**Worktree:** `/Users/matt/CWORK/questerra-preflight`, branch `preflight-active`.

---

## Pre-smoke checklist (Matt runs these before Scenario 1)

1. **Merge / deploy** — push `preflight-active` ensures the branch is on origin (done through 6-5b). Deploy by merging to `main` OR run the smoke against the Vercel preview URL that builds from `preflight-active`.
2. **Requires-teacher-approval seed flip** — per §10 Q8 of the brief, run this SQL against prod Supabase once (idempotent — safe to re-run):
   ```sql
   UPDATE machine_profiles
   SET requires_teacher_approval = true
   WHERE is_system_template = true AND machine_category = 'laser_cutter';
   ```
   Verify the flip:
   ```sql
   SELECT name, machine_category, requires_teacher_approval
   FROM machine_profiles
   WHERE is_system_template = true
   ORDER BY machine_category, name;
   ```
   Without this, laser-cutter submissions auto-approve and no rows land in the teacher `Pending approval` tab — the queue has nothing to exercise.
3. **Teacher login** — Matt signs into `studioloom.org` as his teacher account. Has a class + students + access to machine profiles.
4. **Student login** — separate browser session (incognito / different browser) as the `test` student account used in Phase 5 smoke. Ideally has a second test student for per-class aggregation checks (Scenario 4).

---

## Success criteria — pass/fail matrix

Criteria transcribed from `preflight-phase-6-brief.md` §4.

| # | Criterion | Status | Evidence |
|---|---|:---:|---|
| 1 | 4 teacher action endpoints (approve / return-for-revision / reject / note) validate ownership + transition status correctly. Tested. | ⏳ | Phase 6-1 `9c6e58b` — all 4 routes ship with payload-shape + auth + ownership + status-transition tests. Route tests: approve (`approve/__tests__`), return-for-revision, reject, note. Orchestration lib: `approveJob`, `returnForRevision`, `rejectJob`, `setTeacherReviewNote` all behind the single `loadTeacherOwnedJob` 404-for-not-yours pattern. Prod: **⏳ verify via Scenarios 1–3 below.** |
| 2 | Queue endpoint paginates + filters by status + scopes to teacher's classes. Tested. | ⏳ | Phase 6-1 `9c6e58b` — `GET /api/teacher/fabrication/queue` route with `?status=`, `?limit=`, `?offset=` params. Scoped by `fabrication_jobs.teacher_id = requireTeacherAuth()`. Route tests cover unknown status → 400, multi-status filter, pagination caps. Prod: **⏳ verify via Scenario 1 queue-view step.** |
| 3 | `/teacher/preflight` renders status tabs with accurate counts + table rows with all required fields (student, machine, thumbnail, revision count, scan summary, time waiting). | ⏳ | Phase 6-3 `800d22e` — `TeacherQueueTabs` + `TeacherQueueTable` components. Single-fetch + client-side bucketing for tab counts (capped at 200 rows). 20 helper tests cover tab bucketing, count aggregation, revision flag at 3+, URL param parsing. Prod: **⏳ visually verify all 5 tabs + all required row fields during Scenario 1.** |
| 4 | Click row → detail page with read-only ScanResultsViewer + revision history + action bar. | ⏳ | Phase 6-2 `e256e58` — `/teacher/preflight/jobs/[jobId]` client page fetches `getTeacherJobDetail` and wires `ScanResultsViewer readOnly` + `RevisionHistoryPanel` + `TeacherActionBar`. Detail route tests: 5 (401, ownership, payload shape, 404 mapping, cache headers). Prod: **⏳ verify during Scenario 1.** |
| 5 | Approve → student's submitted page reflects new status within one poll cycle. | ⏳ | Phase 6-1 + 6-5 — teacher approve writes `status='approved'`, `teacher_reviewed_by`, `teacher_reviewed_at`. Student status page polls every 2s with `?include=results=true` and picks up `jobStatus` change. `TeacherReviewNoteCard` renders green "Submission approved" card. Prod: **⏳ verify during Scenario 1.** |
| 6 | Return for revision (with note) → student's status page shows teacher's note + re-upload CTA → student re-uploads → new revision visible in teacher queue. | ⏳ | Phase 6-5 `0f2dda6` + PH5-FU-REUPLOAD-POLL-STUCK fix `503b49e`. Return-for-revision transitions `pending_approval → needs_revision`, writes note. Student page renders amber `TeacherReviewNoteCard` above the (still-interactive) viewer. ReuploadModal flow validated post-reorder (resetPoll before fetchRevisions) — no flash-of-idle, no hard-refresh required. New revision shows up in teacher queue under "Pending approval" (after new scan completes + student re-submits). Prod: **⏳ verify during Scenario 2 — THE critical end-to-end scenario that also validates PH5-FU-REUPLOAD-POLL-STUCK is truly closed.** |
| 7 | Reject → student's status page shows rejected state (no re-upload option). | ⏳ | Phase 6-5 `0f2dda6` — transition `pending_approval → rejected`. Student page renders red `TeacherReviewNoteCard` + "Start a fresh submission →" link. `ScanResultsViewer` is NOT rendered on rejected (terminal from student POV). Prod: **⏳ verify during Scenario 3.** |
| 8 | Student profile page (`/teacher/students/[studentId]`) has Fabrication tab showing pass rate + top failure rule + submission list. | ⏳ | Phase 6-4 `7971be7` — new `"🛠️ Fabrication"` tab alongside Overview + Discovery. `StudentFabricationHistory` renders 4-metric card strip + chronological job list. 5 API route tests + 23 aggregation-helper tests. Pass rate = approved + picked_up + completed. Prod: **⏳ verify during Scenario 4 — need at least 3–4 completed submissions so metrics are meaningful.** |
| 9 | Class page (`/teacher/classes/[classId]`) has Fabrication section with aggregate metrics. | ⏳ | Phase 6-4 `7971be7` — collapsible `ClassFabricationHistorySection` mounted at end of class detail page. Lazy-fetches on first expand. Same 4-metric strip + per-student drill-down table (colour-coded pass rate) + chronological job list with student column. Route + 5 tests. Prod: **⏳ verify during Scenario 4.** |
| 10 | `ScanResultsViewer` `readOnly` mode: no radios interactive, no Submit/Re-upload buttons, bucket rendering unchanged. | ⏳ | Phase 6-2 `e256e58` — `readOnly` prop added. RuleCard respects readOnly (radios visible showing student's choices but `disabled` via fieldset + onChange no-op). Empty-state copy flips "ready to submit" → "student saw no issues". +2 unit tests on the readOnly flip. Prod: **⏳ verify during Scenario 1 detail-page click-through.** |
| 11 | Prod smoke: all 4 scenarios run end-to-end as Matt (teacher) + `test` (student). | ⏳ | **⏳ Full smoke pending — see Scenarios 1–4 below.** |
| 12 | `npm test`: +N tests (target ~60–80). | ✅ | **1668 → 1811 (+143 tests across Phase 6).** Breakdown: 6-0 +7 reducer auto-unfreeze; 6-1 +X teacher actions + queue route tests; 6-2 +5 detail route + 2 readOnly viewer; 6-3 +20 queue-helpers; 6-4 +23 history-helpers + 10 route tests (5+5); 6-5 +11 review-note-helpers; 6-5b +2 reset-before-poll sequence. Exceeds target. |
| 13 | `docs/projects/WIRING.yaml` + dashboard + ALL-PROJECTS.md updated (saveme). | ⏳ | **⏳ Saveme runs after smoke signs off.** Dashboard card: Phase 5 → Phase 6 SHIPPED, progress 80 → 100. ALL-PROJECTS.md status line bumped. WIRING.yaml: teacher-fabrication systems added. |
| 14 | Checkpoint 6.1 report doc filed. | ✅ | This document. |

**Overall:** ⏳ **_/14 PASS** _(tally after smoke)._ Code + tests + tsc clean on every sub-phase commit. 1811 tests passing (Phase 6: 1668 → 1811, +143 across 8 commits).

---

## Commits in Phase 6

```
503b49e fix(preflight): PH5-FU-REUPLOAD-POLL-STUCK — reset before revision fetch
0f2dda6 feat(preflight): Phase 6-5 needs_revision student view + teacher note
7971be7 feat(preflight): Phase 6-4 student + class fabrication history tabs
800d22e feat(preflight): Phase 6-3 teacher queue page with status tabs
e256e58 feat(preflight): Phase 6-2 teacher detail page + read-only viewer
9c6e58b feat(preflight): Phase 6-1 teacher action + queue endpoints
ab709ef fix(preflight): Phase 6-0 reducer auto-unfreeze on revision bump
628feb7 docs(preflight): Phase 6 brief — Teacher Queue + Approval (DRAFT, 8 open questions)
dc7f738 docs(preflight): Phase 6 brief READY (all 8 open questions resolved)
```

9 commits on `preflight-active` branch. All pushed to `origin/preflight-active`.

**Migrations:** none. Phase 6 is pure application + UI — the columns it reads (`teacher_review_note`, `teacher_reviewed_at`, `requires_teacher_approval`) all landed in migrations 096–099 during Phase 1B-2.

---

## Production smoke scenarios (Matt runs — paste results here)

All scenarios use:
- **Teacher:** Matt's primary teacher account on `studioloom.org`
- **Student:** `test` student (same account as Phase 5 smoke, UUID `f24ff3a8-65dc-4b87-9148-7cb603b1654a`, class `7c534538-c047-4753-b250-d0bd082c8131`)
- **Deployment:** either `main` post-merge OR Vercel preview URL built from `preflight-active`

---

### Scenario 1 — Happy path (approve)

**Setup:** Student submits a laser-cut file that hits `pending_approval` (laser machine profile + seed flip from pre-smoke step 2 in place).

1. **Student** — Navigate to `/fabrication/new`, pick a laser-cutter profile, upload a known-good SVG (e.g. `coaster-flower-percent-width.svg` — has WARNs but they're ackable).
2. **Student** — Scan completes, ack the WARNs, click Submit.
3. **Student** — Redirects to `/fabrication/submitted/[jobId]`. Submitted page should render "Submitted — waiting for your teacher to review" (because `requires_teacher_approval=true` now).
4. **Teacher** — Open `/teacher/preflight` (or click "Preflight" sidebar link if wired). Verify:
   - `Pending approval` tab count is ≥ 1.
   - Active tab is `Pending approval` by default.
   - Row shows: student name, class, unit title (if linked), machine label + category, revision 1, rule-count pill, "just now" / "Nm ago" waiting time, thumbnail.
5. **Teacher** — Click the row. Detail page at `/teacher/preflight/jobs/[jobId]` loads with:
   - Header: student name + class + machine + filename + revision + submitted time + status pill.
   - `ScanResultsViewer` in read-only mode: rule buckets visible, student's acks shown (radios disabled), NO Submit / Re-upload buttons.
   - Revision history panel (single entry for Rev 1).
   - `TeacherActionBar` with Approve / Return for revision / Reject / Save note.
6. **Teacher** — Click Approve (optional note: "Looks good, approved for cutting."). Button shows spinner → success toast → page re-fetches detail → status pill flips to `approved`.
7. **Teacher** — Navigate back to `/teacher/preflight`. Row has moved from `Pending approval` tab to `Approved / queued` tab.
8. **Student** — Navigate back to `/fabrication/jobs/[jobId]` (or refresh `/fabrication/submitted/[jobId]`). Header should now say "Submission approved". Green `TeacherReviewNoteCard` shows teacher's note if provided + "reviewed Nm ago" footer. `ScanResultsViewer` renders read-only (no submit/re-upload).

**Expected:** Teacher triage end-to-end works for a single submission. Queue counts stay accurate across tabs.

**Result:** ⏳ _(fill in jobId + observations after smoke)_

---

### Scenario 2 — Return for revision (THE critical scenario)

**Setup:** Student submits (either a fresh submission or reuse the approved one from Scenario 1 if you want to test the "already-approved rejected for transition" flow — but cleaner to use fresh).

1. **Student** — Submit a laser-cut file that reaches `pending_approval`.
2. **Teacher** — Open the queue, click the row to go to detail page.
3. **Teacher** — In `TeacherActionBar`, select "Return for revision". Enter a note: `"The cut spacing is too tight for the 0.2mm kerf. Widen to 0.5mm and re-upload."`
4. **Teacher** — Click the Return button. Detail page re-fetches, status pill now `needs revision`.
5. **Teacher** — Back on `/teacher/preflight`, row has moved to `Revisions in progress` tab.
6. **Student** — Navigate back to `/fabrication/jobs/[jobId]`. Verify:
   - Header says "Revision requested".
   - Amber `TeacherReviewNoteCard` at the top with teacher's note rendered in a white sub-card. "reviewed Nm ago" footer.
   - `ScanResultsViewer` is still visible and INTERACTIVE (radios work, re-upload button enabled).
7. **Student** — Click "Re-upload a fixed version". Modal opens. Drop a new version of the file.
8. **Student** — Modal closes on success. **_The page should transition cleanly to the progress spinner for Rev 2 without a hard refresh._** Watch for the flash-of-idle — should be ~2s idle → polling → done on the new revision (fast STL) or idle → polling (longer scan).
9. **Student** — Rev 2 scans → results render. Ack WARNs if any → Submit → redirects to submitted stub.
10. **Teacher** — Queue now shows the same row back under `Pending approval` with revision 2 marked. Click through → detail page shows 2 revisions in the history panel, currentRevisionData is Rev 2.
11. **Teacher** — Approve Rev 2.

**Expected:** Full return → re-upload → resubmit → approve loop works. **PH5-FU-REUPLOAD-POLL-STUCK specifically: re-upload transitions without hard-refresh.** If you see the flash-of-idle or stuck state, file a new follow-up immediately and flag this criterion ⚠️.

**Result:** ⏳ _(fill in jobId + observations — especially whether reupload transition was clean)_

---

### Scenario 3 — Reject

**Setup:** Student submits an intentionally problematic file (e.g. something off-topic or clearly wrong for the assignment — doesn't matter what fires on the scan).

1. **Student** — Submit a file reaching `pending_approval`.
2. **Teacher** — Open queue → row → detail page.
3. **Teacher** — Select "Reject". Enter note: `"This isn't a final design — please start with your sketch."`
4. **Teacher** — Click Reject. Status pill flips to `rejected`.
5. **Teacher** — Queue: row moved to `Completed` tab (rejected is grouped with completed for teacher triage — per brief §10 bucketing).
6. **Student** — Navigate back to `/fabrication/jobs/[jobId]`. Verify:
   - Header says "Submission rejected".
   - Red `TeacherReviewNoteCard` with teacher's note.
   - "Start a fresh submission →" CTA link visible (goes to `/fabrication/new`).
   - **`ScanResultsViewer` is NOT rendered** — rejected jobs are terminal from student POV; no re-upload, no ack interaction, no results viewer (student already saw it pre-submission).
   - Revision history panel still renders (for reference).

**Expected:** Rejection is terminal for the job. Student must start fresh. No confusing "still interactive" UI.

**Result:** ⏳ _(fill in jobId + observations)_

---

### Scenario 4 — Per-student + per-class history

**Setup:** After Scenarios 1–3 completed, there's 3+ submissions on the `test` student: 1 approved, 1 approved-via-revision (so the history panel will show 2 revisions for that one), 1 rejected. For richer per-class aggregates, ideally also run a quick submission with a second student in the same class.

1. **Teacher** — Open `/teacher/students/[test-student-id]`. Click the new `🛠️ Fabrication` tab.
2. Verify 4-metric strip:
   - Total submissions: 3 (or whatever you ended up with)
   - Pass rate: 67% (2 approved / 3 total — assuming 2 approved + 1 rejected)
   - Avg revisions: ~1.3 (2 jobs × 1 rev + 1 job × 2 revs = 4 ÷ 3)
   - Top failure rule: whichever block/warn fired most
3. Verify chronological job list below: 3 rows, newest first, each clickable to `/teacher/preflight/jobs/[jobId]`. Each row shows student status pill, rev count, rule pill, machine, filename, "Nm ago".
4. Click one of the rows → lands on the detail page (Phase 6-2 deep link works).
5. **Teacher** — Open `/teacher/classes/[test-class-id]`. Scroll past the units section. Click to expand the "Fabrication submissions" section.
6. Lazy-fetch fires → same 4-metric strip renders for the class aggregate (will match student aggregate if only one student has submitted, or show averaged class pass rate if multiple).
7. "By student" table below: one row per student with jobs. Pass rate colour-coded (green ≥ 75%, amber 50–74%, red < 50%). Click a student row → goes to `/teacher/students/[studentId]`.
8. "All submissions" list below: chronological, with student column shown.

**Expected:** Both views render correctly, metrics accurate, drill-down links work.

**Result:** ⏳ _(fill in observations — also note if any metric computes weirdly so we can patch before checkpoint signs off)_

---

## Follow-ups to expect (list grows during smoke — file each here immediately)

**Pre-existing follow-ups (may or may not be relevant to Phase 6 smoke):**

- `PH5-FU-PER-RULE-ACKS` P3 — ack radio labels still generic 3-option; Skills Library deep-links not yet in rule schema.
- `FU-SCANNER-LEASE-REAPER` P2 — blocks horizontal scaling.
- `FU-SCANNER-CICD` P2 — GitHub Action untracked + FLY_API_TOKEN not minted.
- `FU-SCANNER-SIDECAR-DRIFT` P3 + `FU-SCANNER-SIDECAR-DRIFT-SVG` P3 — fixtures' sidecars don't declare all legit-firing rules.
- `FU-SCANNER-EMAIL-VERIFY` P3 — no real Resend round-trip test.
- `FU-FAB-UPLOAD-200MB` P3 — 50 MB ceiling.
- `FU-CLASS-MACHINE-LINK` P3 — per-class machine filter deferred to Phase 8.
- `FU-SCANNER-RATE-LIMIT` P3 — upload throttle.

**New during Phase 6 smoke:** ⏳ _(file any new ones here as they surface — most likely candidates: teacher-email-on-submit nagging if teacher doesn't see updates, UI polish on the detail page action bar, anything surprising in the approve→student-page poll cycle)_

---

## Known deviations from brief

- **No email notifications in Phase 6.** Teacher is pulled to the queue, not pushed. §10 Q4 filed this as `PH6-FU-TEACHER-EMAIL` P3 for post-pilot. Student likewise not emailed on teacher action — lifecycle emails land with the Fabricator pickup flow in Phase 7.
- **No realtime push on the queue.** Polling-only for the teacher's view (browser refresh to pick up new submissions). `PH6-FU-QUEUE-REALTIME` P3 deferred per §10 Q5 discussion.
- **Single teacher-note field v1.** Overwritten on each action rather than threaded. `PH6-FU-NOTE-HISTORY` P3 filed for post-pilot.
- **No inline row approve.** §10 Q5 suggested row-level Approve after first view; Phase 6-3 chose detail-page-as-single-action-surface for clean v1 safety. Inline approve stays a P3 follow-up if teacher feedback asks for it.
- **Queue fetch capped at 200.** Client-side bucketing for tab counts is accurate up to 200 rows per teacher. Beyond that a follow-up `PH6-FU-QUEUE-LARGE` kicks in (not filed yet — wait for a teacher to hit it).
- **Teacher notes on `pending_approval` via POST /note are invisible to students in v1.** The /note endpoint updates the note without a status transition; `TeacherReviewNoteCard` only surfaces on needs_revision/rejected/approved. Flagged in `teacher-review-note-helpers.ts` doc-comment as a possible P9 addition.

---

## Next phase

**Phase 7 — Fabricator App (Lab Tech Queue)** (~2 days per spec §13). First lab-tech-facing surface. Builds on the Fabricator auth from Phase 1B-2 (already shipped). Ships:
- `/fab` dashboard — approved submissions queue, picked_up tab, completed tab.
- Pickup / complete / fail actions.
- Student + teacher notifications on pickup (optional Phase 7, required Phase 8).

Matt Checkpoint 7.1: a lab tech can pick up + complete an approved submission end-to-end.

Brief will be drafted after Phase 6 sign-off.
