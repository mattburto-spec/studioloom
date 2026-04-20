# Preflight — Phase 1B-2 Brief: Fabricator Auth + Admin + Email + Student Preference

> **Goal:** Land the Fabricator invite → set-password → login vertical slice end-to-end, plus the teacher admin page that drives it, plus the email helper library that underwrites Phase 2's status-transition emails, plus the server-side student opt-out field. After this, Phase 2 (scanner worker) can ship into a working auth + admin surface.
> **Spec sources:** `docs/projects/fabrication-pipeline.md` §10 (Lab Tech UX), §3.4 (Fabricator admin mockup), §2.1-2.3 (Fabricator UI) · `docs/projects/fabrication/phase-0-decisions.md` D-05 (Fabricator own auth) · `docs/projects/preflight-phase-1b-1-brief.md` (what 1B-1 delivered).
> **Estimated effort:** ~8 hours of focused code.
> **Checkpoint:** **Checkpoint 1.1B-2** — `/fab/login` works end-to-end with an invited Fabricator; teacher admin lists + invites + assigns machines; email helper passes idempotency tests against `fabrication_jobs.notifications_sent`; PATCH student preferences accepts `fabricationNotifyEmail`; no test regression.
> **Push discipline:** Stay on `main`. Commit per-sub-task. `phase-1b-2-wip` backup branch after each commit. **DO NOT push to `origin/main` until Checkpoint 1.1B-2 signed off.**

---

## Decisions locked (pre-build)

| Ref | Decision |
|---|---|
| D-EM-1 | Email sender: `Preflight <hello@loominary.org>` via Resend. loominary.org already DNS-verified + Domain-verified in Resend (since 15 Apr 2026). Existing teacher-invite emails use the same sender domain — consistent. |
| D-EM-2 | Email dispatch uses `fetch → api.resend.com/emails` directly (no package), matching `src/lib/monitoring/cost-alert-delivery.ts` pattern. Falls back to `console.log` when `RESEND_API_KEY` is unset (dev mode). |
| D-EM-3 | Email idempotency via `fabrication_jobs.notifications_sent` JSONB (shape: `{<kind>_at: ISO-timestamp}`). Helper skips send if `notifications_sent[<kind>_at]` already present; never overwrites existing timestamps. |
| D-AUTH-1 | Fabricator auth helper = new `requireFabricatorAuth(request)` returning `{fabricator, session}` or redirect. Pattern identical to `requireStudentAuth` (Lesson #4, Lesson #9). Own cookie name (`FAB_SESSION_COOKIE_NAME`) to avoid collision with student session. |
| D-AUTH-2 | Vercel CDN Cache-Control fix (Lesson #11): every `/api/fab/*` cookie-setting route returns `Cache-Control: private, no-cache, no-store, must-revalidate`. |
| D-AUTH-3 | Password hashing: bcrypt via `bcryptjs` package (already used elsewhere in repo — verify in pre-flight). Cost factor = 12. |
| D-AUTH-4 | Session token generation: `nanoid(32)` → bcrypt hash stored in `fabricator_sessions.session_token_hash`. Raw token in cookie, never stored. Matches student session pattern. |
| D-INVITE-1 | Invite creates: 1 row in `fabricators` (placeholder `password_hash = 'INVITE_PENDING'` + `is_active = true`), N rows in `fabricator_machines` (one per selected machine), 1 row in `fabricator_sessions` (`is_setup = true`, 24h TTL, token emailed). |
| D-INVITE-2 | "Reset password" reuses the invite flow: create a new `is_setup=true` session, email new set-password link. Old `is_setup=true` sessions for same fabricator are deleted on re-invite (one live invite at a time). |
| D-INVITE-3 | "Deactivate" flips `fabricators.is_active = false` — no hard delete. Preserves audit trail. Fabricator `last_login_at` queries still work. |
| D-ADMIN-1 | Teacher sidebar gets a Preflight link that routes directly to `/teacher/preflight/fabricators` in Phase 1B-2. When Phase 2 lands the queue page at `/teacher/preflight`, the sidebar link swaps to the queue and fabricators moves to a nested nav item. |
| D-STUDENT-1 | Student opt-out UI is **deferred to Phase 2** (natural home is next to `/student/preflight/submit`). In 1B-2 we only extend the server: `PATCH /api/student/studio-preferences` accepts optional `fabricationNotifyEmail: boolean`. Default remains `true` (from migration 100). |

---

## Pre-work findings (captured before writing code)

- Tests baseline: **1362 passing, 8 skipped, 79 files**. Confirmed via `npm test` at start of session.
- Git: HEAD `92b0545` on `main`, `origin/main` in sync. Clean tree except 3 pre-existing unrelated mods (dimensions3.md, ingestion-pipeline-summary.md, .pptx untracked) — untouched by this phase.
- **Greenfield:** no `/fab/*`, no `/teacher/preflight/*`, no `src/lib/fab/`, no `src/lib/preflight/` directories exist. Fresh territory.
- Student auth pattern: `src/app/api/auth/student-login/route.ts` (cookie session, bcrypt, nanoid, rate-limited). Replicate, do not share.
- Email pattern: `src/lib/monitoring/cost-alert-delivery.ts` — direct `fetch('https://api.resend.com/emails')`, no package. **Sender confirmed:** loominary.org verified in Resend since 15 Apr 2026 (screenshot confirmed by Matt).
- Teacher invite pattern (ShipReady Phase 1B, 15 Apr 2026): `src/app/api/admin/teachers/invite/route.ts` uses `supabase.auth.admin.inviteUserByEmail()` → Supabase Auth emails. **NOT the pattern we use here** — Fabricator is not Supabase Auth. Mentioned only to prevent confusion.
- bcrypt: `grep -r "bcryptjs\|from 'bcrypt'" src/` before sub-task 1B-2-2 to confirm existing import pattern (hypothesis: `bcryptjs`, cost 12, per student-login).
- Rate-limit utility: `src/lib/rate-limit.ts` exists per student-login usage — reuse.
- Existing env vars: `RESEND_API_KEY` (feature-flags.yaml L296), `COST_ALERT_EMAIL` (L135). No new env vars needed; `hello@loominary.org` is a hard-coded sender string (domain is the thing Resend verifies, not individual addresses).

---

## Lessons to re-read (full text, not titles)

- **#4** (`docs/lessons-learned.md:25`) — Student auth = cookie token sessions, NOT Supabase Auth. Fabricator uses the identical pattern. Never import `supabase.auth.getUser()` in `/fab/*` routes.
- **#9** (`docs/lessons-learned.md:40`) — Student-facing components must use matching auth. Fabricator analog: `/fab/*` MUST call `requireFabricatorAuth`, never `requireTeacherAuth` or `requireStudentAuth`.
- **#11** (`docs/lessons-learned.md:49`) — **Vercel CDN strips Set-Cookie from Cache-Control: public.** Every cookie-setting route in this phase (`/api/fab/login`, `/api/fab/set-password`, maybe `/api/fab/logout`) must explicitly set `Cache-Control: private, no-cache, no-store, must-revalidate`. Also check `next.config.ts` for `/api/fab/:path*` entry.
- **#24** — Idempotent guards (not directly applicable — no DDL here, but idempotency on email helper is the same spirit).
- **#29** (`docs/lessons-learned.md:101`) — RLS UNION dual-visibility. Not directly applicable — existing tables already handle this. Relevant only if we add new RLS.
- **#38** (`docs/lessons-learned.md:141`) — Verify EXPECTED values, not just non-null. Every test asserts specific payload shapes, not just `.ok`.
- **#40** (`docs/lessons-learned.md:182`) — Pre-flight audits catch brief transcription slips every time. The Step 1 of each sub-task's instruction block MUST re-audit before writing code.
- **#41** (`docs/lessons-learned.md:205`) — NC reverts on uncommitted files use Edit tool, not git checkout.
- **#42** (`docs/lessons-learned.md:220`) — Dual-shape persistence fields break consumers when FE/BE diverge. Relevant for `notifications_sent` — fix its shape in one place (the email helper) and document.
- **#43-46** (`docs/lessons-learned.md:236`) — Karpathy discipline: explicit assumptions block before writing code in each sub-task; surgical changes; no speculative abstractions; verify the tests actually fail when expected.

---

## Sub-tasks (all feed Checkpoint 1.1B-2)

Each sub-task = one instruction block + one commit + one test run + one report cycle. Separate commits, no squashing.

### 1B-2-1 — Email helper library

Pure function. No wiring. Gets its own commit and test suite so Phase 2's callers have a known-good dependency.

**Files:**
- `src/lib/preflight/email.ts` — exports `sendFabricationEmail({ jobId, kind, to, subject, html, supabase })`. Kind is a typed enum: `invite | set_password_reset | submitted | approved | returned | rejected | picked_up | printing_started | completed`. For `invite` and `set_password_reset`, `jobId` is `null` (no job context; dispatches directly). For job-related kinds, reads `fabrication_jobs.notifications_sent`, skips if key already set, otherwise sends via Resend and writes back `{<kind>_at: now().toISOString()}`.
- `src/lib/preflight/email-templates.ts` — 3 HTML template functions for Phase 1B-2 sends: `renderInviteEmail({ setPasswordUrl, displayName, teacherName })`, `renderResetPasswordEmail({ setPasswordUrl, displayName })`. Job-status template stubs return `<p>TODO Phase 2</p>` — helper exists but no caller until Phase 2.
- `src/lib/preflight/__tests__/email.test.ts` — 8+ tests: invite dispatches with correct payload, idempotency skips if `notifications_sent.<kind>_at` exists, NULL `jobId` allowed for invite, missing `RESEND_API_KEY` falls back to console, Resend 4xx returns error, Resend 5xx returns error, JSONB merge preserves existing keys, kind enum rejection.

**Commit:** `feat(preflight): email helper lib + idempotency via notifications_sent (1B-2-1)`

---

### 1B-2-2 — Fabricator auth core + `/fab/login`

Cookie session + login page + login API. End-to-end login works for a Fabricator who already has a password (we fake one in tests; real ones come from 1B-2-3).

**Files:**
- `src/lib/fab/auth.ts` — exports `requireFabricatorAuth(request)`, `createFabricatorSession(fabricatorId, isSetup, supabase)`, `destroyFabricatorSession(token, supabase)`. Cookie name constant: `FAB_SESSION_COOKIE_NAME = 'fab_session'`.
- `src/lib/constants.ts` — add `FAB_SESSION_DURATION_DAYS = 30`, `FAB_SETUP_SESSION_DURATION_HOURS = 24`.
- `src/app/fab/login/page.tsx` — Matt's existing auth page visual style (branded gradient header, centred card). Form: email + password, submit → POST `/api/fab/login`, on success redirect to `/fab/queue` (Phase 2 route; 1B-2 will show a placeholder "Phase 2 coming" page on that path). Shows error toast on 401.
- `src/app/fab/layout.tsx` — minimal wrapper (fab routes have their own layout since they're not teacher and not student).
- `src/app/fab/queue/page.tsx` — stub page: "Queue coming in Phase 2. You are logged in as {fabricator.display_name}." Uses `requireFabricatorAuth` to gate; unauthenticated redirects to `/fab/login`.
- `src/app/api/fab/login/route.ts` — POST: rate-limit by IP (10/min, 50/hr), lookup fabricator by lowercase email, bcrypt-verify password against `password_hash`, guard `is_active = true` + `password_hash != 'INVITE_PENDING'`, call `createFabricatorSession(id, isSetup=false)`, set `fab_session` cookie with explicit `Cache-Control: private, no-cache, no-store, must-revalidate`, update `fabricators.last_login_at = now()`. Returns `{ ok: true }` + cookie.
- `src/app/api/fab/logout/route.ts` — POST: reads cookie, calls `destroyFabricatorSession(token)`, clears cookie, redirects to `/fab/login`.
- `src/lib/fab/__tests__/auth.test.ts` — 6+ tests: session creation, session validation success path, expired session returns null, wrong token returns null, is_setup vs normal session distinction, Cache-Control header set correctly.

**Commit:** `feat(preflight): Fabricator auth helper + /fab/login + session rotation (1B-2-2)`

---

### 1B-2-3 — `/fab/set-password`

Consumes `is_setup=true` session from emailed token, lets Fabricator set bcrypt password, rotates to normal session, redirects to queue stub.

**Files:**
- `src/app/fab/set-password/page.tsx` — reads `?token=<nanoid>` from URL, POSTs to `/api/fab/set-password/verify` on mount to confirm token validity + get fabricator display_name for greeting. Form: new password + confirm password (min 12 chars, must match). Submit → POST `/api/fab/set-password/submit`, on success redirect to `/fab/queue`.
- `src/app/api/fab/set-password/verify/route.ts` — POST: body `{ token }`. Lookups `fabricator_sessions WHERE session_token_hash = bcrypt.compareSync(token, hash) AND is_setup = true AND expires_at > now()`. Returns `{ displayName, fabricatorId }` or 401. **Important:** this route reads a pre-auth token; no cookie needed. Still sets `Cache-Control: private, no-cache, no-store, must-revalidate` because the response reveals whether a token is valid.
- `src/app/api/fab/set-password/submit/route.ts` — POST: body `{ token, newPassword }`. Re-verify token (same lookup as above), bcrypt-hash the password (cost 12), `UPDATE fabricators SET password_hash = <hash> WHERE id = <fabricatorId>`, `DELETE FROM fabricator_sessions WHERE id = <setupSessionId>`, create new normal session via `createFabricatorSession(id, isSetup=false)`, set cookie, return `{ ok: true }`.
- `src/lib/fab/__tests__/set-password.test.ts` — 5+ tests: valid token path completes end-to-end, expired setup session returns 401, non-setup session (is_setup=false) returns 401, password < 12 chars returns 400, password mismatch returns 400.

**Commit:** `feat(preflight): /fab/set-password consuming is_setup sessions (1B-2-3)`

---

### 1B-2-4 — Teacher Fabricator admin page + invite API

Teacher-facing UI to invite, list, deactivate, and reassign machines for Fabricators. Uses email helper from 1B-2-1 for the invite send. Sidebar nav gets a new Preflight link.

**Files:**
- `src/app/teacher/preflight/layout.tsx` — minimal segment layout (empty for now; 1B-2 places the fabricators sub-page; Phase 2 adds the queue at the root of this segment).
- `src/app/teacher/preflight/page.tsx` — placeholder that redirects to `/teacher/preflight/fabricators` (until Phase 2 queue lands). TODO comment for Phase 2 replacement.
- `src/app/teacher/preflight/fabricators/page.tsx` — Server component: fetches fabricators owned by current teacher (via `invited_by_teacher_id = auth.uid()`) with their `fabricator_machines` joined to `machine_profiles.name`. Renders table matching mockup §3.4: name, email, last_login_at, assigned machines (chips), active status, `[...]` menu (edit machines, reset password, deactivate). Includes "Invite a Fabricator" button opening a client modal.
- `src/app/teacher/preflight/fabricators/InviteModal.tsx` — `'use client'` component. Form: email, display name, machine checkboxes (multi-select from teacher's accessible machines). Submit → POST `/api/teacher/fabricators`. On success, close + refresh page.
- `src/app/teacher/preflight/fabricators/FabricatorRow.tsx` — `'use client'` row component with `[...]` dropdown menu. Actions call PATCH/DELETE endpoints below.
- `src/app/api/teacher/fabricators/route.ts` — GET: list fabricators owned by teacher (mostly unused — page server-fetches; endpoint exists for Invite modal to refresh). POST: invite flow per D-INVITE-1. Generates nanoid(32) token, bcrypt-hashes, inserts `is_setup=true` session with 24h expiry, calls `sendFabricationEmail({ jobId: null, kind: 'invite', to, subject, html: renderInviteEmail(...) })`. Idempotency check: if a fabricator with that lower(email) already exists AND is owned by this teacher, returns 409 unless `?resend=true` param is set (re-invite flow per D-INVITE-2).
- `src/app/api/teacher/fabricators/[id]/route.ts` — PATCH: body `{ is_active?: boolean }` to deactivate. DELETE returns 405 (we don't hard-delete per D-INVITE-3).
- `src/app/api/teacher/fabricators/[id]/reset-password/route.ts` — POST: creates new `is_setup=true` session, deletes any prior `is_setup=true` sessions for this fabricator, sends `set_password_reset` email.
- `src/app/api/teacher/fabricators/[id]/machines/route.ts` — PATCH: body `{ machineIds: string[] }`. Deletes all existing `fabricator_machines` rows for this fabricator, inserts the new set. Guard: each machineId must be a `machine_profiles.id` owned by this teacher or a system template.
- Sidebar nav link addition: grep for existing teacher sidebar component, add Preflight entry above Settings per D-ADMIN-1.
- `src/app/teacher/preflight/fabricators/__tests__/invite-api.test.ts` — 6+ tests: fresh invite succeeds with 200, email helper called with correct args, resend on existing email returns 409 without `?resend=true` param, resend WITH param deletes old setup session + creates new, email failure returns 500 with rollback, rate-limit (optional — maybe P2).

**Commit:** `feat(preflight): teacher Fabricator admin page + invite/reset/deactivate API (1B-2-4)`

---

### 1B-2-5 — Student notify-email preference extension

Tiny server-only extension. UI toggle explicitly deferred to Phase 2 per D-STUDENT-1.

**Files:**
- `src/app/api/student/studio-preferences/route.ts` — edit the existing PATCH handler to accept optional `fabricationNotifyEmail: boolean`. Validate boolean, update `students.fabrication_notify_email` via service-role supabase client.
- `src/app/api/student/studio-preferences/__tests__/preferences.test.ts` (may or may not exist — check; if not, add minimal test for fabricationNotifyEmail field only — don't expand coverage of pre-existing fields, Lesson #45).

**Commit:** `feat(preflight): PATCH studio-preferences accepts fabricationNotifyEmail (1B-2-5)`

---

### 1B-2-6 — WIRING sync + api-registry rerun + Checkpoint 1.1B-2 report

Phase-level wrap-up. No code; registry edits + scanner rerun + report.

**Steps:**
1. Rerun `python3 scripts/registry/scan-api-routes.py --apply` — expect ~8 new routes landed in api-registry.yaml. Review diff, commit.
2. Update `docs/projects/WIRING.yaml`:
   - `preflight-pipeline.affects`: add `students`, confirm `teacher-dashboard` already there, add `teacher-sidebar-nav` if tracked.
   - `preflight-pipeline.key_files`: append new /fab and /teacher/preflight paths + `src/lib/fab/auth.ts` + `src/lib/preflight/email.ts`.
   - Possibly new system `preflight-fabricator-auth` (parallel to `student-auth-system` if one exists) — audit WIRING first.
3. Update `docs/projects/preflight-phase-1b-2-brief.md` with a `## Completion summary` section at the bottom logging what shipped.
4. Update `docs/projects/ALL-PROJECTS.md` Preflight block: "Phase 1B-2 SHIPPED" with date + commit range.
5. Write Checkpoint 1.1B-2 report in chat.

**Commit:** `docs(preflight): WIRING + api-registry sync + ALL-PROJECTS update (1B-2-6)`

---

## Success criteria (Checkpoint 1.1B-2)

- [ ] `npm test` — still 1362 passing OR + N new tests, 8 skipped. **No regression.** Target: ~1400 passing (est +35 tests across sub-tasks).
- [ ] `npx tsc --noEmit` — 0 errors except pre-existing FU-MM drift (Dimensions3 adapter + checkpoint-1-2 ingestion type issues). Document the expected pre-existing errors in pre-work capture.
- [ ] End-to-end smoke: Matt can invite himself at `/teacher/preflight/fabricators` → receives email at `hello@loominary.org` → follows link to `/fab/set-password` → sets password → redirects to `/fab/queue` placeholder → logs out → `/fab/login` works with new credentials.
- [ ] Teacher sidebar has Preflight link routing to `/teacher/preflight/fabricators`.
- [ ] Email helper `sendFabricationEmail` idempotency proven via unit test: calling twice with same `{jobId, kind}` sends once, second call no-ops.
- [ ] `PATCH /api/student/studio-preferences` accepts `fabricationNotifyEmail: boolean` and writes to `students.fabrication_notify_email`.
- [ ] All 6 commits exist as separate commits on `main`. `phase-1b-2-wip` backup branch pushed.
- [ ] Checkpoint report in chat with: pre-work findings per sub-task, test count delta, tsc result, commit hashes, smoke test evidence, any FU items filed.

---

## Stop triggers (halt, report, wait for Matt)

- Pre-flight audit finds existing `/fab/*`, `/teacher/preflight/*`, or `src/lib/fab/` code (greenfield assumption violated) → halt, investigate whether a prior session partially shipped.
- `bcryptjs` not found in `package.json` → halt, investigate before installing (may already be under a different name).
- Email send fails to `hello@loominary.org` Resend sender with "domain not verified" → halt; may indicate DNS propagation regression. Fallback to `alerts@studioloom.app` only with Matt's say-so.
- Any `/fab/*` route accidentally uses `supabase.auth.getUser()` or `requireStudentAuth` / `requireTeacherAuth` → halt, Lesson #9 violation. Refactor to `requireFabricatorAuth`.
- `Set-Cookie` header doesn't appear in production response headers on `/api/fab/login` → halt, Lesson #11 check. Verify `Cache-Control: private` set and `next.config.ts` aligned.
- Email helper writes to `notifications_sent` using JSON replacement instead of merge → halt, Lesson #42 pattern (preserve existing keys in JSONB).
- Test count drops below 1362 → halt; refactor broke an existing test.
- Invite flow's email helper call fails mid-insert (partial row committed) → halt, add transaction wrapper before retrying.

---

## Don't stop for

- Pre-existing TS errors in `src/lib/pipeline/adapters/__tests__/adapters.test.ts` + `tests/e2e/checkpoint-1-2-ingestion.test.ts` (FU-MM P3).
- `fabrication_jobs.lab_tech_picked_up_by` still raw UUID without FK (intentional, deferred per 1B-1 brief).
- `admin_settings.updated_at` not auto-bumped on UPDATE (pre-existing, not this phase).
- Warnings about RLS-enabled-no-policy tables — all 7 intentional per FU-FF.
- Pre-existing unrelated mods in working tree (dimensions3.md, ingestion-pipeline-summary.md, .pptx).
- Scanner reports' JSON timestamps changing every rerun (expected).

---

## Out of scope (deferred)

| Deferred to | Why |
|---|---|
| Phase 2 | Scanner worker on Fly.io; `/fab/queue` real UI; `/fab/jobs/[jobId]` pickup/complete flow; `/student/preflight/submit` upload page; `/teacher/preflight` queue landing page; status-transition email TRIGGERS (helper exists; no transitions yet without scanner) |
| Phase 2 | Student visible toggle for `fabrication_notify_email` — UI placement waits for `/student/preflight/*` natural home |
| Phase 8+ | Machine profile admin page at `/teacher/settings/machines` (spec §3.5); Fabricator multi-tenancy when school entity lands (FU-P) |
| Future FU | FK hardening on `fabrication_jobs.lab_tech_picked_up_by → fabricators(id)`; `fabricators.email_verified_at` column; weekly Fabricator digest email; per-class override of `requires_teacher_approval`; unified loominary.org-only sender story (currently alerts@studioloom.app still works for cost alerts) |

---

## Execution note

Same rhythm as 1B-1 — Code (me) executes in this session. Per sub-task:

1. I write the instruction block for the sub-task
2. Matt reviews, signs off
3. Code writes files + runs tests
4. I commit, push to `phase-1b-2-wip` (not main)
5. Report to Matt; next sub-task on green

Checkpoint 1.1B-2 happens once all 6 commits land and smoke test passes end-to-end (real email to hello@loominary.org, real set-password, real login).

---

## Instruction block — Sub-task 1B-2-1 ONLY

**Copy the block below into Claude Code (or let me execute it directly). After it completes and reports, Matt signs off or requests changes BEFORE proceeding to 1B-2-2.**

```
# Preflight Phase 1B-2-1 — Email helper library + idempotency
# Repo: /Users/matt/CWORK/questerra
# Spec: docs/projects/fabrication-pipeline.md §10; candidate 098d (notifications_sent JSONB shape)
# Brief: docs/projects/preflight-phase-1b-2-brief.md (1B-2-1 section)
# Decisions: D-EM-1, D-EM-2, D-EM-3 in the brief

## Pre-work (do ALL before writing code)

1. cd ~/CWORK/questerra && pwd
   git status                      # clean tree, on main, HEAD at 92b0545
   git branch --show-current       # main

2. npm test 2>&1 | tail -5
   # Expected: 1362 passing, 8 skipped (baseline from saveme).
   # If different, STOP AND REPORT new baseline.

3. npx tsc --noEmit 2>&1 | tail -10
   # Expected: 5 pre-existing errors in src/lib/pipeline/adapters/__tests__/adapters.test.ts
   # + tests/e2e/checkpoint-1-2-ingestion.test.ts (FU-MM drift).
   # No NEW errors allowed after this phase.

4. Re-audit greenfield assumption:
   ls src/lib/preflight 2>&1         # must NOT exist
   ls src/lib/fab 2>&1               # must NOT exist
   ls src/app/fab 2>&1               # must NOT exist

5. Read the Resend pattern IN FULL:
   cat src/lib/monitoring/cost-alert-delivery.ts
   # Note: fetch-based, falls back to console when no key, tries/catches network.

6. Read the idempotency target schema:
   grep -A3 "notifications_sent" supabase/migrations/098_*.sql
   # Confirm JSONB type, nullable.

7. Read Lessons #11 (line 49), #38 (line 141), #42 (line 220), #43-46 (line 236)
   in FULL from docs/lessons-learned.md. No titles-only skim.

8. STOP AND REPORT findings + write ASSUMPTIONS block (Lesson #43).
   Wait for sign-off before writing code.

## Action: create src/lib/preflight/email.ts

Write `src/lib/preflight/email.ts`:

- Exports `type FabricationEmailKind = 'invite' | 'set_password_reset' | 'submitted' | 'approved' | 'returned' | 'rejected' | 'picked_up' | 'printing_started' | 'completed';`
- Exports `interface SendFabricationEmailParams { jobId: string | null; kind: FabricationEmailKind; to: string; subject: string; html: string; supabase: SupabaseClient; }`
- Exports `interface SendFabricationEmailResult { sent: boolean; skipped: boolean; reason?: string; }`
- Exports `async function sendFabricationEmail(params: SendFabricationEmailParams): Promise<SendFabricationEmailResult>`.

Behaviour:
1. If `kind === 'invite'` or `kind === 'set_password_reset'`:
   - `jobId` MUST be null (assert via `if (jobId !== null) throw new Error(...)`)
   - Skip idempotency check (no fabrication_jobs row to update)
   - Dispatch via Resend; return `{ sent: true, skipped: false }` on 2xx
2. For all other kinds:
   - `jobId` MUST be non-null (assert)
   - Read `fabrication_jobs.notifications_sent` for that jobId
   - Build idempotency key: `${kind}_at`
   - If that key exists in notifications_sent, return `{ sent: false, skipped: true, reason: 'Already sent' }` WITHOUT dispatching
   - Otherwise: dispatch via Resend
   - On 2xx response: UPDATE fabrication_jobs SET notifications_sent = COALESCE(notifications_sent, '{}'::jsonb) || jsonb_build_object(<key>, <now()>)
     - **IMPORTANT:** JSONB merge (||), never replacement. Preserves other keys (Lesson #42).
   - On error: return `{ sent: false, skipped: false, reason: 'Resend 4xx...' }` — do NOT write notifications_sent.
3. Sender: `Preflight <hello@loominary.org>`.
4. No `RESEND_API_KEY`: `console.log` the payload (dev mode fallback) and return `{ sent: false, skipped: false, reason: 'RESEND_API_KEY not set — logged to console' }`.
5. Catch all network errors: return `{ sent: false, skipped: false, reason: err.message }`.

## Action: create src/lib/preflight/email-templates.ts

Export 2 functions (Phase 2 adds the rest):
- `renderInviteEmail({ setPasswordUrl, displayName, teacherName, teacherDisplayName? })`: returns HTML string. StudioLoom/Preflight brand gradient header, 600px table layout, inline styles, call-to-action button, fallback text link at bottom, 24h expiry notice.
- `renderResetPasswordEmail({ setPasswordUrl, displayName })`: similar styling; copy says "reset password" not "welcome".
- Export 7 stub functions for Phase 2 email kinds, each returning `'<p>TODO Phase 2</p>'` — names: `renderSubmittedEmail`, `renderApprovedEmail`, `renderReturnedEmail`, `renderRejectedEmail`, `renderPickedUpEmail`, `renderPrintingStartedEmail`, `renderCompletedEmail`. This prevents Phase 2 callers from importing a type that doesn't exist.

Use existing email templates in `supabase/email-templates/invite.html` as visual reference for gradient + layout.

## Action: create src/lib/preflight/__tests__/email.test.ts

Use vitest + mock fetch. 8 tests, each asserts SPECIFIC expected values (Lesson #38):

1. `invite kind with jobId=null dispatches via Resend, returns sent=true`
2. `invite kind with jobId non-null throws`
3. `submitted kind with jobId=null throws`
4. `submitted kind dispatches when notifications_sent is null`
5. `submitted kind SKIPS when notifications_sent.submitted_at already set, returns sent=false skipped=true`
6. `submitted kind SUCCESS writes notifications_sent.submitted_at via JSONB merge (preserves other keys)`
7. `missing RESEND_API_KEY returns reason "logged to console" and does NOT hit Resend`
8. `Resend 500 response returns sent=false skipped=false, does NOT write notifications_sent`

Each test asserts the Supabase mock received the EXPECTED update shape, not just `.update` called.

## Action: create src/lib/preflight/__tests__/email-templates.test.ts

3 tests:
1. `renderInviteEmail outputs HTML containing setPasswordUrl and displayName`
2. `renderResetPasswordEmail outputs HTML containing setPasswordUrl`
3. `7 Phase-2 stubs all return <p>TODO Phase 2</p>` (proves they exist)

## Verify

9. `npm test 2>&1 | tail -10`
   # Expected: 1362 + 11 new = 1373 passing (approximate — could be 12 or 13 depending on test granularity)
   # 8 skipped unchanged.

10. `npx tsc --noEmit 2>&1 | tail -10`
    # Expected: SAME 5 pre-existing errors only. No new errors.

11. Run a manual dev-mode test WITHOUT RESEND_API_KEY set (unset it):
    # In a Node REPL or ad-hoc script, import and call:
    #   sendFabricationEmail({ jobId: null, kind: 'invite', to: 'matt@example.com',
    #                          subject: 'test', html: '<p>test</p>', supabase: mockClient })
    # Assert: console shows the payload, result = { sent: false, skipped: false, reason: 'RESEND_API_KEY not set — logged to console' }

## Negative control (Lesson #38)

12. Temporarily break test #5 (idempotency): edit email.ts to send even when key exists.
    Run `npm test -- email.test.ts`
    # Expected: test #5 fails with expected-vs-actual mismatch.
    Revert via Edit tool (Lesson #41 — uncommitted).
    Re-run: all tests pass.

## Commit

13. git add src/lib/preflight/
    git status
    # Expect: only files under src/lib/preflight/ staged. Nothing else.

14. git commit -m "$(cat <<'EOF'
    feat(preflight): email helper lib + idempotency via notifications_sent (1B-2-1)

    - sendFabricationEmail: single dispatch function for all Preflight emails
    - Idempotent writes to fabrication_jobs.notifications_sent via JSONB merge (Lesson #42)
    - invite/set_password_reset kinds skip idempotency (no job context, jobId=null)
    - RESEND via fetch pattern matching cost-alert-delivery.ts (no package dep)
    - Falls back to console.log when RESEND_API_KEY unset (dev mode)
    - Sender: Preflight <hello@loominary.org> per D-EM-1 (loominary.org verified in Resend)
    - 11 new unit tests; all assert specific expected values (Lesson #38)

    Ref: docs/projects/preflight-phase-1b-2-brief.md (1B-2-1)
    EOF
    )"

15. git push origin main:phase-1b-2-wip
    # Backup only. Do NOT push to origin/main.

## STOP AND REPORT

- Pre-work findings: tsc pre-existing count, greenfield confirmed, lessons re-read
- Files created: list with line counts
- New test count delta
- tsc delta (should be 0 new errors)
- NC results (did test #5 fail when expected? Did revert restore green?)
- Manual REPL test output
- Commit hash + `git log --oneline -3`
- phase-1b-2-wip push status
- Any FU items filed

Do NOT proceed to 1B-2-2 until Matt signs off.
```

---

## What happens after 1B-2-1 signs off

I'll write the 1B-2-2 instruction block (Fabricator auth helper + `/fab/login` + `/api/fab/login` route + cookie handling + Lesson #11 Cache-Control discipline). That's the biggest sub-task — probably ~7 files.

Then 1B-2-3 (`/fab/set-password` flow), 1B-2-4 (teacher admin page + invite API — uses 1B-2-1 email helper), 1B-2-5 (student preference extension — smallest), 1B-2-6 (WIRING sync + Checkpoint report).

Each gets its own pre-work → audit → write → test → NC → commit → report cycle.
