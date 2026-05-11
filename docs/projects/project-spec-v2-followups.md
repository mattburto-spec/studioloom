# Project Spec v2 — Follow-up Tickets

> Deferred items surfaced during the v2 split build (11–12 May 2026).
> v2 split shipped across 5 PRs: #188 (Phase A schema), #191 (Phase
> B+C shared lib + Product Brief), #194 (Phase D User Profile + photo
> bucket), and the final Phase E+F PR. See
> [`project-spec-v2-split-brief.md`](project-spec-v2-split-brief.md)
> for the design spec.

---

## FU-PSV2-AGGREGATED-VIEW — "My Project Plan" student dashboard view
**Surfaced:** 11 May 2026 (brief §12.1).
**Severity:** 🟢 LOW — three separate completion cards already work.
**Target phase:** v3 polish, post-pilot.

**What it adds:** A single student-facing page (or dashboard widget) that pulls all three v2 blocks' completion summaries into one combined "Project Plan" card. Useful for the student to see their whole spec at a glance without navigating three lesson activities.

**Why deferred:** v2 keeps it simple — each block has its own completion card. Aggregation is nice-to-have. Implementing it requires a new route + a query that joins all three tables.

**Definition of done:**
- New page `/unit/[unitId]/my-project` (or a dashboard widget)
- Reads from all three v2 tables + falls back to v1 `student_unit_project_specs` if no v2 data exists
- Read-only render with section dividers per block
- Optional: print-friendly stylesheet

---

## FU-PSV2-AI-MENTOR-PER-BLOCK — Per-block sharpening pass (Haiku)
**Surfaced:** 11 May 2026 (brief §12.5). Supersedes v1's FU-PSB-MENTOR-SHARPEN.
**Severity:** 🟡 MEDIUM — promised in original v1 brief.
**Target phase:** When AI cost budget allows + pedagogical signal is clear.

**What it adds:** Per-block "Sharpen" buttons. Each calls Haiku 4.5 with the block's completed state + context. Returns ONE pointed follow-up question per block. Single round, no chat history.

**Why deferred:** Adds 3 new AI call sites + cost. Pedagogical value should be validated with one block first (probably Product Brief) before fanning out.

**Definition of done:**
- 3 new endpoints under `/api/student/{product-brief,user-profile,success-criteria}/sharpen`
- Each routes through `callAnthropicMessages` per the AI chokepoint
- Effort-gate per block: enabled only when ≥80% of slots are answered (not skipped)
- One-shot exchange — render question inline, no chat
- New entries in `ai-call-sites.yaml`

---

## FU-PSV2-USER-PHOTO-MODERATION — Stricter moderation for User Profile photos
**Surfaced:** 11 May 2026 (brief §12.4).
**Severity:** 🟡 MEDIUM — current `moderateAndLog` policy is generic, not user-photo-specific.
**Target phase:** Before student pilot scales beyond Matt's G9 class.

**What it adds:** A dedicated moderation policy for the `user-profile-photos` bucket. Considerations:
- Face-blur for under-13 users? (Privacy / GDPR considerations.)
- Age-appropriate content filtering (the existing image filter is already in place but tuned for general project images, not specifically for photos of real people).
- Retention policy: delete photos after the student graduates / leaves the class?
- Per-bucket audit log entry distinct from generic upload moderation.

**Why deferred:** Generic `moderateAndLog` works for the pilot. Specific policy needs a security / legal conversation.

**Definition of done:**
- Decision logged in `docs/decisions-log.md` covering retention + face-blur policy
- New `audit-coverage.json` entry for the upload-photo route if policy diverges
- `data-classification-taxonomy.md` updated if these photos are classified differently from `responses` images

---

## FU-PSV2-CLASS-GALLERY-USER-RESEARCH — Surface completed User Profiles in Class Gallery
**Surfaced:** 11 May 2026 (brief §12.7).
**Severity:** 🟡 MEDIUM — high-impact for unit-2+ cohorts.
**Target phase:** When unit 2 of a class needs to see prior cohorts' user research.

**What it adds:** A "User Research" tab in the Class Gallery showing every completed User Profile (with optional photo + quote). Helps students stand on prior cohorts' empathy work + learn from peers.

**Why deferred:** Class Gallery is its own system. Privacy: photos of real people from past cohorts need explicit consent flow before being shared. v1 Gallery doesn't currently support per-photo consent.

**Definition of done:**
- Consent toggle on User Profile slot 7 ("OK to share this in Class Gallery later")
- Class Gallery "User Research" tab reads filtered profiles
- Photos still served via storage proxy (auth-gated)

---

## FU-PSV2-CROSS-BLOCK-SYNC — Auto-populate overlapping fields between blocks
**Surfaced:** 11 May 2026 (brief §12.6).
**Severity:** 🟢 LOW — duplication is a feature, not a bug.
**Target phase:** Only if teacher feedback shows confusion.

**What it adds:** If a student writes "Maya" as test user in User Profile, the Product Brief's audience-adjacent field auto-populates. Or the Success Criteria's "who watches" auto-pulls from User Profile.

**Why deferred:** Brief recommends NOT doing this — the user might evolve between when you wrote the brief and when you tested, and the duplication forces re-thinking. Wait for evidence that students find it confusing.

**Definition of done:**
- Decision: which fields sync, which stay independent
- Sync direction (User Profile → Product Brief? or both ways?)
- Conflict-resolution UX (student picks which to keep)

---

## FU-PSV2-V1-DEPRECATION — Drop v1 project-spec block + table after 90 days
**Surfaced:** 11 May 2026 (brief §12.8).
**Severity:** 🟢 LOW — coexistence cost is small.
**Target phase:** ~90 days after zero new v1 inserts.

**What it adds:** Removes the v1 "Project Spec" BlockPalette entry, deletes `ProjectSpecResponse.tsx` + `/api/student/project-spec/route.ts`, then a final migration drops the `student_unit_project_specs` table.

**Why deferred:** Existing v1 submissions (e.g. Scott's spec from the pilot) need to remain readable in marking until they're either archived or migrated. Sequencing:

1. Monitor inserts on `student_unit_project_specs` for 90 days post-v2 ship
2. ~~If zero new inserts, hide the v1 BlockPalette entry (visible only in legacy lessons)~~ ✅ **DONE 12 May 2026** — Matt called for early hide to avoid teacher confusion between v1 and v2 Product Brief. Palette entry removed in `BlockPalette.tsx`; v1 component / API / table all still running for any lessons that already have a v1 block placed. Step 1's 90-day monitoring still in effect to inform step 3.
3. After teacher confirms all v1 specs are archived / addressed, drop the table

**Definition of done:**
- ~~Palette entry hidden~~ ✅ done early
- 90-day monitoring period elapsed
- Decision: archive v1 specs to a frozen table or hard-delete
- Migration dropping v1 table + safety guard
- v1 component + route deleted; ResponseType union pruned

---

## FU-PSV2-ARCHETYPES-3-6 — Film / App / Fashion / Event-Service archetypes
**Surfaced:** 11 May 2026 (brief §3 — carries forward from v1's FU-PSB-ARCHETYPES-3-6).
**Severity:** 🟢 LOW — only matters when units beyond Toy / Architecture want them.
**Target phase:** When Matt sets up a unit needing one of these archetypes.

**What it adds:** Four new archetype definitions in:
- `src/lib/project-spec/archetypes.ts` (v1 7-slot defs — for legacy compat)
- `src/lib/project-spec/product-brief.ts` (v2 9-slot defs)

IDs (already stable, brief §10 — defer):
- `film-video`
- `app-digital-tool`
- `fashion-wearable`
- `event-service-performance`

**Why deferred:** Tomorrow's G9 lesson only uses Toy + Architecture. Other 4 are dead weight for v1 + v2.0. Slot copy exists in the original brief; takes ~30 min × 4 to type out + verify.

**Definition of done:**
- v1: 4 new ArchetypeDefinitions in `archetypes.ts`
- v2 Product Brief: 4 new ProductBriefArchetype entries in `product-brief.ts`
- Pickers automatically expand (no UI work)
- Existing student rows continue to load (archetype_id values unchanged)

---

## FU-PSV2-ARCHETYPE-VERSIONING — Version bump strategy when copy changes
**Surfaced:** 11 May 2026 (brief §3 — carries from v1's FU-PSB-ARCHETYPE-VERSIONING).
**Severity:** 🟢 LOW — only bites once specs accumulate.
**Target phase:** Once cohort 2 of a class submits specs.

**What it adds:** When an archetype's slot copy is edited *after* students have submitted briefs, decide whether:
- Existing briefs stay anchored to old copy (snapshot at submission time)
- Re-render with new copy (live deref — current behaviour)
- Migrate explicitly

**Why deferred:** No cohort 2 yet. Current live-deref behaviour is fine for typo fixes; problematic for semantic changes.

**Definition of done:**
- Decision logged in `decisions-log.md`
- If snapshot: add `archetype_version` column or snapshot JSONB column on each v2 table
- Document the migration path for in-flight briefs

---

## FU-PSV2-TEACHER-VIEW-ACCESS-V2 — Teacher RLS via class_members
**Surfaced:** 11 May 2026 (carries from v1's FU-PSB-TEACHER-VIEW).
**Severity:** 🟡 MEDIUM — affects co-teacher visibility on all 4 blocks.
**Target phase:** When co-teachers join Matt's classes.

**What it adds:** Current teacher SELECT RLS on v1 + v2 tables uses `classes.teacher_id` direct match (mirrors AG.2.1 kanban). Misses co-teachers, dept heads, platform admins under the Access Model v2 pattern (`class_members` + `can()` helper, shipped 9 May 2026).

**Why deferred:** Matt's pilot has a single teacher. Closing this for ALL 4 tables + AG.2.1 kanban + AG.3.1 timeline is a coordinated fix (Lesson #39 pattern audit).

**Definition of done:**
- One migration replacing `c.teacher_id = auth.uid()` with `class_members` join (or `can()` helper call) across:
  - `student_unit_project_specs`
  - `student_unit_product_briefs`
  - `student_unit_user_profiles`
  - `student_unit_success_criteria`
  - (also AG.2.1 kanban + AG.3.1 timeline at the same time)
- RLS coverage test confirming co-teacher visibility

---

## Resolved

_v2 ship complete — all Phase A → F shipped 11-12 May 2026._
