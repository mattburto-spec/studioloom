# Handoff — access-model-v2

**Last session ended:** 2026-04-29T05:00Z (approximately — saveme committed at `64d2afc`)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `64d2afc` "saveme: Access Model v2 Phase 0 SHIPPED ON BRANCH (29 Apr 2026)"

## What just happened

- **Phase 0 of Access Model v2 SHIPPED ON BRANCH** — all 9 sub-tasks complete. 12 migrations + 5 audit-derived security artifacts + 209 new tests (2433 → 2642 passed; 9 → 11 skipped including the live RLS harness which skips without env). 51+ commits ahead of `main`.
- **Plan corrections during execution:** Path B chosen 28 Apr (ship-before-pilot); Option B for `user_profiles` (Supabase recommendation, separate table extending auth.users via FK); Option A for SIS columns (mig 005 prior art deferred to Phase 6); 7 forward-compat tables instead of 5 (added `school_responsibilities` + `student_mentors` from PYP-coordinator + cross-program-mentorship discovery 28 Apr); 0.8 split into 0.8a/0.8b for safer manual application; multi-Matt prod data preserved as 3 separate teacher rows.
- **Saveme just ran (29 Apr commit `64d2afc`)** — registries synced (api, ai-calls, feature-flags, vendors, RLS coverage, schema-registry); ALL-PROJECTS.md flipped Access Model v2 entry to PHASE 0 SHIPPED ON BRANCH; decisions-log appended 9 new decisions; changelog appended a comprehensive Phase 0 entry; doc-manifest registered 4 new docs; master CWORK/CLAUDE.md status block updated.
- **Checkpoint A1 verification ran with 5 PASS / 2 PARTIAL / 3 PENDING-MATT.** Code-side complete; 3 Matt-facing actions remain before merge.

## State of working tree

- `git status --short`: **clean**
- Pending-push count: `git rev-list --count main..HEAD` = **52** (51 Phase 0 commits + 1 saveme commit)
- Branch is local-only — never pushed (per push discipline + Matt-applies-Supabase rule)
- Tests: **2642 passed | 11 skipped** (the 2 RLS harness live tests skip without `SUPABASE_TEST_URL`; 9 pre-existing skips)
- Typecheck: 0 errors
- Active-sessions row claimed at `/Users/matt/CWORK/.active-sessions.txt` line 39

## Next steps

Ordered. The first 5 are Matt's manual actions to satisfy A1 PENDING-MATT criteria; then merge.

- [ ] **Apply remaining 7 Phase 0 migrations to Supabase manually** (timestamp order — first 5 already applied; these are queued):
  - [ ] `20260428214009_school_collections_and_guardians.sql` — 4 tables (school_resources + relations, guardians + student_guardians)
  - [ ] `20260428214403_consents.sql` — 1 table (polymorphic consent tracking, RLS deny-all)
  - [ ] `20260428214735_school_responsibilities_and_student_mentors.sql` — 2 tables (programme coordinators + cross-program mentorship)
  - [ ] `20260428215923_class_members_and_audit_events.sql` — 2 tables (class roles + immutable audit log)
  - [ ] `20260428220303_ai_budgets_and_state.sql` — 2 tables (AI budget cascade + per-student counter)
  - [ ] `20260428221516_phase_0_8a_backfill.sql` — **READ NOTICE LOG CAREFULLY** (orphan teachers → personal schools; students/units cascade tail; class_members lead_teacher seed). RAISE NOTICE prints orphan counts before/after at every step. RAISE EXCEPTION if any orphan tail remains. WARNING NOTICE if `classes.school_id` NULLs remain (these block 0.8b — the WARNING gives the exact UPDATE statement to run manually).
  - [ ] `20260428222049_phase_0_8b_tighten_not_null.sql` — **only after 0.8a's NOTICE log is clean.** Pre-flight RAISE EXCEPTION fails fast with actionable error if any column has NULLs.
- [ ] **Run multi-Matt audit query** from `docs/security/multi-matt-audit-query.md` against prod. Capture output. Decide on Phase 6 cutover approach (merge or keep-separate per group of duplicate-name candidates).
- [ ] **Enable Supabase MFA** per `docs/security/mfa-procedure.md`:
  - [ ] Project-level: Supabase dashboard → Auth → Providers → MFA → enable TOTP, enforcement=required
  - [ ] Enrol your platform-admin account TOTP first; save recovery codes in 1Password
- [ ] **Run ENCRYPTION_KEY fire drill** per `docs/security/encryption-key-rotation.md`:
  - [ ] Generate new key (`openssl rand -hex 32`), store in 1Password
  - [ ] Take Supabase backup (required pre-rotation)
  - [ ] `tsx scripts/security/rotate-encryption-key.ts --dry-run` — expect Failed=0
  - [ ] `tsx scripts/security/rotate-encryption-key.ts` (live)
  - [ ] Update `ENCRYPTION_KEY` in Vercel env vars + redeploy
  - [ ] Verify a teacher BYOK flow still works
  - [ ] Securely destroy old key
- [ ] **Saveme again** after the prod actions land (ALL-PROJECTS.md status updated to "SHIPPED + applied to prod 29 Apr 2026"; rotation log + MFA-enabled date appended)
- [ ] **Checkpoint A1 final sign-off** — once all PENDING-MATT items closed, A1 flips to ALL PASS
- [ ] **Merge `access-model-v2` → `main`** via PR (NOT in this worktree — main is the merge baseline; either use a throwaway worktree at `../questerra-merge` OR open a PR on origin)
- [ ] **Phase 1 brief** — auth unification (~3 days). Every student → `auth.users` via custom Supabase flow + `getStudentSession()` / `getActorSession()` helpers + migrate every student-facing route to the unified helper. Phase 0 is the foundation; Phase 1 is the load-bearing rewrite.

## Open questions / blockers

- **Apply order matters** for migrations 0.8a + 0.8b — read 0.8a's NOTICE log before applying 0.8b. If 0.8a leaves any `classes.school_id` NULLs, run the manual UPDATE shown in 0.8a's WARNING + 0.8b's RAISE EXCEPTION before applying 0.8b.
- **Apple OAuth** is gated behind a feature flag (`auth.oauth_apple_enabled`, default `false`) for Phase 2. Decision deferred per §7 Resolved Decisions item 1 — add when first iOS-native school asks ($99/yr Developer account isn't worth the spend pre-customer).
- **Schema-registry diff is large** (+2300 lines) because `sync-schema-registry.py` recomputed every entry, not just the new ones. Spot-check a few rows if the auto-generation looks suspect, but the gate-checks on apply already verify shape coherence.
- **WIRING.yaml `auth-system` entry not yet updated** — Phase 0 ships schema seams only; system-level WIRING entries land when each system gets code in Phase 1+. No action required this session.
- _None other._

## Key references

- **Master spec:** `docs/projects/access-model-v2.md`
- **Phase 0 brief:** `docs/projects/access-model-v2-phase-0-brief.md`
- **Security artifacts:** `docs/security/{multi-matt-audit-query.md, mfa-procedure.md, encryption-key-rotation.md}` + `scripts/security/rotate-encryption-key.ts`
- **RLS test harness scaffold:** `src/lib/access-v2/__tests__/rls-harness/`
- **Decisions:** `docs/decisions-log.md` — 9 new entries dated 28-29 Apr 2026
- **Changelog:** `docs/changelog.md` — comprehensive 29 Apr 2026 entry
