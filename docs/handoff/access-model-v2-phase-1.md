# Handoff — access-model-v2-phase-1

**Last session ended:** 2026-04-29T12:15Z (approx)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `e5c77e2` (this saveme commit lands next, after which HEAD bumps)
**Branch:** `access-model-v2-phase-1` — 8+ commits ahead of `main`, pushed to origin

## What just happened (this session)

- **Phase 1.1a** — `students.user_id` column + FK to auth.users(id) + partial index migration shipped to branch + applied to prod via Supabase SQL Editor. Verified via `pg_catalog.pg_constraint` query (Lesson #62 — information_schema FK lookups across schemas can lie). Migration shape test: 8 cases, all passing.
- **Phase 1.1b** — TS backfill script `scripts/access-v2/backfill-student-auth-users.ts` shipped + run live against prod. **7 students backfilled** → 7 auth.users rows + 7 user_profiles rows (trigger fired correctly). Synthetic email format `student-<uuid>@students.studioloom.local` (RFC 6762 reserved TLD; opaque, deterministic, never used for outbound email). app_metadata: `user_type='student'`, `school_id`, `created_via='phase-1-1-backfill'`. user_metadata.user_type also set so Phase 0 trigger fires.
- **Phase 1.1d** — Helper extracted to `src/lib/access-v2/provision-student-auth-user.ts`. Wired into 3 server-side INSERT routes (LTI launch, welcome/add-roster, integrations/sync). Backfill script refactored to delegate to helper. Add-roster school_id miss caught + fixed via cross-session audit. Filed FU-AV2-UI-STUDENT-INSERT-REFACTOR (P2) for the 4 client-side UI INSERT sites — Phase 1.4 will refactor them to a server-side `POST /api/teacher/students` route. 15 helper tests + 21 backfill tests, all passing.
- **Phase 1.2** — `POST /api/auth/student-classcode-login` route shipped (~400 lines). generateLink + verifyOtp via SSR cookie adapter; per-IP + per-classcode rate limiting; lazy-provision fallback for UI-created students; audit_events on every outcome; sanitised error logging; Cache-Control: private. 9 route tests, all passing. **VERIFIED END-TO-END IN VERCEL PREVIEW** — Tests 1/2/3a/3b/4 all pass: HTTP 200 happy path with sb-* cookies, JWT contains `app_metadata.user_type='student'`, 401 paths correct, audit_events rows shaped correctly with actor_id+ip_address.
- **Side-fix from parallel session:** school_id NOT NULL trip-mines from Phase 0.8b closed on main by `units-school-id-hotfix` (`c2ccb7e`) + cleanup commit (`462cfa8`). My branch already had school_id population on the 3 routes I touched (LTI launch + integrations/sync from 1.1d, plus add-roster fix). Branch needs routine merge from main when Phase 1 ships.

## State of working tree

- `git status --short`: clean (after this saveme commit)
- Tests: **2695 passed | 11 skipped** (was 2642 baseline pre-Phase-1)
- Typecheck: 0 errors against `tsconfig.check.json`
- Pending push: 8 commits on `access-model-v2-phase-1` branch, all pushed to origin
- `cookies.txt` removed from worktree (test artifact from preview verification)

## Next steps — resume here

- [ ] **Phase 1.3** — `getStudentSession()` / `getActorSession()` polymorphic helpers
  - New file: `src/lib/access-v2/actor-session.ts`
  - `getStudentSession(request)` reads sb-* cookie via SSR client → returns `{ type:'student', studentId, userId, schoolId }` or null
  - `getActorSession(request)` polymorphic — dispatches on `app_metadata.user_type` from JWT (student / teacher / fabricator / platform_admin)
  - Convenience wrappers: `requireStudentSession`, `requireActorSession`
  - **Compose** existing `verifyTeacherCanManageStudent`, `resolveStudentClassId`, `current_teacher_school_id` — DO NOT re-implement
  - **Backwards compat:** existing `requireStudentAuth` wrapper kept callable; internally delegates to new helper with legacy-cookie fallback during Phase 1.4 grace period
  - Pure code, no migration. ~30-45 min plus tests.
- [ ] **Phase 1.4** — Migrate 63 student routes + 17 teacher routes in 3 batches (A: read-only, B: mutation, C: teacher-touching-student). ~1 day.
- [ ] **Phase 1.5** — RLS simplification on 7 tables (students, class_students, student_progress, competency_assessments, quest_journeys, design_conversations, fabrication_scan_jobs). 6 migrations. Closes FU-FF (`student_sessions` deny-all policy). ~0.5 day.
- [ ] **Phase 1.6** — Negative control test + cleanup + grace-period docs. ~0.5 day.
- [ ] **Phase 1.7** — Registry hygiene: WIRING.yaml `auth-system` rewrite, schema-registry spec_drift, feature-flags additions, vendors notes, taxonomy. Closes FU-FF + partial FU-HH. ~0.5 day.
- [ ] **Checkpoint A2** — full gate criteria pass; merge `access-model-v2-phase-1` → `main` (after merging in main's school_id hotfix commits via routine `git merge origin/main`).

## Open questions / blockers

- _None blocking._
- **Vercel bypass token** stays enabled for future preview testing. Token: stored in Vercel Settings → Deployment Protection → Protection Bypass for Automation.
- When Phase 1.4 ships and routes are migrated to the new helper, the old `/api/auth/student-login` legacy route stays callable as a grace-period fallback until Phase 6 cutover.

## Key references

- Phase 1 brief: `docs/projects/access-model-v2-phase-1-brief.md` (with §3.7 cross-check + §3.8 verification log + §4.0 not adopted)
- Master spec: `docs/projects/access-model-v2.md`
- Build methodology: `docs/build-methodology.md`
- Lessons learned: `docs/lessons-learned.md` (#43, #47, #49, #51, #54, #60, #61, #62)
- Decisions log: `docs/decisions-log.md` — 3 new entries from this session
- Helper: `src/lib/access-v2/provision-student-auth-user.ts`
- New route: `src/app/api/auth/student-classcode-login/route.ts`
- Active-sessions: `/Users/matt/CWORK/.active-sessions.txt` (claim row for this worktree)
