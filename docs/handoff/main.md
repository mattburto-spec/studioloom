# Handoff — main

**Last session ended:** 2026-04-30T16:00Z (mid-flight on Phase 2.2 Google OAuth — Matt is configuring Google Cloud Console; no Phase 2.2 code shipped yet)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `73c22ae` "saveme: Phase 2.1 Microsoft OAuth SHIPPED + LIVE + 2 bonus fixes"
**Branch:** `main` — 0 ahead, 0 behind (in sync with origin)

## What just happened (this session)

Continued from earlier saveme. Phase 2.1 Microsoft OAuth fully shipped + verified live + bonus fixes (Phase 0 user_type backfill, dashboard hero null-unit fix). Started Phase 2.2 (Google OAuth) — Matt mid-flight on Google Cloud Console + Supabase Google provider config. No Phase 2.2 code committed yet (waiting on Matt to complete the dashboard setup).

- Phase 2.1 Microsoft OAuth shipped (`539a173`) — Sign-in button, callback OAuth handler, first-login provisioning, Azure multi-tenant config.
- Phase 0 user_type backfill (`eb866a7`) — SQL UPDATE for all teachers + idempotent callback patch. `teachers_missing_user_type: 0` post-update.
- Dashboard hero fix (`3cbd273`, FU-DASHBOARD-HERO-NULL-UNIT-TITLE ✅) — fallback to `cls.units[0]` + empty-state UI when no unit assigned.
- FU filed as RESOLVED (`b000fcc`).
- Saveme (`73c22ae`) — final state captured, scanners synced, decisions logged.
- Phase 2.2 brief sub-phase order: Microsoft (DONE 2.1) → Google (THIS NEXT) → allowlist schema/UI → Apple feature flag → Checkpoint A3 + smoke. Per `docs/projects/access-model-v2-phase-2-brief.md`.

## State of working tree

- `git status --short`: clean.
- Tests: **2817 passed | 11 skipped** (no regression today).
- Typecheck: 0 errors.
- Pending push: 0.
- Vercel: prod deployed green at `studioloom.org`.
- Microsoft OAuth provider live in Supabase + Azure AD multi-tenant app registered (Client ID `27147948-0e96-4235-9dbd-18114a5febc6`).
- Google OAuth provider: **not yet configured** in Supabase. Google Cloud Console: Matt mid-flight (was on the OAuth consent screen step, may have made progress before pausing).

## Next steps — pick up here

- [ ] **Phase 2.2 Step 1: Matt finishes Google Cloud Console setup**
  - OAuth consent screen: External, app name `StudioLoom`, support email, contact email, audience External, add Matt's email as Test User.
  - Credentials → Create OAuth Client ID → Web application → redirect URI `https://cxxbfmnbwihuskaaltlk.supabase.co/auth/v1/callback`.
  - Copy Client ID + Client Secret.

- [ ] **Phase 2.2 Step 2: Matt configures Supabase Google provider**
  - Authentication → Providers → Google → enable, paste Client ID + Secret, save.

- [ ] **Phase 2.2 Step 3: Code (Claude does, ~5 min)**
  - Add "Sign in with Google" button to `src/app/teacher/login/page.tsx` mirroring the Microsoft button.
  - Calls `supabase.auth.signInWithOAuth({ provider: "google" })` with `redirectTo: ${origin}/auth/callback?next=/teacher/dashboard`.
  - The `/auth/callback` route already supports OAuth (provider-agnostic) — no changes needed there.

- [ ] **Phase 2.2 Step 4: Smoke**
  - Sign in with any Google account in incognito → lands on `/teacher/dashboard` (existing teacher) or `/teacher/welcome` (new).
  - Verify `auth.users.raw_app_meta_data->>'provider' = 'google'` (Supabase tracks the provider per identity).

- [ ] **Phase 2.3** — `schools.allowed_auth_modes` + `classes.allowed_auth_modes` schema + UI (~5-6h, post-2.2)

- [ ] **Phase 2.4** — Apple OAuth feature flag scaffold (~1h, no real integration)

- [ ] **Phase 2.5** — Checkpoint A3 + smoke

## Open questions / blockers

- _None blocking._
- Google Cloud Console UI has moved around in 2024 — if the consent screen looks different from the standard guide, paste a screenshot and I diagnose.
- Same-email linking should reuse Matt's existing teachers row when he signs in via Google (he previously linked email-password + Microsoft to the same auth.users row; Google would be a third identity on the same account). Verify this in smoke.
- Phase 0 user_type backfill ran as ad-hoc SQL, not a migration — worth filing FU to make it a formal migration so other environments (preview branches, future restores) get the same fix automatically. Logged here so it doesn't get forgotten.

## Key references

- Phase 2 brief: `docs/projects/access-model-v2-phase-2-brief.md` (8 locked decisions in §12; sub-phase order: Microsoft → Google → allowlist → Apple → smoke)
- Lesson #64: `docs/lessons-learned.md` → bottom (cross-table RLS recursion → SECURITY DEFINER)
- Decisions: `docs/decisions-log.md` — 4 new entries from today's PM (Microsoft multi-tenant, callback provisioning location, idempotent user_type, hero empty state)
- Auth callback (already OAuth-aware): `src/app/auth/callback/route.ts`
- Teacher login page (where Google button needs to land): `src/app/teacher/login/page.tsx`
- Microsoft button reference (for mirroring): same file, look for `signInWithOAuth({ provider: "azure" })`

## Don't forget

- **Microsoft OAuth is multi-tenant.** Phase 2.3's `allowed_auth_modes` allowlist is what gates which auth modes specific schools accept.
- **Phase 0 user_type backfill ran ad-hoc** — file as a follow-up migration before next session ends.
- **Apple OAuth feature flag** (`auth.oauth_apple_enabled`) — Phase 2.4 will add it. Not done yet.
- **Google OAuth consent screen "Testing" mode** — until Google verifies the app, only Test Users can sign in. Add Matt + any pilot teachers as Test Users on the consent screen. Verification (Trust & Safety review) only matters when approaching ~100+ users from non-Workspace domains.
- **NIS Google Workspace teachers** should bypass the "unverified app" warning if Workspace admin pre-approves the app — but for the pilot, Test Users list is the simpler path.
- The test student `newtest` (FU-UI-INSERT-REFACTOR smoke) is still in prod. Harmless.
- 9 Design has no class_units assigned — hero shows the new "No unit assigned." empty state for it. To verify the unit-rendering path post-Phase-2.1, assign a unit to 9 Design via the teacher UI.
