# Test Coverage Map

> Last updated: 7 Apr 2026
> Run tests: `npm test` (or `npx vitest run`)

## Current Test Files (16 files, ~600+ test assertions)

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
| **NEW:** `lib/pipeline/__tests__/stage-contracts.test.ts` | Dimensions3 stage contracts (0-2) | ~30+ | **YES — core pipeline** |
| **NEW:** `lib/ai/__tests__/validation.test.ts` | AI output validation (pages + timeline) | ~25+ | **YES — Stage 3/4 output validation** |

## Critical Gaps for Dimensions3

| Gap | Risk | Priority | Notes |
|-----|------|----------|-------|
| **No Stage 3-6 contract tests** | Stage outputs drift from spec | P0 | Write as each stage is built |
| **No integration test for full pipeline flow** | Stages work alone but break together | P0 | Add after Stages 0-3 exist |
| **No API route tests** | Routes return wrong status codes or data shapes | P1 | Need Supabase mock or test DB |
| **No Activity Block schema tests** | Blocks stored with invalid data | P1 | Test after migration is applied |
| **No ingestion pipeline tests** | Pass 0/1/2 produce wrong classifications | P1 | Write alongside ingestion rebuild |
| **No RLS policy tests** | Data leaks between teachers/students | P2 | Need test DB setup |

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
