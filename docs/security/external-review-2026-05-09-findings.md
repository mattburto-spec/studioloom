# Independent Security Review — 9 May 2026 (post-PR #140/#142/#143/#144)

Reviewer: independent pass focused on what the internal audit + Gemini missed.
Method: ran the 4 scanners, read RLS migrations, grepped call sites, spot-read
auth helpers + chokepoint. Did NOT re-confirm previously-shipped findings.

Scanners status (clean = no drift):
- `scan-rls-coverage.py` — clean (123/123, 5 intentional deny-all)
- `scan-api-routes.py --check-audit-coverage` — clean (7 covered, 231 skipped, 0 missing)
- `scan-api-routes.py --check-budget-coverage` — clean (5/5 student AI routes)
- `scan-role-guards.py` — **DRIFT: 80 routes missing role guard**
- `npm test src/lib/security src/app/api/storage` — could not run (rolldown
  arm64 native binding missing in this sandbox); CI is the source of truth.

---

## P0 — exploitable from a logged-in student JWT, today

### F-1. RLS broken on `student_tool_sessions` — cross-school read/write of all student tool drafts
- **File:** `supabase/migrations/026_student_tool_sessions.sql:62-66`
- **What:** the only RLS policy is
  ```sql
  CREATE POLICY service_role_all ON student_tool_sessions
    FOR ALL USING (true) WITH CHECK (true);
  ```
  No `TO service_role`. In Postgres RLS, that policy applies to every role
  (anon, authenticated, service_role). The policy name is misleading.
- **Exploit:** a student authenticates via classcode-login → has a real
  Supabase JWT + the public anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY in the
  client bundle) → calls
  `https://<proj>.supabase.co/rest/v1/student_tool_sessions?select=*`
  directly. PostgREST applies RLS, policy returns true, full table dump.
  Same for INSERT/UPDATE/DELETE.
- **Why audit missed it:** scanner counts the table as "with policy" (it has
  one). The policy reads as service-role-intent from the name only.
- **Fix:** either make it `RESTRICTIVE` and `TO service_role`, or drop it
  and add per-student policies that use `student_id = current_setting(...)::json->>'sub'`
  the way `quest_journeys` does (mig 046, lines 178–196 — that's the correct
  pattern in this repo).

### F-2. RLS broken on `open_studio_profiles` — cross-school student profile leak
- **File:** `supabase/migrations/031_open_studio_profiles.sql:54-59`
- **What:** identical anti-pattern.
  ```sql
  CREATE POLICY "Service role full access on open_studio_profiles"
    ON open_studio_profiles
    FOR ALL USING (true) WITH CHECK (true);
  ```
- **Exploit:** same direct-PostgREST path as F-1.
- **Sensitivity:** `open_studio_profiles` likely carries student-side
  reflections / discovery-derived data — high PII.

### F-3. RLS broken on `discovery_sessions` — strict policy is moot
- **File:** `supabase/migrations/047_discovery_sessions.sql:51-57`
- **What:** there's a correct student-scoped SELECT policy AND a wide-open
  `discovery_sessions_service_all FOR ALL USING (true) WITH CHECK (true)`.
  Postgres unions multiple **PERMISSIVE** policies, so the wide-open one
  short-circuits the scoped one for every command.
- **Exploit:** any authenticated user reads/writes all discovery sessions.
- **Fix:** mark the service policy `RESTRICTIVE` + `TO service_role`, or
  drop and rely on the scoped policy + admin-client server writes.

### F-4. `gallery_submissions` + `gallery_reviews` — anyone-reads-anything + tautological INSERT
- **File:** `supabase/migrations/049_class_gallery.sql:67-115`
- **What:**
  - `Students read gallery submissions FOR SELECT USING (true)` — direct PostgREST returns every row.
  - `Students insert own submissions WITH CHECK (student_id = student_id)` —
    that's a **tautology**. Almost certainly a typo for
    `student_id = auth.uid()` or the JWT-claim form. Effect: any authenticated
    user can INSERT a submission with any `student_id`.
  - Same pattern on `gallery_reviews` (`WITH CHECK (true)` — `reviewer_id`
    is text, not bound to the JWT).
- **Exploit:** read every class gallery in the system; spam fake peer reviews.
- **Fix:** the same JWT-claim pattern used by mig 046 on `quest_journeys`.

### F-5. `POST /api/teacher/units` `publish` action — any teacher can hijack any unit
- **File:** `src/app/api/teacher/units/route.ts:217-285`
- **What:** the `publish` case does
  ```ts
  await adminClient
    .from("units")
    .update({
      is_published: true,
      author_teacher_id: user.id,        // overwrites real author
      author_name: resolvedAuthorName,
      school_name: resolvedSchoolName,
      tags: tags || [],
    })
    .eq("id", unitId);                    // ← no .eq("author_teacher_id", user.id)
  ```
  Compare to the `unpublish` case in the same file (lines 287–306) which
  does `verifyTeacherHasUnit(user.id, unitId)` first.
- **Exploit:** any logged-in teacher (and, given F-6 below, even a
  student-typed JWT) sends `{action:"publish", unitId:"<any-uuid>"}` and
  overwrites `author_teacher_id` to themselves + force-publishes. Horizontal
  privilege escalation: teacher A → silently steals authorship + publishes
  teacher B's draft unit.
- **Fix:** mirror `unpublish` — call `verifyTeacherHasUnit(user.id, unitId)`
  before the update, OR add `.eq("author_teacher_id", user.id)` predicate.

---

## P1 — high

### F-6. 80 `/api/teacher/*` routes still bypass `requireTeacher` — confirmed exploitable on at least one
- **Source:** `python3 scripts/registry/scan-role-guards.py` →
  `"missing": [80 entries]`, written to `docs/scanner-reports/role-guards.json`.
- **Why it matters:** middleware Phase-6.3b only matches `/teacher/*` page
  routes; the matcher does not cover `/api/*` (this is the exact rationale
  written in `src/lib/auth/require-teacher.ts:6-9`). A student JWT minted by
  classcode-login passes `auth.getUser()` cleanly. Each missing route is
  saved only by *coincidental* downstream checks.
- **Spot-checked routes that still use raw `auth.getUser()`:**
  - `src/app/api/teacher/dashboard/route.ts:80-85`
  - `src/app/api/teacher/units/route.ts:33-38, 109-115` (combined with F-5
    this is the live exploit)
  - `src/app/api/teacher/labs/[id]/bulk-approval/route.ts:41-43`
  - `src/app/api/teacher/grading/release/route.ts:45-46`
  - `src/app/api/teacher/badges/[id]/assign/route.ts:43-49` — **confirmed
    exploitable**: writes directly to `student_badges` via admin client with
    no teacher OR class-membership check. A logged-in **student** can call
    `POST /api/teacher/badges/<safety-badge-uuid>/assign` with
    `{type:"students", studentIds:["<their-own-id>"], note:"..."}` and
    self-grant any safety badge.
  - `src/app/api/teacher/me/unit-use-requests/[requestId]/approve/route.ts:50`
- **Why audit missed it:** the `require-teacher.ts` PR migrated 59 callers;
  the rest were assumed inherited via downstream `loadTeacherSchoolId()` /
  `verifyTeacherHasUnit()`. That assumption holds for many routes (e.g.
  `fabricators/[id]/reset-password` — `loadTeacherSchoolId` 401s a student
  JWT because no `teachers` row matches), but not all. The
  `badges/[id]/assign` path goes straight to admin-client INSERT.
- **Fix:** the existing scanner is the right gate — add an `--enforce` flag
  to make CI red. Migrate the 80 routes to `requireTeacher` in one sweep.

### F-7. `own_time_*` (3 tables) — wide-open SELECT
- **File:** `supabase/migrations/028_own_time.sql:82, 94, 107`
- Same pattern as F-3: each table has a teacher-scoped policy AND a
  permissive `FOR SELECT USING (true)` policy named `*_read`. Cross-class
  student own-time work is dumpable via PostgREST.

### F-8. `open_studio_status` / `open_studio_sessions` — wide-open SELECT
- **File:** `supabase/migrations/029_open_studio.sql:122, 135`
- Same pattern. Student studio status + sessions cross-class via PostgREST.

### F-9. Sentry PII filter doesn't scrub `event.message` or `event.exception`
- **File:** `src/lib/security/sentry-pii-filter.ts:150-179` (`beforeSend`).
- **What:** the redactor walks `contexts`, `extra`, `tags`, `user`, and
  `request.{cookies,headers,data,query_string}`. It does NOT touch
  `event.message` or `event.exception.values[*].value` (the human-readable
  error string).
- **Risk:** any future `throw new Error(\`Failed to fetch student ${student.email}\`)`
  ships the email to Sentry plaintext, even though the existing PII filter
  is "complete" by its own scope. Today's grep finds zero such patterns
  (`grep -rnE "throw new Error.*\\\$\{[^}]*\.(email|display_name|...)"`),
  so no live leak — but the regression net at
  `src/lib/security/__tests__/sentry-pii-filter.test.ts` doesn't cover
  exception/message either.
- **Fix:** scrub `event.message` and `event.exception.values[*].{value,type}`
  with a regex pass keyed off the same `SENSITIVE_KEY_FRAGMENTS` heuristic,
  OR refuse to send any event whose message matches a known PII shape.

### F-10. Sentry Replay sampled at 10% on errors with no masking
- **File:** `src/instrumentation-client.ts:9` — `replaysOnErrorSampleRate: 0.1`,
  no `Sentry.replayIntegration({ ... })` configured.
- **What:** Sentry Replay default masks `<input>` / `<textarea>` text but
  NOT general DOM text. Student names, emails, fabrication queue rows, etc.
  rendered in the page get captured to the Replay payload on any client
  error. 10% of error sessions are sampled.
- **Risk:** session replay is a major PII surface; the rest of the security
  posture (`sendDefaultPii: false`, the redactor) is undermined by a single
  rendered name in the replay clip.
- **Fix:** either set `replaysOnErrorSampleRate: 0` until Replay masking is
  intentionally configured, or add
  ```ts
  integrations: [Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true })]
  ```
  Document the choice in `sentry-pii-scrub-procedure.md`.

---

## P2 — medium

### F-11. `unit-images` + `knowledge-media` proxy is open to any authenticated user
- **File:** `src/app/api/storage/[bucket]/[...path]/authorize.ts:46-49`
- **What:** for these two buckets, `authorizeBucketAccess` short-circuits
  with `{ ok: true }` for any signed-in user. The proxy then mints a
  service-role signed URL (bypassing storage RLS).
- **Why it matters:** `knowledge-media` carries teacher-uploaded teaching
  artefacts. In an international-school context these often include
  photographed student exemplars, whiteboard shots, screenshots with names
  visible. There is no school scoping, no teacher-scoping, no class
  membership check. A student in school A authenticates and reads
  `knowledge-media` artefacts uploaded by teachers in school B.
- **Status:** logged as `FU-SEC-{UNIT-IMAGES,KNOWLEDGE-MEDIA}-SCOPING` but
  not classified as a current finding in the security plan. Recommend
  promoting to P2 active because the IDOR class on the legacy `responses`
  bucket was found by the same exact reasoning.

### F-12. Fabricator login is a timing oracle for email enumeration
- **File:** `src/app/api/fab/login/route.ts:75-94`
- **What:** `bcrypt.compare` runs only after `if (!fabricator) return genericFail()`
  succeeds. Known-email + wrong password takes ~50–200 ms (bcrypt cost);
  unknown email returns immediately. Response-time differential leaks email
  validity.
- **Fix:** run a dummy `bcrypt.compare(password, DUMMY_HASH)` in the
  `!fabricator || invite-pending || !is_active` branches to equalize.

### F-13. Doc-vs-code drift: "Argon2id Fabricator auth" is bcryptjs in code
- **Code:** `package.json:21` → `"bcryptjs": "^3.0.3"` (no argon2 dep).
  `src/app/api/fab/login/route.ts:14` imports bcryptjs.
- **Docs:** `CLAUDE.md` "Preflight Phases ... Fabricator (lab tech) Argon2id
  auth", `docs/projects/preflight-phase-1b-2-brief.md` similar.
- **Fix:** rewrite the docs to say "bcryptjs" OR migrate to
  `@node-rs/argon2`. Either is fine; the drift itself is the issue —
  external reviewers (and school-IT auditors reading the security checklist
  in §15) are misled.

### F-14. Fabricator login rate-limit is in-memory
- **File:** `src/app/api/fab/login/route.ts:26-29` + `@/lib/rate-limit`.
- **What:** Vercel runs N concurrent Lambdas; each has its own in-memory
  bucket. Effective limit is 10×N per minute. There is no per-account
  failure counter, so an attacker can rotate IPs across the (small) set of
  fabricator emails for a school and brute-force.
- **Fix:** Redis-backed rate-limit OR a `fabricators.failed_login_count`
  column that locks the account at N=10 within 30 min and clears on
  successful login. The student-classcode-login path already does
  per-classcode counting (CLAUDE.md §"SECURITY POSTURE" in
  `student-classcode-login/route.ts`); mirror that for fabricators.

### F-15. `marking-comments` AI prompt accepts free-text `studentWork` — no name-redaction filter
- **File:** `src/lib/tools/marking-comments-prompt.ts:47-48`,
  `src/app/api/tools/marking-comments/route.ts:93-109`
- **What:** the system prompt embeds `${input.studentWork}` verbatim. A
  teacher pasting "Sarah's CAD model demonstrates exceptional…" sends
  Sarah's name to Anthropic. The `STUDENT_NAME_PLACEHOLDER` pattern is
  designed for *named-parameter* PII (`studentName`), not free-text fields.
- **Why audit missed it:** the regression test
  `no-pii-in-ai-prompts.test.ts:97-108` greps for property names
  (`displayName`, `\.email`), not free-text inputs. By design — but the
  miss is real.
- **Fix:** either run a server-side NER pass on `studentWork` before send
  (overkill), OR add a UI hint + system-prompt instruction to the model:
  "If a student name appears in the description, refer to them as 'the
  student' in your output." (Cheap; matches the report-writer convention.)
  Update the security-overview §1.3 hard rule to clarify it's structurally
  bounded to known-name-bearing parameters.

### F-16. `resolveCredentials` swallows `decrypt()` failures silently
- **File:** `src/lib/ai/resolve-credentials.ts:36-49`
- **What:** if a teacher's `encrypted_api_key` fails to decrypt (corrupted
  ciphertext, AES key rotation drift, tampering), the function falls
  through to the platform key with no log. Symptom: teacher's BYOK silently
  stops working, billing silently flips to platform, breach detection is
  blind.
- **Fix:** `console.error` (then Sentry-redacted) on decrypt failure with a
  cause string but no key material. Optionally emit an audit row.

### F-17. `gallery_reviews` INSERT permits arbitrary `reviewer_id`
- Already covered under F-4 but specifically: `reviewer_id text NOT NULL`
  is the only column tying a review to a reviewer; with `WITH CHECK (true)`
  there's no binding to `auth.uid()`. Even after the SELECT issue is fixed,
  authenticated users can submit reviews under any `reviewer_id` string.

---

## P3 — low / latent

### F-18. `ai_usage_log.metadata` stores teacher email PII at rest
- **Files:** `src/app/api/tools/marking-comments/route.ts:105-108` (writes
  `metadata.email`), `supabase/migrations/025_usage_tracking.sql` (RLS).
- **What:** RLS is correct (service-role-only `USING (auth.role() = 'service_role')`),
  but the comment "admins can read" is wrong — admins only read via
  service-role server endpoints. The doc-claim drift could mislead a
  future engineer to widen RLS thinking it's already permitted.

### F-19. `restoreStudentName` regex is a whole-word match on the bare token "Student"
- **File:** `src/lib/security/student-name-placeholder.ts:39-41`
- **Risk:** model output containing "Student-Centered Learning" or "Student
  Council" gets the noun substituted. Today's prompts steer the model to
  use the placeholder only as an address term, so practical false-positive
  rate is low — but the design tightly couples to prompt wording. Worth a
  unit test pinning a few edge-cases.

### F-20. Storage proxy URL-path is not redacted in Sentry breadcrumbs
- **File:** `src/lib/security/sentry-pii-filter.ts:217-221`
- `redactUrlQueryString` redacts `?key=val` pairs but leaves the path
  intact. Paths like `/api/storage/responses/{studentId}/avatar/{ts}.jpg`
  embed student UUIDs. UUIDs aren't classical PII but pair them with a
  cookie / IP (already redacted, good) and you have a re-identification
  vector. Low value to fix; flag in case the threat model tightens.

---

## What I did NOT verify

- Could not run `npm test` in this environment (rolldown native binding
  missing for arm64). CI status is the source of truth for the test files
  themselves; the **test logic gaps** in F-9 and F-15 are independent of
  whether the existing tests pass.
- Did not exercise the actual PostgREST direct-access path for F-1..F-4
  end-to-end (would need a live student JWT). The Postgres RLS semantics
  are documented and consistent — the policy text alone is sufficient
  evidence. Recommend reproducing one of them (e.g. F-1) with `curl
  https://<proj>.supabase.co/rest/v1/student_tool_sessions -H "apikey:
  <NEXT_PUBLIC_SUPABASE_ANON_KEY>" -H "Authorization: Bearer <student-jwt>"`
  before treating the finding as closed.
- Did not audit `src/lib/access-v2/can.ts` permission matrix — outside the
  scope of "what was missed in 9 May".
- Did not look at LTI launch path (`/api/auth/lti/launch`) — has its own
  threat model.

---

## Suggested triage order

1. F-1, F-2, F-3, F-4 — single migration tightening the four policy sets.
   Low blast radius (admin-client writers don't care about RLS), high
   exposure reduction. Half a day of work.
2. F-5 — one-line fix in `units/route.ts` `publish` case. Twenty minutes.
3. F-6 — make `scan-role-guards.py --enforce` red on missing routes, then
   sweep the 80. One day. Until then, F-6 means F-1..F-5 stay ALSO
   exploitable from any logged-in student JWT, not just teacher-to-teacher.
4. F-9, F-10 — Sentry hardening. Either disable Replay or add masking
   integration. Half a day.
5. F-11 — promote `knowledge-media` scoping out of follow-ups into P2 and
   ship a school-scoped check before the next school onboards.
6. F-12, F-14 — fabricator login hardening. Half a day.
7. F-13 — doc rewrite (or argon2 migration). Pick one and stop drifting.
8. F-15..F-20 — bundle into a single security-posture sweep when next
   convenient.
