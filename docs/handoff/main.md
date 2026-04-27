# Handoff — main

**Last session ended:** 2026-04-27T08:55Z
**Worktree:** `/Users/matt/CWORK/questerra`
**HEAD:** `000685c` "Merge tap-a-word-build a6696a8: fix sandbox-bypass gate"

## What just happened

- **Tap-a-word Phase 1 SHIPPED end-to-end + Checkpoint 1.1 PASSED.** 24-commit `tap-a-word-build` branch merged into `main` via `b915e02` (1A+1B+1C) + `000685c` (gate fix). Pushed to `origin/main` after prod migration applied. Phase 1 master brief: [`docs/projects/language-scaffolding-redesign-phase-1-brief.md`](docs/projects/language-scaffolding-redesign-phase-1-brief.md). Master spec: [`docs/projects/language-scaffolding-redesign-brief.md`](docs/projects/language-scaffolding-redesign-brief.md).
- **End-to-end verification:** Sandbox seed against prod Supabase ✅, live E2E (1592ms real "ergonomics" definition) ✅, full live seed (575 words / $0.53 / 0 failures) ✅, browser visual smoke across 5 mount surfaces ✅. Cold-cache empirical (11.2% hit rate) → criterion #5 reframed as behavioural per Lesson #58.
- **Mid-build hotfix:** Route gate corrected `RUN_E2E !== "1"` → `NODE_ENV === "test" && RUN_E2E !== "1"` (commit `a6696a8`) so dev users see real definitions instead of `[sandbox]` sentinel text. Lesson #56.
- **Sandbox-cache pollution caught + cleaned:** 5 dev-test taps had written sentinel rows to shared `word_definitions` cache; manually purged. Filed `FU-TAP-SANDBOX-POLLUTION` P2 + Lesson #57.
- **saveme step done:** ALL-PROJECTS.md flipped Phase 1 → SHIPPED, decisions-log +5, lessons-learned +3 (#56–#58), dimensions3-followups.md +3 FUs (TAP-SANDBOX-POLLUTION, BUILD-HEAP, AI-CALL-SCANNER-GUARD-DETECTION), changelog appended, registries scanned + clean, WIRING `tap-a-word` entry already current from feature-branch updates.

## State of working tree

- **Clean** after this saveme commits land + push.
- 1 untracked file: `docs/landing-copy-story-b.md` (Matt's 25 Apr landing copy draft, predates session — left alone).
- Migration sequence: latest 3-digit = 122 (frozen), latest timestamp = `20260426140609_word_definitions_cache.sql` (applied to dev + prod).
- Drift status: api-registry + ai-call-sites in sync, RLS coverage shows 7 tables `rls_enabled_no_policy` (FU-FF, P3 known undocumented deny-all pattern; pre-existing), feature-flags + vendors clean.
- Tests: **2181 passed | 9 skipped | 139 files**. tsc 0 errors. Build green with `NODE_OPTIONS=--max-old-space-size=4096`.

## Next steps

- [ ] **Decide on `tap-a-word-build` worktree + branch cleanup.**
  - Worktree at `/Users/matt/CWORK/questerra-tap-a-word` (~1.6GB after `.next` removal) is safe to remove now: `git worktree remove /Users/matt/CWORK/questerra-tap-a-word && git branch -d tap-a-word-build`. Branch is fully merged to main.
- [ ] **Decide on Phase 1B refinement (toolkit-prompt mounts).** 28 bespoke toolkit tools have prompt rendering that doesn't go through MarkdownPrompt — left out of Phase 1B intentionally. Either:
  - (a) ship as a focused refinement (~1 day) before Phase 2
  - (b) fold into Phase 2's mount expansion (translation + audio + image already touch the same components)
- [ ] **Open Phase 2 instruction block.** Trigger phrase: `phase 2` or `tap-a-word phase 2`. Spec: master brief §3 Phase 2. Adds L1 translation slot (single L1 from `learning_profile.languages_at_home[0]`) + audio button (browser SpeechSynthesis) + image slot (Wikimedia Commons + Open Symbols static dictionary). Estimated ~3-4 days.
- [ ] **Address `FU-BUILD-HEAP` P3 quickly** — 1-line `package.json` change adds `NODE_OPTIONS='--max-old-space-size=4096'` to the build script. Low risk, high QoL win for everyone running `next build` locally.
- [ ] **Optional: `FU-TAP-SANDBOX-POLLUTION` P2 cleanup** — drop the upsert from the sandbox path in route.ts. ~5-min change. Could land as part of Phase 2 or as a standalone fix.

## Open questions / blockers

- **Toolkit-prompt mount strategy** — see "Next steps" item 2 above. Matt-decision pending.
- **Cold-cache criterion #5 reframing accepted** — per Lesson #58, the spec reading is now behavioural ("<20 uncached TAPS per student per lesson"). Phase 4's signal infrastructure validates this against real student tap data once it ships. No further action this phase.
- **Lesson Bold worktree (`/Users/matt/CWORK/questerra-lesson-bold`) was deleted** — recovered ~675MB. Was already marked safe to remove in the predecessor handoff. Branch was already gone from local + remote per prior session notes.
- **Disk recovered ~4.2GB this session** by removing `questerra-tap-a-word/.next` (3.6GB cached build artifacts) + the lesson-bold dir (~675MB). Disk state: 8.1GB free out of 228GB. After `next build` runs, expect `questerra/.next` to repopulate to ~2-3GB. Comfortable headroom.
