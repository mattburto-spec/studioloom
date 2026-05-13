/**
 * Class DJ — Algorithm types
 *
 * Phase 1 deliverable. Pure-code types for Stages 0, 1, 2, 4 of the
 * 5-stage pipeline specified in docs/projects/class-dj-block-brief.md §3.5.
 *
 * The algorithm:
 *   Stage 0 — sanitiseInput()       string-shaping on free-text inputs
 *   Stage 1 — aggregate()           per-candidate scores (mood approval +
 *                                   gaussian energy + MusicFX quadratic boost)
 *   Stage 2 — detectConflict()      k-means k=2 + silhouette gate on vote matrix
 *   Stage 3 — (out of scope — LLM, Phase 5)
 *   Stage 4 — select()              Pareto + MMR (consensus) /
 *                                   argmax-per-cluster + bridge (split) /
 *                                   linear scores (small_group)
 *   Stage 5 — (out of scope — LLM, Phase 5)
 *
 * The deterministic stages are seeded by sha256(class_id || class_round_index
 * || suggest_count), so re-rolls within a round are replayable.
 */

export type Mood = "focus" | "build" | "vibe" | "crit" | "fun";
export type ConflictMode = "consensus" | "split" | "small_group";
export type CandidateKind = "artist" | "band" | "genre" | "playlist-concept";

/** Raw vote as it arrives from the API (before Stage 0 sanitisation). */
export interface RawVoteInput {
  studentId: string;
  mood: Mood;
  energy: number; // expected 1..5; clamped during sanitisation
  veto?: string | null;
  seed?: string | null;
}

/** Vote after Stage 0 sanitisation. */
export interface Vote {
  studentId: string;
  mood: Mood;
  energy: number; // guaranteed 1..5
  veto: string | null;
  seed: string | null;
  vetoFlagged?: boolean; // set when moderateAndLog flags the veto (Phase 4)
  seedFlagged?: boolean; // set when moderateAndLog flags the seed (Phase 4)
}

/**
 * A music candidate. In Phase 1 the candidate pool is provided by the test
 * fixture / simulator. In Phase 5 it comes from the Stage 3 LLM call with
 * Spotify enrichment applied.
 */
export interface Candidate {
  name: string;
  kind: CandidateKind;
  moodTags: Mood[];
  energyEstimate: number; // 1..5
  contentTags: string[]; // genre + style markers used for veto-matching
  whyKernel?: string;
  /** If set, the student whose `seed` input led to this candidate being in the pool. */
  seedOrigin?: string | null;
  /** Spotify-enriched fields (populated in Phase 5; null in Phase 1 fixtures). */
  imageUrl?: string;
  spotifyUrl?: string;
  explicit?: boolean;
}

/** Per-(class, student) fairness state. §3.6 of the brief. */
export interface FairnessLedgerEntry {
  classId: string;
  studentId: string;
  servedScore: number; // EMA in [0, 1]; defaults to 0.5 on cold start
  seedPickupCount: number;
  voiceWeight: number; // clamped to [VOICE_WEIGHT_MIN, VOICE_WEIGHT_MAX]
  roundsParticipated: number;
}

/** Aggregator (Stage 1) per-candidate output. */
export interface ScoredCandidate {
  candidate: Candidate;
  /** Sum of voice_weight over students whose mood ∈ candidate.moodTags. */
  moodScore: number;
  /** Sum of voice_weight × gaussian(candidate.energyEstimate, student.energy, σ). */
  energyFit: number;
  /** False = candidate eliminated by veto filter (or score2 zeroed). */
  vetoCleared: boolean;
  /** Final score = (moodScore² × energyFit²); zeroed on hard-filter veto;
   *  ×SOFT_PENALTY_MULTIPLIER instead if soft-penalty fallback is active. */
  score2: number;
}

export interface AggregatorInput {
  votes: Vote[];
  candidates: Candidate[];
  fairness?: FairnessLedgerEntry[];
  /** Persistent vetoes from §3.3 query A (already filtered to ≥2 occurrences). */
  persistentVetoes?: string[];
}

export interface AggregatorOutput {
  scored: ScoredCandidate[];
  /** True when persistent_veto count > SOFT_PENALTY_VETO_COUNT_THRESHOLD;
   *  vetoes become ×0.3 multiplier instead of hard filter. */
  vetoSoftPenaltyActive: boolean;
}

export interface ConflictDetectionOutput {
  mode: ConflictMode;
  /** Silhouette score in [-1, 1]; absent in small_group mode. */
  silhouette?: number;
  /** Two arrays of student indices (into votes[]); absent unless split mode. */
  clusters?: number[][];
}

export interface SelectionInput {
  scored: ScoredCandidate[];
  mode: ConflictMode;
  clusters?: number[][]; // present when mode === "split"
  votes: Vote[];
  fairness?: FairnessLedgerEntry[];
  /** Past candidates from last 5 rounds. Used for recency penalty. */
  recentSuggestions?: Candidate[];
  classRoundIndex: number;
}

export interface SelectionOutput {
  /** Length 3 (or fewer if candidate pool too thin). Order is
   *  deterministically shuffled by prngSeed. */
  picks: ScoredCandidate[];
  conflictMode: ConflictMode;
  /** Index in picks of the bridge pick (split mode only). */
  bridgeIndex?: number;
}

export interface ConsensusSeedAnalysis {
  hasConsensus: boolean;
  consensusName?: string;
  /** Number of students who seeded this name. */
  echoCount: number;
  /** Threshold used (max(3, ceil(n/4))). */
  threshold: number;
}

/**
 * Algorithm constants. Locked per research synthesis §2.
 * If you tune a value here, you break captured-truth test fixtures —
 * a new capture pass is required. Document the tuning rationale.
 */
export const ALGO_CONSTANTS = {
  /** σ for gaussian kernel over energy. Width = 1 unit on the 1-5 scale. */
  ENERGY_KERNEL_SIGMA: 1.0,
  /** k-means k. Fixed at 2 for two-faction detection. */
  KMEANS_K: 2,
  /** Silhouette threshold above which a room is split. */
  SILHOUETTE_SPLIT_THRESHOLD: 0.5,
  /** Below this n, skip clustering — always small_group mode. */
  SMALL_GROUP_N: 8,
  /** MMR λ: balance between relevance (score) and diversity. */
  MMR_LAMBDA: 0.7,
  /** EMA α on servedScore: higher = more reactive to recent rounds. */
  EMA_ALPHA: 0.3,
  VOICE_WEIGHT_MIN: 0.5,
  VOICE_WEIGHT_MAX: 2.0,
  /** Recency penalty: any candidate matching a recent pick's (mood, energy_band)
   *  gets score2 × this factor. */
  RECENCY_PENALTY: 0.5,
  /** Fairness credit: candidates whose seedOrigin is an unserved student
   *  get score2 × (1 + this) bump. */
  FAIRNESS_CREDIT: 0.1,
  /** Students with servedScore below this threshold are "unserved". */
  FAIRNESS_CREDIT_SERVED_THRESHOLD: 0.4,
  /** When persistent veto count exceeds this, switch from hard filter
   *  to ×SOFT_PENALTY_MULTIPLIER soft penalty. */
  SOFT_PENALTY_VETO_COUNT_THRESHOLD: 6,
  SOFT_PENALTY_MULTIPLIER: 0.3,
} as const;
