# Dimensions3 Phase 2 — Phase Brief

> Generation Completeness + FrameworkAdapter
>
> Drafted: 11 April 2026
> Status: **AWAITING MATT SIGN-OFF** — do not start any code until this brief is approved.
>
> Canonical spec: [`docs/projects/dimensions3-completion-spec.md`](dimensions3-completion-spec.md) §4 (lines 573–781).
> Build methodology: [`docs/build-methodology.md`](../build-methodology.md).

---

## 1. Goal (verbatim from spec §4)

The 7-stage pipeline (0–6) runs end-to-end with real AI calls against the seeded library. Every stage consumes its FormatProfile extension point. Stage 4 produces strictly neutral content. FrameworkAdapter maps neutral → framework at render time in student + grading UI. Wizard lanes all work.

**Estimated effort:** 4–5 days.
**Prerequisite:** Phase 1 complete. Library has 56+ blocks with embeddings. ✓ (verified at Checkpoint 1.2 PASS, 11 Apr 2026).

---

## 2. Why this phase exists

Dimensions3 has been built one half at a time. The **ingestion** half is now locked (Phases 0/1.1/1.5/1.6/1.7, Checkpoint 1.2 PASS with live E2E gate). The **generation** half is incomplete:

- The 7-stage pipeline orchestrator exists but several stages don't actually consume `FormatProfile` (the per-format extension point that makes Service / PP / Inquiry units feel different from Design units).
- Stage 4 (Polish) may emit framework-specific vocabulary like "Criterion B" or "AO2", which violates the framework-neutral content invariant in §14.1.
- `FrameworkAdapter` is declared in `src/lib/frameworks/index.ts` but `mapCriterion()` is unimplemented — student/grading UI can't actually swap framework labels.
- 11+ files still hardcode `claude-sonnet-4-20250514` while the rest of the app uses `claude-sonnet-4-6` — per-teacher cost attribution is inconsistent.

Phase 2 closes those gaps and ships the first end-to-end "request → real generation → student preview with correct framework vocabulary" path.

---

## 3. Spec sections to re-read (Code must read these before any code)

| Section | Path | Why |
|---|---|---|
| §3 | spec lines ~225–540 | 6/7-stage pipeline contracts (current stage signatures Code will be modifying) |
| §4 | spec lines 573–781 | The Phase 2 spec itself — sub-tasks 4.1 → 4.12 |
| §7.5 | spec | FrameworkAdapter Test Panel detailed spec |
| §14.1 | spec | Framework-neutral units invariant + the 8 neutral keys |
| §14.9 | spec | FormatProfile extension points per stage |
| `docs/specs/neutral-criterion-taxonomy.md` | full | Source-of-truth 8×8 mapping table for the FrameworkAdapter |
| `docs/specs/format-profile-definitions.md` | full | The 4 concrete FormatProfile objects + per-stage extension points |
| `docs/build-methodology.md` | full | Discipline reminders (esp. pre-flight ritual + stop triggers + Lessons #38, #39) |

---

## 4. Lessons re-read list (Code must re-read at start of phase)

Listed because they apply directly to Phase 2 work shape:

- **Lesson #34** — Test assumptions drift silently. Capture baseline `npm test` BEFORE touching code; use it as the new baseline at end of phase.
- **Lesson #38** — Verify = assert expected values, not just non-null. Every test in Phase 2 must compare to a captured-from-real-run value, not `toBeDefined()`.
- **Lesson #39** — Silent `max_tokens` truncation in Anthropic `tool_use` calls. **Phase 2 will add several new Anthropic `tool_use` call sites (Stage 3 gap-fill, Stage 4 polish, Stage 4 validator rewrite). Every new call site MUST land with the `stop_reason === 'max_tokens'` throw guard + defensive destructure pattern from the lesson, and the audit-then-fix-all rule applies.**
- **Lesson #36** — Data-backfill migrations need edge-case SQL. Phase 2 doesn't introduce new backfill, but if any FormatProfile defaults need to be backfilled into existing rows, this rule applies.
- **Lesson #26** — AI JSON schema field ordering matters. Stage 3 + Stage 4 schema changes will land in Phase 2 — required fields go first, verbose arrays last.

---

## Pipeline 2 Forward-Compat Seam Review

A parallel session raised forward-compat items for the future Student Work Pipeline (Pipeline 2). Source verification against the actual repo (registry.ts, ingestion/types.ts, generation-log.ts, migrations 060/061, studentwork.md §4 + §9) showed the two pipelines should stay structurally separate — different inputs, outputs, consumers, and risk profiles. studentwork.md §4 already commits to separate `work_items` / `work_versions` / `work_assets` tables.

**What's worth sharing (and already is — these are seams, not services):**
- `IngestionPass<TInput, TOutput>` generic interface in `src/lib/ingestion/types.ts` — Pipeline 2 can register `IngestionPass<WorkAsset, EnhancedAsset>` with zero refactor.
- `PassConfig.supabaseClient` is structurally typed (`{ from: (table: string) => any }`) — OS Seam 1, content-agnostic.
- File-hash dedup uses SHA-256 of file bytes — content-agnostic.
- `success_look_fors TEXT[]` on activity_blocks (migration 060) is plain strings, not UUIDs — Pipeline 2 vision feedback prompts can consume this directly.
- `CostBreakdown` shape and stateless job-handler pattern.

**What we're explicitly NOT sharing:**
- No polymorphic runs table — Pipeline 2 gets its own.
- No `pipeline_id` discriminator on `generation_runs` — YAGNI given separate tables. Cross-pipeline cost reports can UNION at query time.
- No shared moderation contract until Phase 7 (Content Safety) forces the question.

**Regression locks:** sub-task 5.1.5 adds 3 cheap guard tests so future refactors can't silently narrow the generic seams above. These aren't aspirational — they pin behaviour that already exists.

---

## 5. Sub-task plan (one commit per item, with tests)

Maps to spec §4.1 → §4.10 **with audit-driven adjustments (11 Apr 2026)**. The Phase 1 foundation audit found that several FormatProfile extension points are already wired in stages 1, 2, 5, and 6 — those sub-tasks become "verify-only" or "complete the partial wiring" instead of "wire from scratch". The audit also surfaced 4 unguarded `max_tokens` sites in `src/lib/pipeline/stages/` that FU-5 missed; per the fold-into-Phase-2 decision they become a new sub-task 5.2.5.

Each item gets its own pre-task audit, its own commit, and its own test assertions against **captured truth** (real values from a real run, locked into the test — never `toBeDefined()`). Every FormatProfile sub-task must test all 4 profiles (Design, Service, PP, Inquiry), not just one.

**Truth-capture rule (Lesson #38):** Before writing assertions for any sub-task that exercises a stage, run that stage once against a fixture for each FormatProfile and save the output as a JSON fixture under `tests/fixtures/phase-2/`. Test assertions reference those fixtures. No fixture → no test.

| # | Item | Commit hint | Tests | Truth-capture fixture | Audit notes |
|---|---|---|---|---|---|
| 5.1 | Confirm pipeline has no Stage 5b + permanent guard test | `chore: confirm orchestrator runs stages 0–6, no 5b + add guard test` | (1) grep + orchestrator inspection. (2) **NEW: permanent guard test** in `tests/pipeline/orchestrator-shape.test.ts` asserting `stage5b` / `5b` does not appear in orchestrator import list or stage array. | n/a (structural) | ✅ Already verified by Phase 1 audit. Adds the regression-prevention test so 5b can never silently come back. |
| **5.1.5** | **Pipeline 2 forward-compat seam guard tests** | `test(pipeline): pipeline-2 forward-compat seam guards` | **3 tests** in `tests/pipeline/pipeline-2-seam-guards.test.ts` — see detail block below §5 for full spec. (1) `IngestionPass<TInput, TOutput>` generic survives in `types.ts`. (2) `PassConfig.supabaseClient` stays structurally typed. (3) migration 060 keeps `success_look_fors TEXT[]` as plain strings. | n/a (source grep) | Regression locks for Pipeline 2 seams that already exist on `main`. No schema change, no app code change. Detail block below the §5 table. |
| 5.2 | Stage 4 neutral-content enforcement (prompt + **fail-loud validator** + criterion_tags) | `feat(pipeline): stage 4 enforces framework-neutral output` | **7 tests** in `stage4-polish.test.ts`: (1)–(4) validator throws on each forbidden token separately — `Criterion [A-D]`, `AO[1-4]`, `MYP`, `GCSE`. (5) validator passes neutral output (captured fixture). (6) `criterion_tags` output schema present + well-formed (8 neutral keys, none empty for assessment-tagged blocks). (7) **integration test** — validator actually runs inside `stage4-polish.ts` not just standalone (mock the AI call to return forbidden token, assert stage throws). | `tests/fixtures/phase-2/stage4-neutral-baseline.json` | Validator **fails loud** per locked decision. Riskiest single change in the phase — gets the most tests. |
| **5.2.5** | **`max_tokens` `stop_reason` guards on the 4 pipeline-stage text-response JSON.parse sites** + meta-test | 4 separate commits — `fix(pipeline): stop_reason guard on stage2/3/4 max_tokens sites` + 1 meta-test commit | Each commit ships with a test that captures the current `max_tokens` value as a constant + asserts the guard throws an informative error when `stop_reason==="max_tokens"` (mock the Anthropic response with truncated text). **5th commit** adds a meta-test in `tests/pipeline/max-tokens-coverage.test.ts` that greps `src/lib/pipeline/stages/` for `client.messages.create` and asserts every match is paired with a `stop_reason` check within the same function. | n/a (mocks) | **CORRECTED at pre-flight:** these are TEXT-RESPONSE sites (`response.content.find(b => b.type === "text")` → `JSON.parse`), NOT `tool_use` sites. Failure mode is LOUD (`JSON.parse` throws "Unexpected end of JSON input") not silent — see corrected FU-5 addendum. Still worth fixing because: (1) error message becomes informative instead of cryptic, (2) max_tokens values are tight (2048 in particular) and Phase 2 adds prompt complexity via 5.5/5.6 that may push them over. Sites: `stage2-assembly.ts:188 (4096)`, `stage3-generation.ts:199 (2048)`, `stage4-polish.ts:136 (4096)`, `stage4-polish.ts:281 (2048)`. Lands BEFORE 5.5 + 5.6. |
| 5.3 | Stage 1 (Retrieve) FormatProfile **verify + lock** (`blockRelevance.boost/suppress`) | `chore(pipeline): verify + lock stage 1 blockRelevance for all 4 profiles` | **4 tests** in `stage1-retrieval.test.ts` — one per profile (Design, Service, PP, Inquiry). Each asserts the top-5 retrieved blocks for a fixed query against a captured fixture. Tests must produce **4 distinct top-5 lists** — if any two are identical, blockRelevance isn't actually steering retrieval. | `tests/fixtures/phase-2/stage1-{design,service,pp,inquiry}-top5.json` | Already wired at `stage1-retrieval.ts:60-61` with magnitude `+1 / -0.5`. Decision at sub-task time: lock the magnitude that's intentional, fix if stale. |
| 5.4 | Stage 2 (Assemble) **complete partial wiring** (`sequenceHints.defaultPattern` + `requiredPhases`) | `feat(pipeline): stage 2 assemble consumes sequenceHints.defaultPattern + requiredPhases` | **5 tests**: (1)–(4) one per profile asserting the assembled phase sequence matches the captured fixture. (5) `requiredPhases` overrides — when `requiredPhases` says "reflect must be at end" and the natural assembly would put it earlier, assert reflect ends up at end. | `tests/fixtures/phase-2/stage2-{design,service,pp,inquiry}-assembly.json` | Partial. `phaseWeights`, `openingPhase`, `closingPhase` already wired. Adds `defaultPattern` + `requiredPhases`. |
| 5.5 | Stage 3 (Gap-Fill) wiring (`gapGenerationRules.aiPersona/teachingPrinciples/forbiddenPatterns`) | `feat(pipeline): stage 3 gap-fill consumes FormatProfile.gapGenerationRules` | **6 tests**: (1)–(4) one per profile asserting Stage 3 output contains a captured-fixture marker phrase from that profile's `teachingPrinciples` (positive case — proves wiring is real, not a no-op). (5) negative — PP output never contains "teacher-directed workshop demo" (`forbiddenPatterns`). (6) `aiPersona` — the system prompt sent to Anthropic contains the profile-specific persona string (intercept the call). | `tests/fixtures/phase-2/stage3-{design,service,pp,inquiry}-gapfill.json` | ❌ Real work — zero `gapGenerationRules` field reads currently. 5.2.5 lands first. |
| 5.6 | Stage 4 (Polish) wiring (`connectiveTissue`) | `feat(pipeline): stage 4 polish consumes FormatProfile.connectiveTissue` | **4 tests** — one per profile asserting Stage 4 output contains the profile-specific connective phrase from the captured fixture (Design: "your client", Service: "your community", PP: "your inquiry", Inquiry: "your investigation" or whatever the format-profile defs say). | `tests/fixtures/phase-2/stage4-{design,service,pp,inquiry}-polish.json` | ❌ Real work — zero `connectiveTissue` field reads. 5.2.5 lands first. |
| 5.7 | Stage 5 (Timing) **complete partial wiring** (`timingModifiers.defaultWorkTimeFloor` + `reflectionMinimum`) | `feat(pipeline): stage 5 timing consumes defaultWorkTimeFloor + reflectionMinimum` | **5 tests**: (1)–(4) one per profile asserting reflection minutes ≥ profile's `reflectionMinimum` AND work-time minutes ≥ `defaultWorkTimeFloor`. (5) **edge case** — when reflection is already > minimum, no change is made (no double-padding). | `tests/fixtures/phase-2/stage5-{design,service,pp,inquiry}-timing.json` | Partial. `setupBuffer`, `cleanupBuffer` already wired. |
| 5.8 | **Stage 6 (Scoring) regression test** (replaces deleted wiring sub-task) | `test(pipeline): lock stage 6 reads pulseWeights from FormatProfile` | **1 test** asserting `stage6-scoring.ts` reads `profile.pulseWeights.cognitiveRigour/studentAgency/teacherCraft` and the Pulse score for the same lesson differs across profiles when only `pulseWeights` differs (mock 3 minimal profiles with different weights, assert 3 distinct scores). | n/a (synthetic profiles) | ✅ Already wired at `stage6-scoring.ts:320-322`. Sub-task is a regression-prevention test, not new wiring. |
| 5.9 | FrameworkAdapter implementation + 8 mapping files | `feat(frameworks): implement FrameworkAdapter with 8 mapping tables` | Adapter test suite in `tests/frameworks/adapter.test.ts`: **64 cell tests** (8 neutral keys × 8 frameworks), round-trip (neutral→framework→neutral consistent or documented loss), null-handling (unknown framework throws explicitly, missing cell returns sentinel), multi-key merge (when 2 neutral keys map to same framework descriptor, merge rule is deterministic). | `tests/fixtures/phase-2/framework-adapter-8x8.json` (golden table) | ❌ Real work. Creates new `src/lib/frameworks/adapter.ts` + 8 mapping files. STOP if `neutral-criterion-taxonomy.md` is ambiguous on any cell. |
| 5.10 | **Find actual student lesson render path + audit 5 hardcoded UI strings + wire FrameworkAdapter** | `feat(ui): wire FrameworkAdapter into student lesson, teacher grading, and unit editor` | **3 component tests** — one per render path, each rendering the page with a `framework='GCSE_DT'` class fixture and asserting GCSE labels appear (not MYP). Plus **a recorded decision per hardcoded UI string** (the 5 from the audit) — keep as marketing copy OR convert to FrameworkAdapter call. Decisions go in the commit message. | `tests/fixtures/phase-2/render-paths-{student-lesson,grades,teacher-grading}.json` | ⚠️ Spec drift fixed: real paths are `src/app/(student)/unit/[unitId]/[pageId]/page.tsx`, `src/app/(student)/unit/[unitId]/grades/page.tsx`, `src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx`. 30-min discovery first. |
| 5.11 | FrameworkAdapter Test Panel at `/admin/framework-adapter` | `feat(admin): framework adapter test panel` | **1 smoke test** — page mounts and 8×8 matrix renders without throwing (Vitest + Testing Library). Plus manual exploration at Checkpoint 2.1. | n/a | — |
| 5.12 | 🛑 **Matt Checkpoint 2.1** — FrameworkAdapter visible | (no commit) | Manual: 8×8 matrix renders, unit preview switches, batch validation CSV | — | — |
| 5.13 | Un-hardcode model IDs — **12 update sites + add code constant in usage-tracking.ts** + regression test | `chore(ai): replace hardcoded sonnet-4-20250514 with env GENERATION_MODEL (incl. pass-b leftover)` | (1) Grep verification per spec §4.7 step 4 — **note spec list is stale by one entry, pass-b.ts:23 is the 12th**. (2) **Regression test** in `tests/ci/no-hardcoded-model-ids.test.ts` that greps non-quarantined source files for `claude-sonnet-4-20250514` and asserts zero matches (with an allowlist for the 2 intentional keep sites). | n/a (grep-based) | ✅ Audit complete. **12 update sites** confirmed at pre-flight: 11 match spec §4.7 + `src/lib/ingestion/pass-b.ts:23` (`const DEFAULT_MODEL = "claude-sonnet-4-20250514"`) which is a Phase 1.7 cleanup leftover. The 2 intentional keeps are `lib/usage-tracking.ts:6` (historical pricing dict) and `lib/knowledge/analyse.ts:76`+`:709` (quarantined, deleted in Phase 7). Add `"claude-sonnet-4-6": { input: 3.00, output: 15.00 }` to `MODEL_PRICING`. Commit message must note the spec §4.7 list was stale. |
| **5.14a** | **Mocked-AI integration test** (NEW) — bridges-the-stages gate | `test(pipeline): orchestrator end-to-end with mocked AI` | **1 integration test** in `tests/pipeline/orchestrator-integration.test.ts` running orchestrator stages 0–6 in sequence with mocked Anthropic responses (no API key required, runs in CI). Asserts: every stage's output schema matches the next stage's input schema, criterion_tags propagate, no errors thrown. Fast (< 2s). | `tests/fixtures/phase-2/orchestrator-mocked-{request,golden-output}.json` | **NEW gap fix.** Unit tests cover stages in isolation. This is the seam-fit gate — proves Stage N output deserialises into Stage N+1 input. Runs every CI build, no cost. |
| 5.14 | **Gated vitest E2E test** at `tests/e2e/checkpoint-2-2-generation.test.ts` (was: one-shot script) | `test(e2e): real-generation gated E2E for Checkpoint 2.2` | Vitest test gated on `RUN_E2E=1 && ANTHROPIC_API_KEY` (mirrors `checkpoint-1-2-ingestion.test.ts`). Asserts: all 7 stages run, `criterion_tags` populated, Stage 4 output passes neutral validator, total cost < $2 captured value, `generation_runs` row written, student render produces valid HTML for `framework='GCSE_DT'`. **4/4 must pass green.** | `tests/fixtures/phase-2/e2e-baseline-cost.json`, `tests/fixtures/phase-2/e2e-baseline-stages.json` | **CHANGED from one-shot script.** Mirrors Phase 1.7's strongest decision: a re-runnable gated vitest test is the canonical Checkpoint 2.2 gate, not a manual ✓. |
| 5.15 | 🛑 **Matt Checkpoint 2.2** — Real unit generated end-to-end | (no commit) | **The 5.14 test must pass 4/4 green** (automated gate) + manual wizard run + framework swap + screenshots | n/a | Pre-task: pre-flight check whether a `framework='GCSE_DT'` class exists in prod. If not, sub-task 5.0 (seed a GCSE test class) lands first. |

**Net audit-driven + test-coverage scope change:**
- **Shrinks:** 5.1 (verified), 5.3 (verify only), 5.4 (partial→complete), 5.7 (partial→complete)
- **Expands:** 5.2 (3→7 tests), 5.2.5 (NEW — 5 commits incl meta-test), 5.3 (1→4 tests), 5.4 (1→5), 5.5 (1→6), 5.6 (1→4), 5.7 (1→5), 5.8 (regression test instead of delete), 5.9 (64-cell adapter suite), 5.10 (3 component tests + 5 string decisions), 5.11 (+smoke test), 5.13 (+regression test), **5.14a NEW** (mocked-AI integration), **5.14 changed** (script → gated vitest E2E)
- **Total new test count:** ~50 new tests across the phase (vs ~12 in original draft)
- **Estimate:** Originally 4–5 days. Revised: **5–7 days realistic** with the truth-capture discipline. The extra time buys robust regression coverage that lets future phases build on Phase 2 confidently.

### Sub-task 5.1.5 — Pipeline 2 forward-compat seam guard tests

**Goal:** Lock in the 3 already-satisfied seams that Pipeline 2 will depend on, so a future Pipeline 1 refactor can't silently narrow them. Pure regression tests against existing source — no schema change, no app code change.

**Files:**
- NEW: `/questerra/tests/pipeline/pipeline-2-seam-guards.test.ts`

**Tests:**

1. `IngestionPass` interface remains generic
   - Read `/questerra/src/lib/ingestion/types.ts` as text
   - Assert source contains `IngestionPass<TInput, TOutput>` (or the exact generic signature with both type params)
   - Failure means someone removed generics — Pipeline 2 would have to fork the interface

2. `PassConfig.supabaseClient` stays structurally typed
   - Read `/questerra/src/lib/ingestion/types.ts` as text
   - Assert `PassConfig` contains `from: (table: string) => any` (or equivalent structural shape) AND does NOT import the full `SupabaseClient` type from `@supabase/supabase-js` for this field
   - Failure means we narrowed to the concrete client and broke OS Seam 1

3. `success_look_fors` migration column stays `TEXT[]`
   - Read `/questerra/supabase/migrations/060_activity_blocks.sql` as text
   - Assert source contains `success_look_fors TEXT[]`
   - Failure means someone changed it to `UUID[]` or a foreign-key ref, which would break Pipeline 2 vision feedback prompts

**Acceptance:**
- All 3 tests pass on current `main`
- Negative-control verification: temporarily break each assertion (e.g. rename `TInput` → `T` in source), confirm test fails with a clear error, revert
- vitest count moves up by 3 (run before/after to confirm)

**Out of scope:**
- No schema migrations
- No app code changes
- No new `pipeline_id` column on `generation_runs` (deferred — YAGNI per seam review)

---

## 6. Stop triggers (literal — Code stops and reports)

1. **A Stage 5b skeleton exists in the orchestrator or stage folder.** Don't delete it silently — report what you found and wait.
2. **Phase 1.7-style `max_tokens` smell.** New tool_use call site rejects 16000 max_tokens, OR an existing Stage 3/4 site is found without a `stop_reason` guard during audit. Report the audit count and let Matt decide whether the audit becomes a sub-task or a separate phase.
3. **More than 12 update sites OR any update site not in the locked list.** Pre-flight (11 Apr 2026) confirmed exactly **12 update sites** = the 11 in spec §4.7 + `src/lib/ingestion/pass-b.ts:23` (Phase 1.7 cleanup leftover, missed by spec). Plus 2 intentional keeps (`usage-tracking.ts:6` historical pricing, `knowledge/analyse.ts:76`+`:709` quarantined). If grep finds a site not on that list, the world has drifted — report the full diff before changing anything.
4. **Mapping ambiguity in `neutral-criterion-taxonomy.md`.** If any cell of any 8×8 matrix is unclear (e.g., GCSE has changed and the spec is stale), STOP and ask Matt before guessing.
5. **`pnpm lint` or `tsc --noEmit` fails on existing code at pre-flight time.** Report the failure — don't try to "fix unrelated lint" as part of Phase 2.
6. **A test that previously passed now fails after a Phase 2 commit and the failure isn't obviously caused by that commit.** STOP, run the failing test in isolation, capture the error, report.
7. **Cost > $3 on the E2E smoke run.** Spec budget is < $2. A 50% overshoot means the pipeline is doing more AI work than designed — report before locking the test.
8. **Vercel build fails after any push to `phase-2-wip`.** Don't push to `main` until the wip branch is green.
9. **The orchestrator's actual stage list doesn't match §3.** If the code has drifted from the spec in a non-obvious way, report the diff before "correcting" anything.

---

## 7. Don't stop for (the noise list)

To prevent over-stopping, these are NOT reasons to pause:

- Single-file lint warnings inside files Code is editing (fix in the same commit)
- Test names in unrelated files needing minor updates because of TypeScript shape changes (rename + commit, no need to escalate)
- Block-count drift in retrieved blocks ±20% across runs (Stage 1 is AI-judgment-dependent, like the DOCX block-count wobble in Phase 1.7)
- Stage 5 timing micro-drift ±2 minutes per phase (timing model is heuristic)
- Cost drift up to 30% above the captured baseline on the E2E smoke (model pricing changes; only > $3 absolute is a stop)
- Sandbox-vs-live wording differences in test fixtures (β tight on structural/enum/numeric, β loose on classification text — same rule we settled on for Checkpoint 1.2)
- Existing hardcoded model IDs in files §4.7 already lists — those are EXPECTED finds, not surprises

---

## 8. Pre-flight ritual (BEFORE any code)

Run in this order. Each step's output goes into the pre-flight report Code posts to Matt at the end.

1. `git status` → expect clean working tree on `main`
2. `git log --oneline -10` → expect `2cd57aa` or later (post-Phase 1.7) at HEAD
3. `git pull --ff-only` → expect "Already up to date." (or fast-forward if Matt pushed FU-6)
4. `npm test 2>&1 | tail -20` → capture baseline test count (expect ~615 passed | 2 skipped, possibly +N from interim work)
5. **Audit-before-touch grep block** (do not modify anything):
   - `rg "claude-sonnet-4-20250514" src/ -l` → expect ~10–12 files matching spec §4.7 list
   - `rg "Stage 5b|stage5b|stage-5b" src/` → expect zero matches (if non-zero → STOP per trigger #1)
   - `rg "Criterion [A-D]|AO[1-4]" src/lib/pipeline/stages/stage4-polish.ts` → expect zero matches in the prompt (if non-zero, that's the bug 5.2 fixes)
   - `rg "tool_use" src/lib/pipeline/stages/` → list every tool_use site in the generation pipeline (Phase 2 will touch some, all need Lesson #39 compliance)
   - `rg "stop_reason" src/lib/pipeline/stages/` → cross-reference: every site in the previous grep that doesn't appear here is a Lesson #39 violation
   - `rg "FrameworkAdapter|mapCriterion" src/` → confirm FrameworkAdapter is currently a stub
   - `rg "FormatProfile" src/lib/pipeline/stages/` → identify which stages already consume it (the spec says Stage 5 is "partially wired")
6. Read `docs/specs/format-profile-definitions.md` end-to-end
7. Read `docs/specs/neutral-criterion-taxonomy.md` end-to-end and spot-check the 8×8 table for any obvious gaps
8. Read `src/lib/pipeline/orchestrator.ts` end-to-end and confirm the stage call sequence
9. Read `src/lib/frameworks/index.ts` to inventory which framework definitions exist and which are stubs
10. **STOP — post the pre-flight report to Matt and wait for sign-off before sub-task 5.1**

The pre-flight report must include: clean-tree status, baseline test count, every grep result count + the actual file list (not just the count), the orchestrator stage sequence as actually written in code, the inventory of which stages already consume FormatProfile, and any surprises.

---

## 9. Push discipline

- All Phase 2 commits land on `main` only AFTER Checkpoint 2.2 is signed off in chat.
- During the phase: backup to `phase-2-wip` after every meaningful commit using `git push origin main:phase-2-wip` (no Vercel deploy because main hasn't moved).
- When Checkpoint 2.2 passes and Matt signs off → `git push origin main` → verify Vercel green deploy → run `npm test` post-deploy and confirm baseline.
- Migrations (none expected in Phase 2 unless 4.7 needs `usage-tracking.ts` to learn a new pricing row in the DB rather than code — TBD at sub-task 5.13) must be applied to prod Supabase BEFORE the main push.

---

## 10. Phase 2 acceptance (verbatim from spec §4.11, plus brief-level additions)

- [ ] No Stage 5b in orchestrator or stage folder + permanent guard test in place
- [ ] Stage 4 output contains no framework vocabulary (enforced by fail-loud validator + 7 tests)
- [ ] All 6 AI-using stages consume their FormatProfile field, **proven by per-profile tests** (4 distinct outputs across Design/Service/PP/Inquiry, not just "non-null")
- [ ] Truth-capture fixtures exist under `tests/fixtures/phase-2/` for every stage and are referenced by the corresponding tests
- [ ] `mapCriterion("designing", "IB_MYP")` returns valid descriptor; full 64-cell (8×8) adapter suite green
- [ ] `/admin/framework-adapter` page functional + smoke test passes
- [ ] **Mocked-AI integration test (5.14a) green in CI** — orchestrator end-to-end with stage seam checks
- [ ] **Gated vitest E2E test (5.14) at `tests/e2e/checkpoint-2-2-generation.test.ts` passes 4/4 with `RUN_E2E=1 ANTHROPIC_API_KEY=...`** — this is the canonical Checkpoint 2.2 gate, not a manual ✓
- [ ] Checkpoints 2.1 + 2.2 passed
- [ ] Hardcoded model ID removed from all 12 update sites (11 spec + `pass-b.ts:23`); regression test (5.13) passes
- [ ] `pnpm lint && tsc --noEmit && npm test` green
- [ ] Every new tool_use call site has the Lesson #39 guard pattern; meta-test in place asserting all `src/lib/pipeline/stages/` tool_use sites are guarded
- [ ] All baseline test values captured from real runs and locked into asserts (Lesson #38)
- [ ] Phase 2 follow-ups (anything we found but didn't fix) filed as FU-N entries

---

## 11. Rollback (verbatim from spec §4.12)

If Checkpoint 2.2 fails:
- Keep FrameworkAdapter (5.9) + Test Panel (5.11) — they're independent and valuable.
- Revert FormatProfile wiring commits for the specific stage that broke generation.
- File failure mode in `docs/lessons-learned.md`.

---

## 12. Matt decisions (locked 11 Apr 2026)

1. **Sub-task ordering** → **Serial.** Land 5.1 → 5.15 in strict order. One thread, easier to checkpoint, easier to revert. Matches Phases 1.5/1.6/1.7.
2. **Stage 4 validator** → **Fail loud during Phase 2.** Validator throws when forbidden tokens (`Criterion [A-D]`, `AO[1-4]`, `MYP`, `GCSE` etc.) appear in Stage 4 output. Surfaces the underlying prompt bug while it's cheap. Switch to auto-rewrite as a Phase 2.x follow-up only if loud-fail proves too noisy in real use.
3. **GCSE test class** → **Pre-flight will find out.** Pre-flight grep + Supabase query checks for any class with `framework='GCSE_DT'`. If none exists, it becomes sub-task 5.0 and gets seeded before any other Phase 2 work. Decision deferred to pre-flight report.
4. **`usage-tracking.ts` pricing location** → **Pre-flight will find out.** Pre-flight reads `src/lib/usage-tracking.ts` and reports whether pricing is a code constant (sub-task 5.13 just adds a key) or a Supabase row (sub-task 5.13 needs a migration). Decision deferred to pre-flight report.
5. **FU-5 fold-in** → **Fold touched sites into Phase 2.** Stage 3 (gap-fill) and Stage 4 (polish) AI call sites get the Lesson #39 `stop_reason` guard pattern as part of their Phase 2 commits. Remaining quarantined FU-5 sites stay open. Methodology-correct: fix-all-similar-sites-in-same-phase rule applied to the sites Phase 2 actually touches.

---

## 13. Estimated calendar

| Day | Sub-tasks | Notes |
|---|---|---|
| Day 1 (am) | Pre-flight ritual + report + Matt sign-off | Don't start coding until this passes |
| Day 1 (pm) | 5.1 (5b confirm + guard test) + 5.13 (model ID sweep + regression test) | Mechanical; safe to land first |
| Day 2 (am) | 5.2.5 (4 commits + meta-test for max_tokens guards) | Lands BEFORE any new tool_use site |
| Day 2 (pm) | 5.2 (Stage 4 neutral validator + 7 tests) | Riskiest single change |
| Day 3 | 5.3 (4 profile tests) + 5.4 (5 tests) + truth-capture for stages 1+2 | Per-profile fixture capture takes time |
| Day 4 | 5.5 (6 tests) + 5.6 (4 tests) + truth-capture for stages 3+4 | Two new tool_use sites with guards |
| Day 5 | 5.7 (5 tests) + 5.8 (regression test) + 5.9 (FrameworkAdapter, 64-cell suite) | FrameworkAdapter is the long sub-task |
| Day 6 (am) | 5.10 (3 component tests + 5 string decisions) + 5.11 (Test Panel + smoke) | UI work |
| Day 6 (pm) | 5.12 Checkpoint 2.1 + 5.14a (mocked-AI integration test) | First gate signed off |
| Day 7 | 5.14 (gated vitest E2E test) + 5.15 Checkpoint 2.2 (4/4 green required) + push | Real Anthropic call, captured baseline locked |

This is a "things go well" estimate. The methodology says pad it; realistic is **6–8 days** with the truth-capture discipline. The extra time vs the original 4–5 day estimate buys ~50 tests (vs ~12), per-profile coverage that proves FormatProfile is real wiring not a no-op, and an automated Checkpoint 2.2 gate that can be re-run any time.

---

**Status:** AWAITING SIGN-OFF.
**Next action after sign-off:** Run pre-flight ritual §8 and post the pre-flight report. **Do not write any production code until both this brief and the pre-flight report are signed off.**
