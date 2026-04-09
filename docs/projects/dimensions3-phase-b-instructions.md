# Dimensions3 Phase B — Ingestion Pipeline

## Context

You are building Phase B of the Dimensions3 generation pipeline rebuild for StudioLoom. Phase A (Foundation) and Phase B (Ingestion) are COMPLETE and committed on `main`.

**Important: the project root is `/questerra/`.** All file paths below are relative to that root.

## CRITICAL: Git & File Rules

1. **Work directly on the `main` branch.** Do NOT use worktrees, do NOT create new branches.
2. **When all tasks are complete, `git add` the new/changed files and `git commit` them on main.**
3. **Verify the commit exists with `git log --oneline -3` before reporting done.**
4. **All file paths must use the full path from `/questerra/`** — not relative paths.

---

## Phase A Completed (your starting point)

These files already exist on `main`:

- **Types:** `/questerra/src/types/activity-blocks.ts` — ActivityBlock interface, FormatProfile, CostBreakdown, all pipeline stage types (GenerationRequest, BlockRetrievalResult, AssembledSequence, FilledSequence, PolishedSequence, TimedUnit, QualityReport, etc.)
- **Pipeline simulator:** `/questerra/src/lib/pipeline/pipeline.ts` — 6 mock stage functions with typed contracts, fixture data. Decision 42: one file, six exported functions.
- **Pipeline tests:** `/questerra/src/lib/pipeline/__tests__/pipeline.test.ts` — 92 tests validating contracts
- **Generation logging:** `/questerra/src/lib/pipeline/generation-log.ts`
- **Sandbox UI:** `/questerra/src/app/admin/sandbox/page.tsx`
- **Migrations:**
  - `/questerra/supabase/migrations/060_activity_blocks.sql` — activity_blocks table + generation_feedback
  - `/questerra/supabase/migrations/061_generation_runs.sql` — generation_runs logging table
  - `/questerra/supabase/migrations/062_teacher_tier.sql` — tier column + checkTierAccess stub
- **FormatProfile:** `/questerra/src/lib/ai/unit-types.ts` — `getFormatProfile()` function + 4 profiles (Design, Service, PP, Inquiry)

---

## What to Build: Phase B (Ingestion, ~3 days)

The ingestion pipeline takes uploaded documents and extracts Activity Blocks for the library. Read the full spec at `/questerra/docs/projects/dimensions3.md` — Section 4 "The Ingestion Pipeline" (starts around line 436) is the primary reference.

### Architecture Overview

```
Upload ──→ Dedup ──→ Parse ──→ Pass A ──→ Pass B ──→ Extract ──→ Review
           Hash      Non-AI    Classify    Analyse    Blocks     Queue
                               + Tag       + Enrich
```

### Task B1: Ingestion Pass Registry + Pass A + Pass B

**Build the expandable pass architecture** (spec Section 4, "Expandable Pass Architecture"):

1. Create the `IngestionPass<TInput, TOutput>` interface:
```typescript
interface IngestionPass<TInput, TOutput> {
  id: string;              // e.g., 'pass-a-classify', 'pass-b-analyse'
  label: string;           // Human-readable name for sandbox
  model: string;           // Default model ID
  run: (input: TInput, config: PassConfig) => Promise<TOutput & { cost: CostBreakdown }>;
}
```

2. **PassConfig must include a supabaseClient** — pass functions must be pure. No `req.headers`, no direct Supabase client construction. The API route creates the client and passes it via config. This is OS Seam 1 (spec Section 19.2).

3. **Pass A — Classify + Tag** (cheap model, Haiku, ~500-1000 tokens):
   - Single AI call: document type classification, confidence, structural outline, section boundaries, topic
   - Output type: `IngestionClassification` (see spec for interface — documentType, confidence, topic, sections array)
   - Maps to what old Passes 0+1 did together

4. **Pass B — Analyse + Enrich** (medium model, Sonnet, ~2000-4000 tokens):
   - Takes classified sections from Pass A, enriches each with: bloom_level, time_weight, grouping, phase, activity_category, materials, scaffolding_notes, udl_hints, teaching_approach
   - Output type: `IngestionAnalysis` (classification + enrichedSections array)
   - Maps to what old Passes 2+2b did together

5. **Registry:** `const ingestionPasses: IngestionPass<any, any>[] = [passA, passB];`
   - Sandbox auto-generates panels from registry (one panel per pass)
   - Adding future passes = push to array, no pipeline code changes

6. **Also build the non-AI stages:**
   - Stage I-0: Dedup Check — SHA-256 hash, check against existing uploads
   - Stage I-1: Deterministic Parsing — heading structure, paragraph breaks, section extraction (no AI)

**Key files to reference:**
- Existing AI provider pattern: `/questerra/src/lib/ai/prompts.ts` (see how `buildDesignTeachingContext()` works)
- Existing knowledge analysis: `/questerra/src/lib/knowledge/analyse.ts` and `/questerra/src/lib/knowledge/analysis-prompts.ts` — these are the OLD ingestion system (quarantined) but show the AI call patterns
- AI model config: check `/questerra/src/lib/ai/` for how Anthropic/Groq/Gemini calls are made
- CostBreakdown type: already defined in `/questerra/src/types/activity-blocks.ts`

**Where to put new code:**
- `/questerra/src/lib/ingestion/` — new directory for all ingestion code
  - `types.ts` — IngestionPass, IngestionClassification, IngestionAnalysis, EnrichedSection, PassConfig interfaces
  - `registry.ts` — pass registry array
  - `pass-a.ts` — classify + tag
  - `pass-b.ts` — analyse + enrich
  - `dedup.ts` — SHA-256 dedup check
  - `parse.ts` — deterministic section parsing
  - `pipeline.ts` — orchestrator that runs dedup → parse → passes in sequence
- API route: `/questerra/src/app/api/teacher/knowledge/ingest/route.ts` (may already exist from old system — replace with new)

### Task B2: Block Extraction + PII Scan + Copyright Flag

**After Pass B enriches sections, extract Activity Blocks** (spec Stage I-4):

1. Each enriched section with `sectionType: 'activity'` becomes a candidate ActivityBlock
2. Metadata populated from Pass B enrichment (bloom_level, time_weight, grouping, phase, activity_category, etc.)
3. **PII scan:** regex patterns first (emails, phone numbers, names). If regex flags potential PII, make a cheap Haiku call to verify. Result stored in `pii_flags` JSONB on the block.
4. **Copyright flag:** based on upload source marking — `'own' | 'copyrighted' | 'creative_commons' | 'unknown'`
5. Blocks stored in `activity_blocks` table (migration 060 already created the schema)
6. `source_upload_id` should reference the `content_items` table (see OS Seam 3 in spec Section 19.2)

**Important:** You need to create the `content_items` table migration. This is the OS-aligned upload tracking table (spec Section 19.2, Seam 3). Schema is fully defined in the spec around line 2730. Migration should be numbered `063_content_items.sql`.

**Where to put new code:**
- `/questerra/src/lib/ingestion/extract.ts` — block extraction logic
- `/questerra/src/lib/ingestion/pii-scan.ts` — PII detection (regex + AI verification)
- `/questerra/supabase/migrations/063_content_items.sql` — content_items table

### Task B3: Review Queue UI

Build a teacher-facing UI for reviewing extracted blocks:

1. Extracted blocks enter a review queue with status `pending`
2. Teacher can: **approve** (block enters library), **edit** (modify then approve), or **reject** (block discarded)
3. Show: block title, description, prompt text, bloom pill, time_weight badge, phase, activity_category, PII flags, copyright flag
4. Bulk approve option for when a teacher trusts the extraction

**Where to put new code:**
- `/questerra/src/app/teacher/knowledge/review/page.tsx` — review queue page
- `/questerra/src/components/teacher/knowledge/BlockReviewCard.tsx` — individual block review card
- `/questerra/src/components/teacher/knowledge/ReviewQueue.tsx` — queue container with bulk actions
- API route: `/questerra/src/app/api/teacher/activity-blocks/review/route.ts` — approve/reject endpoints

### Task B4: Test with Real Uploads

After B1-B3 are built:
1. Test the full pipeline with 3-5 real document uploads (use files from `/questerra/data/` or create test fixtures)
2. If Pass B output is missing critical data, add a focused Pass C. Otherwise ship.
3. Write tests for the ingestion pipeline — at minimum: pass registry iteration, Pass A output validation, Pass B output validation, block extraction correctness, PII detection, dedup behavior

---

## Critical Constraints

1. **Haiku model ID:** `claude-haiku-4-5-20251001` (NOT the old 20250315 ID — that returns 404)
2. **`thinking` + `tool_choice` cannot be used together** in Anthropic API calls
3. **Ingestion passes must be pure functions** — no HTTP request dependencies, Supabase client passed via config (OS Seam 1)
4. **`module TEXT DEFAULT 'studioloom'`** on activity_blocks — already in migration 060. Ensure content_items also has this column (OS Seam 2+3)
5. **All new code must have tests.** Use Vitest. Existing test patterns in `/questerra/src/lib/pipeline/__tests__/pipeline.test.ts`
6. **Build passes clean** — run `npx next build` before reporting done
7. **Decision 42:** Pipeline starts as minimal files. Don't over-abstract. Extract to separate modules only when justified.

## Spec References (READ THESE)

- **Primary spec:** `/questerra/docs/projects/dimensions3.md` — Section 4 (Ingestion Pipeline, ~line 436), Section 7.3 (Ingestion Sandbox), Section 8.3 (PII & Copyright), Section 19 (OS Seams)
- **Testing plan:** `/questerra/docs/projects/dimensions3-testing-plan.md`
- **Block types:** `/questerra/src/types/activity-blocks.ts`
- **Pipeline simulator:** `/questerra/src/lib/pipeline/pipeline.ts`
- **Phase A migration:** `/questerra/supabase/migrations/060_activity_blocks.sql`
- **Existing AI patterns:** `/questerra/src/lib/ai/prompts.ts`, `/questerra/src/lib/knowledge/analyse.ts`
- **Education AI patterns:** `/questerra/docs/education-ai-patterns.md` (5 core patterns all interactive tools must follow)
