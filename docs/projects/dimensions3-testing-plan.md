# Dimensions3 — Testing Plan

> Audit of every build phase deliverable, categorized by tester (Matt manual / Vitest automated / Sandbox visual), plus automation strategies to reduce manual testing burden.

## Testing Philosophy

Dimensions3 has a natural split: **typed contracts** (testable with pure functions and fixtures) vs **AI output quality** (requires human judgment). The goal is to automate everything that CAN be automated so Matt's manual testing is limited to things only a human can judge — visual UX, pedagogical quality, and "does this feel right?"

---

## Phase A — Foundation (~4 days)

### A1: Activity Blocks Table + CRUD

| What | Tester | How |
|------|--------|-----|
| Migration applies cleanly | Vitest | Migration smoke test (run migration, verify table exists, insert/select/update/delete a row) |
| All ~50 columns have correct types | Vitest | Insert a fully-populated block, read it back, assert every field type |
| RLS policies (teacher can only see own blocks) | Vitest | Insert as teacher A, query as teacher B, assert empty |
| CRUD API routes (POST/GET/PATCH/DELETE) | Vitest | HTTP-level tests with mock auth |
| Block search by embedding similarity | Matt | Upload a few blocks, search, verify relevance makes sense |

**Automation notes:** Block CRUD is 100% automatable. Write a `activity-blocks.test.ts` fixture file with 5-10 representative blocks covering all unit types and categories. Reuse across all later tests.

### A2: FrameworkAdapter

| What | Tester | How |
|------|--------|-----|
| All 8 neutral keys map correctly to all 8 frameworks | Vitest | Matrix test: 8 keys × 8 frameworks = 64 assertions |
| Round-trip: neutral → framework → neutral | Vitest | For every mapping, convert both directions, assert identity |
| Unknown key handling (graceful fallback) | Vitest | Pass garbage key, assert returns the key itself (not crash) |
| Visual label rendering on student page | Sandbox | FrameworkAdapter test panel (Section 7.5) — Matt eyeballs the matrix |

**Automation notes:** This is the most automatable piece in the entire build. Pure function, no AI, no DB. Write it with 100% coverage on day 1. The sandbox visual panel is a bonus for Matt to spot-check but shouldn't be required for CI.

```typescript
// Example test shape
describe('FrameworkAdapter', () => {
  const FRAMEWORKS = ['IB_MYP', 'GCSE_DT', 'IGCSE_DT', 'A_LEVEL_DT', 'ACARA_DT', 'PLTW', 'DOUBLE_DIAMOND', 'STANFORD_DSCHOOL'];
  const NEUTRAL_KEYS = ['researching', 'analysing', 'designing', 'creating', 'evaluating', 'reflecting', 'communicating', 'planning'];

  for (const framework of FRAMEWORKS) {
    for (const key of NEUTRAL_KEYS) {
      it(`maps ${key} → ${framework} → back`, () => {
        const adapted = adapt(key, framework);
        expect(adapted).toBeTruthy();
        expect(adapted).not.toBe(''); // no empty mappings
        const reversed = reverseAdapt(adapted, framework);
        expect(reversed).toBe(key);
      });
    }
  }
});
```

### A3: FormatProfile Interface + 4 Built-in Profiles

| What | Tester | How |
|------|--------|-----|
| Interface shape matches spec (all 8+ fields) | Vitest | TypeScript compiler (type-level test) — if it compiles, it's correct |
| 4 profiles (Design, Service, PP, Inquiry) all conform | Vitest | Assert each profile has all required fields, no nulls where required |
| blockRelevance boost/suppress categories are valid | Vitest | Assert all referenced categories exist in the 12-category enum |
| sequenceHints.defaultPattern exists | Vitest | Assert each profile names a real Sequence Pattern |
| Profile serialization (for custom profiles stored as JSONB) | Vitest | Serialize → deserialize → deep equal |

**Automation notes:** 100% automatable. FormatProfile is a pure data structure.

### A4: Pipeline Simulator (Mock Stages)

| What | Tester | How |
|------|--------|-----|
| All 6 stages chain correctly (output type of stage N = input type of stage N+1) | Vitest | Feed fixture through all 6 mock stages, assert no type errors and final output matches QualityReport shape |
| Each stage transforms data correctly per mock logic | Vitest | Per-stage unit tests with known input → expected output |
| Error propagation (stage 3 fails → pipeline reports which stage) | Vitest | Inject failure at each stage, assert error includes stage name |
| Cost tracking accumulates across stages | Vitest | Assert final cost = sum of per-stage costs |

**Automation notes:** The Pipeline Simulator IS a test harness. It should be the first thing built and run on every commit. ~20 tests covering the happy path + failure at each stage.

### A5: Sandbox UI Shell

| What | Tester | How |
|------|--------|-----|
| Sandbox page loads without crash | Vitest | Component render test (shallow) |
| Stage tabs render with correct names | Vitest | Assert 6 tab labels match pipeline stage names |
| Per-format tabs render | Matt | Visual — are Design/Service/PP/Inquiry tabs present? |
| Traffic light indicators display | Matt | Visual — do they show green/amber/red? |

**Automation notes:** Sandbox is mostly visual. Automate the "does it render" check; Matt eyeballs the rest.

---

## Phase B — Ingestion Pipeline (~3 days)

### B1: Pass A (Classify + Tag)

| What | Tester | How |
|------|--------|-----|
| Input schema validation (rejects bad input) | Vitest | Feed malformed payloads, assert rejection with error message |
| Output schema validation (matches PassAResult type) | Vitest | Feed real-ish text through Pass A mock, validate output shape |
| Document type classification (lesson_plan, rubric, textbook, etc.) | Vitest + Matt | Vitest: assert correct type for 10 fixture documents. Matt: spot-check edge cases |
| Tag extraction (bloom, phase, grouping, category) | Vitest | Assert known documents produce expected tags (golden file comparison) |
| PII regex detection | Vitest | Feed strings with emails, phone numbers, student names — assert all caught |
| Copyright flagging | Vitest | Feed strings with "Copyright ©", "All rights reserved" — assert flagged |

**Automation notes:** Pass A is highly automatable because it has a defined output schema. Create 10-15 fixture documents (real lesson plan snippets, rubric excerpts, textbook paragraphs) and golden-file their expected Pass A output. On each test run, compare actual vs golden. If the AI model changes output, the golden file diff shows exactly what changed — Matt reviews and approves/rejects the new golden file.

### B2: Pass B (Analyse + Enrich)

| What | Tester | How |
|------|--------|-----|
| Output schema validation (matches PassBResult type) | Vitest | Schema shape test |
| Bloom level extraction accuracy | Matt + golden files | Matt judges first 10, those become golden files for regression |
| UDL checkpoint tagging | Matt + golden files | Same pattern |
| Activity block extraction from lesson plans | Matt | "Did it find the right activities?" — requires pedagogical judgment |
| Embedding generation (vector exists, correct dimensions) | Vitest | Assert embedding is Float32Array of length 1024 |

**Automation notes:** Pass B has an irreducible human-judgment component (is the Bloom level RIGHT?). Strategy: Matt judges a batch of 10-15 documents once, those become golden fixtures. Future runs compare against golden files — any drift gets flagged for Matt to re-judge. This is the **snapshot testing** pattern.

### B3: Block Extraction + Storage

| What | Tester | How |
|------|--------|-----|
| Extracted blocks have all required fields | Vitest | Assert every block from fixture document has non-null required fields |
| Blocks are stored in activity_blocks table | Vitest | Extract → query DB → assert blocks exist with correct source_id |
| Duplicate detection (same content doesn't create duplicate blocks) | Vitest | Extract same document twice, assert block count unchanged |
| Block-to-source linkage (can trace block back to upload) | Vitest | Query block, follow source_id, assert source document exists |

### B4: Review Queue

| What | Tester | How |
|------|--------|-----|
| Flagged items appear in queue | Vitest | Create block with PII flag, assert appears in review queue API |
| Approve/reject actions work | Vitest | POST approve, assert block status changes |
| Queue UI renders | Matt | Visual — does the list look right, can I click approve/reject? |

---

## Phase C — Generation Pipeline (~5 days)

### C1: Stage 1 — Block Retrieval

| What | Tester | How |
|------|--------|-----|
| Retrieval returns blocks (not empty) | Vitest | Seed 20+ blocks, request retrieval, assert non-empty result |
| Composite ranking formula produces correct order | Vitest | Seed blocks with known relevance/efficacy/context/affinity scores, assert ranking matches manual calculation |
| Overuse penalty demotes already-used blocks | Vitest | Mark block as used in current unit, assert it ranks lower |
| Diversity injection includes unfamiliar blocks | Vitest | Assert "Something different?" section contains blocks teacher hasn't used |
| FormatProfile.blockRelevance boosts/suppresses correctly | Vitest | Same blocks, different format — assert ranking changes per boost/suppress rules |

**Automation notes:** 100% automatable. Retrieval is a scoring function over known data. Seed a test library of 30 blocks with varied metadata, write 15-20 tests covering all ranking factors.

### C2: Stage 2 — Sequence Assembly

| What | Tester | How |
|------|--------|-----|
| Output matches AssembledSequence type | Vitest | Type validation |
| Sequence Pattern applied correctly | Vitest | Request "Workshop Classic" pattern, assert lessons follow Opening→MiniLesson→WorkTime→Debrief |
| Gap identification (marks where no block fits) | Vitest | Seed library missing "reflection" blocks, assert gap flagged at reflection position |
| FormatProfile.sequenceHints respected | Vitest | Assert design format uses its default pattern, service format uses its own |

### C3: Stage 3 — Gap Generation (AI)

| What | Tester | How |
|------|--------|-----|
| Generated activities have all required fields | Vitest | Schema validation on output |
| Generated activities are framework-neutral (no MYP/GCSE terms) | Vitest | Regex scan for forbidden terms: "Criterion A", "AO1", "MYP", "GCSE", etc. |
| FormatProfile.gapGenerationRules.forbiddenPatterns enforced | Vitest | Assert no generated text contains forbidden patterns |
| Pedagogical quality of gap-filled activities | Matt | "Does this activity make sense? Would I use it?" |
| ai_rules auto-generated from bloom×phase | Vitest | Assert every generated activity has ai_rules with correct phase (divergent/convergent/neutral) |

**Automation notes:** Schema validation + forbidden-term scanning is automated. Quality judgment is Matt. **Key automation win: forbidden-term scanner.** Write a `neutralityCheck(text: string): string[]` function that returns any framework-specific terms found. Run it on EVERY generated output in CI. This catches the most dangerous bug (framework leaking into neutral content) without human effort.

```typescript
// Forbidden terms per framework — if ANY appear in generated content, it's a bug
const FRAMEWORK_TERMS = [
  // MYP
  /\bcriterion [A-D]\b/i, /\bMYP\b/, /\bdesign cycle\b/i, /\binquiring and analy[sz]ing\b/i,
  /\bdeveloping ideas\b/i, /\bcreating the solution\b/i, /\bevaluating\b/i, // (only when used as MYP criterion name)
  // GCSE
  /\bAO[1-5]\b/, /\bGCSE\b/, /\bDesign & Technology\b/,
  // ACARA
  /\bACARA\b/, /\bAustralian Curriculum\b/,
  // etc.
];
```

### C4: Stage 4 — Connective Tissue & Polish (AI)

| What | Tester | How |
|------|--------|-----|
| Transitions exist between activities | Vitest | Assert every activity pair has a non-empty transition |
| Transitions are framework-neutral | Vitest | Run neutralityCheck() on all transition text |
| FormatProfile.connectiveTissue.transitionVocabulary used | Vitest | Assert transitions contain words from the format's vocabulary list |
| Teacher voice consistency (if voice profile exists) | Matt | "Does this sound like my writing?" |
| Scaffolding generated per activity | Vitest | Assert scaffold array exists and has entries |

### C5: Stage 5 — Timing & Structure

| What | Tester | How |
|------|--------|-----|
| Total time matches requested period length | Vitest | Assert sum of all activity durations = requested usable minutes |
| Workshop Model phases present | Vitest | Assert opening + miniLesson + workTime + debrief exist |
| Work time ≥ floor from FormatProfile | Vitest | Assert workTime duration ≥ format's timingModifiers.workTimeFloor |
| Extensions generated (2-3 per lesson) | Vitest | Assert extensions array length ≥ 2 |
| timeWeight → minutes conversion correct | Vitest | Assert quick < moderate < extended durations |

**Automation notes:** Timing is 100% automatable — it's arithmetic. Reuse the existing 47 Lesson Pulse tests as a foundation. Add ~20 more for the new timeWeight system.

### C6: Stage 6 — Quality Scoring (Lesson Pulse)

| What | Tester | How |
|------|--------|-----|
| Pulse scores computed for every lesson | Vitest | Assert score object exists with CR, SA, TC, overall |
| Scores in valid range (0-10) | Vitest | Assert 0 ≤ score ≤ 10 for all dimensions |
| Surgical repair triggers when overall < 5.0 | Vitest | Feed a weak lesson, assert repair was attempted |
| Repair doesn't worsen other dimensions | Vitest | Assert post-repair scores ≥ pre-repair scores (within tolerance) |
| Cross-lesson balancing injects context | Vitest | Generate 3 lessons sequentially, assert lesson 3's prompt includes running average from lessons 1-2 |

**Automation notes:** Already have 47 tests. Extend to ~70 with the new generation-integrated paths.

---

## Phase D — Feedback Loop (~3 days)

### D1: Teacher Edit Tracking

| What | Tester | How |
|------|--------|-----|
| Edit diffs detected (added/removed/modified activities) | Vitest | Save unit → edit 3 activities → save → assert diff has 3 entries |
| Diff categorization (content change vs reorder vs delete vs add) | Vitest | Perform each edit type, assert correct category |
| Edit signals stored in DB | Vitest | Assert edit_log rows created |

### D2: Efficacy Computation

| What | Tester | How |
|------|--------|-----|
| EMA formula (α=0.3) produces correct values | Vitest | Manual calculation: old=50, signal=80, new=50*0.7+80*0.3=59. Assert match. |
| Guardrail: max ±20% change per update | Vitest | Feed extreme signal (0 or 100), assert efficacy only moves ±20% |
| Guardrail: min 5 edits before significant movement | Vitest | Feed 3 edits, assert efficacy barely moved. Feed 10, assert meaningful change. |
| Guardrail: max ±2 bloom levels per update | Vitest | Assert bloom can't jump from 1→6 in one update |

**Automation notes:** Efficacy computation is pure math — 100% automatable. Write the guardrail tests FIRST (they define the safety boundaries), then implement.

### D3: Approval Queue

| What | Tester | How |
|------|--------|-----|
| Self-healing proposals appear when thresholds met | Vitest | Simulate enough edits to trigger proposal, assert it appears |
| Approve/reject flow | Vitest | API-level test |
| Queue UI usability | Matt | "Can I understand what this is proposing? Can I approve/reject easily?" |
| Weekly digest generation | Vitest | Trigger digest, assert email/notification content |

### D4: Audit Log

| What | Tester | How |
|------|--------|-----|
| Every efficacy change logged | Vitest | Make 5 changes, assert 5 audit entries |
| Log entries have correct metadata (who, when, what, why) | Vitest | Assert all fields populated |

---

## Phase E — Polish & Admin (~3 days)

### E1: Admin Dashboard

| What | Tester | How |
|------|--------|-----|
| Dashboard loads without crash | Vitest | Component render test |
| Pipeline health indicators display | Matt | Visual — green/amber/red indicators |
| Cost tracking shows per-teacher breakdown | Matt | Visual — are numbers reasonable? |
| Block library stats (total, by category, by efficacy range) | Matt + Vitest | Vitest: assert stats query returns correct counts. Matt: visual check. |

### E2: Library Health (Automated Maintenance)

| What | Tester | How |
|------|--------|-----|
| Stale block detection (unused 6+ months) | Vitest | Create block with old last_used date, run health check, assert flagged |
| Duplicate detection | Vitest | Create two blocks with identical content, run health check, assert flagged |
| Quality floor enforcement (efficacy < 20 flagged) | Vitest | Create low-efficacy block, assert flagged |
| Broken link detection | Vitest | Create block with dead source_id, assert flagged |

### E3: E2E Smoke Tests

| What | Tester | How |
|------|--------|-----|
| Upload document → blocks appear in library | Vitest (integration) | Full pipeline: upload fixture → wait → query blocks → assert exist |
| Generate unit from blocks → valid output | Vitest (integration) | Seed library → trigger generation → validate output schema |
| Edit generated unit → efficacy updates | Vitest (integration) | Generate → edit → save → assert efficacy changed |
| FrameworkAdapter renders correctly for all 8 frameworks | Vitest | Generate neutral unit → render with each framework → assert no neutral keys visible in output |
| Student sees framework-adapted content | Matt | Log in as student in MYP class and GCSE class, verify labels differ |
| Full cycle: upload → generate → teach → edit → feedback | Matt | The big integration test — 30 min manual walkthrough |

---

## Automation Strategy

### 1. Golden File / Snapshot Testing (HIGHEST IMPACT)

**Problem:** AI outputs vary between runs, making assertion-based tests fragile.

**Solution:** Record known-good AI outputs as golden files. Future runs compare against golden files. Any change produces a diff for human review.

**Where to apply:**
- Pass A classification results (10 fixture documents)
- Pass B analysis results (10 fixture documents)
- Stage 3 gap generation (5 fixture gaps)
- Stage 4 connective tissue (3 fixture sequences)

**Implementation:**
```
tests/golden/
  pass-a/
    lesson-plan-01.input.json    # fixture input
    lesson-plan-01.golden.json   # approved output
  pass-b/
    rubric-01.input.json
    rubric-01.golden.json
  generation/
    design-unit-01.input.json
    design-unit-01.golden.json
```

**Workflow:**
1. First run: AI generates output → saved as `.golden.json` → Matt reviews and approves
2. Subsequent runs: AI generates output → compared against golden → any diff flagged
3. If model changes: re-run, review diffs, update golden files
4. Golden files are committed to git — they ARE the test expectations

**Estimated setup:** ~2 hours. **Ongoing maintenance:** ~10 min per model change.

### 2. Contract Validation Tests (Run on Every Commit)

**Problem:** Pipeline stages have typed contracts, but TypeScript only checks at compile time. Runtime data from AI might not match.

**Solution:** Runtime schema validators (Zod) that run as tests AND as pipeline guards.

**Where to apply:** Every inter-stage boundary (6 stages = 5 boundaries + input + output = 7 validation points).

**Implementation:**
```typescript
// shared/schemas.ts — Zod schemas matching TypeScript interfaces
const BlockRetrievalResultSchema = z.object({
  retrievedBlocks: z.array(ActivityBlockSchema),
  gapPositions: z.array(z.number()),
  retrievalMetrics: z.object({ ... }),
});

// In tests:
it('Stage 1 output matches contract', () => {
  const result = mockStage1(fixtureInput);
  expect(() => BlockRetrievalResultSchema.parse(result)).not.toThrow();
});

// In production pipeline:
const validated = BlockRetrievalResultSchema.parse(stage1Output);
// Throws at runtime if AI produced bad data → pipeline stops with clear error
```

**Estimated setup:** ~3 hours (write Zod schemas alongside TypeScript interfaces). **Ongoing maintenance:** zero (schemas evolve with interfaces).

### 3. Neutrality Scanner (Catches Framework Leaks)

**Problem:** The most dangerous bug is framework-specific vocabulary leaking into neutral content. A student in a GCSE class seeing "MYP Criterion B" is a showstopper.

**Solution:** Automated regex scanner runs on every generated text field.

**Where to apply:** Stage 3 (gap generation), Stage 4 (connective tissue), block storage, unit export.

**Implementation:**
```typescript
// lib/testing/neutrality-check.ts
export function checkNeutrality(text: string): string[] {
  const violations: string[] = [];
  for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) violations.push(`${framework}: "${match[0]}"`);
    }
  }
  return violations;
}

// In tests AND production:
const violations = checkNeutrality(generatedText);
if (violations.length > 0) {
  throw new Error(`Framework leak: ${violations.join(', ')}`);
}
```

**Estimated setup:** ~1 hour. **Ongoing maintenance:** add patterns when new frameworks are supported.

### 4. Quality Floor Checks (Automated Minimum Standards)

**Problem:** AI-generated units might be structurally valid but pedagogically empty.

**Solution:** Automated minimum-quality assertions that catch obvious failures.

**Checks:**
- Every lesson has ≥ 3 activities (not just 1 giant block)
- Every lesson has ≥ 1 student-active activity (not all teacher-directed)
- Work Time contains ≥ 50% of total activities
- Bloom level variety: not all "remember" (at least 2 different levels per lesson)
- Scaffolding exists on activities with bloom ≥ 4
- No activity exceeds 30 minutes (likely a missed split)
- Every activity has a non-empty description (≥ 20 words)
- ai_rules.phase matches bloom level (divergent for create/evaluate, convergent for analyse)

**Where to apply:** Stage 6 (quality scoring) as mandatory checks before output.

**Estimated setup:** ~2 hours. **Ongoing maintenance:** add checks as Matt discovers new failure modes.

### 5. Regression Suite (Prevents Backslides)

**Problem:** Fixing one thing breaks another. Common in complex AI pipelines.

**Solution:** Curated set of "important units" that must always generate correctly.

**Implementation:**
- Matt generates 5 representative units (1 per format: Design, Service, PP, Inquiry + 1 edge case)
- Save the generation request as fixture
- Save approved output as golden file
- On every commit: regenerate from fixture, compare against golden, flag diffs

**This is different from golden file testing (#1)** — those test individual stages; this tests the full pipeline end-to-end.

**Estimated setup:** ~1 hour (after pipeline works). **Ongoing maintenance:** ~15 min per significant pipeline change.

---

## Testing Effort Summary

| Phase | Total Test Cases | Vitest Automated | Matt Manual | Sandbox Visual |
|-------|-----------------|-----------------|-------------|---------------|
| A — Foundation | ~35 | 30 (86%) | 2 (6%) | 3 (8%) |
| B — Ingestion | ~25 | 18 (72%) | 5 (20%) | 2 (8%) |
| C — Generation | ~40 | 32 (80%) | 6 (15%) | 2 (5%) |
| D — Feedback | ~20 | 17 (85%) | 3 (15%) | 0 |
| E — Polish | ~15 | 8 (53%) | 7 (47%) | 0 |
| **Total** | **~135** | **105 (78%)** | **23 (17%)** | **7 (5%)** |

### Matt's Manual Testing Budget

With 78% automation, Matt's manual testing is ~23 checks spread across the build:

**Phase A (2 checks):** Block search relevance, sandbox visual
**Phase B (5 checks):** Bloom accuracy on 3 documents, activity extraction quality on 2 documents
**Phase C (6 checks):** Gap-fill quality (3 units), teacher voice consistency (2 units), one full unit review
**Phase D (3 checks):** Approval queue UX, weekly digest review, one edit→feedback cycle
**Phase E (7 checks):** Admin dashboard visual, cost tracking, library stats, student framework view, full E2E walkthrough

**Total Matt time estimate:** ~3-4 hours across the entire 17-day build (not per day).

After the first pass, Matt's approved outputs become golden files — subsequent runs are automated regression checks. Matt only re-reviews when golden file diffs appear.

---

## CI Pipeline Recommendation

```
On every commit:
  1. TypeScript compile (tsc --noEmit)           ~30s
  2. Contract validation tests (Zod schemas)      ~5s
  3. FrameworkAdapter matrix (64 assertions)       ~2s
  4. Neutrality scanner on fixtures               ~3s
  5. Quality floor checks on fixtures             ~5s
  6. Existing 255 Vitest tests                    ~15s
  7. Pipeline Simulator (mock 6 stages)           ~5s
  Total: ~65 seconds

On PR merge (slower, AI-calling tests):
  8. Golden file comparison (AI calls)            ~2 min
  9. Regression suite (5 full generations)        ~5 min
  Total: ~8 minutes

Weekly (scheduled task):
  10. Library health check                        ~1 min
  11. Stale data scan                             ~30s
  12. Cost report generation                      ~10s
```

---

## Quick Wins — Things to Build First

1. **Neutrality scanner** (~1 hour) — catches the most dangerous bug class with zero human effort
2. **Contract Zod schemas** (~3 hours) — prevents 80% of integration bugs, runs in milliseconds
3. **FrameworkAdapter tests** (~1 hour) — 64 assertions, pure function, zero AI calls
4. **Pipeline Simulator** (~4 hours, already in Phase A plan) — validates the entire architecture before any AI code
5. **Golden file infrastructure** (~2 hours) — one-time setup that pays dividends for the entire build

These 5 items (~11 hours) automate the foundation. Everything after that is incremental — add tests as each phase is built.
