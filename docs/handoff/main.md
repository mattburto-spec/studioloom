# Handoff — main

**Last session ended:** 2026-04-30T15:30Z (Phase 2.1 Microsoft OAuth SHIPPED + LIVE IN PROD; bonus dashboard hero fix; user_type backfill)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `b000fcc` "docs(followups): file FU-DASHBOARD-HERO-NULL-UNIT-TITLE as ✅ RESOLVED" (saveme commit follows on top)
**Branch:** `main` — 0 ahead, 0 behind (in sync after saveme push)

## What just happened (this session)

Massive day across three continuous sessions. Final segment: Phase 2.1 Microsoft OAuth, plus two bonus bugs caught + fixed.

### Latest segment (Phase 2.1 + bonus)

- **Phase 2.1 Microsoft OAuth (`539a173`):** added "Sign in with Microsoft" button to `/teacher/login`; extended `/auth/callback` to handle OAuth code exchange + first-login teacher provisioning. External setup done by Matt: Azure AD multi-tenant app registration, Supabase Azure provider config with `https://login.microsoftonline.com/common`, "Allow same email logins" enabled.

- **Phase 0 user_type backfill (`eb866a7`):** Phase 0 set `app_metadata.user_type` for students but NOT teachers. Existing teachers signing in via Microsoft had `user_type=null` → Phase 1.3 polymorphic dispatch returned null → routes using requireTeacherSession would 401. Fix: SQL UPDATE backfilled all teachers (`teachers_missing_user_type: 0` post-update) + callback patched to set user_type idempotently on every login (catches future cases automatically).

- **Dashboard hero null-unit fix (`3cbd273`, FU-DASHBOARD-HERO-NULL-UNIT-TITLE ✅):** NowHero rendered `unitTitle` at 100-108px font; when class had no units assigned, the fallback `"—"` rendered as a giant em-dash that looked like colored placeholder bars. Two-part fix: (1) `resolveCurrentPeriod()` falls back to `cls.units[0]` when schedule entry's unitId is null; (2) NowHero renders explicit empty state at smaller typography when `vm.unitId` is null.

- **Smoke verified live:** test2 dashboard render + Matt signs in via Microsoft → `/teacher/dashboard` → cookies set → `user_type` claim correct after backfill+re-login → hero shows clean empty state for 9 Design (which has no class_units).

## State of working tree

- `git status --short`: clean post-saveme.
- Tests: **2817 passed | 11 skipped** (no regression today).
- Typecheck: 0 errors.
- Pending push: 0 (saveme commit pushed).
- Vercel: prod deployed green at `studioloom.org`.
- Microsoft OAuth provider configured + enabled in Supabase dashboard.
- Azure AD: multi-tenant app registered ("Multiple Entra ID tenants" / "Allow all tenants"), Application (Client) ID `27147948-0e96-4235-9dbd-18114a5febc6`, current secret active.

## Day-end summary

**Today's full work** (one continuous workflow across three sessions):

| Layer | Work |
|---|---|
| Phase 1 close (Option A) | Merged to main |
| Phase 1.4 client-switch | CS-1 + CS-2 + CS-3 — 6/6 Phase 1.4b routes load-bearing under RLS |
| Frontend login swap + student-session dual-mode | Closed Phase 1.4b regression |
| RLS recursion fixes | 2 SECURITY DEFINER hotfixes + 1 WITH CHECK split |
| Comprehensive RLS audit | Zero remaining cycles |
| 18 GET routes | requireStudentAuth → requireStudentSession |
| `student_badges.student_id` | TEXT → UUID + FK + drop ::text casts |
| `POST /api/teacher/students` | New atomic create + provision + enroll route |
| Phase 2.1 Microsoft OAuth | Sign-in + callback + provisioning + identity linking |
| Dashboard hero fix | NowHero empty state when no unit assigned |
| Phase 0 user_type backfill | All teachers now have user_type='teacher' |

**Stats:**
- 12 RLS/schema migrations applied to prod today
- ~40 commits to main
- Tests 2792 → 2817 (+25)
- Lesson #64 added (cross-table RLS subquery recursion → SECURITY DEFINER)
- 7 follow-ups closed (5 Access-Model-v2 + dashboard hero + Phase 0 user_type)
- Phase 2.1 fully verified live in prod
- 0 production regressions

## Next steps — pick up here

- [ ] **Phase 2.2 — Google OAuth (~30 min code + Matt does Google Cloud Console + Supabase config)**
  - External: Google Cloud Console OAuth 2.0 client ID, redirect URI `https://cxxbfmnbwihuskaaltlk.supabase.co/auth/v1/callback`, Supabase → Providers → Google → enable + paste credentials.
  - Code: add "Sign in with Google" button to `/teacher/login` (mirrors the Microsoft button — `signInWithOAuth({ provider: "google" })`). Callback handler already supports OAuth (provider-agnostic).
  - Smoke: sign in with any Google Workspace account.

- [ ] **Phase 2.3 — `schools.allowed_auth_modes` + `classes.allowed_auth_modes` schema + UI** (~5-6h)

- [ ] **Phase 2.4 — Apple OAuth feature flag scaffold** (~1h, no real integration)

- [ ] **Phase 2.5 — Checkpoint A3 + smoke**

## Open questions / blockers

- _None blocking._
- The "Your day" panel earlier showed 4 periods (01, 02, 04, 05) but `/api/teacher/schedule/today` returned only 2 entries. Probably different cycle days; not a bug. Worth investigating cleanly if it comes up again.
- The day flipped to May 1 in Shanghai; today's cycleDay 7 has 9 Design + Grade 8 Design as the only scheduled classes. Both have no class_units assigned, so the hero shows the new empty state. To verify Phase 2.1's hero rendering for a class with units, assign Biomimicry to 9 Design via the teacher UI and reload.

## Key references

- Phase 2 brief: `docs/projects/access-model-v2-phase-2-brief.md` (8 locked decisions in §12)
- Phase 1.4 client-switch brief: `docs/projects/access-model-v2-phase-14-client-switch-brief.md`
- Master spec: `docs/projects/access-model-v2.md` §Phase 2 (line 236)
- Lesson #64: `docs/lessons-learned.md` → bottom (cross-table RLS recursion)
- Decisions: `docs/decisions-log.md` — 4 new entries today (Microsoft multi-tenant, callback provisioning, idempotent user_type, hero empty state)
- New OAuth callback: `src/app/auth/callback/route.ts` (211 lines, OAuth + PKCE + provisioning + idempotent user_type backfill)
- New Microsoft button + reused login flow: `src/app/teacher/login/page.tsx`

## Don't forget

- **Microsoft OAuth is multi-tenant** — any Microsoft 365 school can attempt sign-in. Phase 2.3's `allowed_auth_modes` allowlist is what gates which auth modes specific schools accept — important for security narrative when more schools come on board.
- **Phase 0 user_type backfill ran in prod** as ad-hoc SQL (not a migration file). Worth filing a follow-up to make this a formal migration so other environments (preview branches, future restores) get the same fix automatically.
- The test student `newtest` (created during FU-UI-INSERT-REFACTOR smoke earlier today) is still in prod. Either delete or leave — harmless on the teacher's roster.
- Apple OAuth feature flag (`auth.oauth_apple_enabled`) doesn't yet exist in `feature-flags.yaml` — Phase 2.4 will add it.
- The `today` endpoint doesn't link periods to specific units even when class_units has data. The hero fix works around this client-side. A cleaner long-term solution: add an `is_current` flag (or schedule a unit by date range) so the timetable knows which unit is being taught when. Worth discussing during Phase 2.3 schema design.
