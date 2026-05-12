/**
 * Pace signals for the Teaching Mode check-in row.
 *
 * Given a cohort of in-progress students and their response counts on the
 * current lesson, compute per-student z-scores against the class. Used to
 * surface students who are behind their peers' pace mid-lesson.
 *
 * Population stddev (divide by n) — we have the whole class, not a sample.
 * Returns paceZ = null for every student when n < minCohortSize so small
 * classes don't get spurious z-scores off 2-3 datapoints.
 */

export interface PaceInput {
  studentId: string;
  responseCount: number;
}

export interface PaceResult {
  studentId: string;
  paceZ: number | null;
}

export interface CohortStats {
  n: number;
  median: number;
  mean: number;
  stddev: number;
}

export function computePaceSignals(
  inputs: PaceInput[],
  minCohortSize: number = 5,
): { results: PaceResult[]; stats: CohortStats } {
  const n = inputs.length;
  if (n === 0) {
    return {
      results: [],
      stats: { n: 0, median: 0, mean: 0, stddev: 0 },
    };
  }

  const counts = inputs.map((i) => i.responseCount);
  const mean = counts.reduce((s, x) => s + x, 0) / n;
  const variance = counts.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  const sorted = [...counts].sort((a, b) => a - b);
  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

  const tooSmall = n < minCohortSize;

  const results: PaceResult[] = inputs.map((input) => ({
    studentId: input.studentId,
    paceZ: tooSmall
      ? null
      : stddev === 0
        ? 0
        : (input.responseCount - mean) / stddev,
  }));

  return { results, stats: { n, median, mean, stddev } };
}
