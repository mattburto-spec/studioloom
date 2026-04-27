# Phase 1 — Tap-a-word v1 (definition only)

**Master spec:** [`docs/projects/language-scaffolding-redesign-brief.md`](language-scaffolding-redesign-brief.md) §3 Phase 1
**Phase 0 status:** ✅ SHIPPED, Checkpoint 0.1 PASSED (26 Apr 2026)
**Phase 1 status:** sub-phased into 1A → 1B → 1C
**Branch:** `tap-a-word-build` · **Worktree:** `/Users/matt/CWORK/questerra-tap-a-word`
**Test baseline (main @ de7a540):** 2159 passed · 8 skipped · 2167 total · 136 files (re-confirmed at Phase 1A pre-flight; main HEAD moved a49f2c9 → de7a540 via dashboard-v2-build merge during planning, unrelated to tap-a-word)

---

## Sub-phase plan

### Phase 1A — Scaffold + API + migration

Build all infrastructure with **zero UI mounts**. Smoke the end-to-end via the unit tests; visual smoke comes in 1B.

**Deliverables:**
- Migration `<TS>_word_definitions_cache.sql` + `.down.sql` (cache table + RLS read-anon)
- `src/components/student/tap-a-word/{tokenize,useWordLookup,WordPopover,TappableText,index}.{ts,tsx}` (5 files)
- `src/components/student/tap-a-word/__tests__/tokenize.test.ts`
- `src/lib/ai/sandbox/word-lookup-sandbox.ts` (sandbox bypass; `RUN_E2E=1` hits live Anthropic)
- `src/app/api/student/word-lookup/route.ts` + `__tests__/route.test.ts`
- WIRING.yaml: new `tap-a-word` entry (`status: planned`, `currentVersion: 0`)
- This brief committed first

**Test delta target:** baseline 2159 → ~2185 (~26 new tests: tokenizer ~14, route via sandbox ~6, popover state ~4 if straightforward)

**Matt Checkpoint 1A.1:**
1. `npm test` clean at new baseline
2. `npx tsc --noEmit --project tsconfig.check.json` clean
3. Migration applied to local dev (NOT prod); `\dt word_definitions` shows table; RLS enabled with one read policy
4. `RUN_E2E=1 vitest run src/app/api/student/word-lookup` against live Anthropic returns a definition for "ergonomics" in <2s
5. STOP AND REPORT before 1B

### Phase 1B — Mount on 5 surfaces (next instruction block, after 1A.1 sign-off)

Pure file-modification phase. Five mount points:
1. `MarkdownPrompt.tsx` — add optional `tappable={true}` prop (swaps `p`/`em`/`strong` leaf renderers to wrap in TappableText). Used by `ActivityCard.tsx:145, 162` for `section.prompt`.
2. `lesson-bold/LessonIntro.tsx:63` — wrap `{introduction.text}` in TappableText.
3. `VocabWarmup.tsx:35,42,45` — wrap `{term.term}` + `{term.definition}` + `{term.example}`.
4. `DesignAssistantWidget.tsx:283,323` — wrap assistant-role `msg.content` (NOT student-role).
5. `quest/CheckInPanel.tsx:481` — wrap assistant `msg.content`.
6. `discovery/KitMentor.tsx:115` — wrap `{message}`.

Hint strings inside ActivityCard's hint card are also tappable; ride along on the ActivityCard touch.

**Toolkit tool prompts deferred.** 28 bespoke tools — defer to a Phase 1B refinement after the core 5 surfaces verify.

**Matt Checkpoint 1B.1:** open a real lesson with all 5 surface types present, visual smoke confirms tap → popover on each. No layout regression. Test baseline updated for new mount tests.

### Phase 1C — Pre-warm seed + Checkpoint 1.1 (next-next instruction block)

- Pre-warm script `scripts/preflight-tap-a-word-seed.ts` (sandbox-aware): batched Haiku for top 500 design-vocab words. Sources words from Layer 1 design-teaching corpus glossary + manually curated list. Writes to `word_definitions` cache.
- Cost report: total tokens spent + estimated $/student-lesson session.
- **Matt Checkpoint 1.1** (the original spec checkpoint): tap 5 words distributed across (prompt / intro / vocab / hint / AI mentor message), each gets a popover, 2nd tap of same word is cache hit, RUN_E2E=1 live test passes, total spend <$0.02/student-lesson session.

---

## Scope boundaries (all sub-phases)

- ❌ Translation slot, audio slot, image slot — Phase 2
- ❌ Response Starters panel — Phase 3
- ❌ `student-learning-support` WIRING status flip → complete — Phase 5
- ❌ FU-5 retrofit on the 6 existing student-api `stop_reason` violations — out of scope (filed)
- ❌ Toolkit tool prompts — deferred to Phase 1B refinement
- ❌ Lesson editor changes for response-starter pre-generation — Phase 3 risk note
- ❌ Touching `student's own typed input` (per brief §2.1.1) — never tappable
- ❌ Touching dirty files on main (`docs/handoff/main.md`, `docs/landing-copy-story-b.md`)

---

## Stop triggers (do not paper over — Lesson #43)

- Cold-cache rate >20 unique uncached words per first-time student per lesson (Phase 1C measurement) → expand pre-warm before Checkpoint 1.1
- Migration apply error → diagnose, do not retry destructively (Lesson #51 PL/pgSQL var-name trap; this migration uses post-apply SELECT verify, not DO block)
- Any new call site lands without `stop_reason === "max_tokens"` guard (Lesson #39 — non-negotiable)
- `tsc --noEmit` red → fix before commit
- Test baseline regression (any test that was passing now fails) → fix before commit

---

## Don't-stop-for list

- Visual polish on `WordPopover` micro-animations (Phase 1A ships utilitarian; tune in Phase 2)
- Markdown nesting beyond `p`/`em`/`strong` (the existing MarkdownPrompt allowlist)
- Image dictionary licensing audit (Phase 2 concern)
- TTS voice-quality testing (Phase 2 risk)
- Per-rule ack labels (PH5-FU-PER-RULE-ACKS — different system)

---

## Lessons to re-read (FULL TEXT, not titles)

- **#26** [`docs/lessons-learned.md:92`](../lessons-learned.md) — schema field order
- **#29** `docs/lessons-learned.md:101` — RLS + junction silent-zero
- **#38** `docs/lessons-learned.md:141` — verify expected values, not non-null
- **#39** `docs/lessons-learned.md:153` — Anthropic stop_reason guard + defensive `?? []`
- **#41** `docs/lessons-learned.md:205` — NC reverts on uncommitted files use Edit tool
- **#43–46** `docs/lessons-learned.md:241-309` — Karpathy discipline (assumptions, simplicity, surgical, goal-driven)
- **#51** `docs/lessons-learned.md:383` — PL/pgSQL var names + RLS dashboard parser
- **#52** `docs/lessons-learned.md:422` — REVOKE FROM PUBLIC + anon + authenticated (all three)

---

## Audit trail

- 26 Apr 2026: Phase 0 SHIPPED + Checkpoint 0.1 PASSED. AutonomyPicker rolled back. Migration 122 applied to local dev only (prod never saw the column).
- 26 Apr 2026 (planning session): Phase 1 sub-phased 1A/1B/1C with Matt sign-off. Toolkit-prompt mounts deferred to 1B refinement. Audit findings: brief AI-mentor file names were aspirational (real files: KitMentor / CheckInPanel / DesignAssistantWidget). Migration uses TIMESTAMP prefix (brief §6.1 numbering 117/118/119 superseded by discipline v2). HEAD drifted a49f2c9 → de7a540 mid-planning via parallel dashboard-v2-build merge — base for tap-a-word-build is de7a540.
