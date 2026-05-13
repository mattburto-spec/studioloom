/**
 * Unit Briefs Foundation — type definitions for the unit-level Brief &
 * Constraints surface.
 *
 * Tables: public.unit_briefs (one row per unit) +
 *         public.unit_brief_amendments (append-only iteration log).
 *
 * Spec: docs/projects/unit-briefs-foundation-brief.md
 *
 * Archetype-discriminated `constraints` JSONB so different unit formats
 * (Design / Service / Inquiry / PP) can carry different constraint
 * shapes. v1 ships "design" + "generic" fallback; real Service /
 * Inquiry / PP archetype schemas wait for classroom signal
 * (FU-BRIEFS-SERVICE-INQUIRY-ARCHETYPES).
 */

export type UnitBriefConstraintArchetype = "design" | "generic";

/**
 * v1 Design-archetype constraint shape. All fields optional — teacher
 * fills in what's relevant for the unit. Arrays are stored as JSONB
 * arrays of strings (chip ids for materials_whitelist; free-text for
 * must_include / must_avoid).
 */
export interface DesignConstraints {
  dimensions?: string;
  materials_whitelist?: string[];
  budget?: string;
  audience?: string;
  must_include?: string[];
  must_avoid?: string[];
}

/**
 * Discriminated union over `archetype`. Generic carries an empty data
 * object (Record<string, never>) so non-Design unit types fall back to
 * prose-only briefs (brief_text alone).
 */
export type UnitBriefConstraints =
  | { archetype: "design"; data: DesignConstraints }
  | { archetype: "generic"; data: Record<string, never> };

/**
 * Maps 1:1 to a public.unit_briefs row. PK = unit_id (one row per unit).
 * `created_by` is the teacher uuid; null only in legacy / service-role
 * insert paths that don't capture authorship.
 */
export interface UnitBrief {
  unit_id: string;
  brief_text: string | null;
  constraints: UnitBriefConstraints;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Maps 1:1 to a public.unit_brief_amendments row. Append-only — no
 * updated_at, no edits via app surfaces. Drawer renders amendments in
 * chronological order (oldest first — the brief's evolution story).
 */
export interface UnitBriefAmendment {
  id: string;
  unit_id: string;
  version_label: string;
  title: string;
  body: string;
  created_at: string;
  created_by: string | null;
}
