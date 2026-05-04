/* RoleChip — Phase 3 (FU-AV2-PHASE-3-CHIP-UI) — surfaces non-lead-teacher
 * roles on class cards. Lead_teacher is the default ownership role and
 * rendering a chip on every class would be noise; the chip ONLY renders
 * when the role is something else (co_teacher / dept_head / mentor /
 * lab_tech / observer).
 *
 * Closes the visual disambiguation gap surfaced in Phase 3.5 smoke
 * Scenario 2: two "7 Design" classes were visually identical on the
 * dashboard until you hovered to see the URL.
 *
 * Brief: docs/projects/access-model-v2-phase-3-brief.md §3.6 + §3.8 Q3.
 * Endpoint: GET /api/teacher/me/scope returns the teacher's role per
 * class as part of the union scope payload. Consumers fetch that and
 * pass `role` into this component per class card.
 *
 * Pure helpers (resolveRoleChip + role labels/styles) live in
 * `role-chip-helpers.ts` so they're testable without a JSX-render
 * harness. Same pattern as picker-helpers for ClassMachinePicker.
 */

import { resolveRoleChip } from "./role-chip-helpers";

interface RoleChipProps {
  /** The teacher's role on this class. Pass undefined or "lead_teacher"
   *  to hide the chip (lead is default — chip would be noise). */
  role?: string;
  /** Optional size override — "sm" (default) is 18px height, fits inline
   *  with class names. "md" is 22px for hero placements. */
  size?: "sm" | "md";
  /** Optional className for parent layout adjustments. */
  className?: string;
}

export function RoleChip({ role, size = "sm", className }: RoleChipProps) {
  const style = resolveRoleChip(role);
  if (!style) return null;

  const sizeClasses =
    size === "md"
      ? "px-2.5 py-1 text-[11.5px] rounded-full"
      : "px-2 py-0.5 text-[10.5px] rounded-full";

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wide ${sizeClasses}${className ? ` ${className}` : ""}`}
      style={{ background: style.bg, color: style.fg }}
      title={`Your role on this class: ${style.label}`}
    >
      {style.label}
    </span>
  );
}

// Re-export the type + resolver from helpers for backward compatibility
// — keeps callers that import these from RoleChip working.
export type { ClassRole } from "./role-chip-helpers";
export { resolveRoleChip } from "./role-chip-helpers";
