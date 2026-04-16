# Test Coverage Map

> Last updated: 16 Apr 2026
> Run tests: `npm test` (or `npx vitest run`)
> Baseline: **1319 tests passing, 8 skipped** (16 Apr 2026)

## Current Test Files (21 files, ~1300+ test assertions)

### Core Platform Tests

| File | What it tests | Assertions | Dimensions3 critical? |
|------|--------------|------------|----------------------|
| `lib/layers/__tests__/lesson-pulse.test.ts` | Lesson Pulse scoring (CR/SA/TC dimensions) | ~115 | Yes — quality scoring reused in Stage 5 |
| `lib/ai/__tests__/design-assistant-toolkit-suggestions.test.ts` | Toolkit suggestion matching | ~61 | No |
| `lib/scheduling/__tests__/cycle-engine-scenarios.test.ts` | Timetable cycle edge cases | ~60 | No |
| `lib/ai/__tests__/teaching-moves.test.ts` | Teaching Moves Library matching/scoring | ~56 | Yes — moves become seed blocks |
| `lib/knowledge/__tests__/dimensions-helpers.test.ts` | Dimensions data helpers | ~50 | Yes — block metadata |
| `lib/scheduling/__tests__/cycle-engine.test.ts` | Timetable cycle engine core | ~50 | No |
| `components/student/__tests__/DesignAssistantWidget.test.tsx` | Design Assistant UI widget | ~40 | No |
| `lib/toolkit/__tests__/shared-api.test.ts` | Toolkit shared API | ~39 | No |
| `lib/integrity/__tests__/analyze-integrity.test.ts` | Academic integrity scoring | ~34 | No |
| `lib/ai/__tests__/design-assistant-prompt.snapshot.test.ts` | Design Assistant prompt snapshots | ~23 | No |
| `lib/knowledge/__tests__/retrieve-filters.test.ts` | Knowledge retrieval filters | ~21 | Yes — retrieval reused in Stage 1 |
| `lib/ai/__tests__/timing-validation.test.ts` | Timing validation (Workshop Model) | ~19 | Yes — reused in Stage 4 |
| `lib/api/__tests__/error-handler.test.ts` | API error handler | ~18 | No |
| `lib/ai/__tests__/framework-vocabulary.test.ts` | Framework vocabulary mapping | ~11 | Yes — FrameworkAdapter |
| `lib/ai/__tests__/prompts.snapshot.test.ts` | Generation prompt snapshots | ~9 | Yes — prompt structure |
| `lib/pipeline/__tests__/stage-contracts.test.ts` | Dimensions3 stage contracts (0-2) | ~30+ | **YES — core pipeline** |
| `lib/ai/__tests__/validation.test.ts` | AI output validation (pages + timeline) | ~25+ | **YES — Stage 3/4 output validation** |

### Ingestion Pipeline Tests (105 tests, 4 files)

| File | What it tests | Tests | Dimensions3 critical? |
|------|--------------|-------|----------------------|
| `lib/ingestion/__tests__/ingestion.test.ts` | Full pipeline: dedup, parse, Pass A/B, extract, PII/copyright, moderation, fingerprinting, cost tracking | ~80 | **YES — core ingestion** |
| `lib/ingestion/__tests__/multi-lesson-detection.test.ts` | Bold-heading promotion, Lesson/Week/Day boundary detection, enrichedSections reconstruction, fallback paths | ~14 | **YES — unit import** |
| `lib/ingestion/__tests__/pipeline-safety-scan.test.ts` | Safety pre-check: flagged/blocked → moderation hold, benefit-of-doubt on API failure, sandbox skip | ~6 | **YES — Phase 6C** |
| `lib/ingestion/__tests__/persist-blocks.test.ts` | Block persistence: batch insertion, schema mapping, embedding handling, error resilience | ~5 | **YES — block library** |

### E2E Checkpoint Tests

| File | What it tests | Variants |
|------|--------------|----------|
| `tests/e2e/checkpoint-1-2-ingestion.test.ts` | Full ingestion pipeline gate (Checkpoint 1.2) | α: Sandbox DOCX (runs on every `npm test`), β: Live DOCX + PDF (gated by `RUN_E2E=1`) |

### Multipart Upload Tests

| File | What it tests | Tests |
|------|--------------|-------|
| `app/api/teacher/library/__tests__/multipart-upload.test.ts` | Source-static tests: multipart branching, file validation, extractDocument usage, suggestedRedirect, route symmetry (ingest vs import) | ~21 |

## Resolved Gaps

| Gap | Resolution | Date |
|-----|-----------|------|
| ~~No ingestion pipeline tests~~ | 105 tests across 4 files covering dedup → parse → Pass A/B → extract → moderate → persist | 14 Apr 2026 |
| ~~No multi-lesson detection tests~~ | 14 tests covering enrichedSections reconstruction + heading detection | 16 Apr 2026 |
| ~~No safety scan tests~~ | 6 tests covering Phase 6C moderation hold + benefit-of-doubt | 14 Apr 2026 |

## Remaining Gaps

| Gap | Risk | Priority | Notes |
|-----|------|----------|-------|
| **No admin sandbox route tests** | Sandbox UI breaks silently | P2 | Requires Supabase mock; manually tested via spec §3.7 checkpoint |
| **No FrameworkAdapter mapping tests** | Neutral→framework round-trip drift | P1 | 8×8 matrix (64 assertions) needed before Phase 2 |
| **No API route tests** | Routes return wrong status codes or data shapes | P1 | Need Supabase mock or test DB |
| **No RLS policy tests** | Data leaks between teachers/students | P2 | Need test DB setup (tracked as FU-HH) |
| **No golden file comparisons for AI outputs** | AI output quality drift undetected | P2 | Plan exists in dimensions3-testing-plan.md §Automation Strategy; not yet implemented |

## Testing Strategy for Dimensions3

**Rule: Every stage gets its contract test BEFORE the implementation.**

1. Write the typed contract (interface) → already done for Stages 0-2
2. Write the validator function that checks outputs match the contract
3. Write tests for the validator (edge cases, empty inputs, malformed data)
4. Build the stage implementation
5. Add integration test connecting this stage to the previous one

This means by the time you've built all 6 stages, you have:
- 6 contract test files (unit tests, no DB/AI needed)
- 1 integration test file (tests full pipeline with mock AI responses)
- Snapshot tests for any AI prompts used in each stage
