# Project Spec Block — Follow-up Tickets

> Deferred items surfaced during the v1 build (11 May 2026). v1 ships
> tomorrow (12 May 2026) for Matt's G9 design class — first time the
> class opens StudioLoom. Scope was deliberately scaled back from the
> original brief; this tracker captures everything cut for v1.

---

## FU-PSB-MENTOR-SHARPEN — Q8 sharpening question via Haiku
**Surfaced:** 11 May 2026 (v1 build).
**Severity:** 🟡 MEDIUM — promised in the original brief.
**Target phase:** v2.

**What it adds:** After the student completes all 7 slots, a "Sharpen my
spec" button calls Haiku 4.5 with the full spec payload + archetype
context. Returns ONE pointed follow-up question (e.g. "Your test user is
your 8-year-old sister Maya — what's one thing that would make this fail
for her specifically?"). Single round, no chat.

**Why deferred:** v1 ships without any AI calls. Keeps `ai-call-sites.yaml`
clean and avoids `callAnthropicMessages` integration on the critical
path. The mentor button is intentionally NOT rendered in v1 (no
placeholder, no tooltip — just absent) to keep the UI honest.

**Definition of done:**
- New entry in `ai-call-sites.yaml` (endpoint `student/project-spec/sharpen`)
- New API route `/api/student/project-spec/[unitId]/sharpen` using
  `callAnthropicMessages` per the `src/lib/ai/call.ts` chokepoint
- Effort-gate: enabled only when ≥5 of 7 slots are answered AND none of
  those are skipped
- One-shot exchange — render the question inline, no chat history

---

## FU-PSB-TEACHER-VIEW — Teacher RLS via Access Model v2
**Surfaced:** 11 May 2026 (v1 build).
**Severity:** 🟡 MEDIUM — blocks teacher visibility into student specs.
**Target phase:** When teacher needs to see student specs on dashboard.

**What it adds:** Currently RLS gives teachers SELECT via direct
`classes.teacher_id` ownership through `class_units`. This misses
co-teachers, dept heads, and platform admins under the Access Model v2
pattern (`class_members` + `can()` helper, shipped 9 May 2026).

**Why deferred:** v1 has no teacher-side UI for project specs. The RLS
mirrored the AG.2.1 kanban precedent exactly — which has the same gap.
Closing this needs to happen for both tables at once.

**Definition of done:**
- Replace the `c.teacher_id = auth.uid()` check with `class_members` join
- Verify same fix lands on `student_unit_kanban` and
  `student_unit_timeline` policies (pattern bug — Lesson #39)
- Add RLS coverage test (or smoke check) confirming co-teacher visibility

---

## FU-PSB-KANBAN-SEED — Auto-seed kanban cards from slots 4 + 6
**Surfaced:** 11 May 2026 (v1 build).
**Severity:** 🟡 MEDIUM — improves student transition from spec → execution.
**Target phase:** When kanban is reliably part of the unit flow.

**What it adds:** When student completes the project spec, automatically
INSERT two cards into `student_unit_kanban.cards`:
- "Source [primary material]" — from slot 4 chip-picker value
- "Confirm [name] for L12" — from slot 6 test-user value

Cards in `backlog` column, source = `"project_spec_seed"` (new value on
`CARD_SOURCES` enum), `dod: null`, `createdAt: now()`.

**Why deferred:** Requires bumping `CARD_SOURCES` enum
(`src/lib/unit-tools/kanban/types.ts`), updating reducer + validators +
dashboard rotation logic. Tomorrow's lesson doesn't critically need
seeded cards — student can manually add them, and the original brief
listed it as Phase 5.

**Definition of done:**
- Bump `CARD_SOURCES` to `["manual", "journal_next", "project_spec_seed"]`
- Audit all `CARD_SOURCES` usage sites (Lesson #39 pattern audit)
- POST handler at `/api/student/project-spec` calls a kanban-seed helper
  when `completed: true` is set
- Idempotent — re-completing the spec doesn't double-seed
- E2E smoke: complete spec → check kanban has 2 new backlog cards

---

## FU-PSB-TIMELINE-ENDPOINT — Slot 7 as L14 anchor milestone
**Surfaced:** 11 May 2026 (v1 build).
**Severity:** 🟡 MEDIUM — closes the spec → timeline loop.
**Target phase:** When timeline is reliably part of the unit flow.

**What it adds:** When student completes the project spec, automatically
INSERT a milestone into `student_unit_timeline.milestones`:
- `label: "Success: [slot 7 value]"`
- `targetDate: unit's last lesson date` (or null if unknown)
- `isAnchor: true`
- `order: max(existing milestones.order) + 1`

**Why deferred:** Same as FU-PSB-KANBAN-SEED — completing the spec
should drive both surfaces. Timeline integration also needs to consider
whether the success criterion should be a milestone or a new column on
`student_unit_timeline` (no `successCriterion` field exists today).

**Definition of done:**
- Pick storage strategy: anchor milestone vs new column (Risk A from the
  pre-flight report — recommend anchor milestone)
- POST handler calls timeline-seed helper on `completed: true`
- Idempotent — re-completing doesn't duplicate the anchor

---

## FU-PSB-ARCHETYPES-3-6 — Film / App / Fashion / Event-Service archetypes
**Surfaced:** 11 May 2026 (v1 build).
**Severity:** 🟢 LOW — only matters when units beyond tomorrow's want them.
**Target phase:** When Matt sets up a unit needing one of these archetypes.

**What it adds:** Four more archetype definitions in
`src/lib/project-spec/archetypes.ts`, with full slot copy already
authored in the original brief. IDs already stable:
- `film-video`
- `app-digital-tool`
- `fashion-wearable`
- `event-service-performance`

**Why deferred:** Tomorrow's G9 lesson only uses Toy + Architecture.
Other 4 are dead weight for v1 — risk surface without payoff. Slot copy
exists in the brief; takes ~30 min to type out + verify.

**Definition of done:**
- Add 4 archetype definitions, matching the SlotDefinition shape used
  by Toy + Architecture
- Add `generic_words_boost` per the brief once FU-PSB-GENERIC-WORDS lands
- Verify the picker renders all 6 chips without overflow on mobile

---

## FU-PSB-GENERIC-WORDS — Generic-word nudge detector
**Surfaced:** 11 May 2026 (v1 build).
**Severity:** 🟢 LOW — quality-of-life, not a blocker.
**Target phase:** Once FU-PSB-ARCHETYPES-3-6 lands (uses per-archetype boost).

**What it adds:** Detect generic words in text answers and surface an
amber nudge ("What kind of fun? Be specific."). Base list:
`["fun", "cool", "nice", "good", "amazing", "awesome", "interesting",
"relax", "vibe", "feels"]` plus per-archetype `generic_words_boost`.

**Why deferred:** Cut from v1 because Matt flagged it as a stop trigger
risk ("triggers on Matt's own seeded strong examples during smoke = sign
the detector is over-eager"). Needs careful tuning + per-archetype
allow-lists for words that sound generic but ARE the right answer.

**Definition of done:**
- Detector lives in a pure function in `src/lib/project-spec/nudges.ts`
- Tested against all `examples.strong` from each archetype — must not
  trigger on any of them
- Renders below the input, never blocks submission

---

## FU-PSB-FREE-TEXT-Q0 — Replace chip Q0 with AI archetype classifier
**Surfaced:** 11 May 2026 (v1 build).
**Severity:** 🟢 LOW — only matters once archetypes 3-6 ship.
**Target phase:** Once Matt wants to use the block for general-purpose units.

**What it adds:** Replace the 2-chip (or 6-chip) Q0 picker with a single
free-text question ("What kind of thing are you making?") + an AI
classifier that maps the answer to one of the 6 archetype IDs. Falls
back to "Other" / manual archetype selection if confidence is low.

**Why deferred:** v1 G9 lesson uses chips. AI call adds cost +
`ai-call-sites.yaml` entry. Only valuable when there are enough
archetypes to make a 6-chip picker feel cumbersome.

**Definition of done:**
- New endpoint `/api/student/project-spec/classify` calling Haiku
- Confidence threshold for auto-pick (e.g. 0.85+) vs manual fallback
- Latency target: <3s p95

---

## FU-PSB-TEACHER-ARCHETYPE-EDITOR — Teacher dashboard to edit archetypes
**Surfaced:** 11 May 2026 (v1 build).
**Severity:** 🟢 LOW — Matt edits the TS file directly today.
**Target phase:** Far future — when StudioLoom has non-Matt teachers
authoring units.

**What it adds:** A teacher-side admin page (probably under
`/teacher/library` or `/admin/...`) showing the archetype catalog as
data, with edit / clone / version operations. Implies migrating
archetype definitions from TS source to a `project_archetypes` DB table
(deliberately cut in v1).

**Why deferred:** v1 has 1 teacher (Matt). Editing
`src/lib/project-spec/archetypes.ts` and shipping a PR is faster than
building a CMS for a single user.

**Definition of done:**
- Migration: `project_archetypes` table (schema in original brief)
- Migration: backfill from TS constants
- Teacher page: list / view / edit / clone archetype
- Versioning: see FU-PSB-ARCHETYPE-VERSIONING

---

## FU-PSB-ARCHETYPE-VERSIONING — Version bump strategy when copy changes
**Surfaced:** 11 May 2026 (v1 build).
**Severity:** 🟢 LOW — only bites once specs accumulate.
**Target phase:** Once the second unit uses Project Spec (post-tomorrow).

**What it adds:** When an archetype's slot copy is edited *after*
students have submitted specs, decide whether the existing specs:
- Stay anchored to the old copy (versioned snapshot at submission time)
- Re-render with new copy (live deref)
- Migrate explicitly (one-time copy → freeze)

Currently the design is live deref — if Matt edits a slot title in
`archetypes.ts`, every student's spec re-renders with the new title.
That's fine for typo fixes; problematic for semantic changes.

**Why deferred:** Tomorrow's class is unit 1. No prior specs to break.

**Definition of done:**
- Decide on the version model (snapshot vs live vs migrate)
- If snapshot: add a `archetype_version` column to
  `student_unit_project_specs`, snapshot full archetype payload to a
  JSONB column on first save
- Doc the decision in `docs/decisions-log.md`

---

## FU-PSB-CLASS-ID-BACKFILL — Populate class_id on existing specs
**Surfaced:** 11 May 2026 (v1 build).
**Severity:** 🟢 LOW — only matters once class-scoped teacher dashboards exist.
**Target phase:** With FU-PSB-TEACHER-VIEW.

**What it adds:** Today `class_id` on `student_unit_project_specs` is
nullable and unpopulated by v1 (the POST handler doesn't read the
student's active class). Once teacher dashboards scope by class, we
either backfill via `class_students.class_id` join or have the POST
handler set it on first write.

**Why deferred:** v1 has no class-scoped teacher view, so class_id is
purely a placeholder column for future use.

**Definition of done:**
- POST handler reads `class_students` and sets class_id on insert
- Backfill migration for any existing rows
- Add to FU-PSB-TEACHER-VIEW's RLS join

---

## Resolved

_None yet — v1 ships tomorrow._
