/* Pure helpers for the RoleChip component — Phase 3 (FU-AV2-PHASE-3-CHIP-UI).
 *
 * Lives in a separate `.ts` file (not `.tsx`) so the project's vitest
 * config can import + test it without setting up a JSX transform. Same
 * pattern as `picker-helpers.ts` for ClassMachinePicker.
 */

export type ClassRole =
  | "lead_teacher"
  | "co_teacher"
  | "dept_head"
  | "mentor"
  | "lab_tech"
  | "observer";

export const ROLE_LABELS: Record<Exclude<ClassRole, "lead_teacher">, string> = {
  co_teacher: "Co-teacher",
  dept_head: "Dept head",
  mentor: "Mentor",
  lab_tech: "Lab tech",
  observer: "Observer",
};

export const ROLE_STYLES: Record<
  Exclude<ClassRole, "lead_teacher">,
  { bg: string; fg: string; label: string }
> = {
  co_teacher: { bg: "#DBEAFE", fg: "#1E40AF", label: ROLE_LABELS.co_teacher },
  dept_head: { bg: "#EDE9FE", fg: "#5B21B6", label: ROLE_LABELS.dept_head },
  mentor: { bg: "#D1FAE5", fg: "#065F46", label: ROLE_LABELS.mentor },
  lab_tech: { bg: "#FEF3C7", fg: "#92400E", label: ROLE_LABELS.lab_tech },
  observer: { bg: "#E5E7EB", fg: "#374151", label: ROLE_LABELS.observer },
};

/**
 * Resolves a role string to its display style + label, or null when
 * the chip should be hidden (lead_teacher = default ownership /
 * undefined = no role data yet / unknown role = defensive).
 */
export function resolveRoleChip(
  role: string | undefined
): { bg: string; fg: string; label: string } | null {
  if (!role || role === "lead_teacher") return null;
  const style = ROLE_STYLES[role as Exclude<ClassRole, "lead_teacher">];
  return style ?? null;
}
