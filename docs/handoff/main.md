# Handoff — main

**Last session ended:** 2026-05-01T05:30Z (Phase 2.2 + Phase 2.3 SHIPPED + APPLIED TO PROD; saveme run; ready for Phase 2.4)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `0ec0db4` "fix(legal): contact email is hello@loominary.org, not @studioloom.org"
**Branch:** `main` — 0 ahead of `origin/main` after this session's saveme push
**Pending push:** 0 (saveme commit pushes everything)

## What just happened (this session)

Picked up from Phase 2.2 mid-flight handoff. Closed Phase 2.2 + shipped + applied Phase 2.3 end-to-end + smoke-tested in prod + saveme ritual.

- Phase 2.2 Google OAuth button shipped (`58a442d`) + smoke passed with `mattburto@gmail.com`. `/auth/callback` provisioned a new teacher row.
- OAuth consent screen branding: privacy + terms pages drafted (`4ae2f0f`, `0ec0db4`); Microsoft Azure publisher domain verified on `www.studioloom.org` via `/.well-known/microsoft-identity-association.json` (`27f43c9`); consent screen no longer says "Unverified".
- 4 follow-ups filed (`access-model-v2-followups.md`): `FU-AZURE-MPN-VERIFICATION` P3, `FU-LEGAL-LAWYER-REVIEW` P2, `FU-CUSTOM-AUTH-DOMAIN` P3, `FU-OAUTH-LANDING-FLASH` P2 (landing-page flash during OAuth — cosmetic, sign-in succeeds).
- Phase 2.3 sub-brief drafted (`access-model-v2-phase-2-3-brief.md`); 3 sign-off questions answered ("go with your recommendations" — settings UI deferred, email_password safety net, apple in CHECK now).
- Phase 2.3 SHIPPED: migration `20260501045136_allowed_auth_modes.sql` (claimed `6698670`, body `756267a`) + helper `src/lib/auth/allowed-auth-modes.ts` + 11 unit tests + login page split (server `page.tsx` + client `LoginForm.tsx`) + amber restriction banner. Schema-registry + feature-flags synced.
- **Migration applied to prod by Matt 1 May 2026.** Smoke passed: unscoped renders 3 modes; school-scoped to `[email_password]` renders only email/password + banner; class-scoped same.
- Saveme: decisions-log +10 entries; changelog +1 session entry; phase-2-brief marked 2.1/2.2/2.3 ✅ SHIPPED; master CWORK CLAUDE.md timestamp + status updated; this handoff written.

## State of working tree

- `git status --short`: clean after saveme commit.
- Tests: **2828 passed | 11 skipped** (was 2817 — +11 new Phase 2.3 tests).
- Typecheck: 0 errors (strict project config).
- Vercel: prod deployed green at `studioloom.org` after the Phase 2.3 + email-fix push.
- Migration `20260501045136_allowed_auth_modes` applied to prod Supabase 1 May 2026.
- `phase-2-3-wip` backup branch on origin (was the temporary holding pen during migration application; can be deleted after confirmation).

## Next steps — pick up here

- [ ] **Phase 2.4: Apple OAuth feature flag scaffold (~1h)**
  - `feature-flags.yaml` already has `NEXT_PUBLIC_AUTH_OAUTH_APPLE_ENABLED` from Phase 2.3 forward-compat work — verify it's appropriate or replace with the per-spec `auth.oauth_apple_enabled` admin_settings row.
  - Login page: render Apple button only when flag is on (currently no Apple button exists).
  - No actual Apple integration code — leave as TODO.
  - File a Phase 2.4 sub-brief if the work is ≥3 files.

- [ ] **Phase 2.5: Checkpoint A3 verification + smoke (~1-2h)**
  - Run the full Phase 2 checkpoint criteria from `access-model-v2-phase-2-brief.md` §7.
  - Smoke: all 4 modes (Microsoft, Google, email/password, Apple-hidden), allowlist scenarios (school-scoped + class-scoped), teacher invite flow.
  - Diagnose `FU-OAUTH-LANDING-FLASH` (likely Supabase Site URL + Redirect URLs allow list; check DevTools Network tab during sign-in to capture the redirect chain).
  - Close out Phase 2 with a checkpoint report.

- [ ] **Phase 2.2 outstanding: Google Cloud Console branding fields**
  - Matt needs to fill in: app home page, privacy URL, terms URL, authorized domains, square logo upload. Currently OAuth consent shows the Supabase URL secondary — branding fields will surface "StudioLoom" prominently.

- [ ] **Optional pre-Phase-2.5: clean up the test teacher rows**
  - `mattburto@gmail.com` (Phase 2.2 Google smoke) created a 4th Matt teacher row in prod. Soft-delete or label as "smoke" before Checkpoint A3.

## Open questions / blockers

- `FU-OAUTH-LANDING-FLASH` P2 — Supabase URL config not yet inspected. Hypothesis: Site URL is the apex (`https://studioloom.org`), redirectTo (`https://www.studioloom.org/auth/callback?next=/teacher/dashboard`) not in the Redirect URLs allow list, Supabase falls back to Site URL → 307 → www → some client-side recovery. Block on Phase 2.5 — not on Phase 2.4.
- Custom auth domain (`FU-CUSTOM-AUTH-DOMAIN`) — defer until Supabase Pro is approved + a paying school justifies $10/mo for the polish. Not blocking.
- Microsoft Partner Network verification (`FU-AZURE-MPN-VERIFICATION`) — only matters when a second school joins whose admin won't approve unverified multi-tenant apps. Not blocking for NIS pilot.
- Settings UI for editing `allowed_auth_modes` — deferred to Phase 4 by design. Pilot admins use Supabase SQL editor.

## Key references

- Phase 2 brief: `docs/projects/access-model-v2-phase-2-brief.md` (now reflects 2.1/2.2/2.3 ✅ SHIPPED with smoke notes)
- Phase 2.3 sub-brief: `docs/projects/access-model-v2-phase-2-3-brief.md`
- Followups: `docs/projects/access-model-v2-followups.md` (4 entries from this session)
- Decisions: `docs/decisions-log.md` — 10 new entries from this session (Phase 2.2 + 2.3 + branding)
- Helper: `src/lib/auth/allowed-auth-modes.ts` — `getAllowedAuthModes` (DB) + `resolveAllowedAuthModes` (pure)
- Login page: `src/app/teacher/login/page.tsx` (server) + `LoginForm.tsx` (client)
- Migration: `supabase/migrations/20260501045136_allowed_auth_modes.sql` (+ paired `.down.sql`)
- Lesson #61 reference: `docs/lessons-learned.md` (cross-table CHECK constraints — why subset-of-school enforcement is app-layer, not DB)

## Don't forget

- **Migration applied to prod.** Don't re-run it. The schema-registry already reflects both new columns.
- **Phase 2.3 ships email_password as a hard safety net.** CHECK constraint enforces `array_length >= 1`; helper falls back to `['email_password']` on any empty result. Locking out a school admin from their own login is impossible by design.
- **The Phase 2.3 helper supports `?school=<uuid>` not slug** — schools has no slug column. URL is admin-facing only at v1 (Phase 4 may add slugs).
- **`mattburto@gmail.com` test teacher row is in prod** — soft-delete or label before Checkpoint A3.
- **Microsoft consent screen is now branded** but Google's still shows Supabase URL — Matt needs to fill in the Google Cloud Console Branding fields (privacy + terms URLs already available at `/privacy` and `/terms`).
- **Apple feature flag forward-compat** — Phase 2.3 already lists `'apple'` in the CHECK constraint enum. Phase 2.4 can wire the actual button without a follow-up migration.
- **Loominary is the umbrella, StudioLoom is the product.** Contact email everywhere is `hello@loominary.org`.
