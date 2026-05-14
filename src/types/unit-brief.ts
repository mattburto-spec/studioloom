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
 * Unit of measure for dimensions. Free-text would be cleaner UX in
 * some cases (e.g. "fits in a shoebox") but Matt asked for explicit
 * H×W×D numeric inputs after Phase B smoke. Free-text is recoverable
 * via must_include if a teacher needs that shape.
 */
export type DimensionUnit = "mm" | "cm" | "in";

/**
 * Structured H×W×D dimensions. All three axes optional so a teacher
 * can constrain just one (e.g. "max 200mm tall, no width/depth cap")
 * without forcing zeros. Unit defaults to mm at render time.
 */
export interface DesignDimensions {
  h?: number;
  w?: number;
  d?: number;
  unit?: DimensionUnit;
}

/**
 * v1 Design-archetype constraint shape. All fields optional — teacher
 * fills in what's relevant for the unit. Arrays are stored as JSONB
 * arrays of strings (chip ids for catalogue materials + free-text for
 * teacher-added custom materials; free-text for must_include / must_avoid).
 */
export interface DesignConstraints {
  dimensions?: DesignDimensions;
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
 *
 * `diagram_url` (Phase B.5) is a relative storage-proxy URL pointing at
 * the unit-images bucket (path: <unitId>/brief-diagram-<ts>.jpg). NULL
 * = no diagram uploaded. One diagram per brief; re-upload replaces.
 *
 * `locks` (Phase F.A) is a flat path-keyed lock map. Locked fields
 * show the teacher's value read-only to students; unlocked fields are
 * student-editable (with teacher value as a starter). Default {} =
 * nothing locked. See LOCKABLE_FIELDS for the canonical key list.
 */
export interface UnitBrief {
  unit_id: string;
  brief_text: string | null;
  constraints: UnitBriefConstraints;
  diagram_url: string | null;
  locks: UnitBriefLocks;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// ─── Phase F.A — lock map + student briefs ────────────────────────────

/**
 * Canonical lockable field paths. Flat dotted-path keys — simpler
 * queries + TS types than a nested map. Editors that render a 🔒
 * toggle iterate this constant so adding a new field to the brief
 * shape requires one edit here.
 */
export const LOCKABLE_FIELDS = [
  "brief_text",
  "diagram_url",
  "constraints.dimensions",
  "constraints.materials_whitelist",
  "constraints.budget",
  "constraints.audience",
  "constraints.must_include",
  "constraints.must_avoid",
] as const;

export type LockableField = (typeof LOCKABLE_FIELDS)[number];

/**
 * Lock map stored as a flat JSONB on unit_briefs.locks (and the
 * brief_locks columns on choice_cards). Absent key OR explicit false =
 * unlocked. Only `true` means locked. The renderer + editor narrow on
 * `locks[field] === true` everywhere so unknown keys are silently
 * ignored (defensive against schema drift).
 */
export type UnitBriefLocks = Partial<Record<LockableField, boolean>>;

/**
 * Maps 1:1 to a public.student_briefs row. Per-student-per-unit; one
 * row per student per unit, created lazily on first override save.
 *
 * Holds the student's overrides for unlocked brief fields. NULL /
 * empty values fall through to the template (choice-card brief
 * template if the student has picked one for the unit AND the card
 * has a template; otherwise unit_briefs).
 *
 * `diagram_url` reserved for future student diagram uploads — not
 * wired in Phase F (teacher-only diagram in v1; column present so a
 * later phase can add upload without a migration).
 */
export interface StudentBrief {
  id: string;
  student_id: string;
  unit_id: string;
  brief_text: string | null;
  constraints: UnitBriefConstraints;
  diagram_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Resolved brief shown to students AND used by the teacher review tab.
 * Merge result of (choice-card template if picked → unit_brief
 * fallback) overlaid with student_brief overrides on unlocked fields.
 *
 * Each field carries a `source` so the renderer can show a 🔒 icon on
 * locked fields and a faint "from your teacher" / "your override"
 * affordance on starter / overridden fields respectively.
 */
export type EffectiveBriefFieldSource =
  | "teacher" // teacher-authored at unit level (unit_briefs)
  | "card" // choice-card template (choice_cards.brief_*)
  | "student" // student override (student_briefs)
  | "empty"; // no value at all yet

export interface EffectiveBriefField<T> {
  value: T | null;
  locked: boolean;
  source: EffectiveBriefFieldSource;
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
