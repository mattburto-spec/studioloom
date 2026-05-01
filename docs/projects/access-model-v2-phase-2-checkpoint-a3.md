# Access Model v2 Phase 2 — Checkpoint A3 Report

**Status:** 🟡 PARTIAL PASS — code-side complete + 4 of 8 smoke criteria already verified during 2.2 + 2.3 sub-phase work. 4 remaining + 1 follow-up diagnosis (FU-OAUTH-LANDING-FLASH) need a clean Matt-driven smoke pass.

**Date drafted:** 1 May 2026
**Branch:** `main` (sub-phase commits all merged + applied to prod)
**Tests:** 2830 passed | 11 skipped (was 2817 pre-Phase-2; +13 from 2.3 + 2.4)
**tsc strict:** 0 errors
**Pending push:** 0

---

## 1. Success criteria — pass/fail matrix

Per `access-model-v2-phase-2-brief.md` §7 + §3 sub-phase 2.5 smoke checklist (lines 113-122):

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Sign in via Microsoft → lands on /teacher/welcome (new) or /teacher/dashboard (returning) | ✅ | Phase 2.1 prod smoke 30 Apr 2026 with `mattburton@nanjing-school.com`. Returning teacher → /teacher/dashboard. |
| 2 | Sign in via Google → same | ✅ | Phase 2.2 prod smoke 1 May 2026 with `mattburto@gmail.com`. New teacher row provisioned, landed on /teacher/welcome. |
| 3 | Sign in via email/password (already shipped) → same | ⏸️ | Pre-Phase-2 functionality, not re-verified in this checkpoint. Phase 2.3 login-page split preserved the email/password code path unchanged. **Recommended re-verification — see §2.** |
| 4 | Apple button is hidden (feature flag false) | ✅ | Phase 2.4 default state. `NEXT_PUBLIC_AUTH_OAUTH_APPLE_ENABLED` defaults to `false`; `globallyEnabledModes()` excludes apple; no school's `allowed_auth_modes` contains 'apple'. Three layers off — button never renders. |
| 5 | Class scope: `allowed_auth_modes = ['email_password']` → only email/password renders | ✅ | Phase 2.3 prod smoke 1 May 2026 with a test class. Buttons hidden + amber restriction banner visible. |
| 6 | School scope: `allowed_auth_modes = ['email_password']` → all classes inherit; only email/password renders | ✅ | Phase 2.3 prod smoke 1 May 2026 — tested via `/teacher/login?school=<nis-uuid>` after `UPDATE schools SET allowed_auth_modes = ARRAY['email_password']`. Reset post-smoke. |
| 7 | Existing email-password teachers can still sign in | ⏸️ | Code path unchanged from pre-Phase-2 (the form sits inside `LoginForm.tsx` after the split, identical handler). **Recommended re-verification — see §2.** |
| 8 | Teacher invite flow (existing) still works | ⏸️ | Code path unchanged from pre-Phase-2. The /teacher/login "Request access" modal + /api/teacher/request-access route are untouched. **Recommended re-verification — see §2.** |
| 9 | All sub-phase tests passing | ✅ | `npm test` 2830/11. tsc strict 0 errors. CI green on `6dd4bb4`. |
| 10 | Migration applied to prod | ✅ | `20260501045136_allowed_auth_modes.sql` applied 1 May 2026. Both columns present in prod. |
| 11 | Decisions logged | ✅ | 10 entries in `docs/decisions-log.md` from Phase 2.2 + 2.3 work. |
| 12 | Follow-ups filed | ✅ | 4 entries in `docs/projects/access-model-v2-followups.md`. |

---

## 2. Smoke evidence still needed (criteria 3, 7, 8)

These are existing code paths that Phase 2 didn't change semantically, but the login page was split (server `page.tsx` + client `LoginForm.tsx`) so a quick re-verify is cheap insurance.

**Matt to do — ~5 min in incognito, prod:**

1. **Email/password sign-in** (criterion 3 + 7)
   - Open `https://www.studioloom.org/teacher/login` in incognito.
   - Fill in your email/password (existing legacy account).
   - Click "Log In".
   - Expected: lands on `/teacher/dashboard`.

2. **Teacher invite flow** (criterion 8)
   - Same incognito tab, click "Request access" link in the modal.
   - Fill in dummy fields (use a non-real email like `smoke-test+a3@example.com`).
   - Click "Send request".
   - Expected: success toast, modal closes. Optionally check `teacher_access_requests` table for the new row.

If both work, mark this checkpoint ✅ PASS in this report and move on.

---

## 3. FU-OAUTH-LANDING-FLASH — diagnostic plan

Filed Phase 2.2 smoke. 1-2s landing page (`/`) flashes between Microsoft/Google consent and `/teacher/dashboard`. Sign-in succeeds — cosmetic.

**Hypothesis order (most → least likely):**

1. **Supabase Site URL falls back when redirectTo isn't in the allow list.** Site URL might be the apex `https://studioloom.org`, redirectTo from the OAuth call is `https://www.studioloom.org/auth/callback?next=/teacher/dashboard` (origin-derived). If the allow list misses the `www` form, Supabase ignores redirectTo and bounces to Site URL → renders the landing page → some client-side recovery navigates onward.

2. **Apex → www 307 redirect adds latency** in the callback chain. Less likely because path preservation is fine and a 307 doesn't render content.

3. **Cookie not propagating to /teacher/dashboard middleware** on the very first request after the redirect. Would explain a flash of `/teacher/login`, not `/`.

**Matt to do — ~3 min:**

- Open `Supabase Dashboard → Authentication → URL Configuration`.
- Note `Site URL` value (likely `https://studioloom.org` or `https://www.studioloom.org`).
- Note `Redirect URLs` allow list. Confirm both forms are present:
  ```
  https://www.studioloom.org/auth/callback
  https://www.studioloom.org/auth/callback?next=/teacher/dashboard
  ```
  (or a wildcard like `https://www.studioloom.org/auth/callback*`)
- Take a screenshot + paste in the next session.

**Likely fix:** set Site URL to `https://www.studioloom.org` (matching Vercel canonical) + add the `?next=/teacher/dashboard` form to the allow list. Then re-smoke.

If this makes the flash go away, close `FU-OAUTH-LANDING-FLASH`.

---

## 4. Phase 2 sub-phase summary

| Sub-phase | Status | Date | Commits | Test delta |
|-----------|--------|------|---------|------------|
| 2.1 Microsoft OAuth | ✅ SHIPPED | 30 Apr 2026 | `539a173`, `eb866a7`, `3cbd273`, `b000fcc`, `73c22ae` | (rolled into Phase 1 baseline) |
| 2.2 Google OAuth + branding | ✅ SHIPPED | 1 May 2026 | `58a442d`, `4ae2f0f`, `27f43c9`, `e251b80`, `0ec0db4` | unchanged (no new tests) |
| 2.3 allowed_auth_modes | ✅ SHIPPED + APPLIED | 1 May 2026 | `6698670`, `756267a` | +11 tests |
| 2.4 Apple feature flag scaffold | ✅ SHIPPED | 1 May 2026 | `6dd4bb4` | +2 tests |
| 2.5 Checkpoint A3 | 🟡 PARTIAL | 1 May 2026 | this doc | — |

**Total Phase 2 surface (if you exclude the rolled-in Phase 1 work):**
- 1 migration (`20260501045136_allowed_auth_modes.sql`) + paired down.
- 1 new helper (`src/lib/auth/allowed-auth-modes.ts`) + 13 unit tests.
- 1 new server component + 1 new client component (`teacher/login` split).
- 3 new legal pages + shared layout (`/(legal)/{layout,privacy,terms}.tsx`).
- 1 new well-known endpoint (`/.well-known/microsoft-identity-association.json`).
- 1 new OAuth handler in LoginForm (`handleAppleSignIn`) — gated, defaults off.
- 4 follow-ups filed; 10 decisions logged; 1 changelog entry.

---

## 5. What unlocks after sign-off

- Phase 3 — Auth Unification (every student → `auth.users`). Branch `access-model-v2` rejoins main; the auth surface is now provider-aware end-to-end.
- China-locked schools can be onboarded to the pilot (real revenue path opens — set their `schools.allowed_auth_modes = ARRAY['email_password']` and they're good).
- Multi-school pilot gates: solid until tenant #2 shows up. Then `FU-AZURE-MPN-VERIFICATION` activates.

---

## 6. Open follow-ups (carrying into Phase 3)

| ID | Priority | Status | Target |
|----|----------|--------|--------|
| FU-OAUTH-LANDING-FLASH | P2 | OPEN — diagnostic plan above | Diagnose this session, fix in 2.5 close-out |
| FU-AZURE-MPN-VERIFICATION | P3 | OPEN | Second-school pilot |
| FU-LEGAL-LAWYER-REVIEW | P2 | OPEN | Pre-pilot expansion |
| FU-CUSTOM-AUTH-DOMAIN | P3 | OPEN | When Supabase Pro lands |

All four are in `docs/projects/access-model-v2-followups.md`.

---

## 7. Sign-off

Phase 2 is functionally complete. The remaining ⏸️ items in §1 are existing pre-Phase-2 code paths that the Phase 2.3 split preserved unchanged — re-verification is cautious paranoia rather than load-bearing. FU-OAUTH-LANDING-FLASH is cosmetic only; sign-in succeeds.

**Recommendation:** Matt runs §2 (~5 min) + §3 (~3 min) → if all green, mark this checkpoint ✅ PASS + move to Phase 3.
