# Class DJ — Algorithm Specification (Locked Constants)

**Project:** Class DJ Activity Block — Phase 1 deliverable
**Locked:** 13 May 2026
**Source code:** [`src/lib/class-dj/algorithm.ts`](../../src/lib/class-dj/algorithm.ts)
**Tests:** [`src/lib/class-dj/__tests__/algorithm.test.ts`](../../src/lib/class-dj/__tests__/algorithm.test.ts) (36 tests, captured-truth fixtures)
**Simulator:** [`scripts/class-dj-simulator.ts`](../../scripts/class-dj-simulator.ts) (`npx tsx scripts/class-dj-simulator.ts all`)
**Brief reference:** [`docs/projects/class-dj-block-brief.md`](../projects/class-dj-block-brief.md) §3.5 (5-stage pipeline) + §3.6 (fairness ledger semantics)
**Research basis:** [`research/class-dj-research.md`](../../research/class-dj-research.md) §2 (algorithm spec) + [`research/class-dj-academic-survey.md`](../../research/class-dj-academic-survey.md) (24 citations)

---

## What's locked

The deterministic core of Class DJ — Stages 0, 1, 2, and 4 of the 5-stage pipeline. Stages 3 (LLM candidate-pool generation) and 5 (LLM narration) are intentionally not in scope; they ship in Phase 5 and are gated by the constants here.

**The LLM never ranks.** Aggregation, conflict detection, and selection are pure deterministic code seeded by `sha256(class_id || class_round_index || suggest_count)`. Re-rolls within a round are replayable: same seed → same picks.

If any constant in this doc changes, **all captured-truth test fixtures break and must be re-captured** by running the simulator + updating the assertions. This is by design — see §"How to retune" below.

---

## Locked constants

All constants live in `ALGO_CONSTANTS` in [`src/lib/class-dj/types.ts`](../../src/lib/class-dj/types.ts). The test "locked constants" suite guards against accidental edits.

| Constant | Value | Citation / rationale |
|---|---|---|
| `ENERGY_KERNEL_SIGMA` | **1.0** | Width of the gaussian kernel over energy 1–5. σ=1 means a candidate at energy 3 partially satisfies energy-2 + energy-4 voters (≈0.61 each). Research synthesis §2.2; MusicFX-adjacent. |
| `KMEANS_K` | **2** | Two-faction detection. Pol.is paper uses adaptive k (silhouette-driven up to 5); for Class DJ's 60-second classroom we lock k=2 — focus vs fun is the canonical split. Small et al. 2021. |
| `SILHOUETTE_SPLIT_THRESHOLD` | **0.5** | Above this silhouette score, the room is treated as split (1 pick per cluster + 1 bridge). At-or-below this, consensus mode (top 3 by squared score + MMR). Maene et al., FAccT 2025. |
| `SMALL_GROUP_N` | **8** | Below n=8, k-means is unstable. Skip clustering entirely; always small_group mode with linear scoring instead of MusicFX squared. JQBX took years to learn this; we land it on day 1. |
| `MMR_LAMBDA` | **0.7** | Balance between relevance (score²) and intra-list diversity (max similarity to already-picked). 0.7 leans heavier on relevance. Carbonell & Goldstein, SIGIR 1998. |
| `EMA_ALPHA` | **0.3** | Exponential moving average on `servedScore`. α=0.3 means ~3-round half-life — a student unserved 3 rounds in a row picks up significant voice_weight; aligned 3 in a row drops back to baseline. Stratigi et al. 2021 / ADAPT framework. |
| `VOICE_WEIGHT_MIN` | **0.5** | Lower clamp on per-student voice weight. Consistently-served students float down to half-weight. |
| `VOICE_WEIGHT_MAX` | **2.0** | Upper clamp. Consistently-unserved students float up to double-weight. Provable bound: no student loses more than ~5 consecutive rounds before their weight crosses any other student's. |
| `RECENCY_PENALTY` | **0.5** | Multiplicative penalty on candidates matching a recent pick's (mood overlap + energy within ±1). Mehrotra et al. 2022 ("Mostra") — variant of the MusicFX recency rule. |
| `FAIRNESS_CREDIT` | **0.1** | Pareto-axis bump for candidates whose `seedOrigin` is an unserved student. Soft signal, not a hard override. |
| `FAIRNESS_CREDIT_SERVED_THRESHOLD` | **0.4** | Students with `servedScore < 0.4` qualify as "unserved" for the fairness credit. Threshold below default 0.5 — only meaningfully-underserved students get the bump. |
| `SOFT_PENALTY_VETO_COUNT_THRESHOLD` | **6** | When persistent_veto count > this, the veto filter switches from hard-eliminate to soft-penalty. Prevents the constraint set monotonically growing into "nothing is playable" by week 10. Brief §5.4 ⚠️. |
| `SOFT_PENALTY_MULTIPLIER` | **0.3** | When soft-penalty fires, matched candidates' score² × this instead of being zeroed. Algorithm "apologises" rather than fails. |
| `CONSENSUS_SEED_THRESHOLD` (computed) | **`max(3, ceil(n/4))`** | Seed must be echoed by this many students to count as consensus. At n=10 → 3; at n=30 → 8. Scales with class size. |

## PRNG seed formula

```
prng_seed = sha256(class_id + "||" + class_round_index + "||" + suggest_count)
```

Returns a 64-char hex string. The first 32 bits seed a Mulberry32 PRNG used for the deterministic display-order shuffle in Stage 4.

**Why this matters:** if the teacher hits "Try another 3" without changing votes, the new `suggest_count` produces a different seed → potentially different display order. But Stages 1, 2, 4 produce identical rankings — only the cosmetic shuffle changes. If the underlying picks need to change (e.g., "different artists, same vibe"), Stage 3 LLM is invoked with `exclude_names = [previous picks]`.

## Veto matching semantics

The veto filter uses **word-boundary regex matching**, not naive substring. This means:

- ✅ `"indie folk"` veto matches a candidate with `contentTags: ["indie folk", ...]` — phrase appears as a complete unit
- ✅ `"country"` veto matches `contentTags: ["country", "folk"]` — word boundary at start + end
- ❌ `"indie folk"` veto does NOT match `contentTags: ["psychedelic", "indie", "dreamy"]` — "indie" is a separate word, not "indie folk"
- ❌ `"k-pop"` veto does NOT match `contentTags: ["classic rock", "pop"]` — "pop" is a different word than "k-pop"

Veto match is checked against `[candidate.name, ...contentTags, ...moodTags]` (all normalised lower-trimmed and joined with `" | "` delimiter).

In **small_group mode** (n<8), a single voter's veto fires the filter — there is no "unanimity" softening. The rationale: in a class of 3, one veto is 33% of the room, which is louder than 1-of-30 in a large class. Brief §3.5 small-group mode rule.

In **soft-penalty mode** (persistent_veto count > 6), matched candidates are NOT eliminated — instead their score² is multiplied by `SOFT_PENALTY_MULTIPLIER` (0.3). The algorithm "apologises" for picking a vetoed candidate rather than failing to pick anything.

---

## 6 canonical scenarios — captured truth

The simulator script can reproduce each. Run `npx tsx scripts/class-dj-simulator.ts scenario:N` to see the full breakdown.

### Scenario 1 — Pure consensus

- **Votes:** n=10, all `mood=focus energy=3`, no vetoes, no seeds
- **Conflict mode:** `consensus` (silhouette = 0.0)
- **Top picks (MMR-selected then prng-shuffled):** Lo-Fi Beats (score² 10000) · Bon Iver (3678.79) · Khruangbin (10000)
- **Behaviour confirmed:** Lo-Fi Beats and Khruangbin both score² 10000 (perfect focus + energy 3 match); MMR picks them + Bon Iver for content-tag diversity over Studio Ghibli (which ties Bon Iver at 3678.79).

### Scenario 2 — Bimodal split

- **Votes:** n=10, 5× `focus/e2` + 5× `fun/e5`
- **Conflict mode:** `split` (silhouette = 1.0 — perfect separation)
- **Clusters:** 5 focus voters / 5 fun voters
- **Top picks:** Charli XCX · **Phoebe Bridgers [bridge]** · Bon Iver
- **Behaviour confirmed:** candA = Bon Iver (focus-cluster argmax, in-cluster score² 625) · candB = Charli XCX (fun-cluster argmax, in-cluster score² 625) · bridge = first eligible non-(A/B) candidate when no candidate scores >0 in both clusters (the deeply-polarised case — no genuine bridge exists in this fixture pool). `bridgeIndex = 1` after deterministic shuffle.

### Scenario 3 — Small group n=3

- **Votes:** 1× `focus/e2 + veto:"indie folk"`, 1× `build/e3`, 1× `vibe/e3`
- **Conflict mode:** `small_group` (clustering skipped at n<8)
- **Veto effect:** Phoebe Bridgers + Bon Iver + Sufjan Stevens eliminated (their `contentTags` include "indie folk"). Tame Impala (`contentTags: [psychedelic, indie, dreamy]`) survives — word-boundary matcher correctly distinguishes "indie folk" the phrase from "indie" alone.
- **Top picks (linear scoring):** Khruangbin (3 × 2.607 = 7.82) · The Beatles (2 × 2.607 = 5.21) · Tame Impala (2 × 2.607 = 5.21)
- **Behaviour confirmed:** Linear scoring instead of squared. Veto fires on any 1 vote (no unanimity softening in small_group).

### Scenario 4 — Consensus with country veto

- **Votes:** n=10, 8× `focus/e3` no veto, 2× `focus/e3 + veto:"country"`
- **Conflict mode:** `consensus`
- **Veto effect:** Kacey Musgraves (country-folk-pop) and Johnny Cash (country-classic) both eliminated (score² 0).
- **Top picks:** Khruangbin · Bon Iver · Lo-Fi Beats (all veto-clear)
- **Behaviour confirmed:** Hard-filter veto in normal mode. None of the picks have "country" in their content tags.

### Scenario 5 — Consensus seed

- **Votes:** n=10, all `vibe/e2` uniformly; 6 students seed `"Phoebe Bridgers"`
- **Conflict mode:** `consensus` (silhouette = 0.0)
- **Consensus seed:** `"phoebe bridgers"` detected with 6 echoes (threshold = `max(3, ceil(10/4)) = 3`)
- **Top picks:** Beach House · Studio Ghibli · Phoebe Bridgers (all score² 10000)
- **Behaviour confirmed:** Consensus seed correctly detected. 5 candidates tie at score² 10000 (vibe match + energy 2 perfect): Phoebe Bridgers, Bon Iver, Studio Ghibli, Beach House, Sufjan Stevens. MMR picks 3 with maximum tag diversity. Fairness credit doesn't fire here (cold start, all students have default servedScore = 0.5, not < 0.4).

### Scenario 6 — Recency penalty

- **Votes:** Same as scenario 1 (n=10, all `focus/e3`). `recent_suggestions = [Lo-Fi Beats]` from prior round.
- **Conflict mode:** `consensus`
- **Top picks (penalised):** Bon Iver (1839.40) · Lo-Fi Beats (5000.00) · Khruangbin (5000.00)
- **Behaviour confirmed:** Recency penalty fires on Lo-Fi Beats (exact match: focus mood + energy 3), Khruangbin (focus overlap + energy 3 exact), and Bon Iver (focus overlap + energy 2 within ±1). All three score² values halved. Set of picks unchanged from scenario 1 because no non-focus candidate scores high enough to displace them after penalty — but `prng_seed` differs (`classRoundIndex=2`), so display order shuffles differently.

---

## How to add a 7th scenario

1. Add the scenario to `SCENARIOS` in [`scripts/class-dj-simulator.ts`](../../scripts/class-dj-simulator.ts) with a descriptive key.
2. Run `npx tsx scripts/class-dj-simulator.ts scenario:7` to capture truth.
3. Inspect the output by hand — does the algorithm behave as you'd expect for this vote pattern? If not, the algorithm has a bug OR the scenario is testing an edge case the algorithm doesn't handle yet — both are findings.
4. If behaviour matches intent: add an `it("scenario 7 — …")` block to [`src/lib/class-dj/__tests__/algorithm.test.ts`](../../src/lib/class-dj/__tests__/algorithm.test.ts) with `toEqual` / `toBeCloseTo` assertions against the captured values. **Never write shape-only assertions** (`toBeDefined()`, `toBeGreaterThan(0)`) — Lesson #38.
5. Document the captured truth in this file under "6 canonical scenarios" (rename to 7).

## How to retune a constant

Don't. Until rollout telemetry justifies it. The current values are research-backed (each row in §"Locked constants" has a citation) and the captured-truth fixtures lock them. Retuning is `FU-DJ-FAIRNESS-TUNING` work — schedule it post-pilot.

If you DO need to retune:

1. Identify the specific failure mode telemetry exposed (e.g., "fairness EMA reacts too slowly to a quiet student"). Document it in the FU.
2. Propose the new value with a stated trade-off (what does this fix? what does it potentially break?).
3. Run the simulator on all 6 (or N) canonical scenarios. Capture new truth.
4. Update **both** [`src/lib/class-dj/types.ts`](../../src/lib/class-dj/types.ts) (the constant in `ALGO_CONSTANTS`) AND [`src/lib/class-dj/__tests__/algorithm.test.ts`](../../src/lib/class-dj/__tests__/algorithm.test.ts) (every captured value the constant affects).
5. Update this doc's "Locked constants" table with the new value + a new citation row pointing to the telemetry / FU.
6. Run `npm test` — all 36+ Phase 1 tests must pass against the new captured truth.

The friction is the point. A constant change that doesn't go through this process is a silent algorithmic regression.

---

## Performance budget

- **Target:** end-to-end pipeline (sanitise + aggregate + detect + select + ledger update) under 100ms at n=30.
- **Captured:** ~5–8ms typical (tested in `performance budget` test block).
- **Tested at:** n=30 with 17-candidate pool, all heuristics active. The k-means O(n² × dim × iters) is the bottleneck but trivial at n=30.

If you ever see >50ms at n=30, profile k-means + silhouette first — they're the only loops doing real work.

## What Phase 1 does NOT do

- **No LLM calls.** Stages 3 + 5 ship in Phase 5.
- **No DB.** Stages 1, 2, 4 are pure functions. Phase 2 mints the schema.
- **No UI.** Phase 4 + 6 build the components.
- **No API routes.** Phase 4 wires the routes that consume this algorithm.
- **No Spotify enrichment.** Phase 5 adds the candidate validation + album-art fetch.
- **No moderateAndLog.** Phase 4 wires `sanitiseInput` to the moderation pipeline; here it's just string-shaping.

## Phase 1 sign-off (Matt Checkpoint M-DJ-1A)

This document, the algorithm code, and the captured-truth tests together constitute the Phase 1 deliverable. Sign-off conditions:

- [x] All 36 Phase 1 tests pass.
- [x] Captured truth from one real simulator run per scenario (Lesson #38).
- [x] Performance at n=30 under 100ms (actually ~5–8ms).
- [x] PRNG determinism verified (same seed = same picks across 100 runs).
- [x] All ALGO_CONSTANTS values documented with citation/rationale.
- [ ] Matt reviews the 6 scenarios + confirms behaviour matches intent.

Once Matt ticks the last box, Phase 2 (schema migration + activity_blocks library seed) becomes the next phase.
