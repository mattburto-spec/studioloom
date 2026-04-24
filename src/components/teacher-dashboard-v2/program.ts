/* Program mapping for the scope chip.
 *
 * A "program" is the pedagogical frame a class operates in — MYP Design,
 * PYPX (PYP Exhibition), Service as Action, Personal Project, Inquiry.
 * Each has different teacher workflows, so Phase 13 will render
 * different dashboard bodies per program.
 *
 * Phase 12 establishes the vocabulary + filter plumbing. The scope chip
 * lists the programs the teacher actually teaches (derived from their
 * classes), and the dashboard narrows its hero/rail/insights/units/admin
 * to the classes matching the selected program.
 *
 * Mapping rules (Phase 12 MVP — simple; refine when edge cases bite):
 *  1. PYP framework → "pypx" (Exhibition is the PYP capstone).
 *  2. Else pick the first active unit's unit_type and map it:
 *       service → "service"
 *       pp      → "pp"
 *       inquiry → "inquiry"
 *       design  → "design"
 *  3. No units yet → fall back to "design" (the most common default for
 *     MYP/GCSE/A-Level/IGCSE/PLTW/ACARA Design frameworks).
 *
 * Future: distinguish between framework-specific design programs
 * (MYP vs GCSE vs A-Level) when teachers want to see them separately.
 */

import type { DashboardClass } from "@/types/dashboard";

export type ProgramId = "design" | "pypx" | "service" | "pp" | "inquiry";

export interface ProgramMeta {
  id: ProgramId;
  name: string;
  /** Bold-palette hex. */
  color: string;
  /** Emoji glyph. */
  icon: string;
}

export const PROGRAMS: Record<ProgramId, ProgramMeta> = {
  design:  { id: "design",  name: "Design",            color: "#E86F2C", icon: "🛠" },
  pypx:    { id: "pypx",    name: "PYPX",              color: "#9333EA", icon: "🌱" },
  service: { id: "service", name: "Service as Action", color: "#10B981", icon: "🤝" },
  pp:      { id: "pp",      name: "Personal Project",  color: "#3B82F6", icon: "🧭" },
  inquiry: { id: "inquiry", name: "Inquiry",           color: "#F59E0B", icon: "🔍" },
};

/** Resolve a class to a single program ID. See file comment for rules. */
export function getClassProgram(cls: DashboardClass): ProgramId {
  const framework = (cls.framework ?? "").toUpperCase();
  if (framework === "PYP") return "pypx";
  const unitType = cls.units[0]?.unitType;
  if (unitType === "service") return "service";
  if (unitType === "pp") return "pp";
  if (unitType === "inquiry") return "inquiry";
  return "design";
}

/** Unique program metadata entries for the teacher's current class
 *  roster. Preserves the PROGRAMS canonical order so the chip doesn't
 *  reshuffle when classes change. */
export function deriveTeacherPrograms(
  classes: DashboardClass[],
): ProgramMeta[] {
  const present = new Set<ProgramId>();
  for (const c of classes) present.add(getClassProgram(c));
  return (Object.keys(PROGRAMS) as ProgramId[])
    .filter((id) => present.has(id))
    .map((id) => PROGRAMS[id]);
}

/** Filter a class list to a single program, or return everything for
 *  the "all" sentinel. Hero/rail/insights/units use this to narrow
 *  their view. */
export function filterClassesByScope(
  classes: DashboardClass[],
  scope: string,
): DashboardClass[] {
  if (scope === "all") return classes;
  return classes.filter((c) => getClassProgram(c) === scope);
}
