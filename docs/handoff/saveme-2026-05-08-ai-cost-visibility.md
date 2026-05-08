# Handoff — saveme-2026-05-08-ai-cost-visibility

**Last session ended:** 2026-05-08T06:10Z
**Worktree:** /Users/matt/CWORK/questerra
**HEAD:** 1e1c915 "AI provider abstraction — Phase A (chokepoint helper + 18 SDK callers migrated) (#122)"

## What just happened

This branch is the saveme-only branch for the 8 May session — code already shipped via PRs #116, #119, #121 against main. The branch contains docs sync only:

- **Three PRs merged to main** end-to-end on AI cost visibility:
  - PR #116 — admin per-student token breakdown view + day-boundary helper + reconciliation gap callout (49→58 tests, +9 unit tests)
  - PR #119 — bridge fix attributing studentId in 5 student-facing routes (2 added missing logUsage calls; 3 added studentId arg). Catches the gap PR #116 surfaced.
  - PR #121 — word-lookup token diet (~840→750 input tokens per call; quality preserved by moving constraints into a `system` prompt + minimal tool schema + 200-char context cap)
- **Phase A.2 (PR #122 by another session) cleanly absorbed** PR #119's inline logUsage and PR #121's prompt optimizations through the new `callAnthropicMessages()` helper at [src/lib/ai/call.ts](src/lib/ai/call.ts). Confirmed end-of-session — minimal tool schema ✅, system prompt ✅, terse userPrompt ✅, 200-char cap ✅, all preserved.
- **Lesson #73 banked** — cap counters and usage logs are independent pipelines; bills can rise without leaving an attribution trail. Pair them with a chokepoint helper (now Phase A.2) AND a reconciliation gap detector (now PR #116) for defence in depth.

## State of working tree

- Branch: `saveme-2026-05-08-ai-cost-visibility` cut from `origin/main` at `1e1c915`
- Doc updates staged: `docs/api-registry.yaml` (header date + 2 new routes from scanner), `docs/projects/WIRING.yaml` (ai-budget summary + key_files extended), `docs/changelog.md` (session entry at top), `docs/lessons-learned.md` (#73 appended), `docs/doc-manifest.yaml` (4 entries' last_verified bumped to 2026-05-08)
- All code work for this session is on origin/main already; this branch is doc-only
- Pending push: 1 commit (the saveme commit, when made)
- Stashed unrelated WIP: `stash@{0}` "wip: pre-saveme" on `task-system-architecture-oq-resolution` — restore on return to that branch

## Next steps

- [ ] Open the saveme PR + auto-merge when CI green
- [ ] Trigger `refresh-project-dashboard` scheduled task at the CWORK level (master index update). Note: task lives outside questerra; run it from `/Users/matt/CWORK/`. If MCP not available, note skipped in this handoff.
- [ ] (Optional, deferred) Add `$ cost` column to the per-student breakdown table — `ai_usage_log.estimated_cost_usd` is already populated by `logUsage`; ~10-line UI addition. Matt to call it later if useful.
- [ ] (Optional, deferred) Toolkit attribution (kanban-ideation, scamper, etc.) — Phase A.2/A.3 will absorb them into `callAnthropicMessages()` automatically when their routes migrate.

## Open questions / blockers

_None._ The AI cost visibility thread is closed. Phase B (provider switching — DeepSeek/Qwen/Moonshot at 5-10x cheaper than Haiku) and Phase C (prompt caching via the central helper) are the next strategic levers but those are scheduled separately and not blockers for the current pilot.
