/**
 * Class DJ — Algorithm (Stages 0, 1, 2, 4)
 *
 * Phase 1 deliverable. Pure deterministic code per the 5-stage pipeline
 * specified in docs/projects/class-dj-block-brief.md §3.5. Stages 3 + 5
 * (LLM candidate pool generation + narration) are out of scope and ship
 * in Phase 5.
 *
 * No I/O. No LLM calls. No DB calls. No fetch. No React.
 *
 * Citations live in research/class-dj-research.md §2 (algorithm spec) and
 * research/class-dj-academic-survey.md (full literature trail).
 */

import { createHash } from "node:crypto";
import {
  ALGO_CONSTANTS,
  type AggregatorInput,
  type AggregatorOutput,
  type Candidate,
  type ConflictDetectionOutput,
  type ConflictMode,
  type ConsensusSeedAnalysis,
  type FairnessLedgerEntry,
  type Mood,
  type RawVoteInput,
  type ScoredCandidate,
  type SelectionInput,
  type SelectionOutput,
  type Vote,
} from "./types";

const MOOD_ORDER: Mood[] = ["focus", "build", "vibe", "crit", "fun"];

// ---------------------------------------------------------------------------
// Stage 0 — Input sanitisation
// ---------------------------------------------------------------------------

/**
 * Strip injection vectors + truncate free-text inputs. Does NOT call
 * moderateAndLog — that's a Phase 4 API-layer concern. Stage 0 here is
 * just deterministic string-shaping.
 */
export function sanitiseInput(raw: RawVoteInput): Vote {
  const clean = (s: string | null | undefined): string | null => {
    if (s === null || s === undefined) return null;
    let cleaned = String(s);
    // Strip prompt-injection prefixes case-insensitively.
    cleaned = cleaned.replace(/system:/gi, "");
    cleaned = cleaned.replace(/assistant:/gi, "");
    cleaned = cleaned.replace(/user:/gi, "");
    // Strip closing tag-like sequences that could escape delimiter wraps.
    cleaned = cleaned.replace(/<\//g, "");
    // Strip ASCII control characters (kept Unicode + emoji).
    cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, "");
    cleaned = cleaned.trim().slice(0, 80);
    return cleaned.length > 0 ? cleaned : null;
  };
  const energy = Math.max(1, Math.min(5, Math.round(raw.energy)));
  return {
    studentId: raw.studentId,
    mood: raw.mood,
    energy,
    veto: clean(raw.veto),
    seed: clean(raw.seed),
    vetoFlagged: false,
    seedFlagged: false,
  };
}

// ---------------------------------------------------------------------------
// Stage 1 — Aggregation
// ---------------------------------------------------------------------------

function gaussian(x: number, mu: number, sigma: number): number {
  const dx = x - mu;
  return Math.exp(-(dx * dx) / (2 * sigma * sigma));
}

function voiceWeightFor(studentId: string, fairness: FairnessLedgerEntry[]): number {
  const entry = fairness.find((f) => f.studentId === studentId);
  return entry?.voiceWeight ?? 1.0;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Returns true if any of the candidate's content tags / mood tags / name
 * matches any of the veto strings. Uses WORD-BOUNDARY matching, not naive
 * substring, so "k-pop" does NOT match "pop", "classical" does NOT match
 * "classic rock", etc. The veto string is treated as a phrase that must
 * appear as a complete word/phrase in the haystack.
 */
function candidateMatchesVeto(candidate: Candidate, vetoes: Set<string>): boolean {
  if (vetoes.size === 0) return false;
  const haystack = [
    normalize(candidate.name),
    ...candidate.contentTags.map(normalize),
    ...candidate.moodTags.map(normalize),
  ].join(" | ");
  for (const veto of vetoes) {
    if (!veto) continue;
    const escaped = veto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // \b enforces word boundary; "k-pop" matches "k-pop" but not "pop".
    const re = new RegExp(`\\b${escaped}\\b`);
    if (re.test(haystack)) return true;
  }
  return false;
}

/**
 * Stage 1 — produce ScoredCandidate per input candidate.
 *
 * mood_score   = Σ_students voice_weight[s] × 1{candidate.moodTags ⊇ student.mood}
 * energy_fit   = Σ_students voice_weight[s] × gaussian(candidate.energyEstimate, s.energy, σ)
 * score²       = mood_score² × energy_fit²
 *
 * Veto handling:
 *   - normal mode: matched candidates have score2 = 0 and vetoCleared = false
 *   - soft-penalty mode (persistentVetoes.length > SOFT_PENALTY_VETO_COUNT_THRESHOLD):
 *     matched candidates have score2 × SOFT_PENALTY_MULTIPLIER and vetoCleared = true
 */
export function aggregate(input: AggregatorInput): AggregatorOutput {
  const { votes, candidates, fairness = [], persistentVetoes = [] } = input;

  // Build vetoes-this-round + persistent vetoes set (normalised lower-trimmed).
  const allVetoes = new Set<string>();
  for (const v of votes) {
    if (v.veto && !v.vetoFlagged) allVetoes.add(normalize(v.veto));
  }
  for (const pv of persistentVetoes) {
    allVetoes.add(normalize(pv));
  }

  const vetoSoftPenaltyActive =
    persistentVetoes.length > ALGO_CONSTANTS.SOFT_PENALTY_VETO_COUNT_THRESHOLD;

  const scored: ScoredCandidate[] = candidates.map((candidate) => {
    let moodScore = 0;
    let energyFit = 0;
    for (const vote of votes) {
      const w = voiceWeightFor(vote.studentId, fairness);
      if (candidate.moodTags.includes(vote.mood)) moodScore += w;
      energyFit += w * gaussian(candidate.energyEstimate, vote.energy, ALGO_CONSTANTS.ENERGY_KERNEL_SIGMA);
    }

    const baseScore2 = moodScore * moodScore * energyFit * energyFit;
    const vetoMatched = candidateMatchesVeto(candidate, allVetoes);

    let score2 = baseScore2;
    let vetoCleared = !vetoMatched;
    if (vetoMatched) {
      if (vetoSoftPenaltyActive) {
        score2 = baseScore2 * ALGO_CONSTANTS.SOFT_PENALTY_MULTIPLIER;
        vetoCleared = true;
      } else {
        score2 = 0;
      }
    }

    return { candidate, moodScore, energyFit, vetoCleared, score2 };
  });

  return { scored, vetoSoftPenaltyActive };
}

// ---------------------------------------------------------------------------
// Stage 2 — Conflict detection
// ---------------------------------------------------------------------------

function voteToVector(vote: Vote): number[] {
  // 10-dim one-hot: [focus, build, vibe, crit, fun, e1, e2, e3, e4, e5]
  const v = new Array(10).fill(0) as number[];
  v[MOOD_ORDER.indexOf(vote.mood)] = 1;
  v[5 + (vote.energy - 1)] = 1;
  return v;
}

function euclideanDist(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

interface KMeansResult {
  assignments: number[];
  centroids: number[][];
}

/**
 * k-means with k=2 and farthest-pair init for determinism.
 * Early returns when assignments stabilise.
 */
function kmeansK2(vectors: number[][], maxIters = 20): KMeansResult {
  const n = vectors.length;
  if (n === 0) return { assignments: [], centroids: [] };
  if (n === 1) return { assignments: [0], centroids: [vectors[0].slice()] };

  // Farthest-pair initialisation: pick the two most-distant points.
  let bestI = 0;
  let bestJ = 1;
  let maxD = -Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = euclideanDist(vectors[i], vectors[j]);
      if (d > maxD) {
        maxD = d;
        bestI = i;
        bestJ = j;
      }
    }
  }
  let centroids = [vectors[bestI].slice(), vectors[bestJ].slice()];
  let assignments = new Array(n).fill(0) as number[];

  for (let iter = 0; iter < maxIters; iter++) {
    const newAssignments = vectors.map((v) => {
      const d0 = euclideanDist(v, centroids[0]);
      const d1 = euclideanDist(v, centroids[1]);
      // Tiebreak: prefer cluster 0 (deterministic).
      return d0 <= d1 ? 0 : 1;
    });

    let changed = false;
    for (let i = 0; i < n; i++) {
      if (newAssignments[i] !== assignments[i]) {
        changed = true;
        break;
      }
    }
    assignments = newAssignments;
    if (!changed && iter > 0) break;

    // Update centroids.
    const dim = vectors[0].length;
    for (let k = 0; k < 2; k++) {
      const members = vectors.filter((_, i) => assignments[i] === k);
      if (members.length === 0) continue;
      const cent = new Array(dim).fill(0) as number[];
      for (const m of members) {
        for (let d = 0; d < dim; d++) cent[d] += m[d];
      }
      for (let d = 0; d < dim; d++) cent[d] /= members.length;
      centroids[k] = cent;
    }
  }

  return { assignments, centroids };
}

/**
 * Silhouette score averaged over all points. Range [-1, 1].
 * Returns 0 for degenerate cases (all points in one cluster, etc.).
 */
function silhouetteScore(vectors: number[][], assignments: number[]): number {
  const n = vectors.length;
  if (n < 2) return 0;

  let total = 0;
  let valid = 0;

  for (let i = 0; i < n; i++) {
    const myCluster = assignments[i];
    let sameSum = 0;
    let sameCount = 0;
    let otherSum = 0;
    let otherCount = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dist = euclideanDist(vectors[i], vectors[j]);
      if (assignments[j] === myCluster) {
        sameSum += dist;
        sameCount++;
      } else {
        otherSum += dist;
        otherCount++;
      }
    }
    if (sameCount === 0 || otherCount === 0) continue;
    const a = sameSum / sameCount;
    const b = otherSum / otherCount;
    const denom = Math.max(a, b);
    if (denom > 0) {
      total += (b - a) / denom;
      valid++;
    }
  }

  return valid > 0 ? total / valid : 0;
}

export function detectConflict(votes: Vote[]): ConflictDetectionOutput {
  const n = votes.length;
  if (n < ALGO_CONSTANTS.SMALL_GROUP_N) {
    return { mode: "small_group" };
  }

  const vectors = votes.map(voteToVector);
  const { assignments } = kmeansK2(vectors);
  const silhouette = silhouetteScore(vectors, assignments);

  if (silhouette > ALGO_CONSTANTS.SILHOUETTE_SPLIT_THRESHOLD) {
    const clusters: number[][] = [[], []];
    assignments.forEach((c, i) => clusters[c].push(i));
    return { mode: "split", silhouette, clusters };
  }

  return { mode: "consensus", silhouette };
}

// ---------------------------------------------------------------------------
// PRNG (seeded)
// ---------------------------------------------------------------------------

/** sha256 hash of class_id||class_round_index||suggest_count → hex string. */
export function seedPRNG(classId: string, classRoundIndex: number, suggestCount: number): string {
  const h = createHash("sha256");
  h.update(`${classId}||${classRoundIndex}||${suggestCount}`);
  return h.digest("hex");
}

/** Mulberry32 PRNG seeded by first 32 bits of the hex seed. */
function mulberry32(seedHex: string): () => number {
  // Parse first 8 hex chars; force to unsigned 32-bit.
  let a = parseInt(seedHex.slice(0, 8), 16) >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle<T>(arr: T[], seedHex: string): T[] {
  const out = arr.slice();
  const rand = mulberry32(seedHex);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stage 4 — Selection
// ---------------------------------------------------------------------------

/** Token-set cosine on lowercased whitespace-split text. */
function tokenCosine(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersect = 0;
  for (const t of ta) if (tb.has(t)) intersect++;
  return intersect / Math.sqrt(ta.size * tb.size);
}

function similarity(a: Candidate, b: Candidate): number {
  const nameSim = tokenCosine(a.name, b.name);
  const tagsA = [...a.contentTags, ...a.moodTags].join(" ");
  const tagsB = [...b.contentTags, ...b.moodTags].join(" ");
  const tagSim = tokenCosine(tagsA, tagsB);
  return Math.max(nameSim, tagSim);
}

/**
 * MMR — Maximal Marginal Relevance. Carbonell & Goldstein, SIGIR 1998.
 * Given a scored set, pick `k` items balancing relevance (score²) and
 * diversity (1 - max similarity to already-picked).
 */
function mmrSelect(scored: ScoredCandidate[], k: number, lambda: number): ScoredCandidate[] {
  if (scored.length <= k) return scored.slice();
  const sorted = scored.slice().sort((a, b) => b.score2 - a.score2);
  const selected: ScoredCandidate[] = [sorted[0]];
  const remaining = sorted.slice(1);
  const maxScore = sorted[0].score2 || 1; // avoid div-by-zero

  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestMmr = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      const relevance = cand.score2 / maxScore;
      let maxSim = 0;
      for (const sel of selected) {
        const sim = similarity(cand.candidate, sel.candidate);
        if (sim > maxSim) maxSim = sim;
      }
      const mmr = lambda * relevance - (1 - lambda) * maxSim;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = i;
      }
    }
    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}

/**
 * Recency penalty: candidates matching a recent pick's (mood overlap,
 * energy within ±1) get score2 × RECENCY_PENALTY.
 */
function applyRecencyPenalty(
  scored: ScoredCandidate[],
  recent: Candidate[]
): ScoredCandidate[] {
  if (recent.length === 0) return scored;
  return scored.map((s) => {
    let hit = false;
    for (const r of recent) {
      const moodOverlap = s.candidate.moodTags.some((m) => r.moodTags.includes(m));
      const energyClose = Math.abs(s.candidate.energyEstimate - r.energyEstimate) <= 1;
      if (moodOverlap && energyClose) {
        hit = true;
        break;
      }
    }
    return hit ? { ...s, score2: s.score2 * ALGO_CONSTANTS.RECENCY_PENALTY } : s;
  });
}

/**
 * Fairness credit: if candidate.seedOrigin maps to a student whose
 * servedScore < FAIRNESS_CREDIT_SERVED_THRESHOLD, bump score2 by
 * (1 + FAIRNESS_CREDIT).
 */
function applyFairnessCredit(
  scored: ScoredCandidate[],
  fairness: FairnessLedgerEntry[]
): ScoredCandidate[] {
  if (fairness.length === 0) return scored;
  return scored.map((s) => {
    const sid = s.candidate.seedOrigin;
    if (!sid) return s;
    const entry = fairness.find((f) => f.studentId === sid);
    if (!entry) return s;
    if (entry.servedScore < ALGO_CONSTANTS.FAIRNESS_CREDIT_SERVED_THRESHOLD) {
      return { ...s, score2: s.score2 * (1 + ALGO_CONSTANTS.FAIRNESS_CREDIT) };
    }
    return s;
  });
}

/**
 * Per-cluster score² recomputed restricted to the votes in that cluster.
 * Used by split-room mode to find argmax-per-cluster + bridge.
 * Uses uniform voice_weight=1 inside the cluster — the per-student
 * voice weighting was already baked into the global Stage 1 score.
 */
function scoreInCluster(
  candidate: Candidate,
  voteIdxs: number[],
  votes: Vote[]
): number {
  let m = 0;
  let e = 0;
  for (const i of voteIdxs) {
    const v = votes[i];
    if (candidate.moodTags.includes(v.mood)) m += 1.0;
    e += gaussian(candidate.energyEstimate, v.energy, ALGO_CONSTANTS.ENERGY_KERNEL_SIGMA);
  }
  return m * m * e * e;
}

export function select(input: SelectionInput, prngSeed: string): SelectionOutput {
  const { mode, clusters, votes, fairness = [], recentSuggestions = [] } = input;
  let { scored } = input;

  // Apply recency penalty + fairness credit BEFORE filtering / ranking.
  scored = applyRecencyPenalty(scored, recentSuggestions);
  scored = applyFairnessCredit(scored, fairness);

  // Drop hard-vetoed candidates (those with vetoCleared=false AND score2=0).
  // Soft-penalty candidates survive with their multiplied score2.
  const eligible = scored.filter((s) => s.vetoCleared || s.score2 > 0);

  let picks: ScoredCandidate[] = [];
  let bridgeIndex: number | undefined;

  if (mode === "split" && clusters && clusters.length === 2 && clusters[0].length > 0 && clusters[1].length > 0) {
    // Argmax per cluster.
    const candA = eligible
      .slice()
      .sort((a, b) => scoreInCluster(b.candidate, clusters[0], votes) - scoreInCluster(a.candidate, clusters[0], votes))[0];
    const candB = eligible
      .slice()
      .sort((a, b) => scoreInCluster(b.candidate, clusters[1], votes) - scoreInCluster(a.candidate, clusters[1], votes))[0];

    // Bridge = argmax min(score_in_cluster_A, score_in_cluster_B) excluding A and B.
    const taken = new Set<string>();
    if (candA) taken.add(candA.candidate.name);
    if (candB) taken.add(candB.candidate.name);
    const bridge = eligible
      .filter((c) => !taken.has(c.candidate.name))
      .map((c) => ({
        c,
        minScore: Math.min(scoreInCluster(c.candidate, clusters[0], votes), scoreInCluster(c.candidate, clusters[1], votes)),
      }))
      .sort((x, y) => y.minScore - x.minScore)[0]?.c;

    picks = [candA, candB, bridge].filter(Boolean) as ScoredCandidate[];
    const bridgeName = bridge?.candidate.name;
    picks = deterministicShuffle(picks, prngSeed);
    bridgeIndex = bridgeName ? picks.findIndex((p) => p.candidate.name === bridgeName) : undefined;
  } else if (mode === "small_group") {
    // Linear scores (not squared). Re-sort by moodScore × energyFit and MMR.
    const linear = eligible
      .map((s) => ({ ...s, score2: s.moodScore * s.energyFit }))
      .filter((s) => s.score2 > 0);
    picks = mmrSelect(linear, 3, ALGO_CONSTANTS.MMR_LAMBDA);
    picks = deterministicShuffle(picks, prngSeed);
  } else {
    // Consensus mode. Take top-10 by score², then MMR for diversity.
    const topK = Math.min(eligible.length, 10);
    const top = eligible.slice().sort((a, b) => b.score2 - a.score2).slice(0, topK);
    picks = mmrSelect(top, 3, ALGO_CONSTANTS.MMR_LAMBDA);
    picks = deterministicShuffle(picks, prngSeed);
  }

  return { picks, conflictMode: mode, bridgeIndex };
}

// ---------------------------------------------------------------------------
// Consensus seed detection (helper for Stage 3 — exposed here for Phase 5)
// ---------------------------------------------------------------------------

export function analyseConsensusSeeds(votes: Vote[]): ConsensusSeedAnalysis {
  const counts = new Map<string, number>();
  for (const v of votes) {
    if (v.seed && !v.seedFlagged) {
      const key = normalize(v.seed);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const n = votes.length;
  const threshold = Math.max(3, Math.ceil(n / 4));

  let consensusName: string | undefined;
  let echoCount = 0;
  for (const [name, count] of counts) {
    if (count >= threshold && count > echoCount) {
      consensusName = name;
      echoCount = count;
    }
  }

  return {
    hasConsensus: consensusName !== undefined,
    consensusName,
    echoCount,
    threshold,
  };
}

// ---------------------------------------------------------------------------
// Fairness ledger update (§3.6)
// ---------------------------------------------------------------------------

/**
 * Apply ledger updates for one round. Called when teacher picks a suggestion
 * (or auto-close fires) — Phase 6 wires this in.
 *
 * - servedScore: EMA on "did your vote align with the picked candidate?"
 *   Alignment = mood ∈ picked.moodTags AND |energy - picked.energyEstimate| ≤ 1.
 * - seedPickupCount: +1 when picked.seedOrigin === this student.
 * - voiceWeight: clamp(1.0 - (servedScore - 0.5), [MIN, MAX]).
 * - roundsParticipated: +1.
 *
 * Students who didn't vote this round are NOT touched.
 */
export function updateFairnessLedger(
  ledger: FairnessLedgerEntry[],
  votes: Vote[],
  picked: Candidate,
  classId: string
): FairnessLedgerEntry[] {
  const map = new Map<string, FairnessLedgerEntry>(ledger.map((e) => [e.studentId, { ...e }]));

  for (const vote of votes) {
    const prev = map.get(vote.studentId) ?? {
      classId,
      studentId: vote.studentId,
      servedScore: 0.5,
      seedPickupCount: 0,
      voiceWeight: 1.0,
      roundsParticipated: 0,
    };

    const moodAligned = picked.moodTags.includes(vote.mood);
    const energyAligned = Math.abs(vote.energy - picked.energyEstimate) <= 1;
    const aligned = moodAligned && energyAligned ? 1 : 0;

    const newServedScore =
      ALGO_CONSTANTS.EMA_ALPHA * aligned + (1 - ALGO_CONSTANTS.EMA_ALPHA) * prev.servedScore;
    const newVoiceWeight = Math.max(
      ALGO_CONSTANTS.VOICE_WEIGHT_MIN,
      Math.min(ALGO_CONSTANTS.VOICE_WEIGHT_MAX, 1.0 - (newServedScore - 0.5))
    );
    const seedBump = picked.seedOrigin === vote.studentId ? 1 : 0;

    map.set(vote.studentId, {
      classId: prev.classId,
      studentId: prev.studentId,
      servedScore: newServedScore,
      seedPickupCount: prev.seedPickupCount + seedBump,
      voiceWeight: newVoiceWeight,
      roundsParticipated: prev.roundsParticipated + 1,
    });
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Convenience: end-to-end pipeline (used by simulator + tests)
// ---------------------------------------------------------------------------

export interface PipelineInput {
  votes: Vote[];
  candidates: Candidate[];
  fairness?: FairnessLedgerEntry[];
  persistentVetoes?: string[];
  recentSuggestions?: Candidate[];
  classId: string;
  classRoundIndex: number;
  suggestCount: number;
}

export interface PipelineOutput {
  conflict: ConflictDetectionOutput;
  aggregate: AggregatorOutput;
  selection: SelectionOutput;
  prngSeed: string;
  consensusSeed: ConsensusSeedAnalysis;
}

/**
 * Run Stages 1, 2, 4 end-to-end against a fixed candidate pool (Stage 3
 * stand-in). Phase 5 will replace the candidate-pool input with the
 * Stage 3 LLM call.
 */
export function runPipeline(input: PipelineInput): PipelineOutput {
  const conflict = detectConflict(input.votes);
  const aggregate_ = aggregate({
    votes: input.votes,
    candidates: input.candidates,
    fairness: input.fairness,
    persistentVetoes: input.persistentVetoes,
  });
  const prngSeed = seedPRNG(input.classId, input.classRoundIndex, input.suggestCount);
  const selection = select(
    {
      scored: aggregate_.scored,
      mode: conflict.mode,
      clusters: conflict.clusters,
      votes: input.votes,
      fairness: input.fairness,
      recentSuggestions: input.recentSuggestions,
      classRoundIndex: input.classRoundIndex,
    },
    prngSeed
  );
  const consensusSeed = analyseConsensusSeeds(input.votes);

  return { conflict, aggregate: aggregate_, selection, prngSeed, consensusSeed };
}
