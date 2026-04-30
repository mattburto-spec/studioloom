# Handoff — main

**Last session ended:** 2026-04-30T13:30Z (long methodical day — Phase 1 close + Phase 1.4 client-switch fully shipped + all 5 follow-ups closed)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `9c35682` "fix(access-v2): split students Teachers manage FOR ALL — INSERT was broken" (saveme commit follows on top)
**Branch:** `main` — 0 ahead, 0 behind (origin in sync after saveme push)

## What just happened (this session)

Full day, three continuous sessions, one coherent piece of work: closed every loose end from Phase 1 → Phase 1.4 client-switch → all P2/P3 follow-ups in the access-model-v2 project. Phase 2 starts tomorrow on a fully clean foundation.

### Latest segment (post-CS-3 follow-up cleanup)

- **FU-AV2-UNITS-ROUTE-CLASS-DISPLAY (P3) ✅** — `/api/student/units` now picks the active enrollment's class for display, not the legacy archived one. Three fixes: dropped `students.class_id` legacy fallback, filtered archived classes, recency-ordered enrollments. Smoke verified live (test2 sees Service LEEDers, not g9 design).

- **FU-AV2-PHASE-14B-2 (P3) ✅** — 18 GET-only student routes migrated from `requireStudentAuth` to `requireStudentSession`. Pure cosmetic + grants `session.userId` access. 3 test files updated.

- **FU-AV2-STUDENT-BADGES-COLUMN-TYPE (P3) ✅** — `student_badges.student_id` migrated TEXT → UUID + FK to `students(id)` ON DELETE CASCADE + dropped `::text` casts in all 3 policies. Pre-flight verified 4 rows, all UUID-shaped, zero orphans.

- **FU-AV2-UI-STUDENT-INSERT-REFACTOR (P2) ✅** — Built new `POST /api/teacher/students` atomic create + provision + enroll route. 11 new route tests. Migrated all 5 client-side INSERT call sites + 2 helpers to use the route. **Architectural impact:** every UI-created student now has auth.users provisioned at create time, not on first login. Closes the NULL user_id security window.

- **CS-2 latent WITH CHECK bug fixed** — surfaced during UI-INSERT smoke. The CS-2 SECURITY DEFINER hotfix's FOR ALL policy used `is_teacher_of_student(NEW.id)` which returns false for INSERTs (new row not yet in table). Fix: split FOR ALL into 4 per-cmd policies. INSERT uses direct `author_teacher_id = auth.uid()` check. Latent bug, fixed before any production INSERT was attempted via non-admin client.

## State of working tree

- `git status --short`: clean after saveme commit lands.
- Tests: **2817 passed | 11 skipped** (was 2792 at start of session; +25 across the day).
- Typecheck: 0 errors.
- Pending push: 0 (saveme commit pushed before session ends).
- 10 RLS/schema migrations applied to prod today.
- Vercel: `studioloom.org` deployed green. All 6 Phase 1.4b routes load-bearing under RLS.
- Smoke verified end-to-end: test2 (student) → dashboard → 4 CS-3 routes return real data + correct RLS filtering. Teacher → Add Student via new route → student created with user_id populated immediately.

## Day-end follow-up state

| FU | Priority | Status |
|---|---|---|
| FU-AV2-RLS-SECURITY-DEFINER-AUDIT | P2 | ✅ closed (comprehensive audit, zero remaining cycles) |
| FU-AV2-UNITS-ROUTE-CLASS-DISPLAY | P3 | ✅ closed |
| FU-AV2-PHASE-14B-2 | P3 | ✅ closed |
| FU-AV2-STUDENT-BADGES-COLUMN-TYPE | P3 | ✅ closed |
| FU-AV2-UI-STUDENT-INSERT-REFACTOR | P2 | ✅ closed |

**No open follow-ups in the access-model-v2 cluster.** Other follow-ups in the broader codebase (FU-FF, FU-Y, etc.) tracked separately.

## Next steps — pick up here

- [ ] **Phase 2 — OAuth Google/Microsoft + email/password for teachers** (~3-4 days). Per `docs/projects/access-model-v2.md`. Builds on Phase 1's now-load-bearing auth foundation. Polymorphic `getActorSession()` from Phase 1.3 is the seam Phase 2 plugs into. Real pilot-readiness move.

- [ ] **Or — Strategic pivot — CompliMate validation sprint.** June 1 GACC Decree 280 deadline (~32 days out). 0 customer conversations on record. The bottleneck is outreach, not code.

- [ ] **Or — switch projects.** Preflight Phase 8-3 / dashboard-v2 polish are queued.

## Open questions / blockers

- _None blocking._
- The day's RLS policy work surfaced a recurring lesson: SECURITY DEFINER helpers that look up the row in question only work for SELECT/UPDATE/DELETE — INSERT WITH CHECK requires direct column expressions because the new row isn't yet in the table. Captured in the migration but not yet promoted to a formal Lesson #65. Promote when the next phase starts shipping RLS work.

## Key references

- Lesson #64 (the headline takeaway from the day): `docs/lessons-learned.md` → bottom — Cross-table RLS subqueries silently recurse; SECURITY DEFINER for any policy that joins through another RLS-protected table.
- Phase 1.4 client-switch brief: `docs/projects/access-model-v2-phase-14-client-switch-brief.md`
- Master spec: `docs/projects/access-model-v2.md`
- New route: `src/app/api/teacher/students/route.ts` (POST, atomic create + provision + optional enroll)
- New route tests: `src/app/api/teacher/students/__tests__/route.test.ts` (11 tests)
- Decisions: `docs/decisions-log.md` — 8+ entries from today's three sessions
- 10 prod migrations:
  - CS-1: `20260429231118`, `20260429231124`, `20260429231130`
  - CS-2 hotfixes: `20260430010922`, `20260430015239`
  - CS-3: `20260430030419`
  - Cleanup: `20260430042051` (student_badges col type), `20260430053105` (students Teachers split)
  - (Phase 1.5/1.5b's 8 from earlier in the day)

## Don't forget

- **Lesson #64 operational rule:** any future Access-Model-v2 phase that ships RLS policies must include at least one SSR-client smoke test in the same phase, as a Checkpoint criterion. Not deferred.
- **Lesson candidate (not yet formalized):** SECURITY DEFINER helpers can't be used in WITH CHECK clauses for INSERT if they look up the row by id — the new row isn't visible yet. Use direct column comparisons for INSERT branches. Captured in migration `20260430053105` WHY block.
- **Phase 6 cutover scope absorbed early today:** the frontend login swap from `/api/auth/student-login` → `/api/auth/student-classcode-login` was originally scheduled for Phase 6 but landed today because Phase 1.4b's regression demanded it. The legacy route + `student_sessions` table + `students.class_id` legacy column still exist; full Phase 6 cleanup still pending.
- The test student `newtest` is in prod from the FU-UI-INSERT smoke. Either delete it (`DELETE FROM students WHERE username = 'newtest'`) or leave it — it's harmless on the teacher's roster.
