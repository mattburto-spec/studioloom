/**
 * ClassMachinePicker — Preflight Phase 4-3.
 *
 * Controlled component: takes classes + machineProfiles arrays as props,
 * emits class/machine selections back via onClassChange / onMachineChange.
 * Completely stateless — parent manages selection state so 4-4 can wire
 * the full upload flow (selection + file + button) on one form.
 *
 * No data fetching here. No API calls. Just UI + callbacks. This keeps
 * the component unit-testable without mocking fetch and lets Phase 8's
 * teacher machine-admin UI reuse the component unchanged.
 */

import * as React from "react";
import {
  formatMachineLabel,
  groupMachinesByLab,
  type ClassOption,
  type MachineProfileOption,
} from "./picker-helpers";
import {
  iconForCategory,
  labelForCategory,
} from "./MachineCategoryIcons";

// Re-export types + helper so consumers of this component only need one import.
export { formatMachineLabel };
export type { ClassOption, MachineProfileOption };

/**
 * Phase 8.1d-10: type-first student picker.
 *
 * Matt's UX call 26 Apr AM: "as a student submitting a new job, i think
 * it would be best to start with the type and have pictures eg 3d print,
 * laser cutter (and other options later). this then determines which
 * machines are able to be selected because otherwise its a huge list and
 * confusing"
 *
 * Flow:
 *   1. Pick class (existing dropdown — sets the assignment context)
 *   2. Pick category (NEW — visual cards: 3D printer / Laser cutter)
 *   3. Pick specific machine (filtered by category, grouped by lab)
 *
 * The category step only renders when the teacher has machines in
 * MORE than one category. Single-category teachers see the simpler
 * 2-step flow they had before.
 */
export type MachineCategory = "3d_printer" | "laser_cutter";

export interface ClassMachinePickerProps {
  classes: ClassOption[];
  machineProfiles: MachineProfileOption[];
  selectedClassId: string | null;
  selectedCategory: MachineCategory | null;
  selectedMachineProfileId: string | null;
  onClassChange: (classId: string) => void;
  onCategoryChange: (category: MachineCategory) => void;
  onMachineChange: (machineProfileId: string) => void;
  disabled?: boolean;
}

export function ClassMachinePicker(props: ClassMachinePickerProps) {
  const {
    classes,
    machineProfiles,
    selectedClassId,
    selectedCategory,
    selectedMachineProfileId,
    onClassChange,
    onCategoryChange,
    onMachineChange,
    disabled = false,
  } = props;

  const hasClasses = classes.length > 0;

  // Phase 8.1d-10: derive available categories from the machine list.
  // A category is "available" if at least one non-template, active
  // machine has it. (System templates show in the picker for legacy
  // fallback but don't unlock a category by themselves.)
  const availableCategories = React.useMemo(() => {
    const cats = new Set<MachineCategory>();
    for (const m of machineProfiles) {
      if (m.is_system_template) continue;
      if (m.machine_category === "3d_printer") cats.add("3d_printer");
      else if (m.machine_category === "laser_cutter") cats.add("laser_cutter");
    }
    return Array.from(cats);
  }, [machineProfiles]);

  // Skip the category step entirely when only one category exists.
  // Single-lab single-category teachers see the simpler 2-step flow.
  const showCategoryStep = availableCategories.length > 1;
  const effectiveCategory = showCategoryStep
    ? selectedCategory
    : (availableCategories[0] ?? null);

  // Filter machines for the dropdown: must match the effective category.
  // System templates pass through (legacy fallback / "add from template"
  // path — students rarely see them but harmless).
  const filteredMachines = React.useMemo(() => {
    if (!effectiveCategory) return [];
    return machineProfiles.filter(
      (m) => m.is_system_template || m.machine_category === effectiveCategory
    );
  }, [machineProfiles, effectiveCategory]);

  const hasMachines = filteredMachines.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="fab-class-select"
          className="block text-sm font-semibold mb-1.5"
        >
          Class
        </label>
        <select
          id="fab-class-select"
          value={selectedClassId ?? ""}
          onChange={(e) => onClassChange(e.target.value)}
          disabled={disabled || !hasClasses}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple disabled:opacity-50"
        >
          <option value="" disabled>
            {hasClasses ? "Select a class…" : "No classes enrolled"}
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
      </div>

      {/* Phase 8.1d-10: category step — visual cards. Only shown when
           teacher has machines in MORE than one category (otherwise
           it's a needless click). */}
      {showCategoryStep && (
        <div>
          <span className="block text-sm font-semibold mb-1.5">
            What kind of machine?
          </span>
          <div
            role="radiogroup"
            aria-label="Machine category"
            className="grid grid-cols-2 gap-3"
          >
            {availableCategories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={disabled}
                  onClick={() => onCategoryChange(cat)}
                  className={
                    "flex flex-col items-center gap-2 px-4 py-5 rounded-xl border-2 transition-all " +
                    (isSelected
                      ? "border-brand-purple bg-brand-purple/5 text-brand-purple shadow-sm"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:shadow-sm") +
                    (disabled ? " opacity-50 cursor-not-allowed" : " cursor-pointer")
                  }
                >
                  <span className="w-10 h-10">{iconForCategory(cat)}</span>
                  <span className="text-sm font-semibold">
                    {labelForCategory(cat)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label
          htmlFor="fab-machine-select"
          className="block text-sm font-semibold mb-1.5"
        >
          Machine
        </label>
        {/* Phase 8.1d-5/10: machines grouped by lab name via <optgroup>,
             filtered by selected category. Single-lab schools render
             as a flat list. Multi-lab schools see "── Lab Name ──"
             headers in the dropdown. */}
        <select
          id="fab-machine-select"
          value={selectedMachineProfileId ?? ""}
          onChange={(e) => onMachineChange(e.target.value)}
          disabled={
            disabled ||
            !hasMachines ||
            (showCategoryStep && !selectedCategory)
          }
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple disabled:opacity-50"
        >
          <option value="" disabled>
            {showCategoryStep && !selectedCategory
              ? "Pick a machine type first…"
              : hasMachines
                ? "Select a machine…"
                : "No machines configured"}
          </option>
          {(() => {
            const groups = groupMachinesByLab(filteredMachines);
            // Single group: no header — render flat.
            if (groups.length === 1) {
              return groups[0].machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatMachineLabel(m)}
                </option>
              ));
            }
            // Multi-group: <optgroup> per lab.
            return groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatMachineLabel(m)}
                  </option>
                ))}
              </optgroup>
            ));
          })()}
        </select>
        {machineProfiles.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            Bed size shown is the maximum drawing area your file must fit within.
          </p>
        )}
      </div>
    </div>
  );
}

export default ClassMachinePicker;
