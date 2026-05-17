# Platform Follow-up Tickets

> Cross-cutting platform items that don't belong to a single project
> tracker. Things that touch many block types, span teacher + student
> surfaces, or sit between systems. New items land here when they're
> surfaced during a project build but the scope is wider than that
> project.

---

## FU-PLATFORM-BRIEF-AND-CONSTRAINTS-SURFACE — Always-visible Brief & Constraints with archetype-driven shape
**Surfaced:** 12 May 2026, post-saveme conversation about the "buried by week 4" problem.
**Severity:** 🟡 MEDIUM — addresses a real classroom pain (students forget the brief after week 1) but defer until post-class observation confirms the shape.
**Target phase:** After running G8 + G9 classes through the current Project Spec v2 surface. Decide based on whether students actually re-reference or just forget.

**The problem being solved:**
Teachers write a design brief + constraints once at unit start. Students look at it in week 1, then forget. By week 4, the brief is buried in a lesson 3 weeks behind. Oral corrections ("remember the brief says no batteries") become the de facto reference. PPT / doc / activity-block-in-lesson-1 all reproduce this pattern.

**Proposed shape (three layers, one source):**
1. **Unit-level Brief & Constraints entity** (the SOURCE)
   - New table `student_unit_briefs` OR new column on `units` — decision deferred.
   - Archetype-driven like Product Brief: Design (dimensions, materials whitelist, budget, audience, must-include, must-avoid), Service (scope, target community, resources, timeline, ethical guardrails), Inquiry (research questions, source bar, scope, ethics).
   - One narrative-prose field for the brief itself + structured fields for constraints.
   - Edited once in the unit editor.
2. **Always-visible student chip** (the RE-REFERENCE surface)
   - Persistent "📋 Brief" button in the student unit nav header.
   - One click → modal/drawer with brief + constraints.
   - Available from every page in the unit (lessons, discovery, marking, gallery).
3. **Optional "Brief Reminder" activity block** (the TEACHER nudge)
   - Reads from the unit-level source at render time — does NOT copy data (per Lesson #86, loose coupling).
   - Optional "Why this matters today" teacher note field.
   - Drop into any lesson for mid-unit reinforcement.

**Architecture decisions to make BEFORE building:**
- Path 1 (new top-level entity) vs Path 2 (extend `units` with `brief_text` + `brief_constraints` JSONB). Lean Path 1 — JSONB-on-units gets messy across Design/Service/Inquiry, but Path 2 ships in a day.
- Should the chip badge when teacher edits the brief mid-unit? Subtle "brief updated" cue, or silent?
- Does a student opening the modal count as a tracked event (for "did they re-read it?" signal)?

**What NOT to build:**
- Don't make the activity block the primary surface.
- Don't sync edits TO the activity block — read at render time.
- Don't ship per-lesson constraint overrides. One brief per unit. Resist the customisation instinct — same energy as `FU-PLATFORM-CHOICE-CARDS-DOWNSTREAM-CASCADE`.

**Why deferred:**
Worth observing real classroom behaviour first. Maybe just TELLING students where the brief lives (and adding the chip without the activity-block reminder + badge logic) is enough. Maybe constraints rarely get edited mid-unit and the badge is overbuild. Real classroom signal before scope creep.

**Sizing:** ~2-3 days for the minimum-viable version (Path 1, chip only, no activity block, no badge). ~4-5 days for the full three-layer version.

---

## FU-BRIEFS-STUDENT-POST-LOCK-ENFORCEMENT — Enforce field locks server-side on student brief write
**Surfaced:** 15 May 2026, during Phase F.F verification sweep (sections 5 + 7 of the saveme audit checklist).
**Severity:** 🟡 MEDIUM — defence-in-depth gap, not an active exploit path in v1 (pilot students are trusted; the UI gates correctly).
**Target phase:** Quiet afternoon, or next time the briefs surface is opened. Pairs naturally with FU-BRIEFS-AUDIT-COVERAGE.

**The problem:**
`POST /api/student/unit-brief` validates the `constraints` payload via `validateConstraints` but does NOT check whether each field the student is overriding is actually unlocked. The UI (`BriefDrawer`) only renders editable inputs for unlocked fields, so well-behaved clients never POST a locked field — but a crafted request bypasses the UI entirely.

Concretely: if `unit_briefs.locks` (or the picked `choice_cards.brief_locks`) has `"constraints.budget": true`, the server accepts a student POST with `constraints.data.budget = "free"` and persists it to `student_briefs`. The teacher's lock is then meaningless for any student who reads the route docs and sends a POST directly.

**Why it's defence-in-depth and not a P1 leak:**
- No PII exposure. The student is overriding their OWN brief override row.
- No cross-tenant leak. The override sits in `student_briefs.brief_text/constraints` for that one student-unit pair.
- The teacher review tab (`/api/teacher/unit-brief/student-briefs`) reads back the overridden values, so a teacher who actually looks at the tab will see the bypass. That's the social check in v1.
- The render layer (BriefDrawer 3-source merge) still honours the teacher's locks, so other students see the teacher's value, not the bypass.

**The fix when this lands:**
1. In `POST` handler: fetch the unit's `locks` + (if student has a card pick) the card's `brief_locks` before merging.
2. Compute the effective locks via the same precedence as `computeEffectiveBrief` (card wins entirely if card has template, else unit locks).
3. For each path-key in `LOCKABLE_FIELDS`: if locked AND patch attempts to set that path, return 403 with `error: "field X is locked by teacher"`.
4. Add source-static test asserting the lock-check exists in the route.
5. Add integration test: POST a locked field → expect 403.

Estimated work: ~1 hour. The 3-source merge helper already exists in `src/lib/unit-brief/effective.ts` — most of the lift is teaching it to take "which patch keys are being written" and answering "are any of them locked?"

**Pairs with:** FU-BRIEFS-AUDIT-COVERAGE — both gaps live in the same student POST route. Land them in one PR.

---

## FU-BRIEFS-AUDIT-COVERAGE — Wire logAuditEvent into the teacher unit-brief routes
**Surfaced:** 13 May 2026, during Unit Briefs Foundation Phase B.4 audit-coverage scanner gate.
**Severity:** 🟢 P3 — defensive logging, no security gap. Same audit-sensitivity class as `/api/teacher/product-brief-pitch` which is also currently audit-skipped.
**Target phase:** Next audit-tightening sweep that touches teacher-content-authoring routes (alongside the product-brief-pitch retrofit).

**The problem:**
Two POST routes shipped audit-skipped in Phase B.1:
- `POST /api/teacher/unit-brief` — partial-patch upsert of the brief + constraints
- `POST /api/teacher/unit-brief/amendments` — append a new amendment

Both are teacher-authored pedagogical content (no PII, no cross-tenant reads). Author-only writes are already gated by `verifyTeacherHasUnit.isAuthor`. The risk surface is "did the author definitely make this change?" — which Supabase row history can answer in the meantime.

**What to do when this fires:**
Replace the `// audit-skip:` headers with `logAuditEvent("unit_brief.updated", { teacherId, unitId, fields: Object.keys(patch) })` after the successful upsert, and `logAuditEvent("unit_brief_amendment.added", { teacherId, unitId, amendmentId, versionLabel })` after the successful insert. The scanner will move both routes from `missing` → `covered` automatically.

**Pairs with:** `/api/teacher/product-brief-pitch` retrofit — same shape of fix, same audit-class.

---

## FU-PLATFORM-BLOCK-USAGE-HISTORY — Per-teacher + per-student block usage analytics
**Surfaced:** 12 May 2026, post-Project-Spec-v2 ship.
**Severity:** 🟡 MEDIUM — small build, real value for teacher self-reflection + onboarding hints.
**Target phase:** A quiet afternoon when Matt wants a "what blocks am I using?" dashboard widget.

**What it adds:**
- **Teacher dashboard widget** — counts of each `responseType` / block id across the teacher's authored units this term. Bar chart, top 5 most-used, "you haven't tried these" prompt for ≤2 blocks. Optional: peer comparison ("classes like yours use X more often") when enough cohorts exist.
- **Student insights row** — per-student "your activity types" — counts of completed activities per `responseType`. Self-reflection signal ("I always reach for written response, never for the kanban").

**Why it's cheap:**
- No new tables. Teacher counts derived from a query over `units.content_data` JSONB grouped by `teacher_id`. Student counts derived from `student_progress.responses` keys grouped by tile_id → activity_id → responseType.
- One dashboard component + one (or two) API routes.

**Why it's valuable:**
- Surfaces unused blocks in the BlockPalette — students of teachers who only use 3 blocks are missing 25+ palette options. Helps Matt (and future onboarding) discover what's available.
- Gives students a "diet of cognitive activities" view — useful for the eventual NM Agency mapping (kanban use, journal use, reflective work).
- Cheap pilot for the "Block telemetry" concept that could later feed Discovery Engine personalisation.

**Definition of done:**
- New API route `/api/teacher/dashboard/block-usage` returning aggregated counts
- New API route `/api/student/insights/block-usage` returning per-student counts
- Dashboard widget in teacher dashboard (Bold v2)
- Insights row added to student insights page
- Bar chart + top 5 + "haven't tried" prompt
- No new tables; pure aggregation over existing data

**Sizing:** ~1 day.

---

## FU-PLATFORM-UNIFIED-GALLERY-PROMOTION — Single "Promote to Class Gallery" action for any block
**Surfaced:** 12 May 2026, post-Project-Spec-v2 ship.
**Severity:** 🔵 P1 — net-new capability that unlocks per-block reuse + cohort-to-cohort knowledge transfer.
**Target phase:** Post-pilot, deserves a build brief like the v2 split got.

**What it adds:**
- One unified action surface in the marking detail pane (and Open Studio submission view) — "Promote to Class Gallery" — works regardless of which block type the student submitted.
- Promoted items appear in the Class Gallery with a block-type-appropriate render (a Project Spec renders differently from a kanban board; both are valid gallery artifacts).
- Per-block consent flow — student must approve "your teacher wants to share this" before the work appears in the gallery for peers.

**Why this is a real project, not a small fix:**
- Each block type produces a different output shape (text / image / kanban state / project spec JSONB / decision matrix / SCAMPER triplets / structured-prompts / …). The gallery needs a **render strategy per block type**.
- **Privacy gating is non-trivial.** A User Profile slot 7 photo of a real 8-year-old needs explicit per-photo consent before being shared with the rest of the class. So does a quote about that user. Current Class Gallery code doesn't track per-photo consent.
- Promotion needs to be reversible (teacher can unpromote; student can withdraw consent).

**What it needs:**
- New table `class_gallery_promotions` (or extend existing gallery table) storing:
  - `student_id`, `unit_id`, `tile_id` (or activity ref), `block_type`
  - `rendered_payload JSONB` — frozen at promotion time so future archetype/slot copy changes don't break gallery rendering
  - `consent_status` (`pending` | `approved` | `withdrawn` | `denied`)
  - `promoted_by_teacher` (teacher_id), `promoted_at`
  - `featured BOOLEAN DEFAULT false` for teacher highlight
- Block-to-gallery renderer registry — `src/lib/gallery/renderers/{project-spec, product-brief, user-profile, success-criteria, kanban, structured-prompts, …}` — each module knows how to format that block's output for gallery display.
- Marking detail pane gets a "Promote" button on any tile.
- Student consent flow — notification on student dashboard, approve/decline, then gallery publishes.
- Gallery UI updates to display promoted items alongside existing types, grouped by block type or chronologically.

**Definition of done:**
- Migration creating `class_gallery_promotions` table + RLS
- 6-8 block renderer modules (one per shipped block type)
- "Promote" button on marking + Open Studio submission views
- Student-side consent inbox + approval flow
- Gallery UI surfaces promoted items
- Tests: a teacher can promote any block, student receives + approves the consent prompt, item appears in gallery
- Build brief authored before code starts (Matt's checkpoint pattern)

**Sizing:** ~1–2 weeks. Spec → schema → renderer registry → consent flow → marking + gallery UI.

**Why it's high value:**
- Class Gallery becomes a real cohort-to-cohort knowledge transfer layer. Year 9 cohort 2026 sees what year 9 cohort 2025 built.
- User Profile work especially valuable across cohorts — empathy research compounds.
- Unlocks the Discovery Engine's "show me what other students did" pattern at scale.
- Gives a unified "share my work" pattern across all blocks, simplifying the student mental model.

---

## FU-PLATFORM-PRIVACY-ANONYMISER — Teacher-toggleable student input anonymiser
**Surfaced:** 12 May 2026, post-User-Profile-image-upload ship.
**Severity:** 🔵 P1 — high value, not blocking. Concrete differentiator for school-pitch security story.
**Target phase:** When a school asks for it OR when Matt has a focused sprint for Phase 1.

**Vision:** A class-level (or unit-level) toggle a teacher can flip — "anonymise student input". Once on, all incoming student text + uploads get scanned and PII gets stripped or replaced. If the database leaks, no one finds out a student lives at X address with Y people and likes going to XYZ Plaza on Friday nights.

Visual design idea (Matt): anonymised tokens render in a different colour so the student knows their content was modified, with a tooltip explaining the policy. Same for the teacher's view (with optional "show raw" requiring an audit-log entry).

**Why now is the right time to start the journey:**
- Real differentiator for the school-pitch security checklist (currently the security-overview.md doesn't have a privacy-by-design story this strong)
- GDPR Article 25 ("data protection by design") gets a tick
- China PIPL effectively requires data minimisation for kids — Matt is in Nanjing pitching to international schools
- Australian Privacy Act treats this as best practice
- The trigger event for one school will likely be a parent objection — better to have a credible story BEFORE that conversation

### Phase 1 — Regex-based redaction (~2–3 days, shippable in a focused sprint)
Catches the obvious PII surface area:
- Phone numbers (US / CN already in `client-filter.ts`, extend with UK / AU / EU)
- Email addresses (already)
- Add: street addresses, postal codes, ID numbers, dates of birth, credit-card-shaped strings
- Class-level toggle: new column `classes.privacy_mode: 'standard' | 'anonymise'`
- Server-side scrub on write to `student_progress.responses` + the per-block tables (project_specs, product_briefs, user_profiles, success_criteria — and any future block storage)
- Store BOTH raw + anonymised. Raw goes to a restricted column (or a separate table) with audit-log on read access
- Student sees anonymised version with subtle italic + muted colour styling + tooltip "Anonymised by school policy"
- Teacher sees anonymised by default; "show raw" button creates an audit-log entry

Solves ~70% of the risk with ~20% of the work. Catches addresses + phones + emails which are the highest-risk leak surfaces.

### Phase 2 — AI-assisted entity scrubbing (~1–2 weeks)
Regex can't catch contextual PII. "I go to XYZ Plaza on Friday nights" is dangerous because of the *combination* of place + schedule + first-person, not any single token.

- Claude pass via `callAnthropicMessages` on every save: "Scrub this text for names of real people, specific places + their schedules, identifying institutions. Return the anonymised version with [REDACTED] markers and a structured list of what was changed (for the diff highlighting)."
- Cache by content hash so re-reads are free
- Falls back to Phase 1 patterns if AI is unavailable / over-budget
- Cost: ~$0.001 per save (input + output token counts modest)
- Latency: adds ~1s to save. UI shows "Saving… anonymising…" spinner
- New `ai-call-sites.yaml` entry under `student/privacy/anonymise`
- Need a per-class AI budget guard (`withAIBudget`) so a runaway moderation pass can't blow through the budget

### Phase 3 — Image PII (~1–2 months, real project)
Most uploads won't have PII; the ones that do are catastrophic.
- Face detection + blur (MediaPipe runs server-side, free; or AWS Rekognition / Google Vision for richer features)
- OCR scan for handwritten PII (student writes address on a sketch + uploads)
- Background scene recognition (school signs, street signs, recognizable landmarks) — much harder, lower priority
- Toggleable per class (or sub-toggleable: faces yes, OCR yes, scenes no)

### Out of scope (file as nested FUs if Phase 3 ships)
- Re-personalisation (student sees own raw text on edit; teacher sees anonymised on read) — round-trip complexity
- Full school-level configuration UI with governance dashboard — needs proper product design
- Anonymising AI mentor responses too (Claude sometimes echoes student PII back at them)

### Policy questions to settle BEFORE building (not just engineering)
1. **Threat model.** Database leak only? Or also "teacher can't be fully trusted with raw text"? The latter is much more aggressive — changes the access control fundamentally.
2. **Raw retention.** Forever (with audit log on read)? N days post-save? Auto-purge on student graduation? Never store raw at all (one-way scrub)?
3. **Who turns it on?** Teacher per-class? School admin policy? Platform default for everyone (Matt's pilot)?
4. **What happens to existing pre-toggle data?** Bulk-anonymise on toggle? Leave historical raw? Both with a cutover date?
5. **Diff visibility.** Always show what was changed (transparency) or only on a "show diff" toggle (cleaner UI)?

### Definition of done (Phase 1)
- Migration: `classes.privacy_mode` column + class-settings UI to toggle
- New `src/lib/privacy/anonymise.ts` with the regex-pass + diff tracking
- Server-side scrub hook applied on write to `student_progress.responses` + the 4 per-block project-spec tables (project_specs / product_briefs / user_profiles / success_criteria)
- Raw + anonymised stored separately; raw column access audited
- Student-side rendering: anonymised tokens with subtle styling + tooltip
- Teacher-side rendering: anonymised by default + "show raw" with audit-log entry
- New `privacy.show_raw_response` event_type in the audit log
- `security-overview.md` updated with the privacy-by-design story
- New entry in `data-classification-taxonomy.md` for the raw column

### Definition of done (Phase 2 + 3)
Separate briefs when their turn comes.

### Related work
- `src/lib/content-safety/client-filter.ts` — current PII patterns (target for extension)
- `src/lib/security/student-name-placeholder.ts` — already restricts student names from LLM prompts; this would be the broader complement
- `docs/security/security-overview.md` — would gain a section
- The over-eager PII regex that caused FU-PSV2-IMAGE-URL-MODERATION-FALSE-POSITIVE is a related but different issue — that one is about NOT moderating system-generated content; this one is about explicitly transforming user content

---

## FU-PLATFORM-CUSTOM-PROJECT-PITCH — Real pitch-to-teacher workflow
**Surfaced:** 12 May 2026, while expanding Product Brief archetypes for Matt's G8 lesson.
**Severity:** 🔵 P1 — pedagogically meaningful, current "Other" archetype is a stop-gap.
**Target phase:** Post-pilot, build brief required.

**Context:** A student whose project doesn't fit any preset archetype currently has two paths:
1. Pick "Other / Pitch your own" in the Product Brief archetype picker → free-form slots, teacher reviews in marking (shipped 12 May)
2. Pick `_pitch-your-own` in a Choice Cards block (sentinel already exists in `src/lib/choice-cards/resolve-for-unit.ts`) → lands on the archetype picker, naturally chooses "Other"

Both routes work but neither is a *real* pitch workflow. The student just fills in the Product Brief with no formal teacher checkpoint, no proposal-vs-acceptance moment, no record of the negotiation.

**What this FU adds:** A proper proposal flow that mirrors real-world design practice (designer pitches → client/teacher approves → work begins).

**Proposed flow:**
1. Student picks "Pitch a custom project" (either in Choice Cards `_pitch-your-own` OR directly via a new button on the archetype picker)
2. Free-text proposal form — project idea + why it matters + what skills they want to build + how it'll be assessed
3. Submit → teacher gets a notification in their inbox (existing `/teacher/inbox` surface from tfl.3 C.1)
4. Teacher reviews → approves / requests revision / redirects to a preset archetype
5. On approval, student gets a tailored mini-archetype (auto-generated from the proposal) that scaffolds the Product Brief / User Profile / Success Criteria with proposal-specific copy
6. Audit trail of the proposal + teacher response + any revisions

**Why deferred:** This is its own meaningful build:
- New table `project_pitches` (or similar) storing proposal + teacher response + status
- New API routes for student submit + teacher review + approval
- Teacher inbox integration
- Auto-generated archetype scaffolding from approved proposal (could be AI-generated)
- Notification + state machine

**Sizing:** ~1–2 weeks (similar shape to the v2 Project Spec split brief). Deserves its own build brief.

**Related:**
- Open Studio v2 plan-approval pattern — closest precedent in the codebase
- Choice Cards `_pitch-your-own` sentinel — already partially wired
- The "Other / Pitch your own" archetype (shipped 12 May) is the v1 minimum that this FU promotes to a real workflow

**Definition of done:**
- Schema migration for `project_pitches`
- Student-side proposal form + submit flow
- Teacher inbox surfaces pending pitches alongside reply-drafts
- Teacher review UI with approve / revise / redirect actions
- Approved pitches generate a custom mini-archetype that populates Product Brief / User Profile / Success Criteria slot scaffolding (text + examples may come from a Claude call against the proposal)
- Audit log: every status transition
- Build brief authored before code (matches the v2 split brief pattern)

---

## FU-PLATFORM-CHOICE-CARDS-DOWNSTREAM-CASCADE — Soft warning IF re-pick mid-build bites
**Surfaced:** 12 May 2026, while shipping "Change my mind" on Choice Cards.
**Severity:** 🟢 LOW — Matt's instinct: keep the system loosely coupled, don't build a cascade.
**Target phase:** ONLY if Case 3 (re-pick after slot writes) bites in real classroom use.

**Architectural decision (12 May 2026, with Matt):** Do NOT build a cascade. The loose coupling between Choice Cards and downstream consumers (Product Brief / User Profile / Success Criteria) is the correct architecture — it makes adding new consumers cheap and avoids the complications Matt explicitly wanted to avoid ("i dont want to make things too dependent and start complicating the connections between things").

**Actual downstream coupling today (audited 12 May 2026):**
- **Product Brief**: pre-fills `archetype_id` as a *suggestion* in the GET handler (`src/app/api/student/product-brief/route.ts`) — in-memory only, not written to DB until student saves a slot. Pure read.
- **User Profile**: reads `from_choice_card` for the banner display only. No state mutation.
- **Success Criteria**: reads `from_choice_card` for the banner display only. No state mutation.

**Three cases for "student re-picks":**
1. **Re-pick BEFORE opening Product Brief**: new pick = new suggested archetype on next GET. Clean. (~95% of cases.)
2. **Re-pick AFTER opening Product Brief but BEFORE writing a slot**: same — next GET re-evaluates from the new pick. Clean.
3. **Re-pick AFTER writing slots in Product Brief**: slot data is saved against the *old* archetype's slot semantics. If the new archetype has different slot definitions (e.g., Toy slot 4 = materials chips vs Architecture slot 4 = scale number-pair), data is semantically off — not corrupted, just interpreted weirdly. **Rare.** Recoverable via 30-second teacher conversation.

**If Case 3 ever bites in real classroom use** (and only if), ship a small soft warning on the "Change my mind" button:

> "You've already started your Product Brief — changing your card might not match what you've written. Continue anyway?"

One-line UX, zero coupling, no event system. **Do NOT build:**
- A `setSelection(null)` cascade that emits events to downstream consumers
- An auto-clear of downstream state on re-pick
- Any subscription mechanism between Choice Cards and other blocks

**Definition of done (if triggered):**
- Add the soft warning modal/confirm before `setSelection(null)` fires
- Only show when there's evidence of downstream work (e.g., `student_unit_product_briefs` row with any slot_N non-null)
- No other changes

---

## FU-PR340-CLEANUP-WIDEN-SELECTS — Restore unit_type to canvas selects + drop anti-regression guard
**Surfaced:** 17 May 2026, during FU-PROD-MIGRATION-BACKLOG-AUDIT Round 2 close-out.
**Severity:** 🟢 LOW (P3) — cleanup of a temporary mitigation. Current state (narrow selects without `unit_type`) works fine; restoring the column would surface unit type in the canvas surfaces that originally needed it (ChangeUnitModal + Past units sub-route).
**Target phase:** Standalone PR — ~30 min when next touching the canvas pages.

**Background:** PR [#340](https://github.com/mattburto-spec/studioloom/pull/340) (commit `56b18204`) narrowed two `units(...)` selects to omit `unit_type` after the column was discovered missing from prod (Round 2 trigger). Migration `051_unit_type` has now been applied to prod (17 May 2026, this audit's apply phase), so the narrow-select mitigation is no longer needed.

**Definition of done:**
- Widen the `units(...)` selects in [src/app/teacher/classes/[classId]/units/page.tsx](../../src/app/teacher/classes/%5BclassId%5D/units/page.tsx) and [src/components/teacher/class-hub/ChangeUnitModal.tsx](../../src/components/teacher/class-hub/ChangeUnitModal.tsx) back to include `unit_type` (and `is_published` if it was also narrowed — verify).
- Delete the anti-regression describe block at [src/app/teacher/units/\_\_tests\_\_/dt-canvas-shape.test.ts:437](../../src/app/teacher/units/__tests__/dt-canvas-shape.test.ts) (`describe("DT canvas — prod migration drift anti-regression (FU-PROD-MIGRATION-BACKLOG-AUDIT)", ...)`).
- Update the stale test description at [dt-canvas-shape.test.ts:696](../../src/app/teacher/units/__tests__/dt-canvas-shape.test.ts) (the regex doesn't validate the column list, so cosmetic only — but worth fixing while you're in the file).
- Run `npm test` and confirm no regressions.
- Smoke-test the canvas surfaces locally: ChangeUnitModal should render unit types in any visible unit metadata; Past units page should display unit type if used in the UI.

**Why P3 not P2:** the platform works fine without unit_type in those two selects. The cleanup is about restoring intentional behaviour (the column was added to be queryable), not closing a hazard.

---

## Resolved

### FU-AUDIT-3DIGIT-001-044-SWEEP — Probe foundational 3-digit migrations not covered by Round 2 (initial)
**Surfaced:** 17 May 2026, during FU-PROD-MIGRATION-BACKLOG-AUDIT Round 2 close-out.
**Resolved:** 17 May 2026 (same session, scope expanded to all 71 unprobed migrations).
**Severity at close:** 🟢 LOW (P3)

**Original ask:** Probe the 44 foundational 3-digit migrations (`001`–`044`) not covered by Round 2's expand pack, plus 27 others in the `045`–`119` range that were `assumed applied` rather than `verified via probe`.

**Method:** Built a single 71-probe `UNION ALL` SQL block (`/tmp/audit-sweep-3digit.sql`) with one distinctive artifact per migration, read directly from each migration body per Lesson #93.

**Findings:**
- **68 / 71 returned `applied=true` on first pass.** All probed-and-confirmed migrations had their `applied_migrations.notes` upgraded from `assumed applied` to `verified via Round 2 17 May 2026 audit sweep pack`.
- **3 returned `applied=false`** — triaged with corrective re-probes (Lesson #93 in action):
  - `084_fk_cascade_fixes_for_teacher_delete` — **probe bug.** I assumed `units.author_teacher_id` was `SET NULL`; the migration body actually sets it `CASCADE`. Re-probe confirmed migration applied correctly. Upgraded to verified.
  - `028_own_time` — **real absence, deprecated.** `own_time_approvals`, `own_time_projects`, `own_time_sessions` tables all confirmed missing on prod. Worktree CLAUDE.md flagged `own_time_*` as `deprecated; safe to delete` (FU-AA). Feature was superseded by Open Studio. **Migration added to `RETIRED_MIGRATIONS`** in `check-applied.sh`.
  - `118_machine_profiles_uniq_lab_scope` — **superseded.** Neither old (`uq_machine_profiles_teacher_name`) nor new (`uq_machine_profiles_teacher_lab_name`) index exists on prod. The deep probe found a third index `uq_machine_profiles_lab_name_active` (created by `20260428074205_machine_profiles_school_scoped.sql` on 28 Apr 2026, three days after 118 was authored on 25 Apr) which dropped 093's old index and created a school-scoped replacement. The school-scope shape `(lab_id, name) WHERE is_active AND NOT is_system_template` is the correct end-state; mig 118's per-teacher scope was abandoned in favor of school-scope. **Migration added to `RETIRED_MIGRATIONS`** with note explaining the supersession.

**How it shipped:**
- 69 `applied_migrations` rows upgraded `assumed applied` → `verified via sweep pack`. 2 rows DELETEd for the retired migrations.
- 2 entries appended to `check-applied.sh` `RETIRED_MIGRATIONS`: `028_own_time`, `118_machine_profiles_uniq_lab_scope`. Brings total retired to 6.
- CLAUDE.md "Migration discipline (v2)" section updated to reflect the new retired list + 100% verified status (114 verified-via-probe + 4 applied-this-session = 118 verified rows; 0 assumed remaining).

**Insight banked:** When two migrations evolve in parallel during the cutover window (3-digit `118` authored 25 Apr, timestamp `20260428074205` authored 28 Apr), the LATER one supersedes the earlier silently if no tracker exists. This was Lesson #83's structural source — the 11 May tracker now prevents this class going forward, but historical drift like 118 is only catchable via audits like this one.

**Sibling follow-up:** None new. The triage is complete.

---

### FU-CHECK-APPLIED-3DIGIT-SCOPE — Extend check-applied.sh to cover 3-digit migrations
**Surfaced:** 17 May 2026, during FU-PROD-MIGRATION-BACKLOG-AUDIT Round 2 close-out.
**Resolved:** 17 May 2026 (same session, ~30 min later — Matt picked option A on the close-out decision).
**Severity at close:** 🟠 MEDIUM (P2)

**The gap (closed):** [`scripts/migrations/check-applied.sh`](../../scripts/migrations/check-applied.sh) was filtering with `awk '$0 >= "20260401"'`, which excluded every 3-digit migration (`001`–`123`). The 11 May audit's scope decision baked this in on the *assumed*-applied premise. The 17 May audit Round 2 proved the assumption wrong — `051`, `080`, `081`, `082` were all in the repo + schema-registry but not on prod.

**How it shipped:**
- Dropped the `awk '>= 20260401'` filter from `check-applied.sh`. Now every migration (3-digit + timestamp) is in scope.
- Added 2 new entries to `RETIRED_MIGRATIONS` in the script: `121_student_progress_autonomy_level` (local-dev only) + `122_drop_student_progress_autonomy_level` (paired rollback). Brings retired count to 4.
- Backfilled `public.applied_migrations` with 116 rows for 3-digit migrations not already in the tracker: 45 `verified via Round 2 17 May 2026 audit probe pack` + 71 `assumed applied; subject to FU-AUDIT-3DIGIT-001-044-SWEEP for future verification`. Idempotent INSERT via `ON CONFLICT (name) DO NOTHING`.
- Verified: post-backfill drift query returns 0 rows missing across all 225 in-scope migrations (4 retired excluded).
- Updated CLAUDE.md "Migration discipline (v2 — timestamp prefixes + applied_migrations tracker)" section to document the wider scope + the 2 new retired entries.

**Net effect:** every future `saveme` step 11(h) catches a missing apply on ANY migration in the repo (3-digit or timestamp), within ~30 seconds of the saveme run. Today's `unit_type` bug class can no longer recur silently.

**Backfill SQL preserved at:** `/tmp/audit-3digit-backfill.sql` (artifact only — applied successfully and idempotent if re-run).

---

### FU-BRIEFS-STUDENT-SELF-AUTHORED — Student-authored brief fallback when teacher hasn't set one
**Surfaced:** 13 May 2026, during Unit Briefs Foundation pre-flight (sparked by David Epstein's "constraints as creative engine" framing arriving in Matt's inbox same morning).
**Resolved:** 15 May 2026 in Unit Briefs Phase F (10-PR arc spanning A through F.F).

**Original ask:** Students with no teacher brief have no surface to author their own constraints, which matters for self-directed work (Open Studio, choice-cards "pitch your own", student-led inquiry).

**How it shipped:**
- Migration `20260514221522_briefs_phase_f_locks_and_student_briefs.sql` created `public.student_briefs` table with the exact shape proposed: `(id, student_id, unit_id, brief_text, constraints JSONB, diagram_url, created_at, updated_at)` + UNIQUE(student_id, unit_id) + RLS teacher-read policy + 2 indexes + updated_at trigger.
- Schema reused the v1 `UnitBriefConstraints` discriminated union from `src/types/unit-brief.ts` exactly as proposed.
- **More than the original ask:** Phase F unified THREE patterns through the same student_briefs path: (1) class-shared (teacher unit_brief), (2) choice-driven (G8 case — choice card brief_text/brief_constraints/brief_locks), (3) per-student authoring (pitch-your-own + future Discovery Engine). All three render through one unified `BriefDrawer` via the new `computeEffectiveBrief` 3-source merge function (locks: card>unit; value: student>card>teacher>empty).
- **Activity block deferred** — instead of a dedicated `student_brief_editor` activity block, student authoring is integrated directly into the always-on `BriefDrawer`. Locked fields render read-only, unlocked fields render editable inputs in-place. Simpler UX (Lesson #44) — students author where they consult the brief.
- Plus AI assist (Haiku tool-use `propose_brief`), teacher Student-briefs review tab, and lock-all/open-all bulk actions.

**PRs:** #284 (F.A schema + F.B locks UI), #286 (F.C choice-card templates + validators), #291 (coerce-on-read hotfix → Lesson #91), #294 (F.D student authoring + drawer merge), #299 (F.E teacher review tab), #302 (polish), #306 (AI assist), F.F (this PR).

**Sister followups still open:** FU-BRIEFS-AUDIT-COVERAGE (P3 — 5 audit-skipped POST routes need logAuditEvent), FU-BRIEFS-SERVICE-INQUIRY-ARCHETYPES (P3 — Service/Inquiry/PP constraints beyond generic fallback), FU-BRIEFS-CO-TEACHER-READ-POLICY (P3 future — when Access Model v2 lands), FU-BRIEFS-STUDENT-DIAGRAM-UPLOAD (P3 — column reserved, no UI yet).
