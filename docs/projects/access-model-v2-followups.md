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

## FU-AV2-PHASE-3-CALLSITES-REMAINING
**Priority:** P3
**Surfaced:** Phase 3.4 audit (1 May 2026)
**Target gate:** Phase 6 cutover

**Symptom:** Phase 3.4 (Compressed) shipped the high-leverage subset of
the ~50 teacher-ownership callsite migrations:
- Helper shim updates (3.4a) → 5 callsites get can()-backed expansion
- classes INSERT trigger (3.4b) → forward-compat invariant
- Dashboard list expansion (3.4c) → first user-visible co-teacher gain
- 1 demonstrative mutation gate (3.4d, units content PATCH)

That leaves **~40 mutation-gate callsites** that still use the inline
`.eq("author_teacher_id", user.id)` / `.eq("teacher_id", user.id)`
patterns. They're functional today (defense-in-depth via the existing
filter) but they don't grant co_teacher / dept_head expansion until
migrated.

**Examples (non-exhaustive):**
- `src/app/api/teacher/units/route.ts` POST → unpublish, publish, fork
  branches all gate via `.eq("author_teacher_id", user.id)`
- `src/app/api/teacher/class-units/route.ts` — class-unit CRUD
- `src/app/api/teacher/quest/route.ts` — quest CRUD
- `src/app/api/teacher/nm-observation/route.ts` — observation CRUD
- `src/app/api/teacher/student-snapshot/route.ts` — snapshot reads
- `src/app/api/teacher/safety-certs/route.ts` — cert management
- `src/app/api/teacher/badges/unit-requirements/route.ts` — badge CRUD
- `src/app/api/teacher/timetable/import-ical/route.ts` — calendar import
- `src/app/api/teacher/teach/quick-edit/route.ts` — Teaching Mode quick edits
- `src/app/api/teacher/skills/cards/[id]/demonstrations/route.ts`
- `src/app/api/teacher/welcome/add-roster/route.ts` (post-creation paths)

**Why deferred:** Each callsite is an independent ~5-line edit but
the cumulative volume is ~15 hours of mechanical work that doesn't
change capability beyond what 3.4a-d already deliver. The pattern is
proven by 3.4d (use `verifyTeacherHasUnit` / `verifyTeacherOwnsClass` /
`verifyTeacherCanManageStudent` shim, OR call `can()` directly).

**Done when:**
1. All ~40 callsites migrated to the can()-backed gate pattern.
2. `grep -rln '\.eq("teacher_id", user.id)' src/app/api/teacher/`
   returns only legitimate filters (e.g., teacher_profiles self-read),
   not access gates.
3. The 5 deprecation-marked helpers can be deleted (FU-AV2-PHASE-6-DELETE-SHIMS).

**Pattern reference:** `src/app/api/teacher/units/[unitId]/content/route.ts`
post-Phase-3.4d shows the canonical migration shape.

---

## FU-AV2-PHASE-6-DELETE-SHIMS
**Priority:** P3
**Surfaced:** Phase 3.4 (1 May 2026)
**Target gate:** Phase 6 cutover

**Symptom:** Three helper functions in `src/lib/auth/verify-teacher-unit.ts`
are marked `@deprecated` after Phase 3.4a:
- `verifyTeacherHasUnit`
- `verifyTeacherOwnsClass`
- `verifyTeacherCanManageStudent`

Each delegates to `can()` when the kill-switch flag is on, but keeps
the legacy implementation as fallback.

**Why deferred:** The shims preserve backward compat during the
Phase 3 → Phase 6 transition. Phase 6 cutover deletes:
1. The legacy `else` branches in each helper.
2. The kill-switch flag (`auth.permission_helper_rollout`).
3. The shim functions themselves, once all ~40 callsites
   (FU-AV2-PHASE-3-CALLSITES-REMAINING) have migrated to direct
   `can()` calls.

**Done when:**
1. FU-AV2-PHASE-3-CALLSITES-REMAINING resolved (no callsites use
   the helpers).
2. The 3 helper functions deleted from `verify-teacher-unit.ts`.
3. Kill-switch admin_settings row deleted.
4. Phase 6 ADR / cutover doc references the cleanup.

---

## FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL
**Priority:** P2
**Surfaced:** Phase 3 brief (1 May 2026)
**Target phase:** Phase 4 (school registration UI)

**Symptom:** Master spec §2.7 Decision 7 says "dept head sees all
classes in their department." Phase 3 wires `dept_head` as a
class-scope role (one row per class the dept_head is tagged on),
which works manually but doesn't scale — schools want to designate
"Sarah is the Head of Design Tech" once and have her auto-tagged
into every Design Tech class.

**Cause:** The *department* concept doesn't exist as a first-class
entity yet. classes have a `subject` field but not a department
linkage; teachers don't have a primary-department tag.

**Why deferred:** Phase 3 ships the role enum + plain `has_class_role(?, 'dept_head')`
reader. The auto-tag-into-classes-of-department logic depends on
school registration UI surfacing department concepts (Phase 4).

**Done when:**
1. Phase 4 introduces a `department` concept on schools (likely a
   nullable `department` field on `classes` + a `school_responsibilities`-like
   `department_responsibilities` table OR extension of existing
   responsibility_type enum).
2. Adding `dept_head` to a department auto-creates `class_members`
   rows for every existing class in that department + a trigger
   keeps it in sync as new classes are added.
3. Removing or transferring dept_head propagates correctly.

---

## FU-AV2-PHASE-3-CHIP-UI
**Priority:** P2
**Surfaced:** Phase 3.3 (1 May 2026)
**Target gate:** Next dashboard-v2-build sync

**Symptom:** `GET /api/teacher/me/scope` (Phase 3.3) returns the
union of class-membership / student-mentorship / school-responsibility
"hats" the teacher wears, but no UI consumes it yet. The dashboard
chip rendering happens in the `dashboard-v2-build` worktree.

**Done when:**
1. `dashboard-v2-build` syncs in main + adds a `RoleChip` component
   that reads from `/api/teacher/me/scope`.
2. Class cards render the role chip when role !== 'lead_teacher'.
3. Mentor chip on student detail pages.
4. Programme coordinator chip on school settings pages.

---

## FU-AV2-PHASE-3-COLUMN-CLASSIFICATION
**Priority:** P3
**Surfaced:** Phase 3.6 close-out (1 May 2026)
**Target gate:** Next GOV pass

**Symptom:** The 4 schema-registry entries fixed in Phase 3.6 (audit_events,
class_members, school_responsibilities, student_mentors) don't yet have
per-column classification metadata (pii, student_voice, safety_sensitive,
ai_exportable, retention_days, basis). All 4 entries currently carry
table-level metadata (purpose, columns, indexes, rls, spec_drift) but
column-level classification was scope-trimmed for Phase 3 close.

**Cause:** Phase 3 brief originally said "data-classification entries
for 3 tables (~15 columns total)." Adding correct classifications
requires careful per-column judgment (e.g. mentor_user_id is a polymorphic
auth.users FK — pii basis pseudonymous; programme is metadata not student
voice — legitimate_interest, etc). Column-level work is a meaningful
chunk and not blocking the can() helper / co-teacher capability that
Phase 3 ships.

**Done when:**
1. audit_events, class_members, school_responsibilities, student_mentors
   each have per-column classification fields populated in
   docs/schema-registry.yaml.
2. Validate against docs/data-classification-taxonomy.md enum rules.
3. RLS coverage scanner stays clean (no new no_policy entries).

---

## FU-MENTOR-SCOPE ✅ RESOLVED
**Priority:** P1 (was)
**Surfaced:** dashboard-v2-build session (26 Apr 2026)
**Resolved:** Phase 3.4a (1 May 2026)

**Was:** MYP teacher mentoring a PP student in another teacher's class
got 403 when trying to load that PP student's cohort. The row exists
in `student_projects.mentor_teacher_id` but no API/RLS read it for
scope.

**Resolution:** Phase 3.4a's `verifyTeacherCanManageStudent` shim
delegates to `can(actor, 'student.edit', ...)` which checks
`has_student_mentorship` via the Phase 3.1 SECURITY DEFINER helper.
A teacher with a non-deleted `student_mentors` row for the student
now passes the helper. Every route that uses the helper inherits
the fix automatically.

The remaining work (migrate `student_projects.mentor_teacher_id`
into `student_mentors` rows for the existing prod data) is a Phase
4+ concern — no rows exist in either table today since the cross-
program mentorship case hasn't shipped UX.

---


## FU-AV2-PHASE-4-4D-NEXT-INTL
**Priority:** P3
**Surfaced:** Phase 4.4d (2 May 2026)
**Target gate:** When 2nd-locale demand arrives (no current need)

**Symptom:** §3.9 item 18 specced bringing `next-intl` into `/school/[id]/settings`
on day 1 so second-locale ships as a config addition. In execution, the
required infrastructure (next.config.js changes, middleware locale routing,
`[locale]` dynamic segment, message-file scaffolding, all-strings extraction)
is ~2 hours of work for ZERO user-visible benefit in v1 (English-only).

**Decision:** Defer per methodology default — "don't add infrastructure for
hypothetical future requirements." All Phase 4.4 settings page strings stay
inline English. When a 2nd-locale request lands (any pilot school requesting
zh-CN, or NIS internal demand), this FU is the entry point.

**Done when:**
1. `next-intl` installed + `next.config.js` configured
2. `[locale]` dynamic segment added to app routes (or per-route locale
   prefix per Next.js 15 conventions)
3. `messages/en.json` extracted from `/school/[id]/settings` strings (and
   any other 4.4 settings UI by then)
4. Settings page strings replaced with `useTranslations('school.settings')`
   calls
5. Smoke: locale=`zh-CN` URL serves Chinese strings (paste at least 5
   placeholder Chinese translations to prove it routes)

**Why deferred:** No user-visible value in v1. English-only meets pilot
need. Adding now would 2x the §4.4 PR diff for zero ship value.

---

## FU-AV2-PHASE-4-3WAY-LIVE-DIFF
**Priority:** P3
**Surfaced:** Phase 4.4d (2 May 2026)
**Target phase:** Phase 4 polish (post-A5a)

**Symptom:** Per master spec §3.9 item 14, the confirm flow should show a
3-way diff (proposed-before → CURRENT-NOW → after) so the 2nd teacher can
spot staleness if the value moved during the 48h pending window. Phase
4.4d ships a 2-way preview (proposed-before → after) with Confirm/Cancel
buttons — a real review-before-confirm UX win, but not the full live diff.

**Cause:** The full 3-way diff requires a client-layer mapping from
`change_type` → `schools` column so the modal can fetch the live
current value to compare against `payload.before_at_propose`. The
applier registry already has this mapping server-side; replicating it
client-side OR exposing it via the route is its own pass.

**Done when:**
1. Mapping `change_type → schools.column` available client-side (probably
   exposed via a new `GET /api/school/[id]/settings/diff?changeType=X&proposedBefore=Y`
   endpoint that returns the live value, or via an inline server-component
   pre-fetch)
2. Confirm dialog renders 3 columns: proposed-before / current-now / after
3. Stale-value warning rendered when `current ≠ proposed-before`
4. Test asserts: when current value differs, dialog shows ⚠ Stale banner

**Why deferred:** 4.4d's 2-way preview already gives the confirmer a review
moment (the material UX win). Live 3-way is polish for the staleness edge
case (rare in practice — most proposals get confirmed within hours of the
48h window).

---

## FU-AV2-PHASE-4-PER-FIELD-INHERITANCE-BADGES
**Priority:** P3
**Surfaced:** Phase 4.4d (2 May 2026)
**Target phase:** Phase 4.8 (when JSONB columns land) OR Phase 4 polish

**Symptom:** §3.9 item 13 specced per-field "↑ inherited from {parent name}"
badges on the settings UI for inheritable columns when `parent_school_id`
is set. Phase 4.4d ships the campus breadcrumb in the page header but NOT
per-field badges — because all `INHERITABLE_COLUMNS` per
`parent-precedence.ts` (academic_calendar_jsonb, timetable_skeleton_jsonb,
frameworks_in_use_jsonb, default_grading_scale,
notification_branding_jsonb, safeguarding_contacts_jsonb,
default_student_ai_budget) are Phase 4.8 columns that don't exist yet.

**Cause:** Per-field badges have nothing to mark today.

**Done when:**
1. Phase 4.8 ships the JSONB columns
2. Settings page calls `resolveSchoolSettings()` (already implemented) to
   compute inherited values
3. Each settings section renders an "↑ inherited from {parent name}" badge
   next to fields where `result.source === 'inherited'`
4. Editing a field overrides locally; clearing falls back to parent

**Why deferred:** No fields to mark until 4.8 ships. Infrastructure is
already in place (resolveSchoolSettings helper from §4.0); badges are
plug-and-play once columns exist.


## FU-AV2-PHASE-4-DOMAIN-UI
**Priority:** P3
**Surfaced:** Phase 4.4 hotfix smoke (2 May 2026)
**Target phase:** Phase 4 polish OR Phase 4 part 2

**Symptom:** `/school/[id]/settings` has a "School Domains" section that
points teachers at the API instead of providing UI. The Phase 4.2 routes
(GET / POST / DELETE) all work; the gap is the in-page UI for managing
domains.

**Done when:**
1. Inline domain list under the "School Domains" section
2. "Add domain" form (auto-verifies if requester email matches domain)
3. "Remove domain" button per row → high-stakes propose flow (or instant
   for single-teacher bootstrap mode)
4. "Verified" / "Pending" pill per row
5. Smoke: same-school teacher add → list refreshes; remove → list refreshes;
   non-matching domain add returns "needs 2-teacher confirm" with link to
   the pending proposal

**Why deferred:** The settings page editing (4.4b/c/d) shipped without
domain management because the API supports the workflow today via curl.
Pre-pilot urgency is teacher-facing settings, not domain management.
NIS prod has the 3 NIS domains pre-seeded; expansion is rare.

---

## FU-AV2-WELCOME-CALENDAR-PREVIEW
**Priority:** P3
**Surfaced:** Phase 4.4 hotfix smoke (2 May 2026)
**Target phase:** Welcome wizard polish (post-pilot)

**Symptom:** Welcome wizard step 3 imports an iCal calendar and reports
"Calendar linked — 8 holidays imported." Teacher has no way to verify
WHICH 8 days were imported. Could be school holidays correctly, or
personal calendar entries that happened to look like holidays (e.g.,
"Sick day", "Conference"). No trust signal.

**Done when:**
1. Below the "Calendar linked" success banner, render a collapsible
   list of the imported holiday dates with their summaries
2. Each row shows: date / day-of-week / event summary
3. Optional "Remove" button per row to exclude a misclassified entry
   before continuing
4. Persists user-side exclusions when continuing to step 4

**Why deferred:** Pre-pilot trust risk is real but not urgent (Matt's
own NIS calendar has standard staff-room holidays, low chance of
misclassification). Worth landing pre-pilot-expansion to second school.

---

## FU-AV2-WELCOME-STEP5-CTAS
**Priority:** P2
**Surfaced:** Phase 4.4 hotfix smoke (2 May 2026)
**Target phase:** Pre-pilot product decision

**Symptom:** Welcome wizard step 5 ("You're all set!") shows 3 CTA
cards:
  - **Recommended:** "Create a unit with AI / Describe what you want
    to teach and we'll draft a full unit in minutes"
  - "Upload existing unit"
  - "Explore the dashboard"

Matt's 2 May product direction: **moving away from AI-generated units**
toward a different unit-creation strategy (TBD, post-Phase-4). The
"Create a unit with AI" CTA is wrong direction. The 3-card layout
itself is fine; the recommended path needs to change.

**Decision required (Matt):** what should the "first thing to do" CTA
be in the new direction? Suggestions captured during smoke:
  - "Set up your first unit" (non-AI flow)
  - "Take a tour"
  - "Explore on your own"
  - "Configure more options"

**Done when:**
1. Matt picks the canonical replacement CTA(s) for step 5
2. Welcome wizard updated with the new options
3. Underlying unit-creation flow exists for the new "Set up your first
   unit" path (depending on which direction Matt chooses for the unit
   creator rebuild)

**Why deferred:** Product decision blocked on the broader unit-creation
strategy. Pre-pilot priority but post-Phase-4. Filed at P2 because the
current copy actively misleads new teachers about the platform's
direction.

---

## FU-FREEMIUM-CAN-PATTERN-ADR
**Priority:** P3
**Surfaced:** Phase 4.8b freemium-seam audit (2 May 2026)
**Target gate:** Post-Phase-4 ADR pass (before freemium build starts)

**Symptom:** `can(actor, action, resource, { requiresTier })` exists in
`src/lib/access-v2/can.ts:80-88` and is the documented chokepoint for
plan-aware capability gating. But there's no ADR explaining the pattern,
so the second consumer (the freemium build) might re-roll its own gate
helper rather than passing `requiresTier:` through `can()`.

**Cause:** Phase 3 shipped the `requiresTier` option as a forward-compat
seam without writing it up. Phase 4.8b confirms the seam works; the
documentation gap remains.

**Decision required:** Write a short ADR (`docs/adr/014-freemium-tier-gating-via-can.md`):
1. Single rule — all plan-aware gating goes through `can(...)` with `requiresTier`.
2. Anti-pattern — never inline `if (school.subscription_tier === 'pro')` outside `can()`.
3. Free-tier defaults — `requiresTier` is optional; absence = free-tier accessible.
4. Tier ordering — `pilot ≥ school ≥ pro ≥ starter ≥ free` (pilot is "anything goes" admin/dev mode; school is the highest paid tier).

**Done when:**
1. ADR-014 written and accepted.
2. ADR-001 (OS extraction strategy) cross-referenced.
3. Freemium build kickoff brief references ADR-014 explicitly.

**Why deferred:** Mechanism is in code; documentation is the gap. Not
blocking; pure hygiene before the second consumer arrives.

---

## FU-FREEMIUM-CALLSITE-PLAN-AUDIT
**Priority:** P3
**Surfaced:** Phase 4.8b freemium-seam audit (2 May 2026)
**Target gate:** Pre-freemium-build (after Phase 4.8b lands; before Stripe project starts)

**Symptom:** Cannot confirm without a sweep that no callsite gates
behaviour on `school.subscription_tier` outside `can()`. If even one
callsite inlines the check, freemium-tier rollouts will produce
inconsistent gating (some surfaces respect plan changes, others don't)
until that callsite is found.

**Cause:** `schools.subscription_tier` was added pre-Phase-3 (mig
20260428125547_schools_v2_columns) for forward-compat. There was no
discipline at the time about routing reads through `can()`.

**Decision required:** Run the audit:
1. `grep -rn "subscription_tier" src/ --include="*.ts" --include="*.tsx"` — expected hits: schema-defining files (types/constants), the `can()` helper, the new `actor-session.ts` plan resolver (Phase 4.8b), and possibly admin views.
2. For every hit NOT in those expected sites: refactor through `can(...)` with `requiresTier:` OR file a follow-up if the use case doesn't fit (e.g. admin debug surface that genuinely wants raw tier display).
3. Document the canonical reader list in the ADR-014 (FU-FREEMIUM-CAN-PATTERN-ADR).

**Done when:**
1. Grep audit run; all non-canonical readers refactored or explicitly exempted.
2. Reader list documented in ADR-014.

**Why deferred:** Today there are zero plan-gated features beyond the
forward-compat `requiresTier` option. The audit only matters when the
freemium build starts wiring real `requiresTier:` flags. P3 hygiene step
to run as the first action of the freemium build, not Phase 4.

---

## FU-AV2-IMPERSONATION-RENDER-WIRING
**Priority:** P3
**Surfaced:** Phase 4.7 super-admin view shipped (3 May 2026)
**Target gate:** Pre-pilot expansion to 2nd school (or first time Matt
needs to genuinely "see what teacher X sees" to debug a complaint)

**Symptom:** Phase 4.7 ships the full view-as URL machinery — signed
HMAC token, /api/admin/school/[id]/impersonate route, middleware
mutation-block when `?as_token=` is present, verifyImpersonationToken
helper. The "View as" button in /admin/school/[id] generates a working
URL that opens /teacher/dashboard?as_token=... in a new tab.

But the consuming side — actually rendering the target teacher's data
when `?as_token=` is present — is NOT wired. Matt will see his own
dashboard with the URL param dangling, not the target teacher's view.

**What's needed for full impersonation:**
1. Layout-level `as_token` consumer that calls `verifyImpersonationToken`,
   logs an `audit_events` row of type `platform_admin.impersonation_used`
   (paired with the `_url_issued` row from §4.7), and threads the
   resolved `target_teacher_id` into a request-scoped context.
2. Teacher-side data fetchers (`getTeacherSession()`, dashboard loaders)
   read the impersonation context and substitute `target_teacher_id` for
   `auth.uid()` when present.
3. Visual banner: "You are viewing as <teacher_name>. This is a
   read-only support session. Token expires in <countdown>."
4. RLS implications: SECURITY DEFINER helpers like
   `is_teacher_of_class()` need to honor the impersonated identity OR
   the consuming page needs to query via service role + manual filtering.
   Pick one and document in the impersonation helper.

**Why deferred:** The hard security work (signing, expiry, mutation
block, audit log) shipped in 4.7. The render-wiring is product UX —
useful but not blocking the super-admin's primary jobs (audit log,
change history, teacher list, settings snapshot, merge approval).
Phase 4.7 verified by smoke if Matt clicks "View as" and the URL opens
in a new tab with as_token set.

**Done when:**
1. Layout consumes `as_token`, audit-logs use, threads context.
2. Teacher dashboard renders target teacher's data.
3. Visible banner with countdown.
4. RLS path documented (impersonate-as-uid OR service-role with
   manual filter).
5. Smoke: Matt views as a real test teacher, sees their actual classes
   + students, attempts a mutation, gets 403.

---

## FU-FREEMIUM-SCHOOL-DOWNGRADE-OWNERSHIP
**Priority:** P2
**Surfaced:** Phase 4.7b tier-aware membership amendment (2 May 2026 PM, Gemini Q2 review)
**Target gate:** Post-pilot; design when a real downgrade happens

**Symptom:** Phase 4.7b establishes that `school`-tier schools are flat-membership shared workspaces, while `free` and `pro` tiers are siloed personal schools. The amendment specs the UPGRADE path (free-tier-personal → school-tier shared, with `merged_into_id` + invite flow). The DOWNGRADE path (school-tier lapses → split back into personal silos) is highly complex and has no design.

**Open ownership questions:**
- Who retains ownership of shared students that belonged to multiple teachers?
- Who retains classes that were co-taught (multiple `class_members` lead_teacher rows)?
- What happens to `school_responsibilities` (programme coords, dept_heads)?
- What happens to school-library units shared by departed teachers?
- Does the school entity dissolve, or stay as a tombstone in `archived` status?
- How are guardians + `school_resources` (parent contacts, community members) split?

**Design sketch:**
1. Decision 8 corollary already says "authored content stays with the school" on individual teacher departure. Downgrade is the multi-departure case at once.
2. Probably: school stays in `archived` status (already in Phase 0 lifecycle enum) with all data attached; individual teachers' `teachers.school_id` rewrites to a fresh personal school created on downgrade; classes/students they authored migrate to the new personal school.
3. Co-taught classes need a designated owner — possibly the `school_admin` who triggered downgrade keeps them, or first-`lead_teacher`-by-accepted_at wins.
4. Stripe webhook trigger: `customer.subscription.deleted` → downgrade flow; needs grace period (~30 days) before data splits to allow reactivation.

**Why deferred:** Zero downgrade events in v1 — NIS is the only school-tier school and a downgrade there is unlikely. Designing this before a real case forces premature decisions on edge cases (single-teacher-school edge case + 30-day grace + Stripe-payment-retry logic) that experience will clarify. P2 because if a real downgrade happens before this is designed, the data-split ambiguity blocks the customer's offboarding and risks data loss.

---

## FU-WELCOME-WIZARD-STUDENT-EMAIL-GUARD
**Priority:** P2
**Surfaced:** Phase 4.7b tier-aware membership audit (2 May 2026 PM, CWORK outside-Q1-Q6)
**Target gate:** Pre-pilot expansion to 2nd school; should land alongside or shortly after Phase 4.7b

**Symptom:** `/teacher/welcome` accepts ANY email as a teacher signup, including a STUDENT email at a school domain (students at NIS have `@nis.org.cn` mailboxes, same domain as teacher accounts). Phase 4.7b's tier-aware membership fixes the auto-join leak for `school`-tier schools but does NOT prevent a student from completing teacher signup and landing in a personal school of their own — they then have a teacher dashboard, can create classes, can invite students of their own, and the platform has no signal that they're not a teacher.

**Cause:** Welcome wizard has no role-claim gate. Email-domain alone is insufficient (same domain = teachers + students). The signup flow trusts the user's claim of "I am a teacher."

**Design sketch (3 layers, defense-in-depth):**
1. **Domain-level role hint** on `school_domains` row — boolean `students_use_this_domain BOOLEAN DEFAULT false`. When true, welcome wizard surfaces "If you're a student at this school, please use the student login link your teacher gave you" prominently AND requires explicit "I am a teacher / school staff" attestation checkbox before continuing.
2. **`school` tier flag** — for `subscription_tier='school'` schools, signup is invite-only by Phase 4.7b design. Student can't accidentally sign up as teacher because no invite token = no signup path.
3. **Existing email check** — if `auth.users` already has a row with the same email tagged `user_type='student'`, block teacher signup with that email entirely (prompt: "this email is registered as a student account; contact your school admin to convert to teacher").

**Why deferred to FU**: 4.7b protects the high-risk path (`school`-tier schools) by removing auto-join. Free-tier schools at unknown domains where students happen to use the same email pattern are a tail risk pre-pilot — NIS is the only school today and is going `school` tier in 4.7b-0. Filing as P2 because it should land before 2nd-school onboarding (which may have a free trial period at `free` tier before the school upgrades).

**Done when:**
1. `school_domains.students_use_this_domain` column added.
2. Welcome wizard surfaces the warning + checkbox when domain has the flag.
3. Auth.users existing-as-student check added to teacher signup path.
4. Smoke test: student email cannot complete teacher signup at flagged domain.


---

## FU-AV2-TEACHER-DIRECTORY-ROUTE-GATE
**Priority:** P3
**Surfaced:** Phase 4.7b-3 tier-gate work (3 May 2026 PM)
**Target gate:** Pre-pilot expansion to 2nd school

**Symptom:** The 4.7b-3 RLS migration tier-gates 4 leak surfaces that
expose school-wide reads to non-school-tier teachers (`audit_events`,
`student_mentors`, `school_resources`, `guardians`). It does NOT tier-gate
the **teacher directory** because:

1. There is no teachers RLS policy for school-wide reads (mig 001 only
   has `Teachers read own profile` USING `auth.uid() = id`). The
   /admin/school/[id] super-admin route fetches the school's teacher
   list via service role + `requirePlatformAdmin` gate.
2. The /school/[id]/settings page also fetches teacher list server-side.

So the leak isn't via RLS but via routes that query teachers via service
role. Today both surfaces are tier-blind — they'd return the teacher
list for ANY school regardless of tier.

**Why deferred to FU vs included in 4.7b-3:**
The two consuming routes are:
- `/api/admin/school/[id]` — already platform-admin only, so the
  "tier check" would just be defensive. Platform admin sees everything
  by design.
- `/school/[id]/settings` (server component) — this fetches teachers
  for display. Currently tier-blind.

For the second route, the question is whether non-school-tier teachers
should see a teacher list at all. Under tier-aware membership, free/pro
teachers are in personal schools (single member) — there's nothing to
list. So the route already returns 1 row (themselves). No leak today.

If a non-school-tier school somehow gets multiple teachers (e.g. legacy
seed schools that get teachers added directly via SQL), the route
would expose them. Defensive gate worthwhile pre-pilot expansion.

**Done when:**
1. /school/[id]/settings server component checks the school's tier
   before fetching the teacher list. If tier != 'school', show only
   `auth.uid()` row.
2. /admin/school/[id] route is exempt (platform admin path).
3. Smoke test: as a free-tier teacher attached to a multi-teacher
   legacy seed school, /school/[id]/settings shows only their own row.

---

## FU-FREEMIUM-FLAGS-PLAN-ANNOTATION
**Priority:** P3
**Surfaced:** Phase 4.8b freemium-seam bake-in (3 May 2026)
**Target gate:** Pre-freemium-build kickoff

**Symptom:** Phase 4.8b added the `requires_plan` schema field to
`docs/feature-flags-taxonomy.md` but only annotated 1 exemplar flag
(`pipeline.stage_enabled` → `requires_plan: free`). The other 14
flag-kind entries in `docs/feature-flags.yaml` lack the field.

**Why deferred:** Per-flag annotation is mechanical but requires a
real product call on each — should `pipeline.starter_patterns_enabled`
be free or pro? Should `auth.permission_helper_rollout` be school?
The freemium build will iterate on these; trying to do it in 4.8b
without the tier-feature matrix decisions risks landing wrong defaults.

**Done when:**
1. Tier-feature matrix decisions signed off (PRODUCT call before
   freemium build).
2. Each flag-kind entry annotated with `requires_plan` matching the
   matrix.
3. The flag-reading wrapper (Phase 5+ when wired) consumes the field
   and returns the safe-fallback default when caller's tier is below.

**Why P3:** field exists today as schema-only; freemium build can
add via sed once matrix lands. Not blocking access-v2 close.

---

## FU-AV2-DEPT-HEAD-UI
**Priority:** P2
**Surfaced:** Phase 4.9 dept_head triggers (3 May 2026)
**Target gate:** Pre-pilot expansion to 2nd school

**Symptom:** Phase 4.9 ships the data model + auto-tag triggers for
the dept_head role, but no UI surface to grant/revoke or display the
role. Today the only way to attach a dept_head responsibility is via
service-role SQL INSERT (which fires the auto-tag trigger correctly).

**What's needed:**

1. **Settings page Section J (school-tier only): Departments + dept_heads**
   - List existing departments at the school (distinct values from
     `classes.department`).
   - Per-department: list current dept_heads (school_responsibilities
     rows of type='dept_head' for that department).
   - "Grant dept_head" button → modal: pick teacher (filtered to
     school's teachers) → confirm → POST creates responsibility →
     trigger auto-grants class_members.

2. **RoleChip variant for dept_head**
   - `class_members.role = 'dept_head'` should render as a distinct
     coloured chip (vs lead_teacher / co_teacher) on the class hub
     teacher list. Shows that this person was auto-tagged as a
     department coordinator (vs explicitly invited as a co-teacher).

3. **Department picker on class settings**
   - When creating/editing a class, expose a `department` dropdown
     populated from `classes.department` distinct values + manual
     entry. Setting it triggers the resync trigger (auto-add dept_head
     class_members for the new department's coordinators).

4. **/admin/school/[id] surfacing**
   - Roles tab in the super-admin view shows all
     school_responsibilities rows (academic + governance). Already
     hinted at by the existing tab nav; just needs the list rendered.

**Why deferred:** Phase 4.9 closed FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL
on the data side. UI surface is real product work (~1 day) that
doesn't block the pilot — NIS today has 0 dept_head responsibilities
and the auto-tag triggers fire correctly when added via SQL Editor.
P2 because it's needed before any 2nd school onboarding (where
multiple departments are likely).

**Done when:**
1. Settings Section J renders + grant flow works end-to-end.
2. RoleChip variant shows on class teacher lists.
3. Class settings has a department picker.
4. /admin/school/[id] Roles tab populated.
5. Smoke: grant dept_head via UI → class_members rows auto-tagged →
   teacher sees the relevant classes in their dashboard.

---

## FU-AV2-DEPT-BACKFILL-FROM-NAME
**Priority:** P3
**Surfaced:** Phase 4.9 smoke (3 May 2026)
**Target gate:** Pre-pilot or alongside FU-AV2-DEPT-HEAD-UI

**Symptom:** Phase 4.9 backfill regex matches `classes.subject` for
keywords. NIS classes have `subject = NULL` and encode discipline in
`name` instead ("10 Design", "9 Design Science S2"). Result: 0 of 7
NIS classes got auto-classified.

**Fix:** Extend the backfill (or the future Settings UI department
picker that's part of FU-AV2-DEPT-HEAD-UI) to fall back to
`classes.name` when `subject` IS NULL. Same regex; just `coalesce(subject, name)`.

**Why deferred:** Manual classification works fine for v1 — Matt set
2 NIS classes to `design_tech` during the smoke and the trigger fired
correctly. A dedicated backfill pass can run as a one-off SQL when
the UI surface lands.

**Done when:**
1. Either: re-run the backfill with `coalesce(subject, name)` source.
2. Or: bake into the Settings UI department picker logic when
   FU-AV2-DEPT-HEAD-UI ships.

---

## FU-AV2-PHASE-4-PART-2-REGISTRY-SYNC
**Priority:** P3
**Surfaced:** Saveme post-Phase-4-part-2 close (3 May 2026)
**Target gate:** Phase 6 cutover registry sweep

**Symptom:** Phase 4 part 2 added 3 NEW tables (school_merge_requests,
school_invitations, unit_use_requests) + ~10 new columns + ~20 new
RLS policies + ~10 SECURITY DEFINER helpers + 4 trigger functions.
Two registries don't auto-detect this drift:

1. **`docs/schema-registry.yaml`** — manual review per migration. Phase 4
   part 2's 8 migrations need entries / column updates. Existing 4 Phase 0
   spec_drift entries (FU-DD scanner-misparse) still need reconciliation.

2. **`docs/projects/WIRING.yaml`** — manual review per system. Phase 4
   part 2 added new systems (school-governance v2, school-library,
   tier-aware-membership, freemium-seams). The scanner doesn't know
   about these. WIRING should also reflect:
     - auth-system v2 → v3 (added ActorSession.plan + view-as)
     - permission-helper v1 → v2 (added SCHOOL_ADMIN_ACTIONS + tier helper)
     - class-management v2 (department + dept_head triggers)

**Why deferred to FU**: Capturing this properly is ~1-2h of manual
yaml editing across both files. Phase 4 part 2 close commit captured
all the substantive work; registry sync is hygiene that's better
done in a focused follow-up than rushed at saveme.

**Done when:**
1. schema-registry.yaml has entries for 3 new tables + column updates
   for ~10 new columns + spec_drift entries reconciled.
2. WIRING.yaml has entries for the 4 new systems + version bumps for
   3 existing systems (auth / permissions / class-management).
3. wiring-dashboard.html SYSTEMS array synced.

**Why P3**: drift is cosmetic — neither registry drives runtime
behavior. The scanner-side registries (api-registry, ai-call-sites,
feature-flags, vendors, RLS) ARE clean. Phase 6 cutover (~Phase 5
complete) is the natural full-registry-sync gate; this FU folds in.
