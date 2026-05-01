# Access Model v2 — Follow-up Tickets

> Items surfaced during Phase 2 sub-phase work that are NOT blockers for the
> phase they were found in, but should be picked up before Access Model v2
> is declared complete or before specific gates (e.g. second-school pilot).
> Each entry: short title, surfaced date, symptom, suspected cause, target
> phase / gate, suggested investigation.

---

## FU-AZURE-MPN-VERIFICATION
**Priority:** P3
**Surfaced:** Phase 2.2 OAuth branding (1 May 2026)
**Target gate:** Before second-school pilot

**Symptom:** Azure Portal flags "End users cannot grant consent to newly
registered multitenant apps without verified publishers." Currently, when
Microsoft 365 admins from tenants other than the StudioLoom Auth home
tenant try to consent to the app, they will see an "unverified app"
warning or be blocked depending on their tenant's admin-consent
configuration.

**Cause:** Multi-tenant Microsoft Entra ID apps require a verified
publisher domain + a Microsoft Partner Network (MPN) ID for tenants other
than the home tenant to be able to grant user consent without admin
override.

**Why deferred:** NIS pilot works because the consent screen click-through
is acceptable for a small set of test users. Full verification is a
multi-week Microsoft Partner Center process (signup → MPN ID → tenant
verification) and not worth blocking on for a single-school pilot.

**Done when:**
1. Microsoft Partner Center account created.
2. MPN ID obtained.
3. Publisher verified for studioloom.org tenant.
4. Verified-publisher badge appears on the consent screen for cross-tenant
   sign-ins.

**References:**
- Microsoft docs: <https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview>

---

## FU-LEGAL-LAWYER-REVIEW
**Priority:** P2
**Surfaced:** Phase 2.2 OAuth branding (1 May 2026)
**Target gate:** Before pilot expansion beyond Matt's classroom

**Symptom:** `/privacy` and `/terms` pages were drafted by Claude as
starter content. Reasonable for OAuth consent screen URLs but not
lawyer-vetted.

**Specific clauses needing real legal review:**
- Governing law (currently NSW, Australia) — needs alignment with where
  the StudioLoom entity is incorporated when that happens.
- Limitation of liability — current cap on 12 months of fees is a
  reasonable starting position but jurisdiction-specific.
- Children's data section — needs to align with whichever jurisdictions
  the first paying schools are in (COPPA / GDPR / PIPL / Privacy Act
  Australia all have specific clauses we should be explicit about).
- Sub-processor list — current 7 sub-processors are accurate but lawyer
  should advise on disclosure cadence (e.g. notification to schools
  before adding new sub-processors).
- AI features section — needs alignment with Anthropic's data-processing
  agreement and any school requirements about AI in classrooms.
- Indemnity clause — light-touch right now; lawyer may want it tightened.

**Why deferred:** Pilot is currently Matt's own classroom. Real legal
exposure begins when a second school joins or when payment is taken.

**Done when:**
1. Australian-qualified lawyer (or equivalent in target jurisdiction)
   reviews both pages.
2. Revised drafts approved by lawyer.
3. Versioned in repo with the lawyer's name + date in a comment block at
   the top of each page.

---

## FU-CUSTOM-AUTH-DOMAIN
**Priority:** P3
**Surfaced:** Phase 2.2 OAuth branding (1 May 2026)
**Target phase:** Phase 2.3 launch / Phase 4 prep

**Symptom:** OAuth consent screens (Google, Microsoft) show the Supabase
project URL (`cxxbfmnbwihuskaaltlk.supabase.co`) as secondary text under
the StudioLoom branding. This is unprofessional-looking and slightly
confusing for end users.

**Cause:** Default Supabase Auth lives at `<project-ref>.supabase.co`.
That domain is what OAuth providers see as the actual callback target.

**Fix:** Configure Supabase Auth on a custom domain — e.g.
`auth.studioloom.org`. Steps:
1. Supabase Dashboard → Project Settings → Auth → Custom Domain.
2. Add CNAME `auth` → `cxxbfmnbwihuskaaltlk.supabase.co` at DNS provider.
3. Update OAuth redirect URIs in Google Cloud Console + Azure Portal to
   `https://auth.studioloom.org/auth/v1/callback`.
4. Update any hardcoded Supabase callback URLs in the StudioLoom code.

**Why deferred:** Requires Supabase Pro plan ($25/mo + $10/mo for custom
domain). Worth doing once the platform is generating revenue from a paid
school and the polish-vs-cost tradeoff flips.

**Done when:**
1. `auth.studioloom.org` resolves to Supabase Auth.
2. OAuth providers configured with new redirect URIs.
3. Smoke confirms consent screens show only studioloom.org branding (no
   supabase.co).

---

## FU-OAUTH-LANDING-FLASH ✅ RESOLVED 1 May 2026
**Priority:** P2 (was)
**Surfaced:** Phase 2.2 OAuth smoke (1 May 2026)
**Resolved:** Phase 2.5 close-out, same day

**Root cause confirmed:** Supabase URL Configuration mismatch.
- Site URL was `https://studioloom.org` (apex, no www).
- Redirect URLs allow list had only apex entries: `https://studioloom.org`, `https://studioloom.org/auth/callback`, plus localhost + Vercel preview alias.
- The OAuth button passed `redirectTo: https://www.studioloom.org/auth/callback?next=/teacher/dashboard` (origin-derived from the www-canonical Vercel deploy), which didn't match any allow list entry.
- Supabase fell back to Site URL → browser landed at `https://studioloom.org/?code=...` (apex root) → Vercel 307 → `https://www.studioloom.org/?code=...` (www landing page rendered = the flash).

**Fix applied:** Supabase Dashboard → Authentication → URL Configuration changes by Matt:
1. Site URL changed apex → `https://www.studioloom.org`.
2. 3 www entries added to Redirect URLs allow list:
   - `https://www.studioloom.org/auth/callback`
   - `https://www.studioloom.org/auth/confirm`
   - `https://www.studioloom.org/teacher/set-password`
3. Existing apex entries left in the allow list as a safety net (harmless; can prune in Phase 3).

**Smoke result:** sign-in via Microsoft + Google both go directly from the provider consent screen to `/teacher/dashboard` — no landing page flash. Verified by Matt 1 May 2026.

**Lesson learned:** Supabase URL Configuration must align with Vercel's canonical hostname. When apex 307-redirects to www, putting only apex entries in the allow list forces fallback chains that surface as cosmetic UX glitches (and could surface as actual auth failures under different conditions). Future projects: set Site URL to the www form on day one when Vercel canonical is www.

---

