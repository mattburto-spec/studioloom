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

## FU-5 — AI call sites stop_reason handling audit (P2, expanded scope)

**Original scope (closed):** 13 generation sites. 2 fixed in Phase 1.7 (Pass A, Pass B). 11 remaining per original audit.

**Revised scope (2026-04-14, post-7-Pre.3):** The ai-call-sites.yaml scan found **47 total call sites** — the original FU-5 audit missed toolkit and embedding sites.

**Current state:**
- `stop_reason_handled: true` — 2 (Pass A, Pass B)
- `stop_reason_handled: false` — 6 (originally audited, not yet fixed)
- `stop_reason_handled: unknown` — 39 (never audited; toolkit + embedding + misc)

**Machine-readable:** Work against `docs/ai-call-sites.yaml` directly. Filter by `stop_reason_handled: false` or `unknown` to see the live list.

**Decision:** Resolve in two passes — (1) fix the 6 known `false` sites, (2) audit the 39 unknown sites and mark them true/false. Both tracked against ai-call-sites.yaml.

**Original audit detail preserved below for reference.**

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

## FU-E — Migrate teacher grading pages from getFrameworkCriterion to FrameworkAdapter

**Surfaced:** Sub-step 5.10.5 (12 Apr 2026)
**Target phase:** Dedicated migration sub-step (post-Phase 2)
**Priority:** P2 (blocked until teacher grading pages get a framework-awareness pass)

**Symptom:** Two teacher grading call sites still use `getFrameworkCriterion` from `@/lib/constants` (the legacy MYPflex Phase 1 helper) rather than the 5.9 FrameworkAdapter:

1. `src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx` line 1016 — 2-arg form: `getFrameworkCriterion(criterionKey, framework)`
2. `src/app/teacher/units/[unitId]/class/[classId]/page.tsx` line 1191 — 3-arg form: `getFrameworkCriterion(criterionKey, classFramework, (unit as any)?.unit_type || "design")`

Both are regression-locked by 5.10.5 wiring tests (G1-G4 in `render-path-fixtures.test.ts`). Migration is safe to do in a future sub-step — the locks will break intentionally when the legacy import is removed, signalling the switchover.

**Investigation steps:**
1. Replace `getFrameworkCriterion` calls with `getCriterionLabels(framework).find(d => d.short === key)` or equivalent adapter pattern.
2. Handle the 3-arg form on Site 2 (unit_type parameter) — FrameworkAdapter doesn't take unit_type. May need a FormatProfile lookup.
3. Update G1-G4 wiring locks to assert FrameworkAdapter imports instead.
4. Verify teacher grading UI renders correctly for all 8 frameworks.

**Definition of done:** Both teacher grading pages use FrameworkAdapter. Legacy `getFrameworkCriterion` has zero import sites (can be deleted from constants.ts — see FU-F).

---

## FU-F — Legacy CRITERIA constant and CriterionKey type in @/lib/constants

**Surfaced:** Sub-step 5.10.4 (12 Apr 2026)
**Target phase:** Cleanup sweep after all pages use FrameworkAdapter
**Priority:** P3

**Symptom:** `CRITERIA` constant and `CriterionKey` type in `@/lib/constants` are MYP-specific (A/B/C/D only). The student grades page no longer imports them (migrated to `getCriterionLabels` in 5.10.4). The student lesson page still imports `CRITERIA` + `CriterionKey` (5.10.3 only migrated the badge pipeline via `collectCriterionChips`, not the full page). Teacher grading pages import `getFrameworkCriterion` + `getFrameworkCriterionKeys` (see FU-E).

**Investigation steps:**
1. Grep all remaining imports of `CRITERIA` and `CriterionKey` from `@/lib/constants`.
2. Migrate each consumer to FrameworkAdapter equivalents.
3. Once zero consumers remain, delete `CRITERIA`, `CriterionKey`, and the legacy `getFrameworkCriterion` family from constants.ts.

**Definition of done:** `CRITERIA`, `CriterionKey`, `getFrameworkCriterion`, `getFrameworkCriterionKeys`, `getFrameworkCriteria` all removed from constants.ts. All consumers use FrameworkAdapter. Depends on FU-E.

---

## FU-G — getCriterionDisplay wrapper in render-helpers.ts vs direct adapter use

**Surfaced:** Sub-step 5.10.2 (12 Apr 2026)
**Target phase:** Post-FU-E cleanup
**Priority:** P3 (depends on FU-E)

**Symptom:** `getCriterionColor` in `src/lib/frameworks/render-helpers.ts` wraps `getCriterionDisplay` from the adapter with an arg-order swap (tag first, framework second → adapter takes framework first, key second). This wrapper exists because the render-path call sites (5.10.3 student lesson page) needed a tag-first signature.

**Investigation steps:**
1. After FU-E migrates teacher grading pages, audit all `getCriterionColor` consumers.
2. Evaluate whether the wrapper is still needed or if call sites can use `getCriterionDisplay` directly.
3. If inlining, update all call sites and delete the wrapper.

**Definition of done:** Either (a) wrapper justified with a comment explaining the arg-order value, or (b) wrapper removed and call sites use adapter directly.

---

## FU-H — Strand-level headers on teacher grading pages (MYP-specific)

**Surfaced:** Sub-step 5.10.3 (12 Apr 2026)
**Target phase:** FU-E migration or dedicated UX pass
**Priority:** P2 (UX gap for non-MYP teachers)

**Symptom:** The teacher grading page (`src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx`) renders strand-level headers using MYP-specific logic. MYP criteria have strands (e.g., Criterion A: i, ii, iii, iv); non-MYP frameworks (GCSE, PLTW, ACARA) don't use strands — they use Assessment Objectives or competency areas. When a non-MYP framework is active, strand headers either render empty or show MYP strand labels, which is confusing.

**Investigation steps:**
1. Audit the strand rendering block (around the `showStrands` state in the grading page).
2. Determine whether strand data is available per-framework in the adapter or needs a new data source.
3. Either conditionally hide strands for non-strand frameworks, or implement framework-aware strand/sub-criterion rendering.

**Definition of done:** Non-MYP frameworks either (a) hide strand section entirely, or (b) show framework-appropriate sub-criteria. No MYP strand labels shown for non-MYP classes.

---

## FU-I — Null-framework fallback behavior across all pages

**Surfaced:** Sub-step 5.10.3 (12 Apr 2026)
**Target phase:** Monitor — revisit when non-MYP becomes majority
**Priority:** P3

**Symptom:** Sub-steps 5.10.3 (student lesson page) and 5.10.4 (student grades page) both use `?? "IB_MYP"` as the null-framework fallback when `classInfo?.framework` is null or undefined. This is correct for the current user base (Matt's IB MYP classes) but creates a silent assumption: any class without an explicit framework renders as MYP.

**What we know:**
- The fallback is used in 2 places so far (student lesson page + student grades page).
- Teacher grading pages use `getFrameworkCriterion` which has its own default (`"IB_MYP"` in the function signature at constants.ts line 572).
- If non-MYP becomes the majority (e.g., Australian ACARA schools), the fallback should be configurable — either per-teacher, per-school, or per-deployment.

**Investigation steps:**
1. No immediate action needed. Monitor adoption patterns.
2. If non-MYP sign-ups occur, consider: (a) a school-level default framework setting, (b) an explicit "framework not set" UI state instead of silent MYP fallback, (c) onboarding step that requires framework selection.

**Definition of done:** Either (a) confirmed IB_MYP remains the safe default for v1, or (b) configurable default implemented if user base shifts. Inline FU-I comments in code updated either way.

---

## FU-M — Live cost alert email test (Resend integration)
**Surfaced:** Phase 4 Checkpoint 4.1 (12 Apr 2026)
**Target phase:** Pre-launch or next ops pass
**Priority:** P2

**Symptom:** Cost alert delivery (`src/lib/monitoring/cost-alert-delivery.ts`) has full Resend API integration with debounce, but has only been verified via unit tests (9 passing) and console.log fallback. Live email delivery has not been tested end-to-end.

**What we know:**
- Code sends via direct `fetch()` to `https://api.resend.com/emails` — no npm package.
- Debounce checks `system_alerts` for existing alert within 6 hours before sending.
- Console fallback works when `RESEND_API_KEY` is not set (verified in Phase 4 script runs).
- Free tier: 100 emails/day, sufficient for alerting.

**Steps to verify:**
1. Create a Resend account at resend.com, verify a sending domain.
2. Add to `.env.local`: `RESEND_API_KEY=re_xxxxx`, `COST_ALERT_EMAIL=matt@yourdomain.com`.
3. Temporarily set `COST_ALERT_DAILY_USD=0.01` (lowest threshold).
4. Run a generation that costs > $0.01, then run: `npx tsx -r dotenv/config scripts/ops/run-cost-alert.ts dotenv_config_path=.env.local`
5. Verify email arrives with correct subject/body.
6. Run cost-alert again immediately — verify debounce suppresses the second send (check console output for "debounced: true").
7. Restore `COST_ALERT_DAILY_USD` to production value ($10).

**Definition of done:** Email received. Debounce verified (second run within 6h does NOT send). Both confirmed with screenshots or logs.

---

## FU-N — NULL class_id silent safety gap (RLS filters NULL rows) ✅ RESOLVED

**Surfaced:** Phase 6 Checkpoint 5.1 Step 9 (14 Apr 2026)
**Resolved:** Phase 7A-Safety-2 (14 Apr 2026) via Option C
**Priority:** P1 (was: silent safety hole — moderation events invisible to teachers)

**Symptom:** Teacher-facing safety alert feed at `/teacher/safety/alerts` showed zero rows despite flagged rows existing. Root cause: 14 of 17 writer call sites pass `class_id = NULL`, and the RLS policy `class_id IN (...)` silently filtered NULL rows (SQL NULL IN (...) = NULL, not TRUE).

**Resolution:** Migration 078 — Lesson #29 UNION pattern. SELECT + UPDATE policies now use:
- Primary path: `class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())`
- Fallback: `OR (class_id IS NULL AND student_id IN (junction UNION legacy))`

Both student→teacher paths (class_students junction + legacy students.class_id) are in the UNION. Writer audit documented 17 sites across 14 routes in `docs/specs/moderation-log-writer-audit.md`.

**Peer table:** content_moderation_log (migration 067) confirmed unaffected — no class_id column, service-role-only policy.

---

## FU-N-followup — Migrate to Option B admin queue (P2)

**Filed:** 14 Apr 2026
**Depends on:** FU-O (roles system)
**Priority:** P2

Migrate moderation log visibility from Option C (student_id cross-join) to Option B (admin queue) when FU-O roles system lands. This removes the student_id cross-join from the hot path and adds an explicit safety_lead role for NULL-class events. UI: `/admin/safety/orphan-alerts`.

---

## FU-GG — nm-assessment "unknown" classId causes silent moderation data loss ✅ RESOLVED

**Filed:** 14 Apr 2026
**Resolved:** 14 Apr 2026
**Priority:** P1 (was: active data-loss bug — moderation events silently dropped)

**Issue:** `src/app/api/student/nm-assessment/route.ts` line 184 used `classId || "unknown"` as the fallback when class lookup failed. `"unknown"` is not a valid UUID — the FK constraint `REFERENCES classes(id)` rejected the insert, and the `.catch()` in `moderateAndLog()` swallowed the error. **The moderation event was silently lost.**

**Resolution:** Changed `classId || "unknown"` → `classId || ''`. Empty string is falsy, so `moderateAndLog`'s `context.classId || null` coerces to NULL. FU-N dual-visibility policy (migration 078) picks up the NULL-class_id row. 3 regression tests added + NC-verified. No data backfill possible — lost events were never written (FK rejection prevented insert).

**Peer audit (14 Apr 2026):** Found 1 additional broken peer — `src/lib/ingestion/pipeline.ts:123` uses `classId: config.teacherId || "system"` (same FK-rejection pattern). Not fixed in this phase — different writer category (teacher ingestion, not student moderation). Noted for future cleanup.

---

## FU-KK — ingestion/pipeline.ts writes "system" sentinel to UUID FK columns (P2)

**Filed:** 14 Apr 2026
**Priority:** P2 (silent failure but lower volume than FU-GG — only fires on teacher uploads with missing teacherId)

**Symptom:** `src/lib/ingestion/pipeline.ts` lines 122-125 build a `ModerationContext` with two sentinel fallbacks:
- `classId: config.teacherId || "system"` — `class_id` is `UUID REFERENCES classes(id)`, "system" fails FK constraint
- `studentId: config.teacherId || "system"` — `student_id` is `UUID NOT NULL`, "system" fails type/FK constraint

Same silent-data-loss pattern as FU-GG: the FK rejection error is swallowed by the `try/catch` on line 127, and the ingestion moderation event is silently lost.

**Question to answer before fixing:** Why is this row writing a classId at all if the context is ingestion (teacher-scoped, not class-scoped)? Three options:
- **(a)** Set `classId` to `''` and `studentId` to the teacher's UUID (hacky but matches the current schema — teacher content moderation routed via the same table as student moderation). FU-N policy handles NULL class_id visibility.
- **(b)** Don't log ingestion moderation events in `student_content_moderation_log` at all — they belong in `content_moderation_log` (the existing per-block table from migration 067, service-role-only). This is the architecturally correct answer but requires wiring changes.
- **(c)** Pass through a real class_id from the upload context if one exists (ingestion is always teacher-scoped, never class-scoped — so this option doesn't apply).

**Full sentinel audit (14 Apr 2026):** Grepped `|| "(system|unknown|default|none|null)"` across all `.ts` files. 30+ hits, but only `pipeline.ts:123-124` land in UUID FK columns. All others are in-memory Map keys for aggregation, display strings, error messages, or TEXT columns.

**Definition of done:** `pipeline.ts` moderation write either succeeds with valid values (NULL or real UUID for class_id, real UUID for student_id), or routes to a different table entirely. Test proving the insert doesn't silently fail.

---

## FU-HH — No live Supabase RLS test harness (P2)

**Filed:** 14 Apr 2026
**Priority:** P2 (testing infrastructure gap)

**Issue:** RLS policies are only verified by SQL-structure parsing tests + manual smoke protocols. No live Supabase JWT test harness exists — cannot programmatically test per-teacher visibility in CI.

**Impact:** RLS bugs are caught by manual testing or production incidents, not automated tests. Three RLS-related bugs have surfaced so far (Lesson #29 student_progress, FU-X 3 tables, FU-N moderation log).

**Decision:** Build a real harness (pgTAP tests or Supabase CLI-driven integration tests) when a 4th RLS bug surfaces. Avoid building speculatively — "don't build abstract platform services" principle.

---

## FU-II — log-client-block uses direct insert instead of moderateAndLog (P3)

**Filed:** 14 Apr 2026
**Priority:** P3 (pattern inconsistency)

**Issue:** `src/app/api/safety/log-client-block/route.ts` writes directly to `student_content_moderation_log` via `.from(...).insert(...)` instead of using the shared `moderateAndLog()` helper (16 other call sites use the helper). It also uses a zero-UUID fallback for `student_id` (`"00000000-0000-0000-0000-000000000000"`).

**Possibly intentional:** The client-block logger runs in a fire-and-forget path — no server-side moderation call needed (client already blocked content), so `moderateAndLog()` would add unnecessary AI call overhead. Audit whether this was a deliberate optimization or drift.

**Action:** Audit intent; if unintentional, unify to `moderateAndLog()` with a `skipModeration` option.

---

## FU-EE — No canonical migration-applied log (P2)

**Filed:** 14 Apr 2026
**Target phase:** Next ops pass
**Priority:** P2 (process gap — blocks confident pre-flight checks)

**Issue:** No canonical record of which migrations have been applied to prod Supabase. `supabase_migrations.schema_migrations` doesn't exist on this project; we've been probing for migration-created objects directly (e.g., `SELECT 1 FROM pg_class WHERE relname = 'usage_rollups'`). This makes pre-flight checks fragile — Claude can't grep a single file to know whether a migration is applied.

**What we know:**
- Phase 7A-Safety-1 pre-flight had to probe for table existence directly.
- `docs/resolved-issues-archive.md` has some migration notes but is not a systematic log.
- `docs/schema-registry.yaml` has `applied_date` per table but only tracks the *creating* migration, not additive migrations (e.g., 074 adds an index to content_items but content_items' source_migration is 063).

**Suggested investigation:**
1. Either enable Supabase's built-in migration tracking (`supabase db push` populates `supabase_migrations.schema_migrations`), or
2. Maintain a manual `docs/migrations-applied.md` log with columns: migration number, filename, applied date, who applied, notes.

**Definition of done:** A single source of truth Claude can check in one grep before assuming a migration is or isn't applied.

---

## FU-FF — Undocumented RLS-as-deny-all pattern on 3 tables (P3) ✅ RESOLVED

**Filed:** 14 Apr 2026
**Resolved:** 4 May 2026 (Phase 6.5a)

Phase 6.5 shipped `docs/security/rls-deny-all.md` documenting all 5 tables with the RLS-enabled-no-policy pattern (the original 3 plus `fabricator_sessions` and `teacher_access_requests`; `student_sessions` was dropped entirely in Phase 6.1). `scripts/registry/scan-rls-coverage.py` now reads the doc at scan time and classifies these tables as `intentional_deny_all` rather than drift. `docs/scanner-reports/rls-coverage.json` shows `rls_no_policy_count: 0, intentional_deny_all_count: 5, status: clean`.

Original issue text preserved below for history.

**Target phase:** Next governance pass
**Priority:** P3 (documentation gap, not a security bug)

**Issue:** `scan-rls-coverage.py` flagged 3 tables as `rls_enabled_no_policy` — they have RLS enabled but zero policies, making them effectively deny-all to non-service-role clients:
- `ai_model_config`
- `ai_model_config_history`
- `student_sessions`

This is likely intentional (service-role-only tables), but the pattern is undocumented. The scanner reports them as drift, creating false positives.

**Suggested investigation:**
1. Audit the 3 tables in `docs/scanner-reports/rls-coverage.json` — confirm each is service-role-only by design.
2. Document the pattern in `docs/schema-registry.yaml` with `rls: {status: service_role_only, rationale: "..."}` on each table.
3. Update `scan-rls-coverage.py` to treat documented service-role-only tables as `ok` instead of `drift` (whitelist via a `# deny-all-intentional` marker or schema-registry lookup).

**Definition of done:** Scanner output is clean OR each remaining drift item has a documented rationale in schema-registry.

---

## FU-O ✅ RESOLVED 4 May 2026 — No co-teacher / dept head / school admin access model

**Surfaced:** Phase 6 Checkpoint 5.1 Step 9 (14 Apr 2026)
**Resolved:** Access Model v2 Phase 1 → Phase 6 (Checkpoint A7 PILOT-READY, 4 May 2026)
**Resolution:** `class_members` table shipped Phase 1 with role enum `lead_teacher | co_teacher | dept_head | mentor | lab_tech | observer`. `can(actor, action, resource)` permission helper shipped Phase 3 with `has_class_role(class_id, role?)` + `has_student_mentorship(student_id, programme?)` + `has_school_responsibility(school_id, type?)` 3-way scope lookup. RLS policies migrated off `teacher_id = auth.uid()` → membership-join pattern; `verifyTeacherCanManageStudent` re-grounded as the base class-level permission with class roles adding on top. Platform-admin path is `auth.users.is_platform_admin` flag gating `/admin/school/[id]`. School-admin role intentionally NOT introduced — flat school membership + two-tier governance (low-stakes instant + high-stakes 48h two-teacher confirm) covers the use case (§8 governance decision). See [`access-model-v2-phase-6-checkpoint-a7.md`](access-model-v2-phase-6-checkpoint-a7.md). Original symptom + design sketch retained below for archive.

---

**Symptom:** Every RLS policy in the codebase hardcodes `teacher_id = auth.uid()` as the ownership predicate. Concrete blockers this creates:
- Co-taught classes (two teachers sharing a class) — one teacher is invisible to their own class data.
- Department heads needing to see all DT classes across their department — no path.
- Substitute teachers covering a class for a week — must masquerade as the owner.
- School admin/principal viewing safety alerts across the school — no path.
- Teacher leaves school; replacement teacher can't be granted access without a DB surgery.

**What we know:**
- Pattern is repeated in ~40+ RLS policies across migrations 001-074.
- `classes.teacher_id` is a single FK, not a junction.
- Students use a `class_students` junction; teachers do not have an equivalent.

**Design sketch:**
1. New table `class_memberships(class_id, user_id, role)` where role ∈ {`owner`, `co_teacher`, `viewer`, `substitute`}.
2. Migration to backfill: for each class, insert one `owner` row from the existing `teacher_id`.
3. Keep `classes.teacher_id` as "primary owner" for now (backward compat); phase out later.
4. Rewrite all RLS policies to use `class_id IN (SELECT class_id FROM class_memberships WHERE user_id = auth.uid() AND role IN ('owner','co_teacher','viewer'))`.
5. For school-wide admin access, introduce `school_memberships(school_id, user_id, role)` (depends on FU-P).

**Investigation steps:**
1. Grep all RLS policies for `teacher_id = auth.uid()` — expected ~40+ sites.
2. Decide write vs read differentiation (co-teachers can write? viewers read-only?).
3. Spec role semantics: who can grade, who can moderate, who can change class settings.

**Definition of done:** Every RLS policy uses a membership join instead of direct ownership. Backfill migration preserves current access. Co-teacher flow tested with 2-teacher class.

---

## FU-P ✅ RESOLVED 4 May 2026 — No school / organization entity (flat teacher→class→student hierarchy)

**Surfaced:** Phase 6 Checkpoint 5.1 review (14 Apr 2026)
**Resolved:** `schools` entity shipped via Preflight Phase 8 (28 Apr 2026, mig 085) + Access Model v2 Phase 0 backfill (4 May 2026)
**Resolution:** `schools` table EXISTS with `parent_school_id` (district seam), `subscription_tier`, `default_locale`, `status` lifecycle enum, `region`, `bootstrap_expires_at`. `school_id` populated NOT NULL on `teachers`, `classes`, `students`, `units`, `machine_profiles`, `fabricators`, `fabrication_labs`. Every existing teacher backfilled with a personal `school_id` during Phase 0 — no NULL school_id rows post-Phase-0. `current_teacher_school_id()` SECURITY DEFINER helper drives school-scoped RLS, validated in prod across 3 NIS Matt personas via Phase 8 multi-teacher smoke. School Library browse view (Phase 4) reads `units.school_id`. Domain-based auto-suggest (`school_domains` table) + fuzzy-match gate (trigram + tsvector > 0.7) + merge queue (`school_merge_requests`) shipped for dedup. Multi-school memberships (`teacher_memberships` junction) deferred as `FU-AV2-MULTI-SCHOOL-MEMBERSHIPS` — not blocking single-school pilot. See [`access-model-v2-phase-6-checkpoint-a7.md`](access-model-v2-phase-6-checkpoint-a7.md) and [`access-model-v2.md`](access-model-v2.md) §11. Original symptom + design sketch retained below for archive.

---

**Symptom:** Data model has no `schools` or `organizations` table. Concrete blockers:
- Can't share a curriculum library across teachers in the same school.
- Can't enforce school-level branding, framework defaults, or content policy.
- No district rollout — every teacher sign-up is an island.
- No "school-wide safety report" for safeguarding leads.
- Can't bill per-school; every license is per-teacher.
- Can't surface "teachers in your school are using this unit" social proof.

**What we know:**
- Loominary OS vision explicitly calls out multi-tenant school/org as an extraction target (`../Loominary/docs/os/master-architecture.md`).
- No current column in any table points to a school.
- Auth domain matching (e.g., `@britishschool.edu.cn`) could seed initial school inference.

**Design sketch:**
1. New tables: `schools(id, name, domain, framework_default, ...)`, `school_memberships(school_id, user_id, role)` where role ∈ {`admin`, `dept_head`, `teacher`, `student`}.
2. Add nullable `school_id` to `classes`, `units`, `content_items`, `activity_blocks` — rows with school_id are school-scoped; NULL means teacher-private.
3. "Share to school library" button on unit/block — sets `school_id`.
4. Pairs with FU-O role system: school-level roles (admin sees everything in their school) layer on top of class-level roles.

**Investigation steps:**
1. Decide whether a teacher can belong to multiple schools (Matt teaches at 2 schools? substitute covering multiple schools?). Probably yes → many-to-many.
2. Decide school_id resolution at sign-up: (a) admin invites, (b) auth-domain inference, (c) self-declaration with admin verification.
3. Decide content forking model: school library unit forked by teacher — does the fork stay school-scoped or become teacher-private? (ties to ADR-010 content forking.)

**Definition of done:** Schools table exists. School memberships join works. At least one end-to-end flow tested: school admin creates school, invites 2 teachers, one teacher shares a unit to the school library, other teacher forks it.

---

## FU-Q — Dual student identity (class_students junction AND students.class_id)

**Surfaced:** Phase 6 Checkpoint 5.1 review (14 Apr 2026); pattern is Lesson #22
**Target phase:** Post-Dimensions3 cleanup phase
**Priority:** P2 (slow-bleed defensive-code tax on every teacher API)

**Symptom:** Students have both `class_students(student_id, class_id)` junction (from multi-class enrollment work) AND `students.class_id` (legacy single-class column). Lesson #22 documented the "junction-first, legacy-fallback" pattern every teacher API now carries. Downsides:
- Every teacher API has ~20 lines of defensive joining to cover both shapes.
- Easy to forget the fallback → phantom students missing from a view.
- Writes have to update both places → easy to get out of sync.
- New features default-copy the defensive pattern, compounding the debt.

**What we know:**
- `class_students` is the canonical source per recent decisions; `students.class_id` is legacy.
- Some queries use junction-only, some use class_id-only, some use both.
- Not causing incidents today but every new teacher-facing feature pays the tax.

**Investigation steps:**
1. Grep all `.from('students')` and `.from('class_students')` call sites — expected 50+.
2. Audit: for each call site, is it junction-first-fallback, junction-only, or class_id-only?
3. Migration: backfill any class_id-only rows into `class_students`.
4. Drop `students.class_id` column once backfill verified.
5. Remove legacy fallback branches from all API code.

**Definition of done:** `students.class_id` column removed. All student lookups go through `class_students`. Lesson #22 marked obsolete.

---

## FU-R ✅ RESOLVED 4 May 2026 — Auth model split (teacher Supabase Auth vs student custom token sessions)

**Surfaced:** Phase 6 Checkpoint 5.1 review (14 Apr 2026)
**Resolved:** Access Model v2 Phase 6.1 (4 May 2026) — students migrated to Supabase Auth via lazy-provision
**Resolution:** Migration `20260503203440_phase_6_1_drop_student_sessions.sql` APPLIED to prod. `student_sessions` table dropped, custom-token shim deleted, 50 callsites migrated, login route deleted. Students now lazy-provision via Supabase Auth on first classcode-login: `students.user_id`, `school_id`, `class_id` all populated. Students use Supabase Anonymous Auth pattern (option a from the original sketch) — RLS works against `auth.uid()`, no `questerra_student_session` cookie set anywhere. Phase 6.3b middleware guard prevents wrong-role traversal (student session can't reach `/teacher/*`, teacher session can't reach `/dashboard /unit /etc`). Verified via Phase 6.1 prod smoke: student `c` created via classcode-login, dashboard navigation clean, all 5 student API routes auth-bridge-free. See [`access-model-v2-phase-6-checkpoint-a7.md`](access-model-v2-phase-6-checkpoint-a7.md) §1 and `src/lib/auth/`. Original symptom + design sketch retained below for archive.

---

**Symptom:** Teachers authenticate via Supabase Auth (`auth.uid()` works, RLS works). Students authenticate via a custom token session system (Migration 028, `student_tool_sessions`). Every feature that spans both roles — peer review, class gallery, group work, safety alerts citing a student, parent portal — needs bridging code. The bridge is fragile: teacher APIs use `createServerClient().auth.getUser()`, student APIs use custom `validateStudentToken()` middleware. Features that want to accept either have to detect-and-fork.

**What we know:**
- Decision to use custom tokens for students was driven by no-email-required sign-up (students get teacher-issued login codes).
- Supabase Auth anonymous sign-in has matured since that decision was made — worth re-evaluating.
- The split also causes: no unified session table, no unified audit log, two password-reset flows, two rate-limit surfaces.

**Design sketch:**
1. Evaluate Supabase Anonymous Auth for students — does it support teacher-issued login codes?
2. If yes, migrate students to Supabase Auth with an "anonymous" flag. Keep email as optional.
3. If no, build a proper bridge library: `getAuthenticatedUser()` that returns `{kind: 'teacher' | 'student', id, metadata}` regardless of source.
4. Deprecate `student_tool_sessions` in favor of the bridge.

**Investigation steps:**
1. Pilot Supabase Anonymous Auth on one student flow. Verify: RLS works with anon session, token persists across visits, teacher can link anon student to a class.
2. Spec the migration path: existing student tokens → Supabase sessions without students noticing.

**Definition of done:** Either (a) students migrated to Supabase Auth with feature parity, or (b) explicit bridge library adopted across all cross-role features. No new feature should need to choose a lane.

---

## FU-S — Moderation log is class-scoped but ingestion is upload-scoped

**Surfaced:** Phase 6 Checkpoint 5.1 review (14 Apr 2026)
**Target phase:** Phase 7 or post-Dimensions3
**Priority:** P2 (safeguarding traceability gap)

**Symptom:** `content_items.processing_status = 'moderation_hold'` has no `class_id` — uploads are teacher-scoped, not class-scoped. Later, when a held block is approved and assigned to multiple classes, there's no audit link between the held upload and the classes/students that would have been exposed. For a safeguarding lead answering "which students saw content flagged as X on date Y," the trail is broken.

**What we know:**
- `moderation_logs` has `class_id` (per FU-N).
- `content_items` does not have class_id (intentional — content is reusable across classes).
- Link between content_items and class usage is implicit (via units → blocks → content).

**Design sketch:**
1. New table `content_moderation_events(content_item_id, moderation_status, flagged_at, flagged_by_system, context)` that attaches to uploads.
2. New table `content_class_exposure(content_item_id, class_id, student_id, exposed_at)` — log every time a student views a piece of content.
3. Safeguarding query: for a flagged content_item, JOIN to exposure log to see who saw it.

**Investigation steps:**
1. Spec with safeguarding lead — what's the query they actually need?
2. Exposure logging is high-volume — needs partitioning or aggregate roll-ups.

**Definition of done:** Safeguarding lead can answer "which students saw content X" for any moderated item, within policy-defined retention window.

---

## FU-T — No content ownership transfer (teacher leaves, content stranded)

**Surfaced:** Phase 6 Checkpoint 5.1 review (14 Apr 2026)
**Target phase:** Post-FU-P school entity (requires school destination)
**Priority:** P2 (concrete pain point the first time a teacher leaves a school mid-year)

**Symptom:** `units`, `activity_blocks`, `content_items`, and `classes` all hardcode `teacher_id`. When a teacher leaves the school, their entire content library is stranded. No way to:
- Hand units to a replacement teacher mid-year.
- Archive content to a school library for future teachers.
- Transfer ownership of a class to a co-teacher.

**What we know:**
- Simple UPDATE of `teacher_id` would work schema-wise but breaks RLS mid-flight (the new owner needs access before the old owner loses it).
- Depends on FU-P (school library destination) for "archive to school" flow.

**Design sketch:**
1. Add `previous_teacher_ids UUID[]` to preserve audit trail on transfer.
2. Admin UI: "Transfer ownership" action on class/unit/block, with confirmation.
3. Bulk transfer: "Move all of teacher X's content to teacher Y" admin function.
4. School archive: "Archive all of teacher X's content to school library" (requires FU-P).

**Definition of done:** Admin can transfer any content entity to a new teacher or the school library. Audit trail preserved. RLS doesn't flap during transfer.

---

## FU-U — Single-tenant URL structure (no /school/*, /org/* namespace)

**Surfaced:** Phase 6 Checkpoint 5.1 review (14 Apr 2026)
**Target phase:** Post-FU-P (driven by school entity design)
**Priority:** P3 (cosmetic until multi-tenant ships, then hard retrofit)

**Symptom:** Routes are `/teacher/*`, `/student/*`, `/admin/*` with no organization namespace. When FU-P lands, school-scoped routes (`/school/[schoolId]/library`, `/school/[schoolId]/safety`) will need to be added. Retrofitting means either (a) adding a new namespace and migrating existing routes, or (b) keeping flat and encoding school context in URL params (ugly, hard to share links).

**What we know:**
- Next.js App Router makes the retrofit cheaper than a full path rewrite (route groups, parallel routes).
- Concrete smell already: `/teacher/safety/alerts` shows one teacher's alerts, but there's no obvious path to "safety alerts for my whole school."

**Design sketch:**
1. Introduce `/school/[schoolSlug]/*` as the namespace for school-scoped views.
2. Dept-head and school-admin views live at `/school/[schoolSlug]/dept/[deptSlug]/*` and `/school/[schoolSlug]/admin/*`.
3. Individual teacher routes stay at `/teacher/*` (personal library, personal classes).
4. Cross-link: school library view links to teachers' class views.

**Investigation steps:**
1. Decide schoolSlug format (human-readable? UUID?). Affects shareability and security.
2. Audit all current `/teacher/*` routes — which need a school-scoped equivalent?

**Definition of done:** Namespace pattern documented. First school-scoped route (`/school/[slug]/library`) shipped as proof-of-concept alongside FU-P rollout.

---

## FU-V — Cross-class student analytics double-counting / under-counting

**Surfaced:** Phase 6 Checkpoint 5.1 review (14 Apr 2026)
**Target phase:** Dimensions3 feedback loop (Phase 7+) or Journey Engine integration
**Priority:** P2 (silent data bug waiting for first analytics feature)

**Symptom:** `discovery_profiles` and `learning_profile` (JSONB on `students`) are one-per-student globally. But teachers access students via `class_students` junction — one student can appear in 3 of a teacher's classes. Analytics aggregated per-class will either:
- Double-count a student (student in 3 classes counted 3×).
- Under-count if query uses DISTINCT student_id at teacher-level.
- Show stale per-class metrics if the profile-update event doesn't know which class triggered it.

No current feature exposes this, but Dimensions3 feedback loop ("how is this student progressing?") will hit it immediately.

**What we know:**
- Scope question: is "progress" a per-student or per-student-per-class concept? Probably per-student-per-class (student may be strong in Grade 8 DT but new in Grade 8 Makerspace).
- Current schema has no per-class progress table.

**Design sketch:**
1. New table `student_class_progress(student_id, class_id, metric, value, updated_at)` — one row per (student, class, metric) tuple.
2. Profile updates dual-write: global `learning_profile` gets a merged view, `student_class_progress` gets the per-class snapshot.
3. Analytics queries explicitly state join direction (per-class or per-student-global).

**Investigation steps:**
1. Spec the feedback loop data model with Dimensions3 Phase 7 in mind.
2. Decide what's global vs per-class (interests, learning style — global; specific unit progress — per-class).

**Definition of done:** Per-class progress table exists. Analytics queries specify their grain. Feedback loop features don't double-count.

---

## FU-W — No immutable audit log on RLS-writable tables

**Surfaced:** Phase 6 Checkpoint 5.1 review (14 Apr 2026) — triggered by manual `UPDATE classes SET teacher_id = ...` with no trail
**Target phase:** Quick-add, any future safety/compliance pass
**Priority:** P2 (cheap insurance against first "why did my unit change" support ticket)

**Symptom:** RLS allows teachers to UPDATE their own classes, students, units, blocks. No table captures a history of who changed what, when. Specific incidents already foreshadowed:
- Manually UPDATE'd a class's `teacher_id` during Step 9 debugging — no record that happened.
- If content is moderated then edited, no trail.
- No way to answer "this unit was different yesterday, what changed?"

**What we know:**
- Supabase supports `pg_audit` extension but it's heavy.
- Common pattern: per-table `*_history` table populated by AFTER UPDATE/DELETE trigger.
- Should at minimum cover: `classes` (teacher_id, name, framework), `units` (content_data, criterion_tags), `activity_blocks` (content, moderation_status), `moderation_logs` (status changes — critical for safety).

**Design sketch:**
1. New table `audit_log(id, table_name, row_id, action, changed_by, changed_at, old_values JSONB, new_values JSONB)`.
2. AFTER UPDATE/DELETE triggers on critical tables write to audit_log.
3. RLS on audit_log: teachers see their own rows; admins see all.
4. Retention policy: 12 months default, longer for safety-flagged rows.

**Investigation steps:**
1. Pick 3-5 highest-risk tables to cover first (classes, units, activity_blocks, moderation_logs, assessments).
2. Write trigger function, apply as one migration.
3. Build a minimal "history" UI slot on unit detail page.

**Definition of done:** AFTER triggers in place on 5+ tables. Audit log queryable. First demo: show history of a unit.

---

## FU-X — 3 tables unprotected (P1 live data leak) ✅ RESOLVED

**Surfaced:** Phase 7-Pre.1 schema-registry backfill (14 Apr 2026)
**Resolved:** Phase 7A-Safety-1 (14 Apr 2026)
**Priority:** P1

**Issue:** `usage_rollups`, `system_alerts`, and `library_health_flags` had no RLS enabled in migration source. Any authenticated user could read all rows via PostgREST.

**Resolution:** Migration 075 enables RLS on all 3 tables with appropriate policies:
- `usage_rollups`: teacher reads own rows (`teacher_id = auth.uid()`) + service_role full access
- `system_alerts`: service_role-only access (ops-internal, no teacher/student access)
- `library_health_flags`: service_role-only access (ops-internal, no teacher/student access)

Idempotent `DROP POLICY IF EXISTS` guards added to all 6 policies in 075.
Schema-registry `applied_date` set to 2026-04-14 on all 3 tables + cost_rollups.
RLS-coverage scanner (`scan-rls-coverage.py`) added to prevent recurrence.

---

## FU-Y — Groq + Gemini fallbacks never shipped (P2 doc-vs-reality drift)

**Discovered:** 2026-04-14 (Phase 7-Pre.3 ai-call-sites scan).

**Issue:** CLAUDE.md lists "Groq + Gemini fallbacks" as part of the AI stack. The scanner found zero SDK imports, zero HTTP calls, and zero consumers of these providers. `src/lib/ai/openai-compatible.ts` exists as a wrapper class with no active consumers.

**Impact:** Low — no runtime effect, but it's documentation drift. Anyone reading CLAUDE.md will assume a resilience layer exists that doesn't.

**Decision:** Two options — (1) actually wire Groq/Gemini fallbacks into the has_fallback: false call sites (adds real resilience), OR (2) delete `openai-compatible.ts` and fix CLAUDE.md to reflect the current single-provider reality. No action required for Phase 7; revisit when fallback resilience becomes a priority.

**Definition of done:** Either fallbacks wired and tested, or dead code deleted and docs updated.

---

## FU-Z — Author-ambiguous free-text column split (P3)

**Discovered:** 2026-04-14 (GOV-1.1a + 1.1b data classification checkpoints).

**Issue:** Several free-text columns are "mixed-author" — a row-level flag determines whether the current row was written by a student or a teacher. The classification taxonomy can't assign a single clean `basis:` value because the legal basis depends on the row's author flag. GOV-1.1a and 1.1b resolved this conservatively by classifying each column under the stricter basis (`coppa_art_6`) and leaving a YAML comment on the ambiguity.

**Known instances:**
- `bug_reports.description` — governed by `reporter_role` (student | teacher)
- `bug_reports.screenshot_url` — governed by the same `reporter_role`
- `competency_assessments.comment` — could be teacher observation OR student self-assessment, no author flag on the row at all

**Likely more exist.** Before implementing the fix, do a one-off scan: `grep -l "free-form" docs/schema-registry.yaml` / look for any `free_text` or comment-style columns on tables that serve both student and teacher UI. Expect 2–4 additional cases.

**Impact:** Low — the conservative classification is safe (we over-protect rather than under-protect). But it means any automated policy that reads the classification can't distinguish between student-authored rows (which need extra safeguarding) and teacher-authored rows (which don't).

**Fix:** Schema migration that splits the column into `student_description` and `teacher_description` (only one of the two is populated per row, governed by `reporter_role`). Same for `screenshot_url`. Lets each column get a deterministic classification. Requires a backfill to redistribute existing rows.

**Definition of done:** Migration applied, existing rows backfilled, classification updated to remove the "mixed author" YAML comment, and the bug report submission UI updated to write to the correct column based on the submitter's role.

**Priority:** P3 — not blocking any feature; picks up only when the bug report UI is next edited or when an automated policy needs the deterministic classification.

---

## FU-AA — Drop deprecated `own_time_*` tables from schema-registry (P3)

**Discovered:** 2026-04-14 (GOV-1.1b classification pass).

**Issue:** `own_time_approvals`, `own_time_projects`, `own_time_sessions` still have entries in `docs/schema-registry.yaml` with 0 columns each. The feature was replaced by Open Studio. GOV-1.1b added empty classification blocks to stay consistent with R2 (all tables classified), but these registry entries are dead weight.

**Impact:** Low — cosmetic. Any automated policy that iterates the registry will skip zero-column tables naturally.

**Definition of done:** Either (a) delete the three entries from `schema-registry.yaml` AND drop the tables from the database in a migration, or (b) drop the tables in a migration first, then the registry scanner will remove the entries on next saveme sync. CLAUDE.md's "Old unused code safe to delete" note already flags the Own Time components for removal; this registry cleanup should ride along with that work.

---

## FU-BB — schema-registry scanner misparses compound `ADD COLUMN` migrations (P3)

**Discovered:** 2026-04-14 (GOV-1.1b classification pass).

**Issue:** Several columns in `docs/schema-registry.yaml` have compound type strings that leaked from a migration's `ADD COLUMN x TYPE, ADD COLUMN y TYPE, ...` pattern — the scanner captured the entire trailing SQL instead of just the first column's type.

**Example observed:** a column shows `type: "DATE, ADD COLUMN strand_a_due_date DATE, ..."` instead of `type: DATE`.

**Impact:** Low for classification (column names are still correct). But any future tool that reads the `type:` field (migration generators, typed-client generators) will break on these.

**Definition of done:** Fix `scripts/registry/` (or the equivalent scanner) to handle compound `ADD COLUMN` statements correctly, rerun the sync, and validate the affected entries.

---

## FU-CC — Annotate build-time-only secrets in `feature-flags.yaml` (P3)

**Discovered:** 2026-04-14 (GOV-1.4 — `scan-feature-flags.py` flagged `SENTRY_AUTH_TOKEN` as orphaned on first run).

**Issue:** `SENTRY_AUTH_TOKEN` is consumed by the `@sentry/nextjs` webpack plugin at build time (via `next.config.*` / Sentry config files), not at runtime via `process.env.SENTRY_AUTH_TOKEN`. The scanner — which greps `src/` for `process.env.X` — correctly doesn't find it and reports it as orphaned. This is expected behaviour, not drift.

**Impact:** Every scanner run will report `status: drift` with one known-legitimate orphan. False-positive noise will erode signal.

**Definition of done:** Add a one-line YAML comment next to `SENTRY_AUTH_TOKEN` in `docs/feature-flags.yaml` — e.g. `# consumed by @sentry/nextjs build plugin, not process.env — scanner orphan is expected`. Optionally extend `scan-feature-flags.py` to recognize a per-entry `ignore_orphan: build_time` flag so the scanner returns `status: ok` when all drift items are marked. One-line comment now; scanner enhancement later if a second build-time-only secret appears.

**Priority:** P3 — cosmetic; scanner still works correctly, just emits a known false-positive. Pick up during the next GOV-related session or next time `feature-flags.yaml` is touched.

---

## FU-DD — Legacy scanners strip `version:` field on rewrite (P2)

**Discovered:** 2026-04-14 (first saveme after GOV-1.4 shipped).

**Issue:** `scripts/registry/scan-api-routes.py --apply` and `scripts/registry/scan-ai-calls.py --apply` both overwrite their target YAMLs without preserving the new top-level `version: 1` field that GOV-1.4 added. Running either scanner removes the field; next saveme round-trips it back — creating churn and violating the version-bump contract (A13).

**Impact:** P2 — silent. The version field is erased on every saveme and manually re-added only if the diff is inspected closely. Any future code that checks `registry.version` will see undefined after a scanner run.

**Reproduction:**
1. Confirm `version: 1` is at the top of `docs/api-registry.yaml` and `docs/ai-call-sites.yaml`.
2. Run `python3 scripts/registry/scan-api-routes.py --apply`.
3. `git diff` shows the version line removed.

**Definition of done:** Both scanners (a) read the existing yaml first if it exists, (b) capture any top-level scalar fields other than `routes`/`call_sites` into a preserved dict, and (c) write those back on top of the regenerated content. Round-trip test: re-run the scanner twice in a row, confirm second run produces zero diff. Add the round-trip test to the scanner harness if one exists, or log as a manual check.

**Priority:** P2 — doesn't cause production harm but actively undermines the registry-version contract we just established. Fix before the next major registry change or the first time `registry.version` is actually consumed.

---

## FU-LL — ai_model_config system redundancy assessment (P2)

**Filed:** 14 Apr 2026
**Target phase:** Next cleanup pass
**Priority:** P2 (technical debt — vestigial system with one live consumer)

**Issue:** The `/admin/ai-model` UI (macro dials → micro sliders → `ai_model_config` table via `PUT /api/admin/ai-model`) appears vestigial — it's from week 1 of StudioLoom, predates Dimensions3, and Matt hasn't adjusted it since. Pre-delete audit (14 Apr 2026) confirmed the component (`AIControlPanel`) is purely presentational (zero internal DB writes), the macro values never leave React state until the parent saves, and no pipeline/prompt/generation code references "macro" values or `schoolProfile`. However, `src/lib/ai/quality-evaluator.ts` reads from `ai_model_config` at runtime during Stage 6 scoring. Direct deletion would break scoring silently.

**File inventory (17 files):**
- Component: `src/components/admin/AIControlPanel.tsx` (680 lines)
- Page: `src/app/admin/ai-model/page.tsx`
- Supporting: `src/components/admin/ai-model/{config-helpers.ts, CategoryPanel.tsx, TimingPanel.tsx, SliderRow.tsx, TestSandbox.tsx}`
- API: `src/app/api/admin/ai-model/{route.ts, test/route.ts, test-lesson/route.ts}`
- Data: `src/lib/ai/{model-config-defaults.ts, model-config.ts}`
- Runtime consumer: `src/lib/ai/quality-evaluator.ts`
- Types: `src/types/ai-model-config.ts`
- Test sandbox: `src/app/admin/test-sandbox/page.tsx`

**Suggested investigation:**
1. Audit what values from `ai_model_config` quality-evaluator actually reads. Are any of them now covered by FormatProfile, block efficacy, or Lesson Pulse weights?
2. For each value still load-bearing: can its default be frozen into `model-config-defaults.ts` as a constant, removing the need for the table + UI?
3. If ALL values can be frozen or moved: delete `/admin/ai-model` route, delete AIControlPanel + supporting files, drop `ai_model_config` table in a new migration.
4. If some values must remain admin-tunable: document which in schema-registry with "load-bearing — do not remove" note; decide if they belong in `admin_settings` (operational) or a new `scoring_weights` table (quality-tuning).

**Definition of done:** Either full deletion of the ai_model_config UI/table with quality-evaluator refactored to use frozen/FormatProfile inputs, OR a documented explanation of what's still load-bearing and why.

---

## FU-MM — `scan-ai-calls.py` strips hand-curated indirect call sites on rewrite (P2)

**Filed:** 15 Apr 2026 (during `saveme`)
**Target phase:** Next scanner maintenance pass
**Priority:** P2 — silent data loss; current saveme workflow requires manual revert every run

**Issue:** Running `python3 scripts/registry/scan-ai-calls.py --apply` rewrites `docs/ai-call-sites.yaml` with fewer entries than exist. The scanner only detects direct Anthropic SDK imports; 12 hand-curated "indirect" entries (routes that invoke library functions which themselves call AI) are dropped on every rewrite. Current count went from 60 → 48 on the 15 Apr 2026 run. The dropped entries include `/api/student/design-assistant`, `/api/student/quest/mentor`, `/api/teacher/generate-unit`, and others where cost-tracking completeness matters.

**Workaround applied this session:** Reverted `docs/ai-call-sites.yaml` via `git checkout` after the scanner ran. Accepted the `docs/api-registry.yaml` diff (purely additive — 5 new routes). Flagged here so future `saveme` runs don't blindly commit the regression.

**Related follow-ups:**
- FU-DD (legacy scanners strip `version:` field on rewrite) — same class of scanner-loses-curation bug
- Pattern: any scanner that fully rewrites its target file must preserve hand-curated data sections

**Suggested investigation:**
1. Scanner should detect the existing "Indirect AI call sites" comment block and preserve everything under it.
2. OR split the yaml into two top-level keys: `scanner_managed_sites:` + `manually_curated_sites:` so the scanner only touches its half.
3. Add a regression test: run scanner against a yaml with known indirect entries, assert they survive.

**Definition of done:** Running the scanner preserves hand-curated indirect entries. A saveme can commit the diff without needing to revert.

---

## FU-Library-B1 — Wire `/teacher/library/import/page.tsx` stub `handleAccept` (P1)
**Surfaced:** Library Card File Upload Phase A (14 Apr 2026)
**Target phase:** Library Phase B

**Issue:** The import page has a stub `handleAccept` callback that displays the reconstructed unit preview but does not persist it. After a teacher uploads a scheme of work and the pipeline returns `{ reconstruction, contentData, ingestion }`, the teacher can review the result but cannot save it as a real unit.

**Suggested investigation:**
1. Wire `handleAccept` to POST to a new or existing unit-creation endpoint that accepts `contentData` and creates a `units` row + `unit_pages` rows.
2. Decide whether the created unit should be a draft or immediately published.
3. After save, redirect to the unit detail page (`/teacher/units/[unitId]`).

**Definition of done:** Teacher can upload a document on the library import card, review the reconstructed unit, click Accept, and land on a saved unit detail page.

---

## FU-Library-B2 — Retire legacy `/teacher/units/import` + `/api/teacher/convert-lesson` (P2)
**Surfaced:** Library Card File Upload Phase A (14 Apr 2026)
**Target phase:** Library Phase B (depends on FU-Library-B1)

**Issue:** The old import flow at `/teacher/units/import` and its backing API at `/api/teacher/convert-lesson` (currently returns 410 Gone) are superseded by the new `/teacher/library/import` flow. Once FU-Library-B1 lands and the new import path is end-to-end functional, the old routes should be deleted to avoid confusion.

**Suggested investigation:**
1. Confirm no other code references `/teacher/units/import` or `/api/teacher/convert-lesson`.
2. Delete the page and API route files.
3. Remove any nav links or redirects pointing to the old paths.

**Definition of done:** Old import routes deleted, no references remain, no 404s in nav.

---

## FU-Library-B3 — Relocate `extractDocument` to shared location (P3) ✅ RESOLVED
**Surfaced:** Library Card File Upload Phase A (14 Apr 2026)
**Resolved:** 16 Apr 2026

**Resolution:** `extractDocument` relocated to `src/lib/ingestion/document-extract.ts` (canonical location). All 7 consumers updated to new import path. Original `src/lib/knowledge/extract.ts` first converted to re-export shim, then fully deleted when zero consumers remained. Shim lifecycle: created → all imports migrated → deleted in same session.

**Commits:** `64d7df9` (relocate + shim), cleanup commit (shim deletion + final consumer updates).

---

## FU-LS-DRIFT — WIRING `student-learning-support` was claiming complete features that didn't exist (P2)
**Surfaced:** Audit pass for language-scaffolding-redesign (26 Apr 2026, on `lesson-bold-build`)
**Target phase:** Phase 0 of language-scaffolding-redesign — RESOLVED in this Phase 0 commit.

**Issue:** Pre-26-Apr WIRING entry for `student-learning-support` had `status: complete`, `currentVersion: 1`, summary claiming "Tier 2/3 translation via Claude (ELL level configurable), UDL scaffolding (checkpoints 1-31), ADHD visual focus helpers, dyslexia-friendly fonts." Grep across `src/` confirmed zero references for any of the four claimed features:
- 0 `dyslexic` / `OpenDyslexic` / `dyslexia.*font` references in any TSX/CSS
- 0 `translateContent` / `tier2_translation` / `tier3_translation` references
- `udl_checkpoints` exists only as a teacher-side authoring tag on `activity_blocks` (curriculum metadata), not a student-facing render-time accessibility feature
- Teacher settings has an `enable_udl` toggle that affects lesson generation, not student render

**The system was paper-only.** Same drift family as `FU-Y` (Groq + Gemini fallbacks never shipped). The drift would have stayed invisible if the language-scaffolding-redesign brief had trusted the existing entry's premise.

**Captured in:**
- Lesson #54 (`docs/lessons-learned.md`) — "WIRING.yaml entries can claim 'complete' features that don't exist; audit by grep before trusting any system summary." Adds the rule: marketing-shaped summaries are higher-risk than implementation-specific summaries.
- §0.5 + §1.5 of `docs/projects/language-scaffolding-redesign-brief.md` (`a8c0907`).
- Decision log entry (26 Apr 2026): "WIRING `student-learning-support` doc-vs-reality drift fix mid-build — option (i)."

**Resolution (Phase 0 of language-scaffolding-redesign):** WIRING entry rewritten in this Phase 0 commit:
- `status: complete` → `status: planned`
- `currentVersion: 1` → `currentVersion: 0`
- Summary rewritten to describe the redesign deliverable (Tap-a-word + Response Starters)
- `affects:` extended to include all the consumers the redesign will reach: lesson-view, discovery-engine, student-open-studio, ai-mentor, toolkit
- `docs:` updated to point at `language-scaffolding-redesign-brief.md`
- `change_impacts:` documents the drift discovery + signals when the entry will flip back to `complete`

**Definition of done:** WIRING entry honest about reality + scheduled work. Will flip back to `status: complete`, `currentVersion: 1` when Phase 5 (live E2E gate) of the language-scaffolding-redesign ships.

**Wider audit:** Periodic drift scanners exist for api-registry, ai-call-sites, schema-registry, feature-flags, vendors. WIRING.yaml has no scanner — manual maintenance only. Most likely registry to drift. Adding a saveme spot-check rule per Lesson #54: when a WIRING entry has a marketing-shaped summary, grep for at least 2 of its claimed features before trusting `status: complete`.

---

## FU-TAP-SANDBOX-POLLUTION — Sandbox writes pollute shared word_definitions cache (P2) ✅ RESOLVED
**Surfaced:** 27 Apr 2026, Tap-a-word Phase 1B/1C browser smoke (after Lesson #56 gate fix landed)
**Resolved:** 27 Apr 2026 (same day, via Phase 1 closeout step 5 — defensive fix on main)
**Captured in:** Lesson #57 (`docs/lessons-learned.md`), `docs/decisions-log.md` 27 Apr entry

**Issue (historical):** `src/app/api/student/word-lookup/route.ts` called `await supabase.from("word_definitions").upsert(...)` in BOTH the sandbox and live branches. The sandbox upsert wrote `[sandbox] definition of "X"` sentinel rows to the shared cache. Pre-Lesson #56 fix, every dev tap polluted the cache. Manual cleanup via `DELETE FROM word_definitions WHERE definition LIKE '[sandbox]%'` was the reactive mitigation.

**Resolution:** Option (a) applied — dropped the `upsert` from the sandbox branch in `src/app/api/student/word-lookup/route.ts:88-101`. Sandbox is now read-only. Route test (`__tests__/route.test.ts`) updated to assert `upsertSpy` is NOT called in the sandbox path (test renamed to flag the Lesson #57 contract). 9/9 route tests pass.

**Why defensive even though the gate fix made it moot in practice:** With the new `NODE_ENV === "test"` gate, the sandbox branch is ONLY reachable from vitest (where `createAdminClient` is mocked), so the prior upsert was already a no-op against real Supabase. But removing the upsert locks in the contract structurally — any future gate refactor that accidentally re-routes dev/prod to the sandbox branch can no longer pollute the cache. Belt-and-braces. ~3 lines of code, 1 test update.

---

## FU-BUILD-HEAP — `next build` OOMs with default 2GB Node heap (P3)
**Surfaced:** 27 Apr 2026, Tap-a-word Phase 1B verification step
**Trigger:** `npm run build` from `/Users/matt/CWORK/questerra-tap-a-word` crashed at ~52s with `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory` (process at 2027 MB). Workaround: `NODE_OPTIONS="--max-old-space-size=4096" npm run build` succeeds in ~90s.

**Issue:** This codebase (~95K LOC, ~290 source files) needs more than Node's default 2 GB heap to compile. Vercel's CI has 8 GB by default so prod deploys work; local builds and CI on tighter machines fail with no useful error.

**Fix:** Add to `package.json`:
```json
"build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
```
Or pin via `.nvmrc` / engine hint that documents the requirement.

**Definition of done:** `npm run build` succeeds without manual env-var setting on a default Node install.

---

## FU-AI-CALL-SCANNER-GUARD-DETECTION — `scan-ai-calls.py` can't see runtime stop_reason guards (P3)
**Surfaced:** 27 Apr 2026, Tap-a-word Phase 1C registry sync step
**Trigger:** Saveme step 11c re-ran `scan-ai-calls.py`. The new `/api/student/word-lookup` site shows `stop_reason_handled: unknown` even though the runtime guard is present at `src/app/api/student/word-lookup/route.ts:135-141`. The scanner does grep-based detection; it can't statically follow conditional throws.

**Issue:** This affects the FU-5 family count — sites that LOOK unguarded in the registry may actually have guards the scanner missed. False positives in the audit make it impossible to know how many real violations exist.

**Fix:** Either (a) extend `scan-ai-calls.py` to detect the `if (response.stop_reason === "max_tokens")` pattern with a few lines of AST-aware regex (the pattern is consistent enough), or (b) add a `stop_reason_handled_override` field to `ai-call-sites.yaml` that humans set manually for sites the scanner mis-flags. (a) is better for maintenance; (b) is a 5-minute hack.

**Definition of done:** A site that has the canonical `if (response.stop_reason === "max_tokens") throw new Error(...)` block is recorded as `stop_reason_handled: true` automatically. False-positive count on FU-5 audit drops to actual violations only.

---

## FU-TAP-TOOLKIT-FULL-COVERAGE — Tap-a-word mounts on remaining 24 toolkit tools (P3)
**Surfaced:** 27 Apr 2026, Phase 2D audit during language-scaffolding-redesign
**Captured in:** Phase 2 brief §3 Phase 2D, WIRING `tap-a-word` summary

**Issue:** Phase 2D landed surgical TappableText wraps on 3 of 27 toolkit tools (ScamperTool, MindMapTool, BrainstormWebTool) — the only ones with prompt text rendered as a JSX variable. The other 24 tools (DotVoting, EmpathyMap, FishboneTool, FiveWhys, HowMightWeTool, etc.) hardcode their educational text as inline JSX strings (e.g. `<p>What are ALL the ideas...</p>`), making each wrap a content-aware refactor: extract the literal into a prop, decide what's "educational text" vs UI chrome, wrap, verify visually.

**Deferred rationale:**
- Lesson page mounts (Phase 1B) cover the PRIMARY tap-a-word use case — students reading lesson content + tapping unfamiliar vocab.
- Toolkit tools are SECONDARY surfaces — students use them less per session.
- Phase 2.5 lets teachers disable tap-a-word per-class if it's distracting in any context.
- No real signal data yet on whether students would tap inside tools; Phase 4 signal infrastructure will tell us empirically which tools to prioritise.

**Recommended approach when work happens:**
1. Wait for Phase 4 signal data (taps_per_100_words rolling avg) showing which tools students actually use.
2. Pick the top 3-5 tools by usage, do focused content-aware wraps.
3. Repeat as data accrues.

**Pattern for new wraps (3 sample sites already shipped):**
```tsx
// Old: <div>{stepInfo.prompt}</div>
// New:
import { TappableText } from "@/components/student/tap-a-word";
// ...
<div><TappableText text={stepInfo.prompt} /></div>
```

For tools with hardcoded inline strings (the 24 deferred), the migration involves either (a) extracting the string into a const + wrapping, or (b) accepting that the literal text stays untappable. (b) is the simpler v1 — only wrap text already in a variable.

**Definition of done:** All toolkit tools that show >50 chars of educational prose to students have their prompt text wrapped in `<TappableText>`. UI chrome (button labels, axis labels, etc.) intentionally stays plain — those don't benefit from tap-a-word.

---

## FU-WORD-CACHE-HIT-TRACKING — Track cache hit_count + last_hit_at on word_definitions (P2)
**Surfaced:** 4 May 2026, Matt smoke after textarea/popover round 2
**Trigger:** Matt asked "hows the cache idea going for word defs to increase speed and decrease cost?" — answer was *cache works, observability is thin*. Single point measurement (cold-cache-smoke 27 Apr) showed 11.2% hit rate on real lessons after 578-word seed. Nothing tracked since.

**Issue:** `word_definitions` has `generated_at` but no `hit_count` or `last_hit_at` columns. Can't see which cached words are popular vs cold, can't measure live hit-rate, can't identify good pre-warm candidates from real student behaviour. Every other word-cache improvement (per-unit pre-warm, hot-words admin page, lemmatisation cost-benefit analysis) sits on top of this.

**Fix:**
1. Migration (timestamp-prefixed): `ALTER TABLE word_definitions ADD COLUMN hit_count INTEGER NOT NULL DEFAULT 0, ADD COLUMN last_hit_at TIMESTAMPTZ;`
2. In `src/app/api/student/word-lookup/route.ts` cache-HIT branch (lines 127–137): bump `hit_count` + set `last_hit_at = now()` via a non-blocking `supabase.from('word_definitions').update(...).eq(...)` (don't await — student response shouldn't wait on the hit-count write).
3. Add the columns to `docs/schema-registry.yaml` word_definitions entry.

**Definition of done:** Querying `SELECT word, hit_count, last_hit_at FROM word_definitions ORDER BY hit_count DESC LIMIT 20` returns a real top-20 list within a week of shipping. The per-week hit-rate query becomes possible:
```sql
SELECT
  sum(CASE WHEN last_hit_at > now() - interval '7 days' THEN hit_count ELSE 0 END) AS recent_hits,
  count(*) FILTER (WHERE generated_at > now() - interval '7 days') AS recent_misses
FROM word_definitions;
```

**Why P2 not P3:** Unlocks every other observability + optimisation move on the cache. Cheapest one to ship (~10-line route diff + 4-line migration), highest leverage.

---

## FU-WORD-CACHE-PER-UNIT-PREWARM — Async warm definitions on unit publish (P3)
**Surfaced:** 4 May 2026, Matt smoke after textarea/popover round 2
**Trigger:** Cache discussion — cold-cache hit rate is 11.2% because the 578-word global seed is generic design vocab; a unit on (e.g.) "Sustainable transport" introduces dozens of topic-specific words that none of the global seed covers. First student per class pays the latency for every miss.

**Issue:** Today, when a teacher publishes a unit, the unit's vocabulary is never pre-warmed. The first student to tap "aerodynamic" on each lesson page pays the ~1.2s Haiku miss; subsequent students hit the cache for free. With 12 students per class × 30 design-domain words per unit, that's ~360 first-tap latencies per unit launch that could be eliminated for ~$0.04 of pre-warm spend.

**Fix:**
1. After unit publish (or after lesson editor save), extract candidate words from lesson body text + activity prompts + vocab warmup terms. Filter to words ≥4 chars + not already in `word_definitions` for the relevant `(language, l1_target)` pair.
2. Async-warm via batched Haiku calls (chunk 20 words/call to amortise overhead), guard with the existing AI budget cascade (school > class > tier).
3. Implementation skeleton: new route `POST /api/teacher/units/[unitId]/prewarm-vocab` invoked by the editor's save handler, fire-and-forget. Extract logic into `lib/tap-a-word/extract-unit-vocab.ts` so it's testable in isolation.
4. Per-class L1: if any students in the class have non-`en` `l1_target`, also pre-warm those translation rows.

**Gating:** Depends on FU-WORD-CACHE-HIT-TRACKING shipping first so we can measure the actual hit-rate lift after pre-warm. Otherwise this is "build feature → hope it helps."

**Definition of done:** A freshly-published unit on a novel topic shows ≥80% cache hit rate within 24 hours of publish (vs current ~11% baseline). Per-unit pre-warm adds ≤$0.10 to the unit-publish cost.

---

## FU-WORD-CACHE-ADMIN-PAGE — Live cache observability at /admin/registries/word-cache (P3)
**Surfaced:** 4 May 2026, Matt smoke after textarea/popover round 2

**Issue:** No surface today shows cache health to admins. Once FU-WORD-CACHE-HIT-TRACKING lands, the data exists but is only queryable via SQL.

**Fix:** Read-only admin page at `/admin/registries/word-cache` (matches the existing `/admin/controls/registries` pattern from GOV-1). Surface:
- Total cached rows (split by `l1_target`)
- This-week hit count + miss count + hit %
- Top-100 hottest words (highest `hit_count`)
- Top-50 single-use words (cached once, never re-hit — pre-warm seed candidates for the inverse: words to NOT bother pre-warming)
- Per-unit hit rate breakdown (joined via lesson-body word extraction) — see which units are well-covered vs cold

**Pre-reqs:** FU-WORD-CACHE-HIT-TRACKING (data) + ideally FU-WORD-CACHE-PER-UNIT-PREWARM (so the per-unit breakdown is meaningful).

**Definition of done:** Admin can answer "is the cache working?" and "which units need more pre-warm?" without writing SQL.

---

## FU-TAP-PAGE-LOAD-PREWARM — Async-warm page vocabulary on mount (P2)
**Surfaced:** 4 May 2026, popover-flakiness round 3 ("any other ideas")
**Trigger:** Even after position-fix + 15s timeout + retry button, the FIRST tap on any uncached word costs ~600-1500ms of Haiku latency. On a typical lesson page with ~30 unique tappable words, the student hits ~5-10 cache misses scattered through the session. Each one feels slow.

**Issue:** Today the cache only warms on demand — student has to tap a word to populate it. Lesson pages display all their text at mount; we could async-warm the entire page's vocabulary on mount so by the time the student taps anything, ~95% of words are already cached. Pairs with FU-WORD-CACHE-PER-UNIT-PREWARM (which warms at unit-publish time, server-driven) — page-load pre-warm is a client-driven complement that handles content edited after publish, or units that pre-date the per-unit pre-warm shipping.

**Fix:**
1. New hook `usePageVocabPrewarm(text: string, classId, unitId)` — debounce 1500ms after mount, extract candidate words via the existing `tokenize()`, filter to ≥4 chars, dedup, batch-POST to a new `POST /api/student/word-lookup/batch` endpoint that runs cache-only check + missing-word generation in parallel.
2. Use existing AI budget cascade — same per-student / per-class / per-school caps as the on-tap path.
3. Mount the hook in the lesson page (`src/app/(student)/unit/[unitId]/[pageId]/page.tsx`) once data has loaded, passing the concatenated lesson body + activity prompt text.

**Expected lift:** First-tap latency drops from ~800ms (cache miss median) to ~30ms (Supabase cache hit) for ~95% of taps. Per-page pre-warm cost ~$0.003-0.005 amortised across all students in the class.

**Pre-reqs:** None hard, but FU-WORD-CACHE-HIT-TRACKING shipping first lets us measure the actual lift.

**Definition of done:** Cold page-load smoke shows >90% cache hit rate on a freshly-published unit's first tap (vs current ~11% baseline).

---

## FU-TAP-HOVER-PREFETCH — Speculative prefetch on hover (P3)
**Surfaced:** 4 May 2026, popover-flakiness round 3
**Trigger:** Even with page-load pre-warm, words generated by an AI mentor mid-session (chat responses) aren't pre-warmed. Hover-prefetch covers that gap.

**Issue:** When a student hovers a word for >250ms, they're showing intent. Kicking off a speculative cache check + Haiku call at hover time means the result is already in memory by the time they actually click.

**Fix:** Add a debounced `onMouseEnter` to the `<button>` in `TappableText.tsx` that fires `lookup.prewarm(word)` (a new method on the hook that runs the cache-check + Haiku flow without setting any popover state). On click, the cache hit path is instant.

**Why P3:** FU-TAP-PAGE-LOAD-PREWARM covers the bulk of the hit-rate gap; hover-prefetch is the long tail. Mobile/touch users don't hover, so the win is desktop-only. Worth doing but not before page-load pre-warm proves out.

**Definition of done:** Desktop students see <50ms first-tap latency on words they hovered for >250ms before clicking.

---

## FU-TAP-MOBILE-DOUBLE-TAP — iOS double-tap-to-zoom interferes with tap target (P3)
**Surfaced:** 4 May 2026, popover-flakiness round 3 (hypothesis)
**Trigger:** Speculative — Matt's smoke is on a Mac with a magic-mouse-or-trackpad setup. iOS Safari has a 300ms double-tap-to-zoom behaviour that can swallow click events on small inline targets if the user double-taps by accident. Worth verifying once we test on iPad (which is part of NIS's actual student fleet).

**Issue:** The tappable word `<button>` has no `touch-action: manipulation` set, so iOS Safari may delay click events by 300ms or trigger zoom on accidental double-tap. Could explain "sometimes works sometimes doesn't" on touch.

**Fix:** Add `touch-action: manipulation` to the button styles (or a `viewport meta` `user-scalable=no` if zoom is acceptable to disable, but that has accessibility implications — `touch-action` is the cleaner local fix).

**Definition of done:** iPad Safari smoke shows zero "tapped but nothing happened" reports across a 30-tap sequence on a freshly-loaded lesson page.

---

## FU-WORD-CACHE-LEMMATISATION — Stem-normalise cache keys to dedupe inflections (P3)
**Surfaced:** 4 May 2026, Matt smoke after textarea/popover round 2

**Issue:** `word_definitions.word` is exact-match. "design", "designs", "designed", "designing" each generate four separate rows, four separate Haiku calls, four separate cache misses on first tap. English Wiktionary stats suggest stem-deduplication saves ~30% on miss rate for academic vocabulary.

**Fix:** Lemmatise the word client-side (or in the route's pre-cache-lookup step) before keying the cache. Two viable paths:
- (a) Client-side: bundle a small lemmatiser (compromise.js ~200KB, or a lighter custom suffix-stripper for common English inflections — `-s`, `-es`, `-ed`, `-ing`, `-ly`, `-er`, `-est` covers ~90% of the win). Send both raw + lemma to the route; route prefers lemma cache hit.
- (b) Server-side: lemmatise in the route before the cache lookup. No bundle cost on the client; ~5ms added latency per lookup.

(b) is preferred — keeps the client thin, lets us iterate on lemmatisation rules without redeploying the SPA.

**Correctness risk:** Some lemma collisions are wrong ("better"→"good" via irregular forms, "axis"→"axe" via false-friend stripping). Need a curated stop-list of inflections we DON'T strip, plus a test suite of ~50 edge cases. Not free; budget a half-day.

**Pre-reqs:** FU-WORD-CACHE-HIT-TRACKING — without it we can't measure whether lemmatisation actually moves the hit rate. If it doesn't (e.g. because students mostly tap nouns in their base form), the build doesn't pay off.

**Definition of done:** Hit rate on a fresh class lift ≥20% vs the non-lemmatised baseline measured via FU-WORD-CACHE-HIT-TRACKING. False-positive collision rate (lemma maps two semantically distinct words to the same key) <0.5% measured against a manual sample of the top-200 hot words.

---

## FU-PROGRESS-COHORT-YEAR — Cohort-year attribution for student_progress (P3)
**Surfaced:** 28 Apr 2026 PM, class-architecture-cleanup §2 resolution
**Captured in:** `docs/decisions-log.md` (28 Apr 2026 PM cohort-scoping decision), `docs/projects/class-architecture-cleanup.md` §2

**Issue:** `student_progress` is keyed on `(student_id, unit_id, page_number)` with no `class_id` column. The Cohort Model decision (RESOLVED 28 Apr 2026) confirmed this is the right schema — sharing progress across class enrollments is correct for the dominant case (mid-year transfers, cohort rotations, etc.). But there's a downstream reporting question this defers: if a teacher ever wants "average progress on CO2 Racer for the 10 Design 2024-25 cohort specifically," the schema doesn't natively answer it.

**Why P3:** No current reporting surface needs this. Filed as a query-layer follow-up so it's not lost when reporting work eventually surfaces it.

**Recommended approach when work happens:** Derive cohort attribution at query time, NOT at schema time. Join `student_progress.created_at` against `class_students.enrolled_at` / `unenrolled_at` ranges for that `(student_id, class_id)` pair. Pseudocode:

```sql
SELECT sp.*, cs.class_id, cs.term_id
FROM student_progress sp
JOIN class_students cs
  ON cs.student_id = sp.student_id
  AND sp.created_at >= cs.enrolled_at
  AND (cs.unenrolled_at IS NULL OR sp.created_at < cs.unenrolled_at)
WHERE cs.class_id = '<target class>'
  AND sp.unit_id = '<target unit>';
```

Edge cases to handle in the query helper (when written):
- Student in two concurrent enrollments → progress row attributes to BOTH (or to the most-specific by some rule — UI/reporting decision)
- Progress created before any enrollment_at (should be impossible but defensive guard)
- Long-running progress that spans multiple enrollments (rare; pick the active enrollment at progress.updated_at if it matters)

**Definition of done:** When the first reporting surface needs cohort-scoped progress, write a `getProgressByCohort(classId, unitId)` helper that does the JOIN above + handles the edge cases. No schema change.

---

## FU-DASHBOARD-HERO-NULL-UNIT-TITLE — Teacher dashboard NowHero renders giant "—" when no unit is assigned (P3) ✅ RESOLVED
**Surfaced:** 30 Apr 2026 PM — during Phase 2.1 Microsoft OAuth smoke, Matt's hero showed colored placeholder bars where the unit title would render.
**Resolved:** 30 Apr 2026 PM — fixed via commit `3cbd273`. Two-part fix:
1. `resolveCurrentPeriod()` (in `src/components/teacher-dashboard-v2/current-period.ts`) now falls back to `cls.units[0]` when the `/api/teacher/schedule/today` entry has `unitId: null` but the class has class_units assigned. Mirrors the today endpoint's own "first unit per class" choice.
2. `NowHero` (in `src/components/teacher-dashboard-v2/NowHero.tsx`) renders an explicit empty state ("No unit assigned. / Pick a unit to teach this class — the hero will fill in.") at smaller typography when `vm.unitId` is null. Previously the component just rendered `vm.unitTitle` (which fell back to `"—"`) inside an h1 sized 100-108px → the giant em-dash looked like colored bars.

**Why this surfaced now:** the bug existed pre-Phase-2 but was invisible because Matt's earlier dashboard always showed a class with assigned units (CO2 Dragster on 7 Design). The Microsoft OAuth smoke happened on a day where Period 1 = 9 Design, which has no class_units rows. Phase 2.1 didn't introduce the bug — it just exercised a code path that hadn't been tripped before.

**Tests:** 2817 passing, no regression. **Verified live in prod:** Matt's hero now renders the new empty state correctly.

## FU-AV2-UI-STUDENT-INSERT-REFACTOR — 4 client-side student INSERT sites need server-side route + auth.users provisioning (P2) ✅ RESOLVED
**Resolved:** 30 Apr 2026 PM — fixed via commit `b35979d`. Built new `POST /api/teacher/students` route with auth + class-ownership check + students INSERT + provisionStudentAuthUserOrThrow + optional class_students enrollment, atomic-ish (rolls back student INSERT on auth provisioning failure). Migrated all 5 INSERT call sites (count was 5 not 4 — re-audit found the additional bulk path in `teacher/students/page.tsx:1015`). Helper `createStudent` + `createAndEnroll` in `src/lib/students/class-enrollment.ts` rewritten as fetch wrappers preserving original "username exists → enroll existing" behavior via the route's 409 response code. 11 new route tests (401/400/403/409 + 2 happy paths + rollback + scrubbing + defaults). Tests: 2806 → 2817 passing. **Architectural impact:** every UI-created student now has auth.users provisioned at create time, not on first login — closes the NULL user_id security window that was only mitigated by Phase 1.2's lazy-provision fallback.

**Surfaced:** 29 Apr 2026 PM, Access Model v2 Phase 1.1d preflight audit
**Captured in:** `docs/projects/access-model-v2-phase-1-brief.md` §4.4 (Phase 1.4 route migration)

**Issue:** 7 sites in the codebase INSERT into the `students` table:

| Server-side (Phase 1.1d wired ✅) | Client-side UI (this FU) |
|---|---|
| `src/app/api/auth/lti/launch/route.ts` | `src/app/teacher/classes/[classId]/page.tsx` |
| `src/app/api/teacher/welcome/add-roster/route.ts` | `src/app/teacher/units/[unitId]/class/[classId]/page.tsx` |
| `src/app/api/teacher/integrations/sync/route.ts` | `src/app/teacher/students/page.tsx` |
|  | `src/lib/students/class-enrollment.ts` (called from client) |

The 4 client-side sites use the browser Supabase client (`createClient()`). They cannot call `auth.admin.createUser()` from the browser — service-role key is server-only. So when a teacher adds a student via these UI flows, `students.user_id` stays NULL until either:

1. **Lazy provision on first login** — Phase 1.2's `/api/auth/student-classcode-login` route detects NULL `user_id` and provisions inline. Already in scope. Idempotent + safe (we only provision after classCode + username verifies).
2. **Manual backfill cron** — could ship as a daily cleanup task, but redundant with #1.

**Why P2 not P1:** lazy provision (#1) closes the security gap for any UI-created student before they can do anything in-app. The remaining concern is operational: a freshly-added student has NULL `user_id` for the time between teacher-add and first-login. RLS policies post-Phase-1.5 should treat this as "auth not provisioned" gracefully. Acceptable transient state for the pilot.

**Why we should still close it (P2 not P3):** The right architecture is server-side INSERT for all student-creation flows. Phase 1.4 (route migration) is the natural place to refactor — when teacher routes get migrated to `requireActorSession()`, the 4 UI INSERT call sites should also move to a new `POST /api/teacher/students` (or similar) route that does insert + provision atomically.

**Recommended approach when work happens (Phase 1.4 sub-step):**

1. Build new server-side route `POST /api/teacher/students` accepting `{ classId, username, displayName, gradYear?, ellLevel?, authorTeacherId }`
   - Verifies teacher owns the class
   - Inserts the student row
   - Calls `provisionStudentAuthUserOrThrow()` from `src/lib/access-v2/provision-student-auth-user.ts` (already wired by Phase 1.1d for the other 3 routes)
   - Returns the inserted student with `user_id` populated
2. Update the 4 UI sites to `fetch('/api/teacher/students', { method: 'POST', body: ... })` instead of direct Supabase INSERT
3. Update `src/lib/students/class-enrollment.ts` similarly — its consumers move to the route
4. Delete the inline INSERT logic from the 4 UI files (Lesson #45 — surgical cleanup of replaced code)

**Definition of done:**
- Zero remaining `from("students").insert(...)` calls in `src/app/teacher/**/*.tsx`
- The new `POST /api/teacher/students` route exists with shape tests
- Verification: `grep -rn 'from("students").*insert' src/app/teacher` returns 0 results

**Related:** Phase 1.1d shipped the server-side helper (`provisionStudentAuthUser`); 3 of 7 sites use it. Phase 1.4 closes the remaining 4. FU-REGISTRY-DRIFT-CI Layer 2 (pre-commit hook) would catch a 5th UI site if added before Phase 1.4 runs.

---

## FU-AV2-PHASE-14B-2 — Migrate remaining 18 GET-only student routes to requireStudentSession (P3) ✅ RESOLVED
**Resolved:** 30 Apr 2026 PM — fixed via commit `77ad01e`. Mechanical auth-helper swap across all 18 routes via Python script. 3 test files updated to mock `requireStudentSession` instead of `requireStudentAuth`. Tests + typecheck clean. Routes still use `createAdminClient()` for data queries (full SSR client switch is a separate piece of work tracked under different scope). All 18 now grant access to `session.userId` + `session.schoolId` per FU's stated benefit.


**Surfaced:** 29 Apr 2026 PM, Access Model v2 Phase 1.4b
**Captured in:** `docs/projects/access-model-v2-phase-1-brief.md` §4.4

**Issue:** Phase 1.4b shipped requireStudentSession migration on 6 GET-only routes as a representative sample. The remaining 18 GET-only routes still call `requireStudentAuth` directly:

| # | File |
|---|---|
| 1 | `src/app/api/student/fabrication/jobs/[jobId]/status/route.ts` |
| 2 | `src/app/api/student/fabrication/jobs/route.ts` |
| 3 | `src/app/api/student/fabrication/picker-data/route.ts` |
| 4 | `src/app/api/student/gallery/feedback/route.ts` |
| 5 | `src/app/api/student/gallery/rounds/route.ts` |
| 6 | `src/app/api/student/gallery/submissions/route.ts` |
| 7 | `src/app/api/student/open-studio/status/route.ts` |
| 8 | `src/app/api/student/safety-certs/route.ts` |
| 9 | `src/app/api/student/safety/badges/[badgeId]/route.ts` |
| 10 | `src/app/api/student/safety/badges/route.ts` |
| 11 | `src/app/api/student/safety/check-requirements/route.ts` |
| 12 | `src/app/api/student/search/route.ts` |
| 13 | `src/app/api/student/skills/cards/[slug]/quiz-status/route.ts` |
| 14 | `src/app/api/student/skills/cards/[slug]/route.ts` |
| 15 | `src/app/api/student/skills/library/route.ts` |
| 16 | `src/app/api/student/tile-comments/route.ts` |
| 17 | `src/app/api/student/unit-pages/[pageId]/skill-refs/route.ts` |
| 18 | `src/app/api/student/unit/route.ts` |

**Why P3:** Phase 1.4a's dual-mode `requireStudentAuth` wrapper means these 18 routes ALREADY accept the new sb-* cookie auth. Migration is purely cosmetic + grants access to `session.userId` + `session.schoolId` (currently unused by these GET routes). No functional regression today.

**Pattern (mechanical, ~2 min per route):**

```typescript
// BEFORE
import { requireStudentAuth } from "@/lib/auth/student";
// ...
const auth = await requireStudentAuth(request);
if (auth.error) return auth.error;
const studentId = auth.studentId;

// AFTER
import { requireStudentSession } from "@/lib/access-v2/actor-session";
// ...
const session = await requireStudentSession(request);
if (session instanceof NextResponse) return session;
const studentId = session.studentId;
// (or alias: const auth = { studentId: session.studentId };
//  to preserve downstream `auth.studentId` references inline)
```

**Definition of done:** `grep -rl "requireStudentAuth" src/app/api/student | xargs grep -l "^export async function GET" | xargs grep -L "^export async function POST\|^export async function PATCH\|^export async function DELETE\|^export async function PUT"` returns empty.

**Sequence:** Do this AFTER Phase 1.4c (Batch B + C) ships, since those touch many of the same files.

**Related:** `FU-AV2-UI-STUDENT-INSERT-REFACTOR` (P2 — different surface; client-side INSERT sites). Phase 1.5 RLS work assumes student auth is via auth.users (which the dual-mode wrapper already provides for these 18 routes).

---

## FU-AV2-PHASE-15B — Phase 1.5b additive student-side RLS policies (4 tables, P2) ✅ RESOLVED
**Resolved:** 30 Apr 2026 — all 4 migrations applied to prod (`20260429133359..133402`). Verified clean via `python3 scripts/registry/scan-rls-coverage.py` — `student_sessions` + `fabrication_scan_jobs` exited the `rls_enabled_no_policy` drift bucket. See spec_drift entries on those tables in `docs/schema-registry.yaml`.

**Surfaced:** 29 Apr 2026 PM, Access Model v2 Phase 1.5
**Captured in:** `docs/projects/access-model-v2-phase-1-brief.md` §4.5

**Issue:** Phase 1.5 shipped 4 critical RLS migrations (1 add + 3 rewrites of broken policies). 4 additional migrations from the brief's §4.5 are deferred to Phase 1.5b — they're additive (lower urgency than the 3 rewrites because admin-client paths still work):

| # | Migration | Purpose |
|---|---|---|
| 1 | `class_students_self_read_authuid` | ADD a parallel "Students read own enrollments" policy that uses `auth.uid()` chain. The existing policy on this table joins through `student_sessions` (legacy auth path) which still works during the grace period. |
| 2 | `student_progress_self_read` | ADD "Students read own progress" — currently no student policy exists; legacy admin-client path is the only access. |
| 3 | `fabrication_scan_jobs_self_read` | ADD "Students read own jobs" — currently `rls_enabled_no_policy` per scanner (one of the FU-FF-class drifts). |
| 4 | `student_sessions_deny_all` | ADD explicit `USING (false)` policy to make intent explicit + close FU-FF officially. Currently `rls_enabled_no_policy` (deny-by-default but undocumented). |

**Why P2 not P1:** these are additive. The current legacy admin-client paths still work for all 4 surfaces. Phase 1.4c routes that switch to RLS-respecting clients will start needing these policies once their batches ship — but Phase 1.4c is also P3 (FU-AV2-PHASE-14B-2 family).

**Pattern (mechanical, ~10 min per migration):**

```sql
-- Pattern for "students read own X via auth.uid() chain"
CREATE POLICY "Students read own X"
  ON <table>
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );
```

For `student_sessions_deny_all`:

```sql
CREATE POLICY "Deny all (service role only)"
  ON student_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);
```

(Service role bypasses RLS regardless; this just makes the deny intent explicit.)

**Definition of done:**
- 4 migrations land on the access-model-v2-phase-1 branch (or its successor)
- Shape tests assert the chain pattern (Lesson #38 — exact USING clause shape)
- Applied to prod via Supabase SQL Editor
- `docs/scanner-reports/rls-coverage.json` shows fabrication_scan_jobs + student_sessions move out of `rls_enabled_no_policy` drift bucket

**Sequence:** ship after Phase 1.5 (this commit) lands in prod and Phase 1.4c routes start migrating to RLS-respecting clients. Could ship before Checkpoint A2 if convenient; otherwise tracks separately.

**Related:** FU-FF (P3 — RLS-as-deny-all on 3 tables), Phase 1.5 (the 3 rewrite migrations that fix broken policies).

## FU-AV2-PHASE-14-CLIENT-SWITCH — Switch student routes from createAdminClient to RLS-respecting SSR client (P2)
**Surfaced:** 30 Apr 2026 — Access Model v2 Phase 1.6 close
**Captured in:** `docs/projects/access-model-v2-phase-1-brief.md` §7 (Checkpoint A2 — Option A scope adjustment)

**Issue:** Phase 1.5 + 1.5b shipped 14 student-side RLS policies via the canonical `auth.uid() → students.user_id → students.id` chain — they're applied to prod but **NOT load-bearing** because the routes that read student data still use `createAdminClient()`, which bypasses RLS entirely. The policies serve as a documented backstop for future client-switch, not as the active line of defense.

For Phase 1 to close cleanly, this is acceptable: app-level filtering (the existing `studentId IN (...)` and `student_id = $1` checks in route code) remains the primary isolation mechanism. But the design intent is for the policies to be load-bearing — that's the whole point of unifying student auth into `auth.users`.

**Why P2 (deferred from Phase 1, not P1):**
- New auth path (Phase 1.2) verified end-to-end in prod-preview — students can log in via Supabase Auth, get sb-* cookies, hit dual-mode-wrapped routes, and receive correct data.
- Existing app-level filtering has been audited (no new gaps introduced by Phase 1).
- Client-switch is route-by-route mechanical work that needs careful smoke testing per surface (no single migration; ~57 routes).
- **Supporting tables don't yet have student-side RLS** — `classes`, `class_units`, `units`, `class_lessons`, etc. need parallel `auth.uid() → teachers/classes` policies before student SSR clients can read them. That's Phase 1.4 client-switch's prerequisite, not Phase 1.5's scope.

**Scope when picked up:**

1. **Audit supporting tables** — list every table the 6 Phase 1.4b migrated routes read (and every table they `JOIN` to). Flag which already have student-side policies (Phase 1.5/1.5b additions) vs which are admin-only.
2. **Author missing supporting-table policies** — `classes_student_via_class_students`, `units_student_via_class_units`, etc. Pattern: student can read row IF they have a row in `class_students` for the relevant class.
3. **Switch routes one batch at a time** — replace `createAdminClient()` with the SSR-aware client (per Lesson docs). Start with a low-risk read-only batch (e.g. the 6 Phase 1.4b routes), smoke-test in prod-preview, then expand.
4. **Smoke per batch** — log in as a real student, hit each route, compare response shape vs admin-client baseline.
5. **Remove dual-mode fallback in Phase 6** — once all routes use RLS-respecting clients AND the front-end is fully on the new login endpoint, drop the legacy `student_sessions` lookup from `requireStudentAuth` (Phase 1.4a wrapper).

**Definition of done:**
- All 63 student routes use the RLS-respecting SSR client (or are deleted).
- Supporting-table policies exist for every table read transitively from a student route.
- Smoke-test plan signed off (one student, one teacher, one cross-school check that returns 0 rows or 404).
- Phase 6 cutover unblocked.

**Sequence:** picks up after Phase 1.6 + 1.7 close Phase 1. Could be done in parallel with Phase 2 (school entity) but probably cleaner to ship Phase 2 first and then do client-switch on the post-Phase-2 schema.

**Related:** FU-AV2-PHASE-14B-2 (P3 — finish the cosmetic GET-route migration), FU-AV2-PHASE-15B ✅ RESOLVED (the policies that this work activates), `docs/security/student-auth-cookie-grace-period.md` (RLS implications section).

## FU-REGISTRY-DRIFT-CI — Registry consultation isn't enforced; drift detection runs only at saveme (P2)
**Surfaced:** 29 Apr 2026 PM, Access Model v2 Phase 1 brief preparation
**Captured in:** `docs/projects/access-model-v2-phase-1-brief.md` §3.7

**Issue:** The 6 saveme registries (`WIRING.yaml`, `schema-registry.yaml`, `api-registry.yaml`, `feature-flags.yaml`, `vendors.yaml`, `ai-call-sites.yaml`) + 3 taxonomies + scanner reports are foundationally good but have known drift surfaces:

1. **Hand-curated entries drift between saveme runs.** Phase 1 brief prep cross-check (29 Apr) found `WIRING.yaml` `auth-system.key_files` listed `src/lib/auth/student-session.ts` — a file that doesn't exist (actual: `student.ts`). Lesson #54 in action: registry claimed something the codebase didn't have.
2. **Phase briefs aren't consulting the registries upfront.** The `build-phase-prep` skill's Step 5 mentions WIRING.yaml but is silent on the other 5 registries. Phase 1 brief was drafted with a code-side audit only; the registry cross-check happened *after* the brief existed, and only because Matt asked. Without that prompt, the brief would have shipped with `auth-system.affects` missing 5 systems and `key_files` still pointing at a non-existent file.
3. **No CI gate.** Drift is caught only when someone runs saveme. Between sessions, branches diverge from registries silently. The registries are themselves an early-warning system that no current process forces consultation of before doing meaningful work.

**Why P2:** Registry drift isn't a bug-shipping risk on its own (the code still works), but it propagates blind spots into every subsequent phase brief that trusts the registries. Phase 1's `student_sessions` RLS-no-policy gap (FU-FF) could have been caught earlier if a CI gate had flagged it; instead it sat as a P3 "likely intentional" until Phase 1 made it load-bearing.

**Recommended approach (3 layers, ordered cheapest → strongest):**

### Layer 1 — Update `build-phase-prep` skill to make registry consultation mandatory
The skill at `.claude/skills/build-phase-prep/SKILL.md` Step 5 currently mentions only WIRING. Extend it:

> **Step 5b — Registry cross-check (mandatory for any phase that touches multiple files).** Before drafting the brief, identify which registries the phase will touch:
> - Migrations or schema changes → read `schema-registry.yaml` entries for affected tables
> - Routes added/modified → read `api-registry.yaml` for current state and auth taxonomy
> - AI calls → read `ai-call-sites.yaml`
> - Feature flags or env vars → read `feature-flags.yaml`
> - New vendor integrations → read `vendors.yaml`
> - PII / data classification → read `data-classification-taxonomy.md`
> - RLS work → read `docs/scanner-reports/rls-coverage.json`
>
> For each consulted registry, spot-check ONE entry against code. If drift found, flag in the brief AND include closure in the phase deliverables.

This is the cheapest change with the highest leverage — it forces the consultation that the Phase 1 brief had to be reminded to do.

### Layer 2 — Pre-commit hook on `docs/projects/` updates
When a brief is committed under `docs/projects/`, a hook runs the registry scanners and warns if drift exists. Doesn't block commits (briefs ship fast), but surfaces drift the moment it's committed.

```bash
# .husky/pre-commit (or equivalent)
if git diff --cached --name-only | grep -q "^docs/projects/"; then
  echo "Brief change detected — running registry scanners..."
  python3 scripts/registry/scan-api-routes.py --check-only
  python3 scripts/registry/scan-rls-coverage.py
  # Don't fail; just warn
fi
```

### Layer 3 — CI gate on registry drift
Add a GitHub Action job that runs all 7 saveme scanners on every PR and **fails CI if any auto-generated registry has drift**. Hand-curated parts (WIRING `affects` lists, schema `spec_drift` entries) can't be auto-checked but the auto-generated halves (api, ai-calls, rls-coverage) can.

```yaml
# .github/workflows/registry-drift.yml
- name: Check api-registry drift
  run: |
    python3 scripts/registry/scan-api-routes.py --apply
    git diff --exit-code docs/api-registry.yaml || exit 1
```

Equivalent jobs for ai-call-sites and rls-coverage. Hard fail = forces saveme before merge.

**Definition of done (each layer):**
- L1: build-phase-prep SKILL.md updated; first phase brief after the update demonstrates the cross-check pattern.
- L2: Pre-commit hook installed; tested by intentionally drifting a registry and confirming the hook warns.
- L3: GitHub Action runs on every PR; tested by a PR that intentionally drifts api-registry; CI fails.

**Sequence:** L1 should ship NOW (before Phase 1 starts) because it gates the very next brief. L2 + L3 are post-Phase-1.

**Related:** Lesson #54 (WIRING claiming things that don't exist), FU-FF (`student_sessions` no-policy was a "likely intentional" P3 that Phase 1 promotes to load-bearing), FU-DD (legacy scanners strip `version:` field on rewrite — same pattern of hand-curated content lost to auto-regeneration).

**Registry freshness baseline (29 Apr 2026 PM):**
- `WIRING.yaml`: 28 Apr (1d old) — known drift on `auth-system.key_files`
- `schema-registry.yaml`: 29 Apr — fresh (saveme today)
- `api-registry.yaml`: 29 Apr — fresh (auto-generated)
- `feature-flags.yaml`: 29 Apr — fresh
- `vendors.yaml`: **14 Apr (15d old)** — stable enums, low risk but oldest
- `ai-call-sites.yaml`: 29 Apr — fresh (auto-generated)
- `data-classification-taxonomy.md`: **14 Apr (15d old)** — stable enums
- `scanner-reports/rls-coverage.json`: 29 Apr — fresh (auto-generated)

## FU-AV2-RLS-SECURITY-DEFINER-AUDIT — Sweep all student-side policies for cross-table recursion (P2) ✅ RESOLVED
**Resolved:** 30 Apr 2026 — comprehensive audit completed. **No remaining cycles** beyond the two already fixed.

**Audit methodology:** For every table T with policies that subquery another table T', checked whether T' has a policy that back-references T (directly or transitively). A cycle requires both ends to subquery into the other; neither was found beyond the two already-fixed cases.

**Audit findings (table-by-table):**

| Table | Subqueries to | Verdict |
|---|---|---|
| `students` | (own column only) | ✅ Direct + SECURITY DEFINER (`is_teacher_of_student` — fixed earlier today) |
| `class_students` | students | ✅ students has SECURITY DEFINER teacher policy — no back-ref |
| `classes` | class_students → students | ✅ class_students teacher policy is SECURITY DEFINER (`is_teacher_of_class` — fixed earlier today) |
| `class_units` | classes | ✅ classes student policy → class_students → students. No back-ref to class_units. |
| `assessment_records` | students, classes | ✅ Neither back-references assessment_records |
| `competency_assessments` | students, class_students, classes | ✅ Triple joins in teacher policy, but no back-ref |
| `design_conversations/_turns` | students, classes | ✅ No back-ref |
| `quest_journeys/_milestones/_evidence` | students (via journey chain) | ✅ No back-ref |
| `student_progress` | students, class_students, classes | ✅ UNION query in teacher policy, but no back-ref |
| `student_badges` | students, classes | ✅ No back-ref |
| `fabrication_jobs/_scan_jobs/_revisions` | students, classes (via own chain) | ✅ Self-contained chain, no back-ref |
| `unit_badge_requirements` | units | ✅ units has only direct policies |
| `gallery_*`, `units`, `class_units` (read) | (permissive) | ✅ No subqueries |

**Why most tables are safe even without rewrites:** A cycle requires policies on BOTH ends to subquery into the other. The teacher-side policies on most tables subquery into `classes` or `students`. Those tables' policies are now either direct comparisons (`auth.uid() = teacher_id`) or SECURITY DEFINER. The student-side policies subquery only "downstream" into students/class_students/classes; nothing on those upstream tables' policies subqueries back into the downstream tables. The `students↔class_students` and `classes↔class_students` cycles were dangerous specifically because `Teachers manage students` had `id IN (SELECT cs.student_id FROM class_students cs ...)` — `students` was upstream-of-itself via `class_students`. Same shape for the second cycle. Both fixed.

**Conclusion:** Phase 1.4 client-switch CS-3 + CS-N can ship without further RLS migration work. The audit IS the safety proof. Lesson #64's operational rule (every future RLS-shipping phase must include an SSR-client smoke as a Checkpoint criterion) still applies — not because of latent recursion, but to catch any new policies introduced in those phases that themselves create cycles with existing ones.

**Optional hygiene follow-up (not filed — captured here):** Introduce `public.current_student_id()` SECURITY DEFINER helper and refactor ~9 student-side policies to use it instead of inlining `(SELECT id FROM students WHERE user_id = auth.uid())`. Pure code-cleanliness, no behavioral change. Can be picked up later as a single hygiene migration if anyone wants the centralization.

**Original (pre-audit) issue text below:**

**Surfaced:** 30 Apr 2026 — Access Model v2 Phase 1.4 CS-2 prod smoke
**Captured in:** `supabase/migrations/20260430010922_phase_1_4_cs2_fix_students_rls_recursion.sql` (the immediate hotfix), this brief

**Issue:** Phase 1.5/1.5b/CS-1 shipped 14+ student-side RLS policies using subqueries of the shape `... IN (SELECT id FROM students WHERE user_id = auth.uid())` (or similar across `class_students`, `student_progress`, etc.). When called from a context where `students` (or any other table on the path) ALSO has a teacher-side policy that subqueries back into the table being queried, Postgres throws:

```
ERROR: 42P17: infinite recursion detected in policy for relation "students"
```

The first cycle (`students` ↔ `class_students`) was hit by CS-2 and fixed via `is_teacher_of_student()` SECURITY DEFINER helper. **Other potential cycles are still latent** — they'll surface as more routes switch to SSR client.

**Why P2:** The latent cycles are blocked-on-discovery, not load-bearing yet. App-level filtering + admin-client paths still work everywhere. Each new SSR-client route is a smoke surface that may or may not surface a cycle.

**Suspected potential cycles (un-audited):**
- `competency_assessments` student policy (Phase 1.5 rewrite) ↔ teacher policies on competency_assessments + students
- `quest_journeys/_milestones/_evidence` student policies (Phase 1.5) ↔ their teacher policies
- `design_conversations/_turns` (Phase 1.5) ↔ teacher policies
- `student_progress_self_read` (Phase 1.5b) — does student_progress have a teacher policy that subqueries students?
- `fabrication_jobs/_scan_jobs` (Phase 1.5b) — same question
- `Students read own enrolled classes` (CS-1) ↔ `Teachers manage own classes`

**Comprehensive fix approach:**

1. **Build a generic `current_student_id()` SECURITY DEFINER helper:**
   ```sql
   CREATE OR REPLACE FUNCTION public.current_student_id()
   RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
   SET search_path = public, pg_temp
   AS $$
     SELECT id FROM students WHERE user_id = auth.uid() LIMIT 1
   $$;
   ```
2. **Audit each Phase 1.5/1.5b/CS-1 policy** — is the subquery into `students` necessary, or can it be replaced with `current_student_id()`?
3. **Rewrite policies one table at a time**, prioritizing tables that have CS-2/CS-3 routes touching them. Document each rewrite as a spec_drift entry on the table.
4. **Add migration shape tests** for each rewrite (Lesson #38 — assert exact USING clause shape).
5. **Define test coverage:** for each rewritten policy, write a SQL impersonation test (`SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub TO '<student-uuid>'; SELECT ...`) that proves no recursion under SSR client semantics.

**Definition of done:**
- Every student-side policy that recurses through students/class_students/etc. either uses a SECURITY DEFINER helper OR uses a column-level comparison that can't recurse.
- All Phase 1.4b + CS-2/CS-3/eventual-CS-N routes return real data, not all-defaults or null, when called via SSR client for an authenticated student.
- A live RLS test harness (FU-HH partial) covers the known-bad patterns.

**Sequence:** ship after CS-2's hotfix lands and CS-3 begins. The first CS-3 route that hits a different cycle dictates which policy gets fixed next.

**Related:** `FU-HH` (no live RLS test harness — would catch this class of bug pre-prod), Phase 1.4 CS-2 brief (where this surfaced), Phase 1.5/1.5b prod-apply session (where the latent bug was authored).

## FU-AV2-UNITS-ROUTE-CLASS-DISPLAY — `/api/student/units` shows wrong class for multi-class units + doesn't filter archived (P3) ✅ RESOLVED
**Resolved:** 30 Apr 2026 PM — fixed via commit `cf37901`. Three changes to the class-picking logic in `src/app/api/student/units/route.ts`: (1) drop the legacy `students.class_id` fallback; (2) filter classes to non-archived BEFORE the class_units lookup; (3) order enrollments by `enrolled_at DESC` and pick the most-recently-enrolled match for each unit. Tests + typecheck clean. Smoke verified test2's response now shows `class_id: a7afd4f3` (Service LEEDers) instead of `82d7fb45` (g9 design archived). Behavior change: archived-class-only units stop appearing — correct since students shouldn't work on units from classes they've been removed from.

**Surfaced:** 30 Apr 2026 — Phase 1.4 CS-3 prod smoke
**Captured in:** This entry (the route works under RLS post-CS-3; the display issue is pre-existing).

**Issue:** `/api/student/units/route.ts` returns each unit with a `class_id` / `class_name` for display in the dashboard card. Two pre-existing bugs in the picker logic, surfaced when CS-3 smoke test inspected the response shape:

1. **Adds `students.class_id` (legacy column) as a fallback to the enrollment set.** This pulls in classes the student is no longer actively enrolled in via `class_students`. Combined with the second bug, this can pick an archived class as the display class when a unit is shared between an active class and an archived legacy class.

2. **Doesn't filter archived classes from the candidate list.** Picks the first matching `class_units` row regardless of whether the class is archived. Same fix as the 28 Apr 2026 archive filter in `resolveStudentClassId` — needs applying here too.

**Symptom:** test2 is in `Service LEEDers` (active) but `students.class_id` legacy column points at `g9 design` (archived). The unit `Arcade Machine Project` exists in BOTH classes via `class_units`. The route picks `g9 design` for display, not `Service LEEDers`. Notably, `progress.class_id` inside the unit DOES correctly resolve to the active class — the bug is in the outer display field only.

**Why P3:** Pre-existing behavior unchanged by CS-3. Display-layer bug, not a security/data-integrity issue. RLS correctly allows test2 to read both classes (she IS in both via class_students junction, just one with `is_active=false`). The fix is route-layer logic, not a policy change.

**Recommended fix:**
1. Drop the `students.class_id` fallback (legacy column scheduled for Phase 6 cutover anyway).
2. Filter `class_students` to `is_active = true` (already done).
3. Filter classes by `is_archived IS NULL OR is_archived = false` when building the display map.
4. When a unit appears in multiple of the student's active enrollments, prefer the most-recently-enrolled class (matches the deterministic tie-break in `resolveStudentClassId`).

**Definition of done:** test2's `/api/student/units` response shows `class_id: "a7afd4f3-..."` and `class_name: "Service LEEDers"` for the Arcade Machine Project, NOT `82d7fb45-... "g9 design"`.

**Sequence:** ship anytime. Self-contained route fix. Could pair with the eventual full CS-N migration (when the 18 unmigrated GET routes from FU-AV2-PHASE-14B-2 ship) since this is logic the route owns directly.

**Related:** Phase 6 cutover removes `students.class_id` legacy column entirely, which auto-fixes this.

## FU-AV2-STUDENT-BADGES-COLUMN-TYPE — `student_badges.student_id` is TEXT not UUID, no FK (P3) ✅ RESOLVED
**Resolved:** 30 Apr 2026 PM — fixed via commit `40a14c5` (migration `20260430042051_student_badges_column_type_uuid_with_fk.sql`). Pre-flight verified 4 rows total, all UUID-shaped, zero orphans against students(id). Migration applied to prod: ALTER COLUMN student_id TEXT → UUID, ADD CONSTRAINT FOREIGN KEY ... ON DELETE CASCADE, DROP+CREATE all 3 policies (`student_badges_read_own` + `student_badges_teacher_read` + `student_badges_teacher_insert`) without `::text` casts. Semantic preserved exactly. Verified post-apply: column type is `uuid`, FK exists with ON DELETE CASCADE, all 3 policies recreated cleanly. Code callers unchanged — postgres-js + supabase-js auto-coerce string UUIDs at the wire format.


**Surfaced:** 30 Apr 2026 — Access Model v2 Phase 1.4 CS-1 prod apply
**Captured in:** `docs/projects/access-model-v2-phase-14-client-switch-brief.md` (CS-1 column-type quirk note in migration 3)

**Issue:** Migration 035 created `student_badges.student_id` as `TEXT NOT NULL` (with the comment "nanoid from student_sessions"), NOT as `UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE`. In practice, production stores text-formatted UUIDs in this column — the teacher-side policy `student_badges_teacher_read` uses `::text` casts on both sides and has worked since 035 shipped. But the schema is still wrong.

This surfaced when the Phase 1.4 CS-1 student-side rewrite migration tried `student_id IN (SELECT id FROM students WHERE user_id = auth.uid())` — Postgres rejected with `operator does not exist: text = uuid`. Fixed by mirroring the teacher policy's `::text` cast in the new policy. The fix works but propagates the column-type drift.

**Why P3:** the workaround (`::text` cast on RHS) works correctly. No data integrity issue today — production rows hold text-formatted UUIDs that compare correctly. The cleanup is hygiene, not security or correctness.

**Recommended approach:**

1. **Pre-flight audit** — query prod to verify all `student_badges.student_id` values can cast to UUID (no leftover nanoid session tokens). One row that fails the cast blocks the migration.
   ```sql
   SELECT student_id FROM student_badges
   WHERE student_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
   ```
   Expected: 0 rows.

2. **Migration:**
   ```sql
   ALTER TABLE student_badges
     ALTER COLUMN student_id TYPE UUID USING student_id::uuid;

   ALTER TABLE student_badges
     ADD CONSTRAINT student_badges_student_id_fkey
       FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
   ```

3. **Drop the `::text` casts** in both `student_badges_read_own` (CS-1's policy) and `student_badges_teacher_read` (migration 035's policy). Rewrite both via DROP+CREATE migrations using the clean column type.

4. **Test:** existing student_badges shape tests + add one asserting the FK exists via `pg_catalog.pg_constraint` (Lesson #62).

**Definition of done:**
- `student_badges.student_id` is `UUID` with FK to `students(id)`.
- Both policies use `student_id IN (SELECT id FROM students WHERE ...)` without casts.
- `pg_catalog.pg_constraint` query confirms the FK exists with `ON DELETE CASCADE`.

**Sequence:** ship after Phase 1.4 client-switch closes (this is a hygiene cleanup; not blocking pilot or any in-flight phase). Could pair with similar audit of other `*_id TEXT` columns if any exist (likely audit reveals more).

**Related:** FU-FF (P3 — RLS-as-deny-all on 3 tables, similar "documented in registry but actual SQL diverges" class), Phase 1.4 CS-1 brief (where this surfaced).

---

## FU-AV2-LTI-PHASE-6-REWORK — `/api/auth/lti/launch` returns 410 pending Supabase Auth rewrite (P2)

**Status:** OPEN — filed 4 May 2026 by Phase 6.1.

**Surfaced:** Phase 6.1 dropped `student_sessions`. The legacy LTI 1.1 launch endpoint created a `student_sessions` row + `questerra_student_session` cookie; with the table gone, the route can't function as written.

**Issue:** `src/app/api/auth/lti/launch/route.ts` was stubbed to return HTTP 410 Gone. NIS pilot does not use LTI launch — the route hadn't been exercised in months — so the 410 is honest about the dead-end without leaving silent breakage.

**Why P2:** any school adopting StudioLoom that wires LTI in their LMS (ManageBac, Canvas, Schoology, Moodle, Toddle, Blackboard) hits the 410. Reinstate before the next school onboarding.

**Recommended approach:** mirror the `/api/auth/student-classcode-login` pattern:
1. Verify the LTI 1.1 OAuth signature (existing `verifyLtiSignature` helper still valid).
2. Resolve `consumerKey → lms_integrations.class_id` (existing `findOrCreateStudent` still valid).
3. Call `provisionStudentAuthUser({...})` to ensure `auth.users` + `students` rows exist (already imported in the original file).
4. Mint a Supabase Auth session via `supabaseAdmin.auth.admin.generateLink({type:'magiclink', email: syntheticEmailForStudentId(student.id)})`.
5. Construct an SSR client with the Next.js cookies adapter and `exchangeCodeForSession(linkData.properties.hashed_token)` to set `sb-*` cookies on the redirect response.
6. Redirect to `/dashboard`.

Reuse the same `syntheticEmail` shape as classcode-login so an existing student logging in via LTI lands on the same `auth.users` row they'd land on via classcode.

**Definition of done:**
- LTI POST returns a 302 redirect to `/dashboard` with `sb-*` cookies set.
- A returning student via LTI ends up on the same `students.id` as via classcode-login (no orphan duplicates).
- Smoke test from a real LMS launch (Canvas test instance or LTI launch simulator) passes once.

**Sequence:** before any school other than NIS adopts. Estimated ~0.5 day if the classcode-login pattern is copy-paste tractable.

**Related:** Phase 6.1 brief §6.1, `src/app/api/auth/student-classcode-login/route.ts` (canonical pattern).

---

## FU-AV2-STALE-TIMETABLE-LINK — `/teacher/timetable` route doesn't exist; nav prefetches it (P3)

**Status:** OPEN — surfaced 4 May 2026 during Phase 6.2 smoke.

**Issue:** Browser console shows `GET /teacher/timetable?_rs=... → 404 (Not Found)` on every Class Hub / Classes list page load. The `?_rs=` query param identifies it as a Next.js React Server Component **prefetch** (triggered by hovering or rendering a Link). Some component still references `/teacher/timetable` even though that page route doesn't exist.

**Why P3:** silent (prefetch failures don't break user-visible behaviour). Just noisy in the console + wasted server hit.

**Recommended approach:**
1. Grep for `/teacher/timetable` in `src/app/teacher/layout.tsx`, the top-nav component, and any sidebar/quick-link panel: `grep -rn "/teacher/timetable" src/`
2. Either (a) remove the dead Link if the timetable feature was scoped out OR (b) restore the route at `src/app/teacher/timetable/page.tsx` if the link is intentional UX.
3. Verify no other dead Link patterns: `grep -rn 'href="/teacher' src/components/ src/app/teacher/layout.tsx | sort -u`

**Definition of done:** no `/teacher/timetable` 404 in browser console on Class Hub / Classes list page loads.

**Sequence:** opportunistic; pair with next teacher-nav cleanup pass.

---

## FU-STUDENT-PROGRESS-CLIENT-400 — client-side `student_progress` query 400s on Class Hub (P3)

**Status:** OPEN — surfaced 4 May 2026 during Phase 6.2 smoke.

**Issue:** Browser console on `/teacher/classes/[classId]` shows `GET cxxbfmnbwihuskaaltlk.supabase.co/rest/v1/student_progress?select=st…ges%2Ctotal_pages&student_id=in.(...) → 400 (Bad Request)`. The truncated `select=` includes `total_pages`, which likely doesn't exist on `student_progress` (or has been renamed). 400 from PostgREST = malformed query (column not found / bad operator), distinct from 401/403 (RLS).

The query is going direct to Supabase (client-side `supabase-js`), not through a Next.js route — so the bug lives in a frontend component, not in any API route I can see in `src/app/api/`.

**Why P3:** doesn't break the page load (the request fails silently and the affected widget probably renders empty); but the column drift means whatever progress widget this powers shows wrong/no data.

**Recommended approach:**
1. Find the caller: `grep -rn 'from("student_progress"' src/components/ src/app/teacher/`
2. Diff its `.select()` against the current `student_progress` schema: `\d student_progress` in psql, or `SELECT column_name FROM information_schema.columns WHERE table_name='student_progress' ORDER BY ordinal_position`.
3. Pick the right column or remove the stale reference.

**Suspected:** a Class Hub progress-bar / completion-summary widget that was written against an old `student_progress.total_pages` column that's now stored elsewhere (e.g., on `units.content_data` page count, or computed). Audit the column lineage in schema-registry.yaml.

**Definition of done:** no 400 on Class Hub page load; the affected widget renders accurate completion percentages.

**Sequence:** opportunistic; pair with next dashboard polish pass.

---

## FU-AV2-API-V1-FILESYSTEM-RESHUFFLE — move route handlers into `src/app/api/v1/<domain>/` directory tree (P3, optional)

**Status:** OPEN — filed 4 May 2026 by Phase 6.3.

**Surfaced:** Phase 6.3 chose Option Z (Next.js `rewrites` in `next.config.ts`) over Option X (literal file moves) for the API versioning seam. Both achieve the same client-facing outcome — `/api/v1/*` works, external clients can pin to it, future `/api/v2/*` has a place to live. Option Z ships in ~30min, Option X is ~3-4h. ADR-013 documents the decision.

**Issue:** The file-system layout doesn't match the canonical URL. Routes live at `src/app/api/teacher/units/route.ts` but the canonical URL is `/api/v1/teacher/units`. This works (rewrite handles it transparently) but creates a cognitive disconnect for anyone reading the codebase.

**When to do this:**
- (a) v2 actually needs to ship with breaking changes (would force the issue: v1 needs its own directory so v2 can exist alongside).
- (b) The cognitive disconnect bothers you when reading code.
- (c) You want to remove the permanent `next.config.ts` rewrite indirection.

If none of these are pressing, leave it. The cost is the same later.

**Recommended approach (when triggered):**
1. Move all 318 `src/app/api/<domain>/*/route.ts` → `src/app/api/v1/<domain>/*/route.ts` (preserve directory structure).
2. Update internal `fetch("/api/<domain>/...")` callers to `/api/v1/<domain>/...` (grep for the patterns, batch-replace per-domain).
3. Update test imports that reference route handlers directly: `from "@/app/api/<domain>/..."` → `from "@/app/api/v1/<domain>/..."`.
4. Flip the `next.config.ts` rewrite direction: `/api/<domain>/:path*` → `/api/v1/<domain>/:path*` (legacy bare paths still work via rewrite for 90 days).
5. Update header rules in `next.config.ts` to mirror the new direction.
6. Sync `api-registry.yaml` paths.
7. Per-domain commits for review tractability (admin / teacher / student / fab / public).

**Definition of done:** route files live under `src/app/api/v1/`; canonical URLs match file paths; bare `/api/<domain>/*` paths still work via redirect; api-registry shows v1 as canonical with bare paths flagged as legacy.

**Sequence:** opportunistic. No deadline. Same cost whenever done.

**Related:** `next.config.ts` API versioning seam comment, ADR-013 (api-versioning).

---

## FU-AV2-CROSS-TAB-ROLE-COLLISION — single Supabase Auth cookie can't hold teacher + student simultaneously (P2)

**Status:** OPEN — surfaced 4 May 2026 during Phase 6 prod testing.

**Issue:** Supabase Auth uses a single `sb-<projectref>-auth-token` cookie scoped to the studioloom.org domain. Teacher login and student-classcode-login both write to the SAME cookie. If a teacher is logged in in one tab and the user opens another tab and logs in as a student (e.g. for QA), the student session **overwrites** the teacher cookie. The teacher tab then makes its next request, the cookies return the student user, and the page either renders broken (no teacher data) or — worst case before Phase 6.3b — kicks off destructive flows like the teacher onboarding wizard.

This was introduced by **Phase 1** (when students moved onto Supabase Auth from the legacy `student_sessions` table). Phase 6.1 dropped the legacy fallback but didn't materially change the collision behaviour — even pre-6.1, the second login would have stomped the first.

Phase 6.3b (this same session) closed the worst hole by adding a `user_type` guard to middleware: `/teacher/*` redirects student sessions to `/dashboard?wrong_role=1`, and `/dashboard /unit /etc` redirects teacher sessions to `/teacher/dashboard?wrong_role=1`. So the wrong-role tab now lands on the right area instead of triggering destructive UI.

**Why P2 (not P1):**
- P1 mitigation already shipped (the user_type middleware guard prevents the worst-case onboarding-wizard scenario).
- Real users hit this almost never (a teacher rarely needs to be logged in as a student in the same browser profile).
- The workaround is trivial: use an incognito window for student testing.

**Recommended fix paths (pick one or layer):**

1. **Wrong-role toast UX (FU-AV2-WRONG-ROLE-TOAST P3):** when `?wrong_role=1` is in the URL, dashboard surfaces a banner: "You're logged in as a student. Sign out to switch to your teacher account." Already supported by the redirect query param.

2. **Tab-scoped session ID (medium effort):** generate a tab-id in sessionStorage on first load; pass it to every auth fetch as a header; server keeps a per-tab session map keyed on that ID. Lets teacher+student coexist in the same browser profile across tabs. Requires a server-side store (Supabase table) and middleware integration.

3. **Browser profile separation (zero effort, doc-only):** publish a "for QA, use a separate browser profile or incognito for student testing" pattern in the team docs. Ships nothing. Probably the right answer for the solo-dev pre-pilot phase.

**Definition of done:** decide which path is worth pursuing. For a pilot of 1 school, path 3 is sufficient. For multi-school + cross-school admins (FU-AV2-PHASE-7), path 2 may be necessary.

**Sequence:** post-pilot. Phase 6.3b's middleware guard makes this no longer pilot-blocking.

**Update 2026-05-16 — Path 1 ✅ shipped + secondary leak closed:**

- **Path 1 (`FU-AV2-WRONG-ROLE-TOAST`) shipped** in PR [#326](https://github.com/mattburto-spec/studioloom/pull/326). `?wrong_role=1` surfaces a dismissable amber banner on both dashboards with role-appropriate sign-out flows.
- **Secondary leak found in smoke + closed in the same session:** Matt was logged in as teacher in Chrome; a prior student-classcode-login had stomped his sb-* cookie (this exact issue). New tab → /dashboard briefly mounted the student layout with `student=null`, and `BoldTopNav` rendered `STUDENT_MOCK` as "Sam · Year 7 · Design" — a name he didn't recognise. Then loadSession()'s student-token check 401'd and bounced to /login. **Two surgical fixes** (PR pending this commit batch):
  1. `STUDENT_MOCK` at [src/components/student/BoldTopNav.tsx:75](src/components/student/BoldTopNav.tsx:75) changed to neutral em-dash placeholders + null classTag + grey gradient. Even if the fallback ever fires, it can't lie about identity.
  2. [src/app/(student)/layout.tsx](src/app/(student)/layout.tsx) now passes `loading={!student}` to `BoldTopNav` so the existing skeleton-pulse UI covers the auth-flash window (was hardcoded `loading={false}`).
  - +7 source-static tests with NC mutation at `src/components/student/__tests__/bold-top-nav-mock-flash.test.ts`. Suite 6516 → 6523, no regressions.
- **Path 3 (browser-profile separation) is the operational recommendation for pre-pilot.** For solo-dev smoke testing on a Chrome with both teacher + student sessions, use a separate Chrome profile OR Firefox container OR incognito window for one of the roles. Path 2 (tab-scoped session ID) remains the architectural fix, deferred until post-pilot or multi-school onboarding.

---

## FU-AV2-WRONG-ROLE-TOAST — surface "wrong role logged in" banner when `?wrong_role=1` (P3) ✅ RESOLVED

**Status:** OPEN → RESOLVED 16 May 2026 (immediately after FU-SEC-TEACHER-LAYOUT-FAIL-OPEN merge; the layout fail-closed fix surfaced this gap during smoke and made closure timely).

**Issue:** Phase 6.3b's middleware redirects wrong-role sessions with `?wrong_role=1` query param. The dashboard pages don't currently consume this — the user lands silently and might not realise their session got switched.

**Resolution:**

1. New `WrongRoleBanner` component at `src/components/shared/WrongRoleBanner.tsx`. Reads `?wrong_role=1` via `useSearchParams`, renders a dismissable amber banner with role-specific copy. Sign-out flows mirror the existing layouts' logout handlers:
   - Student → `DELETE /api/auth/student-session` then `window.location.href = "/login"` (matches `StudentLayout.handleLogout`).
   - Teacher → `supabase.auth.signOut()` then `window.location.href = "/teacher/login"` (matches `TopNav.handleLogout`).
2. Dismiss strips the `wrong_role` param via `router.replace(pathname + preservedQuery)` — preserves other params, prevents the banner from re-showing on hard refresh.
3. Mounted in **both** layouts:
   - `src/app/(student)/layout.tsx` — between `BoldTopNav` and `{children}`.
   - `src/app/teacher/layout.tsx` — inside the `authState === "teacher"` branch only (NOT in the fail-closed placeholder, which would flash a wrong-role banner before the redirect lands).
4. Source-static + NC-mutation tests at `src/components/shared/__tests__/wrong-role-banner.test.ts` (+13 tests, covers component contract + mount points + chrome-vs-placeholder isolation in TeacherLayout).
5. Triggers on TWO redirect surfaces in prod:
   - Middleware Phase 6.3b wrong-role redirect (existing).
   - TeacherLayout / SchoolLayout fail-closed redirect from FU-SEC-TEACHER-LAYOUT-FAIL-OPEN (new, shipped 16 May as PR [#325](https://github.com/mattburto-spec/studioloom/pull/325)).

**Definition of done:** users hitting a wrong-role redirect see a clear explanation + path to recover. ✅

**Tests:** 6503 → 6516 (+13), no regressions. PR: pending (this commit batch).

---

## FU-AV2-CRON-SCHEDULER-WIRE — wire retention + scheduled-hard-delete + cost-alert into Vercel Cron Jobs (P2) ✅ RESOLVED

**Status:** OPEN → RESOLVED 4 May 2026 (post-Phase-6 close).

**Surfaced:** Phase 6 Checkpoint A7 flagged this as the last hard pre-pilot blocker. The 3 cron functions in `src/lib/jobs/` (cost-alert, scheduled-hard-delete-cron, retention-enforcement) existed and were unit-tested but had no production scheduler — without this, the daily AI cost alert never fires, scheduled deletions never get hard-deleted, and retention horizons never trigger.

**Resolution:**

1. **3 GET route handlers** at `src/app/api/cron/<job>/route.ts` — each validates `Authorization: Bearer ${CRON_SECRET}` then delegates to the existing `run()` in the corresponding `src/lib/jobs/*.ts`. Returns `{ ok, job, result, timestamp }` JSON.

2. **`vercel.json`** declares the 3 crons with their schedules:
   - `/api/cron/cost-alert` — daily at 06:00 UTC (= 14:00 Nanjing)
   - `/api/cron/scheduled-hard-delete` — daily at 03:00 UTC (= 11:00 Nanjing)
   - `/api/cron/retention-enforcement` — monthly on the 1st at 04:00 UTC (= 12:00 Nanjing)

3. **Middleware** allows `/api/cron/*` through without student/teacher auth — the bearer-secret check in the handler is the gate.

4. **`CRON_SECRET` registered** in `docs/feature-flags.yaml` as `required: true` (PILOT-BLOCKING). Matt must set this in Vercel project env before the first cron fires; without it every handler returns 401 to Vercel's own cron invocations.

5. **15 auth-gate tests** (5 cases × 3 routes) verify: missing env → 401, missing header → 401, wrong bearer → 401, wrong scheme → 401, correct bearer → 200 with delegated result.

**Matt's remaining one-time setup:**

- Generate a CRON_SECRET (e.g. `openssl rand -hex 32`) and set in Vercel project env vars.
- Redeploy. Vercel auto-detects `vercel.json` `crons` block on next deploy.
- Watch the first cron fire (cost-alert at 06:00 UTC tomorrow) in Vercel dashboard → Logs → filter by path `/api/cron/cost-alert`. Should see `{ ok: true, ... }` response.

**Definition of done:** met. All 3 crons wired with auth, tests passing, vercel.json declared, registry updated.

**Note on AI budget reset:** the original FU description mentioned "ai-budget-reset-cron" as a 4th cron. There is no separate reset cron — Phase 5.2's `atomic_increment_ai_budget()` SECURITY DEFINER function performs the reset INLINE on the next per-student increment when `reset_at < now()`. Lazy reset is correct semantics for this use case (reset triggered by use, not by clock). If a teacher dashboard needs to display fresh `tokens_used_today=0` for inactive students at midnight, that's a separate UX concern (dashboard could compute `now() > reset_at ? 0 : tokens_used_today` at render time). Not pilot-blocking.

---

## FU-DEPS-RESIDUAL-MODERATE-VULNS — 4 moderate npm audit vulns with no clean upgrade path (P3)

**Status:** OPEN — filed 4 May 2026 alongside the post-pilot dependency cleanup.

**Surfaced:** Phase 6 cron-wire commit ran `npm audit`. After Bucket A (`npm audit fix` — closed 2 high-severity) and Bucket B (`npm audit fix --force` — Next 15.3.9 → 15.5.15), 4 moderate vulns remain that npm audit can only "fix" by introducing WORSE breakage:

1. **postcss <8.5.10 (×2 advisories)** — bundled inside Next 15.5.15. Advisory: PostCSS XSS via unescaped `</style>` in CSS Stringify Output. npm audit suggests downgrading to next@9.3.3 — that's 6+ major versions back and would unwind every Phase 1–6 architectural change. **No Next version yet bundles a patched postcss.** Real risk in our app: low — postcss runs at build-time on Tailwind classes; we don't pipe user-controlled data into stylesheets.

2. **uuid <14.0.0 (×2 advisories)** — transitive through `exceljs`. Advisory: missing buffer bounds check in `uuid.v3/v5/v6` when called with a custom `buf` parameter. npm audit suggests downgrading exceljs from ^4.4.0 to ^3.4.0 (already tried — created NEW vulns in fast-csv + tmp). **Real risk in our app: zero** — we use `uuid.v4()` exclusively, never the buf-accepting overloads.

**Recommended approach (post-pilot):**

For the postcss/Next bundling: monitor https://github.com/vercel/next.js/issues for the bundled postcss bump. When Next ships a patched postcss (likely Next 15.5.x or 15.6), `npm audit fix` will close it cleanly.

For the uuid/exceljs chain: wait for either (a) exceljs to bump its uuid dep (track https://github.com/exceljs/exceljs), or (b) audit our actual exceljs usage and consider removing the dep entirely if it's only used in 1-2 export paths (Phase 7 candidate).

**Why P3 not P2:** both vulns require attacker-controlled input down code paths we don't expose. Build-time CSS XSS doesn't apply to a server-rendered Next app with no user-CSS injection. uuid buf overflow doesn't apply when we never pass `buf`.

**Definition of done:** npm audit shows 0 vulns of moderate or higher.

**Sequence:** opportunistic. Re-run `npm audit` quarterly; close when upstream patches land.

---

## FU-LESSON-EDITOR-AUTO-PINNED-SKILL — Lesson editor mounts a default skill on freshly-seeded lessons (P2)

**Status:** OPEN — filed 4 May 2026 during Lever 1 Matt Checkpoint 1.1 smoke.

**Surfaced:** The Lever 1 smoke seed (`scripts/lever-1/seed-test-unit.sql`) wrote a v3 unit with three lessons and assigned it to a freshly-created class (`Lever 1 Smoke Class`). The seed deliberately wrote NO entries to any skills / pinned-skills tables — INSERTs touched only `units`, `classes`, `class_units`. INSERT triggers on `classes` were bypassed via `SET LOCAL session_replication_role = 'replica';` so `seed_lead_teacher_on_class_insert` and `tg_classes_auto_tag_dept_heads_on_insert` did NOT fire either.

Despite that, when Matt opened the seeded unit in the Phase 0.5 lesson editor, every lesson rendered with a "Skills for this lesson" pill pre-populated:

  > **3D Printing: basic setup** [BRONZE]

This skill is unrelated to the unit topic (roller coaster physics → marble run) and was never written to the database by the seed. It's appearing from somewhere in the editor's render pipeline.

**Suspected cause (one of):**

1. **Class-default skill on `classes.framework='myp_design'`** — the editor reads class.framework and pulls a "default first skill" from a skills lookup. Most likely candidate.
2. **Auto-suggest fallback** — when a lesson has zero pinned skills, the editor renders the first matching skill from the catalog as a placeholder until the teacher confirms or removes it.
3. **Stale RPC / cached data** — possible but unlikely given this is a fresh class (created via the smoke seed) with no prior state.
4. **Bug in `SkillsForLesson` component** — defaults to a hardcoded skill ID when the read returns empty.

**Investigation steps:**

- `grep -rn "3D Printing.*basic setup\|3d-printing-basic\|skills.*default\|first.*skill" src/components/teacher/lesson-editor/ src/components/teacher/skills/ src/lib/skills/`
- Check the `pinned_skills` (or equivalent) table on prod for rows referencing the seed class_id `b3534f58-47fe-4830-8a0d-c705f374b23b` or unit_id `80f0f7a9-c225-4b57-8a09-6d752d4ee099`. If empty, the skill is mounted client-side from a default — locate the default.
- Check the lesson-editor render code for skill-pill mounting:
  ```
  grep -rn "Skills for this lesson\|SKILLS FOR THIS LESSON\|pinned.*skill\|3D Printing" src/components/teacher/lesson-editor/
  ```
- Verify `classes.framework` resolution path — does the editor query a `framework_default_skills` lookup table?

**Symptoms to capture before fixing:**

- Take a screenshot of the editor with the auto-pinned skill visible (already in the chat record from the smoke).
- Note the URL: `/teacher/units/80f0f7a9-c225-4b57-8a09-6d752d4ee099/class/b3534f58-47fe-4830-8a0d-c705f374b23b/edit`.
- Note that NO skills appear on the unit's `pinned_skills` table (verify with `SELECT * FROM pinned_skills WHERE unit_id = '80f0f7a9...';` or whatever the actual table is called — schema unknown).

**Why P2 not P1:** doesn't break anything — the skill is informational, not enforced. But it WILL confuse teachers (they'll think they pinned 3D Printing when they didn't), and if the teacher SAVES with the auto-pinned skill displayed, it might persist as a real pin without consent.

**Definition of done:** either (a) the auto-mount logic is removed so empty lessons render with no skills pill, OR (b) the auto-mount renders only a "+ Pin a skill" CTA (not a specific skill), OR (c) the auto-mount is opt-in via an admin setting with a visible "Auto-suggested" badge so teachers can tell it's a default.

**Not Lever 1 territory** — Lever 1 only touched activity prompt fields (framing/task/success_signal) and the surrounding readers. Skill-pinning is an independent system. Filed here because it surfaced during a Lever 1 smoke; pick up alongside the Phase 0.5 lesson editor cleanup.

**Sequence:** before any teacher pilots the lesson editor at scale. Likely 1-2 hour investigation.

---

## FU-AV2-WELCOME-WIZARD-AUTO-CREATE-HARDENING — `/teacher/welcome` auto-creates teacher row + personal school on first visit (P2)

**Status:** OPEN — filed 4 May 2026 after data-cleanup of 3 stray teacher rows + 3 orphan schools.

**Surfaced:** the cross-tab cookie collision (FU-AV2-CROSS-TAB-ROLE-COLLISION) caused 3 student sessions to land on `/teacher/welcome` over the course of the Phase 6 work. The welcome wizard auto-created `teachers` rows + auto-created "personal schools" for each, even though `auth.users.app_metadata.user_type === 'student'` for all 3 (verified in the cleanup diagnostic). Phase 6.3b's middleware guard now redirects student sessions away from `/teacher/*`, preventing new occurrences via THIS trigger — but the wizard's "no questions asked, create the teacher record" behaviour is the underlying hazard.

**Cleanup performed 4 May:** 3 stray `teachers` rows + 3 orphan `schools` rows deleted. `auth.users.user_type` was correctly `'student'` for all 3 (the wizard didn't flip the claim, which is the only reason students could still log in normally afterwards). 1 `auth.users` row (`580f9831...`, orphan with no `students` row) left behind as harmless dead weight — can't log in without class context.

**The actual bug:** `/teacher/welcome` is a destructive flow that mutates state on first GET — creates teacher row, creates school, sets up governance defaults. Any session that reaches it without an explicit "I am a teacher onboarding for the first time" click is hazardous. Today the trigger was cookie collision; tomorrow it could be a misconfigured redirect, a stale link in an email, or an LMS deep-link bug.

**Recommended fix (defence in depth on top of the 6.3b middleware guard):**

1. **Hard guard at the page level:** before any state mutation, the welcome page should verify `session.user.app_metadata.user_type === 'teacher'`. If not, redirect to `/dashboard?wrong_role=1` with the same toast UX as the middleware. This catches the case where the middleware allowed-through (e.g. user_type was `null` from a backfill gap) but the actual user shouldn't see this flow.

2. **Make state creation explicit:** the GET handler should ONLY render the form, never mutate. Move teacher row + school creation into a POST handler triggered by an explicit "Get started" button click. This breaks the "any GET creates state" anti-pattern entirely.

3. **Audit other auto-create-on-first-visit flows:** grep for other pages that create rows on a GET request without explicit user action. Each is a potential cookie-collision hazard.

**Why P2 (not P1):**
- Phase 6.3b's middleware guard already prevents the most likely trigger (cookie collision).
- Cleanup of the 3 affected rows was straightforward (intact `auth.users.user_type` saved us).
- A real student in real prod would only hit this if both Phase 6.3b's middleware AND defence-in-depth (1) failed simultaneously.

**Definition of done:**
- Welcome page checks `user_type === 'teacher'` before any mutation; rejects with the wrong-role redirect otherwise.
- Mutation moved out of GET handler into explicit POST.
- One synthetic test asserting a student session POST'ing to the welcome handler returns 403/redirect, not a teacher row.

**Sequence:** post-pilot. Phase 6.3b is the load-bearing fix; this is hardening on top.

---

## FU-NM-SCHOOL-ADMIN-CENTRALIZATION — School-level NM toggle + centralised principal-facing dashboard (P2)

**Status:** OPEN — filed 4 May 2026 alongside the Lever-MM unit-editor NM-block migration.

**Surfaced:** During the design conversation for moving NM configuration into the lesson editor (sub-phases MM.0B–MM.0G), Matt flagged that the current `teacher_profiles.school_context.use_new_metrics` flag is per-teacher. He'd prefer it to be a school-level admin setting where:
1. A school admin / principal flips one toggle that turns NM on/off across the whole school.
2. NM data (assessments, observations, competency rollups) flows into a **centralised principal-facing dashboard** showing competency progress school-wide, not just per-teacher.

This is a real product capability, not just a UX rename. The data is already per-student (`competency_assessments` table); rolling it up by school is mostly a query + dashboard build.

**Why P2 not P1:** Matt has a Wednesday-class deadline; the per-teacher gate works for the immediate goal of moving NM config into the editor. The principal-dashboard is genuinely a multi-day feature (school-admin role check, competency rollup queries, dashboard page, RLS policies for cross-teacher visibility). Doing it inside the unit-editor migration would blow past Wednesday.

**Suggested investigation steps:**
1. Confirm school-admin role exists and has the right RLS pattern (check Access Model v2 work — did Phase 6 land school-admin?).
2. Decide whether the school-level toggle replaces the per-teacher `school_context.use_new_metrics` (cleaner) or stacks above it (per-teacher can opt OUT, school can opt IN — more flexible). Cleaner wins for v1 unless a teacher has a strong reason to opt out of school-mandated NM tracking.
3. Sketch the principal-dashboard page: aggregate `competency_assessments` joined to `students` joined to `classes` joined to `teachers` joined to `schools`, group by competency × element × class × time-bucket. Pop-art visualisation pattern from existing `NMResultsPanel` likely scales — pop-art per class/teacher/year-level cells.
4. Decide whether competency assignment is school-level too (the principal picks the competency for the whole school) or stays per-unit. School-level competency is much more aligned with how schools actually adopt frameworks; per-unit is cleaner for individual teacher autonomy.

**Definition of done:**
- One school-level toggle (likely `schools.config.use_new_metrics` or similar JSONB column) flips NM availability for the entire school.
- Per-teacher gate becomes derived from the school setting (not directly editable, or only editable to opt-out).
- Principal-facing route at `/principal/nm-dashboard` (or admin dashboard tab) shows school-wide competency rollups with the same pop-art aesthetic as the existing per-class results.
- RLS policies admit a school-admin role to read assessments across teachers in their school.

**Sequence:** post-Lever-MM (this week), gated on Access Model v2 Phase 6 closure (school-admin role must exist first). 2-3 days estimated.

---

## ✅ FU-PROD-MIGRATION-BACKLOG-AUDIT — RESOLVED 11 May 2026 (P1)

**Audit complete + tracker table live.** All 7 phases (A-G) shipped in a single session on 11 May 2026.

- **Truth doc:** [`docs/projects/prod-migration-backlog-audit-2026-05-11-truth.md`](prod-migration-backlog-audit-2026-05-11-truth.md) — 83 migrations probed.
- **Result:** drift was 1 missing row (not the "~10+ missing migrations" originally feared). 76 APPLIED, 4 SKIP-EQUIVALENT, 2 RETIRE, 1 APPLY (`school.governance_engine_rollout` admin_settings).
- **Tracker:** `public.applied_migrations` table created with 81 rows backfilled (79 backfill + 1 hand-patch + 1 manual). Verified via Phase E.2 `phase_e_source_breakdown`.
- **Tooling:** [`scripts/migrations/check-applied.sh`](../../scripts/migrations/check-applied.sh) runs in saveme step 11(h). [`scripts/migrations/new-migration.sh`](../../scripts/migrations/new-migration.sh) prints the apply-reminder banner with the INSERT command. CLAUDE.md "Migration discipline" section updated with the 3 mandates from the brief.
- **Sister FU-EE** (no canonical applied log) closed by the tracker table.
- **Lesson #83** banked.
- **Side FU filed:** `FU-AUDIT-PASS4-CLASSES-DEFAULT-LAB` (P3) — non-blocking gap in the Phase 8-1 backfill's Pass 4. Listed below.

Original 11 May entry preserved below for historical context.

---

## FU-PROD-MIGRATION-BACKLOG-AUDIT — Prod schema has drifted hard from repo migrations (P1)
**Surfaced:** 4 May 2026 during Lever 1 (slot fields) seed work
**Priority:** P1 — prod-state divergence from repo; risk of seeded INSERTs failing or writing to phantom columns
**Target phase:** Before next push that adds columns or RLS policies

**Symptom:** While seeding the smoke-test unit for Lever 1, prod
rejected INSERTs that the repo migrations would suggest are valid.
Probing `information_schema.columns` revealed prod is missing
migration 051 (`unit_type` column) AND much of the Access Model v2
schema (`school_id`, `code`, etc. on tables that the repo claims
have those columns).

**What we know:**
- Some migrations applied to prod, some haven't (no canonical
  applied-migrations log — see sister FU-EE).
- Repo migration files don't equal applied prod schema.
- Probe-based pre-flight checks (Lesson #68) caught it for Lever 1
  but won't catch every future site.
- Access Model v2 work landed huge schema in parallel sessions;
  some of those migrations may not have been applied to prod even
  though they're in the repo.

**Investigation steps:**
1. Audit applied migrations in prod via Supabase dashboard
   (Database → Migrations) vs the `supabase/migrations/` directory.
   List divergences.
2. For each missing migration, decide: apply now, retire (if
   superseded), or leave as known divergence.
3. Cross-check the schema-registry.yaml against
   `information_schema.columns` for the top-traffic tables:
   `units`, `classes`, `class_units`, `students`, `teachers`,
   `schools`, `activity_blocks`, `fabrication_jobs`,
   `machine_profiles`, `fabrication_labs`. Surface every drift.
4. Decide on the canonical applied-log strategy (FU-EE sister) so
   this doesn't recur.

**Definition of done:** (a) divergence list filed, (b) each
divergence resolved (apply / retire / accept), (c) schema-registry
re-synced and `spec_drift` entries closed for resolved cases, (d)
sister FU-EE gets a follow-on (or supersedes this) for the
applied-log permanent fix.

**Sister FU:** FU-EE (no canonical migration-applied log) — this
P1 is the symptom, FU-EE is the underlying systemic issue.

**Update — 11 May 2026 (severity upgraded):** Student-creation
incident traced to this drift. `handle_new_teacher` trigger in prod
was migration-001's buggy version for ~12 days; three fix
migrations (`20260501103415`, `20260502102745`, `20260502105711`)
had never been applied. Hand-patched + codified in
[migration `20260511085324`](../../supabase/migrations/20260511085324_handpatch_handle_new_teacher_skip_students_search_path.sql).
Worse discovery during the trace: `supabase_migrations.schema_migrations`
table doesn't exist in prod at all — there is NO application-level
migration tracking. Only `auth.schema_migrations`,
`storage.migrations`, `realtime.schema_migrations` (Supabase
internal). See [Lesson #83](../lessons-learned.md#lesson-83) for
the systemic implication.

**Build brief filed:**
[`docs/projects/prod-migration-backlog-audit-brief.md`](prod-migration-backlog-audit-brief.md) —
7-phase plan A-G, named Matt Checkpoints, suggests fresh worktree
`questerra-migration-audit` and dedicated session. End-state
includes a `public.applied_migrations` tracking table backfilled
from the audit so this drift class cannot recur.

---

## FU-AUDIT-PASS4-CLASSES-DEFAULT-LAB — Phase 8-1 backfill's Pass 4 didn't propagate to classes.default_lab_id (P3)
**Surfaced:** 11 May 2026, prod-migration-backlog-audit Phase B re-probe
**Priority:** P3 — non-blocking; current platform behaviour unaffected

**Symptom:** During Phase B of the audit, the re-probe of `20260427135108_backfill_fabrication_labs` showed:
- ✅ Pass 1 ran: `fabrication_labs has any row` = 2
- ✅ Pass 2 ran: `machine_profiles.lab_id non-null count` = 18
- ✅ Pass 3 ran: `teachers.default_lab_id non-null count` = 2
- ❌ Pass 4 did NOT propagate: `classes.default_lab_id non-null count` = 0

Pass 4 was supposed to cascade `classes.default_lab_id` from the owning teacher's `default_lab_id` (set in Pass 3). 2 teachers have non-null default_lab_id, so Pass 4 SHOULD have updated their classes. But 0 classes have it set.

**Suspected causes:**
1. Pass 4 was skipped at apply time (e.g. only Passes 1-3 manually run).
2. No eligible classes existed at apply time, and classes created later didn't get backfilled.
3. Pass 4 SQL has a subtle bug — the cascade JOIN didn't match expected rows.

**Investigation steps:**
1. Read `supabase/migrations/20260427135108_backfill_fabrication_labs.sql` Pass 4 SQL to confirm the join logic.
2. Run the Pass 4 SQL ad-hoc against prod and observe row count. If it updates non-zero rows now, the issue was timing (case 2). If still 0, the JOIN is wrong (case 3).
3. If the JOIN is wrong, file a small re-run migration.

**Definition of done:** Either (a) classes.default_lab_id non-null count > 0 after a re-run, OR (b) confirmed Pass 4 is a no-op for the current platform state and the issue is closed as "not needed". Either way, log the resolution in `public.applied_migrations` for the original migration's row.

**Non-urgency:** the platform doesn't appear to use `classes.default_lab_id` in the hot path — this is for future class-level default-lab routing if/when it matters. Won't break anything today.

---

## FU-MIGRATION-CI-CHECK — GitHub Action to block PR merge on applied_migrations drift (P2)
**Surfaced:** 11 May 2026, prod-migration-backlog-audit Phase F+G close-out planning
**Priority:** P2 — last 1% of bulletproofing the migration discipline

**Symptom:** The current safety net for migration drift is `scripts/migrations/check-applied.sh` called from saveme step 11(h). This works IF saveme is run. It does NOT enforce on PRs.

**Risk:** a human (or Claude session) authors a migration in a PR, applies it manually to prod, but forgets to INSERT into `public.applied_migrations`. Saveme catches it eventually, but a PR could land in main before saveme runs.

**Fix:** GitHub Action on PR open/sync that:
1. Lists migrations on the PR branch (`git diff --name-only origin/main...HEAD -- 'supabase/migrations/*.sql' | grep -v down.sql`).
2. Queries prod's `public.applied_migrations` via service-role connection (uses a secret env `SUPABASE_DB_URL`).
3. For each PR migration NOT in `applied_migrations`, posts a PR comment: "Migration X has not been applied + logged to prod yet. Apply + log before merge." 
4. Optionally block merge via required status check.

**Out of scope for the original audit** because it requires GitHub Actions infrastructure + a service-role secret in GitHub. The saveme drift check is the working safety net.

**Definition of done:** Action exists at `.github/workflows/check-applied-migrations.yml`, runs on every PR that touches `supabase/migrations/*.sql`, posts a comment listing missing tracker entries.

**Estimated effort:** ~1-2 hours.

---

## FU-LEVER-1-SEED-IDEMPOTENT — Seed script's units INSERT lacks idempotency guard (P3)
**Surfaced:** 4 May 2026 during Lever 1 smoke
**Priority:** P3 — workflow-friction during repeat seeding; not user-facing

**Symptom:** Re-running `scripts/seed-data/seed-lever-1-test-unit.sql`
creates duplicate units. Matt got 2 during smoke when he ran it
twice.

**Cause:** Seed INSERT on `units` lacks `WHERE NOT EXISTS`-style
guard. Trivial fix.

**Fix:** Wrap in `INSERT ... WHERE NOT EXISTS (SELECT 1 FROM units
WHERE id = '<seed-id>')` or use `ON CONFLICT (id) DO NOTHING` if
the seed sets a stable id.

**Definition of done:** Seed script passes a "run twice, no
duplicates" smoke. ~5 min fix.

---

## FU-SCHEMA-REGISTRY-AUTO-SYNC — Build live introspection mode for schema-registry.yaml (P1)
**Surfaced:** 5 May 2026 during TG.0B prod-apply failure
**Priority:** P1 — manual maintenance has gone significantly stale; next
schema-touching migration will keep walking on landmines until this is fixed
**Target phase:** Before TG.0G (G1 roll-forward backfill) or any future
phase that asserts pre-migration schema state from the registry

**Symptom:** TG.0B migration FAILED on prod with `column 'task_id'
does not exist` because schema-registry recorded
`student_tile_grades` as `status: dropped, columns: {}, applied_date: null`.
Reality on prod: table has been live since 27 Apr 2026 with 26 columns
from 3 applied migrations. Diagnosis revealed the registry was never
updated when the table was created and has gone significantly stale —
not just for this table.

**What we know:**
- `docs/schema-registry.yaml` is purely manually maintained. It has no
  scanner sibling.
- `docs/api-registry.yaml` (266 routes) and `docs/ai-call-sites.yaml`
  (47 calls) DO have scanners that auto-sync on saveme via
  `scripts/registry/scan-api-routes.py` and
  `scripts/registry/scan-ai-calls.py`. Schema-registry has no
  equivalent — it relies on Claude remembering to update on every
  migration, which is exactly the behaviour that drifted.
- `student_tile_grades` is one confirmed drift; `student_tile_grade_events`
  was identified as a sibling drift in the same fix. The full scope
  of staleness across the ~72-table registry is unknown until a
  systematic audit runs.
- Sister FU-EE (no canonical migration-applied log) compounds the
  problem: there's no single source of truth for what's actually
  applied to prod, so a scanner has nothing to compare against
  besides probing `information_schema.columns` directly.
- Sister FU-PROD-MIGRATION-BACKLOG-AUDIT (P1) found prod is missing
  migration 051 + much of Access Model v2 schema, which means the
  scanner needs to introspect prod (not the repo migrations) to be
  trustworthy.

**Investigation steps:**
1. Decide on data source: introspect live Supabase via service-role
   `information_schema.columns` + `pg_catalog.pg_policies` query
   (preferred — captures actual prod state including drift), or parse
   `supabase/migrations/*.sql` lexically (cheaper but inherits FU-EE).
   Recommendation: live introspection, mirror the api/ai scanner
   pattern.
2. Build `scripts/registry/scan-schema-registry.py` modelled on
   scan-api-routes.py: connect via `SUPABASE_SERVICE_ROLE_KEY`,
   pull tables + columns + RLS-enabled flag + policy names, diff
   against `docs/schema-registry.yaml`, write
   `docs/scanner-reports/schema-registry.json` for review, optionally
   `--apply` to write back to yaml (preserve manual `purpose` +
   `notes` + `spec_drift` blocks).
3. Wire into saveme step 11 (sync registries) — replace the current
   "manual review the session's migrations" step.
4. Backfill: run scanner against current prod, review the diff,
   commit a one-shot resync to fix accumulated drift across the
   ~72 tables. Treat as a sister cleanup PR after the scanner ships.

**Definition of done:** (a) scanner script exists and runs in CI,
(b) `docs/scanner-reports/schema-registry.json` produced on saveme,
(c) one-shot backfill PR resyncs all stale entries, (d) saveme step
11(a) updated to "rerun scanner, no-op if no diff" matching
api-registry/ai-call-sites pattern, (e) `student_tile_grades` no
longer needs manual `spec_drift` entries to track this kind of drift.

**Sister FUs:**
- FU-EE (no canonical migration-applied log) — gates trustworthy
  diff comparisons; live introspection sidesteps it.
- FU-BB (schema-registry scanner misparses compound ADD COLUMN
  migrations) — the existing partial scanner referenced there has
  a parse bug; replace it with the live-introspection approach
  rather than fix it.
- FU-PROD-MIGRATION-BACKLOG-AUDIT (P1) — once this scanner ships,
  rerun against prod to surface the rest of the migration backlog.
- FU-AA (drop deprecated own_time_* tables from schema-registry) —
  systematic resync would surface this and similar zombie entries.

---

## FU-LESSON-SIDEBAR-LAYOUT — Move Editing/History/Class-Settings out of left column (P2)
**Surfaced:** 5 May 2026 during TG.0C smoke
**Priority:** P2 — UX-blocker for lessons-list visibility once Tasks panel landed; not a regression but the column is now over-stuffed
**Target phase:** Before TG.0D ships (TG.0D will further crowd the right-side editor area, so left column needs breathing room first)

**Symptom:** With the Tasks panel mounted between the unit thumbnail and the lesson list, the left sidebar (`w-64` / 256px) is now stuffed with 6 zones in this order:
1. Unit thumbnail (was 16:9 = ~144px tall; reduced to 16:5 = ~80px in TG.0C polish)
2. Tasks panel (TG.0C — new)
3. Unit title strip (LessonSidebar header)
4. **Editing** — All-classes vs This-class radio (~80px)
5. Lessons list (the actual primary surface — scroll-bounded)
6. **History** — version list (~30–60px depending on count)
7. **Class Settings** + **Apply to All Classes** button (~80px)

User can only see ~2 lessons at a time on a typical screen. Adding even more to the panel (lesson chips for tasks in TG.0E) makes it worse.

**What we know:**
- All 3 of the candidate moves (Editing, History, Class Settings) are unit-level chrome, not per-lesson actions. They don't need to be visible while editing a single lesson.
- Editing radio is the most-used (toggles "All classes" vs "This class only" — affects every save). Could move to the editor's top bar near the save status indicator.
- History is rarely-used (read-only browse). Could be a popover triggered by a clock icon in the top bar.
- Class Settings + "Apply to All Classes" are infrequent. Could be a kebab/cog menu.

**Investigation steps:**
1. Audit the LessonSidebar.tsx file — count lines per section, identify which functions own each zone (radio handlers, fork-promote handlers, etc.).
2. Look at LessonHeader.tsx (the editor's top bar) — does it have space for the Editing radio? Or should we add a compact dropdown there?
3. Mock the new layout in plain HTML before refactoring. Validate that with Tasks + lesson chips visible, the lessons list still gets ≥4 visible at default zoom.
4. Decide: keep history + class-settings inline (compressed) vs move to popover/menu? Inline-compressed is less work; menu is cleaner.

**Definition of done:** (a) Editing radio moved to top bar or hidden behind a compact toggle, (b) History accessible but not always-rendered (popover or click-to-expand), (c) Class Settings + Apply-to-All in a menu, (d) ≥4 lessons visible by default in `w-64` sidebar with Tasks panel mounted, (e) no functional regression on fork-promote / version-restore / class-switching.

**Sister:** TG.0E (lesson card "Builds toward..." chip) will add 1 more line per lesson card; this FU has to land first or the lessons list visibility gets worse.

**Smoke evidence:** Matt's TG.0C smoke screenshot 5 May 2026 — only 2 lessons visible (A: Investigate, B: Develop) with the rest scrolled out of view.

