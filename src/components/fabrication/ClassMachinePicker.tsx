/**
 * ClassMachinePicker — Phase 4-3 → 8.1d-22 evolution.
 *
 * Step sequence (steps elide when there's only one option):
 *   1. Pick class
 *   2. Pick category (3D printer / Laser cutter)         — elided when teacher has only one
 *   3. Pick lab (Secondary Design 3rd floor / etc.)      — elided when teacher has only one in this category
 *   4. "Any [category] in [lab]" (default)               — opt-in to specific machine via toggle
 *
 * 8.1d-22 (Matt's S3 smoke 27 Apr): "we have 2x P1P and 1x P1S
 * but they all print the same really and students don't know the
 * difference … ideally the fabricator sees just 3D printing or
 * laser cutting jobs coming in." So step 4 defaults to category-
 * only ("Any 3D printer in Secondary Design"), and the fab decides
 * which physical machine to load it onto. Specific-machine still
 * available for schools that have meaningful per-machine
 * differences (P1S with AMS for multicolour vs plain P1Ps, etc.)
 * — collapsed under a "Pick a specific machine" toggle so it
 * doesn't clutter the default flow.
 *
 * Controlled component — parent owns all selection state. Lab + category
 * + machine are independent props so the parent can derive the right
 * upload payload (machineProfileId, OR labId+machineCategory).
 */

import * as React from "react";
import {
  formatMachineLabel,
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

export type MachineCategory = "3d_printer" | "laser_cutter";

export interface ClassMachinePickerProps {
  classes: ClassOption[];
  machineProfiles: MachineProfileOption[];
  selectedClassId: string | null;
  selectedCategory: MachineCategory | null;
  /** Phase 8.1d-22: lab is now an explicit selection (not derived from
   *  the picked machine). Required for "Any [category] in [lab]"
   *  uploads; also disambiguates specific-machine picks across labs. */
  selectedLabId: string | null;
  selectedMachineProfileId: string | null;
  onClassChange: (classId: string) => void;
  onCategoryChange: (category: MachineCategory) => void;
  onLabChange: (labId: string) => void;
  /** Pass null to clear specific-machine selection (revert to "Any X"). */
  onMachineChange: (machineProfileId: string | null) => void;
  disabled?: boolean;
}

interface LabSummary {
  id: string;
  name: string;
}

export function ClassMachinePicker(props: ClassMachinePickerProps) {
  const {
    classes,
    machineProfiles,
    selectedClassId,
    selectedCategory,
    selectedLabId,
    selectedMachineProfileId,
    onClassChange,
    onCategoryChange,
    onLabChange,
    onMachineChange,
    disabled = false,
  } = props;

  const hasClasses = classes.length > 0;

  // Available categories — only those with at least one active,
  // non-template, lab-bound machine count.
  const availableCategories = React.useMemo(() => {
    const cats = new Set<MachineCategory>();
    for (const m of machineProfiles) {
      if (m.is_system_template) continue;
      if (!m.lab_id) continue; // orphan machines don't unlock a category
      if (m.machine_category === "3d_printer") cats.add("3d_printer");
      else if (m.machine_category === "laser_cutter") cats.add("laser_cutter");
    }
    return Array.from(cats);
  }, [machineProfiles]);

  const showCategoryStep = availableCategories.length > 1;
  const effectiveCategory = showCategoryStep
    ? selectedCategory
    : (availableCategories[0] ?? null);

  // Available labs in the picked category.
  const availableLabs = React.useMemo<LabSummary[]>(() => {
    if (!effectiveCategory) return [];
    const seen = new Map<string, LabSummary>();
    for (const m of machineProfiles) {
      if (m.is_system_template) continue;
      if (!m.lab_id || !m.lab_name) continue;
      if (m.machine_category !== effectiveCategory) continue;
      if (!seen.has(m.lab_id)) {
        seen.set(m.lab_id, { id: m.lab_id, name: m.lab_name });
      }
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [machineProfiles, effectiveCategory]);

  const showLabStep = availableLabs.length > 1;
  const effectiveLabId = showLabStep
    ? selectedLabId
    : (availableLabs[0]?.id ?? null);

  // Auto-pick the only lab when there's just one — keeps the parent
  // state in sync without forcing the user to click. Same pattern as
  // single-category auto-resolution.
  React.useEffect(() => {
    if (!showLabStep && availableLabs.length === 1 && selectedLabId !== availableLabs[0].id) {
      onLabChange(availableLabs[0].id);
    }
  }, [showLabStep, availableLabs, selectedLabId, onLabChange]);

  // Same for single-category auto-resolution.
  React.useEffect(() => {
    if (
      !showCategoryStep &&
      availableCategories.length === 1 &&
      selectedCategory !== availableCategories[0]
    ) {
      onCategoryChange(availableCategories[0]);
    }
  }, [showCategoryStep, availableCategories, selectedCategory, onCategoryChange]);

  // Specific-machine picker visibility — collapsed by default, opens
  // when the user toggles "Pick a specific machine".
  const [showSpecific, setShowSpecific] = React.useState(false);
  // If the parent has a specific machine selected (e.g. on edit /
  // navigation back), keep the specific picker open so they can see
  // their selection.
  React.useEffect(() => {
    if (selectedMachineProfileId) setShowSpecific(true);
  }, [selectedMachineProfileId]);

  // Filter the specific-machine list to lab + category.
  const specificMachines = React.useMemo(() => {
    if (!effectiveCategory || !effectiveLabId) return [];
    return machineProfiles.filter(
      (m) =>
        !m.is_system_template &&
        m.lab_id === effectiveLabId &&
        m.machine_category === effectiveCategory
    );
  }, [machineProfiles, effectiveCategory, effectiveLabId]);

  const labelForLab = (id: string | null) =>
    availableLabs.find((l) => l.id === id)?.name ?? "this lab";

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

      {/* Phase 8.1d-22: lab picker. Only renders when there's >1 lab
           in the chosen category. Single-lab schools auto-resolve in
           the effect above. */}
      {showLabStep && (
        <div>
          <label
            htmlFor="fab-lab-select"
            className="block text-sm font-semibold mb-1.5"
          >
            Lab
          </label>
          <select
            id="fab-lab-select"
            value={selectedLabId ?? ""}
            onChange={(e) => onLabChange(e.target.value)}
            disabled={
              disabled ||
              (showCategoryStep && !selectedCategory)
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple disabled:opacity-50"
          >
            <option value="" disabled>
              {showCategoryStep && !selectedCategory
                ? "Pick a machine type first…"
                : "Select a lab…"}
            </option>
            {availableLabs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Phase 8.1d-22: "Any [category] in [lab]" default summary +
           collapsible specific-machine picker. */}
      {effectiveCategory && effectiveLabId && (
        <div>
          <span className="block text-sm font-semibold mb-1.5">
            Machine
          </span>
          {!showSpecific ? (
            <div className="rounded-lg border-2 border-brand-purple bg-brand-purple/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-semibold text-brand-purple">
                    Any {labelForCategory(effectiveCategory).toLowerCase()}
                  </span>
                  {showLabStep && (
                    <span className="text-gray-700">
                      {" "}
                      in {labelForLab(effectiveLabId)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowSpecific(true)}
                  disabled={disabled || specificMachines.length === 0}
                  className="text-xs font-semibold text-brand-purple hover:underline disabled:opacity-50 disabled:no-underline shrink-0"
                >
                  Pick a specific machine →
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1.5 leading-snug">
                The fabricator picks an available {labelForCategory(effectiveCategory).toLowerCase()} when your
                file&apos;s next in the queue.{" "}
                {specificMachines.length === 0 &&
                  "(No specific machines available — keep this default.)"}
              </p>
            </div>
          ) : (
            <div>
              <select
                id="fab-machine-select"
                value={selectedMachineProfileId ?? ""}
                onChange={(e) => onMachineChange(e.target.value)}
                disabled={disabled || specificMachines.length === 0}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple disabled:opacity-50"
              >
                <option value="" disabled>
                  {specificMachines.length > 0
                    ? "Select a specific machine…"
                    : "No specific machines in this lab"}
                </option>
                {specificMachines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatMachineLabel(m)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setShowSpecific(false);
                  onMachineChange(null);
                }}
                disabled={disabled}
                className="text-xs font-semibold text-brand-purple hover:underline mt-2 disabled:opacity-50"
              >
                ← Use any {labelForCategory(effectiveCategory).toLowerCase()} instead
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ClassMachinePicker;
