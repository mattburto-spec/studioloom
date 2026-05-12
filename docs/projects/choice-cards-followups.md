# Choice Cards Block — Follow-ups

Tracker for the Choice Cards Activity Block (v1 SHIPPED 12 May 2026). Append-only; resolved items move to the bottom.

System: [`choice-cards-block` in WIRING.yaml](WIRING.yaml).
Schema: [`choice_cards` + `choice_card_selections` in schema-registry.yaml](../schema-registry.yaml).
Dispatcher: [`src/lib/choice-cards/action-dispatcher.ts`](../../src/lib/choice-cards/action-dispatcher.ts).

---

## FU-CCB-PROJECT-SPEC-WIRE

- **Surfaced:** 12 May 2026 (build of v1).
- **Target:** Wire a `set-archetype` action subscriber once the Project Spec block ships, so picking a G8 brief card mounts the corresponding Project Spec preset with the seeded kanban.
- **Severity:** P1 — the 3 ships_to_platform briefs + 3 physical-making briefs all reference archetype IDs (`app-digital-tool`, `architecture-interior`, `toy-design`) that today are logged-but-unconsumed.
- **Origin:** Phase 7 seed migration. Phase 8 dispatcher's `set-archetype` action type is defined but no subscribers register at boot.
- **Scope:** Project Spec block side. Choice Cards v1 is decoupled by design — the dispatcher already accepts a subscriber for `set-archetype` and will pass through the `archetypeId` + `seedKanban` payload. The Project Spec block boot code calls `registerChoiceCardSubscriber('project-spec', 'set-archetype', handler)` once at module init.

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
