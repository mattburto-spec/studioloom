# Handoff — main

**Last session ended:** 2026-05-01T11:00Z (Phase 2 CLOSED ✅; saveme run; Phase 3 next)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `6e768cc` "docs(access-v2): Phase 2 Checkpoint A3 ✅ PASS — all 8 criteria green" (saveme commit pushes on top)
**Branch:** `main` — 0 ahead of `origin/main` after this saveme push.
**Pending push:** 0.

## What just happened (this session)

Closed out Phase 2 of access-model-v2. Phase 2.4 + 2.5 shipped, plus a Phase 1 trigger leak surfaced + fixed mid-checkpoint.

- **Phase 2.4 Apple OAuth scaffold (`6dd4bb4`)** — Apple sign-in button + handler in `LoginForm.tsx`, gated by `allowedModes.includes("apple")`. 3 layers off by default. 2 new helper tests.
- **/api/admin/* Cache-Control: private (`41e7f3c`)** — Lesson #11 gap closed. Admin routes were missed in Phase 1B-2 hardening. Surfaced during /admin/teachers smoke 401.
- **Phase 1 spillover — `handle_new_teacher` trigger fix** (`7bc19ea` + `2a34191`) — 18-month-old trigger from `001_initial_schema.sql` was leaking phantom teacher rows for every Phase 1.1d student auth.users insert. Migration `20260501103415_fix_handle_new_teacher_skip_students.sql` updated trigger to skip `user_type='student'` + safety-asserted backfill DELETE (refused to delete if any leaked row had FK references in classes/units/students; none did). **Applied to prod 1 May 2026 — 7 rows cleaned.** Security audit clean.
- **Phase 2.5 Checkpoint A3 ✅ PASS (`700c040` + `6e768cc`)** — All 8 functional smoke criteria green. Email/password sign-in + teacher invite flow verified during admin smoke. Sole open FU: `FU-OAUTH-LANDING-FLASH` P2 (cosmetic, deferred).
- **Saveme** — Lesson #65 logged (old triggers don't know about new user types); 5 decisions appended to decisions-log.md; changelog +1 session entry; master CWORK CLAUDE.md timestamp + status updated.

## State of working tree

- `git status --short`: clean after saveme commit.
- Tests: **2830 passed | 11 skipped** (was 2828 — +2 from Phase 2.4 Apple tests).
- Typecheck: 0 errors (strict project config).
- Vercel: prod deployed green at `studioloom.org` after the most recent push.
- Migrations applied to prod:
  - `20260501045136_allowed_auth_modes.sql` (Phase 2.3, applied earlier today).
  - `20260501103415_fix_handle_new_teacher_skip_students.sql` (Phase 1 spillover, applied later today).

## Next steps — pick up here

- [ ] **Phase 3 — Auth Unification (~3 days per master spec)**
  - Every student → `auth.users` via `getStudentSession()` helper.
  - Route migration: replace custom token sessions with Supabase Auth on student-side routes.
  - This is the big one. Pre-flight ritual: read `access-model-v2.md` §Phase 3, draft a Phase 3 brief, run registry cross-check (Step 5c), enumerate routes that consume the student session.
  - Worth a fresh session — context-heavy, methodology-discipline matters.

- [ ] **`FU-OAUTH-LANDING-FLASH` (P2, cosmetic)**
  - Diagnose Supabase URL Configuration (Site URL + Redirect URLs allow list).
  - Likely fix: Site URL = `https://www.studioloom.org` (matching Vercel canonical) + add the OAuth callback to the allow list.
  - ~15 min once Matt provides the screenshot. Could absorb into Phase 3 pre-flight or do standalone.

- [ ] **Google Cloud Console branding fields** — Matt to fill in (logo, privacy + terms URLs, authorized domains) to clean up Google consent screen.

- [ ] **`mattburto@gmail.com` smoke teacher row in prod** — still there from Phase 2.2 smoke. Soft-delete or label as "smoke" before pilot expansion.

## Open questions / blockers

- _None blocking._
- `FU-OAUTH-LANDING-FLASH` is the only known Phase-2-touching open issue; cosmetic, sign-in succeeds.
- Phase 3 is methodology-heavy — needs its own brief + audit before code.

## Key references

- Phase 2 brief (now reflects 2.1-2.5 ✅): `docs/projects/access-model-v2-phase-2-brief.md`
- Phase 2.3 sub-brief: `docs/projects/access-model-v2-phase-2-3-brief.md`
- Phase 2.5 Checkpoint A3 report: `docs/projects/access-model-v2-phase-2-checkpoint-a3.md`
- Followups (4 OPEN): `docs/projects/access-model-v2-followups.md`
- Decisions: `docs/decisions-log.md` — 15 new entries from today (Phase 2.2 + 2.3 + 2.4 + 2.5 + branding + admin Cache-Control + trigger fix)
- Lessons: `docs/lessons-learned.md` — Lesson #65 logged (old triggers + new user types)
- Changelog: `docs/changelog.md` — 2 session entries from today

## Don't forget

- **Phase 2 fully closed.** Don't re-run sub-phases. Migrations applied to prod.
- **Phase 1 trigger leak fix is also applied to prod.** No further action needed; phantom teacher rows are gone.
- **`mattburto@gmail.com` smoke teacher row is still in prod** from Phase 2.2 smoke — wasn't a leak (real OAuth provisioning), but it's a smoke artifact. Soft-delete or label before pilot expansion.
- **`FU-OAUTH-LANDING-FLASH` is cosmetic.** Sign-in succeeds. Don't block Phase 3 on it.
- **Phase 3 is the next big piece.** Don't start without a brief + pre-flight ritual. Read the master spec first; the auth-unification work touches student session validation, route handlers, and likely a migration.
- **Loominary is the umbrella, StudioLoom is the product.** `hello@loominary.org` is the contact; `studioloom.org` is the user-facing URL.
- **Sub-phase pushes go to main** when there are no migrations or migrations are forward-compatible. Migration-bearing sub-phases hold main local + push to a `phase-X-wip` backup branch until applied to prod.
