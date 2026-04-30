# Handoff — main

**Last session ended:** 2026-04-30T10:30Z (CS-1 + CS-2 SHIPPED + LIVE IN PROD UNDER ENFORCED RLS — milestone session, RLS load-bearing for the first time)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `4ad144e` "chore(access-v2): revert TEMP debug instrumentation in unit-context" (saveme commit follows on top of this)
**Branch:** `main` — 0 ahead, 0 behind (origin in sync after saveme push)

## What just happened (this session)

Continued from "Phase 1 CLOSED" earlier in the day. Picked up Phase 1.4 client-switch (the deferred follow-up). First time SSR client touched Phase 1.5/1.5b/CS-1 RLS policies in production — revealed multiple latent bugs that admin-client testing had masked.

**Sub-phases shipped (all to `main`, no working branch — there are no real users):**

- **CS-1 (3 RLS migrations applied to prod):** `classes_student_self_read`, `assessment_records_student_self_read` (draft-filtered), `student_badges_rewrite` (DROP+CREATE with canonical chain — closed Lesson #54-class broken-policy-since-creation). 14 shape tests added. Mid-apply `text=uuid` error on migration 3 → `::text` cast workaround → filed FU-AV2-STUDENT-BADGES-COLUMN-TYPE P3.

- **CS-2 (2 routes switched + helper refactor):** `me/support-settings`, `me/unit-context` switched from `createAdminClient()` → `createServerSupabaseClient()`. Helpers `resolveStudentSettings` + `resolveStudentClassId` refactored with optional `supabase` parameter (additive, backwards-compatible). The 5 non-CS-2 callers (4 teacher routes + 1 student word-lookup) keep using the admin-client default.

- **Frontend login swap (Path 1 fix):** `(auth)/login/page.tsx:21` was still POSTing to legacy `/api/auth/student-login`. Phase 1.4b's `requireStudentSession` migration of 6 routes had been **silently 401-ing every browser-based student** since it shipped. One-line fix: change the fetch URL to `/api/auth/student-classcode-login`. Closes the regression. Technically Phase 6 cutover scope landing early.

- **`/api/auth/student-session` route made dual-mode:** legacy-only route was bouncing sb-* sessions back to login (the layout's session check 401'd because no `questerra_student_session` cookie). Same dual-mode pattern as Phase 1.4a's `requireStudentAuth` wrapper.

- **Two emergency RLS recursion hotfixes (SECURITY DEFINER pattern):**
  1. `students↔class_students` cycle (migration `20260430010922`). Fixed via `public.is_teacher_of_student(uuid)` SECURITY DEFINER helper.
  2. `classes↔class_students` cycle (migration `20260430015239`). Fixed via `public.is_teacher_of_class(uuid)` SECURITY DEFINER helper.

  Both cycles existed for years but were latent under admin-client. CS-2's SSR client touched them → recursion fired immediately. Filed FU-AV2-RLS-SECURITY-DEFINER-AUDIT P2 for the comprehensive sweep — 6+ Phase 1.5/1.5b/CS-1 policies still have latent recursion potential.

- **End-to-end smoke verified live in prod:** test2 logs in via classcode-login → sb-* cookies set → dashboard loads + STAYS loaded → `me/support-settings` returns `{l1Target:"zh", l1Source:"intake"}` (REAL data) → `me/unit-context` returns the correct class scoped to test2's enrollment. Debug instrumentation confirmed RLS is enforcing — `classes` query returns only test2's enrollments, not the unrelated class.

**Lesson #64 added** — cross-table RLS subqueries silently recurse; SECURITY DEFINER for any policy that joins through another RLS-protected table. Sibling to #38 and #54.

## State of working tree

- `git status --short`: clean after saveme commit lands.
- Tests: **2806 passed | 11 skipped** (was 2792 pre-CS-1; +14 from CS-1 shape tests; no regression).
- Typecheck: 0 errors.
- Pending push: 0 (saveme commit pushed before session ends).
- 5 migrations applied to prod across the day (CS-1: 3, CS-2 hotfixes: 2). Total Access-Model-v2 prod-applied since Phase 0: 12 (Phase 0) + 8 (Phase 1.5/1.5b) + 5 (CS-1/CS-2) = 25 migrations.
- Vercel: main URL `studioloom.org` deployed green. Branch deployments not in use this session (testing direct on main given no real users).

## Next steps — pick up here

Recommended ORDER:

- [ ] **Decide CS-3 strategy.** Two options:
  - (a) **Continue per-route** — switch `grades`, `units`, `safety/pending`, `insights` (CS-3 batch). Each will likely surface 1-2 more recursion cycles in their joined tables (`assessment_records`, `competency_assessments`, `quest_journeys`, `student_badges`). ~30 min per cycle to fix once the SECURITY DEFINER pattern is known. Estimate: 1 day for CS-3 + cycle fixes.
  - (b) **Pre-emptive comprehensive RLS audit** — do FU-AV2-RLS-SECURITY-DEFINER-AUDIT (P2) first. Sweep all Phase 1.5/1.5b/CS-1 policies for cross-table-subquery patterns. Author a generic `current_student_id()` helper and rewrite all affected policies in one batch. Then ship CS-3 cleanly without per-route surprises. Estimate: 0.5 day for audit + rewrites, then 0.5 day for CS-3.

  Honest pick: **(b) probably wins** since the pattern is now well-rehearsed and the audit won't take long. Saves the per-route diagnostic tax.

- [ ] **Or pivot to Phase 2** (OAuth Google/Microsoft + email/password for teachers, ~3-4 days). Builds on the now-load-bearing Phase 1 auth foundation. Genuinely unlocks pilot readiness.

- [ ] **Or take the rest of the day off** — long methodical session, real milestone landed (RLS actually enforcing in prod traffic for the first time). The follow-ups are tracked.

## Open questions / blockers

- _None blocking._
- **Phase 1.4 client-switch is a multi-batch rollout.** CS-1 + CS-2 (this session) covered 3 migrations + 2 routes. CS-3 (4 more routes), CS-4 (negative control test), CS-5 (registry hygiene close-out) remain.
- **6+ latent RLS recursion cycles** across Phase 1.5/1.5b/CS-1 policies — tracked in FU-AV2-RLS-SECURITY-DEFINER-AUDIT (P2). Will surface as new routes engage SSR client unless audited first.
- The 18 GET routes from FU-AV2-PHASE-14B-2 (P3) still use `requireStudentAuth` (dual-mode wrapper). They work via legacy fallback for now. Cosmetic migration when convenient.

## Key references

- Phase 1.4 client-switch brief: `docs/projects/access-model-v2-phase-14-client-switch-brief.md`
- Master spec: `docs/projects/access-model-v2.md`
- Lesson #64 (the headline takeaway): `docs/lessons-learned.md` → bottom
- Decisions: `docs/decisions-log.md` → 4 new entries today (SECURITY DEFINER pattern, additive helper refactor, frontend login swap rationale, student_badges column-type)
- Open follow-ups: `docs/projects/dimensions3-followups.md` →
  - **FU-AV2-RLS-SECURITY-DEFINER-AUDIT** (P2 NEW) — comprehensive sweep
  - **FU-AV2-STUDENT-BADGES-COLUMN-TYPE** (P3 NEW) — column should be UUID + FK
  - FU-AV2-UI-STUDENT-INSERT-REFACTOR (P2)
  - FU-AV2-PHASE-14B-2 (P3) — 18 GET routes
- 5 SQL migrations applied this session: `supabase/migrations/20260429231118_phase_1_4_cs1_classes_student_self_read.sql`, `..._cs1_assessment_records_*.sql`, `..._cs1_student_badges_rewrite.sql`, `20260430010922_phase_1_4_cs2_fix_students_rls_recursion.sql`, `20260430015239_phase_1_4_cs2_fix_class_students_classes_recursion.sql`

## Don't forget

- Any future Access-Model-v2 phase that ships RLS policies must include at least one route in the same phase that reads under SSR client and validates the policy fires correctly. **Not as a follow-up — in the same phase, as a Checkpoint criterion.** Otherwise we accumulate latent recursion bombs that fire one at a time in production. (Lesson #64 operational rule.)
- The 4 client-side UI INSERT sites (FU-AV2-UI-STUDENT-INSERT-REFACTOR P2) leave students with NULL user_id until first login. Phase 1.2's lazy-provision fallback closes the security gap. Phase 1.4's eventual UI batch refactors to a server-side route.
- CS-2's SSR client switch only applies to 2 routes today (`me/support-settings`, `me/unit-context`). The other 4 Phase 1.4b routes (`grades`, `units`, `safety/pending`, `insights`) still call `createAdminClient()` for data reads. They DO call `requireStudentSession` for auth (via Phase 1.4b's earlier explicit migration), so they require sb-* cookies — meaning they need today's frontend swap to work. They'd return correct data but RLS isn't carrying weight on those routes yet.
