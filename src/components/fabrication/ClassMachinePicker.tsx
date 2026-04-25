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

// Re-export types + helper so consumers of this component only need one import.
export { formatMachineLabel };
export type { ClassOption, MachineProfileOption };

export interface ClassMachinePickerProps {
  classes: ClassOption[];
  machineProfiles: MachineProfileOption[];
  selectedClassId: string | null;
  selectedMachineProfileId: string | null;
  onClassChange: (classId: string) => void;
  onMachineChange: (machineProfileId: string) => void;
  disabled?: boolean;
}

export function ClassMachinePicker(props: ClassMachinePickerProps) {
  const {
    classes,
    machineProfiles,
    selectedClassId,
    selectedMachineProfileId,
    onClassChange,
    onMachineChange,
    disabled = false,
  } = props;

  const hasClasses = classes.length > 0;
  const hasMachines = machineProfiles.length > 0;

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

      <div>
        <label
          htmlFor="fab-machine-select"
          className="block text-sm font-semibold mb-1.5"
        >
          Machine
        </label>
        {/* Phase 8.1d-5: machines grouped by lab name via <optgroup>.
             Single-lab schools (one group) render as a flat list with
             no group header — native <optgroup> behaviour. Multi-lab
             schools see "── Lab Name ──" headers in the dropdown. */}
        <select
          id="fab-machine-select"
          value={selectedMachineProfileId ?? ""}
          onChange={(e) => onMachineChange(e.target.value)}
          disabled={disabled || !hasMachines}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple disabled:opacity-50"
        >
          <option value="" disabled>
            {hasMachines ? "Select a machine…" : "No machines configured"}
          </option>
          {(() => {
            const groups = groupMachinesByLab(machineProfiles);
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
