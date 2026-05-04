# Unit Editor — NM Block Category (Lever-MM)

**Status:** 🟡 ACTIVE — MM.0A drafted 4 May 2026. Awaiting first build commit.
**Worktree:** `/Users/matt/CWORK/questerra`
**Branch:** `unit-editor-nm-block` (off `main` @ `eabeed9`)
**Baseline tests:** 3630 / 11 skipped (post-Lever-1 close)
**Deadline:** Matt's Wednesday class (6 May 2026) — soft deadline, smoke before class

---

## What this is

Move New Metrics (NM) configuration **out of the class-settings Metrics tab** and **into the Phase 0.5 lesson editor's block palette** as a new `New Metrics` category. Teachers register competency-element checkpoints on lessons by clicking elements in the palette; the chip appears at the top of the target lesson card. Removes the awkward "configure NM in one screen, then teach in another" split.

**The NM tab in class settings stays** but its content changes: the configuration wizard (`NMConfigPanel`) is unmounted; the results display (`NMResultsPanel`) stays. Tab is renamed `Metrics` → `NM Results`. NM is for competency tracking, not grading — separate surface, separate purpose.

**Out of scope (filed as `FU-NM-SCHOOL-ADMIN-CENTRALIZATION`, P2):** school-level admin toggle + principal-facing centralised dashboard. Real product capability, multi-day build, gated on Access Model v2 Phase 6 closure.

---

## Design decisions (signed off 4 May 2026)

1. **Visual representation: chip at top of lesson card.** Clicking an element in the palette adds the element ID to `class_units.nm_config.checkpoints[currentPageId].elements[]` via the existing API. A small chip renders at the top of the target lesson: `🎯 [element name] · ×`. Click × to remove. **No new ActivitySection is created** — checkpoints stay lesson-level metadata.
2. **Competency selector lives in the palette category header.** Above the element list inside the `New Metrics` accordion: `Competency: [Agency in Learning ▾]`. Reads/writes `nm_config.competencies[0]`. Switching competency filters the element list. One competency at a time per unit (today's reality).
3. **Class-settings Metrics tab → renamed `NM Results`.** `NMConfigPanel` unmounted (deleted from this surface; component file kept in case we need it elsewhere). `NMResultsPanel` stays as the only content. Banner at top: "NM checkpoints are configured in the lesson editor's New Metrics block category."
4. **School-gate stays per-teacher** for now (`teacher_profiles.school_context.use_new_metrics`). Centralisation is `FU-NM-SCHOOL-ADMIN-CENTRALIZATION`.

---

## Why this is safe

- **Data model unchanged.** `nm_config.checkpoints[pageId].elements[]` is the same shape, just edited via a different surface. All readers (student `ObservationSnap`, `CompetencyPulse`, results pages, assessment routes) stay identical.
- **No migration.** Same JSONB column on `class_units` / `units`.
- **No new tables.**
- **No new types.** Existing `NMUnitConfig` shape is the contract.
- **No regression risk for student-facing surfaces.** They read the same `nm_config.checkpoints` shape — agnostic to where it was edited.

---

## Sub-phase plan

| # | Scope | Files touched | Est | Stop trigger |
|---|---|---|---|---|
| **MM.0A** | This brief + design sign-off | `docs/projects/unit-editor-nm-block.md` | done | — |
| **MM.0B** | Add `"new_metrics"` to `BlockCategory` union + `CATEGORIES` lookup with gold dot. Generate one `BlockDefinition` per element of `nm_config.competencies[0]`. Gate the whole category on `school_context.use_new_metrics`. List-only — no click behavior yet. | `BlockPalette.tsx`, `LessonEditor.tsx`, `useLessonEditor.ts` | ~2 hrs | Block category renders with no school flag (privacy bug) |
| **MM.0C** | Click-to-add: clicking an NM element block writes to `class_units.nm_config.checkpoints[currentPageId].elements[]` via existing `/api/teacher/nm-config` POST. Visual: small chip at top of lesson card; click × to remove. | `BlockPalette.tsx`, lesson card component, possibly `useLessonEditor.ts` | ~3 hrs | Save fails silently, double-add creates duplicates, removal leaves zombie pageIds in checkpoints map |
| **MM.0D** | Competency selector in palette header. Reads/writes `nm_config.competencies` (single-element array — keep shape, replace contents). | `BlockPalette.tsx` | ~1.5 hrs | Switch loses elements (don't auto-erase elements when competency changes — warn instead) |
| **MM.0E** | Strip `NMConfigPanel` mount from class-settings Metrics tab. Rename tab `Metrics` → `NM Results`. Add banner "NM checkpoints are configured in the lesson editor's New Metrics block category." `NMConfigPanel.tsx` file stays untouched (kept for potential future reuse). | `/teacher/units/[unitId]/class/[classId]/page.tsx` | ~1 hr | NMResultsPanel breaks because it relied on NMConfigPanel side effects |
| **MM.0F** | Tests + fixtures: palette filter respects `use_new_metrics` flag, click-to-add round-trip persists, competency switch persists, removal idempotency, summary-tab read-only state | new test files | ~1.5 hrs | Test count drops from baseline (3630) — investigate before continuing |
| **MM.0G** | Registry sync: WIRING `unit-editor` entry mentions NM block-category affordance + adds `BlockPalette.tsx` to key_files. Schema-registry no change (existing column). | `WIRING.yaml`, scanner outputs | ~30 min | API-registry shows unexpected new routes (we shouldn't add any) |
| **Checkpoint MM.1** | Smoke: enable NM in `/teacher/settings` → editor shows category → click element → chip appears at top of target lesson → save → reload → chip persists → click × → save → student-facing checkpoint UI still works on the same lesson | live on prod after merge | gate before push to main |

**Total: ~10 hours, one focused day.** Wednesday 6 May class deadline gives a one-day buffer for patches.

---

## Stop triggers (any of these means pause + report)

- Block category visible to a teacher with `use_new_metrics === false` (privacy bug — could leak NM affordances to schools that haven't opted in)
- Click-to-add silently fails to persist (data loss)
- Removing a checkpoint leaves zombie `pageId` entries in the `checkpoints` map (storage pollution)
- Student-facing surfaces (`ObservationSnap` overlay, results pages) stop reading the new checkpoints — means we're writing to a different shape than they expect
- Test count drops below 3630 baseline (regression somewhere unrelated)

## Don't stop for

- Visual polish on the chip (rough rendering OK for v1)
- Pop-art look refinements (untouched in this phase)
- The `NMConfigPanel.tsx` file existing as dead code (keep for now — delete in v2 if confirmed unused)
- Drag-and-drop instead of click (Option B from the design doc — v2)
- Multi-competency support (one competency per unit is the current reality)
- The `FU-NM-SCHOOL-ADMIN-CENTRALIZATION` work (separate phase, gated on Access Model v2)

---

## Pre-flight ritual (before MM.0B)

1. Working tree clean: yes (just landed `eabeed9` saveme)
2. Tests green at baseline 3630: confirm with `npm test -- --run`
3. Re-read relevant Lessons:
   - **#54** — never trust WIRING summaries; grep. (Already verified `BlockPalette.tsx` exists at expected path; existing CATEGORIES structure confirmed.)
   - **#67** — tool-schema vs validator pattern bug — N/A here (no AI tool schemas changing)
   - **#69** — trigger bypass for fixtures — N/A here (no seed scripts)
4. Audit `BlockCategory` consumers — every file that switches on category must handle `"new_metrics"` or fall through to a safe default. Grep before MM.0B starts.

## What success looks like

By Wednesday morning, Matt opens the seeded smoke unit (or any class), goes to the lesson editor, sees a new "New Metrics" category in the Blocks pane (gold dot), expands it, picks "Agency in Learning" from the competency selector at the top, sees the agency elements listed, clicks one to add it as a checkpoint on the current lesson, sees the chip render at the top of that lesson card, saves, reloads, sees the chip persist, opens the unit on a student preview tab, sees the `ObservationSnap` checkpoint appear on the lesson — all without ever opening the class-settings Metrics tab. The Metrics tab still shows results for what's been recorded.

## Out of scope (parked)

- **Drag-and-drop** instead of click — UX upgrade, v2
- **Multi-competency per unit** — current reality is one; if needed, add later
- **School-admin centralisation + principal dashboard** — `FU-NM-SCHOOL-ADMIN-CENTRALIZATION` (P2, ~2-3 days, gated on Access Model v2 Phase 6)
- **Removing `NMConfigPanel.tsx` source file** — keep it for now; delete in v2 if confirmed unused
- **Bulk-add elements** (apply same elements to N selected lessons in one click) — v2 if requested
