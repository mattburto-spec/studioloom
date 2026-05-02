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

