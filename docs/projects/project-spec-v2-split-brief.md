# Project Spec v2 — Split brief

**Status:** DRAFT — awaiting post-pilot review.
**Surface:** 3 new lesson-page activity blocks, replacing the unified `project-spec` block from v1.
**Spec author:** Claude, 11 May 2026.
**Predecessor:** v1 unified Project Spec — PR #177 (+ #179, #180, #182, #184).

---

## 1. Why split

The v1 unified Project Spec block has 7 questions covering three distinct concerns mashed into one activity:

| v1 Q | Concern |
|---|---|
| Q1 Name | Identity (lightweight) |
| Q2 Core action | Product (what it does) |
| Q3 Mechanism | Product (how it works) |
| Q4 Materials | Product (build) |
| Q5 Size/scope | Product (scale) |
| Q6 Test user | **User / Client Profile** |
| Q7 Success signal | **Success Criteria / Test Plan** |

This is the structure of a rigorous MYP / GCSE / IGCSE design specification — but they're typically authored at different points in the unit (User research → Product brief → Test plan), each demanding different thinking, and each benefits from richer treatment than 1–2 cramped questions.

**Splitting unlocks:**
- **Pedagogical sequencing** — Lesson 2 can host a User Profile block, Lesson 4 a Product Brief, Lesson 10 a Success Criteria block. Teacher composes the unit as they want.
- **Richer authoring per concern** — User Profile gets ~5 questions + optional photo/quote (the v1 40-char Q6 is anaemic for real empathy work). Success Criteria gets measurement protocols + failure modes.
- **Reuse across unit types** — Service-Learning needs User Profile but no Product Brief. Inquiry units need Success Criteria but no physical product. Decoupling unlocks composability.
- **Smaller, more focused activities** — each block fits one Workshop Model phase cleanly.

---

## 2. Scope

**In:**
- 3 new lesson-page activity blocks: `product-brief`, `user-profile`, `success-criteria`
- 3 new tables, one per block
- 3 new API routes (mirror v1's POST partial-patch upsert pattern)
- 3 new BlockPalette entries
- The onChange-via-ref bridge from PR #184 (each new block writes a summary into `student_progress.responses` so marking sees them)

**Out (filed as FU):**
- Cross-block sync (e.g., copy user name from User Profile into Product Brief's audience field)
- AI mentor sharpening per block
- Aggregated "My Project Plan" student dashboard widget
- Project-archetype scope expansion to User Profile / Success Criteria (kept on Product Brief only — Toy/Architecture differ in physical concerns, not in how you describe users)
- v1 deprecation / data migration (v1's `student_unit_project_specs` stays untouched; future units use the split blocks)

**Out indefinitely (won't ship):**
- Schema-level rename of v1 table or columns (v1 is frozen; v2 is parallel)

---

## 3. Schema (3 migrations)

All three tables follow the v1 pattern:
- One row per `(student_id, unit_id)`
- JSONB slot columns of shape `{ value, skipped, updated_at }`
- `class_id` nullable (Access v2 closure)
- `completed_at` set when student explicitly marks the block complete
- Teacher-SELECT RLS via `class_units` join (mirrors v1; Lesson #4 — students bypass RLS via service-role API)
- Down migration safety guard: refuses if any row has a non-null discriminator field (`archetype_id` / `user_name` / `success_signal`)

### Table 1: `student_unit_product_briefs`

Lifted directly from v1's slots 1–5 plus richer fields.

```sql
CREATE TABLE student_unit_product_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id),

  archetype_id TEXT,           -- Toy / Architecture / ... (same registry as v1)
  slot_1 JSONB,                -- Project name (1–4 words)
  slot_2 JSONB,                -- Elevator pitch (1 sentence, 25 words)
  slot_3 JSONB,                -- Core mechanism / unique feature (15 words)
  slot_4 JSONB,                -- Primary material (chip-picker, MATERIALS_CHIPS)
  slot_5 JSONB,                -- Secondary material (optional, chip-picker)
  slot_6 JSONB,                -- Scale / size (size-reference or number-pair, archetype-dependent)
  slot_7 JSONB,                -- Constraints (multi-chip: time / cost / ethical / weight / safety)
  slot_8 JSONB,                -- Precedents — text + optional image URL (existing things that inspired you)
  slot_9 JSONB,                -- Technical risks — 1–3 free-text fields (what might fail)

  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, unit_id)
);
```

### Table 2: `student_unit_user_profiles`

Universal across archetypes — every project has a user.

```sql
CREATE TABLE student_unit_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id),

  slot_1 JSONB,                -- User name + relationship (text — "Maya, my sister, age 8")
  slot_2 JSONB,                -- Age band (chip-picker: 0-5 / 6-10 / 11-14 / 15-18 / adult / mixed)
  slot_3 JSONB,                -- Context — where + when they'd use it (text, 30 words)
  slot_4 JSONB,                -- Problem they're trying to solve (text, 30 words)
  slot_5 JSONB,                -- What exists today + why it doesn't fit (text-multifield, 2 fields)
  slot_6 JSONB,                -- Why they'd care about your version (text, 25 words)
  slot_7 JSONB,                -- Photo / sketch of user (optional image upload — proxy-bucket URL)
  slot_8 JSONB,                -- Quote / observation from talking to them (optional text)

  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, unit_id)
);
```

### Table 3: `student_unit_success_criteria`

Also universal — every project has a way to evaluate it.

```sql
CREATE TABLE student_unit_success_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id),

  slot_1 JSONB,                -- Observable success signal (text, 20 words — "stays for 5+ min")
  slot_2 JSONB,                -- Measurement protocol (chip-picker: timed / counted / qualitative / before-after / scale-rating)
  slot_3 JSONB,                -- Test setup — where, when, how long, who watches (text-multifield, 4 fields)
  slot_4 JSONB,                -- What "going wrong" looks like (text, 25 words — failure mode)
  slot_5 JSONB,                -- Iteration trigger — at what point would you redesign (text, 20 words)

  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, unit_id)
);
```

### Migrations

Three timestamp-prefixed migrations (`bash scripts/migrations/new-migration.sh ...`):
1. `*_student_unit_product_briefs.sql`
2. `*_student_unit_user_profiles.sql`
3. `*_student_unit_success_criteria.sql`

Each includes:
- `CREATE TABLE` + columns + UNIQUE + indexes (`student_id+unit_id` lookup, `unit_id` for teacher reads)
- `ENABLE ROW LEVEL SECURITY`
- One teacher-SELECT policy via `class_units` join (mirrors AG.2.1 kanban)
- `set_updated_at()` trigger
- Sanity check `DO $$` block at the end
- Paired `.down.sql` with safety guard refusing if any row has non-null discriminator

Each can mint + apply independently (no FK between them — they're loosely coupled by `(student_id, unit_id)`).

---

## 4. Block UX + slot copy

### 🧰 Product Brief block (`responseType: "product-brief"`)

**Header:** `🧰 Product Brief · {archetype.label}` (or `🧰 Product Brief` if no archetype picked yet)
**Phase:** Picker (Q0) → Walker (Q1–Q9) → Card.
**Picker:** same archetype chip flow as v1 (Toy / Architecture in v1, expanding in FU-PSB-ARCHETYPES-3-6).

Slots:

| # | Title | Input | Notes |
|---|---|---|---|
| 1 | What's your project called? | text, 4 words | Same as v1 Q1 |
| 2 | One-sentence elevator pitch | text, 25 words | Same as v1 Q2 — verb-driven, what user DOES |
| 3 | What's the ONE thing that makes it work? | text, 15 words | Same as v1 Q3 |
| 4 | Primary material | chip-picker, MATERIALS_CHIPS | Same as v1 Q4 |
| 5 | Secondary material (optional) | chip-picker, MATERIALS_CHIPS | NEW — surfaces v1's `allowSecondary` properly |
| 6 | Scale | archetype-dependent (size-reference OR number-pair) | Same as v1 Q5; Toy uses references, Architecture uses cm × cm |
| 7 | Constraints | multi-chip, 0–3 selectable | NEW — time / cost / ethical / weight / safety / accessibility |
| 8 | Precedents — what existing thing inspired you? | text + optional image | NEW — pairs nicely with Class Gallery later |
| 9 | Technical risks — what might break or be hard? | text-multifield, 1–3 fields | NEW — "I might not be able to laser-cut this thick", "Resin is messy" |

**Examples drawer** kept for slots 1–3 (where students struggle most). Other slots are concrete enough to skip examples.

### 👤 User Profile block (`responseType: "user-profile"`)

**Header:** `👤 User Profile`
**Phase:** Walker (Q1–Q8) → Card. **No archetype picker** — universal.

| # | Title | Input | Notes |
|---|---|---|---|
| 1 | Who is this for? Name + relationship | text, 60 chars | "My sister Maya" / "Mr Chen's Grade 4 class" |
| 2 | Age band | chip-picker | 0-5 / 6-10 / 11-14 / 15-18 / Adult / Mixed |
| 3 | Where & when would they use it? | text, 30 words | "After school, in her bedroom, while doing homework" |
| 4 | What problem are they trying to solve? | text, 30 words | "She gets distracted and forgets what she was doing" |
| 5 | What exists today + why it doesn't fit | text-multifield, 2 fields | "Sticky notes — she loses them" + similar |
| 6 | Why would they care about YOUR version? | text, 25 words | The "unique value" — what makes yours land |
| 7 | Photo / sketch (optional) | image upload, proxy bucket | Of the user OR of them using a current alternative |
| 8 | Quote or observation (optional) | text, 40 words | "I asked Maya and she said…" — pushes them toward real research |

**Skill nudge:** slots 4, 5, 6 are the empathy work — show examples drawer with strong vs weak.

**Storage note for slot 7:** image goes to a private storage bucket (mirror existing `responses` bucket pattern). URL stored as `/api/storage/<bucket>/<path>` relative string per security rules. Slot value shape: `{ kind: "image", url, alt?, width?, height? }`. Reuse existing image upload component from `ImageUploadButton`.

### 🎯 Success Criteria block (`responseType: "success-criteria"`)

**Header:** `🎯 Success Criteria`
**Phase:** Walker (Q1–Q5) → Card. No archetype picker.

| # | Title | Input | Notes |
|---|---|---|---|
| 1 | What WILL happen if it works? | text, 20 words | Observable behaviour — "She figures out how to play in <60s without me" |
| 2 | How will you measure it? | chip-picker, single | Timed (stopwatch) / Counted (tally) / Qualitative (notes) / Before-after / 1–5 rating |
| 3 | Test setup | text-multifield, 4 fields | Where / When / How long / Who's watching |
| 4 | What does "going wrong" look like? | text, 25 words | Failure mode — "She loses interest in <30s" |
| 5 | Iteration trigger — at what point would you redesign? | text, 20 words | "If 2 of 3 testers can't figure it out without help" |

**Pedagogy:** this block teaches students to think like researchers, not designers. The 4-field test setup forces them to plan logistics, which they rarely do.

---

## 5. Component plan

Three new components in `src/components/student/`:
- `product-brief/ProductBriefResponse.tsx`
- `user-profile/UserProfileResponse.tsx`
- `success-criteria/SuccessCriteriaResponse.tsx`

**Shared concerns** — extract to `src/lib/project-spec-shared/` (or rename the existing `src/lib/project-spec/` to be the shared spot):
- `SlotInputType`, `SlotValue`, `SlotAnswer` types (already exist in v1)
- `SlotInput` dispatcher component (5 input types — reused as-is)
- `buildSpecSummary` helper (parameterised per block — header + ordered slot labels)
- `formatAnswer` helper (already exists)
- onChange-via-ref pattern (PR #184 — critical, do not omit)

**Per-component differences:**
- Header / emoji / colour palette
- Slot definitions (move from `src/lib/project-spec/archetypes.ts` into per-block files)
- Whether to render archetype picker (Product Brief: yes; others: no)
- Persistence endpoint (`/api/student/product-brief`, etc.)
- Summary string format (3 different headers in `student_progress.responses` so marking labels them clearly)

**Summary headers (what teacher sees in marking):**
```
Product Brief — 🧸 Toy / Game Design
Q1 — ...

User Profile
Q1 — ...

Success Criteria
Q1 — ...
```

### Image upload (User Profile slot 7)

New input kind for `SlotInputType`: `image-upload`. Renders `ImageUploadButton` from `src/components/teacher/lesson-editor/ImageUploadButton.tsx` (already exists for activity-block media). Storage: dedicated student-side proxy URL pattern, bucket = `responses` (existing private bucket) or a new `user-profile-photos` bucket. Decision deferred — Phase brief 2.

---

## 6. API routes

Three routes, all mirror v1's `/api/student/project-spec`:

```
GET  /api/student/product-brief?unitId=<uuid>
POST /api/student/product-brief

GET  /api/student/user-profile?unitId=<uuid>
POST /api/student/user-profile

GET  /api/student/success-criteria?unitId=<uuid>
POST /api/student/success-criteria
```

Each:
- `requireStudentSession()` from `@/lib/access-v2/actor-session` (Lesson #4)
- `createAdminClient()` for service-role writes
- POST partial-patch upsert (server merges patch with existing row)
- Validates slot payloads (`{ value, skipped: boolean, updated_at: string }`)
- For Product Brief: validates `archetype_id` against `ARCHETYPES` registry
- For User Profile: validates `image-upload` slot URL is on the allowed proxy bucket (security)
- `audit-skip` comment at top (matches v1 + kanban pattern)

---

## 7. BlockPalette entries

Three new entries in `src/components/teacher/lesson-editor/BlockPalette.tsx`, all in `category: "response"`:

```ts
{
  id: "product-brief",
  label: "Product Brief",
  icon: "🧰",
  category: "response",
  description: "Archetype-driven product spec — what you're making + scale + materials + risks.",
  defaultPhase: "workTime",
  create: () => ({
    activityId: nanoid(8),
    prompt: "Lock in what you're going to make. Materials, scale, mechanism, risks.",
    responseType: "product-brief" as ResponseType,
    durationMinutes: 15,
  }),
},
{
  id: "user-profile",
  label: "User Profile",
  icon: "👤",
  category: "response",
  description: "Who you're designing for — context, problem, alternatives, why they'd care.",
  defaultPhase: "workTime",
  create: () => ({
    activityId: nanoid(8),
    prompt: "Build a real picture of your user. Name them. Watch them. Quote them.",
    responseType: "user-profile" as ResponseType,
    durationMinutes: 15,
  }),
},
{
  id: "success-criteria",
  label: "Success Criteria",
  icon: "🎯",
  category: "response",
  description: "How you'll know it worked — observable signals, measurement, failure modes.",
  defaultPhase: "workTime",
  create: () => ({
    activityId: nanoid(8),
    prompt: "Decide how you'll test this and what success looks like — before you build.",
    responseType: "success-criteria" as ResponseType,
    durationMinutes: 10,
  }),
},
```

`ResponseType` union gains 3 new members; `RESPONSE_TYPE_LABELS` / `RESPONSE_ICON` / `RESPONSE_TINT` in `ActivityBlock.tsx` gain matching entries.

---

## 8. Marking integration

Same pattern as v1 (PR #182 + #184):
- Each block's component captures `onChange` via ref (NOT in dep array — PR #184 lesson)
- `useEffect([state])` pushes a summary string to `onChange` on every state change
- Autosave debounce writes to `student_progress.responses[tile_id]`
- Marking page picks up the tile via standard tile-progress check

**Result for teacher:** if a lesson has all three blocks placed in it, Scott will produce three tiles in marking — `🧰 Product Brief — Toy / Game Design`, `👤 User Profile`, `🎯 Success Criteria` — each with the formatted multi-line summary visible in the detail pane.

---

## 9. Build phases

### Phase A — Schema + types (1 commit each = 3 commits)
- Mint 3 migrations via `new-migration.sh`, commit empty stubs immediately to reserve timestamps
- Author SQL bodies, `verify-no-collision.sh` clean
- Apply to prod
- Add `"product-brief" | "user-profile" | "success-criteria"` to `ResponseType` union

**Matt Checkpoint A** — 3 migrations applied, types extended, baseline tests stable.

### Phase B — Shared library (1 commit)
- Either rename `src/lib/project-spec/` → `src/lib/project-spec-shared/` and move types out, OR keep `project-spec` as shared and have v1's archetypes file stay
- Decide on `image-upload` SlotInputType + value shape
- Extract `SlotInput`, `formatAnswer`, helpers into shared module
- Add `buildSummary(header, slots, slotDefs)` parameterised helper

**Matt Checkpoint B** — shared library shape signed off.

### Phase C — Product Brief block (3 commits)
- Slot definitions in `src/lib/project-spec/product-brief.ts` (or similar) — Toy + Architecture variants per archetype, all 9 slots
- `ProductBriefResponse.tsx` — picker + walker + card phases
- API route `/api/student/product-brief` (GET + POST partial-patch upsert)
- BlockPalette entry + dispatch in `ResponseInput.tsx`

**Matt Checkpoint C** — Product Brief drag-droppable into a test lesson, fully smoke-tested as a student.

### Phase D — User Profile block (3 commits)
- Slot definitions (8 slots, universal — no archetype variants)
- `UserProfileResponse.tsx` — walker only (no picker)
- API route `/api/student/user-profile`
- BlockPalette entry
- Image upload integration (slot 7) — pick a storage bucket, wire `ImageUploadButton`

**Matt Checkpoint D** — User Profile drag-droppable, image upload working end-to-end.

### Phase E — Success Criteria block (2 commits)
- Slot definitions (5 slots, universal)
- `SuccessCriteriaResponse.tsx`
- API route + BlockPalette entry

**Matt Checkpoint E** — all three blocks live, can be placed in a test unit, all three visible in marking.

### Phase F — Registry sync + follow-ups + handoff (1 commit)
- 3 new WIRING entries (or one combined "project-spec-suite")
- 3 schema-registry table entries
- api-registry auto-syncs via `scan-api-routes.py`
- New follow-ups file `docs/projects/project-spec-v2-followups.md`
- changelog entry

**Matt Checkpoint F** — registries clean, follow-ups filed, ready for pilot use in a real unit.

**Total:** ~10 commits, ~5 Matt Checkpoints, estimated 1–2 days of focused work.

---

## 10. Test plan

**Per-block (apply to each of A/B/C):**
- Migration `verify-no-collision.sh` clean
- tsc strict clean on every touched file
- `npm test` green (baseline → baseline)
- Dev-server boots without console errors
- As a test student in prod: drag block into a test lesson, complete walker end-to-end, refresh — state persists
- Skip-for-now flow works; can come back to a skipped slot
- Summary string appears in `student_progress.responses[tile_id]` (check via DB or via marking)
- Marking page surfaces the tile with the formatted summary visible
- Length nudge fires on short text answers
- Examples drawer toggles correctly

**Cross-block:**
- Place all three blocks in a single lesson, complete all three as one student → marking shows three distinct tiles
- Place each block in a DIFFERENT lesson of the same unit → each tile appears under its own lesson on the marking page

**Regression:**
- v1 `project-spec` block still works (no changes to it; coexistence verified)
- v1's Scott submission still visible in marking after v2 deploy (no data migration; should be untouched)

---

## 11. Coexistence with v1

- v1's `student_unit_project_specs` table stays. Frozen.
- v1's `responseType: "project-spec"` block stays in BlockPalette during the transition.
- After Matt has run a unit with v2 blocks and is happy: remove the v1 BlockPalette entry (block becomes invisible in the lesson editor; existing student data continues to render in marking via the bridge from PR #182).
- v1 table eventually dropped via a future migration after a quarter of zero new submissions.

**Data migration:** none planned. v1 submissions and v2 submissions live independently. A student in a v1 unit sees the v1 block; a student in a v2 unit sees the three v2 blocks. Mixing in the same unit is allowed but messy.

---

## 12. Open questions for Matt

1. **Aggregated student "My Project" view** — do students get a single page that pulls all three blocks' data into one card on their dashboard? (My recommendation: no — keep it simple; the three completion cards inside the lesson activities are enough for v2. Aggregation is v3.)

2. **Archetype scope** — should the User Profile block adapt its slots based on the Product Brief's archetype (e.g., Architecture-style projects might want "Where does this space sit in the neighbourhood?")? (My recommendation: no — keep User Profile universal; lessons in the unit can frame it for the archetype.)

3. **Block ordering / gating** — should User Profile gate Product Brief (research-before-design)? (My recommendation: no — let teachers sequence freely via lesson placement; some pedagogy starts with the product idea and validates with users after.)

4. **Image upload bucket for User Profile slot 7** — reuse the existing `responses` bucket, or mint a new `user-profile-photos` bucket with its own RLS / moderation hooks? (Defer to Phase D brief.)

5. **AI mentor sharpening** — do we ship Q-level "sharpen" buttons per block (Haiku, one round, effort-gated)? (My recommendation: same FU as v1's `FU-PSB-MENTOR-SHARPEN` — defer to a unified AI mentor pass that hits all blocks.)

6. **Cross-block sync** — if Product Brief asks for "who would you put this in front of" and User Profile asks "who is this for", should they auto-link? (My recommendation: no in v2 — the duplication is a feature, not a bug, because the user might evolve between when you wrote the brief and when you tested.)

7. **Class Gallery integration** — should completed User Profile entries (esp. slot 7 photo + slot 8 quote) feed into the Class Gallery as discovery / shared research? (My recommendation: file as FU once v2 ships; would be high-impact for unit-2+ students who can stand on prior cohorts' user research.)

8. **Project Spec v1 deprecation timing** — keep v1 block in BlockPalette during pilot, remove after a quarter? Or remove immediately when v2 ships? (My recommendation: remove from BlockPalette when v2 lands, keep the table for read-only marking visibility of old submissions, drop the table after 90 days of zero new v1 inserts.)

---

## 13. Lessons banked from v1 (apply throughout)

- **Lesson #4** — students use token sessions, RLS is teacher-only, service-role API for writes.
- **PR #182 + #184** — `onChange` must be captured via ref when used inside a useEffect dep, OR the callback's stability guaranteed by the parent. Inline closures from parent renders cause infinite loops.
- **Lesson #29** — if RLS uses junction tables, audit the UNION pattern. (Not relevant here; teacher RLS only.)
- **Lesson #38** — verify queries assert EXPECTED values, not just non-null. (Applies to migration sanity checks.)
- **Lesson #44** — simplicity first. Don't over-engineer cross-block sync, aggregation, or AI mentor in v2.
- **Lesson #45** — surgical changes; don't refactor v1 while building v2.
- **Lesson #54** — registry drift; sync `WIRING.yaml`, `schema-registry.yaml`, `api-registry.yaml`, `feature-flags.yaml`, `ai-call-sites.yaml`, `vendors.yaml` after build.

---

## 14. Out-of-scope follow-ups (file when v2 ships)

- `FU-PSV2-AGGREGATED-VIEW` (P3) — single "My Project Plan" student view combining all three blocks.
- `FU-PSV2-CROSS-BLOCK-SYNC` (P3) — auto-populate overlapping fields between blocks.
- `FU-PSV2-USER-PHOTO-MODERATION` (P2) — content moderation pipeline for User Profile slot 7 photos.
- `FU-PSV2-CLASS-GALLERY-USER-RESEARCH` (P2) — surface completed User Profiles in the Class Gallery.
- `FU-PSV2-AI-MENTOR-PER-BLOCK` (P2) — supersedes v1's `FU-PSB-MENTOR-SHARPEN`; one sharpening pass per block.
- `FU-PSV2-V1-DEPRECATION` (P3) — drop `student_unit_project_specs` table 90 days after zero v1 inserts.
- `FU-PSV2-ARCHETYPES-3-6` (carries forward from v1's `FU-PSB-ARCHETYPES-3-6`) — Film / App / Fashion / Event-Service archetypes for Product Brief.

---

## 15. Decision

Awaiting Matt sign-off post-pilot. Build when ready — phase brief is self-contained enough that a future Claude session (or future Matt) can pick this up and execute Phases A → F in order.
