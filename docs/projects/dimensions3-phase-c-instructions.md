# Dimensions3 Phase C — Generation Pipeline

## CRITICAL: Git & File Rules

1. **Work directly on the `main` branch.** Do NOT use worktrees, do NOT create a new branch.
2. **All file paths use the full path from `/questerra/`.** Not relative paths.
3. **When all tasks are complete, `git add` the new/changed files and `git commit` them on main.**
4. **Verify the commit exists with `git log --oneline -3` before reporting done.**

---

## Context

You are building Phase C (Generation) of the Dimensions3 pipeline rebuild for StudioLoom. This is the core pipeline — where teacher inputs become units.

**Phase A (Foundation) and Phase B (Ingestion) are COMPLETE and committed on `main`.**

---

## What Already Exists (your starting point)

All on `main`:

**Phase A files:**
- `/questerra/src/types/activity-blocks.ts` — ALL type definitions: `ActivityBlock`, `GenerationRequest`, `BlockRetrievalResult`, `RetrievedBlock`, `AssembledSequence`, `LessonSlot`, `ActivitySlot`, `FilledSequence`, `FilledLesson`, `FilledActivity`, `PolishedSequence`, `PolishedLesson`, `PolishedActivity`, `TimedUnit`, `TimedLesson`, `TimedPhase`, `QualityReport`, `DimensionScore`, `CostBreakdown`, `FormatProfile`, etc.
- `/questerra/src/lib/pipeline/pipeline.ts` — Pipeline simulator with 6 mock stage functions (these are the functions you're replacing with real implementations)
- `/questerra/src/lib/pipeline/__tests__/pipeline.test.ts` + `stage-contracts.test.ts` — 92 tests
- `/questerra/src/lib/pipeline/generation-log.ts` — Generation run logging
- `/questerra/src/app/admin/sandbox/page.tsx` — Sandbox shell UI
- `/questerra/supabase/migrations/060_activity_blocks.sql` — activity_blocks table
- `/questerra/supabase/migrations/061_generation_runs.sql` — generation_runs logging
- `/questerra/supabase/migrations/062_teacher_tier.sql` — tier + checkTierAccess stub
- `/questerra/src/lib/ai/unit-types.ts` — `getFormatProfile()` + 4 FormatProfile definitions

**Phase B files:**
- `/questerra/src/lib/ingestion/` — Full ingestion pipeline (pass registry, Pass A, Pass B, extraction, PII scan, dedup, parse)
- `/questerra/src/lib/ingestion/__tests__/ingestion.test.ts` — 34 tests
- `/questerra/supabase/migrations/063_content_items.sql` — content_items + content_assets tables
- `/questerra/src/app/api/teacher/knowledge/ingest/route.ts` — Ingestion API
- `/questerra/src/app/api/teacher/activity-blocks/review/route.ts` — Review queue API
- `/questerra/src/app/teacher/knowledge/review/page.tsx` — Review queue page
- `/questerra/src/components/teacher/knowledge/` — BlockReviewCard, ReviewQueue, StudentFeedbackPulse

**Existing AI infrastructure:**
- `/questerra/src/lib/ai/prompts.ts` — `buildDesignTeachingContext()`, `buildTimingBlock()`, prompt construction patterns
- `/questerra/src/lib/ai/design-assistant-prompt.ts` — Student mentor system prompt (shows how AI personas work)
- `/questerra/src/lib/ai/timing-validation.ts` — `validateLessonTiming()`, timing presets, Workshop Model rules
- `/questerra/src/lib/knowledge/search.ts` — Existing embedding search (hybrid 70/20/10 vector/BM25/quality)
- `/questerra/src/lib/teacher-style/profile-service.ts` — Teacher style profile service

---

## What to Build: Phase C (Generation, ~5 days)

The master spec is at `/questerra/docs/projects/dimensions3.md` — Section 3 "The 6-Stage Generation Pipeline" (starts line 50). Read it thoroughly before starting.

The pipeline simulator in `/questerra/src/lib/pipeline/pipeline.ts` has mock implementations of all 6 stages. You are replacing these mocks with real implementations, one stage at a time. **Keep the simulator functions as fallbacks** — they're used when `sandboxMode: true`.

### Task C1: Stage 1 — Block Retrieval

**Input:** `GenerationRequest`
**Output:** `BlockRetrievalResult` — ranked candidate blocks with relevance scores

Build a real retrieval system that:

1. **Queries the `activity_blocks` table** using the request's topic, unit type, grade level, and constraints
2. **Embedding search:** Generate an embedding for the request topic + context, then find similar blocks via pgvector cosine similarity. Use Voyage AI `voyage-3.5` (1024-dim) — check how `/questerra/src/lib/knowledge/search.ts` does this.
3. **Scoring formula** (spec line ~130):
   ```
   score = 0.35 * vectorSimilarity
         + 0.20 * efficacyNormalized
         + 0.20 * metadataFit
         + 0.15 * textMatch
         + 0.10 * usageSignal
   ```
   Where `usageSignal = log(times_used + 1) / log(max_times_used + 1)`
4. **MetadataFit:** Match bloom_level, phase, grouping, activity_category against the FormatProfile's expectations. Use `getFormatProfile()` from `/questerra/src/lib/ai/unit-types.ts`.
5. **When library is empty:** Return empty candidates list. Stage 2 marks everything as gaps. Stage 3 generates everything. This must work gracefully.
6. **Visibility filter:** `WHERE visibility = 'private' AND teacher_id = $teacherId` (spec Section 18, decision 1). Accept a `visibility` filter parameter even though only 'private' is used now.

**Where to put code:**
- `/questerra/src/lib/pipeline/stages/stage1-retrieval.ts`
- Keep the mock in `/questerra/src/lib/pipeline/pipeline.ts` for sandbox mode

### Task C2: Stage 2 — Sequence Assembly

**Input:** `GenerationRequest` + `BlockRetrievalResult`
**Output:** `AssembledSequence` — ordered slot plan with blocks placed and gaps identified

1. **One medium-model AI call** (Sonnet) to determine optimal sequence given blocks and constraints
2. Takes the retrieved blocks and arranges them into lesson slots
3. Identifies gaps — positions where no suitable block exists
4. For each gap, provides context: preceding block, following block, required outputs, suggested bloom/grouping/time_weight/category/phase
5. **Prerequisite validation:** Check `prerequisite_tags` on blocks — if block B requires tag X, ensure some block before it produces output X. Flag violations with severity (hard/soft).
6. **FormatProfile-aware:** Use the profile's phase definitions to structure the lesson sequence. A Design unit has different phases than a Service unit.
7. Prompt should reference the `GenerationRequest.preferences.suggestedSequencePattern` if provided.

**Where to put code:**
- `/questerra/src/lib/pipeline/stages/stage2-assembly.ts`

### Task C3: Stage 3 — Gap Generation

**Input:** `AssembledSequence` (the gaps specifically)
**Output:** `FilledSequence` — all gaps filled with AI-generated activities

This is the most expensive stage — most tokens are spent here.

1. **One AI call per gap** (parallelizable with `Promise.all`)
2. Each gap call gets the gap context: what comes before, what comes after, required outputs, suggested metadata
3. Generated activities must include ALL fields from `FilledActivity`: title, prompt, bloom_level, time_weight, grouping, phase, activity_category, lesson_structure_role, response_type, materials_needed, scaffolding, ai_rules, udl_checkpoints, success_look_fors, output_type, prerequisite_tags
4. **Use Sonnet for generation** — this is where quality matters most
5. Track per-gap metrics: tokens used, cost, time, model
6. **Design Teaching Intelligence:** Read `/questerra/docs/design-teaching-corpus.md` — the generation prompts should inject design teaching best practices. Use `buildDesignTeachingContext()` from `/questerra/src/lib/ai/prompts.ts` as the pattern.
7. **FormatProfile injection:** The prompt must tell the AI which unit format this is and what phases/categories are expected

**Where to put code:**
- `/questerra/src/lib/pipeline/stages/stage3-generation.ts`

### Task C4: Stage 4 — Connective Tissue & Polish

**Input:** `FilledSequence`
**Output:** `PolishedSequence` — transitions, cross-references, familiarity adjustments, scaffolding progression

1. **One AI call over the full sequence** (or per-lesson for long units >8 lessons)
2. Add `transitionIn` and `transitionOut` on each activity
3. Add `crossReferences` between related activities across lessons ("Remember the personas you created in Lesson 2")
4. Build `interactionMap` — array of `BlockInteraction` objects showing prerequisite chains, familiarity links, artifact flows
5. Adjust scaffolding progression — early lessons should have more scaffolding than later ones
6. **Familiarity adaptation:** If a block from the library has been used before with this teacher's students, reduce scaffolding. New blocks get full scaffolding.

**Where to put code:**
- `/questerra/src/lib/pipeline/stages/stage4-polish.ts`

### Task C5: Stage 5 — Timing & Structure

**Input:** `PolishedSequence` + class context
**Output:** `TimedUnit` — lessons with time allocations

1. **Primarily computation, small AI call for edge cases**
2. Map activities into FormatProfile phases using their `phase` field
3. Allocate time using `time_weight` as starter defaults: quick=5-8min, moderate=10-18min, extended=20-35min, flexible=remaining
4. Respect period length from `constraints.periodMinutes`
5. Check for overflow — flag lessons that exceed the period
6. **Reference:** `/questerra/src/lib/ai/timing-validation.ts` has the existing timing validation rules. `/questerra/docs/timing-reference.md` has the full timing model.
7. Generate `LessonExtension` objects for lessons with extra time (spec shows `extensions` on `TimedLesson`)
8. **Timing source:** Tag as `'starter_default'` for now — learned patterns come in Phase D

**Where to put code:**
- `/questerra/src/lib/pipeline/stages/stage5-timing.ts`

### Task C6: Stage 6 — Quality Scoring

**Input:** `TimedUnit`
**Output:** `QualityReport` — diagnostic scores, coverage analysis, recommendations

1. **Mostly computation, optional small AI call for natural-language recommendations**
2. Score 5 dimensions (0-10 each): cognitiveRigour, studentAgency, teacherCraft, variety, coherence
3. Build coverage maps: bloom distribution, grouping distribution, UDL checkpoints, phases covered, categories covered
4. Library metrics: block reuse rate, average efficacy, new blocks generated
5. Cost summary: per-stage, per-lesson, total
6. Generate actionable recommendations (strings)
7. **Reuse Lesson Pulse:** The existing Lesson Pulse code at `/questerra/src/lib/lesson-pulse/` has scoring logic for CR/SA/TC dimensions. Reuse what you can — the spec says Stage 6 reuses Lesson Pulse.

**Where to put code:**
- `/questerra/src/lib/pipeline/stages/stage6-scoring.ts`

---

## Pipeline Orchestrator

After building all 6 stages, create (or update) a pipeline orchestrator that:

1. Runs stages sequentially: Stage 1 → 2 → 3 → 4 → 5 → 6
2. Each stage's output feeds into the next stage's input
3. Logs the full run to `generation_runs` table (use `/questerra/src/lib/pipeline/generation-log.ts`)
4. Returns the final `QualityReport` + `TimedUnit` to the caller
5. Supports `sandboxMode: true` which uses the simulator functions instead of real AI calls
6. Tracks total cost across all stages

**Where to put code:**
- `/questerra/src/lib/pipeline/orchestrator.ts` — the real pipeline runner
- Keep `/questerra/src/lib/pipeline/pipeline.ts` as the simulator fallback

**API route:**
- `/questerra/src/app/api/teacher/generate-unit/route.ts` — this route already exists (quarantined). Replace it with a new implementation that calls the orchestrator. The old wizard lanes (Express/Guided/Architect) feed different `GenerationRequest` objects but all go through the same pipeline.

---

## Critical Constraints

1. **Haiku model ID:** `claude-haiku-4-5-20251001` (NOT the old 20250315 — that returns 404)
2. **Sonnet model ID:** `claude-sonnet-4-20250514` (check `/questerra/src/lib/ai/` for current usage)
3. **`thinking` + `tool_choice` cannot be used together** in Anthropic API calls
4. **All new code must have tests.** Use Vitest. Test each stage independently with fixture data.
5. **Build must pass clean** — run `npx next build` before reporting done
6. **Stage functions must be pure** where possible — pass dependencies via config, not globals. This is OS Seam 1.
7. **FormatProfile injection at every stage** — the pipeline must work for Design, Service, PP, and Inquiry unit types
8. **Cost tracking on every stage** — every function returns a `CostBreakdown`
9. **Empty library must work** — Stage 1 returns no blocks → Stage 2 marks all as gaps → Stage 3 generates everything

## Spec References (READ THESE)

- **Primary spec:** `/questerra/docs/projects/dimensions3.md` — Section 3 (6-Stage Pipeline, line 50-434), Section 7 (Sandbox, line 850+)
- **Types:** `/questerra/src/types/activity-blocks.ts` — all stage input/output interfaces
- **Pipeline simulator:** `/questerra/src/lib/pipeline/pipeline.ts` — mock implementations to replace
- **Design teaching corpus:** `/questerra/docs/design-teaching-corpus.md` — inject into generation prompts
- **Timing reference:** `/questerra/docs/timing-reference.md` — timing model
- **Timing validation:** `/questerra/src/lib/ai/timing-validation.ts` — existing validation rules
- **AI prompts:** `/questerra/src/lib/ai/prompts.ts` — prompt construction patterns
- **FormatProfiles:** `/questerra/src/lib/ai/unit-types.ts` — 4 unit type definitions
- **Embedding search:** `/questerra/src/lib/knowledge/search.ts` — hybrid search pattern
- **Testing plan:** `/questerra/docs/projects/dimensions3-testing-plan.md`
- **Education AI patterns:** `/questerra/docs/education-ai-patterns.md` — 5 core patterns
