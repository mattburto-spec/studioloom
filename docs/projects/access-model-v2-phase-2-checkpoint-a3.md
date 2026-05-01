# Access Model v2 Phase 2 — Checkpoint A3 Report

**Status:** ✅ PASS — all 8 functional smoke criteria green. 1 cosmetic follow-up (`FU-OAUTH-LANDING-FLASH`) explicitly deferred by Matt; sign-in succeeds despite the flash so it's non-blocking.

**Bonus:** during smoke, an unrelated pre-existing Phase 1 bug surfaced: the `handle_new_teacher` trigger from `001_initial_schema.sql` was creating phantom teacher rows for every student auth.users insert. Fixed in migration `20260501103415_fix_handle_new_teacher_skip_students.sql` (applied to prod 1 May 2026). 7 leaked rows cleaned up. See §8.

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
| 3 | Sign in via email/password (already shipped) → same | ✅ | Verified 1 May 2026 prod. Matt logged out + back in via email/password during checkpoint smoke; lands on /admin/teachers cleanly post-login. |
| 4 | Apple button is hidden (feature flag false) | ✅ | Phase 2.4 default state. `NEXT_PUBLIC_AUTH_OAUTH_APPLE_ENABLED` defaults to `false`; `globallyEnabledModes()` excludes apple; no school's `allowed_auth_modes` contains 'apple'. Three layers off — button never renders. |
| 5 | Class scope: `allowed_auth_modes = ['email_password']` → only email/password renders | ✅ | Phase 2.3 prod smoke 1 May 2026 with a test class. Buttons hidden + amber restriction banner visible. |
| 6 | School scope: `allowed_auth_modes = ['email_password']` → all classes inherit; only email/password renders | ✅ | Phase 2.3 prod smoke 1 May 2026 — tested via `/teacher/login?school=<nis-uuid>` after `UPDATE schools SET allowed_auth_modes = ARRAY['email_password']`. Reset post-smoke. |
| 7 | Existing email-password teachers can still sign in | ✅ | Same evidence as criterion 3 — Matt's existing legacy account signed in successfully. |
| 8 | Teacher invite flow (existing) still works | ✅ | Verified 1 May 2026. Matt submitted the "Request access" form (Shiqi Burton, Test). Row visible in /admin/teachers as a pending access request. End-to-end form → API → DB → admin display all confirmed. |
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

✅ **Phase 2 PASS.** All 8 functional criteria green. Sole open follow-up is `FU-OAUTH-LANDING-FLASH` (P2, cosmetic — Matt deferred). Phase 3 (Auth Unification — every student → `auth.users`) unlocks.

---

## 8. Phase 1 spillover — handle_new_teacher trigger fix

During checkpoint smoke, /admin/teachers showed ~7 phantom rows with synthetic emails like `student-<uuid>@students.studioloom.local`. Investigation traced these to `handle_new_teacher` trigger from `001_initial_schema.sql` — predates Phase 1 access-v2, blindly created a teachers row on every auth.users INSERT. Phase 1.1d (29 Apr 2026) started provisioning auth.users for students; old trigger fired and leaked phantom teacher rows.

**Security audit:** clean. `buildTeacherSession` only routes when `user_type='teacher'`; `requireAdmin` checks `is_admin=true` (false on leaked rows). Leak was purely cosmetic.

**Fix:** migration `20260501103415_fix_handle_new_teacher_skip_students.sql` (commit `2a34191`).
- Updated trigger to skip when `raw_app_meta_data->>'user_type' = 'student'`.
- Backfill DELETE with safety assertion (refused to delete if any leaked row had FK references in classes/units/students — none did).
- Applied to prod 1 May 2026. Notice log confirmed 7 deleted, 0 references.
- Down migration restores the original trigger (cannot un-delete the leaked rows; they had zero data so this is a no-op semantically).

**Decision logged.** Filed as a unscheduled Phase 1 cleanup spillover, not a Phase 2 deliverable. Should arguably have been caught in Phase 1.1d's pre-flight audit; the 18-month-old trigger wasn't on anyone's radar.
