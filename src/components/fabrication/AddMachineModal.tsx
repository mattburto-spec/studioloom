"use client";

/**
 * AddMachineModal — Phase 8-4 + 8.1d-13 type-first picker.
 *
 * Two-step picker:
 *   Step 1 — pick a machine category (3D printer / Laser cutter)
 *            via visual cards with icons. Mirrors the student-side
 *            ClassMachinePicker pattern from 8.1d-10. Only renders
 *            categories with at least one available template (so a
 *            single-laser school doesn't see the 3D-printer card).
 *   Step 2 — pick a specific template within that category, or
 *            "Start from scratch" with the category pre-selected.
 *
 * Why two steps: the previous flat-list picker showed all 12+
 * templates at once with subtle category headings, easy to miss.
 * Schools with one printer type were also forced to scan past
 * irrelevant templates. Type-first scales to vinyl cutters / CNC
 * mills / etc. without the modal getting longer.
 *
 * Either choice hands off to MachineEditModal for the actual field
 * editing.
 */

import * as React from "react";
import { MachineEditModal } from "./MachineEditModal";
import {
  iconForCategory,
  labelForCategory,
} from "./MachineCategoryIcons";
import type { MachineProfileRow } from "@/lib/fabrication/machine-orchestration";
import type { MachineCategory } from "./ClassMachinePicker";

interface Props {
  labId: string;
  templates: MachineProfileRow[];
  onClose: () => void;
  onSaved: () => void;
}

export function AddMachineModal({ labId, templates, onClose, onSaved }: Props) {
  const [category, setCategory] = React.useState<MachineCategory | null>(null);
  const [choice, setChoice] = React.useState<
    | { kind: "picker" }
    | { kind: "template"; template: MachineProfileRow }
    | { kind: "scratch"; category: MachineCategory }
  >({ kind: "picker" });

  if (choice.kind === "template") {
    return (
      <MachineEditModal
        mode={{ kind: "create", labId, fromTemplate: choice.template }}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  if (choice.kind === "scratch") {
    return (
      <MachineEditModal
        mode={{
          kind: "create",
          labId,
          defaultCategory: choice.category,
        }}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  // Derive available categories from the seeded template list. A
  // category only renders if at least one template ships in it —
  // keeps the picker honest as new categories (vinyl, CNC) get
  // added but before templates exist.
  const availableCategories: MachineCategory[] = (() => {
    const set = new Set<MachineCategory>();
    for (const t of templates) {
      if (t.machineCategory === "3d_printer") set.add("3d_printer");
      else if (t.machineCategory === "laser_cutter") set.add("laser_cutter");
    }
    return Array.from(set);
  })();

  // Step 1: category picker
  if (category === null) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Add a machine
              </h2>
              <p className="text-sm text-gray-600">
                Start by picking what kind of machine it is.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-gray-400 hover:text-gray-600 px-2"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div
            role="radiogroup"
            aria-label="Machine category"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {availableCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                role="radio"
                aria-checked={false}
                onClick={() => setCategory(cat)}
                className="flex flex-col items-center gap-3 px-4 py-6 rounded-xl border-2 border-gray-200 bg-white text-gray-700 hover:border-brand-purple hover:bg-brand-purple/5 hover:text-brand-purple hover:shadow-sm transition-all cursor-pointer"
              >
                <span className="w-12 h-12">{iconForCategory(cat)}</span>
                <span className="text-sm font-semibold">
                  {labelForCategory(cat)}
                </span>
                <span className="text-xs text-gray-500">
                  {templates.filter((t) => t.machineCategory === cat).length}{" "}
                  templates
                </span>
              </button>
            ))}
          </div>

          {availableCategories.length === 0 && (
            <p className="text-sm text-gray-500 italic text-center py-4">
              No system templates available. You can still build a custom
              machine from scratch below.
            </p>
          )}

          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">
              Building something the templates don&apos;t cover (yet)?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Start-from-scratch shortcuts so a power-user
                  doesn't have to pick a category they're going to
                  override anyway. Same per-category resolution as
                  the post-pick path. */}
              <button
                type="button"
                onClick={() =>
                  setChoice({ kind: "scratch", category: "3d_printer" })
                }
                className="text-left rounded border border-dashed border-gray-300 bg-white p-3 hover:border-brand-purple/50 hover:bg-gray-50 transition"
              >
                <p className="text-sm font-semibold text-gray-900">
                  + Custom 3D printer
                </p>
                <p className="text-xs text-gray-500">
                  Not in the template list? Build from scratch.
                </p>
              </button>
              <button
                type="button"
                onClick={() =>
                  setChoice({ kind: "scratch", category: "laser_cutter" })
                }
                className="text-left rounded border border-dashed border-gray-300 bg-white p-3 hover:border-brand-purple/50 hover:bg-gray-50 transition"
              >
                <p className="text-sm font-semibold text-gray-900">
                  + Custom laser cutter
                </p>
                <p className="text-xs text-gray-500">
                  Not in the template list? Build from scratch.
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: specific template within the picked category
  const filteredTemplates = templates.filter(
    (t) => t.machineCategory === category
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <button
              type="button"
              onClick={() => setCategory(null)}
              className="text-xs text-gray-500 hover:text-brand-purple mb-1 flex items-center gap-1"
            >
              ← Back to categories
            </button>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 text-brand-purple">
                {iconForCategory(category)}
              </span>
              Add a {labelForCategory(category).toLowerCase()}
            </h2>
            <p className="text-sm text-gray-600">
              Pick a specific model to copy specs from, or start from scratch.
              You can rename the machine after.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600 px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <section>
            {filteredTemplates.length === 0 ? (
              <p className="text-xs text-gray-500 italic">
                No templates in this category yet — use &quot;Start from
                scratch&quot; below.
              </p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredTemplates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setChoice({ kind: "template", template: t })
                      }
                      className="w-full text-left rounded border border-gray-200 bg-white p-3 hover:border-brand-purple/50 hover:bg-gray-50 transition"
                    >
                      <p className="text-sm font-semibold text-gray-900">
                        {t.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t.bedSizeXMm}×{t.bedSizeYMm}
                        {t.bedSizeZMm ? `×${t.bedSizeZMm}` : ""} mm
                        {t.kerfMm != null ? ` · kerf ${t.kerfMm} mm` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setChoice({ kind: "scratch", category })}
              className="w-full text-left rounded border border-dashed border-gray-300 bg-white p-3 hover:border-brand-purple/50 hover:bg-gray-50 transition"
            >
              <p className="text-sm font-semibold text-gray-900">
                + Start from scratch
              </p>
              <p className="text-xs text-gray-500">
                Build a custom {labelForCategory(category).toLowerCase()}{" "}
                profile not in the template list.
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
