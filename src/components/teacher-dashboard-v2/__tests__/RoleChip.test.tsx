/* RoleChip resolver tests — Phase 3 (FU-AV2-PHASE-3-CHIP-UI).
 *
 * The project intentionally has no DOM-render test harness (no
 * @testing-library/react, no jsdom). Following existing pattern (see
 * ClassMachinePicker.test.tsx + picker-helpers.ts), we test the pure
 * resolver from role-chip-helpers.ts rather than rendering JSX. The
 * RoleChip component itself is a thin wrapper around this resolver.
 */

import { describe, it, expect } from "vitest";
import {
  resolveRoleChip,
  ROLE_LABELS,
  ROLE_STYLES,
} from "../role-chip-helpers";

describe("resolveRoleChip", () => {
  it("returns null when role is undefined (chip hidden — no role data yet)", () => {
    expect(resolveRoleChip(undefined)).toBeNull();
  });

  it("returns null for lead_teacher (default ownership — chip would be noise)", () => {
    expect(resolveRoleChip("lead_teacher")).toBeNull();
  });

  it("returns the correct label + style colors for co_teacher", () => {
    const r = resolveRoleChip("co_teacher");
    expect(r).not.toBeNull();
    expect(r!.label).toBe("Co-teacher");
    expect(r!.bg).toBe("#DBEAFE");
    expect(r!.fg).toBe("#1E40AF");
  });

  it("returns labels for every non-lead role", () => {
    const cases: Array<[string, string]> = [
      ["co_teacher", "Co-teacher"],
      ["dept_head", "Dept head"],
      ["mentor", "Mentor"],
      ["lab_tech", "Lab tech"],
      ["observer", "Observer"],
    ];
    for (const [role, label] of cases) {
      const r = resolveRoleChip(role);
      expect(r).not.toBeNull();
      expect(r!.label).toBe(label);
    }
  });

  it("returns null for an unknown role (defensive — don't render unknown badges)", () => {
    expect(resolveRoleChip("non_existent_role")).toBeNull();
    expect(resolveRoleChip("school_admin")).toBeNull(); // Decision 7 — no school admin role at school scope
    expect(resolveRoleChip("")).toBeNull();
  });

  it("each non-lead role has a distinct fg color (visual disambiguation)", () => {
    const roles = ["co_teacher", "dept_head", "mentor", "lab_tech", "observer"];
    const fgs = roles.map((r) => resolveRoleChip(r)!.fg);
    expect(new Set(fgs).size).toBe(roles.length);
  });
});

describe("ROLE_LABELS + ROLE_STYLES exhaustive coverage", () => {
  it("every key in ROLE_LABELS has a matching style", () => {
    for (const key of Object.keys(ROLE_LABELS)) {
      expect(ROLE_STYLES[key as keyof typeof ROLE_STYLES]).toBeDefined();
    }
  });

  it("ROLE_STYLES covers exactly the 5 non-lead-teacher roles from class_members enum", () => {
    expect(Object.keys(ROLE_STYLES).sort()).toEqual([
      "co_teacher",
      "dept_head",
      "lab_tech",
      "mentor",
      "observer",
    ]);
  });
});
