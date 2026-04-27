# Phase 2 — Tap-a-word v2 (translation + audio + image + toolkit mounts)

**Master spec:** [`docs/projects/language-scaffolding-redesign-brief.md`](language-scaffolding-redesign-brief.md) §3 Phase 2
**Phase 1 status:** ✅ SHIPPED 27 Apr 2026 (1A+1B+1C). Checkpoint 1.1 PASSED. Branch merged + pushed to `origin/main`. 24+ commits + 3 hotfix/saveme commits.
**Phase 2 status:** sub-phased into 2A → 2B → 2C → 2D
**Branch:** `tap-a-word-phase-2-build` · **Worktree:** `/Users/matt/CWORK/questerra-tap-a-word-2` (to be created)
**Test baseline (post-Phase 1, on `main` @ `dc193bc`):** 2181 passed · 9 skipped · 2190 total · 139 files

---

## What Phase 2 adds

The Phase 1 popover has 1 slot: **definition**. Phase 2 grows it to 4 slots:

```
┌─────────────────────────────┐
│ ergonomics                  │  ← word
│ The science of designing... │  ← definition (Phase 1)
│ 人体工学                    │  ← L1 translation slot (Phase 2A)  🔊  ← audio button (Phase 2B)
│ Example: Good ergonomics... │  ← example (Phase 1)
│ [image of person at desk]   │  ← image slot (Phase 2C)
└─────────────────────────────┘
```

Plus mounts on the 28 toolkit tool prompts (Phase 2D — folded in from the deferred 1B refinement per planning sign-off).

---

## Sub-phase plan

### Phase 2A — Translation slot + L1 wiring

**Goal:** Add the L1 translation slot to WordPopover. Read `learning_profile.languages_at_home[0]` from the student's profile. Wire through useWordLookup → API → cache (the composite PK already supports it: `(word, language, context_hash, l1_target)` was shipped Phase 1A).

**Deliverables:**
- Modify `WordPopover.tsx` — add Translation slot under definition, render only when `l1Translation` present + `l1_target !== 'en'`
- Modify `useWordLookup.ts` — fetch student's `learning_profile.languages_at_home[0]` once per page-session (cache in hook), pass `l1Target` in body
- Modify `/api/student/word-lookup/route.ts` — accept `l1Target` in body, query cache with that target, on miss bump max_tokens (250 → 400) + extend Anthropic prompt to ask for translation, write both `definition` + `l1_translation` to cache
- Extend `lookupSandbox` — return `l1_translation` for known words (helpful for sandbox tests)
- Update `tests/e2e/word-lookup-live.test.ts` — assert L1 translation returned for `l1Target: 'zh'`
- Add new unit tests for the L1 path
- WIRING.yaml `tap-a-word` entry: bump `currentVersion: 0` → `currentVersion: 1` once translation ships (still status `planned` until Phase 5)

**Test delta target:** baseline 2181 → ~2196 (~15 new tests)

**Matt Checkpoint 2A.1:**
1. Set a test student's `learning_profile.languages_at_home = ["Mandarin"]`
2. Tap "ergonomics" in browser → popover shows definition + 中文 translation
3. Switch student to Korean → tap same word → cache hit on definition, fresh L1 cache miss on Korean translation, popover shows definition + 한국어
4. `npm test` clean, tsc clean, RUN_E2E=1 live test passes

### Phase 2B — Audio button (browser SpeechSynthesis)

**Goal:** Add the audio button. Pure browser API (no network, no API spend). Pronounces the word (not the definition) using the L1 voice if available, else default voice.

**Deliverables:**
- Modify `WordPopover.tsx` — add 🔊 button next to translation. On click: `window.speechSynthesis.speak(new SpeechSynthesisUtterance(word))`. Voice selection: prefer `lang === l1Target` voice if available, else default. Stop any in-flight speech on close.
- Add `src/components/student/tap-a-word/useTextToSpeech.ts` — hook wrapping SpeechSynthesis with: voice selection, isSpeaking state, speak(text), cancel()
- Add `tests/components/student/tap-a-word/useTextToSpeech.test.ts` — mock `window.speechSynthesis`, test voice selection logic, test cancel-on-unmount
- Brief notes: SpeechSynthesis support in Chromebook fleet — verify on the school's Chromebook OS version for the 6 supported L1 languages (en/zh/ko/ja/es/fr) before sign-off. Per spec §7 stop-trigger: "Browser TTS unsupported on school Chromebook fleet for any of the 6 L1 languages" → fall back to disabling the audio button (don't break the popover).

**Test delta target:** ~+8 tests

**Matt Checkpoint 2B.1:**
1. Tap a word → popover shows definition + translation + 🔊 button
2. Click 🔊 → audio plays, button shows "playing" state
3. Click 🔊 again or close popover → audio stops
4. Test with student set to Mandarin: 🔊 pronounces in Mandarin voice (if Chromebook has the voice)

### Phase 2C — Image slot + curated dictionary

**Goal:** Add the image slot. Static curated mapping of word → CDN URL committed to repo. Sources: Wikimedia Commons (free, permanent CDN URLs) + Open Symbols (CC-licensed AAC pictographs). ~2000 entries.

**Deliverables:**
- Build `src/lib/tap-a-word/image-dictionary.json` — JSON object `{ word: imageUrl }` with ~2000 entries. Sourced from manual curation + Wikimedia category browsing (e.g. `Category:Geometric_shapes`, `Category:Hand_tools`, `Category:Materials`).
- Build `src/lib/tap-a-word/image-dictionary.ts` — typed loader exporting `imageForWord(word: string, language?: string): string | null`. No fuzzy matching — exact lowercase match only (cheap, predictable).
- Build `scripts/build-image-dictionary.mjs` — regenerate the JSON from a CSV input (so future expansion is data-driven, not code-driven). Supports `--source=wikimedia | --source=open-symbols | --source=manual`.
- Modify `WordPopover.tsx` — add image slot below example sentence. Render only when `imageForWord(word)` returns non-null. Lazy-load (`<img loading="lazy">`). Falls back gracefully when image fails (hide slot, don't show broken-image icon).
- Modify `useWordLookup.ts` — after fetch, call `imageForWord` synchronously to populate `imageUrl` field. (Image lookup is local — no API call, no cache.)
- Tests: `tests/lib/tap-a-word/image-dictionary.test.ts` — assert known words return URLs, unknown words return null, case-insensitive lookup works

**Image strategy locked decisions (per master spec §3 Phase 2):**
- Source: Wikimedia Commons + Open Symbols (CC-licensed AAC pictographs used by speech therapists)
- ~2000 entries committed to repo as JSON manifest (no AI image generation, no per-request licensing fees)
- License audit happens at curation-time, not request-time
- No fuzzy matching (exact lowercase match)
- Lazy-load on render

**Test delta target:** ~+10 tests

**Matt Checkpoint 2C.1:**
1. Tap "ergonomics" → popover shows definition + translation + audio + image of person at ergonomic desk
2. Tap a word with NO image entry → popover renders without image slot (no broken icon)
3. View source — 2000-entry JSON committed, build script works against test CSV input

### Phase 2D — Toolkit prompt mounts (folded in from 1B refinement)

**Goal:** Mount TappableText on the 28 bespoke toolkit tools' prompt rendering. Each tool has its own JSX layout — audit + wrap surgically.

**Deliverables:**
- Audit pass (~30 min): grep for `prompt={` and `prompt:` in `src/components/student/toolkit/` → enumerate every tool's prompt-render site
- For each of the ~28 tools: wrap the prompt text in `<TappableText>` (or migrate to MarkdownPrompt with `tappable={true}` if the tool already accepts markdown — check per tool)
- Add a test fixture: render each toolkit tool with a mock prompt containing a tappable word, assert the wrapping primitive is present
- Update WIRING.yaml `tap-a-word` `affects:` to add `toolkit`

**Test delta target:** ~+5 tests (1 per major tool category, not 28 individually)

**Matt Checkpoint 2D.1 + Phase 2 close:**
1. Open SCAMPER (or any toolkit tool) → tap a word in the prompt → popover opens with full Phase 2 functionality (definition + translation + audio + image)
2. Spot-check 3 other toolkit tools — same behaviour
3. Full test suite green (target ~2220 passed | 9 skipped)
4. Visual smoke on lesson page confirms no Phase 1 regression
5. Cost report: Phase 2 added ~$0.20 to per-class lifetime spend (mostly L1 translations)

---

## Scope boundaries (all sub-phases)

- ❌ Response Starters panel — Phase 3
- ❌ Signal-driven scaffold-fading — Phase 4
- ❌ `student-learning-support` WIRING status flip → complete — Phase 5
- ❌ FU-5 retrofit on the 6 existing student-api `stop_reason` violations — out of scope (filed)
- ❌ Image dictionary expansion beyond initial 2000 entries — separate ongoing curation task
- ❌ Per-word audio recording — out of scope (use SpeechSynthesis only per spec §8 don't-stop-for)
- ❌ Voice-quality testing across multiple browsers — Chromebook-only verification per spec
- ❌ L1 array reordering UI in Studio Setup — separate FU after Phase 2 ships
- ❌ Touching the 5 existing Phase 1 mount surfaces (they already work; Phase 2 only ADDS to the popover, not changes the mounts)

---

## Stop triggers (do not paper over — Lesson #43)

- Browser SpeechSynthesis unsupported on school Chromebook fleet for any of the 6 L1 languages → fall back to disabling audio button (don't break popover) + file FU
- Image lookup latency >50ms p95 (synchronous, in-memory) → investigate JSON parse / Map build cost
- L1 translation cost projection breaches $0.05/student-lesson → audit translation prompt token usage
- Any new call site lands without `stop_reason === "max_tokens"` guard (Lesson #39 — non-negotiable)
- `tsc --noEmit` red → fix before commit
- Test baseline regression (any Phase 1 test that was passing now fails) → fix before commit
- Wikimedia / Open Symbols license terms changed since curation → image dictionary rebuild required

---

## Don't-stop-for list

- Visual polish on WordPopover — utilitarian Phase 1A look stays through Phase 2; tune in Phase 3
- Pixel-perfect image alignment / cropping — keep simple, lazy-load, fail gracefully
- Curating beyond 2000 image entries — ship the initial set, let signal data drive expansion
- Per-rule audio voice selection beyond `lang === l1Target` match — basic preference logic only
- Synchronous-vs-async image lookup architecture debate — synchronous is fine for 2000 entries

---

## Lessons to re-read (FULL TEXT, not titles)

- **#26** [`docs/lessons-learned.md:92`] — schema field order
- **#39** `docs/lessons-learned.md:153` — Anthropic stop_reason guard + defensive `?? []` (still non-negotiable for any new AI call site)
- **#41** `docs/lessons-learned.md:205` — NC reverts on uncommitted files use Edit tool
- **#43–46** `docs/lessons-learned.md:241-309` — Karpathy discipline
- **#56** `docs/lessons-learned.md` — test/sandbox conflation (keep the NODE_ENV gate pattern; don't undo Phase 1's gate fix)
- **#57** `docs/lessons-learned.md` — sandbox writes pollute shared cache (when bumping route's max_tokens for L1 translation, audit if the upsert path could accidentally write partial / sandbox data)
- **#58** `docs/lessons-learned.md` — empirical hit-rate smoke (run `cold-cache-smoke.mjs` after L1 translations land to measure translation hit-rate against real lessons)

---

## Pre-flight ritual (every sub-phase)

1. `git status` clean, on correct branch (`tap-a-word-phase-2-build`), expected HEAD
2. `npm test` baseline matches expected (2181/9/139 at start of 2A; updated per sub-phase)
3. `npx tsc --noEmit --project tsconfig.check.json` baseline 0 errors
4. `bash scripts/migrations/verify-no-collision.sh` clean (Phase 2 has NO new migrations — verify by `ls supabase/migrations/` shows only Phase 1's `20260426140609_word_definitions_cache.sql` plus existing 000-122)
5. Audit-before-touch: re-read the spec section for the sub-phase, grep the components I'll modify
6. STOP AND REPORT findings + ASSUMPTIONS block. Wait for sign-off.

---

## Decisions locked from Phase 1 closeout (27 Apr 2026)

| Decision | Locked value | Captured in |
|---|---|---|
| Toolkit-prompt mounts disposition | **Folded into Phase 2D** (not a standalone 1B refinement) — Phase 2 already touches these components when adding new popover slots; co-locate the audit | This brief + handoff/main.md |
| Cold-cache criterion #5 reading | **Behavioural** (taps, not page inventory) — measured empirically post-launch via Phase 4 signal infrastructure | Lesson #58, decisions-log 27 Apr |
| Sandbox cache pollution | Will be fixed in Phase 2A as a side-fix when `route.ts` is touched (drop the upsert from sandbox path per FU-TAP-SANDBOX-POLLUTION) | This brief §2A scope |

---

## Cost projection

| Site | Phase 1 baseline | Phase 2 add | Per-class lifetime |
|---|---|---|---|
| Definition (Phase 1) | $0.0001/word, ~$0.0005/student-lesson | unchanged | ~$0.30 (one-time seed) + ~$0.005 ongoing |
| L1 translation (Phase 2A) | n/a | ~$0.0001/word/L1 (extra max_tokens) | ~$0.20 across 6 L1 targets |
| Audio (Phase 2B) | n/a | $0 (browser API) | $0 |
| Image (Phase 2C) | n/a | $0 (static dictionary) | $0 |

**Total Phase 2 added cost:** ~$0.20/class lifetime. Negligible.

---

## Files this brief touches (delivery output)

- ✅ NEW: `docs/projects/language-scaffolding-redesign-phase-2-brief.md` (this file)
- 🔜 PHASE 2A: WordPopover/useWordLookup/route modifications + ~5 unit tests
- 🔜 PHASE 2B: useTextToSpeech.ts + WordPopover audio button + 8 unit tests + Chromebook smoke
- 🔜 PHASE 2C: image-dictionary.{json,ts} + build-image-dictionary.mjs + WordPopover image slot + 10 unit tests
- 🔜 PHASE 2D: ~28 toolkit tool component edits + 5 fixture tests + WIRING affects update

---

## Audit trail

- 27 Apr 2026: Phase 1 SHIPPED + Checkpoint 1.1 PASSED. Toolkit-prompt mounts deferred from 1B as a planning decision.
- 27 Apr 2026: Phase 2 brief authored. Sub-phases 2A → 2B → 2C → 2D defined. Toolkit prompts folded in as 2D per Step 2 decision in main handoff.
