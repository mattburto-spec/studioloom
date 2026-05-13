"use client";

import type { FC } from "react";

// =========================================================================
// Types
// =========================================================================

export interface CheckInStudent {
  id: string;
  name: string;
  avatar: string | null;
  status: "not_started" | "in_progress" | "complete";
  isOnline: boolean;
  lastActive: string | null;
  responseCount: number;
  needsHelp: boolean;
  paceZ: number | null;
  /** Title of the student's current First Move "doing" card, if any.
   *  Surfaced in the chip so the teacher can ask "how's X going?"
   *  even when the actual work is happening off-platform (CAD, etc). */
  doingCardTitle: string | null;
}

export interface CheckInCohortStats {
  inProgressCount: number;
  medianResponses: number;
  meanResponses: number;
  stddevResponses: number;
}

export interface CheckInRowProps {
  students: CheckInStudent[];
  cohortStats: CheckInCohortStats | null;
  onlineCount: number;
  snoozed: Set<string>;
  onSnooze: (studentId: string) => void;
}

type ReasonKind = "stuck" | "behind" | "absent";

interface Reason {
  kind: ReasonKind;
  text: string;
}

// =========================================================================
// Constants
// =========================================================================

const PACE_Z_THRESHOLD = -1.0;
const PRIORITY: Record<ReasonKind, number> = { stuck: 0, behind: 1, absent: 2 };
const MAX_CHIPS = 3;

// =========================================================================
// Reason builder — first matching signal wins; priority resolved in sort
// =========================================================================

/** Append the student's current "doing" card to a reason so the teacher
 *  walks over with a specific question ("how's the wheel going?") rather
 *  than a surveillance question ("are you working?"). No-op when no card. */
function withDoingCard(text: string, card: string | null): string {
  if (!card) return text;
  return `${text} · ${card}`;
}

function buildReason(
  s: CheckInStudent,
  cohortStats: CheckInCohortStats | null,
  onlineCount: number,
): Reason | null {
  // Stuck — student is online on this page AND in_progress AND hasn't
  // autosaved in 3+ min. The live-status route now scopes isOnline to
  // the current page (13 May 2026), so `mins` here is bounded by the
  // 5-min "online" window — no more 551m absurdity.
  if (s.needsHelp && s.lastActive) {
    const mins = Math.floor((Date.now() - new Date(s.lastActive).getTime()) / 60000);
    return {
      kind: "stuck",
      text: withDoingCard(`idle ${mins}m`, s.doingCardTitle),
    };
  }

  // Falling behind — in_progress students whose pace is >1 SD below class
  // median. Don't expose the raw response-field count — it counts response
  // *fields* (one per activity slot, sometimes more for multi-question
  // blocks), so "7 of 8" is misleading. Just say slower than peers, plus
  // their current doing card if they've committed to one.
  if (
    s.status === "in_progress" &&
    s.paceZ !== null &&
    s.paceZ < PACE_Z_THRESHOLD &&
    cohortStats
  ) {
    return {
      kind: "behind",
      text: withDoingCard("slower than peers", s.doingCardTitle),
    };
  }

  // Absent-ish — not started and offline, but only if other students ARE online
  // (i.e. a live lesson is in progress, so absence is meaningful, not just
  // "no one's here yet"). Don't append the doing card here — if they haven't
  // even started the lesson, any prior doing card is stale.
  if (s.status === "not_started" && !s.isOnline && onlineCount > 0) {
    return { kind: "absent", text: "hasn't started this lesson" };
  }

  return null;
}

// =========================================================================
// Component
// =========================================================================

export const CheckInRow: FC<CheckInRowProps> = ({
  students,
  cohortStats,
  onlineCount,
  snoozed,
  onSnooze,
}) => {
  // Hide entirely when no student has loaded the lesson yet — no class
  // context at all (preview before any student opens the page).
  const hasAnyActivity = students.some(
    (s) => s.status === "in_progress" || s.status === "complete",
  );
  if (!hasAnyActivity) return null;

  const flagged = students
    .filter((s) => !snoozed.has(s.id))
    .map((s) => ({ student: s, reason: buildReason(s, cohortStats, onlineCount) }))
    .filter((x): x is { student: CheckInStudent; reason: Reason } => x.reason !== null)
    .sort((a, b) => PRIORITY[a.reason.kind] - PRIORITY[b.reason.kind])
    .slice(0, MAX_CHIPS);

  // Empty state — calm, neutral, confirms the feature is watching but
  // doesn't overclaim ("on pace" would be presumptuous when no one has
  // typed yet). Matches the chip row's height so layout stays stable
  // when chips appear/disappear.
  if (flagged.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 12px",
          borderRadius: "12px",
          background: "rgba(107, 114, 128, 0.04)",
          border: "1px solid #E5E7EB",
        }}
      >
        <span style={{ fontSize: "14px", flexShrink: 0 }}>👀</span>
        <span
          style={{
            fontSize: "13px",
            color: "#6B7280",
            lineHeight: 1.3,
          }}
        >
          <strong style={{ fontWeight: 700, color: "#374151" }}>Check-in</strong>
          <span style={{ opacity: 0.85 }}> — no students need attention right now</span>
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        padding: "10px 12px",
        borderRadius: "12px",
        background: "rgba(245, 158, 11, 0.06)",
        border: "1px solid #FDE68A",
      }}
    >
      <span
        style={{
          fontSize: "12px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#92400E",
          opacity: 0.7,
          alignSelf: "center",
          marginRight: "4px",
        }}
      >
        Check on
      </span>
      {flagged.map(({ student: s, reason }) => (
        <div
          key={s.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 8px 6px 6px",
            borderRadius: "999px",
            background: "#FFFFFF",
            border: "1px solid #FDE68A",
            boxShadow: "0 1px 2px rgba(146, 64, 14, 0.04)",
          }}
        >
          <div
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              background: "#F59E0B",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 700,
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {s.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.avatar}
                alt=""
                style={{ width: "26px", height: "26px", borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              s.name.charAt(0).toUpperCase()
            )}
          </div>
          <span style={{ fontSize: "13px", color: "#92400E", lineHeight: 1.3 }}>
            <strong style={{ fontWeight: 700 }}>{s.name}</strong>
            <span style={{ opacity: 0.85 }}> — {reason.text}</span>
          </span>
          <button
            onClick={() => onSnooze(s.id)}
            aria-label={`Snooze ${s.name}`}
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              border: "none",
              background: "transparent",
              color: "#92400E",
              opacity: 0.5,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
              transition: "opacity 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.background = "rgba(146, 64, 14, 0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.5";
              e.currentTarget.style.background = "transparent";
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
