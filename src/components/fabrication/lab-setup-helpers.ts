/**
 * Pure helpers for the LabSetupClient component (Phase 8-4).
 *
 * Extracted into a sibling `.ts` so tests don't need the `.tsx`
 * transform — same convention as rule-card-helpers.ts,
 * teacher-queue-helpers.ts, fabrication-history-helpers.ts.
 *
 * Everything here is a pure function. The client component owns the
 * state store + effects; these helpers transform.
 */

import type { LabListRow } from "@/lib/fabrication/lab-orchestration";
import type { MachineProfileRow } from "@/lib/fabrication/machine-orchestration";

// ============================================================
// Derived state — building blocks for the rendered layout
// ============================================================

export interface LabWithMachines {
  lab: LabListRow;
  machines: MachineProfileRow[];
}

/**
 * Group teacher-owned machines by lab_id + zip with the lab list.
 * Labs with no machines still appear (empty grid). Machines with
 * null lab_id (shouldn't happen post-backfill, but defensive) bucket
 * into an "Unassigned" synthetic lab that the UI can show with a
 * subtle warning.
 *
 * Returns labs in the order they arrive from the API (already sorted
 * default-first + alpha by listMyLabs). Machines within each lab
 * sorted alpha.
 */
export function groupMachinesByLab(
  labs: LabListRow[],
  teacherMachines: MachineProfileRow[]
): LabWithMachines[] {
  // Bucket by lab_id.
  const byLab = new Map<string, MachineProfileRow[]>();
  const unassigned: MachineProfileRow[] = [];
  for (const m of teacherMachines) {
    if (!m.labId) {
      unassigned.push(m);
      continue;
    }
    const bucket = byLab.get(m.labId) ?? [];
    bucket.push(m);
    byLab.set(m.labId, bucket);
  }

  // Sort each bucket alpha by name (case-insensitive).
  for (const [, bucket] of byLab) {
    bucket.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }
  unassigned.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  const result: LabWithMachines[] = labs.map((lab) => ({
    lab,
    machines: byLab.get(lab.id) ?? [],
  }));

  // Append synthetic "unassigned" bucket if any exist.
  if (unassigned.length > 0) {
    result.push({
      lab: {
        id: "__unassigned__",
        schoolId: "",
        createdByTeacherId: null,
        name: "Unassigned machines",
        description: "These machines don't belong to any lab. Move them to a lab below.",
        createdAt: "",
        updatedAt: "",
        machineCount: unassigned.length,
      },
      machines: unassigned,
    });
  }

  return result;
}

/**
 * Compute whether a lab "auto-approves all" — true when every active
 * non-template machine in the lab has requires_teacher_approval = false.
 * Returns one of:
 *   "all"  — bulk toggle is ON (everything auto-approves)
 *   "none" — every machine requires approval
 *   "mixed"— some mix; UI shows the toggle as indeterminate
 *   "empty"— lab has no machines; toggle greyed
 */
export function labAutoApproveState(
  machines: MachineProfileRow[]
): "all" | "none" | "mixed" | "empty" {
  if (machines.length === 0) return "empty";
  const auto = machines.filter((m) => !m.requiresTeacherApproval).length;
  if (auto === machines.length) return "all";
  if (auto === 0) return "none";
  return "mixed";
}

/**
 * Display name for an operation colour — sentence-case for the UI.
 */
export function operationLabel(op: "cut" | "score" | "engrave"): string {
  switch (op) {
    case "cut":
      return "Cut";
    case "score":
      return "Score";
    case "engrave":
      return "Engrave";
  }
}

/**
 * Validate a hex colour string as the colour-map editor expects them.
 * Accepts `#RRGGBB` (6 hex digits with leading #). Returns the
 * canonicalised value (upper-case hex) or null if invalid.
 */
export function normaliseHex(input: string): string | null {
  const trimmed = input.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return null;
  return "#" + trimmed.slice(1).toUpperCase();
}

// ============================================================
// Colour map editor — row-based state helpers
// ============================================================

/**
 * One row in the colour-map editor = a (hex, operation) pair.
 * Editor renders the map as a list of rows so users can add/remove
 * rows, edit either field, and duplicate-check.
 */
export interface ColorMapRow {
  hex: string;
  operation: "cut" | "score" | "engrave";
}

/**
 * Convert the stored JSONB shape to an array of editor rows. Order
 * is stable (iterates Object.entries insertion order). Defaults to
 * empty array for null.
 */
export function colorMapToRows(
  map: Record<string, "cut" | "score" | "engrave"> | null | undefined
): ColorMapRow[] {
  if (!map) return [];
  return Object.entries(map).map(([hex, operation]) => ({ hex, operation }));
}

/**
 * Convert editor rows back to the stored JSONB shape. Drops invalid
 * rows (blank hex) + deduplicates: if the same hex appears twice, the
 * LAST wins (so a user can type over an existing row without triggering
 * a backend validation error).
 */
export function rowsToColorMap(
  rows: ColorMapRow[]
): Record<string, "cut" | "score" | "engrave"> {
  const out: Record<string, "cut" | "score" | "engrave"> = {};
  for (const row of rows) {
    const hex = normaliseHex(row.hex);
    if (!hex) continue;
    out[hex] = row.operation;
  }
  return out;
}

/**
 * Validate all rows in a draft colour-map. Returns the list of
 * error messages (one per problematic row). Empty list = ready to save.
 * Checks:
 *   - hex format (all non-empty rows must be valid #RRGGBB)
 *   - duplicate hex keys (editor rows with the same colour)
 */
export function validateColorMapRows(rows: ColorMapRow[]): string[] {
  const errors: string[] = [];
  const seen = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const trimmed = row.hex.trim();
    if (trimmed === "") continue; // blank rows OK — caller decides if empty map is valid
    const hex = normaliseHex(trimmed);
    if (!hex) {
      errors.push(
        `Row ${i + 1}: "${trimmed}" isn't a valid hex colour (use #RRGGBB, e.g. #FF0000).`
      );
      continue;
    }
    const priorIndex = seen.get(hex);
    if (priorIndex !== undefined) {
      errors.push(
        `Rows ${priorIndex + 1} + ${i + 1}: both use ${hex} — each colour should appear only once.`
      );
    }
    seen.set(hex, i);
  }
  return errors;
}
