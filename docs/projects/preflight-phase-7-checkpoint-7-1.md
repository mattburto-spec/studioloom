# Preflight Phase 7 — Checkpoint 7.1 Report

**Status:** ✅ PASS — signed off by Matt in prod smoke
**Date signed off:** 24 April 2026 PM
**Signed off by:** Matt (teacher `mattburto@gmail.com` + `test` student + newly-invited Fabricator account)
**Date drafted:** 24 April 2026 AM
**Brief:** [`preflight-phase-7-brief.md`](./preflight-phase-7-brief.md)
**Phase scope:** Lab tech pickup + completion — fab queue, detail page, download-with-rename, complete/fail, student-side completion card.
**Worktree:** `/Users/matt/CWORK/questerra-preflight`, branch `preflight-active`.

---

## Pre-smoke checklist (Matt runs these before Scenario 1)

1. **Deploy** — merge `preflight-active` → `main` (or smoke against the Vercel preview URL built from `preflight-active`). No migrations, so no DB prep.
2. **Invite a Fabricator account** (one-time) — as a teacher, go to `/teacher/preflight/fabricators` → Invite. Use your own email or a test alias. Paste the invite link into a new browser (different profile or incognito) + set a password at `/fab/set-password`.
3. **Assign the Fabricator to the machines your test student uses** — on the same fabricators admin page, click the fabricator row → "Manage machines" → pick the same machine(s) your `test` student submits to (e.g. the Bambu X1 Carbon + xTool P2 from the Phase 6 smoke).
4. **Teacher login** — your primary browser. Has an approved job in the queue, or creates one during S1.
5. **Student login** — incognito/other browser as `test`, used to verify the green/red completion card in S1/S2.
6. **Fabricator login** — third browser session as the new Fabricator account. Starts at `/fab/queue`.

---

## Success criteria — pass/fail matrix

Criteria transcribed from `preflight-phase-7-brief.md` §4.

| # | Criterion | Status | Evidence |
|---|---|:---:|---|
| 1 | `listFabricatorQueue` scopes by `machine_profile_id IN (fabricator_machines)` — no cross-fabricator leakage. Tested. | ⏳ | Phase 7-1 `71c7cae` — `listFabricatorQueue` filters via `.in("machine_profile_id", assignedIds)` after a junction lookup. No-assignments → empty queue (verified in unit test). Cross-tab filtering: 'ready' = status=approved; 'in_progress' = status=picked_up AND lab_tech_picked_up_by=self. 23 orchestration tests. Prod: **⏳ verify during Scenario 1.** |
| 2 | Pickup action atomic: status transition + `lab_tech_picked_up_by` + `lab_tech_picked_up_at` all written in same update. Idempotent on re-download. | ⏳ | Phase 7-1 `pickupJob` — `.eq("status", "approved")` WHERE clause as race-guard + post-write confirm read to verify we won. Re-download by same fab = idempotent no-op, returns same storage_path. Verified in unit test. Prod: **⏳ verify via Scenario 1 re-download + Scenario 3 race test if available.** |
| 3 | Download handler streams file with correct `Content-Disposition: attachment; filename="..."` using the 6-6k helper. Verified against Chrome + Safari. | ⏳ | Phase 7-2 `fb81a85` — `/api/fab/jobs/[jobId]/download` does detail → pickup → `db.storage.download` → stream bytes with `Content-Disposition` from `buildFabricationDownloadFilename`. Route test asserts filename is `matt-burton-10-design-cardboard-furniture.stl` byte-exact. Prod: **⏳ verify download in S1 saves with the renamed filename.** |
| 4 | `/fab/queue` renders 2 tabs with accurate per-tab counts + row fields (student, class, unit, file, machine, approved time). | ⏳ | Phase 7-3 `9b12a90` — tabbed queue with server-component auth + client tab state, `?tab=` URL param. Dark slate theme. Row: thumbnail, student name, class chip, unit subtitle, machine + category, Rev N, file size, approved/picked-up relative time, teacher note preview. Prod: **⏳ visually verify in Scenario 1.** |
| 5 | Click row → `/fab/jobs/[jobId]` detail page with teacher note + scan summary + download/completion actions. | ⏳ | Phase 7-4 `6fc9ab5` — detail page with header card, teacher note callout, scan summary (rule counts + thumbnail), `LabTechActionBar` with context-aware buttons (Download on approved; Re-download + Mark Complete + Mark Failed on picked_up). Back-nav via router.back() with /fab/queue fallback. Prod: **⏳ verify during Scenario 1 + 2.** |
| 6 | Complete + Fail actions write `completion_status` + `completion_note` + `completed_at` correctly. Tested. | ⏳ | Phase 7-1 + 7-2 — `markComplete` derives `completion_status` from machine category (printed for 3d_printer, cut for laser_cutter). `markFailed` requires non-empty note, enforced at BOTH route layer (400) + orchestration layer (defence in depth). Both use conditional UPDATE scoped to `picked_up_by = self` for race safety. Tests: 4 complete + 4 fail cases. Prod: **⏳ verify via S1 + S2 SQL spot-checks.** |
| 7 | Student `/fabrication/jobs/[jobId]` shows green "ready to collect" card on `completed + printed\|cut`, red "couldn't run" card with note on `completed + failed`. | ⏳ | Phase 7-4 `6fc9ab5` + 7-5 — `LabTechCompletionCard` with three variants: printed → green "printed and ready to collect"; cut → green "cut and ready to collect"; failed → red "The lab tech couldn't run this" + required note + "Start a fresh submission →" CTA. `headerTitleForStatus` updated to split completed into the three outcomes. 8 helper tests. Prod: **⏳ verify during Scenarios 1 + 2.** |
| 8 | `ScanResultsViewer` correctly hidden on `completed` statuses (terminal, parallel to rejected). | ⏳ | Phase 7-5 — `shouldHideScanViewerForCompletion('completed')` = true. Combined with the existing rejected check into a single `hideScanViewer` flag. Prod: **⏳ verify in S1 + S2 — should see only the completion card, no rule buckets.** |
| 9 | Race condition: double-pickup attempt returns 409 on the second call. DB-level guard (UPDATE ... WHERE status='approved'). | ⏳ | Phase 7-1 — conditional UPDATE + post-write confirm read. If Fabricator A wins, Fabricator B's confirm read sees `lab_tech_picked_up_by != self`, returns 409 "Another lab tech picked up this job first". Unit tested. Prod: **⏳ OPTIONAL for Scenario 3 — requires 2 fabricator accounts.** |
| 10 | Prod smoke: all 3 scenarios verified from Matt (teacher) + `test` (student) + a real Fabricator account. | ⏳ | **⏳ Full smoke pending — see Scenarios 1–3 below.** |
| 11 | `npm test`: +70+ tests (target ~40–60 per brief, exceeded). Zero regressions. | ✅ | **1854 → 1939 (+85 tests across Phase 7).** Breakdown: 7-1 +23 (fab orchestration), 7-2 +33 (5 routes × ~6 tests each), 7-3 +13 (fab-queue-helpers), 7-4 +16 (canned notes + completion helpers). Exceeds target. TS clean on all new files. |
| 12 | Checkpoint 7.1 report doc filed. | ✅ | This document. |

**Overall:** ✅ **12/12 PASS** (Criterion #10 smoke verified 24 Apr PM — S1 happy-path print + S2 failed run both pass; S3 2-fab race optional/skipped, unit-test covered). Code + tests + tsc clean on every sub-phase commit. 1854 → **1950 tests passing** (Phase 7 total: +96 across 6 commits including 7-5d hotfix).

---

## Commits in Phase 7

```
433188b fix(preflight): Phase 7-5d hotfix — failed runs no longer show as green COMPLETED on list views + invite email legibility
5f5b43c fix(preflight): Phase 7-5c rename Lab techs button → Fabricators on queue page
ae97246 fix(preflight): Phase 7-5b sweep "lab tech" → inclusive wording for smaller schools
d64545b feat(preflight): Phase 7-5 student completion visibility + Checkpoint 7.1 report
6fc9ab5 feat(preflight): Phase 7-4 fab detail page + LabTechActionBar + completion card
9b12a90 feat(preflight): Phase 7-3 fab queue page UI — replaces Phase 1B-2 placeholder
fb81a85 feat(preflight): Phase 7-2 fab action + queue + download endpoints
71c7cae feat(preflight): Phase 7-1 fab orchestration lib + queue/pickup/complete/fail logic
```

8 commits on `preflight-active` branch. All merged to `main` via two merge commits (`7fefd6e` pre-smoke, `d5eb596` for the 7-5d hotfix).

**No migrations.** Every column Phase 7 writes already exists (migration 095: `lab_tech_picked_up_by`, `lab_tech_picked_up_at`, `completion_status`, `completion_note`, `completed_at`). `printing_started_at` from migration 098 stays NULL per §11 Q1 decision.

---

## Production smoke scenarios (Matt runs — paste results here)

All scenarios use:
- **Teacher:** your primary teacher account on `studioloom.org`
- **Student:** `test` account (reuse from Phase 6 smoke)
- **Fabricator:** the new lab-tech account you just created in pre-smoke step 2
- **Deployment:** main post-merge OR Vercel preview built from `preflight-active`

---

### Scenario 1 — Happy path (print)

**Setup:** Student has an approved job waiting. Fabricator picks it up, runs it, marks complete.

1. **Student** — Navigate to `/fabrication/new`, pick a Bambu X1C profile, upload `small-cube-25mm.stl` (or any known-good STL). Submit → lands at `pending_approval` or `approved` depending on the seed flip state (Phase 6 smoke already flipped laser-only, so 3D printer auto-approves — fine).
2. **Teacher** — If status is `pending_approval`, open `/teacher/preflight` → row → detail → Approve. Status → `approved`. Skip if already auto-approved.
3. **Fabricator** — Open `/fab/queue`. **Verify:**
   - Ready to pick up tab is default and shows the job with: student name (Matt Burton), class chip (10 Design or similar), unit if linked, filename, machine + category, Rev N, file size, "Approved Nm ago"
   - Teacher note preview renders italicised under the main info (if teacher left one)
4. **Fabricator** — Click the row → `/fab/jobs/[jobId]` detail page. **Verify:**
   - Header card shows all metadata
   - Teacher's note callout if set
   - Scan summary card shows rule counts + thumbnail
   - LabTechActionBar at bottom shows the big blue "Download & pick up" button (approved state)
5. **Fabricator** — Click Download. **Verify:**
   - Browser saves the file as `{student-slug}-{class-slug}-{unit-slug}.stl` (e.g. `matt-burton-10-design-cardboard-furniture.stl`) — NOT the original filename
   - Page re-fetches ~600ms later and status pill flips to `picked_up`
   - Action bar now shows Re-download + Mark complete + Mark failed
6. **Fabricator** — Click Re-download. **Verify:** second download fires with the same filename; status stays `picked_up` (idempotent, no rewrite).
7. **Fabricator** — Back to `/fab/queue` → In progress tab. **Verify:** row visible with "Picked up Nm ago".
8. **Fabricator** — Back to detail page → Click Mark complete → modal opens with canned-note chips. Pick one chip (e.g. "Printed fine — collect from the fabrication area"). Click Confirm.
9. **Fabricator** — Page re-renders. **Verify:**
   - Status pill = `completed`
   - Success banner: "Marked complete — student will be notified"
   - CompletionSummary dark card visible with "Marked complete (printed)" + your note
   - Action bar is gone (terminal state)
10. **Student** — Back to `/fabrication/jobs/[jobId]` (refresh if already open). **Verify:**
    - Header title: "Your file has been printed and is ready to collect"
    - Green `LabTechCompletionCard` with your note in a white sub-card + "completed Nm ago" footer
    - **`ScanResultsViewer` is NOT rendered** — the scan rules aren't actionable anymore

**SQL spot-check:**
```sql
SELECT status, lab_tech_picked_up_by, lab_tech_picked_up_at,
       completion_status, completion_note, completed_at
FROM fabrication_jobs WHERE id = '<jobId>';
```
Expect: `status='completed'`, `completion_status='printed'`, note populated, timestamps recent.

**Result:** ⏳ _(fill in jobId + observations after smoke — especially whether the filename saved with the renamed form)_

---

### Scenario 2 — Failed run

**Setup:** Second approved job. Fabricator downloads, pretends to run it, marks failed with a note. Student sees red card.

1. **Student** — Submit a fresh job (any STL/SVG) → reach `approved`.
2. **Fabricator** — `/fab/queue` → Ready tab → click row → download (transitions to picked_up).
3. **Fabricator** — Open the In progress tab → click the job → detail page.
4. **Fabricator** — Click Mark failed → modal opens. **Verify:**
   - A note IS required (Confirm button disabled when textarea empty)
   - Fail presets include "Warped off the bed", "Layers separated", etc.
5. **Fabricator** — Pick "Warped off the bed partway through..." preset OR type your own note. Click Confirm.
6. **Fabricator** — Page re-renders. **Verify:**
   - Status pill = `completed`
   - CompletionSummary = red "Marked failed" with your note
7. **Student** — Navigate to the job. **Verify:**
   - Header: "The lab tech couldn't run this"
   - Red `LabTechCompletionCard` with the lab-tech note in a white sub-card
   - **"Start a fresh submission →" link visible** — click it, verify navigation to `/fabrication/new`
   - **`ScanResultsViewer` NOT rendered** (terminal, same pattern as rejected)

**SQL spot-check:**
```sql
SELECT status, completion_status, completion_note
FROM fabrication_jobs WHERE id = '<S2-jobId>';
```
Expect: `status='completed'`, `completion_status='failed'`, note matches what you typed.

**Result:** ⏳ _(fill in jobId + observations)_

---

### Scenario 3 — Two-fabricator race (OPTIONAL)

**Skip if you only have one Fabricator account.** The race guard is unit-tested at the orchestration layer (expected 409 on the second confirm read), so prod verification is nice-to-have not required for checkpoint pass.

1. Create a second Fabricator account, assign to the same machine.
2. Two browser sessions. Both open the same approved job in the queue.
3. Both click Download within ~1 second of each other.
4. **Verify:** one succeeds (file downloads, status → picked_up by them). The other gets a 409 error toast: "Another lab tech picked up this job first."
5. Confirm the losing fabricator's detail page refreshes to show the job is now in the other fabricator's in-progress queue (they don't see it anymore).

**Result:** ⏳ _(skip or fill in based on 2-fab availability)_

---

## Follow-ups tracker

**New during Phase 7 smoke:** ⏳ _(file any new ones here as they surface)_

**Pre-existing follow-ups (not expected to affect Phase 7):**

- `PH7-FU-FABRICATOR-CANNED-NOTES` P3 — teacher-editable lab-tech preset list (parallel to `PH6-FU-TEACHER-CANNED-NOTES-EDITABLE`). Filed inline in `lab-tech-canned-notes.ts`. Post-pilot.
- `PH6-FU-HISTORY-PAGINATION` P2, `PH6-FU-PREVIEW-OVERLAY` P2, etc. — unrelated to fab flow.

**Resolved this phase:**
- Phase 6-6k `buildFabricationDownloadFilename()` helper finally wired into a real download handler (Phase 7-2). Earlier it was surfaced only as a preview on the teacher detail page.

---

## Known deviations from brief

- **No explicit "Start print" button.** Per §11 Q1 decision — `printing_started_at` column stays NULL until Phase 9 analytics need it. Download acts as the pickup transition; lab tech doesn't need a separate "I'm starting now" action.
- **No pickup email to student.** §11 Q2 said "ship it" — deferring actually to Phase 7-6 if a real classroom test shows students want the notification. Student can check `/fabrication` overview anytime to see `picked_up` status. If Matt wants it ASAP, easy 15-min follow-up: call the Resend helper at the end of `pickupJob` with idempotency via `notifications_sent.pickup_at`.
- **No single "pickup event" audit log.** §11 Q4 accepted. Single-pickup-per-job semantics baked into the design. Phase 9+ can add a `pickup_events` table if audit trail becomes needed.
- **No completion analytics view for teachers.** Phase 9 — §7 out-of-scope item.
- **Fabricator-to-teacher chat / escalation.** Phase 9 — §7 out-of-scope.

---

## Next phase

**Phase 8 — Lab + Machine + Fabricator Admin (EXPANDED)** (~2–3 days). Brief drafted 24 Apr 2026 AM at [`preflight-phase-8-brief.md`](./preflight-phase-8-brief.md) — status DRAFT, pre-sign-off, 6 open questions for Matt to resolve.

Originally §13 Phase 8 was just "Machine Profiles Admin UI" (~1–2 days). This brief **folds in Phase 9's lab-scoping work** (the `PH6-FU-MULTI-LAB-SCOPING` P2 follow-up filed during Phase 6 smoke) + **reshapes the admin as a visual + relational surface** instead of three separate list pages.

Ships:
- `fabrication_labs` entity + `machine_profiles.lab_id` + `classes.default_lab_id` (migration + backfill)
- Lab CRUD (create "2nd floor design lab" etc.), machine CRUD (add a new Bambu A1, edit colour maps), fabricator reassignment
- New `/teacher/preflight/lab-setup` visual page replacing `/teacher/preflight/fabricators`
- Student picker auto-filters by class's default lab (closes `FU-CLASS-MACHINE-LINK`)

Net effect: Phase 9 estimate reduces to just "Analytics + Polish".

Pre-conditions: this checkpoint (7.1) PASSED + Matt resolves the 6 open questions in §5 of the Phase 8 brief.

---

## Smoke outcomes (24 Apr 2026 PM)

**S1 — Happy path (print):** ✅ PASS
- Student uploaded `small-cube-25mm.stl` to a Bambu Lab P1S (3D printer) — auto-approved.
- Fabricator (newly invited via Resend — see "Setup gotcha" below) clicked **Download & pick up** on `/fab/jobs/[jobId]`. File downloaded with the rewritten filename via `buildFabricationDownloadFilename()`.
- Status flipped to `picked_up` correctly. Action bar switched to Re-download + Mark complete + Mark failed.
- Fabricator clicked **Mark complete** (printed) with free-text note. Student side: `/fabrication/jobs/[jobId]` header flipped to "Printed", green `LabTechCompletionCard` rendered in `DoneStateView` with the fabricator's note, scan viewer hidden correctly.

**S2 — Failed run:** ✅ PASS (after hotfix)
- Fabricator clicked **Mark failed** with a canned-ish note ("Warped off the bed partway through. Needs a brim / better bed adhesion.")
- Student detail page: red `LabTechCompletionCard` "Your run didn't complete" with the note + "Start a fresh submission →" link. ✅ Correct end-state.
- **Bug caught during smoke:** student list view (`/fabrication` + teacher per-student/per-class history) showed green "COMPLETED" pill for the same failed job. Click-through was correct, list was lying. **Fixed in Phase 7-5d** — new shared `fabricationStatusPill(status, completionStatus)` helper branches the pill label + colour. Backend endpoints updated to ship `completion_status` on list rows. 10 helper tests guard regressions. Verified in prod after redeploy: list pill now reads red "RUN FAILED" ✅.

**S3 — Two-fab race:** ⏭️ SKIPPED (optional, unit-test covered)
- Race-safety unit tests for `pickupJob` (conditional UPDATE + post-write confirm read) cover the code path. Skipping hands-on prod race test per pragmatic call; can revisit if any pilot race condition surfaces.

### Setup gotcha — `RESEND_API_KEY` missing on Vercel

Matt hit this during pre-smoke setup: invite email fell back to console-log because `RESEND_API_KEY` wasn't set on Vercel for the Preflight project. The existing StudioLoom teacher-invite flow uses `supabase.auth.admin.inviteUserByEmail()` which routes through **Supabase's custom SMTP config** (Supabase dashboard holds its own copy of the Resend key); the Preflight fab-invite flow uses a **direct fetch to api.resend.com** via `src/lib/preflight/email.ts` and needs the env var on Vercel directly.

**Resolution:** created a dedicated `re_...` API key in Resend (named `preflight-vercel`), added to Vercel env vars (Production + Preview; Development greyed by "sensitive" flag, which is fine), redeployed. Invite dispatched successfully on retry.

**Documented as a known setup step** — any future Preflight deploy to a new project will need `RESEND_API_KEY` set in Vercel if fab-invite emails should send. The Supabase SMTP copy is separate and doesn't propagate.

---

## Mid-smoke hotfix — Phase 7-5d (commit `433188b`)

Two bugs caught and fixed before calling PASS:

1. **Failed-run pill bug** (data-correctness): list views rendered pill from `status` alone, ignoring the `completion_status` sub-state introduced in 7-5. So `completed+failed` → green "COMPLETED" on list, red "Your run didn't complete" on click-through. Fix: shared `fabricationStatusPill()` helper used across 3 list surfaces + 3 orchestration row-builders now ship `completion_status`. `completed+failed` → red "RUN FAILED"; `completed+printed|cut` → green "PRINTED"/"CUT"; legacy `completed+null` → green "COMPLETED" (backwards-compat for pre-7-5 data).

2. **Invite email blue-on-purple** (UX): teacher `display_name` unset → fallback to raw email → Gmail auto-linkified → override our header colour to unreadable blue. Fix: fall back to email's local-part ("mattburto") instead of full address. Eliminates the auto-link vector.

Tests: 1939 → 1950 (+11 new helper tests guard all 3 completion branches + legacy fallback + non-terminal-status defensiveness + unknown-status graceful degradation + approved/rejected/picked_up mappings).

---

## New follow-ups filed during smoke (P2/P3 — not blocking Checkpoint 7.1)

| ID | Priority | Scope |
|---|---|---|
| `PH7-FU-COMPLETION-NOTIFICATIONS` | P2 | Wire student email notifications on pickup + complete + fail events. `email.ts` kinds already exist (`picked_up`, `completed`); call sites inside `pickupJob` / `markComplete` / `markFailed` in fab-orchestration.ts. ~1-2h including tests. Phase 9 or pre-pilot polish pass. Matt flagged during S2: "also later need to be able to add a notification for these events". |
| `PH7-FU-INLINE-QUEUE-ACTIONS` | P2 | Job cards on `/fab/queue` currently require click-through to detail page for Download/Complete/Fail. Add inline action buttons on the queue cards directly (match Trello-lane / Linear-queue pattern) — status-aware: `approved` shows Download; `picked_up` shows Re-download + Complete + Fail. Canned-note modal pops inline as overlay. Saves 1-2 clicks per job — huge win on a 10-job morning. Detail page stays for full scan rules + student context. Matt's observation during S1: "so much empty space on these job cards. you could add buttons like 'fail' could also be added. means you don't need to click in so many places". |
| `PH7-FU-FAB-SCAN-SUMMARY` | P2 | "Scan summary" label on fab detail page reads as scanner-internals-jargon ("2I (B = blocker, W = warning, I = info)"). Fabricators don't need the rule bucket taxonomy — they just need to know "safe to run?" Rewrite as coloured dot + short phrase: "Scan passed · 2 info notes, no blockers" or similar. Matt's observation: "not sure what scan summary means. prob need to make that more intuitive". |
| `PH7-FU-PRE-PICKUP-FAIL` | P3 | Currently Fail only appears after pickup. Covers the "I looked at this file, it's wrong, I can't run it" scenario where the fabricator doesn't want to download but wants to reject-without-pickup. Adds a "Reject without pickup" variant of Fail on the `approved` state. Low priority — the current pickup-then-fail flow works, just adds a friction step in the rare "file is obviously bad" case. |

All four folded into the Phase 9 scope (currently "Analytics + Polish" after Phase 8 absorbed the lab-scoping work).

---

## Checkpoint 7.1 — final verdict

✅ **PASSED.** All 12 criteria met. 2 smoke scenarios PASS; S3 skipped per pragmatic optional call. 4 new follow-ups filed. Zero regressions across 1950 tests. Production smoke clean on `studioloom.org` via deployed Vercel prod.

Phase 7 is closed. Phase 8 brief (drafted 24 Apr AM) is now unblocked on pre-condition #1. Next: Matt resolves the 6 open questions in the Phase 8 brief's §5 → opens Phase 8-1 (migration + backfill).

Matt Checkpoint 8.1: a teacher can set up a lab with 3 machines + assign a fabricator, end-to-end in the visual admin, in under 5 minutes.
