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

**Addendum — Phase 2 pre-flight verification (11 Apr 2026):** Pre-flight read each of the 4 stage sites directly and confirmed they are **text-response sites with `JSON.parse()`**, NOT `tool_use` sites. The original FU-5 "Loud-but-not-throwing" classification was correct. (An earlier Phase 1 audit during conversation compaction misclassified these as `tool_use` sites — that misclassification was reverted at pre-flight.)

| File | Line | max_tokens | Pattern | Failure mode |
|------|------|-----------|---------|--------------|
| `src/lib/pipeline/stages/stage2-assembly.ts` | 188 | 4096 | text + JSON.parse | Loud — `JSON.parse` throws "Unexpected end of JSON input" mid-output |
| `src/lib/pipeline/stages/stage3-generation.ts` | 199 | 2048 | text + JSON.parse | Loud — same |
| `src/lib/pipeline/stages/stage4-polish.ts` | 136 | 4096 | text + JSON.parse | Loud — same |
| `src/lib/pipeline/stages/stage4-polish.ts` | 281 | 2048 | text + JSON.parse (chunked variant) | Loud — same |

These are **NOT Lesson #39 silent-field-drop sites** — they crash loudly when max_tokens hits, they don't silently corrupt output. They still need the standard `stop_reason === "max_tokens"` guard pattern (so the error message is informative instead of cryptic), and the max_tokens values are tight (2048 in particular), so Phase 2 — which adds prompt complexity by wiring `gapGenerationRules` and `connectiveTissue` into stages 3 and 4 — could push them over. **Folded into Phase 2 as sub-task 5.2.5** (5 commits: 4 per-site fixes + 1 meta-test). The fix pattern is the same as Pass A/B but the lesson label is different.

Also added at pre-flight (12th hardcoded model ID site missed in Phase 1.7):
- `src/lib/ingestion/pass-b.ts:23` — `const DEFAULT_MODEL = "claude-sonnet-4-20250514"` constant survived the Phase 1.7 cleanup. This IS a `tool_use` site (uses `ENRICHMENT_TOOL` schema). Folded into Phase 2 sub-task 5.13 as a 12th update site (spec §4.7 list was stale by one entry).

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

## FU-6 — WIRING.yaml dangling refs + orphan in committed main
**Surfaced:** Phase 1.7 saveme verification (11 Apr 2026)
**Target phase:** Any future WIRING touch
**Priority:** P3 (dashboard hygiene, no functional impact)

**Symptom:** `python3 scripts/check-wiring-health.py` against a clean tree
reports:
- 2 dangling refs:
  - `generation-pipeline → feedback-system`
  - `admin-dashboard → feedback-system`
- 1 orphan: `Automation (CI/CD & Monitoring)`

**What we know:**
- Diagnosed via `git stash && python3 scripts/check-wiring-health.py` —
  with the working tree stashed, the count drops from 7 dangling + 1
  orphan to 2 dangling + 1 orphan, proving these 2+1 are baked into
  committed main, not caused by current saveme work.
- The other 5 dangling refs in the dirty-tree run came from
  working-tree-dirty docs (other in-progress sessions).
- Pre-existing drift, not a Phase 1.7 regression.

**Investigation steps:**
1. Decide whether `feedback-system` should exist as a top-level system in
   WIRING.yaml (currently referenced but not defined). Either add the
   entry or remove the references from `generation-pipeline` and
   `admin-dashboard`.
2. Decide whether `Automation (CI/CD & Monitoring)` should have at least
   one inbound dependency, or whether it's intentionally an orphan (in
   which case suppress the warning).

**Definition of done:** `python3 scripts/check-wiring-health.py` returns
zero dangling refs + zero unintentional orphans against a clean working
tree.

---


## FU-A — `pipeline.ts:590-592` simulator stage6 duplicate
**Surfaced:** Sub-task 5.8 pre-flight (12 Apr 2026)
**Target phase:** Phase 2 tidy pass or Phase 3
**Priority:** P2 (sandbox code duplication, no functional impact)

**Symptom:** `src/lib/pipeline/pipeline.ts:590-592` contains a stage 6 scoring call in the simulator branch that duplicates the stage6 call earlier in the same function. Both run against the same TimedUnit in sandbox mode.

**What we know:** Identified during 5.8 (stage 6 pulseWeights wiring) pre-flight audit. Code flagged it but did not touch (outside 5.8 scope). Wiring test in 5.8 isolates against this by asserting on the second call's return value directly.

**Investigation steps:**
1. Confirm the duplicate is truly dead (or truly redundant) — one of the two calls may be a remnant from an older simulator path.
2. Delete whichever call is redundant. Re-run stage6 tests + simulator smoke.

**Definition of done:** One stage6 call per simulator run. Sandbox smoke test still green.

---

## FU-B — pulseWeights 0.05 drift across FormatProfiles
**Surfaced:** Sub-task 5.8 pre-flight (12 Apr 2026)
**Target phase:** Phase 2 tidy pass (batch with FU-A)
**Priority:** P2 (spec drift, no functional blocker)

**Symptom:** All 4 FormatProfiles (design, service, personal-project, inquiry) have `pulseWeights` values that drift by 0.05 from the values specified in the spec §3.x per-format tables.

**What we know:**
- Drift is consistent across all 4 profiles (same 0.05 delta), suggesting a single-source origin — likely a spec edit or a typo during profile authoring that propagated.
- Stage 6 wiring test in 5.8 passes because it uses synthetic orthogonal profiles ({1,0,0}/{0,1,0}/{0,0,1}) rather than real profile values, so the drift is invisible to tests.
- Real pipeline runs use the drifted values.

**Investigation steps:**
1. Diff all 4 profile `pulseWeights` against spec §3.x tables. Identify which direction the drift is (profile → spec or spec → profile).
2. Decide which is canonical. If spec is canonical, update `unit-types.ts`. If profiles are canonical, update spec + changelog.
3. Re-run stage6 tests + pipeline smoke.

**Definition of done:** Zero drift between `unit-types.ts` FormatProfile.pulseWeights and `docs/projects/dimensions3-completion-spec.md` §3.x. Decision logged in decisions-log.md.

---

## FU-C — NESA §3.7 `analysing` spec bug
**Surfaced:** Sub-task 5.9 design phase (12 Apr 2026)
**Target phase:** Spec amendment pass (batch with FU-D)
**Priority:** P2 (adapter honours prose intent via workaround)

**Symptom:** `docs/specs/neutral-criterion-taxonomy.md §3.7` mentions `analysing` in the NESA DT prose but omits it from the Neutral Keys column of the forward table. Strict spec-literal reading would make it a gap cell.

**What we know:**
- §3.7 prose intent is clear — NESA's `Ev` (Evaluating) criterion absorbs analysing in NEA-style project work.
- FrameworkAdapter honours the prose intent per Matt sign-off (12 Apr 2026): NESA × analysing returns `{ kind: "label", short: "Ev", full: "Ev", name: "Evaluating" }`.
- `src/lib/frameworks/mappings/nesa.ts` has a comment `// FU-C: §3.7 prose intent, omitted from Neutral Keys column — filed as spec bug FU-C` and `Ev.neutralKeys` was extended to `["evaluating", "reflecting", "analysing"]` to round-trip correctly.

**Investigation steps:**
1. Amend spec §3.7 — add `analysing` to the Neutral Keys column for the Ev row.
2. Add changelog entry to spec noting the intent was always present but the column was missing.
3. Remove the FU-C comment from `nesa.ts` once spec is updated.

**Definition of done:** Spec §3.7 Neutral Keys column lists `analysing` under Ev. `nesa.ts` comment removed. Adapter behaviour unchanged (test 139 stays green).

---

## FU-D — IGCSE §3.4 missing reverse table
**Surfaced:** Sub-task 5.9 design phase (12 Apr 2026)
**Target phase:** Spec amendment pass (batch with FU-C)
**Priority:** P2 (adapter applies heuristic, needs spec canonical resolution)

**Symptom:** `docs/specs/neutral-criterion-taxonomy.md §3.4` (IGCSE DT) has a forward table but no explicit reverse table declaring primacy. Multiple neutral keys (analysing, designing, researching) appear in more than one AO without primary indication.

**What we know:**
- The forward table lists analysing under both AO1 (pure recall) and AO2 (broad problem-solving) without primacy markers.
- Similar ambiguity for designing (AO2 + AO3) and researching (AO2).
- FrameworkAdapter applies the "exclusive-key wins" heuristic (same rule used for Victorian × TC): AO1 is analysing-exclusive so it wins primary. `src/lib/frameworks/mappings/igcse.ts` has a 5-line comment documenting the heuristic and filing this followup.
- Pedagogically, AO2 is the stronger anchor for NEA-context analysing, but honouring spec-literal + precedent.

**Investigation steps:**
1. Add an explicit reverse table to §3.4 declaring primacy for the 3 shared keys.
2. Subject-expert review recommended — the "exclusive-key wins" heuristic may not match how IGCSE DT is actually assessed.
3. If reverse table disagrees with adapter, update `igcse.ts` + re-run adapter tests. Expected delta: Group 1 + Group 2 tests for IGCSE×analysing may need fixture updates.

**Definition of done:** Spec §3.4 has explicit reverse table. Adapter matches spec (either confirming current heuristic or flipping to AO2). IGCSE comment in `igcse.ts` updated or removed.

---

## FU-J — Framework-aware criterion scale on student grades page

**Surfaced:** Sub-step 5.10.4 (12 Apr 2026)
**Target phase:** 5.10.6 (cleanup sub-step) or MYPflex Phase 2
**Priority:** P2

**Symptom:** The student grades page at `src/app/(student)/unit/[unitId]/grades/page.tsx` hardcodes `/8` as the score denominator (`{score.level}/8`). MYP uses 0–8, GCSE uses a framework-dependent AO max, PLTW uses 0–4. After 5.10.4 the page iterates framework criteria correctly via `getCriterionLabels(framework)` but the displayed denominator is still MYP-specific.

**What we know:**
- `getCriterionLabels()` does not currently expose a max-level field on `CriterionDef`. MYPflex Phase 1 added `GradingScale.type` including `"percentage"` but grades render path wasn't wired through.
- The teacher grading page already reads a per-framework scale via the MYPflex Phase 1 helpers — grades page should mirror.
- Fix likely threads a `maxLevel` (number) or `scaleLabel` (string like "/8", "/4", "%") from the adapter through to the render site.

**Investigation steps:**
1. Decide whether scale metadata lives on `CriterionDef` or on a separate `getScale(framework)` call.
2. Thread through grades page render. Remove `TODO FU-J` comment + `/8` hardcode.
3. Verify against all 8 frameworks + percentage mode.

**Definition of done:** Grades page shows correct denominator per framework. No `/8` hardcode. Test covers at least MYP (/8), GCSE (AO-max), PLTW (/4).

---

## FU-K — student-snapshot route still casts criterion_scores as Record<string, number>

**Surfaced:** Sub-step 5.10.4 pre-flight audit (12 Apr 2026)
**Target phase:** 5.10.6 (cleanup sub-step)
**Priority:** P1 (latent dual-shape bug, same class as H.1)

**Symptom:** `src/app/api/teacher/student-snapshot/route.ts:121` reads `assessment.criterion_scores` as `Record<string, number>`. The server canonical shape is `CriterionScore[]` (see Lesson #42). This is the same bug class H.1 fixed on the grades page — bracket access on an array returns undefined silently, so any feature consuming the snapshot's criterion data is getting empty/garbage results.

**What we know:**
- Server write site (`src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx:342`) writes `CriterionScore[]`.
- 5.10.4 built `src/lib/criterion-scores/normalize.ts` as the canonical 4-shape absorber. The student-snapshot route should adopt it.
- The route's downstream consumers need checking — what happens when the shape flips from Record to array?

**Investigation steps:**
1. Replace the cast with `normalizeCriterionScores(assessment.criterion_scores)`.
2. Grep consumers of the snapshot payload. Update any that assume `Record<string, number>` shape.
3. Add a test with a real fixture (array shape) asserting snapshot output.

**Definition of done:** Route uses the canonical normalizer. Consumers verified. Lesson #42 cross-referenced.

---

## FU-L — Collapse local grades-page types into canonical @/types/assessment imports

**Surfaced:** Sub-step 5.10.4 (12 Apr 2026)
**Target phase:** 5.10.6 (cleanup sub-step)
**Priority:** P3

**Symptom:** 5.10.4 deleted the local `CriterionScore` interface from the grades page (it shadowed the canonical type from `@/types/assessment`) but left `AssessmentData` as a local interface. `AssessmentData` is a subset of `AssessmentRecord` from `@/types/assessment` — it should either be derived (`Pick<AssessmentRecord, ...>`) or replaced with the canonical type.

**What we know:**
- Local `AssessmentData` has 7 optional fields (criterion_scores, overall_grade, teacher_comments, strengths, areas_for_improvement, targets, is_draft).
- `AssessmentRecord` (line 64+ in `src/types/assessment.ts`) is the canonical shape written by the teacher grading route.
- This is the same pattern that caused Lesson #42 — local interfaces for DB row shapes hide dual-shape bugs.

**Investigation steps:**
1. Replace `AssessmentData` with `Pick<AssessmentRecord, ...>` or direct canonical import.
2. Check all other `(student)` routes for similar local shadow types.

**Definition of done:** Grades page imports only canonical types for any field that round-trips through Supabase. Lesson #42 rule enforced as a pattern, not a one-off fix.

---
