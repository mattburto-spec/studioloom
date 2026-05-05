# Handoff — lesson-quality-lever-1-slot-fields

**Last session ended:** 2026-05-04T06:30Z
**Worktree:** `/Users/matt/CWORK/questerra`
**HEAD:** `5373ea7` "Merge pull request #17 from mattburto-spec/lesson-quality-lever-1-slot-fields"
**Branch state:** feature branch == origin/main (merged via PR #17 then fast-forward pulled)

## What just happened

- **Lever 1 (slot fields) SHIPPED end-to-end** — 9 sub-phases (1A–1I) refactored activity prompts from a single markdown blob into three structured fields (`framing` / `task` / `success_signal`). Schema → AI generation → editor → renderer → 7 downstream readers all rewired. Migration `20260504020826_activity_three_field_prompt.sql` applied to prod. 55 Teaching Moves AI-rewritten + reseeded with v2 shape via Sonnet 4.5 `tool_use`. Tests 3494 → 3630 (+136, 0 regressions, tsc strict clean).
- **Smoke verified live on studioloom.org** — three-box `SlotFieldEditor` mounts, char-count caps enforce, slot fields prefill from seeded values, hybrid composition (muted framing → bold task → 🎯 success_signal) renders on student preview, legacy-only fallback works, partial-slots compose with the gap.
- **Merged to main as PR #17** (`5373ea7`). Two rounds of merge conflict resolution against parallel preflight session commits — both resolved cleanly.
- **`saveme` ritual completed:** decisions-log appended (6 Lever 1 decisions), lessons-learned appended (#67–#70), changelog appended (full Lever 1 close-out section), ALL-PROJECTS.md flipped Lever 1 → COMPLETE + added Lever 0 (Manual Unit Builder) as PROPOSED, doc-manifest gained 2 new entries (Lever 1 brief + seed script) with last_verified bumped, master CLAUDE.md timestamp updated.

## State of working tree

- `git status` clean of code changes; saveme adds in progress (CLAUDE.md, ALL-PROJECTS.md, decisions-log, lessons-learned, changelog, doc-manifest, master-index, scanner-reports — all need committing as the saveme commit)
- 5 untracked unrelated files left from prior sessions: `docs/landing-copy-story-b.md`, `docs/landing-redesign-prompt.md`, `docs/projects/units-school-id-investigation-29-apr.md`, `docs/specs/brief-generator.md`, `studioloom-it-audit-2026-05-04-v2.docx` — not Lever 1; left for owner to handle
- Tests: 3630 passing / 11 skipped (post-merge baseline)
- Pending push count: 0 commits ahead of origin/main (will increase to 1 after the saveme commit lands; will fast-forward main)
- Local-only branches: `lesson-quality-lever-1-slot-fields` is the working branch and exactly == origin/main after PR merge

## Next steps

- [ ] **Commit + push the saveme bundle** — single commit on this branch, push directly as fast-forward to main (branch is at the same commit as main, so push to origin/main is a clean FF)
- [ ] **Investigate `FU-LESSON-EDITOR-AUTO-PINNED-SKILL` (P2)** — surfaced during smoke. Lesson editor mounts a default "3D Printing: basic setup" skill on freshly-seeded lessons regardless of class topic. Filed in `docs/projects/dimensions3-followups.md`. Investigation steps in the FU body. Independent of Lever 1, picks up alongside Phase 0.5 lesson editor cleanup. Likely 1-2 hours.
- [ ] **Decide between three next-phase candidates:**
  - (a) **Lever 0 — Manual Unit Builder + AI Wizard Deprecation** (~5–7 days). Port the rigorous CBCI + Structure-of-Process + Paul-Elder unit planner from studioloom.org/unitplanner. New builder writes three-slot v2 sections natively. Wizard deprecation as a sub-phase (don't yank before the replacement lands). Brief pending. **Matt's stated preference for next** during smoke.
  - (b) **`FU-PROD-MIGRATION-BACKLOG-AUDIT` (P1)** — surfaced during seed: prod is missing migration 051 (`unit_type`) + much of Access Model v2 schema (`school_id`, `code`, etc.). Repo migrations have drifted hard from prod. Sister to FU-EE. Worth auditing what's actually applied before next push. Could be 1–2 days. ALSO: consider promoting this to a formal FU entry in dimensions3-followups.md (currently informal).
  - (c) **Levers 2–5** (lints, voice/personality, exemplar contrast, sequencing intuition) — all unlocked by Lever 1's structured payload, can land any time.
- [ ] **`FU-LEVER-1-SEED-IDEMPOTENT` (P3)** — seed script's units INSERT lacks `WHERE NOT EXISTS` guard; re-running creates duplicate units (Matt got 2 during smoke). Trivial fix when next touching `scripts/lever-1/seed-test-unit.sql`.
- [ ] **30-day post-cutover soak watch** — track for unexpected legacy-fallback triggers in prod. If 30 days clean (latest 2026-06-03), proceed with Lever 1 sub-phase 1J: drop `prompt` NOT NULL constraint, remove all `composedPromptText` legacy-fallback branches, simplify validators to require slots only.

## Open questions / blockers

- **`FU-PROD-MIGRATION-BACKLOG-AUDIT` should be promoted to a formal FU** in `docs/projects/dimensions3-followups.md` so it doesn't get lost. Currently mentioned in the changelog + ALL-PROJECTS narrative but not as its own FU entry. Consider doing this as part of the saveme commit.
- **Migration backlog is real and material** — at minimum, migration 051 + entire Access Model v2 schema work needs an "is this on prod?" audit. Code is shipping that names columns prod doesn't have (`unit_type` is referenced in the wizard). Either rip out the dead-code paths OR apply the migrations. Decision pending.
- **Compaction overdue** — `CLAUDE.md` is 56KB (well past the 30KB compaction threshold per the saveme rule). The "Current focus" paragraph has accumulated multiple "Earlier — / Previously —" tails. Worth doing a focused compaction pass when next on a quiet session — move the historical chunk to changelog.md and leave CLAUDE.md as current-state-only. Filed informally; not blocking.

_Smoke gates referenced in chat: 1A through 1I commit hashes in the brief at `docs/projects/lesson-quality-lever-1-slot-fields.md` § "Sub-phase status". Seed fixture at `scripts/lever-1/seed-test-unit.sql` (paste-ready for `mattburton@nanjing-school.com`)._
