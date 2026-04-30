# Handoff — main

**Last session ended:** 2026-04-30T11:30Z (CS-3 SHIPPED + comprehensive RLS audit closed — Phase 1.4 client-switch done for all 6 Phase 1.4b routes)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `a958a2b` "fix(access-v2): add students-read-own-assigned-units RLS policy (CS-3 hotfix)" (saveme commit follows on top)
**Branch:** `main` — 0 ahead, 0 behind (origin in sync after saveme push)

## What just happened (this session)

This was a long methodical day across 3 sessions. Final state: Phase 1 closed under Option A + Phase 1.4 client-switch done for all 6 Phase 1.4b routes + RLS load-bearing in production for the first time + all latent recursion cycles fixed.

### Latest segment (CS-3 + audit close + saveme)

- **Comprehensive RLS audit (FU-AV2-RLS-SECURITY-DEFINER-AUDIT closed ✅ RESOLVED):** Queried `pg_policies` for every cross-table-subquery pattern across the 21 tables CS-3 routes touch. Mapped each potential cycle. Verdict: **zero remaining cycles** beyond the two already fixed (`students↔class_students`, `classes↔class_students`). Audit table preserved in the resolved FU entry as the safety proof.

- **CS-3 (4 routes switched to SSR client):** `grades`, `units`, `safety/pending`, `insights` — all switched from `createAdminClient()` → `createServerSupabaseClient()`. Tests passing, typecheck clean, pushed to main.

- **CS-3 hotfix (1 migration applied to prod):** Smoke surfaced empty results from 3 of 4 routes. `units` table only had `Teachers read own or published units` policy — students could read only published units; unpublished assigned units were RLS-blocked. Added `Students read own assigned units` policy via `class_units → class_students → students` chain. Applied + verified.

- **Re-smoke (all 4 routes confirmed live):** test2 incognito → all 4 endpoints return real data with correct RLS filtering.

- **Schema-registry YAML fix:** earlier today's CS-1 saveme had a Python script that appended spec_drift entries AFTER `spec_drift: []` instead of replacing — produced invalid YAML at 3 locations. Caught when api-scanner failed to parse. Fixed via regex substitution + manual restructure for `classes` (had a separate `changes_in_phase_7a` field interleaved).

- **Pre-existing finding documented:** `/api/student/units` route shows wrong class for multi-class units (picks legacy `students.class_id` archived class over active enrollment). Filed FU-AV2-UNITS-ROUTE-CLASS-DISPLAY (P3). Display-layer bug, not a CS-3 regression.

## State of working tree

- `git status --short`: clean after saveme commit lands.
- Tests: **2806 passed | 11 skipped** (no regression today).
- Typecheck: 0 errors.
- Pending push: 0.
- 6 RLS migrations applied to prod across the day:
  - CS-1: `20260429231118` (classes), `20260429231124` (assessment_records), `20260429231130` (student_badges)
  - CS-2 hotfixes: `20260430010922` (students↔class_students), `20260430015239` (classes↔class_students)
  - CS-3 hotfix: `20260430030419` (units student-read)
- Total Access-Model-v2 RLS work in prod: 14 RLS migrations + 12 Phase 0 schema migrations = 26 migrations.
- Vercel: `studioloom.org` deployed green.

## Phase 1.4 client-switch — final state

All 6 Phase 1.4b routes use the RLS-respecting SSR client:
- `me/support-settings` ✅ (CS-2)
- `me/unit-context` ✅ (CS-2)
- `grades` ✅ (CS-3)
- `units` ✅ (CS-3)
- `safety/pending` ✅ (CS-3)
- `insights` ✅ (CS-3)

Phase 1.5/1.5b/CS-1/CS-3 student-side policies are load-bearing across the entire Phase 1.4b surface. App-level filtering remains defense-in-depth on top.

## Next steps — pick up here

Three paths from here. Honest pick: **option 1 — pause and pick a strategic next step (probably Phase 2) tomorrow.** Today shipped a major architectural milestone (RLS actually enforcing in prod) plus closed multiple latent bugs.

- [ ] **Option 1 — Phase 2 (OAuth Google/Microsoft + email/password for teachers, ~3-4 days).** Builds on Phase 1's now-load-bearing auth foundation. Real pilot-readiness move. The polymorphic `getActorSession()` from Phase 1.3 is the seam Phase 2 plugs into.

- [ ] **Option 2 — CS-3 follow-on**: migrate the 18 unmigrated GET routes (FU-AV2-PHASE-14B-2 P3) to SSR client + `requireStudentSession` for consistency. Mostly mechanical. Could surface 1-2 more units-style "no student policy on this table" findings; same pattern to fix. ~0.5 day.

- [ ] **Option 3 — Strategic pivot**: CompliMate validation sprint (June 1 GACC Decree 280 deadline ~32 days out, 0 customer conversations on record). Deploy + 10 cold messages. The bottleneck is outreach, not code.

- [ ] **Option 4 — Take the rest of the day off / sleep on it.** Long methodical session, real milestone. The follow-ups are all tracked.

## Open questions / blockers

- _None blocking._
- **Phase 1.4 client-switch is functionally complete** for the 6 Phase 1.4b routes. Remaining work tracked in follow-ups, none urgent.

## Key references

- Lesson #64 (the headline takeaway from the day): `docs/lessons-learned.md` → bottom — Cross-table RLS subqueries silently recurse; SECURITY DEFINER for any policy that joins through another RLS-protected table.
- Phase 1.4 client-switch brief: `docs/projects/access-model-v2-phase-14-client-switch-brief.md`
- Master spec: `docs/projects/access-model-v2.md`
- Decisions: `docs/decisions-log.md` — 4 entries from earlier today (SECURITY DEFINER pattern, additive helper refactor, frontend login swap, student_badges column-type)
- Open follow-ups (from `docs/projects/dimensions3-followups.md`):
  - FU-AV2-RLS-SECURITY-DEFINER-AUDIT ✅ RESOLVED — comprehensive audit, zero cycles remain
  - **FU-AV2-UNITS-ROUTE-CLASS-DISPLAY** (P3 NEW) — display-layer bug, multi-class units pick archived class
  - FU-AV2-STUDENT-BADGES-COLUMN-TYPE (P3) — column should be UUID + FK
  - FU-AV2-UI-STUDENT-INSERT-REFACTOR (P2)
  - FU-AV2-PHASE-14B-2 (P3 — 18 GET routes)

## Don't forget

- Lesson #64 operational rule: every future Access-Model-v2 phase that ships RLS policies must include at least one route in the same phase that reads under SSR client and validates the policy fires correctly. **Not as a follow-up — in the same phase, as a Checkpoint criterion.**
- The 18 GET routes from FU-AV2-PHASE-14B-2 still use `requireStudentAuth` (dual-mode wrapper). They work via legacy fallback for legacy-cookie students AND via Supabase Auth for sb-* cookie students. Cosmetic migration. The dual-mode wrapper means there's no behavioral gap.
- The 4 client-side UI INSERT sites (FU-AV2-UI-STUDENT-INSERT-REFACTOR P2) still use direct browser Supabase client. Phase 1.2's lazy-provision closes the security gap.
- Phase 6 cutover removes legacy `student-login` route + `student_sessions` table + `students.class_id` legacy column + the dual-mode wrapper. Many of the smaller follow-ups auto-resolve at that point.
