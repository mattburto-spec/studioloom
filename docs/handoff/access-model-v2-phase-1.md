# Handoff — access-model-v2-phase-1

**Last session ended:** 2026-04-29T12:50Z (approx — long session, multiple phases shipped)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `c3eb111` "feat(access-v2): Phase 1.4b — migrate 6 GET routes to requireStudentSession"
**Branch:** `access-model-v2-phase-1` — 11 commits ahead of `main`, pushed to origin

## What just happened (this session)

Big productive day — **6+ sub-phases shipped:**

- **Phase 0** merged to main, Vercel green. Phase 1 spun up on its own branch.
- **Phase 1.1a** — `students.user_id` UUID NULL FK auth.users(id) ON DELETE SET NULL + partial index applied to prod via Supabase SQL Editor. Migration shape test (8 cases). Lesson #62 logged (use `pg_catalog.pg_constraint` for cross-schema FK verification, not information_schema).
- **Phase 1.1b** — TS backfill script populated **7 students → 7 auth.users** in prod with synthetic emails (`student-<uuid>@students.studioloom.local`). All 3 verification queries clean (0 NULL user_ids; 7 phase-tagged auth.users; 7 user_profiles via Phase 0 trigger). Idempotent + rollback flag.
- **Phase 1.1d** — Helper extracted to `src/lib/access-v2/provision-student-auth-user.ts`. Wired into 3 server-side INSERT routes (LTI launch, welcome/add-roster, integrations/sync). Add-roster school_id miss caught + fixed.
- **Phase 1.2** — `POST /api/auth/student-classcode-login` route. generateLink + verifyOtp via SSR cookie adapter. Per-IP + per-classcode rate limit. Lazy-provision fallback. Audit_events on every outcome. **VERIFIED END-TO-END IN PROD-PREVIEW** — all 5 tests pass: 200 happy path with sb-* cookies; JWT contains `app_metadata.user_type='student'` + `school_id`; 401 paths correct; audit_events shaped right; Cache-Control: private prevents Vercel CDN stripping cookies.
- **Phase 1.3** — Actor session helpers: `getStudentSession`, `getTeacherSession`, `getActorSession`, `requireStudentSession`, `requireActorSession`. Polymorphic on `app_metadata.user_type`. 18 tests.
- **Phase 1.4a** — **Dual-mode wrapper** — `requireStudentAuth` legacy entry point now tries Supabase Auth FIRST, falls back to legacy cookie. **All 63 student routes auto-upgraded** with zero route file changes. 9 dual-mode tests.
- **Phase 1.4b** — 6 strategic GET routes explicitly migrated to `requireStudentSession` (grades, units, insights, safety/pending, me/support-settings, me/unit-context). Demonstrates the pattern.
- **Side-issues navigated:** parallel session's `units-school-id-hotfix` (`c2ccb7e`) + cleanup commit (`462cfa8`) merged to main without scope conflation. Recommendation taken: keep school_id constraint compliance separate from auth unification.
- **Saveme committed mid-session** (`94b4667`) capturing changelog + decisions-log + ALL-PROJECTS.md updates.

## State of working tree

- `git status --short`: clean
- Tests: **2722 passed | 11 skipped** (was 2642 baseline pre-Phase-1; **+80 across the session**)
- Typecheck: 0 errors
- Pending push: 0 (all 11 commits on `access-model-v2-phase-1` pushed to origin)
- Active-sessions: row claimed at `/Users/matt/CWORK/.active-sessions.txt` line ~39
- Phase 1.2 verified in prod-preview (deploy `9z8JqpG1o`). Vercel bypass token enabled in project settings.

## Next steps — pick up here

Recommended ORDER (highest value first):

- [ ] **Phase 1.5** — RLS simplification on 7 tables. **HIGHEST VALUE remaining work.** Real architectural change to security posture. **Do this with fresh eyes — it's policy authoring, not mechanical migration.**
  - 6 migration pairs to write:
    1. `students_self_read.sql` — students can read own row via `auth.uid() = user_id`
    2. `class_students_self_read.sql` — students read own enrollments
    3. `student_progress_self_read.sql` — simplify (already has teacher access)
    4. `competency_assessments_self_read.sql` — add policy
    5. `fabrication_scan_jobs_self_read.sql` — add student own-job read policy (closes one rls-coverage drift)
    6. `student_sessions_deny_all.sql` — explicit deny-all policy (closes **FU-FF**; intent was already deny-all but undocumented per scanner drift)
  - 2 verifications (no migration):
    - `quest_journeys` already uses `current_setting('request.jwt.claims'...)` — confirm in prod that the JWT claims propagate post-Phase-1.2
    - `design_conversations` already uses `auth.uid() = student_id` — confirm same
  - Tests: extend `src/lib/access-v2/__tests__/rls-harness/students.live.test.ts` (Phase 0 scaffold) — student A vs student B isolation. RUN_RLS_HARNESS env var skip pattern.
  - Apply to prod via Supabase SQL Editor when migrations look clean.

- [ ] **Phase 1.4c** — Migrate Batch B (~21 mutation routes) + Batch C (~17 teacher routes touching student tables) to `requireStudentSession` / `requireActorSession`.
  - **Lower priority** — already covered functionally by Phase 1.4a's dual-mode wrapper. Cosmetic + grants `session.userId` + `session.schoolId` access.
  - Tracked: `FU-AV2-PHASE-14B-2` covers the 18 remaining GET routes. File a parallel `FU-AV2-PHASE-14C` for B+C if not done in Phase 1 directly.

- [ ] **Phase 1.6** — Negative control test (mutate one route, watch fail, revert). Drop the alias pattern from Phase 1.4b routes. Drop legacy fallback in `requireStudentAuth` if Phase 1.4c migrated all callers.

- [ ] **Phase 1.7** — Registry hygiene per brief §4.7. WIRING `auth-system` rewrite, schema-registry spec_drift, feature-flags additions, vendors notes, taxonomy.

- [ ] **Checkpoint A2** — gate criteria (brief §7) all pass. Merge `access-model-v2-phase-1` → `main` after merging in main's school_id hotfix commits via routine `git merge origin/main`.

## Open questions / blockers

- _None blocking._
- **Dual-mode wrapper risk:** if any Phase 1.4c route relies on `auth.studentId` referenced AFTER the auth check (not just at extraction), the alias pattern from 1.4b applies. ~20 files have multi-reference patterns.
- **RLS harness:** Phase 0 scaffold at `src/lib/access-v2/__tests__/rls-harness/` uses `RUN_RLS_HARNESS` env var to skip without Supabase test project credentials. First real tests land in Phase 1.5.

## Key references

- Phase 1 brief: `docs/projects/access-model-v2-phase-1-brief.md` (with §3.7 cross-check + §3.8 verification log)
- Master spec: `docs/projects/access-model-v2.md`
- Build methodology: `docs/build-methodology.md`
- Lessons learned: `docs/lessons-learned.md` — Lesson #62 added this session (pg_catalog vs information_schema)
- Decisions log: `docs/decisions-log.md` — 3 new entries (verifyOtp+SSR pattern; audit_events shape; provisionStudentAuthUser helper)
- Helpers built: `src/lib/access-v2/{provision-student-auth-user,actor-session}.ts`
- Routes built: `src/app/api/auth/student-classcode-login/route.ts`
- Active-sessions: `/Users/matt/CWORK/.active-sessions.txt`
- Phase 1.2 prod-preview verification: deploy `9z8JqpG1o` on `access-model-v2-phase-1` branch. Vercel bypass token in Settings → Deployment Protection → Protection Bypass for Automation.

## Don't forget

- The 4 client-side UI INSERT sites (FU-AV2-UI-STUDENT-INSERT-REFACTOR, P2) leave students with NULL user_id until first login. Phase 1.2's lazy-provision fallback closes the security gap. Phase 1.4 (when it gets to UI batch) refactors to a server-side route.
- Multi-Matt prod data (3 teacher rows at NIS) preserved — not merged. Phase 6 cutover decision deferred.
- ENCRYPTION_KEY rotation script ready but never run live (no encrypted rows in prod yet).
