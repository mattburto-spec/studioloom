/**
 * Academic Integrity Analysis Utility
 *
 * Analyzes student writing behavior metadata to compute a Human Confidence Score.
 * Detects patterns indicative of pasted content, bulk entry, unnatural typing speed,
 * and other behavioral anomalies that suggest non-independent work.
 *
 * Score interpretation:
 * - 70-100: High confidence of independent work
 * - 40-69: Medium confidence, recommend review
 * - 0-39: Low confidence, flagged for teacher review
 */

import type { IntegrityMetadata } from "@/components/student/MonitoredTextarea";

/**
 * Represents a single behavioral flag detected during integrity analysis.
 */
export interface IntegrityFlag {
  /** Category of behavior detected */
  type:
    | "paste_heavy"
    | "bulk_entry"
    | "speed_anomaly"
    | "no_editing"
    | "focus_loss"
    | "minimal_time";
  /** Severity level: 'warning' (minor concern) or 'concern' (major red flag) */
  severity: "warning" | "concern";
  /** Human-readable explanation of why this flag was raised */
  detail: string;
}

/**
 * Complete integrity analysis result.
 */
export interface IntegrityAnalysis {
  /** Human Confidence Score (0-100). Higher = more likely independent work. */
  score: number;
  /** Categorical level based on score thresholds */
  level: "high" | "medium" | "low";
  /** Array of behavioral flags detected */
  flags: IntegrityFlag[];
  /** One-line summary suitable for display in UI */
  summary: string;
}

/**
 * Analyzes writing behavior metadata and computes a Human Confidence Score.
 *
 * Scoring methodology:
 * 1. Start with base score of 100
 * 2. Deduct points for each detected behavioral anomaly
 * 3. Clamp score between 0-100
 * 4. Classify into level based on thresholds
 *
 * @param metadata - Behavior data captured by MonitoredTextarea
 * @returns Complete integrity analysis with score, level, flags, and summary
 */
export function analyzeIntegrity(metadata: IntegrityMetadata): IntegrityAnalysis {
  let score = 100;
  const flags: IntegrityFlag[] = [];

  // Compute total pasted characters from paste events
  const totalPastedChars = metadata.pasteEvents.reduce(
    (sum, evt) => sum + evt.length,
    0
  );

  // Rule 1: Paste ratio detection
  const pasteRatio =
    metadata.characterCount > 0
      ? totalPastedChars / metadata.characterCount
      : 0;

  if (pasteRatio > 0.7) {
    score -= 40;
    flags.push({
      type: "paste_heavy",
      severity: "concern",
      detail: `Very high paste ratio (${(pasteRatio * 100).toFixed(0)}% of content). Suggests copied/pasted text.`,
    });
  } else if (pasteRatio > 0.4) {
    score -= 20;
    flags.push({
      type: "paste_heavy",
      severity: "warning",
      detail: `High paste ratio (${(pasteRatio * 100).toFixed(0)}% of content). Some pasted text detected.`,
    });
  } else if (pasteRatio > 0.2) {
    score -= 10;
  }

  // Rule 2: Bulk entry detection (large character jumps between snapshots)
  if (metadata.snapshots.length > 1) {
    for (let i = 1; i < metadata.snapshots.length; i++) {
      const prev = metadata.snapshots[i - 1];
      const curr = metadata.snapshots[i];
      const timeDelta = (curr.timestamp - prev.timestamp) / 1000;
      const charDelta = curr.text.length - prev.text.length;

      if (timeDelta <= 30 && charDelta > 500) {
        score -= 30;
        flags.push({
          type: "bulk_entry",
          severity: "concern",
          detail: `${charDelta} characters added in ${timeDelta.toFixed(1)}s. Consistent with bulk paste.`,
        });
        break;
      } else if (timeDelta <= 30 && charDelta > 200) {
        score -= 15;
        flags.push({
          type: "bulk_entry",
          severity: "warning",
          detail: `${charDelta} characters added in ${timeDelta.toFixed(1)}s. Larger than typical typing.`,
        });
        break;
      }
    }
  }

  // Rule 3: Typing speed anomaly detection
  // Guard: skip when totalTimeActive < 10s (too little signal — produces 4592 WPM
  // artifacts on paste events) OR pasteRatio >= 0.4 (rule 1 already catches paste).
  // Without these, a 1.1s paste of 424 chars piles speed_anomaly + minimal_time
  // on top of paste_heavy for one underlying signal.
  if (
    metadata.totalTimeActive >= 10 &&
    metadata.characterCount > 0 &&
    pasteRatio < 0.4
  ) {
    const charsPerSecond = metadata.characterCount / metadata.totalTimeActive;
    const wpm = (charsPerSecond / 5) * 60;

    if (wpm > 150) {
      score -= 25;
      flags.push({
        type: "speed_anomaly",
        severity: "concern",
        detail: `Typing speed ~${wpm.toFixed(0)} WPM. Exceeds typical human speed (80-120 WPM).`,
      });
    } else if (wpm > 100) {
      score -= 10;
      flags.push({
        type: "speed_anomaly",
        severity: "warning",
        detail: `Typing speed ~${wpm.toFixed(0)} WPM. Slightly elevated (typical: 60-100 WPM).`,
      });
    }
  }

  // Rule 4: No editing behavior (very low deletion rate)
  if (
    metadata.keystrokeCount > 0 &&
    metadata.characterCount > 100
  ) {
    const deletionRate = metadata.deletionCount / metadata.keystrokeCount;
    if (deletionRate < 0.02) {
      score -= 10;
      flags.push({
        type: "no_editing",
        severity: "warning",
        detail: `Very low editing rate (${(deletionRate * 100).toFixed(1)}% corrections). Natural writing typically has 5-15%.`,
      });
    }
  }

  // Rule 5: Focus loss
  if (metadata.focusLossCount > 20) {
    score -= 15;
    flags.push({
      type: "focus_loss",
      severity: "concern",
      detail: `${metadata.focusLossCount} focus loss events. May indicate copying from another source.`,
    });
  } else if (metadata.focusLossCount > 10) {
    score -= 5;
    flags.push({
      type: "focus_loss",
      severity: "warning",
      detail: `${metadata.focusLossCount} focus loss events. Multiple tab switches detected.`,
    });
  }

  // Rule 6: Minimal active time with large content
  // Guard: skip when pasteRatio >= 0.4 — rule 1 already catches paste-heavy
  // content. Without this guard, a single paste fires paste_heavy + minimal_time
  // for the same underlying signal.
  if (
    metadata.totalTimeActive < 30 &&
    metadata.characterCount > 200 &&
    pasteRatio < 0.4
  ) {
    score -= 20;
    flags.push({
      type: "minimal_time",
      severity: "concern",
      detail: `${metadata.characterCount} characters in only ${metadata.totalTimeActive.toFixed(1)}s of active time. Consistent with paste operation.`,
    });
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine level
  const level: IntegrityAnalysis["level"] =
    score >= 70 ? "high" : score >= 40 ? "medium" : "low";

  // Generate summary
  let summary: string;
  if (flags.length === 0) {
    summary = "Writing behavior appears consistent with independent work";
  } else {
    const topFlag = flags.reduce((prev, curr) =>
      curr.severity === "concern" ? curr : prev
    );
    summary = topFlag.detail;
  }

  return { score, level, flags, summary };
}

/**
 * Returns Tailwind text color class for an integrity score.
 */
export function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

/**
 * Returns Tailwind background + border classes for an integrity score badge.
 */
export function getScoreBgColor(score: number): string {
  if (score >= 70) return "bg-green-50 border-green-200";
  if (score >= 40) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

/**
 * Returns a human-readable label for the integrity level.
 */
export function getScoreLabel(level: IntegrityAnalysis["level"]): string {
  switch (level) {
    case "high":
      return "Likely Independent";
    case "medium":
      return "Review Recommended";
    case "low":
      return "Flagged for Review";
  }
}

/**
 * Find the worst (most-concerning) integrity level across a per-section
 * integrity metadata map. Used by teacher progress views to render a
 * single dot per lesson cell rather than one per section.
 *
 * Round 8 (6 May 2026): replaces the boolean `hasIntegrityData` signal
 * that made every actively-used lesson look "flagged" in the Class
 * Hub progress grid. Only flags when there's a real concern.
 *
 * Severity order: low (rose) > medium (amber) > high (clean).
 * Returns null when the map is empty.
 */
export function worstIntegrityLevel(
  metadataMap: Record<string, IntegrityMetadata> | null | undefined
): "high" | "medium" | "low" | null {
  if (!metadataMap || typeof metadataMap !== "object") return null;
  const entries = Object.values(metadataMap);
  if (entries.length === 0) return null;
  let worst: "high" | "medium" | "low" = "high";
  for (const meta of entries) {
    if (!meta || typeof meta !== "object") continue;
    const analysis = analyzeIntegrity(meta);
    if (analysis.level === "low") return "low"; // can't get worse
    if (analysis.level === "medium" && worst === "high") {
      worst = "medium";
    }
  }
  return worst;
}
