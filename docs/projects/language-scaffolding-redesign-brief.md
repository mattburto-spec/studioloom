# Language Scaffolding Redesign — Pre-Build Spec

**Status:** Phase 0 ✅ SHIPPED + Checkpoint 0.1 PASSED (26 Apr 2026). Phases 1–5 awaiting next session.
**Mode:** Pivot from configuration to invocation.
**Worktree at brief time:** `/Users/matt/CWORK/questerra-lesson-bold` on `lesson-bold-build` @ `c8a194d`. All commits pushed.
**Test baseline at brief time:** 1952 passed · 8 skipped · 1960 total · 127 files.
**Test baseline after Phase 0:** 1942 passed · 8 skipped · 1950 total · 127 files (−10, all autonomy/migration-116 tests removed).
**Last updated:** 26 Apr 2026.

---

## 0. One-line goal

Replace the AutonomyPicker (configuration model — student picks a "support level" up front) with two inline invocation affordances — **Tap-a-word** and **Response Starters** — students summon when they need help on the artefact in front of them.

---

## 0.5 Decisions Matt has locked (do not re-litigate)

| Decision | Locked value | Captured in |
|---|---|---|
| Q1: AutonomyPicker disposition | **(a) Pivot** — delete entirely | §2.2, §3 Phase 0 |
| Q2: WIRING `student-learning-support` drift | **(i) Fix mid-build** — flip to `status: planned` + new follow-up `FU-LS-DRIFT` | §1.5, §3 Phase 0 |
| Q3: Tap-a-word translation scope | **Single L1** from `learning_profile.languages_at_home[0]` | §4 Q3 |
| Q4: Fade trigger | **My pick — taps_per_100_words rolling 5-lesson average + RS-secondary + teacher override + invocation floor** | §4 Q4 (rationale + tier mapping) |
| Phase 1 mount surface | **Full surface set, not narrow** — prompt + intro + vocab + hints + sentence starters + AI mentor output + toolkit prompts + source material | §3 Phase 1 |
| Image source (Phase 2) | **Wikimedia Commons + Open Symbols** | §3 Phase 2 |
| Sandbox approach | **Threaded into every phase from day 1**, not retrofit at end | §3 Phase 1, Phase 3, Phase 5 (collapsed) |

Override any of these by saying so before the relevant phase starts.

---

## 1. Audit findings (what exists today)

### 1.1 Studio Setup — onboarding flow

- **Component:** `src/components/student/StudioSetup.tsx` (809 lines). 4-screen flow on first login: mentor pick (Kit/Sage/Spark) → theme pick (Clean/Bold/Warm/Dark) → mentor conversation (intake survey, skippable) → welcome reveal.
- **WIRING:** `student-onboarding`, status `complete`, currentVersion 1.
- **API:** `/api/student/studio-preferences` (GET, POST, PATCH) — writes `students.mentor_id`, `students.theme_id`, and `students.fabrication_notify_email`.
- **Intake survey API:** `/api/student/learning-profile` (GET, POST, PATCH) — writes `students.learning_profile` JSONB with: `languages_at_home[]`, `countries_lived_in[]`, `design_confidence` (1-5), `working_style` ("solo"/"partner"/"small_group"), `feedback_preference` ("private"/"public"), `learning_differences[]` (`adhd|dyslexia|dyscalculia|autism|anxiety|other`). Set-once, no overwrite by design.
- **Schema-registry classification of `learning_profile`:** `pii: false, student_voice: true, safety_sensitive: true, ai_exportable: full`. Already governed.

**What Studio Setup DOES NOT capture today:**
- Language scaffolding level ("More / Standard / Challenge")
- Text size / dyslexia-friendly font / high contrast
- Video captions toggle / image alt-text toggle
- Default response type
- Translation target language

These were *aspirational* in the conversation that drove this brief. None exist as schema, code, or UI. **The brief's premise that Studio Setup needs trimming is wrong — it needs to NOT GROW into things the redesign now obviates.**

### 1.2 In-lesson scaffolding code (current reality)

The "4-toggle in-lesson drawer" referenced in the original brief **does not exist as code.** It exists only as 5 mockup HTML files in `docs/newlook/StudioSetupDrawer-mockup.html` (v1–v5). What's actually shipped on the lesson page is:

- **`AutonomyPicker`** (Sub-Phase 3 of Lesson Bold, shipped this session):
  - `src/components/student/lesson-bold/AutonomyPicker.tsx` — 3-up card picker: Scaffolded / Balanced / Independent.
  - Mounted between LessonIntro and SkillRefsForPage in `src/app/(student)/unit/[unitId]/[pageId]/page.tsx`.
  - Persists via **migration 121** → `student_progress.autonomy_level TEXT CHECK IN ('scaffolded','balanced','independent')`. Applied to local dev only (verified 24 Apr).
  - Drives gating in `src/components/student/ActivityCard.tsx` via 5 helpers in `lesson-bold/helpers.ts`:
    - `resolveAutonomyDisplay(level | null) → AutonomyLevel` (NULL → 'balanced')
    - `hintsAvailable(level) → boolean` ('independent' hides)
    - `hintsOpenByDefault(level) → boolean` ('scaffolded' opens)
    - `exampleVisible(level) → boolean` ('independent' hides)
    - `exampleOpenByDefault(level) → boolean` ('scaffolded' opens)
  - Hint UI: amber unlocked card with try-first button (3 min effort gate).
  - Tests: 8 (in `lesson-bold/__tests__/shell.test.tsx`).

**Status under the pivot:** AutonomyPicker becomes the rollback target. See §6.

### 1.3 Sentence Starters — already exist as authored content

- **Type:** `EllScaffolding` in `src/types/index.ts`:
  ```ts
  ell1?: { sentenceStarters?: string[]; hints?: string[] };
  ell2?: { sentenceStarters?: string[] };
  ell3?: { extensionPrompts?: string[] };
  ```
- Authored teacher-side per `ActivitySection`. Fed to `ResponseInput` as a `sentenceStarters` prop. Currently rendered as inline chips above the textarea.
- **Word Bank concept does not exist** — no field on `ActivitySection`, no UI affordance.

### 1.4 ELL level

- **Storage:** `students.ell_level INTEGER NOT NULL DEFAULT 3 CHECK (ell_level BETWEEN 1 AND 3)` (since migration 001).
- **Override:** `class_students.ell_level_override INTEGER` per-enrollment.
- **Set by:** teacher (default 3 = no scaffolding). No student-facing self-placement today.
- **Read by:** `usePageData` exposes as `data.ellLevel`. Drives `EllScaffolding[ell{1,2,3}]` lookup in `ActivityCard`.

### 1.5 WIRING.yaml drift — `student-learning-support`

WIRING entry claims:

> Tier 2/3 translation via Claude (ELL level configurable), UDL scaffolding (checkpoints 1-31), ADHD visual focus helpers, dyslexia-friendly fonts.

Status `complete`, currentVersion 1. **This is doc-vs-reality drift.** Verified by grep across `src/`:
- 0 `dyslexic` / `dyslexia.*font` / `OpenDyslexic` references in any TSX/CSS.
- 0 `translateContent` / `tier2_translation` / `tier3_translation` in code.
- `udl_checkpoints` exists as a teacher-authoring tag on `activity_blocks` (curriculum metadata), not a student-facing render-time accessibility feature.
- Teacher settings has `enable_udl` toggle that flags lesson generation, not student UI.

**Action: file follow-up `FU-LS-DRIFT`. Update WIRING entry to `status: planned`, `currentVersion: 0`, rewrite summary to describe what THIS build delivers.** Per Q2 sign-off: option (i).

### 1.6 AI call-sites baseline

48 total call sites · 6 are `student_api`:

| Endpoint | Model | max_tokens | stop_reason guard |
|---|---|---|---|
| `/api/discovery/reflect` | Haiku 4.5 | 300 | unknown ⚠ |
| `/api/student/open-studio/check-in` | Haiku 4.5 | 200 | unknown ⚠ |
| `/api/student/open-studio/discovery` | Haiku 4.5 | 800 | unknown ⚠ |
| `/api/tools/marking-comments` | Haiku 4.5 | 1024 | unknown ⚠ |
| `/api/tools/report-writer/bulk` | Haiku 4.5 | 768 | unknown ⚠ |
| `/api/tools/report-writer` | Haiku 4.5 | 512 | unknown ⚠ |

All 6 violate Lesson #39 (no `stop_reason === "max_tokens"` guard, no defensive `?? []` on tool_use destructures). **Whichever new call sites this build introduces MUST ship with both guardrails day 1.**

### 1.7 Lessons re-read for this build

- **#26** — schema-order in tool_use JSON; put compact required fields BEFORE verbose arrays.
- **#29** — RLS policies must update when junction tables added; silent 0-row failures.
- **#38** — ADD COLUMN DEFAULT shadows conditional UPDATE; never combine in same migration.
- **#39** — silent max_tokens truncation; always guard + defensive `?? []`.
- **#43–46** — Karpathy: surface assumptions, simplest code, surgical changes, success criteria first.
- **#51** — Supabase dashboard mis-parses PL/pgSQL `DECLARE` blocks; avoid var names like `rls_enabled`.
- **#52** — `REVOKE EXECUTE FROM PUBLIC` doesn't override Supabase auto-grants to `anon`/`authenticated`.

---

## 2. Proposed architecture

### 2.1 Two new affordances

#### 2.1.1 Tap-a-word — input scaffold

**Pattern:** Newsela Word Pop + Microsoft Immersive Reader Picture Dictionary + Medley click-any-word, converged.

**Behaviour:** Any word in any educational text on the platform can be tapped to reveal a popover containing:
1. **Student-friendly definition** (one short sentence)
2. **L1 translation** (single language from `learning_profile.languages_at_home[0]`)
3. **Audio pronunciation** (browser `SpeechSynthesis` API — free, no network)
4. **Image** (deferred to Phase 2; see §3)
5. **Usage example** matching the surrounding text context (polysemy-aware via the AI call passing the surrounding sentence)

**Surfaces it must work on (audit-driven list):**
- Lesson prompts (`section.prompt`)
- Lesson introduction text (`pageContent.introduction.text`)
- Vocab warmup definitions
- Hints (`scaffolding.ell{1}.hints[]`)
- Sentence starters (existing chip rendering)
- Toolkit tool prompts
- AI mentor responses (Discovery Engine, Open Studio, Design Assistant)
- Source material the student is reading (when teacher attaches)

**Surfaces it must NOT work on:**
- UI chrome (buttons, labels, headers, navigation)
- Student's own typed responses (their writing — different concern)

#### 2.1.2 Response Starters — output scaffold

**Pattern:** Medley "Response Starters" panel.

**Behaviour:** Every text-response field on `ResponseInput` gets a small invocation icon (a magic-wand-pen affordance) hovering near it. Tap → side panel with:
- **Word Bank:** 8–12 task-specific chips, AI-generated from prompt + lesson context. Click chip → inserts at cursor.
- **Sentence Starters:** 2–3 frames with multi-blank causal/evaluative/descriptive structure matching the grammar move the question requires. Click frame → inserts as response template.

If the activity has authored `scaffolding.ell{1,2}.sentenceStarters[]`, those are reused (no AI call). Word Bank is always AI-generated (no authored equivalent today).

### 2.2 What stays, changes, dies

**Studio Setup page (`src/components/student/StudioSetup.tsx`):**
- ✅ **Stays untouched.** Mentor + theme + intake survey continue as today. **Does not grow** to add language-scaffolding-level / text-size / contrast / captions / alt-text / output-type. The brief's premise that those should live there is rejected — they're either obviated (level → invocation) or out-of-scope for this build (visual customization can ship separately if Matt wants).

**AutonomyPicker (`lesson-bold/AutonomyPicker.tsx`):**
- ❌ **Dies.** Component file deleted. Helper functions (`hintsAvailable`, `exampleVisible`, etc.) deleted. `student_progress.autonomy_level` column dropped via migration 122. ActivityCard hint/example gating reverts to ELL-only logic (the pre-Sub-Phase-3 state).
- The existing hint UI (Stuck? Try for 3 min first) survives — it's a useful effort-gate independent of autonomy level.

**ActivityCard hint/example gating:**
- 🔧 **Changes.** Goes from "gated by autonomy level" to:
  - **Hints**: visible if authored AND `data.ellLevel <= 2` (existing rule, restored). The try-first button stays as the effort gate.
  - **Examples**: always visible behind `<details>` collapsed (the original behaviour pre-Sub-Phase-3).
- Future: hint visibility could be driven by signal (tap-translate frequency) rather than ELL level — but that's Phase 4, not this phase.

**Sentence Starters (`scaffolding.ell{1,2}.sentenceStarters[]`):**
- ✅ **Stays.** Authored content reused by the new Response Starters panel as one of the two output scaffolds. The existing inline-chip rendering on `ResponseInput` is REPLACED by the panel-based affordance — so the chips no longer clutter the inline UI; they live in the on-demand panel instead.

**Default response type (Studio Setup field that doesn't exist):**
- ❌ **Doesn't get added.** Output mode (text/voice/sketch/photo) is picked at submission time per the original brief. Save preference as a soft signal in `learning_profile.usage_signals.preferred_output_mode` (rolling average), not a default.

**Drawer concept:**
- ❌ **Dies.** Mockups v1–v5 in `docs/newlook/` stay as historical artefacts (don't delete). The sidebar pill → drawer pattern was the wrong model. `LessonSidebar.tsx` keeps its warm-paper restyle from Sub-Phase 2C; nothing gets added to it.

### 2.3 Data model — new tables + columns

**Drop:**
- `student_progress.autonomy_level` (rollback of migration 121)

**Add:**
- **`word_definitions` cache table** (new):
  ```
  word              TEXT          -- normalised lemma
  language          TEXT          -- 'en' | 'zh' | 'ko' | 'ja' | etc.
  context_hash      TEXT          -- sha256(surrounding sentence) — polysemy
  definition        TEXT
  l1_target         TEXT          -- 'zh' | 'ko' etc.
  l1_translation    TEXT
  example_sentence  TEXT
  generated_at      TIMESTAMPTZ
  PRIMARY KEY (word, language, context_hash, l1_target)
  ```
  Cache is shared across all students. RLS allows read-all, write via service role only (admin client in API route).

- **`activity_response_starters` cache table** (new):
  ```
  activity_id       UUID FK activity_blocks(id)  -- or section composite key
  language          TEXT                          -- L1 target for the chips
  word_bank         TEXT[]
  sentence_starters TEXT[]
  generated_at      TIMESTAMPTZ
  PRIMARY KEY (activity_id, language)
  ```
  Cache shared across all students. First student in any (activity, language) tuple triggers generation; everyone else reads cache.

- **`students.learning_profile.usage_signals` JSONB nested object** (no new column — extends existing JSONB):
  ```
  {
    tap_translate_per_lesson: number,    -- rolling 5-lesson average
    response_starters_per_lesson: number,
    preferred_output_mode: "text"|"voice"|"sketch"|"photo",
    last_updated: ISO timestamp
  }
  ```
  Used for scaffold-fading triggers (Phase 4) and soft signal collection.

**No new columns on `student_progress`.** Per-student per-page state stays as-is.

### 2.4 Integration with existing systems

| New piece | WIRING ownership | Builds on |
|---|---|---|
| `TappableText` shared component | New entry: `tap-a-word` (depends on `student-profile`, `ai-mentor`) | `students.learning_profile`, `EllScaffolding` |
| `WordPopover` | Same | `SpeechSynthesis` API (browser) |
| `ResponseStartersPanel` | New entry: `response-starters` (depends on `lesson-view`, `student-profile`, `ai-mentor`) | Existing `ResponseInput` |
| `word_definitions` cache | Same as `tap-a-word` | New table, no migrations on existing |
| `activity_response_starters` cache | Same as `response-starters` | New table |
| Updated `student-learning-support` WIRING | Existing entry, status flips to `planned` until ship | Documents the redesign |

`TappableText` is **shared infrastructure** (Q5 = shared). Discovery Engine, lesson page, Open Studio Critic, Design Assistant chat all import it. Sub-Phase 3 (its build) is the right place to scope-test this — once it works on the lesson page, mounting it on Discovery + Open Studio is mechanical.

### 2.5 Teacher-as-student preview (deferred)

Teacher view: select [Home Language: X / Reading Level: Y / Writing Level: Z] → see lesson exactly as that student would.

**Deferred to Phase 4** (post-MVP). Implementation path: a `?previewAs=...` query param on the lesson route that swaps the auth-resolved `learning_profile` for a teacher-supplied dummy profile, gated to teacher auth. Cheap to add once the rest works.

---

## 3. Phased build plan

Each phase: pre-flight ritual (git status clean, baseline `npm test` matches, audit-before-touch, STOP+REPORT), riskiest assumption + cheapest test, named Matt Checkpoint.

### Phase 0 — Pivot rollback

**Goal:** Remove AutonomyPicker. Restore pre-Sub-Phase-3 ActivityCard behaviour. Update WIRING. File `FU-LS-DRIFT`.

**Files:**
- DELETE: `src/components/student/lesson-bold/AutonomyPicker.tsx`
- MODIFY: `src/components/student/lesson-bold/index.ts` — drop AutonomyPicker + 5 helpers exports
- MODIFY: `src/components/student/lesson-bold/helpers.ts` — drop `AUTONOMY_LEVELS`, `isLevelSelected`, `resolveAutonomyDisplay`, `hintsAvailable`, `hintsOpenByDefault`, `exampleVisible`, `exampleOpenByDefault`. Keep `derivePhaseState` (PhaseStrip uses it).
- MODIFY: `src/components/student/ActivityCard.tsx` — drop `autonomyLevel` prop, restore ELL-1-only hint gating, restore `<details>`-collapsed example.
- MODIFY: `src/hooks/usePageResponses.ts` — drop `autonomyLevel` state, ref, setter, `autonomyLevelOverride` in saveProgress.
- MODIFY: `src/app/api/student/progress/route.ts` — drop `autonomyLevel` accept + retry-without-column branches.
- MODIFY: `src/app/(student)/unit/[unitId]/[pageId]/page.tsx` — drop AutonomyPicker mount + `autonomyDisplay` derivation + prop wiring on ActivityCard.
- MODIFY: `src/types/index.ts` — drop `autonomy_level` from `StudentProgress`.
- DELETE: `src/components/student/lesson-bold/__tests__/shell.test.tsx` autonomy + migration 121 test sections (8 tests removed).
- NEW: `supabase/migrations/122_drop_student_progress_autonomy_level.sql` — `ALTER TABLE student_progress DROP COLUMN IF EXISTS autonomy_level;`
- MODIFY: `docs/projects/WIRING.yaml` — `student-learning-support` entry: `status: planned`, `currentVersion: 0`, rewrite summary, add `future_needs` describing tap-a-word + response-starters.
- NEW: `docs/projects/dimensions3-followups.md` entry `FU-LS-DRIFT` documenting the doc-vs-reality finding.

**Tests after Phase 0:** 1952 → ~1944 (−8 from autonomy tests removed). Matches pre-Sub-Phase-3 + 1 wiring-lock test that we kept.

**Riskiest assumption:** Migration 122 DROP COLUMN won't hit any currently-running query. Mitigation: applied to local dev only first; verify by hitting the lesson page + checking `/api/student/progress` POST works (the column is now gone but the retry pattern silently strips it from the payload).

**Matt Checkpoint 0.1:** Lesson page renders with no AutonomyPicker, ActivityCard hints/examples behave per ELL level only, `npm test` clean at new baseline, `npx tsc --noEmit --project tsconfig.check.json` clean.

### Phase 1 — Tap-a-word v1 (definition only) — full mount surface

**Goal:** Words in ALL educational text on the lesson page become tappable. Tap → popover with student-friendly definition. No translation, no audio, no image yet.

**Mount surfaces (full list per Matt sign-off — not narrow):**
1. `section.prompt` (every activity card prompt)
2. `pageContent.introduction.text` (lesson introduction)
3. `pageContent.vocabWarmup` definitions and example sentences
4. `scaffolding.ell{1}.hints[]` (hint strings inside the unlocked-hints card)
5. Existing `scaffolding.ell{1,2}.sentenceStarters[]` chip rendering (deferred until Phase 3 swaps to the panel — but if chips persist in any surface during transition, they're tappable too)
6. AI mentor responses surfaced inline (Discovery Engine reflect output, Open Studio check-in messages — wherever rendered as plain text)
7. Toolkit tool prompts (where text is shown to the student)
8. Source material attached to a lesson (when teacher attaches readable text — current path: introduction.text already covers most of this)

**Skipped (NOT tappable):** UI chrome (buttons, labels, page navigation, sidebar, footer, modal headings), student's own typed input, code blocks, mathematical notation.

**New components / files:**
- `src/components/student/tap-a-word/TappableText.tsx` — wraps a string of educational text, splits on word boundaries via `tokenize()` helper, renders each word as a tappable span. Skips punctuation, numbers, very-short words (<2 chars), already-marked-up content (URLs, mentions).
- `src/components/student/tap-a-word/WordPopover.tsx` — Radix-style popover with definition, loading skeleton, error state.
- `src/components/student/tap-a-word/useWordLookup.ts` — hook calling `/api/student/word-lookup`, debounced (250ms), caches in-memory per page-session.
- `src/components/student/tap-a-word/tokenize.ts` — pure word-boundary tokenizer. Public function. Tested in isolation.
- `src/components/student/tap-a-word/index.ts` — barrel.
- `src/components/student/tap-a-word/__tests__/tokenize.test.ts` — pure tokenizer tests.
- `src/app/api/student/word-lookup/route.ts` — POST { word, contextSentence } → returns `{ definition, exampleSentence }`. Reads `word_definitions` cache; on miss, **checks `process.env.RUN_E2E !== "1"` and routes to sandbox return when not set** (per §3.5 threaded sandbox); on cache miss in live mode, calls Haiku (max_tokens 250, **stop_reason guard required Lesson #39**, defensive `?? null` on every destructured field), writes cache, returns.
- `src/lib/ai/sandbox/word-lookup-sandbox.ts` — deterministic in-memory definition lookup keyed off `(word, language)`. Used by tests and dev runs; bypassed when `RUN_E2E=1`.
- `src/app/api/student/word-lookup/__tests__/route.test.ts` — unit tests via sandbox; cache-hit + cache-miss paths.
- `supabase/migrations/118_word_definitions_cache.sql` — new table per §2.3 with RLS allowing read-anon (definitions are public-domain content, no PII), write service-role only.

**Mounts in this phase:**
- `src/components/student/ActivityCard.tsx` — wrap `MarkdownPrompt` output in `<TappableText>`.
- `src/components/student/lesson-bold/LessonIntro.tsx` — wrap `introduction.text` paragraph.
- `src/components/student/VocabWarmup.tsx` — wrap definition + example fields.
- `src/app/(student)/unit/[unitId]/[pageId]/page.tsx` — wrap any free-form prose in `<TappableText>` (audit at touch-time; some text may already be inside ActivityCard).
- AI mentor output surfaces — wrap `markdownify(message)` output in DesignAssistantWidget / OpenStudioCheckIn / DiscoveryReflectMessage.

**Pre-warm:** seed `word_definitions` with the top 500 design-vocabulary words (one-time script using batched Haiku calls). Brings cold-cache rate down to <5% per student. The script is also sandbox-aware (`RUN_E2E=0` returns canned data so the seed runs cheaply in CI).

**Tests:**
- Tokenizer: assert "Sort your interview notes." → 4 tappable tokens (skip the period). Test edge cases: contractions ("don't"), hyphenated words ("project-based"), URLs (skip entirely), very-short words ("an"/"a"/"is" — skip).
- Route via sandbox: cache-hit returns immediately; cache-miss calls sandbox once, writes cache, returns. Cross-reference test asserts the route response shape matches the API contract type.
- Popover state machine: idle → loading → loaded | error.
- **NC:** mutate `tokenize()` to NOT skip punctuation, run test, confirm "Sort your interview notes." asserts wrong count, revert via Edit tool (Lesson #41).

**Riskiest assumption:** mounting `TappableText` on 5+ surfaces in one phase will surface layout / styling regressions that wouldn't appear with single-surface scope. Cheapest test: visual smoke against a representative lesson + Discovery Engine + Open Studio check-in in the Vercel preview before signing off. Stop-trigger: any layout regression in any of the 5 surfaces blocks Checkpoint 1.1.

**Matt Checkpoint 1.1:** Open a real lesson → tap 5 words distributed across (prompt / intro / vocab / hint / AI mentor message) → each gets a definition popover. Cache hit on the second tap of the same word. Live API mode (`RUN_E2E=1`) test passes. Cost report under $0.02 per student-lesson session in live mode.

### Phase 2 — Tap-a-word v2 (L1 translation + audio + image)

**Goal:** Add the other three popover slots. Mount on more surfaces (intro text, hints, sentence starters, toolkit prompts).

**Modifications:**
- `WordPopover.tsx` — add Translation slot (read `learning_profile.languages_at_home[0]`, fallback English-only if blank), audio button (browser `SpeechSynthesis.speak()`), image slot (loaded from a curated dictionary image API — recommend WordSet's open dictionary or Open Symbols; commit to one in this phase, not v3).
- `useWordLookup.ts` — extend payload to include `l1Target`, hit `word_definitions` with the L1 fragment of the composite key.
- `/api/student/word-lookup` — extend to fetch + cache L1 translation (extra max_tokens budget +150).
- Mount `<TappableText>` on intro text, hints, sentence starters, AI mentor responses.
- WIRING.yaml: add `tap-a-word` system entry. Update `student-profile`, `student-learning-support`, `lesson-view` `affects:` to include it.

**Image strategy (locked — Matt sign-off "best + easiest"):** static curated mapping committed to the repo. **Source: Wikimedia Commons + Open Symbols** (Open Symbols is a CC-licensed AAC pictograph set used by speech therapists; its vocabulary aligns well with K-12 educational text. Wikimedia fills the gaps for design / engineering terms.) Implementation: `src/lib/tap-a-word/image-dictionary.ts` exports `imageForWord(word, language)` returning a CDN URL or `null`. JSON manifest in `src/lib/tap-a-word/image-dictionary.json` with ~2000 entries. Build script `scripts/build-image-dictionary.ts` regenerates the manifest from a CSV input. Why these two: free, permanent CDN URLs, no per-request licensing fees, no AI image generation cost, predictable rendering. Why not Pixabay / Unsplash: rate-limited APIs unsuited to per-request lookup; better for editorial photos than dictionary illustrations.

**Riskiest assumption:** Browser TTS quality varies by OS / language. Test on the school's Chromebook fleet for the 6 supported L1 languages before sign-off.

**Matt Checkpoint 2.1:** Set a test student's `languages_at_home` to `["Mandarin"]`. Tap "ergonomics" in a real lesson prompt → popover shows definition + 中文 translation + audio plays + image renders. Switch student to Korean, retap → same word, fresh translation, same definition (cached).

### Phase 3 — Response Starters

**Goal:** Magic-wand-pen icon on every text `ResponseInput`. Tap → side panel with Word Bank + Sentence Starters.

**New components / files:**
- `src/components/student/response-starters/ResponseStartersPanel.tsx` — slide-in panel (right of input, or bottom on mobile). Word Bank chips, Sentence Starter cards.
- `src/components/student/response-starters/StarterInvokeButton.tsx` — magic-wand-pen icon affordance.
- `src/components/student/response-starters/useResponseStarters.ts` — hook calling `/api/student/response-starters`.
- `src/components/student/response-starters/__tests__/insertion.test.ts` — pure helpers for "insert at cursor" / "replace template".
- `src/app/api/student/response-starters/route.ts` — POST { activityId, language } → returns `{ wordBank: string[], sentenceStarters: string[] }`. Cache-first.
- `supabase/migrations/119_activity_response_starters_cache.sql` — new table per §2.3.

**Modifications:**
- `src/components/student/ResponseInput.tsx` — mount `StarterInvokeButton` next to the textarea when `responseType === "text"`. Drop the inline sentence-starters chip rendering (moves to the panel).

**Sandbox (threaded from day 1):**
- `src/lib/ai/sandbox/response-starters-sandbox.ts` — deterministic canned `wordBank` + `sentenceStarters` per `activity_id`. Route checks `process.env.RUN_E2E !== "1"` and bypasses live AI for unit tests. Same gating pattern as `word-lookup`.

**AI prompt design (response-starters generator):**
- Input: prompt text, lesson context (other section prompts on same page), unit type (Design / Service / PP / Inquiry), activity criterion tags, target language.
- Output schema (compact required fields FIRST per Lesson #26):
  ```
  {
    wordBank: string[10],   // exactly 10 chips
    sentenceStarters: string[3]  // exactly 3 frames with [BLANK] markers
  }
  ```
- max_tokens: 800. Worst-case-sized: 10 × 30 chars + 3 × 100 chars + JSON overhead ~ 600. 800 leaves headroom.
- stop_reason guard: throw with site-specific message.
- Defensive `?? []` on both fields.

**Sentence Starters fallback hierarchy:**
1. If activity has authored `scaffolding.ell{1,2}.sentenceStarters[]`, use those (ELL-level appropriate).
2. Else generate via AI.

**Riskiest assumption:** Word Bank generation at lesson-author-time would be cheaper but requires UI changes to the lesson editor. **Lazy first-invocation generation is the recommended pattern** — first student to tap on activity X in language L triggers AI, result cached for everyone in the class.

**Matt Checkpoint 3.1:** Open a real lesson → tap magic-wand-pen on a text response activity → panel slides in with 10 word chips + 3 sentence frames. Click a chip → inserts at cursor. Click a frame → replaces textarea content with the template. Reload page → second student in the same class hits the panel → instant render (cache hit).

### Phase 4 — Scaffold fading + signal collection + teacher preview + unified student settings

**Goal:** Soft signal-driven fading + teacher "experience as student profile" preview + unified per-student settings editor at `/teacher/students/[studentId]` (folded in 26 Apr 2026 after Checkpoint 0.1 sign-off — addresses the scatter problem where ELL/UDL/profile data lived across 3 surfaces with no single edit point).

**Modifications:**
- `useWordLookup` + `useResponseStarters` — append a `usage_signals` event on every invocation. Aggregated server-side into `learning_profile.usage_signals` (rolling 5-lesson average).
- `WordPopover` — when student has tapped <2 unique words across the last 5 lessons (declining frequency), render a small italic-serif "you're using these less — proud of you" microcopy beneath the definition for one render only, then fade out. (Soft positive reinforcement, not gating.)
- New route `/teacher/preview/[unitId]/[pageId]?profile=...` — gated to teacher auth, renders the lesson with a synthetic `learning_profile`. Toggle for L1, ELL level, design_confidence.
- WIRING + ai-call-sites + api-registry: sync via saveme.

**Unified teacher student settings (NEW — folded in from `FU-TS-UNIFY` per Matt sign-off):**

The current scatter:

| Surface today | What it shows | What's editable |
|---|---|---|
| `/teacher/students/[studentId]` | Intake survey output, mentor, theme | Read-only |
| `/teacher/classes/[classId]/students/[studentId]` | ELL level + per-class override + portfolio + grading | ELL level + override |
| `/teacher/classes/[classId]/students` | Class roster with ELL chips | Bulk edit ELL only |

The unification: **`/teacher/students/[studentId]` becomes the canonical "everything I can edit about this student" page.** Existing class-roster ELL editing stays for bulk operations; the per-student detail moves here.

Sections, in priority order:
1. **Identity** (read-only) — name · class enrollments · framework · year
2. **Language & scaffolding** (editable inline, pencil-on-hover):
   - ELL level (1/2/3) — direct edit, syncs to `students.ell_level`
   - Per-class ELL override — read-only here (bulk edit happens on class roster); shown for awareness
   - L1 target — read from `learning_profile.languages_at_home[0]`; teacher override stored in new field `students.learning_profile.l1_override` (no schema migration — JSONB nesting). For trilingual / migrant kids whose array order is wrong.
   - Scaffold-fading tier (signal-derived) — shows the current taps_per_100_words tier with one-click reset action that sets a `tier_override` valid for the next 10 lessons (per spec §4 Q4).
3. **Learning profile** (read-only — student's voice, don't edit) — languages at home, countries lived in, design confidence, working style, feedback preference, learning differences. Surface for teacher awareness only. Privacy line: this is the student's self-report.
4. **Studio preferences** (read-only — student's pick) — mentor (Kit/Sage/Spark), theme (Clean/Bold/Warm/Dark).
5. **Notifications** (editable) — fabrication-notify email opt-in.
6. **Recent activity** (link panel) — portfolio · grading · safety alerts · Open Studio status.

**Edit pattern:** pencil-icon-on-hover per editable row, inline save via existing `PATCH /api/teacher/students/[studentId]` shape. No separate edit page.

**New API endpoints (Phase 4):**
- `PATCH /api/teacher/students/[studentId]` — extend to accept `ell_level`, `l1_override`, `scaffold_tier_override`. Lesson #4 (teacher auth) + Lesson #29 (RLS junction) apply.
- `GET /api/teacher/students/[studentId]/scaffold-signals` — returns the signal-derived tier + the rolling taps_per_100_words history (for the "see what the system thinks" affordance).

**Migration:** none. `learning_profile.l1_override` and `learning_profile.scaffold_tier_override` are JSONB nesting on the existing column. No schema change.

**Matt Checkpoint 4.1 (expanded):**
- Teacher logs in, opens a unit, clicks "Preview as student" → modal with profile picker → preview renders with chosen settings. Switch profile → re-render.
- Teacher hits `/teacher/students/[studentId]` → unified settings page renders with all 6 sections.
- Edit ELL level inline → save persists, signal tier recalculates next lesson load.
- Edit L1 override (e.g. set to Korean for a student whose `languages_at_home[0]` is Mandarin) → next lesson opens, Tap-a-word shows Korean translations.
- Click "reset scaffold tier" → tier resets, override valid for next 10 lessons (verified by `/scaffold-signals` endpoint).
- Saveme green.

### Phase 5 — Live E2E test harness verification

**Goal:** Sandbox is already shipped in Phases 1 + 3 (threaded approach per Matt sign-off). Phase 5 is the gated live-API verification — exercise the real AI failure modes that sandbox-only suites can't reach (Lesson #39).

**New:**
- `tests/e2e/word-lookup-live.test.ts` — gated by `RUN_E2E=1`. Calls `/api/student/word-lookup` against the live Anthropic key with 3 representative inputs (common word, uncommon word with surrounding context, polysemous word). Asserts response shape, cache write, p95 latency <2s, no `stop_reason: "max_tokens"`.
- `tests/e2e/response-starters-live.test.ts` — same pattern, against `/api/student/response-starters`. Asserts the output schema (10 chips + 3 frames exactly), cache write, latency, stop_reason guard fires correctly under deliberate token pressure.
- Add both to the existing `vitest.config.ts` `tests/e2e/**` pattern (already configured per §1.2 of `usePageData` audit — `tests/e2e/**/*.test.ts` is in the include glob).

**Why threaded sandbox + a separate Phase 5:**
- Sandbox in each phase keeps unit tests fast + free.
- Live E2E in one phase concentrates the cost of running real API calls (~$0.10 for the full suite) into a single verification gate.
- Catches the bugs sandbox can't see (real Anthropic 5xx, real token-limit trips, real schema-evolution drift).

**Matt Checkpoint 5.1:** `RUN_E2E=1 npx vitest run tests/e2e/word-lookup-live.test.ts tests/e2e/response-starters-live.test.ts` runs against the real Anthropic key, both assert response shape + cache write, completes in <60s, total spend <$0.20.

---

## 4. Open questions — proposed defaults

Each question from the original brief, with a recommended default + rationale. Override any of these on sign-off.

### Q1 — Per-student proficiency signal source

**Options:**
- (a) Student self-placement at onboarding (add a question to StudioSetup intake survey)
- (b) Teacher manual set (extend existing `students.ell_level`)
- (c) Passive signal from tap-translate / response-starters frequency in early lessons

**Default: (c) passive signal, with teacher override.**

Rationale: International school DT context with no formal WIDA equivalent. Self-placement skews toward over-picking support (documented WIDA / multilingual research, also in `docs/research/student-influence-factors.md`). Teacher manual set is fine for diagnosed accommodations but doesn't scale across 100+ students with subtle needs. Passive signal needs no setup and reveals real demand.

**Implementation:** `learning_profile.usage_signals.tap_translate_per_lesson` rolling average. After 3+ lessons of data, derive a soft "scaffolding tier" (Tier 1 = high tap-rate, Tier 3 = near-zero). Tier drives subtle render adjustments (e.g. Tier 1 students get the full Word Bank by default; Tier 3 students see the magic-wand-pen icon as a smaller affordance).

### Q2 — Word Bank generation: pre-compute or on-demand?

**Default: lazy first-invocation generation, per (activity, language) cache.**

Rationale: Pre-computing at lesson-author-time requires lesson editor UI changes and runs AI calls for activities that may never get a student in language L. Lazy is the cheapest model. First student in (activity, language) tuple triggers Haiku ~800 tokens (~$0.005 per call). 30-student class shares the cache → effectively $0.005 per class per activity. ~1000 activities × 6 languages = $30 worst-case for the entire pilot class deployment. Negligible.

### Q3 — Tap-a-word translation: single L1 only, or any-language-on-demand?

**Default: single L1 from `learning_profile.languages_at_home[0]`.**

Rationale: Matches Medley's Home Language model. Fairer than English-only; cheaper than any-language-on-demand. The intake survey already captures the array. Phase 2 picks index 0. Trilingual / migrant students whose primary "home language" isn't index 0 can re-order their array via a (very small) addition to Studio Setup — flagged as a follow-up for after Phase 2 ships, not in scope.

### Q4 — Scaffold-fading triggers

**Locked default — Matt confirmed pick mine: rolling 5-lesson average of tap-translate invocations per 100 words of educational text exposed, with response-starters invocation as a confirming secondary signal, teacher click-to-reset override, and a hard floor that never hides the affordance entirely.**

Specifics:

- **Primary signal:** `taps_per_100_words = (count of tap-translate invocations / total words rendered in TappableText) × 100`, computed over the most recent 5 lessons the student opened. Decline = improving proficiency. **Normalised per 100 words** because a long lesson naturally has more text to tap; raw counts would punish students who do the harder lessons.
- **Secondary signal (confirmation only, not driver):** rolling 5-lesson `response_starters_invoked / activities_attempted` ratio. If primary says "improving" but secondary says "still relying on starters", we don't fade.
- **Tier mapping:** Tier 1 (high tap-rate, ~3+/100 words) → full Word Bank visible by default in the panel. Tier 2 (~1–3/100 words) → panel opens compact. Tier 3 (<1/100 words, sustained) → magic-wand-pen icon shrinks but **never disappears**. Floor protects the right-to-ask.
- **Override:** Teacher dashboard surfaces a per-student tier pill. One click resets to teacher-set tier (overriding the signal-derived value for the next 10 lessons). Used when the signal is wrong (e.g. student gave up rather than improved, or had a class-of-jargon-heavy-lessons).
- **Cold start:** First 3 lessons → tier defaults to whatever the teacher's class-level `ell_level` says (existing field). Signal kicks in from lesson 4 onward.

Rationale beyond what's above:
- Time-on-platform has too many confounders (absence vs disengagement vs proficiency).
- Lesson completion rate doesn't differentiate proficiency from rushing.
- Teacher-confirmed level-up is good but slow — relies on teacher remembering to update.
- Tap-translate is the cleanest behavioural proxy for "I no longer need this" — the student literally stops invoking. The "per 100 words" normalisation is the part most Matt-area-of-expertise won't intuit but matters mechanically.

**If you want a different signal weighting, the override is teacher-set tier — so the consequence of a wrong default is just "teacher clicks once per student", not a stuck system.** Acceptable failure mode.

### Q5 — Integration surface

**Default: shared `TappableText` infrastructure component, used by Discovery Engine, lesson page, Open Studio, Design Assistant.**

Rationale: Per Q1 sign-off (pivot, not coexist), this is the language-scaffolding seam for ALL student-facing educational text. Building it per-feature would mean 4× the work + 4× the inconsistency. Shared component matches the OS-seam principle (CLAUDE.md → Loominary Context).

WIRING.yaml: new `tap-a-word` system entry with `affects: [lesson-view, discovery-engine, student-open-studio, ai-mentor, toolkit]`.

### Q6 — Drawer remnant

**Default: nothing survives. The drawer concept dies entirely.**

Audit of the four toggles the mockups proposed:
- **Hints visible** — replaced by tap-translate signal driving render adjustments + the existing try-first effort gate.
- **Examples visible** — restored to default `<details>`-collapsed (pre-Sub-Phase-3). No toggle needed.
- **Auto-play read aloud** — out of scope. The TTS button is always available per-text-block (browser-native via tap-a-word's audio slot). Auto-play is a session-level preference that belongs on the future visual-customization page if/when that ships, not in this build.
- **More time on this lesson** — orphaned. No real implementation today. If pace genuinely matters, it's a Phase 4 follow-up driven by signal (lesson completion time), not a toggle.

---

## 5. Cost + AI-call analysis

### 5.1 New call sites this build adds

| Call site | Phase | Model | max_tokens | stop_reason guard | Defensive `?? []` | Cache strategy |
|---|---|---|---|---|---|---|
| `/api/student/word-lookup` | 1 | Haiku 4.5 | 250 (P1), 400 (P2) | required | required | `word_definitions` table, shared across class |
| `/api/student/response-starters` | 3 | Haiku 4.5 | 800 | required | required | `activity_response_starters` table, shared across class |

Both ship with Lesson #39 guards day 1 (the existing 6 student-api sites violate these — flagging that they should be retrofitted under FU-5).

### 5.2 Cost projection per active student per week

**Assumptions:**
- Active student = 3 lessons / week × 1 hour / lesson.
- Average uncached word lookups on first encounter: 5 / lesson (after pre-warm with top 500 design vocab).
- Average response-starters invocations: 2 / lesson (the panel is on-demand, not always opened).
- Class-cache benefit: first student in 30-student class triggers; remaining 29 hit cache. Average per-student → uncached × (1/30) + cached × (29/30).

**Word lookups:**
- 5 first-encounter words / lesson × 3 lessons / week = 15 words / student / week
- After class-cache amortization: 15 × (1/30) = 0.5 cache misses / student / week × Haiku ~250 tokens × $0.80/MTok in + $4/MTok out ≈ $0.0001 / student / week

**Response Starters:**
- 2 invocations / lesson × 3 lessons = 6 invocations / week
- After cache amortization: 6 × (1/30) = 0.2 cache misses × ~800 tokens × Haiku rates ≈ $0.0006 / student / week

**Total: ~$0.0007 / student / week.**

For a 30-student pilot class running this for a 12-week term: 30 × 12 × $0.0007 = **$0.25 total** for the entire pilot. Negligible. Won't materially shift the AI cost envelope (which is dominated by `generation`/`ingestion` categories, both teacher-side, both 10-100× larger per call than these student-facing ones).

**Cache miss rate is the wildcard.** If students tap translate aggressively (curious behavior, not need), uncached rate climbs. Mitigations: rate-limit tap-translate per student per lesson (cap 50/lesson), prevent "tap every word as a fidget" pattern by debouncing the popover.

### 5.3 The unbudgeted risk: existing 6 sites are unguarded

The bigger AI cost risk is the existing 6 student-api sites that all have `stop_reason_handled: unknown` (from `ai-call-sites.yaml`). Any of them could silently truncate a response and crash. **Recommend filing FU-5 expansion** to retrofit guards on those 6 in parallel with this build. Out of scope here, flagging only.

---

## 6. Migration notes

### 6.1 Migrations this build adds

- **117** — `DROP COLUMN student_progress.autonomy_level` (rollback of 116)
- **118** — `CREATE TABLE word_definitions` + RLS
- **119** — `CREATE TABLE activity_response_starters` + RLS

Numbering note: 116 was used for `autonomy_level` (now being dropped). 117/118/119 are the next free numbers above. Cross-check at Phase 0 pre-flight; if preflight branch shipped 113/114 to main and dashboard shipped 115, skip to 121/122/118 (116 reused if AutonomyPicker dropped before any trace lands in main — currently safe, since the lesson-bold branch hasn't merged).

### 6.2 Re-onboarding moment

**Not needed.** The existing 6 fields in `learning_profile` are unchanged. `languages_at_home[0]` becomes the L1 target — no new question added to the intake survey. Existing students who completed onboarding pre-this-build keep their data. Students who haven't done onboarding go through the same flow.

### 6.3 Data migration

- **`autonomy_level` column drop:** silent — no real data to migrate. Migration 121 was applied to local dev only; prod has never seen the column. If, somehow, prod has rows with `autonomy_level` set, they're discarded silently. No backup needed.
- **`word_definitions` cache:** empty on first deploy. Pre-warm script (Phase 1) seeds top 500 design vocab.
- **`activity_response_starters` cache:** empty on first deploy. Lazy lookup populates as students invoke.

### 6.4 Doc-vs-reality follow-ups

- **`FU-LS-DRIFT`** (new) — WIRING entry `student-learning-support` was claiming complete features that didn't exist (translation, dyslexia fonts, UDL, ADHD focus). Update entry to reflect reality + the redesign delivers.
- **`FU-5` expansion** (existing) — retrofit `stop_reason` guards onto the 6 existing student-api call sites. Out of scope here; flag in saveme.

---

## 7. Stop triggers (do not paper over)

- Cold-cache rate >20 unique uncached words per first-time student per lesson (Phase 1 risk — if so, expand pre-warm)
- Browser TTS unsupported on school Chromebook fleet for any of the 6 L1 languages (Phase 2 risk)
- Word Bank AI generation latency >2s p95 on first invocation (Phase 3 risk — if so, add eager-on-author trigger in lesson editor)
- Any new call site lands without `stop_reason === "max_tokens"` guard (Lesson #39 — non-negotiable)
- Migration 122 DROP COLUMN attempted before AutonomyPicker code references are removed (PostgreSQL would error; just sequence the migration AFTER the code changes are committed)
- Studio Setup intake survey shape changes during this build (out of scope — different concern)

## 8. Don't-stop-for list

- Visual polish on `WordPopover` micro-animations (Phase 1 ships utilitarian; tune in Phase 2 with the rest)
- Teacher-side `ell_level` UI changes (current admin flow stays; passive-signal model doesn't replace teacher-set, supplements it)
- L1 array reordering UI in Studio Setup (deferred follow-up after Phase 2)
- Image dictionary licensing audit (use one of the open-license sources, document, move on)
- Per-word audio recording (use `SpeechSynthesis` — pre-recorded is too much content production for v1)
- Pomodoro / focus mode / break reminders (out of scope, not in this brief)

## 9. Success criteria

- Phase 0: AutonomyPicker entirely gone, no test regressions other than the 8 expected removals.
- Phase 1: 5 tappable words on a real lesson prompt → 5 definition popovers, cache hit on second tap.
- Phase 2: Mandarin-set student taps "ergonomics" → definition + 中文 + audio + image. Korean-set student taps same word → same definition + 한국어 (cache miss for translation, hit for definition + image).
- Phase 3: Magic-wand-pen tap → panel with 10 chips + 3 frames within 2s p95. Chip insert + frame replace work cleanly.
- Phase 4: Teacher preview-as-student renders the lesson differently for [Mandarin / ELL 1] vs [English / ELL 3].
- Phase 5: `RUN_E2E=1` test suite passes against live Anthropic key, completes <60s.
- All phases: `npm test` green, `tsc --noEmit` clean, no `stop_reason: unknown` on any new site, WIRING + api-registry + ai-call-sites green via saveme.

---

## 10. Files this brief touches (delivery output)

- ✅ NEW: `docs/projects/language-scaffolding-redesign-brief.md` (this file)
- 🔜 PHASE 0: 13 file modifications listed in §3 Phase 0
- 🔜 PHASE 1: 7 new files + 1 migration
- 🔜 PHASE 2: 5 file modifications + curated image dictionary commit
- ✅ PHASE 0: 13 file modifications + migration 122 — SHIPPED (`c58aa1c`, `513818f`). Checkpoint 0.1 PASSED.
- 🔜 PHASE 1: 7 new files + 1 migration
- 🔜 PHASE 2: 5 file modifications + curated image dictionary commit
- 🔜 PHASE 3: 5 new files + 1 migration + ResponseInput modification
- 🔜 PHASE 4: 1 new route + 2 hook extensions + unified `/teacher/students/[studentId]` settings page + 1 new API endpoint + WIRING/registry sync
- 🔜 PHASE 5: 2 sandbox modules + RUN_E2E gating

---

## 11. Deferred to v2 — AI automation ideas filed for later

These came up during the Phase 0 sign-off conversation (26 Apr 2026). Matt's call: **file, don't ship.** They sit here as v2 backlog so they're findable when the redesign's v1 is in pilot and we have real signal data to ground the decisions.

### v2-AI-1 — Passive-signal-driven ELL-level suggestion to teacher
**Idea:** When a student's `taps_per_100_words` rolling average drops below a threshold for 5+ consecutive lessons (signal: language proficiency improving), the teacher's `/teacher/students/[studentId]` page surfaces a soft prompt: *"System thinks Aiko is now ELL 2 — confirm?"* with one-click accept / dismiss.

**Why deferred:** Needs real signal data from a pilot class to calibrate the threshold. Shipping this in v1 risks false positives that erode teacher trust in the system. v2 = pilot data → tuned threshold → ship.

**Estimate:** Half a day once thresholds are calibrated. Hooks into Phase 4's `/scaffold-signals` endpoint.

### v2-AI-2 — Mentor personality adaptation per student
**Idea:** Kit/Sage/Spark currently have static personalities defined in `src/lib/student/mentors.ts`. AI-driven personality drift — Kit speaks slightly more directly to students who consistently pick `working_style: "solo"`, more collaboratively to `partner` / `small_group` — could deepen the mentor relationship.

**Why deferred:** Already on the Designer Mentor System backlog (`docs/projects/designer-mentor-system.md`). That project is the v2 home for mentor system evolution. Don't fork the work.

**Estimate:** Subsumed by Designer Mentor v2 (~3-4 weeks). Not a standalone item.

### v2-AI-3 — AI-inferred learning differences
**Idea:** Pattern-match across a student's interaction signals (response latency, tap-translate frequency, error patterns) to surface likely learning differences (dyslexia signals, ADHD signals, etc.) to the teacher.

**Why NOT shipping (any version):** Privacy + ethics. Learning difference identification should come from teacher / parent / IEP / educational psychologist — not AI inference. The risk of false positives or labeling effects outweighs any automation gain. Captured here to formally close the question if it comes up again. **Filed as a non-starter, not a backlog item.**

### v2-AI-4 — Auto-grading via AI
**Idea:** Replace teacher grading entirely with AI scoring of student responses + integrity-monitoring metadata.

**Why deferred:** Teacher grading is the current trust contract. AI assists today via `/api/tools/marking-comments` (suggested comments, teacher accepts/edits). Full auto-grading is a separate scope decision involving assessment validity, pilot trust building, framework compliance (IB / GCSE / etc. have specific assessor requirements). Out of scope for language-scaffolding-redesign. Goes in `docs/projects/grading-system-overhaul.md` if/when that project starts.

### v2-AI-5 — Content adaptation per student
**Idea:** Generate slightly different lesson content per student based on their profile (e.g. simpler vocabulary for ELL 1, harder challenge prompts for ELL 3).

**Why NOT shipping:** Same principle as the configuration→invocation pivot — content stays one-size, scaffolding adapts. Forking content per student creates maintenance debt (every edit multiplies), breaks the teacher's mental model of "what my class is doing today", and obviates the assessment fairness model. Captured as a non-starter, not a backlog item. The redesign's bet: the SAME content + adaptive scaffolding > different content per student.

---

## 12. Sign-off audit trail

- **Spec written + locked:** 26 Apr 2026 — committed at `a8c0907`. Matt's 7 picks captured in §0.5.
- **Phase 0 SHIPPED + Checkpoint 0.1 PASSED:** 26 Apr 2026 — code rollback at `c58aa1c`, migration + WIRING + FU-LS-DRIFT at `513818f`. Migration 122 applied to local dev only. Visual smoke verified ELL-1 hints / ELL-2 silent / ELL-3 extensions matches pre-Sub-Phase-3 behaviour. Tests 1942 passed.
- **Phase 4 scope expansion:** 26 Apr 2026 — unified teacher student settings folded in (was `FU-TS-UNIFY`, now part of Phase 4 per Matt sign-off). Brief §3 Phase 4 + Checkpoint 4.1 updated.
- **§11 v2-AI deferrals filed:** 26 Apr 2026 — 5 ideas filed (3 deferred, 2 non-starters).
- **Next executable phase:** Phase 1 (Tap-a-word v1, 8 mount surfaces). Trigger phrase: "go phase 1" or "tap-a-word".

**No code beyond Phase 0.** Sign off on §3 Phase 1 file list before Phase 1 starts.
