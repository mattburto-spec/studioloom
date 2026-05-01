# Phase 2 — OAuth + Email/Password: Build Brief

**Phase:** Access Model v2 Phase 2
**Master spec:** [`docs/projects/access-model-v2.md`](access-model-v2.md) §Phase 2 (line 236)
**Estimate:** **~1.5-2 days** (down from spec's 3 because email/password is already shipped)
**Branch:** `access-model-v2-phase-2` (TBD when work starts)

---

## 1. Goal

Make teachers self-register via Google/Microsoft OAuth + email-password (already shipped), and let schools/classes restrict which auth modes are offered. **This unblocks pilot recruitment** — colleagues can sign up directly without Matt admin-creating their accounts.

After Checkpoint A3, the auth model is feature-complete for the pilot. Phase 3 (Class Roles) and Phase 4 (School Registration UI) build on this.

**Out of scope** (per master spec §1 and Phase 2 §):
- Apple OAuth — deferred to a future phase, gated behind `auth.oauth_apple_enabled` feature flag (default `false`). Spec note: skip in v1 because $99/yr Apple Developer account isn't worth the spend pre-customer.
- Student email-password login (students stay on classcode-login per Phase 1.2).
- LMS SSO (Clever, Classlink, Google Classroom) — different layer; later phase.

---

## 2. Surface audit (pre-flight findings)

**Already shipped — REUSE:**
- ✅ `/auth/callback/route.ts` — PKCE code exchange handler. Currently used for password-reset (`type=recovery`) + teacher invites (`type=invite`). Will need extending to handle OAuth provider callbacks.
- ✅ `/teacher/login/page.tsx` — email/password sign-in via `supabase.auth.signInWithPassword()`. Will add OAuth buttons.
- ✅ `/teacher/welcome` flow — first-class onboarding for new teachers.
- ✅ `/teacher/set-password` — password reset / invite completion.
- ✅ `(auth)/login/page.tsx` — student classcode login (untouched).
- ✅ Phase 1.3's `getActorSession()` — polymorphic auth helper. OAuth users dispatch on `app_metadata.user_type` (set during signup).

**Schema state:**
- ✅ `auth.users` exists (Supabase Auth)
- ✅ `teachers` table 1:1 with `auth.users.id`
- ✅ `schools.subscription_tier` (mig 20260428125547) — already there for monetisation
- ❌ `schools.allowed_auth_modes` — **needs adding** (per-school auth allowlist)
- ❌ `classes.allowed_auth_modes` — **needs adding** (per-class override)

**External setup required (Matt does these in dashboards, not code):**
- Google Cloud Console → OAuth 2.0 client ID for Supabase
- Microsoft Azure AD → app registration with redirect URL
- Supabase dashboard → enable Google + Microsoft providers, paste client IDs/secrets, configure redirect URLs

These are one-time setup tasks. The brief assumes Matt does them as part of sub-phase 2.1's pre-flight; the code is non-functional until those are configured.

---

## 3. Sub-phases

### Phase 2.1 — Microsoft (Azure AD) OAuth (~3-4 hours) ✅ SHIPPED 30 Apr 2026

**Order rationale:** NIS uses Microsoft 365. Doing Microsoft first means Matt dogfoods his own login flow on day one — every subsequent sub-phase can be smoked against his real account. Google second.

**External (Matt, in dashboards):**
1. Azure AD → app registration. Redirect URI: `https://cxxbfmnbwihuskaaltlk.supabase.co/auth/v1/callback`. Single-tenant (NIS's Azure tenant) for tighter scope, or multi-tenant if planning to onboard other Microsoft schools.
2. Supabase dashboard → Authentication → Providers → Azure → enable, paste tenant + client ID + secret.

**Code:**
1. Add "Sign in with Microsoft" button to `/teacher/login` (calls `supabase.auth.signInWithOAuth({ provider: "azure" })`).
2. Extend `/auth/callback/route.ts` to handle OAuth code exchange (already does PKCE — verify it works for OAuth too) and redirect to `/teacher/welcome` on first-time login (no teacher row yet) or `/teacher/dashboard` otherwise.
3. **First-login teacher provisioning:** when an OAuth user lands at the callback and has no `teachers` row, create one + set `app_metadata.user_type = 'teacher'` via admin client. Mirrors what Phase 1.2's classcode-login does for students. Lives in callback route (NOT a trigger — trigger can't set app_metadata).
4. Tests: callback route exchange + provisioning logic.

**Stop trigger:** Matt signs in to studioloom.org with his NIS Microsoft account end-to-end → lands on /teacher/dashboard (returning, since he already has a teacher row) without any user-visible errors.

### Phase 2.2 — Google OAuth (~2 hours) ✅ SHIPPED 1 May 2026

**Smoke result:** signed in via Google with `mattburto@gmail.com` (added as Test User). New teacher row provisioned through `/auth/callback`. One UX glitch noted: 1-2s landing-page flash mid-redirect chain — filed as `FU-OAUTH-LANDING-FLASH` (P2, target Phase 2.5).

**Branding follow-ups completed:** privacy + terms pages live at `/privacy` and `/terms`; Microsoft Azure publisher domain verified on `www.studioloom.org`; Microsoft consent screen no longer shows "Unverified" label.

**Branding follow-ups outstanding (deferred):** Google Cloud Console branding fields (logo, privacy + terms URLs, authorized domain) need to be filled in to remove the Supabase URL from the Google consent screen — Matt to do; Microsoft Partner Network publisher verification (`FU-AZURE-MPN-VERIFICATION` P3, gated on second-school pilot).

Same shape as 2.1, different provider. Smaller because the callback + provisioning code is already written for Microsoft.

**External (Matt):**
1. Google Cloud Console → Create OAuth 2.0 client ID. Same redirect URI pattern.
2. Supabase dashboard → enable Google provider, paste client ID + secret.

**Code:**
1. Add "Sign in with Google" button to `/teacher/login`.
2. Verify the OAuth callback handler works for both providers (no provider-specific branching expected).
3. Tests: provider-tagged callback exchange.

### Phase 2.3 — Auth-mode allowlist schema + UI (~5-6 hours) ✅ SHIPPED 1 May 2026

**Migration applied to prod Supabase 1 May 2026** — `20260501045136_allowed_auth_modes.sql`.

**Final scope** (per `access-model-v2-phase-2-3-brief.md`):
- Schema: `schools.allowed_auth_modes TEXT[] NOT NULL DEFAULT [email_password,google,microsoft]` + `classes.allowed_auth_modes TEXT[] NULL` (NULL inherits). CHECK includes `'apple'` for Phase 2.4 forward-compat. `array_length >= 1` enforced.
- Helper: `src/lib/auth/allowed-auth-modes.ts` exports `getAllowedAuthModes` (DB) + `resolveAllowedAuthModes` (pure). 11 unit tests covering 4 scope cases + safety-net + apple.
- Login page: split into server `page.tsx` (reads `searchParams`) + client `LoginForm.tsx`. Buttons render conditionally per resolved modes. Amber restriction banner when scope is supplied AND OAuth is unavailable.
- Settings UI deferred to Phase 4 (school settings hub) — admin edits via Supabase SQL editor for v1.
- Tests: 2817 → 2828 (+11). tsc strict 0 errors.
- Smoke (1 May 2026): unscoped login renders all 3 modes; school-scoped to `[email_password]` + class-scoped both verified end-to-end on prod.

**Commits:** `756267a` (Phase 2.3 implementation), `0ec0db4` (legal email fix that landed alongside).

**Migration:**
- `schools.allowed_auth_modes TEXT[] NOT NULL DEFAULT ARRAY['email_password', 'google', 'microsoft']` — set of auth modes the school accepts. China-locked schools can be set to `['email_password']` only.
- `classes.allowed_auth_modes TEXT[]` — nullable; when null, inherits from school. When set, restricts to a subset.

**Login page logic:**
- Login page reads requested `?school=<slug>` or `?class=<code>` (if present) to scope which buttons render.
- Without a scope param, show all globally-allowed modes (server-side feature flag).

**Settings UI:**
- `/school/[id]/settings` page (gated by Phase 4 — for now, edit via Supabase or a simple admin panel).
- `/teacher/classes/[classId]/settings` page → add allowed-modes checklist (defer if too much UI; can be migration-only for v1).

**Tests:**
- Migration shape tests.
- Server-side check that login page filters buttons correctly when school context is provided.

### Phase 2.4 — Apple OAuth scaffold (deferred, feature-flagged) (~1 hour)

Per master spec resolved decisions: skip Apple in v1. Add the feature flag now so Phase 6+ can enable.

**Code:**
1. `feature-flags.yaml` add `auth.oauth_apple_enabled` (default `false`).
2. Login page checks the flag before rendering Apple button.
3. No actual Apple integration code — left as TODO.

### Phase 2.5 — Checkpoint A3 verification (~1-2 hours)

Per master spec §Phase 2 line 243:

> all 4 providers work; China-locked class cannot offer OAuth/email options in UI; teacher invite flow exercises every path

Smoke checklist:
- [ ] Sign in via Google → lands on /teacher/welcome (new teacher) or /teacher/dashboard (returning).
- [ ] Sign in via Microsoft → same.
- [ ] Sign in via email/password (already shipped) → same.
- [ ] Apple button is hidden (feature flag false).
- [ ] Set a class's `allowed_auth_modes = ['email_password']`. Login page scoped to that class only renders the email/password form.
- [ ] Set a school's `allowed_auth_modes = ['email_password']`. All classes inherit; login page only shows email/password.
- [ ] Existing email-password teachers can still sign in.
- [ ] Teacher invite flow (existing) still works.

---

## 4. Don't-stop-for list

- The Apple OAuth integration itself (deferred — only the feature flag ships).
- LMS SSO (Clever, Classlink, Google Classroom) — different track.
- Forgot-password UI polish (already exists).
- Per-school admin UI for editing `allowed_auth_modes` (Phase 4 builds the full settings page).
- Migrating existing email-password teachers to OAuth.

---

## 5. Stop triggers

- OAuth provider config in Supabase dashboard fails or has missing URLs.
- First-login teacher provisioning has unexpected race conditions (e.g., two callbacks for same user fire concurrently).
- `app_metadata.user_type` claim doesn't propagate correctly for OAuth users (would break Phase 1.3's polymorphic dispatch).
- Tests fail in a way that suggests the existing email-password flow is regressing.

---

## 6. Pre-flight ritual checklist (before code)

- [x] Read master spec §Phase 2 — done in this session
- [x] Audit existing auth surfaces (callback, login, welcome) — done
- [x] Re-read Lessons #54 (registry drift), #62 (pg_catalog FK), #64 (RLS recursion patterns)
- [ ] Run `npm test` baseline — should be 2817 passing
- [ ] Run `npx tsc --noEmit --project tsconfig.check.json` — should be 0 errors
- [ ] Verify branch state: `git status --short` clean, on `main`, in sync with origin
- [ ] **External:** Matt configures Google + Microsoft OAuth in their respective consoles + Supabase dashboard before Phase 2.1 ships

---

## 7. Checkpoint A3 — gate criteria

(Phase 2.5 covers the actual verification. This section duplicates for the close-out summary.)

### Code
- [ ] `/teacher/login` shows OAuth buttons (Google, Microsoft) + email/password form, gated by `allowed_auth_modes` if school/class scope is in URL.
- [ ] `/auth/callback` route handles OAuth code exchange + first-login teacher provisioning.
- [ ] Apple OAuth gated behind `auth.oauth_apple_enabled` (default false).

### Schema
- [ ] `schools.allowed_auth_modes` migration applied to prod.
- [ ] `classes.allowed_auth_modes` migration applied to prod.

### Tests
- [ ] Migration shape tests.
- [ ] Callback route tests for OAuth provisioning path.
- [ ] All existing tests still pass (2817 baseline).
- [ ] Typecheck 0 errors.

### Smoke (prod or preview)
- [ ] Google sign-in → `auth.users` row created with `app_metadata.user_type = 'teacher'`. New teacher row INSERTed. Lands on /teacher/welcome.
- [ ] Microsoft sign-in → same.
- [ ] Email/password sign-in (existing) → no regression.
- [ ] Existing teacher (Matt) can still sign in via email/password.
- [ ] China-restricted school's login page hides OAuth buttons (or returns explicit blocked message — design call).

### Documentation
- [ ] Phase 2 brief at HEAD with completion notes.
- [ ] Decisions logged: OAuth provider order, first-login provisioning pattern, allowed_auth_modes shape (text[] vs JSONB).
- [ ] Lesson candidates: any new RLS gotchas, any Supabase OAuth quirks.
- [ ] Update WIRING.yaml `auth-system` to v3 (added OAuth providers).
- [ ] Handoff doc written.

---

## 8. Risks + mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Google/Microsoft Console misconfiguration | Phase 2.1/2.2 stalls | Medium | Verify redirect URLs match Supabase's expected pattern before code starts |
| OAuth callback collides with PKCE callback handler | Both flows break | Low | Existing handler uses code+next params; OAuth uses same shape. Verify with one test redirect first. |
| First-login teacher provisioning races (2 callbacks for same user) | Duplicate teacher rows | Low | Use `INSERT ... ON CONFLICT (id) DO NOTHING` pattern (auth.users.id is the natural key for teachers) |
| `app_metadata.user_type` not set on OAuth signup | Phase 1.3 polymorphic dispatch fails for OAuth users | Medium | Set in callback handler post-exchange, before redirect. Verify with JWT decode in smoke. |
| China access (Google/Microsoft blocked) | Schools in China can't use OAuth | n/a (expected) | Per-school `allowed_auth_modes` lets China-based schools restrict to email_password. |
| Existing email-password flow breaks | All teachers locked out | Low | Don't touch the email-password code path; only add new OAuth buttons + handlers |

---

## 9. Estimate

| Sub-phase | Estimate |
|---|---|
| 2.1 Google OAuth | 3-4 hours |
| 2.2 Microsoft OAuth | 2 hours |
| 2.3 Auth-mode allowlist + UI | 5-6 hours |
| 2.4 Apple feature flag scaffold | 1 hour |
| 2.5 Checkpoint A3 + smoke | 1-2 hours |
| Buffer (Lesson #59 — estimates lie) | 2 hours |
| **Total** | **~14-17 hours / 1.5-2 days** |

Originally master spec said ~3 days. Reduced because email/password and PKCE callback were already shipped during earlier work.

---

## 10. Post-Checkpoint-A3 — what unlocks

- **Phase 3 (Class Roles & Permissions)** can begin. The polymorphic getActorSession seam from Phase 1.3 carries through; class_members table + can(actor, ...) helper builds on top.
- **Pilot recruitment** unblocked — Matt can invite NIS colleagues by sharing /teacher/login, they sign up directly via Google.
- **OAuth-only schools** (e.g. Google Workspace schools) can be onboarded.
- The **Apple OAuth gap** is documented + flagged but doesn't block anything.

---

## 11. References

- Master spec: `docs/projects/access-model-v2.md` §Phase 2 (line 236)
- Phase 1 brief (predecessor): `docs/projects/access-model-v2-phase-1-brief.md`
- Phase 1.4 client-switch brief: `docs/projects/access-model-v2-phase-14-client-switch-brief.md`
- Existing auth callback: `src/app/auth/callback/route.ts`
- Existing teacher login: `src/app/teacher/login/page.tsx`
- Existing student classcode login (won't change): `src/app/api/auth/student-classcode-login/route.ts`
- Existing teacher invite flow: `src/app/teacher/set-password` + `src/app/api/teacher/welcome/*`
- Lesson #64 (RLS recursion) — relevant if Phase 2.3 adds policies on `schools.allowed_auth_modes`
- Phase 1.3 polymorphic helpers: `src/lib/access-v2/actor-session.ts`

---

## 12. Sign-off

**Pre-flight + audit complete (30 Apr 2026 evening).** Brief drafted with smaller-than-spec scope (1.5-2 days) because existing PKCE callback + email-password flow + teacher login page are already shipped from earlier work.

**Decisions locked (sub-phase order driven by Matt's call: NIS uses Microsoft):**

1. **Sub-phase order:** Microsoft (NIS dogfood) → Google → allowlist schema/UI → Apple flag → smoke.

2. **Apple OAuth deferral:** scaffold the feature flag only, no integration. Per master spec resolved decisions §1.

3. **Schema shape:** `TEXT[]` for `allowed_auth_modes` (indexable, CHECK-constraintable). Per-provider config (Microsoft tenant restriction, Google `hd`, etc.) goes in a future separate column or table when actually needed — not Phase 2.

4. **Provisioning location:** callback route (NOT trigger). Trigger can't set `app_metadata.user_type` because Supabase sets app_metadata AFTER the trigger fires; trigger also can't call admin.updateUserById. Architecturally forced.

5. **External prereqs:** Matt configures Azure AD + Google Cloud Console + Supabase dashboard providers in parallel with code, must be done before sub-phase smoke.

6. **Same-email account linking** (Supabase setting): **YES, enable.** Auto-link new OAuth signups with existing email-password accounts when the email matches. UX expectation: signing in via Google with the same email should reuse the account, not error out.

7. **Email/password sign-up flow:** **stays invite-only** for the pilot. OAuth is the self-service path; email-password keeps the existing "Request access" admin-approval flow. Cleaner permission story (Google/Microsoft already verify the user). Revisit when school registration (Phase 4) ships with domain validation.

8. **Email verification on email-password:** **deferred post-pilot.** Master spec doesn't require. File a follow-up note.

---

**Ready to start Phase 2.1 — Microsoft OAuth.**

Matt can do the Azure AD setup in parallel with code work. Sub-phase 2.1 ships when Matt successfully signs in with his NIS Microsoft account end-to-end on prod.
