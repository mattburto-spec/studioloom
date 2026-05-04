# Handoff — unit-editor-nm-block

**Last session ended:** 2026-05-04T11:30Z
**Worktree:** `/Users/matt/CWORK/questerra`
**HEAD:** `7a91e08` "Merge pull request #19 from mattburto-spec/unit-editor-nm-block"
**Branch state:** feature branch == origin/main (merged via PR #19, fast-forward pulled)

## What just happened

- **Lever-MM (NM block category in unit editor) SHIPPED end-to-end** — 7 sub-phases (MM.0A–MM.0G) in ~5 hours wall-clock against Matt's Wednesday-class deadline (6 May 2026). New Metrics configuration moved out of the class-settings Metrics tab into the lesson editor's block palette as a gold-dot "New Metrics" category. Click an element → chip lands at the top of the current lesson card with × remove. Competency selector inside the accordion. Class-settings Metrics tab keeps `NMResultsPanel` but loses `NMConfigPanel` mount + gains a banner pointing teachers to the editor.
- **Pure state-transition module landed** at `src/lib/nm/checkpoint-ops.ts` (3 immutable ops: addCheckpoint, removeCheckpoint, setCompetency) with reference-equal no-op detection for idempotency. 30 new tests covering all the rules.
- **`BlockPalette.tsx` split into 3 modules** (.tsx React component + `BlockPalette.types.ts` pure types + `nm-element-blocks.ts` pure factory) so the factory is testable from `.test.ts` without vitest tripping on JSX (Lesson #71 banked).
- **Merged to main as PR #19** at `7a91e08`. No conflicts this round (luck — preflight session was quiet).
- **`saveme` ritual completed:** changelog appended (full Lever-MM close-out), lessons-learned appended (#71), ALL-PROJECTS.md flipped Lever-MM → COMPLETE + status promoted, doc-manifest gained 2 new entries (brief + checkpoint-ops module), master CLAUDE.md timestamp updated.

## State of working tree

- `git status` clean of code changes; saveme additions in this commit
- 5 untracked unrelated docs left from prior sessions (same as last handoff): `landing-copy-story-b.md`, `landing-redesign-prompt.md`, `units-school-id-investigation-29-apr.md`, `brief-generator.md`, `studioloom-it-audit-2026-05-04-v2.docx` — none Lever-MM, owner-handle
- Tests: **3660 passing / 11 skipped** (post-merge baseline; +30 from Lever-MM)
- tsc strict: clean
- Pending push count: this saveme commit (will fast-forward to main)
- Local-only branches: `unit-editor-nm-block` is the working branch, exactly == origin/main after PR merge

## Next steps

- [ ] **Use Lever-MM in Wednesday's class** (6 May 2026) — that's the actual deadline that motivated the build. If anything looks wrong in real classroom use, file a hotfix follow-up.
- [ ] **Decide between four next-phase candidates:**
  - (a) **Lever 0 — Manual Unit Builder + AI Wizard Deprecation** (~5–7 days). Port the rigorous CBCI + Structure-of-Process + Paul-Elder unit planner from studioloom.org/unitplanner. New builder writes three-slot v2 sections natively. Wizard deprecation as a sub-phase. Brief still pending — Matt's stated preference for the next big phase.
  - (b) **`FU-PROD-MIGRATION-BACKLOG-AUDIT` (P1)** — Lever 1 surfaced this; still open. Prod is missing migration 051 + much of Access Model v2 schema. 1–2 days.
  - (c) **`FU-NM-SCHOOL-ADMIN-CENTRALIZATION` (P2)** — school-level NM toggle + principal-facing centralised dashboard. Multi-day, gated on Access Model v2 Phase 6 closure (school-admin role must exist first).
  - (d) **Levers 2–5** (lints, voice/personality, exemplar contrast, sequencing intuition) — all unlocked by Lever 1's structured payload, can land any time.
- [ ] **Drag-and-drop NM elements on lesson tiles** — `FU-LEVER-MM-DRAG-AND-DROP` (P3, informal). Click-only worked for v1; drag would be a UX upgrade for power users.
- [ ] **Multi-competency-per-unit** — `FU-LEVER-MM-MULTI-COMPETENCY` (P3, informal). v1 supports one per unit. If a teacher wants to track multiple competencies on the same unit (e.g. Agency in Learning + Communication), the selector would need to become multi-select + element list filter logic would need to handle the union.
- [ ] **30-day post-cutover soak watch on Lever 1** — track for unexpected legacy-fallback triggers in prod. If 30 days clean (latest 2026-06-03), proceed with Lever 1 sub-phase 1J: drop `prompt` NOT NULL constraint, remove all `composedPromptText` legacy-fallback branches, simplify validators to require slots only.

## Open questions / blockers

- **Skill auto-pin (`FU-LESSON-EDITOR-AUTO-PINNED-SKILL` P2)** still open. Surfaces during any fresh-class smoke. Investigation steps in the FU body. Worth picking up as a small warmup before bigger phases.
- **Migration backlog audit** is real and material. Lever 1 surfaced it; nothing has been done since. Either (a) apply the missing repo migrations to prod, or (b) audit which code paths assume columns that don't exist and rip them out. Decision pending.
- **`refresh-project-dashboard` scheduled task** — wasn't triggered this saveme; assumed it may not exist on this account. If it does exist, manual trigger might be appropriate.
- **CLAUDE.md compaction overdue** at 56KB — next quiet session.

_Lever-MM PR: https://github.com/mattburto-spec/studioloom/pull/19. Brief: docs/projects/unit-editor-nm-block.md. Pure state-transition module: src/lib/nm/checkpoint-ops.ts (canonical contract for nm_config mutations)._
