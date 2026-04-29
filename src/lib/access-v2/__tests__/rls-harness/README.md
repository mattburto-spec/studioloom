# RLS Test Harness

**Phase:** Access Model v2 Phase 0.9 (audit-derived deliverable)
**Source:** IT audit F14 (HIGH) + `access-model-v2.md` §3 item #31

## Why this exists

The audit flagged that we have **no live RLS test harness**:

> **F14 HIGH** — Static review (which is what the audit did, and what `scan-rls-coverage.py` does) cannot detect a policy that allows the wrong row through. It cannot tell you that a student session can read another class's submissions, only that a policy exists. An actual integration test that authenticates as student-A and tries to read student-B's data is the only way to prove the policy is correct.

The Phase 0.9 deliverable for this is a **harness scaffold** — the infrastructure for writing live RLS tests against a real Supabase instance, plus a small starter set of tests covering the most critical RLS surfaces. Full coverage across every `/api/student/*` route is filed as `FU-AV2-RLS-HARNESS-FULL-COVERAGE` (P2) and built incrementally as Phase 1+ touches each RLS surface.

## What the harness does

A live RLS test:

1. Connects to a Supabase instance using the **service role** to set up fixtures
2. Creates two students in two different classes (often two different schools)
3. Mints a **session token** for student-A using the same custom flow Phase 1 will unify
4. Switches to a Supabase client authenticated as student-A
5. Attempts to read student-B's data via SELECT
6. **Asserts zero rows returned** — anything else is a confirmed RLS bypass

The harness has helper functions for:
- Spinning up + tearing down per-test fixtures (transaction-scoped where possible)
- Minting JWTs / session tokens for each user_type (student, teacher, fabricator, community_member, guardian)
- Asserting zero-cross-tenant-rows + asserting expected own-tenant rows
- Cleaning up after each test (DELETE fixtures by school_id prefix)

## What the harness does NOT do

- Replace `scan-rls-coverage.py` — that scanner asserts RLS is **enabled** on every table. The harness tests **policy correctness** on tables that have RLS enabled.
- Replace the migration shape tests in `migration-*.test.ts` — those assert SQL text shape; the harness asserts runtime behaviour against a real DB.
- Run in CI by default — the harness needs a real Supabase instance + service-role key, which isn't appropriate for every PR. Runs nightly + before-deploy + manually-on-demand. CI gates on the migration shape tests + the scanner; harness is a separate operation.

## Where this lives

- `src/lib/access-v2/__tests__/rls-harness/setup.ts` — fixture helpers (create_test_school, create_test_class, create_test_student, mint_session_token)
- `src/lib/access-v2/__tests__/rls-harness/<surface>.live.test.ts` — per-surface RLS tests (skipped if `SUPABASE_TEST_URL` not set)
- `src/lib/access-v2/__tests__/rls-harness/cleanup.ts` — teardown helpers

## How to run

```bash
# Set against a dedicated test Supabase project (NOT prod)
SUPABASE_TEST_URL=<test-supabase-url> \
SUPABASE_TEST_SERVICE_ROLE_KEY=<test-svc-key> \
npm test -- src/lib/access-v2/__tests__/rls-harness/
```

Tests skip themselves with a clear message if the env vars aren't set, so they don't fail in normal CI.

## Phase 0.9 starter coverage

Initial test files cover the highest-stakes RLS surfaces:

1. **`students.live.test.ts`** — student-A cannot read student-B's row even when in the same school. (Covers the cross-tenant-leak class that produced HIGH-1 in the 28 Apr Preflight audit.)
2. **`audit_events.live.test.ts`** — teacher-in-school-A cannot read audit events from school-B. Audit log tier-tag is preserved. Immutability: UPDATE/DELETE attempts return 0 rows affected.
3. **`student_mentors.live.test.ts`** — mentor self-read works (cross-program teacher mentoring a student in another teacher's class — resolves FU-MENTOR-SCOPE).

These are the seed set. Phase 1+ adds coverage as each route is migrated to the unified session helper.

## Closes audit finding

- F14 (no live RLS test harness, HIGH) → scaffold + 3 starter tests ship; full per-route coverage filed as `FU-AV2-RLS-HARNESS-FULL-COVERAGE` P2.
