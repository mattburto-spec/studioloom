# Security Closure — 9 May 2026 External-Review Findings (F-1 … F-20)

> **Brief type:** Phased build plan with named Matt Checkpoints, per
> [`docs/build-methodology.md`](../build-methodology.md).
>
> **Source findings:** [`docs/security/external-review-2026-05-09-findings.md`](../security/external-review-2026-05-09-findings.md)
>
> **Tracking table:** rows F-1 … F-20 added under
> [`docs/security/security-plan.md`](../security/security-plan.md) — each
> linked back to the phase below.
>
> **Working assumption:** all work commits to `main`. No worktrees, no
> feature branches. Migrations use timestamp prefixes per
> [CLAUDE.md → Migration discipline](../../CLAUDE.md).

---

## Pre-flight findings (capture from this drafting run)

| Item | State |
|---|---|
| Working tree | Clean post-fixup (had to remove stale `.claude/worktrees/sleepy-fermi-b0fe8b` Claude-harness worktree that was holding `main` at `8ba61b3` from 4 May; this blocked the initial `git checkout main`). Now on `main`, fast-forwarded to `296e04e` (saveme PR #143 merge). |
| Baseline `npm test` | **5028 passed / 11 skipped / 0 failed** across 305 test files (the prompt's "expected ~3630" is stale by ~1400 tests). |
| `scan-rls-coverage` | clean — 123/123, 5 intentional deny-all. |
| `scan-role-guards` | drift — 119/206 covered, 80 missing, 7 allowlisted. |
| `scan-api-routes --check-audit-coverage` | clean — 7/238 covered, 231 skipped (all annotated), 0 missing. |
| `scan-api-routes --check-budget-coverage` | clean — 5/5. |
| F-1 `student_tool_sessions` policy | Confirmed at `supabase/migrations/026_student_tool_sessions.sql:64-67` (cowork said 62-66; off-by-2 because the cited range began at the comment, the policy itself is at 64). Policy text matches exactly. |
| F-2 `open_studio_profiles` policy | Confirmed at `031:56-59`. Policy text matches. |
| F-3 `discovery_sessions` service_all | Confirmed at `047:53-57`. The strict scoped SELECT is at `047:48-50`; cowork is correct that the permissive one short-circuits it. |
| F-4 `gallery_submissions` + `gallery_reviews` | Confirmed at `049:65-115`. The `student_id = student_id` tautology is at `049:67`; the wide-open SELECT policies at 70 + 75; the `gallery_reviews WITH CHECK (true)` at `049:104` and similar at 110-115. |
| F-5 `units` route publish case | Confirmed at `src/app/api/teacher/units/route.ts:217-285`. The bare `.eq("id", unitId)` is at line 281. The `unpublish` case at line 287+ does the right ownership check (used as the model fix). |

### Step 6 — sibling-table audit results

`grep -lrn "USING (true)" supabase/migrations/` returned 11 files. Beyond
the cowork-named F-1..F-4 + F-7 + F-8, the audit-before-touch grep found:

**Sibling tables matching the same anti-pattern (NOT in cowork's list):**

| New finding | File:line | Status |
|---|---|---|
| **F-21 (NEW)** `class_units FOR SELECT USING (true)` | `001_initial_schema.sql:201` | **Real gap** — never replaced (verified: no DROP POLICY for class_units exists in any later migration). Cross-tenant leak: any authenticated user reads all class→unit assignments globally via PostgREST. |

**Likely-intentional public reads (need confirmation, not fix):**

| Site | Comment in code | Recommended action |
|---|---|---|
| `badges` (mig `035:246`) `badges_readable FOR SELECT USING (true)` | implied by name + sibling `unit_badge_reqs_read` comment | **Confirm intentional** — badge catalog is UI-display metadata, no per-school differentiation. If yes, mark with `audit-skip:` analog in a doc; if no, scope. |
| `unit_badge_requirements` (mig `035:285`) `unit_badge_reqs_read FOR SELECT USING (true)` | "Public read for UI to show required badges" | Same — confirm intentional; the comment says yes. |
| `safety_sessions` (mig `035:299`) `safety_sessions_read_by_code FOR SELECT USING (true)` | "students submit via code, creator can read" | **Review needed** — pre-Phase-6.1 student-flow legacy. With student lazy-provision via Supabase Auth, the read-by-code path may now be redundant. Audit callers; if no live consumer, drop the policy. |

**Intentional + correctly gated (no action):**

- `085_schools.sql:111` — `TO authenticated USING (true)` — schools-list UI for the welcome-wizard. Explicit role gate.
- `20260426140609_word_definitions_cache.sql:50` — `TO anon, authenticated USING (true)` — word-definitions cache, intentionally public.

### Step 7 — F-6 missing-routes grouping (80 routes by sub-namespace)

| Cluster | Count | Notes |
|---|---|---|
| `teacher/knowledge` | 11 | Largest cluster — knowledge library CRUD. |
| `teacher/badges` | 9 | Includes `badges/[id]/assign` — confirmed exploitable per F-6 spot-check. |
| `teacher/skills` | 6 | Skill cards. |
| `teacher/activity-cards` | 5 | |
| `teacher/grading` | 4 | Includes `release` and `tile-grades/ai-prescore`. |
| `teacher/me` | 4 | Includes `unit-use-requests/[requestId]/approve` (cowork spot-check). |
| `teacher/fabricators` | 4 | |
| `teacher/labs` | 3 | Includes `[id]/bulk-approval` (cowork spot-check). |
| `teacher/gallery` | 3 | |
| `teacher/library` | 3 | |
| `teacher/integrations` | 3 | |
| `teacher/machine-profiles` | 2 | |
| `teacher/fabrication` | 2 | |
| Long tail (single-route clusters) | 22 | dashboard, search, units, request-access, own-time, nm-*, generate-*, upload-unit-image, unit-thumbnail, class-profiles, safety-certs, activity-blocks, safety, v1/teacher (1) |

Top-5 clusters cover 35 of the 80 routes. The whole sweep is mechanical
(per CLAUDE.md "AI calls — single chokepoint" precedent: 13 routes
migrated in ~30 min). Realistic effort: **3–4 hr for the sweep + 1 hr
for the `--enforce` CI flag + 1 hr for tests = half a day**, not the
"1 day" cowork estimated.

---

## Phase plan

### Phase S1 — RLS hardening
**Closes:** F-1, F-2, F-3, F-4, F-7, F-8, F-17 (sub-finding of F-4),
F-21 (NEW from sibling audit). Confirms intent on the 3 mig-035 sites.

#### Pre-flight (S1-specific)
1. `git status` clean, on `main`, HEAD known.
2. `npm test --silent` — capture baseline (expected 5028 from this brief's
   pre-flight; if drifted, surface the delta in the checkpoint report).
3. Re-read [`docs/lessons-learned.md`](../lessons-learned.md) #38 (assert
   expected values, not just non-null) and #39 (audit-then-fix for pattern
   bugs).
4. Spot-check ONE registry entry per CLAUDE.md "Registry cross-check"
   discipline: confirm `docs/schema-registry.yaml` entries for the 9
   affected tables (`student_tool_sessions`, `open_studio_profiles`,
   `discovery_sessions`, `gallery_submissions`, `gallery_reviews`,
   `own_time_*` (3 tables), `open_studio_status`, `open_studio_sessions`,
   `class_units`) are accurate. Flag drift; do NOT fix during S1.
5. `cat /Users/matt/CWORK/.active-sessions.txt` — confirm no other
   migration in flight.
6. **Mint the migration timestamp:** `bash scripts/migrations/new-migration.sh
   rls_hardening_external_review`. Commit + push the empty stub
   IMMEDIATELY (claim discipline). DO NOT write the SQL body until the
   stub is on origin.

#### Exact targets (file + line)

| Finding | File | Action |
|---|---|---|
| F-1 | `supabase/migrations/026_student_tool_sessions.sql:64-67` | Drop existing `service_role_all`. New policies modeled on `quest_journeys` (mig `046:178-196`): per-student SELECT/INSERT/UPDATE/DELETE keyed off `current_setting('request.jwt.claims', true)::json->>'sub'`. Service-role writers continue to bypass RLS. |
| F-2 | `031:56-59` | Same pattern as F-1. `open_studio_profiles.student_id` is the join key. |
| F-3 | `047:53-57` | Drop the permissive `discovery_sessions_service_all`; the strict scoped policy at `047:48-50` becomes the canonical one. Service role still bypasses. |
| F-4a | `049:65-77` (gallery_submissions) | Drop both wide-open SELECT policies + the tautological INSERT WITH CHECK. New policies: SELECT `student_id::text = jwt.sub` for students; SELECT `EXISTS (class_members …)` for teachers; INSERT `student_id::text = jwt.sub`. |
| F-4b / F-17 | `049:103-115` (gallery_reviews) | Same shape: `reviewer_id::text = jwt.sub` on INSERT WITH CHECK; SELECT bound to round membership. |
| F-7 | `028_own_time.sql:82, 94, 107` | Drop the 3 `*_read FOR SELECT USING (true)`. Add per-student SELECT (`student_id::text = jwt.sub`) + per-teacher SELECT (`EXISTS class_members …`). |
| F-8 | `029_open_studio.sql:122, 135` | Same as F-7. |
| F-21 | `001_initial_schema.sql:201` (`class_units` SELECT) | Drop the wide-open policy via the new migration (don't edit mig 001 in place — that's frozen). New policy: SELECT for teachers via `class_members`, for students via `class_students`. |

**Open question (block before SQL is written):** see "Open questions"
section below — fix shape choice (RESTRICTIVE+TO service_role vs
drop-and-per-student-policies). Cowork recommends the latter; this brief
defaults to it but Matt to sign off.

**Mig-035 review (NOT in S1 scope unless Matt flips them):**
1. Confirm `badges` + `unit_badge_requirements` are intentional public read.
   Action: add a section to `docs/security/rls-deny-all.md` or a sibling
   `rls-public-by-design.md` documenting the 2 tables + the UI rationale.
2. `safety_sessions_read_by_code` — audit callers
   (`grep -rn "safety_sessions" src/app/api/`) and either remove the policy
   (if dead) or leave + document (if live).

#### Don't stop for
- Test count drift of ±5 from 5028 baseline (in-flight non-security work
  may shift the count slightly).
- Cosmetic schema-registry drift on the 9 tables (capture in a follow-up,
  don't fix in S1 — separate concern).
- The 3 mig-035 sites — they're a separate decision (see Open questions).

#### Stop triggers
- Pre-flight grep finds a 12th wide-open SELECT not in this brief.
- Any of the 9 tables turns out to have NO admin-client write path
  (would mean the existing wide-open RLS was actually load-bearing).
- A new test-mock pattern blocks > 5 existing tests.
- Migration `verify-no-collision.sh` reports a collision on origin/main.

#### Verify (assert expected values, not non-null per Lesson #38)

For each of the 9 tables:
1. **PostgREST direct-access negative test.** Capture truth from one
   real run: with a synthetic student JWT (extract from a logged-in
   student session locally), execute `curl -H "apikey: $ANON_KEY" -H
   "Authorization: Bearer $JWT" "https://<proj>.supabase.co/rest/v1/<table>?select=*&limit=1"`
   and assert the response is `[]` (or 401 on tables that lack any
   per-student grant). Lock these expected values into the smoke
   doc — pre-S1 they would return rows.
2. **PostgREST direct-write negative test.** Same JWT, attempt INSERT
   into each table with a foreign `student_id` / `reviewer_id`. Assert
   the row is NOT created (`expect: 0 rows`).
3. **Admin-client positive test.** From the existing API route handlers
   (e.g. `student/discovery/start/route.ts`), confirm a normal flow
   still works end-to-end (create + read).
4. Capture the smoke output (with timestamps + JWT subject) into
   `docs/security/rls-smoke-2026-05-XX.md` for archive.

Ship the new migration only after the smoke is captured + locked into
the verify section of this brief.

#### Migration discipline gate
- `bash scripts/migrations/verify-no-collision.sh` must exit clean.
- The new migration timestamp on origin/main first, body second
  (claim-discipline per CLAUDE.md §"Migration discipline (v2)").
- Update `docs/scanner-reports/rls-coverage.json` expectations only after
  re-running `python3 scripts/registry/scan-rls-coverage.py` against the
  applied migration. Update `docs/security/rls-deny-all.md` if any of the
  9 tables newly qualifies as deny-all-by-design.

#### **Matt Checkpoint S1.1**
Matt runs the PostgREST negative smoke himself with a student JWT
extracted from his own browser session. Code stops + waits. No push to
origin/main until Matt signs off + the migration is applied to prod.

---

### Phase S2 — units publish predicate fix
**Closes:** F-5.

#### Pre-flight (S2-specific)
1. `git status` clean post-S1 sign-off.
2. Re-read `src/app/api/teacher/units/route.ts:287-306` (the `unpublish`
   case — the model fix).
3. Read `src/lib/auth/verify-teacher-unit.ts` `verifyTeacherHasUnit()` —
   confirm signature + return shape.
4. `grep -rn "case \"publish\":" src/app/api/teacher/units/` — should
   surface only the one site (defensive; pattern bug hunt).

#### Exact target

`src/app/api/teacher/units/route.ts:217-285`. The `publish` case bare
`.eq("id", unitId)` becomes:

```ts
const auth = await verifyTeacherHasUnit(user.id, unitId);
if (!auth.hasAccess) {
  return NextResponse.json({ error: "Unit not found" }, { status: 404 });
}
// ... existing teacher-lookup + resolvedAuthorName logic stays unchanged ...
const { error } = await adminClient
  .from("units")
  .update({ /* ...same fields... */ })
  .eq("id", unitId)
  .eq("author_teacher_id", user.id);  // ← belt-and-braces
```

Returns 404 (not 403) per existing convention so the route doesn't leak
"this unit exists but you can't touch it" — matches `unpublish` case.

#### Don't stop for
- Format/lint drift in the surrounding switch case.

#### Stop triggers
- `verifyTeacherHasUnit` returns a different shape than expected
  (signature drift since cowork audit).

#### Verify
1. New unit test in `src/app/api/teacher/units/__tests__/route.test.ts`:
   - Setup: 2 teacher mocks, teacher A authors unit U.
   - Action: teacher B's session calls `POST /api/teacher/units` with
     `{action: "publish", unitId: U}`.
   - Assert: response status === 404 (NOT 200).
   - Assert: `units.author_teacher_id` for U remains teacher A's id
     (NOT overwritten to teacher B). Use the admin-client fixture to
     read it back.
2. Existing test for the legitimate-publish path stays green.
3. Lesson #38: assert exact equality on `author_teacher_id`, not "is
   defined".

#### **Matt Checkpoint S2.1**
Matt reviews diff + new test. Lands in same PR as the S1 RLS migration's
smoke-doc commit, OR follows immediately as a separate commit on main.

---

### Phase S3 — role-guard sweep + CI enforcement
**Closes:** F-6 (the 80 missing teacher routes).

#### Pre-flight (S3-specific)
1. `git status` clean post-S2.
2. Re-read `src/lib/auth/require-teacher.ts` to confirm the helper API.
   Re-read the previous sweep PR (#140 commit `7fc8cfb`) for the exact
   migration pattern that worked.
3. Re-read `scripts/registry/scan-role-guards.py` to understand how the
   scanner identifies "covered". The substitution pattern must satisfy
   the scanner's regex (any import or call of an approved helper counts).
4. `python3 scripts/registry/scan-role-guards.py` — capture current
   `missing` list as the baseline. Confirm it's still 80 (drift since
   pre-flight = stop trigger).

#### Exact targets — route-by-route checklist

Migrate the 80 routes by sub-namespace (commits grouped per cluster for
reviewability). Per route: replace
```ts
const supabase = createServerClient(...);
const { data: { user } } = await supabase.auth.getUser();
if (!user) { return NextResponse.json({error:"Unauthorized"},{status:401}); }
// uses user.id throughout
```
with
```ts
const auth = await requireTeacher(request);
if (auth.error) return auth.error;
const { teacherId } = auth;
// ... rest of handler, using teacherId
```

Per CLAUDE.md "Audit-then-fix for pattern bugs" (Lesson #39): commit
sub-namespace by sub-namespace, NOT one-massive-sweep. 11 commits
(top-13 clusters above + 2 long-tail commits). Each commit: ~5-15 files,
diff is reviewable.

**Special cases (do NOT auto-substitute, hand-judge):**
- Routes using `requireAdmin` instead of `requireTeacher` — admin-only
  surfaces. Walk each `/admin/*` site separately.
- Routes using `requirePlatformAdmin` — platform-admin-only.
- Routes that legitimately accept BOTH a student and a teacher session
  (none expected, but if found, report + don't substitute).

**Bonus check (cowork F-6 smoke):** explicit fix for
`teacher/badges/[id]/assign/route.ts` — add additional class-membership
check that the `studentIds` payload all map to students the teacher
manages. Without that, `requireTeacher` alone closes the student-self-
grant path but leaves teacher-cross-class self-grant open. Match the
existing `verifyTeacherCanManageStudent` pattern.

#### Add `--enforce` flag to scanner
1. Edit `scripts/registry/scan-role-guards.py` — when `--enforce` passed,
   exit non-zero if `missing > 0`.
2. Update `.github/workflows/*.yml` (or wherever CI runs scanners) to
   include `--enforce` on PR builds. If CI doesn't currently run the
   scanner, that's the wiring to add.
3. **Negative-control test (Lesson #38 spirit):** after migrating the 80
   routes + landing the `--enforce` flag, deliberately revert ONE route
   to bare `auth.getUser()` in a throwaway commit, push to a no-merge
   branch, confirm CI red. Restore the fix, confirm CI green. Capture
   the negative-control branch + delete it. This proves the scanner
   actually fails closed.

#### Don't stop for
- Routes whose tests need a Supabase mock update for the new role check
  (handled the same way as the previous sweep — add `app_metadata: {
  user_type: "teacher" }` to the mock).
- Sub-namespaces with only 1-2 routes — bundle them into a "long tail"
  commit at the end.

#### Stop triggers
- A route turns out to legitimately accept anonymous access (would
  belong on the allowlist, not the sweep).
- The negative-control test passes (i.e., scanner doesn't fail when it
  should) — that's a scanner bug to fix BEFORE locking the gate.
- > 20 tests need mock updates (would mean a different test architecture
  is needed).

#### Verify
- `python3 scripts/registry/scan-role-guards.py` reports `missing: 0`,
  `covered: 199`, `allowlisted: 7`.
- `python3 scripts/registry/scan-role-guards.py --enforce` exits 0.
- Synthetic CI run with one route reverted exits non-zero (negative
  control).
- Full `npm test --silent` passes (5028 → ~5028 + new tests for the
  badges/[id]/assign manage-student check).
- Manual smoke (Matt): student JWT in incognito tab, fetch one of the
  highest-risk migrated routes (e.g.
  `POST /api/teacher/badges/{badge}/assign`) → expect 403.

#### **Matt Checkpoint S3.1**
Scanner reports zero missing, CI gate is red on regression (negative-
control proven), Matt confirms the badges-assign exploit closed via
incognito smoke.

---

### Phase S4 — Sentry hardening
**Closes:** F-9, F-10.

#### Pre-flight (S4-specific)
1. `git status` clean post-S3.
2. Re-read `src/lib/security/sentry-pii-filter.ts` — current scrub is on
   `contexts/extra/tags/user/request.{cookies,headers,data,query_string}`
   (per cowork's audit at lines 150-179). Does NOT touch `event.message`
   or `event.exception.values[*]`.
3. Re-read `src/lib/security/__tests__/sentry-pii-filter.test.ts` — the
   existing tests cover the in-scope paths. New tests for message +
   exception scrubbing go alongside.
4. Re-read `src/instrumentation-client.ts` — current Replay config is
   `replaysOnErrorSampleRate: 0.1` (cowork F-10) with NO
   `Sentry.replayIntegration({ ... })` block.

#### Exact targets

**F-9 — exception/message scrub:**

Extend `beforeSend` to walk `event.message` (string) and
`event.exception.values[*].{value, type}` (string). Apply a regex pass
keyed off `SENSITIVE_KEY_FRAGMENTS`. Conservative pattern: any token
that looks like an email (`/[\w.-]+@[\w.-]+\.\w+/`), classcode (`/\b[A-Z0-9]{6,8}\b/`
in the right context), or known PII key followed by `=value` /
`: value`. This is a pattern-match scrub, not a key-walk; it WILL have
false positives — that's the right tradeoff.

**F-10 — Replay decision:** see "Open questions". Default in this brief:
**Option A (turn off Replay until intentionally configured)** because it
matches CLAUDE.md "default to discipline" + zero current value. Matt to
flip to Option B if he wants a Replay safety net pre-pilot.

If A: `replaysOnErrorSampleRate: 0` in `src/instrumentation-client.ts:9`.
Add comment pointing at this brief.

If B: add `Sentry.replayIntegration({ maskAllText: true, maskAllInputs:
true, blockAllMedia: true })` to the `integrations` array. Smoke-test:
trigger a known error in dev, inspect the Replay payload in Sentry
dashboard, confirm DOM text is masked. Document the masking config in
`docs/security/sentry-pii-scrub-procedure.md`.

#### Don't stop for
- The pattern-match scrub will inevitably miss an exotic PII shape.
  That's expected — cover the highest-volume paths (email, classcode)
  and document the residual risk in `sentry-pii-scrub-procedure.md`.

#### Stop triggers
- `event.exception.values` is undefined-shaped on the version of
  `@sentry/nextjs` we use (would need a version-specific code path).

#### Verify (Lesson #38 — strip-and-confirm-fail before locking assertions)

For F-9:
1. Negative control first: write the test asserting "scrubbed message
   does NOT contain `student@example.com`". Run with the OLD scrubber
   (no message-scrub) — assert fails. Capture the failure output.
2. Add the scrubber. Run again — assert passes.
3. Lock 3 cases: email in message, classcode in message, email in
   `exception.values[0].value`. Each: assert exact replacement string.

For F-10 Option A:
- Read `instrumentation-client.ts` shows `replaysOnErrorSampleRate: 0`.
- Test: spin up dev server (preview_start), trigger a `Sentry.captureException`
  in console, inspect Sentry dashboard — confirm event arrives WITHOUT a
  Replay attached.

For F-10 Option B:
- Same as Option A but Replay arrives with all text shown as `***`.

#### **Matt Checkpoint S4.1**
Matt confirms the Replay decision (A vs B), reviews the message-scrub
diff + 3 locked test assertions. Updates
`sentry-pii-scrub-procedure.md` accordingly.

---

### Phase S5 — knowledge-media + unit-images school scoping
**Closes:** F-11. Promotes `FU-SEC-{UNIT-IMAGES,KNOWLEDGE-MEDIA}-SCOPING`
out of follow-up status into the active plan.

#### Pre-flight (S5-specific)
1. `git status` clean post-S4.
2. Re-read `src/app/api/storage/[bucket]/[...path]/authorize.ts:46-49`
   — the current short-circuit for `unit-images` + `knowledge-media`.
3. Re-read `src/app/api/storage/[bucket]/[...path]/__tests__/authorize.test.ts`
   — test fixture conventions.
4. **Path structure audit (Lesson #39 audit-before-touch):** for
   `knowledge-media`, `grep -rn 'knowledge-media' src/app/api/teacher/knowledge/media/' src/lib/knowledge/` to find all writers and confirm
   the path shape is uniform. Same for `unit-images`. **STOP and report
   the path-shape audit before designing the resolver.**

#### Exact targets

**unit-images:** path shape is `{unitId}/{timestamp}.jpg` per
`teacher/upload-unit-image/route.ts:88`. Resolver:
1. Extract `unitId = path.split("/")[0]`; UUID validate.
2. For students: SELECT 1 FROM `class_units` JOIN `class_students` ON
   `class_units.class_id = class_students.class_id` WHERE
   `class_units.unit_id = unitId AND class_students.student_id =
   {studentId}`.
3. For teachers: `verifyTeacherHasUnit(user.id, unitId)`.
4. Platform admin: pass.

**knowledge-media:** propose THREE candidate path shapes; one will be
right after the audit:
- (a) `{teacherId}/{...}` — extract teacherId, check school-co-membership
  via `current_teacher_school_id()` shared.
- (b) `{schoolId}/{...}` — extract schoolId directly.
- (c) `{teacherId}/{topicId}/{...}` — same as (a) plus a topic gate.

**Decision deferred to post-audit step.** Don't write the resolver until
the audit step picks the shape.

#### Don't stop for
- Variations in path depth as long as the first segment matches the
  chosen shape.

#### Stop triggers
- Path audit finds inconsistent shapes (some paths
  `{unitId}/{timestamp}`, others `{teacherId}/{unitId}/{timestamp}`).
  That's a data integrity issue that needs addressing before scoping.

#### Verify
- New tests in `authorize.test.ts` covering: same-school read pass,
  different-school read fail, malformed path 403, platform-admin
  override.
- Smoke (Matt): in two browsers (different schools' teacher accounts),
  fetch each other's `unit-images` URL → expect 403.

#### **Matt Checkpoint S5.1**
Matt approves the chosen knowledge-media path shape (after the audit
step proposes it), reviews the resolver tests + smoke result.

---

### Phase S6 — fabricator login hardening + doc/code reconciliation
**Closes:** F-12, F-13, F-14.

#### Pre-flight (S6-specific)
1. `git status` clean post-S5.
2. Re-read `src/app/api/fab/login/route.ts:75-94` — current bcrypt path.
3. Re-read `package.json:21` to confirm `bcryptjs ^3.0.3` is the only
   hash-lib dep (no argon2).
4. Re-read CLAUDE.md mentions of "Argon2id" + the Preflight
   1B-2 brief — confirm both are stale.

#### Exact targets

**F-12 — equalize-time bcrypt:** before the conditional `if (!fabricator)`
branch, compute a constant DUMMY_HASH (bcrypted at module init for the
same cost). In each early-out branch (`!fabricator`, `!is_active`,
`is_setup`), `await bcrypt.compare(password, DUMMY_HASH)` then return
the generic-fail. Equalizes wall-clock time across known-bad-email and
known-good-email paths.

**F-14 — rate-limit:** see "Open questions". Default proposal:
**Option A (DB-column `fabricators.failed_login_count` + lockout)**
because it requires no new infra dep, mirrors the existing classcode
pattern, and persists across Lambda cold starts. Migration adds:
- `fabricators.failed_login_count INTEGER NOT NULL DEFAULT 0`
- `fabricators.failed_login_locked_until TIMESTAMPTZ`
On failed compare: increment count, if count >= 10 set
`locked_until = now() + interval '30 min'`. On successful compare:
reset both. Login route checks `locked_until > now()` first and
returns 429.

**F-13 — doc reconciliation:** rewrite CLAUDE.md "Argon2id" mentions
to "bcryptjs". Update `docs/projects/preflight-phase-1b-2-brief.md`
similarly. **Do NOT migrate to argon2** in this phase unless Matt
explicitly chooses Option B in the open question.

#### Don't stop for
- Marginal differences in DUMMY_HASH bcrypt cost vs real-hash cost
  (within the same cost factor, timing is statistically identical).

#### Stop triggers
- The migration adds 2 columns to `fabricators`; if Preflight is in
  active migration churn (check `.active-sessions.txt`), defer S6 by
  one session.

#### Verify
1. **F-12 timing test:** `time` 100 invocations each of (a) known email
   wrong password, (b) unknown email. Assert: medians within 10% of each
   other. Lock the median + tolerance into a comment on the route.
2. **F-14 lockout test:** unit test that 10 failed logins on the same
   email get the 11th request a 429, the lockout clears after the
   timestamp passes, and a successful login resets the counter.
3. CI grep: `grep -rn "Argon2id\|argon2id" CLAUDE.md docs/projects/` —
   should return 0.

#### Migration discipline gate
- Mint with `bash scripts/migrations/new-migration.sh
  fabricators_failed_login_lockout`.
- Push empty stub before SQL body.
- Apply to prod between checkpoint signoff and origin/main push.

#### **Matt Checkpoint S6.1**
Matt confirms the rate-limit choice (A vs B from open questions),
reviews the timing-equalization test output, signs off on doc rewrites.

---

### Phase S7 — bundle the P3s
**Closes:** F-15, F-16, F-18, F-19, F-20.

(F-17 rolled into S1; nothing to do here.)

#### Pre-flight (S7-specific)
1. `git status` clean post-S6.
2. Re-read each cited file:line below to confirm no drift.

#### Exact targets

| Finding | Fix |
|---|---|
| **F-15** marking-comments name leak | Add to `src/lib/tools/marking-comments-prompt.ts` system prompt: "If a student name appears in the description, refer to them as 'the student' in your output." Add a UI hint above the input field. Update `docs/security/security-overview.md` §1.3 to clarify the no-name rule is structurally bounded to known-name-bearing parameters, NOT free-text fields. Add a unit test that verifies the new system-prompt instruction is present (not behavioral — Anthropic's compliance is best-effort). |
| **F-16** silent decrypt failure | `src/lib/ai/resolve-credentials.ts:36-49`. Wrap the `decrypt(encrypted_api_key)` call in try/catch. On catch: `console.error("[resolve-credentials] BYOK decrypt failed for teacher=<short-id>: cause=<error.message>")` + emit an `audit_events` row with action `byok.decrypt_failed`. Continue to platform fallback (existing behavior). NEVER log key material. |
| **F-18** ai_usage_log.metadata doc drift | `supabase/migrations/025_usage_tracking.sql` — the comment claiming "admins can read" misrepresents the policy. Add a doc-only follow-up migration with a comment-only update OR fix in place via a separate text-only PR. Pick one; don't drift. |
| **F-19** restoreStudentName whole-word edge cases | `src/lib/security/__tests__/student-name-placeholder.test.ts` — add unit tests for "Student-Centered Learning" (should NOT substitute), "Student Council" (should substitute "Student" but the substitution is harmless because the prompt steers the model to use the placeholder only as an address term — assert + document). |
| **F-20** Sentry breadcrumb path-redaction | `src/lib/security/sentry-pii-filter.ts:217-221`. Extend `redactUrlQueryString` (rename to `redactUrlPathAndQuery`) to also redact UUID segments in `/api/storage/responses/{uuid}/...` path. Use a UUID regex. Test with synthetic breadcrumb URLs. |

#### Don't stop for
- Anything in the F-15..F-20 set turning out to be a 30-min job
  (collapse into the same commit).

#### Stop triggers
- F-15's UI hint requires a UX decision — stop and ask.

#### Verify
- Per-finding test cases (each is small + locked into the commit).
- `npm test --silent` baseline + new tests.

#### **Matt Checkpoint S7.1**
Single PR for all 5 closures. Diff is small + reviewable in one pass.

---

## Open questions (decide before S1 starts)

These need your call. Each comes with my proposal + the trade-off. Pick
yes/no/other inline and I'll update the brief before starting work.

### Q1 (S1) — F-1..F-4 + F-7 + F-8 + F-21 fix shape

| Option | Pros | Cons |
|---|---|---|
| **A (proposed):** drop the wide-open policies + add per-student RLS modeled on `quest_journeys` (mig 046) | Defense-in-depth; PostgREST direct access becomes safe-by-construction; matches the established repo pattern for student-facing tables | More SQL to write; higher chance of a subtle student-vs-teacher edge case |
| **B (cowork-suggested fallback):** keep existing policies but add `RESTRICTIVE` + `TO service_role` qualifiers | Smaller diff; relies on the codebase's "service-role-only-in-API" invariant being permanent | Brittle — any future code that uses the SSR client (not admin) on these tables would silently fail; the deny-all is invisible from app code |

**My pick:** A. Cowork's recommendation aligns + it matches mig 046
which is already the canonical reference for the right pattern.

### Q2 (S1) — mig 035 sites (badges, unit_badge_requirements, safety_sessions)

These look intentional but lack explicit documentation. Three options:

| Option | Action |
|---|---|
| **A (proposed):** Confirm intentional via doc, no code change | Add to `docs/security/rls-public-by-design.md` (new file, sibling to `rls-deny-all.md`) the 2-3 confirmed-intentional public-read tables with rationale |
| B: Scope all three to authenticated users at minimum | Add `TO authenticated` to each. Cheap, defense-in-depth. |
| C: Scope `safety_sessions` only (audit dead callers first) | Targeted; preserves the badge UI flow as-is |

**My pick:** A + investigate `safety_sessions` callers in S1 pre-flight,
flip to C if it's dead.

### Q3 (S4) — F-10 Sentry Replay decision

| Option | Action |
|---|---|
| **A (proposed):** Set `replaysOnErrorSampleRate: 0` until intentional | One-line change. Zero PII risk. Loses Replay debugging value. |
| B: Add `Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true })` | Replay capture continues, all DOM text masked. Need to verify in Sentry dashboard the masking actually applies. Higher complexity. |

**My pick:** A. Pre-pilot, Replay isn't load-bearing for debugging.
Re-enable with masking when there's a concrete debugging need.

### Q4 (S6) — F-14 Fabricator rate-limit

| Option | Action |
|---|---|
| **A (proposed):** DB column `failed_login_count + locked_until` | Persists across Lambda cold starts. No new infra. Mirrors existing classcode rate-limit pattern. ~1 migration + ~30 lines of code. |
| B: Redis-backed rate-limit (Upstash) | Faster than DB; works for any future per-account rate-limit. Adds Upstash as a vendor dependency. ~$10/month. |

**My pick:** A. Aligns with existing in-repo patterns; no new vendor.

### Q5 (S6) — F-13 bcryptjs vs Argon2id

| Option | Action |
|---|---|
| **A (proposed):** Rewrite docs to say bcryptjs | 5-min doc change. bcryptjs cost factor 12 is fine for fabricator login (low-volume). |
| B: Migrate to `@node-rs/argon2` | argon2id is the modern standard. Adds a native binding dep; needs migration of existing hashes (rehash on next login). 2-3 hr work. |

**My pick:** A. Doc drift is the bug; the underlying choice is fine.

### Q6 (S5) — knowledge-media path shape

Cannot pre-decide — depends on the path audit at the start of S5.
Flagging here so you know the audit is the gating step, not the
resolver design.

### Q7 (cross-phase) — single-PR vs phase-by-phase

| Option | Action |
|---|---|
| **A (proposed):** One PR per phase, 7 PRs over the closure | Each phase reviewable individually. Slow. |
| B: Bundle S1 + S2 (both touch RLS-adjacent surfaces) into one PR; rest separate | 6 PRs. Feels right because S1 + S2 ship together logically. |
| C: One mega-PR for all 7 phases | Fast but unreviewable. |

**My pick:** B. S1 and S2 are paired by the cowork findings doc itself
(it lists them as the first two triage items). The rest stand alone.

---

## Deviations from your proposed phase structure

1. **Added F-21** (`class_units` wide-open SELECT) to S1's scope. Found
   by step 6 sibling-table audit. Same anti-pattern, same fix shape.
2. **Surfaced 3 more tables in mig 035** (`badges`, `unit_badge_requirements`,
   `safety_sessions`) for review (Q2 above). The first 2 read as
   intentional from in-code comments; `safety_sessions` is unclear.
   Treating as a separate decision so S1 doesn't accidentally break the
   safety-quiz student flow.
3. **F-15 promoted from S7 (P3 bundle) to its own visibility in S7.**
   Cowork rates it P2 (medium); the prompt's S7 said "P3 bundle". I
   surfaced it explicitly in S7 with its own rationale — still in S7,
   but called out so the test/UI hint isn't an afterthought.
4. **S3 estimate cut from "1 day" to "half a day"** based on the
   #140 sweep precedent (13 routes in ~30 min) and the cluster grouping
   above. If the sweep takes longer, that's a stop trigger.
5. **S1 verify step (capture-truth-from-real-run with student JWT)** is
   the only checkpoint where Matt has to do something the brief can't
   simulate. Flagged explicitly because it's load-bearing for the
   "F-1..F-4 are closed" claim.

---

## What this brief does NOT do

- No source code touched.
- No migration body authored.
- No registry updated.
- No test mock changes.
- No CI workflow changes.
- No `.active-sessions.txt` entry yet (will add when S1 starts).

The two deliverables of this run are exactly:
1. This brief.
2. The tracking-table update in `docs/security/security-plan.md`.

---

## See also

- [`docs/security/external-review-2026-05-09-findings.md`](../security/external-review-2026-05-09-findings.md) — source findings doc
- [`docs/security/security-overview.md`](../security/security-overview.md) — current state
- [`docs/security/security-plan.md`](../security/security-plan.md) — tracking table
- [`docs/build-methodology.md`](../build-methodology.md) — methodology
- [`docs/lessons-learned.md`](../lessons-learned.md) — Lessons #38, #39
- [`supabase/migrations/046_quest_journey_system.sql`](../../supabase/migrations/046_quest_journey_system.sql) lines 178–196 — canonical per-student JWT-claim RLS pattern
