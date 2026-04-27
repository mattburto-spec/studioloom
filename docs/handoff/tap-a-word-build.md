# Handoff — tap-a-word-build

**Last session ended:** 2026-04-27T07:14Z
**Worktree:** `/Users/matt/CWORK/questerra-tap-a-word`
**HEAD:** `b2d2a8f` "chore(registries): sync api-registry + ai-call-sites for /api/student/word-lookup"

## What just happened

- **Phase 1 of language-scaffolding-redesign SHIPPED in 3 sub-phases (1A → 1B → 1C).** 20 commits on `tap-a-word-build`, all pushed. Brief: [`docs/projects/language-scaffolding-redesign-phase-1-brief.md`](docs/projects/language-scaffolding-redesign-phase-1-brief.md). Master spec: [`docs/projects/language-scaffolding-redesign-brief.md`](docs/projects/language-scaffolding-redesign-brief.md) §3 Phase 1.
- **Phase 1A — scaffold + API + migration** (8 commits, 1A.1 verified). Tokenizer + sandbox + `/api/student/word-lookup` route with Lesson #39 stop_reason guard + `WordPopover` + `TappableText` + `useWordLookup` hook. Migration `20260426140609_word_definitions_cache.sql` minted via timestamp prefix discipline, applied to local dev.
- **Phase 1B — mounted on 5 surfaces** (7 commits). Pre-emptive portal-refactor of `WordPopover` (createPortal to document.body for safe positioning across chat scroll containers). MarkdownPrompt got an optional `tappable` prop. Mounts: ActivityCard prompts (×2 layouts) + ELL-1 hint card, LessonIntro, VocabWarmup (definition + example, term excluded — nested inside expand button), KitMentor, CheckInPanel (assistant role only), DesignAssistantWidget (assistant role only).
- **Phase 1C — pre-warm seed + gated live E2E** (4 commits + 1 registry sync). 575 design-vocab words across 10 categories in `scripts/seed-data/design-vocab-500.json`. Sandbox-aware seed script `scripts/preflight-tap-a-word-seed.mjs` with batched Haiku + cost tracking + `--dry-run` / `--sandbox` / `--concurrency` / `--limit` flags. Gated live test at `tests/e2e/word-lookup-live.test.ts` (skipped without `RUN_E2E=1`). Registries (api-registry + ai-call-sites) auto-synced — `stop_reason_handled: unknown` is scanner static-analysis limit; the runtime guard IS present at `src/app/api/student/word-lookup/route.ts:135-141`.
- **One regression caught + fixed mid-1A:** `render-path-fixtures.test.ts > no hardcoded claude-haiku-4-5-20251001 outside models.ts and tests` failed because the route initially declared `const MODEL = "claude-haiku-4-5-20251001"` as a string literal. Fixed in commit `c680dee` by importing `MODELS.HAIKU` from `@/lib/ai/models`. Lesson #40 family pre-flight miss — note for future briefs to grep for `no hardcoded` guard tests when adding new AI sites.

## State of working tree

- **Clean.** `HEAD == origin/tap-a-word-build == b2d2a8f`. 0 unpushed commits.
- **20 commits ahead of `main`** (`de7a540`):
  ```
  b2d2a8f chore(registries): sync api-registry + ai-call-sites for /api/student/word-lookup
  f6831b3 docs(wiring): record Phase 1C deliverables on tap-a-word entry
  0badb0f test(e2e): gated live word-lookup E2E (RUN_E2E=1) for Checkpoint 1.1 verification
  dcc3240 feat(seed): preflight-tap-a-word-seed script with batched Haiku + cost report + sandbox bypass
  e36f228 feat(seed): top 575 design-vocab words across 10 categories
  46cf1a8 docs(wiring): update tap-a-word entry to record Phase 1B mount surfaces
  6924e74 feat(ai-mentor): mount tap-a-word on KitMentor + DesignAssistantWidget + CheckInPanel (assistant role only)
  475ae22 feat(VocabWarmup): mount tap-a-word on definition + example (term excluded — nested in button)
  9448d30 feat(LessonIntro): mount tap-a-word on introduction.text
  4e0ce2b feat(ActivityCard): mount tap-a-word on prompt (both layouts) + hint strings
  6c71c3b feat(MarkdownPrompt): add optional tappable prop for tap-a-word leaf wrap
  45fd1e7 refactor(tap-a-word): portal WordPopover via createPortal — escape clipped-overflow ancestors
  c680dee fix(api): import MODELS.HAIKU instead of hardcoding model ID
  e78f610 docs(wiring): add tap-a-word system entry (Phase 1A scaffold)
  608537d feat(tap-a-word): TappableText + WordPopover + useWordLookup scaffold (no mounts)
  99c84e0 feat(api): /api/student/word-lookup route with sandbox + Lesson 39 guards
  eeb54a6 feat(tap-a-word): tokenizer with strict tappable rules + tests
  54f4472 feat(migration): word_definitions cache table + RLS read-anon
  e246d49 claim(migrations): reserve word_definitions_cache timestamp
  75e2f98 docs(phase-1): master brief for tap-a-word sub-phases 1A/1B/1C
  ```
- **Tests:** 2181 passed | 9 skipped | 139 files (the +1 file vs 1B baseline is the gated live E2E correctly skipped).
- **tsc:** 0 errors.
- **Build:** `NODE_OPTIONS=--max-old-space-size=4096 npm run build` exits 0. Default 2GB heap OOMs — this is environmental on this codebase, not a Phase 1 defect. Worth filing an FU to bake `--max-old-space-size` into the package.json `build` script.
- **Migration:** `20260426140609_word_definitions_cache.sql` applied to local dev. NOT applied to prod (gated on Checkpoint 1.1 sign-off + push to main).

## Next steps

- [ ] **Matt Checkpoint 1.1 verification** (the gated work this session ended on):
  - [ ] **Sandbox seed smoke** — verifies pipeline writes to DB cheaply:
    ```
    SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
      node scripts/preflight-tap-a-word-seed.mjs --sandbox --limit=10
    ```
    Expected: 10/10 ok, sandbox `[sandbox] definition of "<word>"` rows in `word_definitions`.
  - [ ] **Wipe sandbox sentinels before live run** (so they aren't cache-skipped):
    ```sql
    DELETE FROM word_definitions WHERE definition LIKE '[sandbox]%';
    ```
  - [ ] **Live seed run** (~$0.30 one-time, 575 words):
    ```
    SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… ANTHROPIC_API_KEY=… \
      node scripts/preflight-tap-a-word-seed.mjs
    ```
    Expected: ~575 processed, ~$0.30 total, ~2-3 min wall time.
  - [ ] **Live E2E test** (~$0.0005):
    ```
    RUN_E2E=1 ANTHROPIC_API_KEY=… npx vitest run tests/e2e/word-lookup-live.test.ts
    ```
    Expected: 1 passed, "ergonomics" definition returned in <5s.
  - [ ] **Browser visual smoke against dev server**:
    - Open a real lesson with `section.prompt` + `introduction.text` + `vocabWarmup` + AI mentor surfaces.
    - Tap 5 distinct words across (prompt / intro / vocab definition / hint / AI mentor message). Each opens a popover.
    - 2nd tap of same word = instant (no loading state, no second POST in network tab).
    - No layout regression in any of the 5 surfaces; popover not clipped inside chat scroll containers.
- [ ] **After Checkpoint 1.1 signs off:**
  - Run `saveme` to capture this branch's work into ALL-PROJECTS.md, dashboard, changelog, decisions-log.
  - Run `bash scripts/migrations/verify-no-collision.sh` (final pre-merge gate).
  - Apply migration `20260426140609_word_definitions_cache.sql` to PROD Supabase.
  - Merge `tap-a-word-build` → `main` (squash NOT recommended — 20 commits tell the story; per CLAUDE.md "Separate commits, no squashing").
  - Delete the worktree + local branch (`git worktree remove ../questerra-tap-a-word && git branch -d tap-a-word-build`).
- [ ] **Phase 2** (after Checkpoint 1.1 + merge): + L1 translation (single L1 from `learning_profile.languages_at_home[0]`), + audio button (browser SpeechSynthesis), + image slot (Wikimedia Commons + Open Symbols curated dictionary). Master spec: §3 Phase 2.

## Open questions / blockers

- **Toolkit-prompt mounts deferred.** Per planning sign-off, the 28 bespoke toolkit tools were excluded from Phase 1B. Decide post-1.1 whether to land them as a 1B refinement before Phase 2 OR fold into Phase 2's mount expansion.
- **OOM on default 2GB Node heap during `next build`** is an environmental ceiling on this codebase (~95K LOC). Not introduced by Phase 1 — confirmed on multiple branches. Worth a small FU: bake `NODE_OPTIONS="--max-old-space-size=4096"` into `package.json` `build` script for consistency with Vercel's default 8GB.
- **Scanner can't see runtime stop_reason guards.** `ai-call-sites.yaml` records the new word-lookup site as `stop_reason_handled: unknown` despite the guard being present. Same FU-5 family as the existing 6 student-api violations.
