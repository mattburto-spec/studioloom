# Inspiration Board + Archetype-Aware Infrastructure — Follow-ups

Tracker for the Inspiration Board Activity Block (v1 SHIPPED 12 May 2026) and the universal archetype-aware infrastructure that ships alongside it. Append-only; resolved items move to the bottom.

Systems:
- [`archetype-aware-blocks` in WIRING.yaml](WIRING.yaml) — the universal infrastructure.
- [`inspiration-board-block` in WIRING.yaml](WIRING.yaml) — first consumer.

Canonical principle: [A12 in design-guidelines.md](../design-guidelines.md) — *Archetype-Aware Blocks*.

---

## Inspiration Board (v1 SHIPPED)

### FU-IB-AI-PATTERN-SUGGESTION

- **Surfaced:** 12 May 2026.
- **Target:** After student fills 3+ items with commentary, surface a Haiku-generated "pattern you might be missing" suggestion. Effort-gated (one round, dismissible). Helps students who can see things share something but can't yet name it.
- **Severity:** P2 — meaningful UX boost, not load-bearing.
- **Scope:** New route `/api/student/inspiration-board/[activityId]/suggest-pattern` (Haiku, single completion, budget-aware). Block surfaces a "Need a nudge?" button under the synthesis card once 3+ items have commentary. Suggestion appears as a chip "Could be about: X" with a "Use this" / "Not quite" pair.

### FU-IB-COMPETITOR-SCAN

- **Surfaced:** 12 May 2026.
- **Target:** Auto-suggest 3 inspiration images based on the student's project mission (read from Product Brief slot 2 or the Choice Card pick).
- **Severity:** P3.
- **Scope:** Either via Bing Image Search / Unsplash API with archetype-aware queries, OR a curated per-archetype starter pack. Single-shot — student decides whether to add any.

### FU-IB-PINTEREST-IMPORT

- **Surfaced:** 12 May 2026.
- **Target:** Paste a Pinterest board URL, extract the image list, let student multi-select which to import.
- **Severity:** P3.
- **Scope:** Server-side scrape of Pinterest's public-board JSON endpoint. Stash each chosen image into the student's responses bucket. Pinterest TOS check before shipping.

### FU-IB-REUSE-FROM-PORTFOLIO

- **Surfaced:** 12 May 2026.
- **Target:** Student can drag in images from their own portfolio (work submitted earlier in the unit).
- **Severity:** P3.
- **Scope:** Extend the upload area with a "From your portfolio" sub-tab that lists eligible images. Wires through to the existing portfolio_entries table.

### FU-IB-CARD-SLUG-LOOKUP

- **Surfaced:** 12 May 2026 (build of v1 — known limitation).
- **Target:** Card-slug-keyed overrides (e.g. `"g8-brief-designer-mentor"`) currently don't fire — the resolver returns the archetypeId, and v1's `getArchetypeAwareContent` only matches archetype-level keys. We seeded card-slug overrides on the Inspiration Board block but they're unused until a slug-lookup helper exists.
- **Severity:** P2.
- **Scope:** Add `resolveStudentCardSlug(studentId, unitId)` to `src/lib/choice-cards/resolve-for-unit.ts` (newest pick wins). Update `InspirationBoardBlock` mount to also fetch the card slug + pass both into `getArchetypeAwareContentByChain([cardSlug, archetypeId])`. Probably surface via the same `/api/student/archetype/[unitId]` route returning `{ archetypeId, cardSlug }`.

### FU-IB-COMPONENT-TESTS

- **Surfaced:** 12 May 2026.
- **Target:** Component-level tests for `<InspirationBoardBlock>` covering renders-base-when-archetype-null, renders-override-when-archetype-matches, synthesis-locked-under-min, upload-disabled-at-max, complete-disabled-when-required-fields-empty, delete-and-reorder updates state.
- **Severity:** P2 — behavioural smoke covered for v1, but explicit unit coverage is overdue.
- **Scope:** vitest + @testing-library/react. Mock fetch for the archetype endpoint + the upload endpoint.

### FU-IB-DRAG-REORDER

- **Surfaced:** 12 May 2026 (smoke caught upload failure on prod — Framer Motion `Reorder.Group` was incompatible with CSS multi-column flow, breaking the entire grid render).
- **Target:** Restore drag-to-reorder for board cards. Need a Framer-Motion-friendly layout — likely a CSS grid (non-column) with row/column positioning, OR a custom drag implementation that doesn't rely on `Reorder.Group`'s transform-tracking.
- **Severity:** P3 — nice-to-have. Students can delete + re-upload to change order in v1.
- **Origin:** Phase 3b → patched out 12 May 2026 after the upload-doesn't-render bug Matt reported.
- **Scope:** Either (a) drop CSS columns + use a fixed-grid layout that Reorder.Group can position, OR (b) use a different DnD library (react-dnd / dnd-kit) that's column-aware.

### FU-IB-DEDICATED-TABLE

- **Surfaced:** 12 May 2026.
- **Target:** Move Inspiration Board state from `student_progress.responses` JSON blob to a dedicated `student_unit_inspiration_boards` table.
- **Severity:** P2.
- **Scope:** Migration to add the table. New routes `/api/student/inspiration-board/[activityId]` (GET, PUT). Backfill existing JSON blobs. Triggers when teacher analytics need per-image queries (e.g. "show me all the images students borrowed from").

---

## Archetype-aware infrastructure (v1 SHIPPED)

### FU-AAB-OVERRIDE-VERSION-DRIFT

- **Surfaced:** 12 May 2026.
- **Target:** When teachers change `archetype_overrides` after students have responses recorded against the old version, the rendered task may differ from what the student saw at response time. Version the override that was active.
- **Severity:** P2 — for v1 the overrides are stable (seeded + rarely edited), but the audit story matters once teachers start tuning.
- **Scope:** When a student saves their first slot in an archetype-aware block, snapshot the resolved-content payload into the response itself. Marking + grading reads from the snapshot, not the live block, ensuring the student is graded against the prompt they saw.

### FU-AAB-PROJECT-SPEC-FALLBACK

- **Surfaced:** 12 May 2026 (build of v1 — placeholder).
- **Target:** When the unified `project_specs` table ships, activate step 1 of `getStudentArchetype`'s fallback chain. Currently a try/catch placeholder that falls through silently.
- **Severity:** P1, conditional — only relevant if/when the unified Project Spec table replaces the v2 split (Product Brief + User Profile + Success Criteria).
- **Scope:** 3-line change inside `src/lib/students/archetype-resolver.ts` — drop the try/catch once the table is real. Test branch in `archetype-resolver.test.ts` already covers the "step 1 wins" semantics.

---

## Resolved
_(none yet)_
