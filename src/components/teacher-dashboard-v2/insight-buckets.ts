/* Insight bucket reducer — folds the six-valued DashboardInsight.type
 * into the four Bold cards (Act now / To grade / Watch / Celebrate).
 *
 * The dashboard API emits per-student-per-unit insights; the Bold hero
 * aggregates them into a single number + short student list per bucket.
 * Mapping (decided 24 Apr 2026 in docs/projects/teacher-dashboard-v1.md
 * Phase 0 pre-flight):
 *
 *   stuck_student                                  → Act now
 *   stale_unmarked + recent_completion             → To grade
 *   integrity_flag + integrity_warning             → Watch
 *   unit_complete                                  → Celebrate
 */

import type { DashboardInsight } from "@/types/dashboard";
import { getInitials } from "./nav-config";

export type BucketTag = "Act now" | "To grade" | "Watch" | "Celebrate";

export interface InsightBucket {
  tag: BucketTag;
  /** Card background. Matches the Bold mock palette. */
  bg: string;
  /** Eyebrow + big-number color. */
  accent: string;
  /** Body text color. */
  text: string;
  /** Big-number display ("5" for item counts, "—" when empty). */
  big: string;
  /** Short label below the big number ("students stuck"). */
  unit: string;
  /** One-line body summary. Empty buckets get reassuring copy. */
  body: string;
  /** Up to 4 student initials to render as avatars. */
  who: string[];
  /** Count beyond the 4 shown initials, for "+N" indicator. */
  whoOverflow: number;
  /** Deep link fired by the CTA. Null on empty buckets. */
  href: string | null;
  /** CTA copy. */
  cta: string;
  /** True when no items in this bucket — card renders muted. */
  isEmpty: boolean;
}

const BUCKET_SPEC: Record<
  BucketTag,
  {
    bg: string;
    accent: string;
    text: string;
    unitOn: string;
    unitOff: string;
    ctaOn: string;
    ctaOff: string;
    href: string;
  }
> = {
  "Act now": {
    bg: "#FEE2E2",
    accent: "#DC2626",
    text: "#7F1D1D",
    unitOn: "students stuck",
    unitOff: "everyone moving",
    ctaOn: "Review & message",
    ctaOff: "All clear",
    href: "/teacher/students",
  },
  "To grade": {
    bg: "#FEF3C7",
    accent: "#D97706",
    text: "#78350F",
    unitOn: "pieces waiting",
    unitOff: "inbox empty",
    ctaOn: "Open queue",
    ctaOff: "No pending work",
    href: "/teacher/students",
  },
  "Watch": {
    bg: "#DBEAFE",
    accent: "#2563EB",
    text: "#1E3A8A",
    unitOn: "integrity flags",
    unitOff: "no flags this week",
    ctaOn: "See students",
    ctaOff: "All clear",
    href: "/teacher/safety/alerts",
  },
  "Celebrate": {
    bg: "#D1FAE5",
    accent: "#059669",
    text: "#064E3B",
    unitOn: "units completed",
    unitOff: "keep encouraging",
    ctaOn: "Send shout-out",
    ctaOff: "Watch for wins",
    href: "/teacher/students",
  },
};

function pickUnique<T>(items: T[], key: (t: T) => string, limit: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/** Build a one-line body from the unique student names in a bucket.
 *  Falls back to a generic "N students" summary when too many to list. */
function summariseStudents(
  items: DashboardInsight[],
  noun: string,
): string {
  const uniqueNames = pickUnique(items, (i) => i.studentName, 8).map(
    (i) => i.studentName,
  );
  if (uniqueNames.length === 0) return "";
  if (uniqueNames.length === 1) return `${uniqueNames[0]} — ${noun}.`;
  if (uniqueNames.length <= 3) {
    return `${uniqueNames.slice(0, -1).join(", ")} & ${
      uniqueNames[uniqueNames.length - 1]
    } — ${noun}.`;
  }
  const head = uniqueNames.slice(0, 3).join(", ");
  const rest = uniqueNames.length - 3;
  return `${head} and ${rest} other${rest === 1 ? "" : "s"} — ${noun}.`;
}

/** Build the four Bold insight cards from the server's priority-sorted
 *  DashboardInsight[]. Always returns exactly four buckets in the
 *  fixed Act→Grade→Watch→Celebrate order. */
export function buildInsightBuckets(
  insights: DashboardInsight[],
): InsightBucket[] {
  // Partition by type. One pass; each insight lands in exactly one bucket.
  const byBucket: Record<BucketTag, DashboardInsight[]> = {
    "Act now": [],
    "To grade": [],
    "Watch": [],
    "Celebrate": [],
  };
  for (const i of insights) {
    switch (i.type) {
      case "stuck_student":
        byBucket["Act now"].push(i);
        break;
      case "stale_unmarked":
      case "recent_completion":
        byBucket["To grade"].push(i);
        break;
      case "integrity_flag":
      case "integrity_warning":
        byBucket["Watch"].push(i);
        break;
      case "unit_complete":
        byBucket["Celebrate"].push(i);
        break;
      default:
        // Future types — ignore rather than crash.
        break;
    }
  }

  const bucketBodies: Record<BucketTag, { noun: string }> = {
    "Act now": { noun: "no meaningful activity in days" },
    "To grade": { noun: "have completed work waiting" },
    "Watch": { noun: "raised integrity flags" },
    "Celebrate": { noun: "finished an entire unit" },
  };

  const tags: BucketTag[] = ["Act now", "To grade", "Watch", "Celebrate"];
  return tags.map((tag) => {
    const spec = BUCKET_SPEC[tag];
    const items = byBucket[tag];
    const count = items.length;

    if (count === 0) {
      return {
        tag,
        bg: spec.bg,
        accent: spec.accent,
        text: spec.text,
        big: "—",
        unit: spec.unitOff,
        body: "Nothing for this bucket right now. Good signal — or quiet week.",
        who: [],
        whoOverflow: 0,
        href: null,
        cta: spec.ctaOff,
        isEmpty: true,
      };
    }

    // First 4 distinct students (by name) for avatars.
    const uniqueStudents = pickUnique(items, (i) => i.studentName, 8).map(
      (i) => i.studentName,
    );
    const shown = uniqueStudents.slice(0, 4).map(getInitials);
    const whoOverflow = Math.max(0, uniqueStudents.length - shown.length);

    return {
      tag,
      bg: spec.bg,
      accent: spec.accent,
      text: spec.text,
      big: String(count),
      unit: spec.unitOn,
      body: summariseStudents(items, bucketBodies[tag].noun),
      who: shown,
      whoOverflow,
      href: spec.href,
      cta: spec.ctaOn,
      isEmpty: false,
    };
  });
}
