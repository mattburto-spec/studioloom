# Phase 1 — Auth Unification: Build Brief

**Project:** Access Model v2
**Phase:** 1 of 6
**Estimate:** ~3 days
**Branch:** `access-model-v2-phase-1` (off `main` @ `5ce589b`)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**Master spec:** [`docs/projects/access-model-v2.md`](./access-model-v2.md)
**Phase 0 brief (for context):** [`docs/projects/access-model-v2-phase-0-brief.md`](./access-model-v2-phase-0-brief.md)
**Methodology:** [`docs/build-methodology.md`](../build-methodology.md)
**Author:** Drafted 29 April 2026 PM after Phase 0 sign-off
**Gate:** Matt Checkpoint **A2** — see §6

---

## 1. Goal

Make every student a real `auth.users` row. Build one unified session helper. Migrate every student-facing route to use it. Replace the legacy `questerra_student_session` token system as the load-bearing path.

**This is the load-bearing rewrite.** Phase 0 was schema seams. Phase 1 is when those seams start carrying weight. After Checkpoint A2, RLS becomes the primary line of defense for student data — not app-level filtering against a service-role client.

### Why now

- Phase 0 added `students.user_id` (FK to `auth.users`), but every row is NULL. The column is dormant until Phase 1 backfills it.
- Today every `/api/student/*` route uses `createAdminClient()` — bypasses RLS. App-level filters are the only line of defense against cross-student data reads. One missed `WHERE student_id = …` and you've shipped a leak.
- China-locked classes (PIPL) need classcode+name to keep working — this isn't a kill-the-classcode-flow project. It's a **make classcode+name mint a real auth.users session** project.
- Forward-declared RLS policies (`quest_journeys`, `design_conversations`) already use `auth.uid()` — they're waiting for student auth.users rows to exist.

### Non-goals

- OAuth (Google/Microsoft/Apple) — Phase 2.
- Email/password student login — Phase 2.
- Per-class auth-mode allowlist UI — Phase 2.
- Class-level role permissions (`class_members`, co-teacher invite) — Phase 3.
- School registration / governance — Phase 4.
- Audit log wiring on every mutation — Phase 5 (Phase 1 only adds it for new login routes).
- Per-student AI budget enforcement — Phase 5.
- Deleting the legacy student token system — Phase 6 (Phase 1 leaves it callable as fallback during the migration window).

---

## 2. Pre-flight ritual

Before touching any code, this checklist:

- [ ] **Working tree clean.** `git status` empty. (Already verified.)
- [ ] **Baseline tests green.** `npm test` reports 2642+ passed in the access-v2 worktree (matches main as of `5ce589b`).
- [ ] **Typecheck clean.** `npx tsc --noEmit --project tsconfig.check.json` exits 0.
- [ ] **Active-sessions row claimed.** Add a row to `/Users/matt/CWORK/.active-sessions.txt` for `access-model-v2-phase-1` worktree. Remove on phase close.
- [ ] **Re-read these Lessons** (numbered list per `docs/lessons-learned.md`):
  - **#43 — Think before coding.** Surface assumptions before writing. The synthetic email decision (§4.2) is one of those assumptions; lock it in writing before code.
  - **#47 — Audit every writer first.** Before changing any helper, list every route that calls it (audit done — see §3 below; 63 routes, all uniform).
  - **#49 — Layout auth gates need public-paths allowlist.** Middleware changes must NOT trap unauthenticated users on the login page.
  - **#51 — Supabase RLS PL/pgSQL gotcha.** RLS migrations get reviewed in dashboard; expect the safety prompt to mis-parse `student_id` as a table name. Use `enable RLS` + raw SQL CREATE POLICY, not the prompt.
  - **#54 — WIRING.yaml can lie.** Don't trust `auth-system` entry's "complete" claims; verify every helper exists where the audit (§3) says it does.
  - **#60 — Side-findings belong in the same commit.** If migrating a route surfaces a bug in `resolveStudentClassId`, fix it inline; don't file a follow-up.
  - **#61 — Index predicates can't be non-IMMUTABLE.** Just bit Phase 0. If any new index in Phase 1 has a `WHERE` clause, verify functions inside are IMMUTABLE.
- [ ] **Read [Phase 0 audit summary](#3-audit--surface-of-this-phase) below**, confirm understanding of every helper that must be COMPOSED (not re-implemented).
- [ ] **STOP and report findings.** Confirm with Matt that the brief still matches the audit. Wait for explicit "go" before §4.

---

## 3. Audit — surface of this phase

Compiled by an Explore agent run on 29 April 2026 PM. Numbers are exact.

### 3.1 Existing student auth helpers

| Function | File | Returns | Notes |
|---|---|---|---|
| `getStudentId(request)` | `src/lib/auth/student.ts:23–38` | `string \| null` | Reads `questerra_student_session` cookie → looks up `student_sessions` table |
| `requireStudentAuth(request)` | `src/lib/auth/student.ts:64–74` | `{ studentId } \| { error: NextResponse }` | Standard auth gate; called by all 63 student routes |
| `studentUnauthorized()` | `src/lib/auth/student.ts:43–45` | `NextResponse` (401) | Generic 401 |
| `studentInvalidSession()` | `src/lib/auth/student.ts:50–52` | `NextResponse` (401) | Session-expired 401 |

**Single login route:** `/api/auth/student-login` — classcode + username, mints `nanoid(48)`, inserts `student_sessions`, sets HTTPOnly `questerra_student_session` cookie (7-day TTL, SameSite=lax, Secure in prod).

**Single session-validation route:** `/api/auth/student-session` — GET only, returns student + class data.

**No student logout route exists.** Client-side cookie clear only. Phase 1 should add one (POST `/api/auth/student-logout`).

### 3.2 Helpers Phase 1 must COMPOSE (do NOT re-implement)

| Helper | File / Migration | Status |
|---|---|---|
| `verifyTeacherCanManageStudent(teacherId, studentId)` | `src/lib/auth/verify-teacher-unit.ts:167–194` | ✅ Confirmed |
| `resolveStudentClassId(input)` | `src/lib/student-support/resolve-class-id.ts:76–136` | ✅ Confirmed |
| `current_teacher_school_id()` Postgres function | Migration `20260427134953_fabrication_labs.sql` | ✅ Confirmed; SECURITY DEFINER |
| `students.user_id` column (FK to auth.users) | Migration `20260428142618_user_profiles.sql` (Phase 0) | ✅ Confirmed; NULL for all rows pre-Phase 1 |
| `user_profiles` table + `handle_new_user_profile` trigger | Same migration | ✅ Confirmed; trigger fires on auth.users INSERT |

### 3.3 Routes to migrate

**63 routes under `/api/student/**/route.ts`** — verified count via `find src/app/api/student -name 'route.ts' \| wc -l`.

Categories (rough):

| Category | Approx count | Examples |
|---|---|---|
| Core student data | 8 | progress, grades, units, insights, me/* |
| Learning tools | 6 | design-assistant, word-lookup, planning, tile-comments |
| Toolkit + tool-sessions | 4 | tool-sessions, search |
| Discovery / Open Studio / Quest | 9 | discovery/*, quest/*, open-studio/* |
| Gallery + peer review | 4 | gallery/submit, gallery/feedback, gallery/review, gallery/submissions |
| Safety + skills | 5 | safety/badges, safety/pending, skills, safety-certs |
| NM / competency | 2 | nm-assessment, nm-checkpoint |
| Fabrication (Preflight) | 4 | fabrication/jobs, fabrication/upload, picker-data, scan-status |
| Studio prefs / portfolio | 4 | studio-preferences, portfolio, learning-profile, avatar |
| Misc (own-time, search, next-class) | ~17 | … |

**Auth pattern is 100% uniform** across all 63: `const auth = await requireStudentAuth(request); if (auth.error) return auth.error;`. No legacy inline token parsing. **This uniformity is the single biggest gift.** Phase 1 changes one helper internal — every route benefits.

**All 63 use `createAdminClient()`** to bypass RLS. After Phase 1, this should switch to an RLS-respecting client for student-owned data reads. Audit + migration of the client itself happens in §4.4.

### 3.4 Student-facing pages

23 pages under `src/app/(student)/`:
- `/dashboard`, `/dashboard-legacy`
- `/unit/[unitId]/...` (lesson, page, etc.)
- `/discovery/*`, `/open-studio/*`, `/quest/*`
- `/gallery/*`, `/skills`, `/safety`, `/fabrication/*`
- Plus profile, portfolio, search.

Pages don't read student auth themselves — they fetch from `/api/student/me/*` and friends, so migration is implicitly handled by API migration. **Verify** in §4.4 by `grep -rn "questerra_student_session" src/app/`.

### 3.5 RLS simplification candidates (Phase 1.5)

Once `auth.uid()` resolves to a student's auth.users id, these policies simplify:

| Table | Current pattern | After Phase 1 |
|---|---|---|
| `students` | Teacher-managed via class chain | Add: students read own row (`auth.uid() = user_id`) |
| `class_students` | Class-scoped | Add: students read own enrollments |
| `student_progress` | Student reads own + teacher access | Simplify student-side to `auth.uid()` |
| `competency_assessments` | Per-class teacher read | Add: students read own assessments |
| `quest_journeys` | **Already uses `auth.uid()`** | Just becomes live (was forward-declared) |
| `design_conversations` | **Already uses `auth.uid()`** | Just becomes live |
| `fabrication_scan_jobs` | Service-role admin client today | Add student own-job read policy |

Limit Phase 1 RLS work to these 7. Other student-touching tables get audited at Checkpoint A2; if simplification adds risk without payoff, defer to Phase 6.

### 3.6 Risk surface (top 4)

1. **Service-role → RLS-respecting client switch.** All 63 routes use admin client. If Phase 1 leaves them on admin client, RLS doesn't engage — students still cross-read on a missed app-level filter. **Mitigation:** §4.4 sub-phase explicitly covers client migration; Checkpoint A2 includes a synthetic cross-class test.
2. **Cookie shape transition.** Old `questerra_student_session` (custom token) → new `sb-<hash>-auth-token` (Supabase). During migration, both may exist. **Mitigation:** §4.3 covers the dual-cookie grace period; clients keep working during the window.
3. **`resolveStudentClassId` unit-only fallback ambiguity.** A student in two classes that share a unit could resolve to the wrong class context. Already known. **Mitigation:** Phase 1 deprecates unit-only fallback in the new helper; routes must pass classId explicitly. Old helper kept callable for legacy flows during transition.
4. **`quest_journeys` JWT claim populated by Supabase auth, not custom tokens.** When the policy reads `current_setting('request.jwt.claims', true)::json->>'sub'`, it expects the Supabase session's `sub` claim. **Mitigation:** Supabase auth handles this automatically once students log in via the new flow. Verify with the live RLS harness at Checkpoint A2.

---

## 4. Phase 1 sub-phases

Each sub-phase is a separate commit (or small commit chain). No squashing.

### 4.1 Backfill: every student → auth.users row

**Goal:** Every row in `students` has a non-NULL `user_id` pointing at a real `auth.users` row.

**Migration:** `supabase/migrations/<TIMESTAMP>_phase_1_1_student_auth_users_backfill.sql`

**Procedure (script lives in `scripts/access-v2/backfill-student-auth-users.ts`, called from a one-shot migration node):**

1. **Synthetic email format:** `student-<student_uuid>@students.studioloom.local`. Locked decision because:
   - Supabase requires non-NULL email on auth.users
   - Students never log in by email (PIPL); the value is opaque
   - `.local` TLD is reserved (RFC 6762) — guarantees no collision with real domains
   - Each student gets a deterministic email derived from their stable UUID — re-runnable
2. **App metadata:** `app_metadata.user_type = 'student'`, `app_metadata.school_id = <derived>`, `app_metadata.created_via = 'phase-1-backfill'`. The `user_type` claim is what `getActorSession()` reads to dispatch.
3. **Idempotent:** if `students.user_id IS NOT NULL`, skip. If a previous run partially succeeded, the next run completes the rest.
4. **Dry-run first:** `--dry-run` flag prints `(student_id, email, school_id)` for first 5 rows + total count. No writes.
5. **Apply to prod:** Matt runs live after dry-run looks clean. RLS still bypassed via service role.
6. **Trigger fires:** Phase 0's `handle_new_user_profile` trigger creates a `user_profiles` row per new auth.users row. Verify in dry-run output.
7. **Roll-back script:** `down` migration deletes auth.users rows where `app_metadata->>'created_via' = 'phase-1-backfill'`, sets `students.user_id = NULL`. Tested in test branch first.

**Tests:**
- Unit test: backfill on a 3-student fixture creates 3 auth.users rows, populates 3 user_id values, idempotent on re-run.
- Live: post-apply, query `SELECT COUNT(*) FROM students WHERE user_id IS NULL` → 0.
- Live: query `SELECT COUNT(*) FROM auth.users WHERE app_metadata->>'user_type' = 'student'` → matches student count.
- Live: query `SELECT COUNT(*) FROM user_profiles WHERE user_type = 'student'` → matches student count (trigger fired).

**Stop trigger:** any backfill row fails. Investigate before proceeding.

### 4.2 New custom Supabase auth flow for classcode+name

**Goal:** Mint a real Supabase session for a student logging in by classcode+name. The China-compatible flow stays user-visible identical.

**New route:** `POST /api/auth/student-classcode-login`

**Procedure:**

1. Body: `{ classcode, name }`. Same validation rules as legacy route.
2. Look up student row by classcode + name (matches existing `/api/auth/student-login` lookup logic).
3. Read `students.user_id` (now populated post-§4.1).
4. Mint a Supabase session:
   - Use `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })` to get a session token
   - OR (preferred) use `supabaseAdmin.auth.admin.createSession({ user_id })` if available
   - Falling back to `signInWithIdToken` flow with a server-minted JWT may be cleaner — research first commit
5. Set Supabase session cookies on the response (`sb-access-token`, `sb-refresh-token` — Next.js Supabase SSR client handles this if we use `@supabase/ssr`).
6. **Old route stays.** `/api/auth/student-login` continues to work for clients that haven't migrated yet — see §4.3 grace period.
7. **Audit log:** insert `audit_events` row with `event_type='student.login.classcode'`, `actor_user_id=<student.user_id>`, `metadata={class_id, ip}`. (First Phase 5 wire-in, lands here because login routes are non-negotiable.)

**Tests:**
- Unit: mock the Supabase admin client; verify session minted with right user_id.
- Unit: invalid classcode → 401; missing name → 400.
- Integration (test branch): real Supabase test project; login mints valid session, cookies set, `/api/student/me/*` returns student data via the new session.

**Stop trigger:** session minting requires a Supabase capability we don't have on Pro Small tier. Pause + research before continuing.

### 4.3 Build `getStudentSession()` + `getActorSession()` helpers

**Goal:** Single entry point all student routes call. Composes existing helpers; doesn't re-implement.

**New file:** `src/lib/auth/actor.ts`

**API:**

```typescript
type StudentSession = {
  type: "student";
  studentId: string;       // students.id
  userId: string;           // auth.users.id (= students.user_id)
  schoolId: string | null;  // students.school_id
  // Lazy: callers ask for class via resolveStudentClassId()
};

type TeacherSession = {
  type: "teacher";
  teacherId: string;       // teachers.id (= auth.users.id, since teachers are 1:1)
  userId: string;
  schoolId: string | null;
  isPlatformAdmin: boolean;
};

type ActorSession = StudentSession | TeacherSession;

// Reads Supabase SSR cookies → returns student session or null
async function getStudentSession(request: NextRequest): Promise<StudentSession | null>;

// Polymorphic: dispatches on auth.users.app_metadata.user_type
async function getActorSession(request: NextRequest): Promise<ActorSession | null>;

// Convenience wrappers (preserve existing API shape)
async function requireStudentSession(request: NextRequest): Promise<StudentSession | NextResponse>;
async function requireActorSession(request: NextRequest): Promise<ActorSession | NextResponse>;
```

**Backwards compat:** the existing `requireStudentAuth(request)` returning `{ studentId }` is rewritten to internally call `getStudentSession()`, **with a fallback to legacy `questerra_student_session` cookie** during the grace window. After all 63 routes migrate to `requireStudentSession()` (§4.4), the legacy fallback is removed in Phase 1.6.

**Inside `getStudentSession()`:**

1. Read Supabase session via `@supabase/ssr` SSR client.
2. If no session OR `app_metadata.user_type !== 'student'` → return null.
3. Look up `students` row by `user_id = auth.users.id`. (One DB read per request — same shape as today's session lookup.)
4. Return `StudentSession` shape.
5. **Compose existing helpers** for class context: callers wanting `classId` call `resolveStudentClassId()` themselves with the studentId. Don't bake class resolution into `getStudentSession()` — keeps it cheap for routes that don't need it.

**Tests:**
- Unit: mock SSR client; valid session returns StudentSession; missing → null; teacher session via getActorSession returns TeacherSession.
- Unit: `requireStudentSession` returns 401 NextResponse on null.

**Stop trigger:** if `@supabase/ssr` doesn't expose the SSR client cleanly in Next.js 15 (possible API change since Phase 0 audit), pause and document.

### 4.4 Migrate routes — 3 batches

**Goal:** All 63 student routes use `requireStudentSession()` (or `requireActorSession()` where polymorphic).

**Batch A — read-only data (~21 routes, low risk):**

`/api/student/me/*`, `/api/student/grades`, `/api/student/units`, `/api/student/progress`, `/api/student/insights`, `/api/student/portfolio`, `/api/student/skills`, `/api/student/safety/badges`, `/api/student/safety/pending`, `/api/student/next-class`, `/api/student/search`, `/api/student/learning-profile` (GET), `/api/student/avatar` (GET), `/api/student/studio-preferences` (GET), `/api/student/own-time` (GET), `/api/student/safety-certs`.

For each:
1. Replace `requireStudentAuth` call with `requireStudentSession`.
2. Switch `createAdminClient()` to RLS-respecting SSR client where the query reads student-owned data.
3. Verify result shape unchanged (call from a test client).
4. Commit per-batch with `feat(access-v2): batch A — migrate read-only student routes to getStudentSession`.

**Batch B — mutations (~21 routes, medium risk):**

Tool sessions, planning, tile-comments, design-assistant, gallery submit/feedback, NM checkpoint, learning-profile (PATCH), avatar (PUT), studio-preferences (PATCH), discovery/* writes, quest/* writes, open-studio writes, fabrication/jobs (POST), fabrication/upload, safety/check-requirements, etc.

Per-route:
1. Same swap as Batch A.
2. Add `audit_events` insert if mutation is significant (Phase 5 will add for everything; Phase 1 covers login + a handful of high-stakes mutations identified at audit time).
3. Switch RLS client.

**Batch C — student-touching teacher routes + middleware (~21 routes, high risk):**

Teacher routes that read student data via `verifyTeacherCanManageStudent`. These should switch to `requireActorSession()` and dispatch on actor type. Middleware (`src/middleware.ts`) gets the polymorphic helper too.

Per-route: audit, swap, test.

**Tests:**
- Per batch: full `npm test` run. Snapshot routes' response shapes — should be byte-identical.
- Per batch: smoke test in Vercel preview deploy. Spin up a test student account; hit the migrated routes; confirm responses match prod.

**Stop trigger:** any route returns 500 in preview that wasn't 500 before. Pause; investigate. Don't paper over.

### 4.5 RLS simplification

**Goal:** Tighten RLS on the 7 tables in §3.5 now that students have real `auth.uid()`.

One migration per table (clean diff per audit):

1. `<TS>_phase_1_5_students_self_read.sql` — student reads own row
2. `<TS>_phase_1_5_class_students_self_read.sql` — student reads own enrollments
3. `<TS>_phase_1_5_student_progress_self_read.sql` — simplify
4. `<TS>_phase_1_5_competency_assessments_self_read.sql` — add policy
5. `<TS>_phase_1_5_fabrication_scan_jobs_self_read.sql` — add policy
6. `quest_journeys` — verify existing policy now resolves correctly (no migration needed; just confirm)
7. `design_conversations` — verify (no migration needed)

**Tests:**
- Live RLS harness: write 2 tests per migration. Student A reads own → ok. Student A reads student B's row → 0 rows returned (not 403, just empty — RLS filter behaviour).
- The harness's `students.live.test.ts` skeleton from Phase 0 gets its first real assertions here.

**Stop trigger:** any harness test reads cross-student data. RLS is broken. Fix before next migration.

### 4.6 Negative control + cleanup

**Goal:** Verify Phase 1 actually changed the system — not just made a parallel one.

1. **Negative control test.** Pick one route (suggest `/api/student/grades`). Mutate it to skip `requireStudentSession()`, return data based on a query parameter. Run smoke. Confirm:
   - RLS rejects the read (because the response has no auth context)
   - Or app-level filter rejects (because we removed the student id check)
   - Document the behaviour, then **revert the mutation**.
2. **Update WIRING.yaml** — flip `auth-system` entry from "triple-auth (teacher Supabase, student custom, fabricator opaque)" to "polymorphic (teacher + student in auth.users; fabricator opaque)". Update `change_impacts`.
3. **Update api-registry.yaml** — rerun the scanner, check the diff, commit.
4. **Update schema-registry.yaml** — add `students.user_id` writers/readers.
5. **Document grace period.** New file `docs/security/student-auth-cookie-grace-period.md`. Lists: legacy cookie name, when it stops being read, removal commit (Phase 6).
6. **Add Lesson** if Phase 1 surfaced a hard-won finding worth logging.

---

## 5. Don't-stop-for list

These are things that, if encountered, do not stop Phase 1:

- **OAuth not working** — Phase 2.
- **Email/password student login** — Phase 2.
- **Co-teacher invite flows** — Phase 3.
- **School registration** — Phase 4.
- **Per-student AI budget enforcement** — Phase 5 (Phase 1 only adds audit_events on login routes).
- **Audit log on every mutation** — Phase 5 (Phase 1 covers login + a few high-stakes mutations).
- **Deleting `student_sessions` table** — Phase 6.
- **API versioning rename to `/api/v1/*`** — Phase 6.
- **A test that was already skipped before Phase 1** — leave skipped. Don't pull on threads outside scope.
- **Unrelated WIRING.yaml drift** — flag in commit message, fix at next saveme. Phase 1 only touches `auth-system` and any system whose downstream changes during this phase.
- **Lessons from §47-style discoveries that don't block migration** — log to follow-ups, don't fix inline unless they're inside a file you're already touching (Lesson #60).

---

## 6. Stop triggers

Any of these → pause + report to Matt + wait for "go":

- Backfill (§4.1) returns failures in dry-run.
- Supabase admin SDK doesn't expose `createSession` or equivalent on Pro Small tier.
- `@supabase/ssr` API changed in a way that breaks our SSR client pattern in Next.js 15.
- Cross-student data leak detected by RLS harness (§4.5).
- Cookie domain mismatch in preview deploy that drops sessions.
- Session minting succeeds but `app_metadata.user_type='student'` claim isn't propagated to RLS context (`auth.jwt()->>'user_type'` returns NULL).
- Any route in Batch B/C returns 500 in preview that wasn't 500 before.
- Live RLS harness can't run on the test branch's Supabase project (env vars not set).
- Phase 0 schema seam used in Phase 1 (e.g., `students.user_id`, `user_profiles`) doesn't behave as documented.

---

## 7. Checkpoint A2 — gate criteria

Phase 1 closes when **ALL** of these pass:

### Code

- [ ] All 63 student routes call `requireStudentSession()` (or `requireActorSession()`); zero call `requireStudentAuth()` directly. Verify: `grep -rn "requireStudentAuth" src/app/api/student/ | wc -l` returns 0.
- [ ] Zero routes read `questerra_student_session` cookie directly. Verify: `grep -rn "questerra_student_session" src/ | wc -l` returns hits only in legacy route + cookie constant.
- [ ] No new `createAdminClient()` calls in student routes for student-owned-data reads. (Mutations may still need admin client; reads should respect RLS.)
- [ ] WIRING.yaml `auth-system` updated.
- [ ] api-registry.yaml regenerated.

### Data

- [ ] `SELECT COUNT(*) FROM students WHERE user_id IS NULL` returns 0 in prod.
- [ ] `SELECT COUNT(*) FROM auth.users WHERE app_metadata->>'user_type' = 'student'` matches student count.
- [ ] `SELECT COUNT(*) FROM user_profiles WHERE user_type = 'student'` matches student count (trigger fired correctly).

### Tests

- [ ] `npm test` 2642+ baseline still passes; new tests added (target: +30 to +50 covering helpers + backfill + RLS).
- [ ] `npx tsc --noEmit --project tsconfig.check.json` exits 0.
- [ ] Live RLS harness has at least 5 real tests across the 7 migrated tables; all green.
- [ ] Negative control test (§4.6) was attempted, observed failing, then reverted.

### Smoke (prod or preview)

- [ ] One real student logs in via classcode+name → lands on dashboard.
- [ ] Same student opens a lesson page → reads load.
- [ ] Same student saves tool work → write succeeds, persists.
- [ ] Same student submits a gallery item → submit + feedback flow work.
- [ ] Same student logs in from a SECOND class → resolves correct class context.
- [ ] Teacher loads class hub → all students visible; opens one student profile → loads.
- [ ] In Vercel logs: zero `Invalid session` errors during smoke.

### Documentation

- [ ] Phase 1 brief (this file) committed at start of phase.
- [ ] `docs/security/student-auth-cookie-grace-period.md` written and committed.
- [ ] Decisions log appended (synthetic email format, dual-cookie grace window, batch ordering).
- [ ] Changelog entry written.
- [ ] Active-sessions row removed.
- [ ] `docs/handoff/access-model-v2-phase-1.md` written for the next session.

---

## 8. Risks + mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Supabase auth.admin.createSession() not exposed | Phase 1 stalls | Medium | Research first commit; fallback path documented |
| Cookie shape change drops sessions mid-migration | Students re-login; bad UX | Medium | Dual-cookie grace period in §4.3 |
| RLS policy missed on a table → cross-class read | Data leak | Low (uniformity gift) | RLS harness + cross-student smoke at A2 |
| 63 route migrations stretch past 3 days | Schedule slip | Medium | Batched A/B/C; can ship A in isolation if B/C delay |
| Synthetic email format collides with future real student email | Future Phase 2 OAuth pain | Low | `.local` TLD reserved; documented in decisions log |
| Phase 0 trigger `handle_new_user_profile` fails on a student row | Backfill incomplete | Low | Dry-run + per-row error handling in script |
| `quest_journeys` JWT claim path broken in Supabase v3 | Discovery + Quest features break | Low | Live RLS harness covers it at A2 |

---

## 9. Estimate

Per master plan: ~3 days. Refined here:

| Sub-phase | Estimate |
|---|---|
| §2 Pre-flight | 1–2 hours |
| §4.1 Backfill (incl. dry-run + apply) | 0.5 day |
| §4.2 Custom auth flow | 0.5 day |
| §4.3 Helpers + types | 0.5 day |
| §4.4 Migrate routes (3 batches) | 1 day |
| §4.5 RLS simplification | 0.5 day |
| §4.6 Negative control + cleanup | 0.5 day |
| Buffer (Lesson #59 — estimates lie) | 0.5 day |
| **Total** | **~3.5 days** |

---

## 10. Post-Checkpoint-A2 — what unlocks

- **Phase 2 (OAuth + Email/Password)** can begin. The unified `getActorSession()` is the seam Phase 2 plugs into.
- **Phase 5 RLS work** becomes much smaller — most policies are simplified by then.
- **Pilot readiness** moves from "blocked on auth unification" to "blocked on Phases 2-6". A real first-school onboarding becomes plausible.

---

## 11. References

- Master spec: [`docs/projects/access-model-v2.md`](./access-model-v2.md), §4 Phase Plan, §2 Decision 1
- Phase 0 brief: [`docs/projects/access-model-v2-phase-0-brief.md`](./access-model-v2-phase-0-brief.md)
- Phase 0 changelog entry: `docs/changelog.md` 29 Apr 2026
- Build methodology: [`docs/build-methodology.md`](../build-methodology.md)
- Lessons learned: [`docs/lessons-learned.md`](../lessons-learned.md) — re-read #43, #47, #49, #51, #54, #60, #61
- Phase 0 audit: 29 April 2026 explore-agent report (transcript only; no markdown file)
- Live RLS harness scaffold: `src/lib/access-v2/__tests__/rls-harness/`
- ENCRYPTION_KEY rotation log: `docs/security/encryption-key-rotation.md`
- MFA procedure: `docs/security/mfa-procedure.md`
- Active-sessions tracker: `/Users/matt/CWORK/.active-sessions.txt`

---

## 12. Sign-off

This brief was drafted **before** any Phase 1 code was written, per build methodology.

**Pre-flight checklist (§2) MUST be ticked off** before §4.1 starts.

**Matt's "go"** required after pre-flight, before §4 sub-phases begin.
