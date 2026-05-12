/**
 * Live status label for a student row in Teaching Mode.
 *
 * The DB `status` (not_started / in_progress / complete) only tells you
 * what's been saved — not what the student is doing right now. A student
 * who autosaved 8 hours ago technically has `status = "in_progress"` but
 * showing them as "Working" is misleading. This helper refines the pill
 * for in-progress students using `isOnline` (autosave in last 5min) and
 * the `lastActive` timestamp.
 *
 * `complete` and `not_started` are outcomes, not live states — those
 * labels stay regardless of online state.
 */

export type LiveStatusInput = {
  status: "not_started" | "in_progress" | "complete";
  isOnline: boolean;
  lastActive: string | null;
};

export type LiveStatusLabel = {
  label: string;
  /** Foreground / pill text color. */
  color: string;
  /** Pill background. */
  bg: string;
  /** Avatar ring color (matches color family). */
  ring: string;
};

/** Pure now-injection for tests. */
export function getLiveStatusLabel(
  input: LiveStatusInput,
  nowMs: number = Date.now(),
): LiveStatusLabel {
  if (input.status === "complete") {
    return { label: "Done", color: "#059669", bg: "#ECFDF5", ring: "#A7F3D0" };
  }
  if (input.status === "not_started") {
    return { label: "Not Started", color: "#9CA3AF", bg: "#F9FAFB", ring: "#E5E7EB" };
  }

  // status === "in_progress" — differentiate by liveness
  if (input.isOnline) {
    return { label: "Working", color: "#2563EB", bg: "#EFF6FF", ring: "#BFDBFE" };
  }

  if (!input.lastActive) {
    // Edge case: in_progress with no timestamp. Don't claim Working.
    return { label: "Idle", color: "#6B7280", bg: "#F3F4F6", ring: "#E5E7EB" };
  }

  const mins = Math.floor((nowMs - new Date(input.lastActive).getTime()) / 60000);

  if (mins < 30) {
    return {
      label: `Idle ${mins}m`,
      color: "#6B7280",
      bg: "#F3F4F6",
      ring: "#E5E7EB",
    };
  }
  if (mins < 120) {
    return { label: "Away", color: "#6B7280", bg: "#F3F4F6", ring: "#E5E7EB" };
  }
  // >= 2h — drop the "Working" pretense entirely; show relative time
  return {
    label: formatHoursAgo(mins),
    color: "#9CA3AF",
    bg: "#F9FAFB",
    ring: "#E5E7EB",
  };
}

function formatHoursAgo(mins: number): string {
  if (mins < 1440) {
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  }
  const days = Math.floor(mins / 1440);
  return `${days}d ago`;
}
