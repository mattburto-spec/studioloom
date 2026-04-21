# Preflight Phase 4 — Student Upload + Job Orchestration

**Status:** DRAFT — awaiting Matt sign-off before first sub-phase opens
**Date drafted:** 22 April 2026
**Spec source:** `docs/projects/fabrication-pipeline.md` §4 Stage 1, §4 Stage 2, §13 Phase 4
**Predecessor:** Phase 2B complete + Checkpoint 3.1 signed off 22 Apr 2026. Commit `0554947` is HEAD on `origin/main`.
**Blocks:** Phase 5 (soft-gate results UI — consumes the revision + scan-job rows this phase produces), Phase 6 (teacher approval queue — same), full end-to-end pilot.
**Estimated duration:** ~2 days (6 sub-phases, each gated, separate commits).

---

## 1. What this phase ships

The first user-facing producer of rows on the `fabrication_*` tables. Phases 1A–3 built the data model, auth, scanner, and email — all through SQL stuffing + smoke tests. Phase 4 replaces those smoke tests with a real student flow: pick a file → upload via signed URL → watch a "we're checking your file" screen → see a "done, view results" link (results UI ships Phase 5 — Phase 4 lands the student on a minimal results stub).

**Ships:**

1. **Upload orchestration API** — `POST /api/student/fabrication/upload` creates `fabrication_jobs` + `fabrication_job_revisions` rows, mints a Supabase Storage signed-upload URL scoped to the revision's `storage_path`, returns `{ jobId, revisionId, uploadUrl, storagePath }`.
2. **Scan enqueue API** — `POST /api/student/fabrication/jobs/[jobId]/enqueue-scan` inserts a `fabrication_scan_jobs` row for the latest revision (idempotent — if a `pending` or `running` scan already exists for the revision, returns it instead of double-enqueuing). Called by the client after the Storage upload completes.
3. **Status polling API** — `GET /api/student/fabrication/jobs/[jobId]/status` returns `{ status, scanStatus, latestScanResults, thumbnailUrl }`. Reads `fabrication_jobs.status` + joins the latest `fabrication_job_revisions` + latest `fabrication_scan_jobs`. `thumbnailUrl` is a 10-min signed URL minted on-the-fly (not persisted).
4. **Student upload page** — `/student/fabrication/new` — class picker (student's enrolled classes) → machine profile picker (machines configured for that class) → file picker (drag-drop + input, accept `.stl,.svg`, max 200 MB) → progress bar during Storage upload → staged "we're checking your file…" screen → "done, view results" link. Minimal styling; reuses existing student-auth chrome.
5. **Staged loading UI** — client polls `status` every 2 s while `scanStatus IN ('pending', 'running')`. Maps scanStatus + elapsed-time heuristics to a 4-step staged message: "Uploading…" → "Checking geometry…" → "Checking machine fit…" → "Rendering preview…". Heuristic, not authoritative — the worker doesn't emit stage progress.
6. **Error handling** — upload failure (retry with fresh signed URL), scan worker down (timeout after 90 s polling → show "scanning taking longer than expected, try again later" + preserve revision for retry), scan error (display `scan_error` text + offer re-upload).
7. **Revision tracking** — fresh upload on an existing `jobId` creates `revision_number = max+1` revision row + new `fabrication_scan_jobs` row. Previous revision's scan results remain queryable.
8. **pytest on the orchestration logic** — API route handlers, enqueue idempotency, status-polling join shape, signed-URL minting.
9. **npm test coverage on the upload page** — component tests for class/machine/file picker state, progress bar, polling state machine.
10. **Minimal end-to-end smoke** — one known-good STL + one known-broken SVG uploaded end-to-end via the UI on prod (Matt, from his own teacher account with a test student).

**Does NOT ship in Phase 4:**

- Per-rule evidence viewer, acknowledge-each-one flow, must-fix/should-fix buckets → **Phase 5**.
- Teacher approval queue (`/teacher/fabrication`) → **Phase 6**.
- Lab tech / Fabricator pickup UI → **Phase 7**.
- Machine profiles admin UI (teacher creates/customises profiles) → **Phase 8**. Phase 4 uses the 12 seeded system profiles from migration 094.
- Realtime (Postgres Changes) subscription — Phase 4 uses polling for simplicity. Realtime is a Phase 4.5 / Phase 5 enhancement if polling pressure becomes real.
- Safety alert routing for weapon-shaped models (§15 integration point) — wires in Phase 6 when teacher-facing moderation UI lands.
- Skills Library deep links per rule — stub in Phase 5, not Phase 4.

---

## 2. Infrastructure

**No changes required.** Phase 4 is pure Next.js API routes + React components + existing Supabase infra.

- **Auth:** student cookie-token sessions (`SESSION_COOKIE_NAME` → `student_sessions` → `student_id`). Per Lesson #4 + #9 — students are NOT Supabase Auth users. All 3 new API routes live under `/api/student/*` and use `requireStudentAuth` (NOT `requireTeacherAuth`).
- **Storage buckets:** `fabrication-uploads` (private, service-role RLS) for student uploads; `fabrication-thumbnails` (private, service-role RLS) for worker-rendered PNGs. Both seeded in migration 102. Student never reads the uploads bucket directly — results UI (Phase 5) will mint signed URLs via a teacher/Fabricator route.
- **Signed-URL TTL:** 15 min for upload (student picks a file, may pause before confirming) → enough buffer. 10 min for thumbnail display.
- **File size cap:** 200 MB (spec §4 Stage 1). Enforced client-side in the picker AND server-side in the orchestration API (reject before minting URL). Supabase Storage per-object cap is 50 MB on free tier — verify the project's tier supports 200 MB before wiring the picker cap. If not, drop to 50 MB in Phase 4 and raise after upgrade.
- **MIME type:** accept `.stl` (mapped to `application/sla`, `application/vnd.ms-pki.stl`, or `model/stl` — varies by browser) and `.svg` (`image/svg+xml`). Reject on extension mismatch client-side; worker validates on download via magic-bytes sniffing (already in place).
- **Rate limit:** per-student max 10 uploads per hour (simple in-memory counter in the API route, reset hourly; proper Redis rate-limit is a follow-up).

---

## 3. Sub-phase split (6 instruction blocks)

Each sub-phase: pre-flight → assumptions block → audit → write → test → NC → commit → report cycle. Separate commits. Per build methodology + Phase 2A/2B pattern.

### 4-1 — Upload orchestration API + signed URL

**Goal:** `POST /api/student/fabrication/upload` — create `fabrication_jobs` + `fabrication_job_revisions` rows, mint Storage signed-upload URL, return payload to client.

**Files touched:**
- `src/app/api/student/fabrication/upload/route.ts` (NEW)
- `src/lib/fabrication/orchestration.ts` (NEW — shared helpers: path-builder, row-creator, URL minter)
- `src/lib/fabrication/orchestration.test.ts` (NEW)

**Audit first:** existing `/api/student/*` route patterns (`auth.ts` helpers, cookie-handling, Cache-Control:private per Lesson #11), existing upload routes in `/api/student/upload/*` (if any) for storage-path conventions, `requireStudentAuth` shape.

**Commit:** `feat(preflight): Phase 4-1 upload orchestration API + signed URL`

**Est:** ~0.4 day

---

### 4-2 — Scan enqueue + status APIs

**Goal:** `POST /api/student/fabrication/jobs/[jobId]/enqueue-scan` (idempotent) and `GET /api/student/fabrication/jobs/[jobId]/status`.

**Files touched:**
- `src/app/api/student/fabrication/jobs/[jobId]/enqueue-scan/route.ts` (NEW)
- `src/app/api/student/fabrication/jobs/[jobId]/status/route.ts` (NEW)
- `src/lib/fabrication/orchestration.ts` (extend)
- `src/lib/fabrication/orchestration.test.ts` (extend — enqueue idempotency tests: dup-pending → returns existing, dup-running → returns existing, fresh-revision → creates new)

**Audit first:** `fabrication_scan_jobs` unique-index constraints (one active per revision), `worker/supabase_client.py::claim_next_scan_job` expectations, thumbnail signed-URL minting pattern (if one exists elsewhere).

**Commit:** `feat(preflight): Phase 4-2 scan enqueue + status APIs`

**Est:** ~0.4 day

---

### 4-3 — Student upload page scaffold + class/machine picker

**Goal:** `/student/fabrication/new` page with class-dropdown (from student's `class_students` enrolments) + machine-profile dropdown (filtered to machines linked to the selected class via a teacher/class config row — OR fallback to all seeded profiles if no per-class linking is wired yet).

**Files touched:**
- `src/app/(student)/fabrication/new/page.tsx` (NEW)
- `src/components/fabrication/ClassMachinePicker.tsx` (NEW)
- `src/components/fabrication/ClassMachinePicker.test.tsx` (NEW)

**Open question flagged to Matt:** is there a `class_machine_profiles` junction table, or does each student see all 12 seeded profiles? **Audit step must answer this** — if no junction, v1 shows all 12; if junction exists and is populated, filter by class. Either answer is fine for Phase 4 — just no silent "zero profiles shown because the join is empty" case.

**Commit:** `feat(preflight): Phase 4-3 student upload page + class/machine picker`

**Est:** ~0.4 day

---

### 4-4 — File picker + upload progress + enqueue wiring

**Goal:** Drag-drop file picker on the upload page, progress bar during PUT to the signed URL, button to confirm + enqueue scan.

**Files touched:**
- `src/components/fabrication/FileDropzone.tsx` (NEW — drag-drop, extension check, size check, preview filename)
- `src/components/fabrication/UploadProgress.tsx` (NEW — XMLHttpRequest progress events → % bar)
- `src/app/(student)/fabrication/new/page.tsx` (wire)
- Component tests

**Key sequence:**
1. User picks file + class + machine → clicks "Upload"
2. `POST /upload` → returns `{ jobId, revisionId, uploadUrl, storagePath }`
3. `fetch(uploadUrl, { method: 'PUT', body: file })` with progress events
4. On complete: `POST /enqueue-scan/jobs/[jobId]/enqueue-scan`
5. Redirect to `/student/fabrication/jobs/[jobId]` (status page — next sub-phase)

**Stop trigger:** if browser PUT progress events don't fire (some browsers + some proxies strip them), fall back to an indeterminate spinner — don't block the phase.

**Commit:** `feat(preflight): Phase 4-4 file picker + upload progress + enqueue wiring`

**Est:** ~0.4 day

---

### 4-5 — Status page + staged loading UI + polling state machine

**Goal:** `/student/fabrication/jobs/[jobId]` shows "we're checking your file…" with staged copy, polls every 2 s, lands on a minimal results stub when `scanStatus = 'done'`.

**Files touched:**
- `src/app/(student)/fabrication/jobs/[jobId]/page.tsx` (NEW)
- `src/components/fabrication/ScanProgressCard.tsx` (NEW — the staged-message card with progress dot + elapsed-time label)
- `src/hooks/useFabricationStatus.ts` (NEW — polling state machine: `idle → polling → done | error | timeout`, 2 s interval, 90 s ceiling, cancels on unmount)
- Tests for the hook

**Staged messaging heuristic:**
- t < 2 s: "Uploading your file…" (stale from the upload phase — no scan row yet)
- scanStatus = 'pending' OR 'running' AND elapsed < 5 s: "Checking your geometry…"
- elapsed 5–15 s: "Checking machine fit…"
- elapsed 15–30 s: "Rendering preview…"
- elapsed > 30 s: "Still checking — this one's taking a bit longer…"
- scanStatus = 'done': redirect to results stub
- scanStatus = 'error': show error + re-upload link
- elapsed > 90 s without done/error: timeout — "Scanning taking longer than expected. We've saved your file — come back in a few minutes."

**Commit:** `feat(preflight): Phase 4-5 status page + staged loading UI`

**Est:** ~0.5 day

---

### 4-6 — Prod smoke + Checkpoint 4.1 report

**Goal:** End-to-end verification on prod with 2 real files uploaded from Matt's own test student account.

**Fixtures:** reuse `small-cube-25mm.stl` (known-good) + `coaster-orange-unmapped.svg` (known-broken — R-SVG-04 + R-SVG-02). Upload both via the new UI, watch the staged messaging, verify results stub page loads with correct rule firings + thumbnail. Verify re-upload creates revision_number=2.

**Checkpoint 4.1 report:** `docs/projects/preflight-phase-4-checkpoint-4-1.md` — mirror the 2.1/3.1 structure. 10-criterion matrix covering: both APIs deployed, upload UI rendered, 2 fixtures round-trip successfully, revision_number increments on re-upload, scan_status polling lands terminal state, thumbnail renders in UI, error path tested (upload a `.txt` → reject client-side, upload a corrupt STL → `scan_status='error'` surfaces in UI), pytest delta, npm test delta, WIRING.yaml updated.

**Commit:** `feat(preflight): Phase 4-6 Checkpoint 4.1 — student upload end-to-end`

**Est:** ~0.3 day

---

## 4. Success criteria (Checkpoint 4.1)

- [ ] `POST /api/student/fabrication/upload` creates job + revision + returns signed URL. Tested.
- [ ] `POST /api/student/fabrication/jobs/[jobId]/enqueue-scan` idempotent — duplicate pending/running returns existing, fresh revision creates new. Tested.
- [ ] `GET /api/student/fabrication/jobs/[jobId]/status` returns denormalised status + thumbnail signed URL. Tested.
- [ ] `/student/fabrication/new` page renders class + machine pickers from real data (or stated fallback per 4-3 audit).
- [ ] Drag-drop file picker enforces `.stl,.svg` + 200 MB (or documented lower cap) + rejects other types client-side.
- [ ] Progress bar fires during Storage upload; falls back to indeterminate spinner if progress events unavailable.
- [ ] Status page staged messaging advances through 4+ stages on a real STL scan (3–15 s expected duration).
- [ ] Re-upload on same `jobId` creates `revision_number = 2` row; scan job re-enqueues and runs; both revisions queryable.
- [ ] Error path: upload non-STL → rejected client-side; corrupt STL → `scan_status='error'` surfaces to UI with `scan_error` text.
- [ ] Prod smoke: small-cube-25mm.stl + coaster-orange-unmapped.svg both round-trip end-to-end from Matt's test-student account. Thumbnails visible on results stub.
- [ ] Timeout path: if scan doesn't land terminal state in 90 s, UI shows "come back later" + preserves revision.
- [ ] pytest: no new Python tests required (no scanner changes) — baseline 245 untouched.
- [ ] `npm test`: +N tests (target ~20–30 — picker states, polling state machine, API route handler shape).
- [ ] `docs/projects/WIRING.yaml`: new system `fabrication-student-upload` added OR `preflight-pipeline` summary extended; `api-registry.yaml` picks up 3 new routes via scanner.
- [ ] `docs/projects/dashboard.html` Preflight card: progress 65 → 80, est updated.
- [ ] Checkpoint 4.1 report doc filed.

---

## 5. Stop triggers (halt, report, wait for Matt)

1. **Supabase Storage tier caps upload at < 50 MB.** Phase 4 assumed 200 MB. If the project tier is lower, stop and confirm: drop cap to 50 MB for Phase 4 and raise after an upgrade, OR upgrade tier first.
2. **`class_machine_profiles` junction doesn't exist AND per-class machine filtering was implied.** Sub-phase 4-3 audit answers this. If missing and Matt expected it, stop — schema decision before building the picker.
3. **RLS blocks the student from reading their own `fabrication_jobs` row.** `fabrication_jobs` RLS policy may be scoped to teachers only (service-role is how the worker reads). Students need their own SELECT policy for status polling. Stop and add the migration if missing.
4. **`requireStudentAuth` + Supabase signed-URL minting can't coexist cleanly.** Signed URLs require the service-role Supabase client (from `createAdminClient()`), which per Lesson #3 must not be imported in client components. Route handler is server-side so it's fine — but verify this works end-to-end before committing 4-1.
5. **Rate-limit counter state loss across serverless invocations.** Vercel serverless doesn't persist in-memory counters across invocations — if per-student rate limit is needed urgently, use a `student_fabrication_throttle` table with `count + window_start` row per student. If not urgent, document and defer.
6. **Scanner worker polling cadence (5 s) + client polling cadence (2 s) race conditions.** If the worker is still claiming a scan when the student's polling starts, `scan_status` may be `pending` briefly even after enqueue. Expected + benign — but if tests flap, stop and tighten the `enqueue-scan` handler to wait for the INSERT to commit before returning.

---

## 6. Don't stop for

- Exact pixel-perfect styling — ship Tailwind utility classes, iterate in Phase 5.
- Missing Skills Library deep-links on the results stub page — Phase 5 wires these; Phase 4 stub just shows "X rules fired, view details coming soon".
- Per-class machine profile filtering if the junction doesn't exist — v1 shows all 12 seeded profiles and Phase 8 builds the admin UI.
- Realtime (Postgres Changes) subscription — polling works fine at Phase 4 traffic.
- Fabricator notification email — Resend helper already wired in Phase 1B-2, fires from worker; no Phase 4 work.
- Progress bar fallback if browser strips events — indeterminate spinner is acceptable.
- Mobile layout — Phase 4 targets laptop browsers (students upload on school Chromebooks). Mobile polish is Phase 9.

---

## 7. Out of scope (deferred to later phases)

| Item | Defer to |
|---|---|
| Per-rule evidence viewer, acknowledge-each-one, must-fix/should-fix buckets | Phase 5 |
| Re-upload flow polish (revision comparison view) | Phase 5 |
| Teacher approval queue (`/teacher/fabrication`) | Phase 6 |
| Lab Tech / Fabricator pickup UI + token auth | Phase 7 |
| Machine profiles teacher-admin UI (create/customise) | Phase 8 |
| Analytics: class-level rule-failure heatmap, revision distribution | Phase 9 |
| Safety alert routing for weapon-shaped models | Phase 6 (wires to existing safety alert feed) |
| Realtime subscriptions (replace polling) | Phase 4.5 or Phase 5 if polling pressure observed |
| Per-student rate-limit in a durable store | FU-SCANNER-RATE-LIMIT-DURABLE (file during 4-1 if it matters) |
| GitHub Action auto-deploy for the scanner worker | FU-SCANNER-CICD (opened Checkpoint 3.1) |
| `notifications_sent` verification for scan-complete email with a real student | FU-SCANNER-EMAIL-VERIFY (opened Checkpoint 2.1; Phase 4 traffic gives the first real shot at closing this) |

---

## 8. Lessons to re-read (every sub-phase)

- **#3 Client components can't import server-only modules** — `createAdminClient()` must stay on server-side route handlers. Upload orchestration API is server; upload component is `"use client"` and must NOT touch the admin client directly.
- **#4 Student auth uses token sessions, not Supabase Auth** — all 3 new API routes use `requireStudentAuth`, NOT `requireTeacherAuth`. Follow the `/api/student/*` convention.
- **#9 Student-facing components must use student auth routes** — recurring bug pattern; audit before committing each route.
- **#11 Vercel CDN strips Set-Cookie from Cache-Control:public** — the 3 new API routes all return JSON, not cookies, BUT the status polling route is called repeatedly and must still set `Cache-Control: private, no-cache, no-store, must-revalidate` to prevent any CDN caching of polled responses.
- **#14 Always normalize content data before accessing .pages** — not applicable here (fabrication isn't content-unit data), but mentally review before touching any existing student hooks.
- **#38 Verify = assert expected values, not just non-null** — pytest + npm test assertions must check actual `revisionNumber`, actual `scanStatus` values, actual `thumbnail_path` (after Lesson #53 this is column-level, not JSONB-level).
- **#39 For pattern bugs, audit all similar sites and fix in the same phase** — if the status polling route has a caching issue, the upload and enqueue routes probably do too; fix together.
- **#52 REVOKE EXECUTE FROM PUBLIC doesn't revoke Supabase's auto-grants** — Phase 4 doesn't add Postgres functions, but if any new RPC lands, revoke from all three (PUBLIC, anon, authenticated).
- **#53 Denormalised columns need explicit writes; JSONB doesn't fan out** — when reading `fabrication_job_revisions` for status polling, read the `thumbnail_path` **column** directly. Do NOT re-derive it from `scan_results->>'thumbnail_path'` — column is authoritative post-22-Apr.

---

## 9. Execution note

- All commits on local `main`; push after each clean sub-phase IF FU-SCANNER-CICD is still open (no auto-deploy); otherwise push triggers the GitHub Action and the push cadence can relax.
- WIP backup branch: `phase-4-wip`. Advance after every clean commit.
- Don't amend commits across sub-phase boundaries. Separate commits per methodology.
- After 4-6 Checkpoint passes: trigger `saveme` skill, update dashboard card, update ALL-PROJECTS.md header, update WIRING.yaml.
- Next phase on Matt's desk after 4.1 sign-off: **Phase 5 (Soft-Gate Results UI)**. Brief written once Phase 4 closes.

---

## 10. Open questions for Matt before 4-1 opens

1. **File size cap** — is the Supabase Storage tier on `studioloom` able to accept 200 MB objects? If not, what's the cap? (Answer shifts picker + server-side validation constants.)
2. **Class → machine profile linkage** — is there a `class_machine_profiles` junction, or do students pick from all 12 seeded profiles? (Phase 4-3 audit answers this but earlier is cheaper.)
3. **Test student account** — which student in prod should the Checkpoint 4.1 smoke test use? Matt creates a test student via the teacher dashboard or reuses an existing one?
4. **Rate limit** — is 10 uploads/hour/student reasonable, or is it fine to defer any throttle to a follow-up? (Affects 4-1 scope.)
5. **Realtime or polling for v1** — polling keeps Phase 4 smaller. Realtime is a clearer UX win but adds Supabase subscription wiring. Confirm polling-for-v1 or pivot early.

Answer inline before opening 4-1.
