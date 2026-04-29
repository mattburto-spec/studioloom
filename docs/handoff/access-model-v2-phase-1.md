# Handoff — access-model-v2-phase-1

**Last session ended:** 2026-04-29T14:55Z (long evening session — Phase 1.3, 1.4a/b, 1.5, 1.5b, prod-preview verification, debugging the URL-staleness false-alarm)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `80d68f6` "chore(access-v2): revert TEMP Phase 1.4 diagnostic logging — bug was a stale URL"
**Branch:** `access-model-v2-phase-1` — 21 commits ahead of `main`, all pushed to origin

## What just happened (this session)

**Massive session — 5 sub-phases shipped on top of the previous saveme:**

- **Phase 1.3** — Polymorphic actor session helpers at `src/lib/access-v2/actor-session.ts`. `getStudentSession`, `getActorSession`, `getTeacherSession`, `requireStudentSession`, `requireActorSession`. Dispatches on `app_metadata.user_type`. 18 tests.
- **Phase 1.4a** — **DUAL-MODE wrapper** — rewrote legacy `requireStudentAuth` in `src/lib/auth/student.ts` to try `getStudentSession` FIRST, fall back to legacy `student_sessions` cookie path. **Net result: all 63 student routes auto-upgraded with zero route file changes.** 9 dual-mode tests.
- **Phase 1.4b** — 6 GET routes explicitly migrated to `requireStudentSession` (grades, units, insights, safety/pending, me/support-settings, me/unit-context). Cosmetic over 1.4a; demonstrates pattern; unlocks `session.userId` + `session.schoolId` access. 18 remaining GET routes filed as FU-AV2-PHASE-14B-2 (P3).
- **Phase 1.5** — 4 RLS migrations on branch. **CRITICAL FINDING:** pre-flight audit caught that 7 existing student-side policies (on competency_assessments, quest_journeys+milestones+evidence, design_conversations+turns) used `student_id = auth.uid()` which was always wrong post-Phase-1 (students.id ≠ auth.users.id). Worked accidentally only because legacy custom-token student auth bypassed RLS via admin client. Phase 1.5 rewrites them with the canonical `auth.uid() → students.user_id → students.id` chain. Plus 1 additive (students self-read).
- **Phase 1.5b** — 4 additive RLS migrations on branch. class_students parallel auth.uid path, student_progress self-read, fabrication_jobs + fabrication_scan_jobs self-read, student_sessions explicit deny-all (closes FU-FF). Drift dropped from 7 → 5 entries in rls-coverage.

**Phase 1.4 verified end-to-end in prod-preview (3 tests, all 200):**
- Test 1: login mints sb-* cookies ✅
- Test 2: explicit-migration route via SSR session ✅
- Test 3: non-migrated route via dual-mode wrapper ✅

**Lesson #63 added** — Vercel preview URLs are deployment-specific. Each push creates a new URL hash. Use the auto-aliased branch URL pattern `studioloom-git-<branch>-...vercel.app` for "latest on branch" testing. Took ~30 min of diagnostic-logging and false debugging before realising we were testing an old deployment.

**Lesson #62 also added earlier in the session** — pg_catalog vs information_schema for cross-schema FK verification.

## State of working tree

- `git status --short`: clean (after this saveme commit)
- Tests: **2762 passed | 11 skipped** (was 2642 baseline pre-Phase-1; +120 across the day)
- Typecheck: 0 errors
- Pending push: 0 (all 21 commits on `access-model-v2-phase-1` pushed)
- Active-sessions: row claimed at `/Users/matt/CWORK/.active-sessions.txt`
- Vercel: branch alias URL `https://studioloom-git-access-model-v2-phase-1-mattburto-specs-projects.vercel.app` always points at latest deploy. Bypass token for automation: see Vercel project settings.

## Next steps — pick up here

Recommended ORDER (highest priority first):

- [ ] **Apply 8 RLS migrations to prod** via Supabase SQL Editor. Apply in timestamp order:
  - **Phase 1.5 (4 migrations — 3 fix BROKEN policies):**
    - [ ] `20260429130730_phase_1_5_students_self_read.sql` (additive)
    - [ ] `20260429130731_phase_1_5_competency_assessments_student_rewrite.sql` (rewrites 2 broken)
    - [ ] `20260429130732_phase_1_5_quest_journeys_student_rewrite.sql` (rewrites 4 broken across quest_journeys + quest_milestones + quest_evidence)
    - [ ] `20260429130733_phase_1_5_design_conversations_student_rewrite.sql` (rewrites 2 broken across design_conversations + design_conversation_turns)
  - **Phase 1.5b (4 additive migrations):**
    - [ ] `20260429133359_phase_1_5b_class_students_self_read_authuid.sql`
    - [ ] `20260429133400_phase_1_5b_student_progress_self_read.sql`
    - [ ] `20260429133401_phase_1_5b_fabrication_jobs_and_scan_jobs_student_read.sql`
    - [ ] `20260429133402_phase_1_5b_student_sessions_deny_all.sql` (closes FU-FF)
  - After all 8 land, run `python3 scripts/registry/scan-rls-coverage.py` to verify `student_sessions` + `fabrication_scan_jobs` exit the drift bucket.

- [ ] **Phase 1.4c** — migrate Batch B (mutations, ~21 routes) + Batch C (teacher routes touching students, ~17 routes). Mostly mechanical; same pattern as 1.4b. Lower priority — already covered by Phase 1.4a's dual-mode wrapper functionally. Cosmetic + grants `session.userId`/`session.schoolId` access.

- [ ] **Phase 1.4 client-switch** — change routes from `createAdminClient()` to an RLS-respecting SSR client. **This is what actually turns the new RLS policies "on" in real route traffic.** Higher-stakes; route-by-route review with smoke testing.

- [ ] **Phase 1.6** — negative control test + cleanup. Delete the dual-mode legacy fallback in `requireStudentAuth` (after all routes migrated). Drop the alias pattern from Phase 1.4b routes.

- [ ] **Phase 1.7** — Registry hygiene per brief §4.7. WIRING `auth-system` rewrite, schema-registry spec_drift, feature-flags additions, vendors notes, taxonomy.

- [ ] **Checkpoint A2** — full gate criteria pass. Merge `access-model-v2-phase-1` → `main` after `git merge origin/main` to absorb the school_id hotfix commits from earlier today.

## Open questions / blockers

- _None blocking._
- **8 RLS migrations awaiting prod apply** — that's the immediate fresh-eyes task tomorrow. Apply via Supabase SQL Editor in timestamp order. Each migration's WHY/IMPACT/ROLLBACK comment block is comprehensive — read before applying.
- **Phase 1.4a + 1.4b + 1.2 verified in prod-preview** — no further architectural risk in the auth path. Phase 1.4c is mechanical, Phase 1.5 prod apply is the next high-attention item.
- **18 GET routes still unmigrated** (FU-AV2-PHASE-14B-2 P3) — they ALL work via dual-mode wrapper. Migration is purely cosmetic.

## Key references

- Phase 1 brief: `docs/projects/access-model-v2-phase-1-brief.md` (with §3.7 cross-check + §3.8 verification log)
- Master spec: `docs/projects/access-model-v2.md`
- Build methodology: `docs/build-methodology.md`
- Lessons learned: `docs/lessons-learned.md` — #62 + #63 added today
- Decisions log: `docs/decisions-log.md` — multiple Phase 1 entries from today
- Helpers built: `src/lib/access-v2/{provision-student-auth-user,actor-session}.ts`
- Routes built: `src/app/api/auth/student-classcode-login/route.ts`
- Migrations on branch (8 RLS pending prod apply):
  - `supabase/migrations/2026042913073{0,1,2,3}_phase_1_5_*.sql`
  - `supabase/migrations/2026042913335{9}+2026042913340{0,1,2}_phase_1_5b_*.sql`
- Active-sessions: `/Users/matt/CWORK/.active-sessions.txt`
- Branch-alias preview URL: `https://studioloom-git-access-model-v2-phase-1-mattburto-specs-projects.vercel.app`

## Don't forget

- The 4 client-side UI INSERT sites (FU-AV2-UI-STUDENT-INSERT-REFACTOR P2) leave students with NULL user_id until first login. Phase 1.2's lazy-provision fallback closes the security gap. Phase 1.4 (when it gets to UI batch) refactors to a server-side route.
- Multi-Matt prod data (3 teacher rows at NIS) preserved — not merged. Phase 6 cutover decision deferred.
- ENCRYPTION_KEY rotation script ready but never run live (no encrypted rows in prod yet).
- The 6 Phase 1.4b migrated routes (grades, units, insights, safety/pending, me/support-settings, me/unit-context) use an alias pattern (`const auth = { studentId: session.studentId }`) for tight diffs. Phase 1.6 cleanup inlines `session.studentId` directly.
- After Phase 1.4 client-switch ships, the routes will need RLS-respecting SSR client construction in addition to the helper change. Phase 1.5 + 1.5b's policies are pre-positioned for that work.
