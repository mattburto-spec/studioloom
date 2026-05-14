/**
 * Shared types for the AI video suggestions feature.
 *
 * See docs/projects/ai-video-suggestions-brief.md for the design.
 * Sub-phase 1 (this PR): backend pipeline only. Sub-phase 2 will add
 * the UI panel.
 */

/**
 * Context the teacher's activity block provides to the AI.
 *
 * The block fields are teacher-authored — no student names, no PII
 * tokens (the project's CI grep guard enforces this elsewhere).
 */
export interface SuggestionContext {
  /** Activity prompt slot — what students are doing. */
  framing?: string;
  /** Activity prompt slot — the imperative body. */
  task?: string;
  /** Activity prompt slot — what students produce. */
  success_signal?: string;
  /** Unit title for context (e.g. "Empathic Design for Aged Care"). */
  unitTitle?: string;
  /** Free-text subject like "Design Technology", "Physics". */
  subject?: string;
  /** Grade level string from unit.grade_level (e.g. "Grade 7", "Year 9"). */
  gradeLevel?: string;
  /**
   * Optional video IDs to exclude — used by the "Suggest again" flow
   * to avoid re-showing the same candidates.
   */
  excludeVideoIds?: string[];
}

/**
 * Raw item shape after we read YouTube `search.list` + `videos.list`.
 * Decoupled from YouTube's response to keep the re-ranker prompt and
 * downstream rendering stable if we ever swap providers (Phase B).
 */
export interface YouTubeRawItem {
  videoId: string;
  title: string;
  channelTitle: string;
  description: string;
  thumbnail: string;
  /** Total duration in seconds, parsed from ISO 8601 (PT#M#S). */
  durationSeconds: number;
  /** Always true after our filter — kept on the type for clarity. */
  embeddable: true;
}

/**
 * Final candidate surfaced to the teacher. The re-ranker assigns the
 * `caption` (one-line "Why this fits") on top of the raw fields.
 */
export interface VideoCandidate {
  videoId: string;
  url: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  durationSeconds: number;
  /** AI-written one-liner — why this video fits the block. */
  caption: string;
}

/**
 * Response shape from POST /api/teacher/suggest-videos.
 *
 * `candidates` is empty when no usable videos surfaced (after safe-
 * search + embeddable filter + AI re-rank rejection). Treat it as a
 * non-error empty state, not a failure.
 */
export interface SuggestVideosResponse {
  candidates: VideoCandidate[];
  /** Optional explainer for the empty state (e.g. "no embeddable matches"). */
  note?: string;
}
