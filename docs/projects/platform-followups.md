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

## Resolved

_None yet._
