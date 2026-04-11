# Dimensions3 — Follow-up Tickets

> Items surfaced during Phase 1.x checkpoints that are NOT blockers for the
> phase they were found in, but should be picked up before Dimensions3 is
> declared complete. Each entry: short title, when surfaced, symptom,
> suspected cause, suggested investigation, target phase.

---

## FU-1 — `/teacher/units` initial render delay
**Surfaced:** Phase 1.5 checkpoint sign-off (10 Apr 2026)
**Target phase:** Phase 1.7+

**Symptom:** Initial page paint shows empty unit cards ("empty squares")
for a visibly long delay before unit data hydrates in. Eventually renders
correctly.

**What we know:**
- Network tab: `units?select=*` returns 200 with ~133 kB in ~32 ms — the
  fetch itself is fast.
- The delay is between response receipt and DOM render.
- May be a pre-existing issue OR a Phase 1.5 hydration regression. Has
  not been profiled yet.

**Investigation steps:**
1. Profile the page with the React Profiler in Chrome DevTools — capture
   the time between fetch resolution and the unit card paint.
2. Compare against the pre-Phase-1.5 baseline:
   `git checkout 9e2d045~1 -- src/app/teacher/units` (the commit before
   the Phase 1.5 series began).
3. Look for: heavy synchronous work in a render path, a large client
   bundle being parsed, or a useEffect chain that gates the visible
   state on multiple sequential awaits.

**Definition of done:** Either (a) confirmed pre-existing and ticketed
separately for a perf pass, or (b) regression bisected to a specific
Phase 1.5 commit and reverted/fixed.

---

## FU-2 — "Unknown" strand/level chips on pre-Phase-1.5 units
**Surfaced:** Phase 1.5 checkpoint sign-off (10 Apr 2026)
**Target phase:** Phase 1.7+

**Symptom:** Units created before Phase 1.5 show `"Unknown" "Unknown"`
chips where the strand and level should be displayed.

**Cause:** Phase 1.5 item 3 (commit `0d686e4`) added strand and level
fields via Pass A enrichment, but the backfill only touched
`activity_blocks`, not `units`. The unit card render code displays
`"Unknown"` as a fallback when the field is missing.

**Two ways to fix — pick one:**

**Option A — Hide the chips when the value is missing.**
- Cheaper, no migration.
- Edit the unit card render code to check for truthy strand/level before
  rendering the chip element.
- Downside: pre-1.5 units stay unlabelled forever unless they're
  re-ingested.

**Option B — Backfill `units` with derived strand/level.**
- New migration that walks each unit's `content_data` and runs the same
  classification logic Pass A uses (or a SQL approximation).
- Risk: classification needs an LLM call to be accurate; a SQL backfill
  will be a heuristic at best.
- Better: a one-off `scripts/backfill-unit-strand-level.mjs` that calls
  Pass A for each unit and writes the result back.

**Recommendation:** Start with Option A in Phase 1.7 (15 minute fix),
schedule Option B as part of the Phase 1.6 disconnect of the old
knowledge UI (since we'll be touching the unit data model anyway).

---

## FU-5 — Systemic max_tokens truncation audit
**Surfaced:** Phase 1.7 Checkpoint 1.2 truth-capture (11 Apr 2026)
**Target phase:** Phase 1.8 (or earlier if any of the listed sites turn out to crash on real input)
**Entries #1 (Pass B) and the Pass A site that spawned this audit BOTH landed in Phase 1.7** — see Lesson #39 "fix all similar sites in same phase" rule. The remaining 8 sites below are outside the ingestion-pipeline critical path and remain as FU-5 backlog.

**Symptom:** Live Pass A in `src/lib/ingestion/pass-a.ts` was called with
`max_tokens: 2000` against a 50-section, 23,823-char teacher unit DOCX
(`mburton packaging redesign unit.docx`). Output hit the 2000-token cap
exactly, the tool_use response came back with `documentType` /
`confidence` / `topic` / `detectedSubject` / `detectedStrand` /
`detectedLevel` populated but `sections` undefined. Pass B then crashed
at `pass-b.ts:102` with `TypeError: Cannot read properties of undefined
(reading 'map')`. Phase 1.7 fixed Pass A (max_tokens 2000 → 8000,
stop_reason guard, defensive `?? []`). The very next live run crashed
at `extract.ts:84` with `analysis.enrichedSections is not iterable` —
the identical anti-pattern in `pass-b.ts:182` (max_tokens 4000) had
tripped on the same fixture. Phase 1.7 then fixed Pass B the same way
(max_tokens 4000 → 16000, stop_reason guard, defensive `?? []`).
The systemic concern is that the same anti-pattern — destructure tool
output without inspecting `stop_reason`, no defensive fallback on
required fields — exists across the codebase.

**Audit (11 Apr 2026, after Pass A + Pass B fixes landed in 1.7):** 9
tool_use call sites currently destructure
`response.content.find(b => b.type === "tool_use")` without checking
`stop_reason`. None of them throw on `max_tokens`. (The original audit
of 10 sites listed `pass-b.ts:182` as entry #1, now fixed. `pass-a.ts`
was the originating site and was never counted in the 10; it was also
fixed in Phase 1.7.)

| # | File | Line | max_tokens | Risk |
|---|------|------|-----------|------|
| 1 | `src/lib/ingestion/moderate.ts` | 175 | 2000 | MEDIUM — batched moderation. With current 9-block batches (one DOCX) it's safe; a larger batch trips it. Has `decisions ?? []` fallback so the failure mode is "approve nothing" not crash, but that's its own bug. |
| 2 | `src/lib/ai/anthropic.ts` | 40 (`generateCriterionPages`) | 16000 | MEDIUM — generation pipeline (currently quarantined per `dimensions2.md`). Headroom is generous but the destructure throws an unhelpful error when truncation happens mid-page. |
| 3 | `src/lib/ai/anthropic.ts` | 80 (`generateOutlines`) | 6000 | MEDIUM — same. |
| 4 | `src/lib/ai/anthropic.ts` | 116 (`streamCriterionPages` finalMessage) | 16000 | MEDIUM — streamed but `finalMessage()` extraction has same destructure pattern. |
| 5 | `src/lib/ai/anthropic.ts` | 166 (`generateLessonPages`) | dynamic (≥16000) | MEDIUM. |
| 6 | `src/lib/ai/anthropic.ts` | 208 (`streamLessonPages`) | dynamic (≥16000) | MEDIUM. |
| 7 | `src/lib/ai/anthropic.ts` | 255 (`generateTimelineActivities`) | dynamic (≥16000) | MEDIUM. |
| 8 | `src/lib/ai/anthropic.ts` | 293 (`streamTimelineActivities`) | dynamic (≥16000) | MEDIUM. |
| 9 | `src/app/api/admin/ai-model/test-lesson/route.ts` | 151 | 16000 | LOW — admin-only test surface, hand-driven. |

**Fixed in Phase 1.7 (removed from table above):**
- ~~`src/lib/ingestion/pass-a.ts:202`~~ — max_tokens 2000 → 8000 + stop_reason guard + `sections ?? []`
- ~~`src/lib/ingestion/pass-b.ts:182`~~ — max_tokens 4000 → 16000 + stop_reason guard + `enrichedSections ?? []`

**Already-guarded sites (not in scope):**
- `src/lib/ai/anthropic.ts:340` (`generateSkeleton`) — only fully-guarded
  site. Has `stop_reason === "max_tokens"` check at :356-368 with
  auto-retry to 16384 max_tokens.

**Loud-but-not-throwing sites (text-response, separate failure mode):**
These hit a different bug — text response truncates mid-JSON and the
downstream `JSON.parse()` throws loudly. Less subtle than the tool_use
silent-field-drop, but worth tightening:
- `src/lib/knowledge/analyse.ts:104-108` — logs warning, continues
- `src/app/api/teacher/timetable/parse-upload/route.ts:117,154`
- `src/app/api/teacher/convert-lesson/route.ts:444-448`
- `src/lib/pipeline/stages/stage{2,3,4}*.ts` — quarantined generation
  pipeline, 4 call sites
- `src/app/api/teacher/wizard-suggest/route.ts`,
  `wizard-autoconfig/route.ts`,
  `lesson-editor/ai-field/route.ts`,
  `lesson-editor/suggest/route.ts`
- `src/lib/ai/quality-evaluator.ts:137`
- `src/app/api/student/quest/mentor/route.ts:170`

**Quarantined / dead (excluded from audit):**
- `src/app/api/admin/ai-model/test/route.ts:118` — early `return
  QUARANTINE_RESPONSE` at :37, never reaches the call.

**Threshold note:** The Phase 1.7 brief said "stop and report if the audit
finds > 10 sites missing stop_reason guards." The original audit hit
exactly 10, at the threshold not over it, so Phase 1.7 proceeded. After
fixing entry #1 (Pass B) alongside the originating Pass A site, 9
tool_use sites remain. If you want the threshold redrawn to include
the text-response sites (additional ~10 entries), FU-5 expands to a
~19-site backlog and probably wants its own phase rather than a
follow-up.

**Standard fix pattern (per Lesson #39):**
```ts
const response = await client.messages.create({ ... });
if (response.stop_reason === "max_tokens") {
  throw new Error(
    `[<site>] Anthropic call hit max_tokens=${maxTokens} (output_tokens=${response.usage?.output_tokens}). ` +
    `Tool: ${toolName}. Increase max_tokens or shrink schema/input.`
  );
}
const toolBlock = response.content.find((b) => b.type === "tool_use");
if (!toolBlock || toolBlock.type !== "tool_use") {
  throw new Error("[<site>] AI did not return structured output via tool use");
}
const result = toolBlock.input as { foo: Foo[]; bar?: Bar };
return { foo: result.foo ?? [], bar: result.bar };  // defensive on every required field
```

**Definition of done:** All 9 remaining tool_use sites either (a) carry an
explicit `stop_reason === 'max_tokens'` throw guard with a site-specific
message + the relevant max_tokens value + the truncating field, or
(b) are deleted as part of the Dimensions2 generation rebuild. Each fix
gets its own commit. Each commit is green before the next starts.

---
