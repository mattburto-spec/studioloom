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

## FU-FF — Undocumented RLS-as-deny-all pattern on 3 tables (P3)

**Filed:** 14 Apr 2026
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

## FU-O — No co-teacher / dept head / school admin access model

**Surfaced:** Phase 6 Checkpoint 5.1 Step 9 (14 Apr 2026)
**Target phase:** Post-Dimensions3 architecture phase ("Loominary OS Access Model")
**Priority:** P1 (hard blocker for school deployments — no sales past first teacher)

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

## FU-P — No school / organization entity (flat teacher→class→student hierarchy)

**Surfaced:** Phase 6 Checkpoint 5.1 review (14 Apr 2026)
**Target phase:** Post-Dimensions3 architecture phase (pairs with FU-O)
**Priority:** P1 (table stakes for MAT/district deployments)

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

## FU-R — Auth model split (teacher Supabase Auth vs student custom token sessions)

**Surfaced:** Phase 6 Checkpoint 5.1 review (14 Apr 2026)
**Target phase:** Post-Dimensions3 architecture phase
**Priority:** P1 (every new cross-role feature has to bridge)

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

## FU-Library-B3 — Relocate `extractDocument` to shared location (P3)
**Surfaced:** Library Card File Upload Phase A (14 Apr 2026)
**Target phase:** Post-Library Phase B

**Issue:** `extractDocument` lives in `src/lib/knowledge/extract.ts` but is now consumed by both the knowledge/ingestion pipeline AND the unit-conversion/import pipeline. Its current location implies it belongs to the knowledge subsystem, but it's a general-purpose utility.

**Suggested investigation:**
1. Move `extractDocument` to `src/lib/extract/` or `src/lib/shared/extract.ts`.
2. Update all import sites (ingest route, import route, knowledge pipeline).
3. Verify tests still pass.

**Definition of done:** `extractDocument` lives in a location that doesn't imply ownership by knowledge subsystem. All consumers updated.
