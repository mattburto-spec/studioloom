import { describe, it, expect } from "vitest";
import {
  formatMachineLabel,
  type MachineProfileOption,
} from "../picker-helpers";

/**
 * The project has no DOM-render test harness (no @testing-library/react,
 * no jsdom/happy-dom, no vitest environment: "jsdom" in config). Rather
 * than introduce that infrastructure for a single component, we cover
 * the pure formatting helper here. Full UI coverage happens at
 * Checkpoint 4.1 via a real upload on prod from Matt's test-student
 * account.
 *
 * Pure helpers live in `picker-helpers.ts` so this file can avoid
 * importing the `.tsx` component and triggering the JSX transform path
 * (which the project's vitest config doesn't set up — existing
 * `.test.tsx` files follow the same pattern, e.g.
 * `DesignAssistantWidget.test.tsx` extracts its parseToolLinks helper
 * rather than rendering the widget).
 */

describe("formatMachineLabel", () => {
  it("produces '{name} — 3D Printer, {x}×{y}mm' for 3d_printer category", () => {
    const p: MachineProfileOption = {
      id: "m1",
      name: "Bambu X1C",
      machine_category: "3d_printer",
      bed_size_x_mm: 256,
      bed_size_y_mm: 256,
    };
    expect(formatMachineLabel(p)).toBe("Bambu X1C — 3D Printer, 256×256mm");
  });

  it("produces '{name} — Laser, {x}×{y}mm' for laser_cutter category", () => {
    const p: MachineProfileOption = {
      id: "m2",
      name: "Glowforge Plus",
      machine_category: "laser_cutter",
      bed_size_x_mm: 495,
      bed_size_y_mm: 279,
    };
    expect(formatMachineLabel(p)).toBe("Glowforge Plus — Laser, 495×279mm");
  });

  it("falls back to '3D Printer' for unknown machine_category values", () => {
    const p: MachineProfileOption = {
      id: "m3",
      name: "Mystery Machine",
      machine_category: "unknown_type",
      bed_size_x_mm: 100,
      bed_size_y_mm: 100,
    };
    expect(formatMachineLabel(p)).toContain("3D Printer");
  });

  it("uses the rectangular dimensions verbatim (non-square bed)", () => {
    const p: MachineProfileOption = {
      id: "m4",
      name: "Ender 3",
      machine_category: "3d_printer",
      bed_size_x_mm: 235,
      bed_size_y_mm: 235,
    };
    expect(formatMachineLabel(p)).toBe("Ender 3 — 3D Printer, 235×235mm");
  });
});
