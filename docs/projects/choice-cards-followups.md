# Choice Cards Block — Follow-ups

Tracker for the Choice Cards Activity Block (v1 SHIPPED 12 May 2026). Append-only; resolved items move to the bottom.

System: [`choice-cards-block` in WIRING.yaml](WIRING.yaml).
Schema: [`choice_cards` + `choice_card_selections` in schema-registry.yaml](../schema-registry.yaml).
Dispatcher: [`src/lib/choice-cards/action-dispatcher.ts`](../../src/lib/choice-cards/action-dispatcher.ts).

---

## ~~FU-CCB-PROJECT-SPEC-WIRE~~ ✅ RESOLVED 12 May 2026

- **Resolved:** Wired Choice Cards → Project Spec v2 blocks via lazy resolve (Phases A–D, commits `e291727`..`897e708`).
- **Approach pivoted:** The brief's "Project Spec block" was a v1 reference. v2's split (Product Brief + User Profile + Success Criteria) is the current shape — all three were already shipped. Wired to those instead of the mythical v1 block. Implementation:
  - **Phase A:** Added `app-digital-tool` archetype to `PRODUCT_BRIEF_ARCHETYPES` (9 slots, with new `DIGITAL_MEDIUM_CHIPS` catalogue for slots 4/5 and digital-scope size-references for slot 6). Grounds the 3 ships_to_platform briefs.
  - **Phase B:** New shared helper `src/lib/choice-cards/resolve-for-unit.ts`. Product Brief GET route lazy-resolves archetype from `choice_card_selections` (newest pick wins). Suggested-not-persisted: next POST writes it for real. UI gets a `🃏 From your card pick: <label> — archetype pre-selected` banner via `FromChoiceCardBanner` component.
  - **Phase C:** Same banner on User Profile + Success Criteria (universal blocks — no archetype pre-fill, but banner gives the same orientation).
  - **Phase D:** Kanban GET lazy-seeds backlog cards from the action's `seedKanban` payload when no row exists yet. 4 starter tasks per brief land in backlog on first kanban open.
- **Architecture seam preserved:** No subscriber registered in the dispatcher. Consumers pull via `resolveChoiceCardPickForUnit()` at their own mount time. Choice Cards stays decoupled — could swap any consumer without touching it.
- **Original framing kept for historical context:**
  - Original target: wire a `set-archetype` action subscriber once the Project Spec block ships.
  - Why pivoted: v1 Project Spec was deprecated 12 May; v2 split was already in production. The action-dispatcher subscriber pattern still works (and the dispatcher still emits to `learning_events`), but the v2 blocks consume via direct lazy-read for the simpler, mount-time semantics this case needs.

## FU-CCB-AI-IMAGE-GEN

- **Surfaced:** 12 May 2026 (build of v1 — explicitly deferred in the brief).
- **Target:** Generate card images on demand from `image_prompt` using an image model (DALL-E / Imagen / Flux).
- **Severity:** P2 — emoji + bg_color is a passable fallback. Real images make the deck feel real.
- **Origin:** Phase 6 spec — "AI image generation is OUT OF SCOPE for v1."
- **Scope:** New route `/api/teacher/choice-cards/[cardId]/generate-image` that calls the model, uploads through `/api/teacher/upload-choice-card-image`, and PATCHes the card with the resulting `image_url`. Library picker UI gains an "✨ Generate from prompt" button.

## FU-CCB-MULTI-PICK

- **Surfaced:** 12 May 2026 (build of v1 — multi mode greyed in config panel).
- **Target:** Allow `selectionMode: "multi"` so students can pick multiple constraint / role cards from a single deck.
- **Severity:** P2 — needed for constraint-stacking decks and multi-role group work.
- **Origin:** Phase 5 config panel greys out the "multi" chip.
- **Scope:** Schema already supports — relax the `UNIQUE(student_id, activity_id)` constraint to allow multiple rows when the block config is multi. Component-side: track an array of picked IDs; no focus-mode lock; show "Save selection" button after first pick.

## FU-CCB-LAYOUT-FAN-STACK

- **Surfaced:** 12 May 2026.
- **Target:** Fan and Stack visual layouts beyond the v1 Grid.
- **Severity:** P3 — Grid works; Fan + Stack are nice-to-have visual variety for different deck sizes.
- **Origin:** Phase 5 config panel greys out the "fan" and "stack" chips.
- **Scope:** ChoiceCardsBlock layout switch on `config.layout`. Fan = arc with overlapping cards (good for 5–7 card decks); Stack = z-stacked pile with peek-shuffle (good for 10+ card decks).

## FU-CCB-INLINE-CARD-EDIT

- **Surfaced:** 12 May 2026.
- **Target:** Teachers edit existing library cards in-place from the picker modal.
- **Severity:** P3 — for v1 teachers create new cards. To edit they need platform admin help (PATCH /api/teacher/choice-cards/[cardId] works, just no UI for it).
- **Origin:** Phase 5 spec — "Inline editing of existing cards is FU-CCB-INLINE-CARD-EDIT (P3) — for v1 teachers only edit cards via the create-new form".
- **Scope:** Add an "Edit" pencil to each card preview in the library picker. Opens the same create-card form pre-filled, hitting PATCH instead of POST. Authorization: creator or platform admin (route already enforces).

## FU-CCB-CHANGE-PICK-TOGGLE

- **Surfaced:** 12 May 2026.
- **Target:** Teacher-controllable toggle to allow students to change their pick after locking.
- **Severity:** P3 — v1 default is locked-once-picked. Some decks (mentor picks, themes) might warrant "you can switch later".
- **Origin:** Phase 3b component design.
- **Scope:** Add `allowChangePick: boolean` to `ChoiceCardsBlockConfig`. When true, render a "Change pick" affordance over the locked deck that re-enables interaction + DELETEs the existing selection row.

---

## Resolved
_(none yet)_
