"use client";

/**
 * MachineEditModal — Phase 8-4.
 *
 * Edit + create machine modal. Handles both paths:
 *  - Create from scratch (all fields blank)
 *  - Create from template (template name pre-fills, spec inherited)
 *  - Edit existing (all fields pre-filled, some fields locked —
 *    machineCategory can't change, lab_id moves via different flow)
 *
 * PATCHes via /api/teacher/machine-profiles or
 * /api/teacher/machine-profiles/[id]. On success calls `onSaved(row)`
 * so the parent can refresh its list.
 */

import * as React from "react";
import { OperationColorMapEditor } from "./OperationColorMapEditor";
import {
  colorMapToRows,
  rowsToColorMap,
  validateColorMapRows,
  type ColorMapRow,
} from "./lab-setup-helpers";
import { PrinterIcon, LaserIcon } from "./MachineCategoryIcons";
import type {
  MachineProfileRow,
  MachineCategory,
  OperationColorMap,
} from "@/lib/fabrication/machine-orchestration";
import type { LabListRow } from "@/lib/fabrication/lab-orchestration";

type Mode =
  | { kind: "create"; labId: string; fromTemplate?: MachineProfileRow }
  | { kind: "edit"; machine: MachineProfileRow };

interface Props {
  mode: Mode;
  /** Phase 8.1d-4: in edit mode, used to populate the "Move to lab"
   *  dropdown so teachers can reassign a machine between labs (or
   *  out of the orphan/Unassigned bucket). Optional — falls back
   *  to "current lab only" if not provided. */
  availableLabs?: LabListRow[];
  onClose: () => void;
  onSaved: (machine: MachineProfileRow) => void;
}

export function MachineEditModal({ mode, availableLabs, onClose, onSaved }: Props) {
  const existing: MachineProfileRow | null =
    mode.kind === "edit" ? mode.machine : mode.fromTemplate ?? null;

  const [name, setName] = React.useState(
    mode.kind === "edit" ? mode.machine.name : mode.fromTemplate?.name ?? ""
  );
  const [category, setCategory] = React.useState<MachineCategory>(
    existing?.machineCategory ?? "3d_printer"
  );
  const [machineModel, setMachineModel] = React.useState(
    existing?.machineModel ?? ""
  );
  const [bedX, setBedX] = React.useState(existing?.bedSizeXMm?.toString() ?? "");
  const [bedY, setBedY] = React.useState(existing?.bedSizeYMm?.toString() ?? "");
  const [bedZ, setBedZ] = React.useState(existing?.bedSizeZMm?.toString() ?? "");
  const [nozzle, setNozzle] = React.useState(
    existing?.nozzleDiameterMm?.toString() ?? ""
  );
  const [kerf, setKerf] = React.useState(existing?.kerfMm?.toString() ?? "");
  const [minFeature, setMinFeature] = React.useState(
    existing?.minFeatureMm?.toString() ?? ""
  );
  const [requiresApproval, setRequiresApproval] = React.useState(
    existing?.requiresTeacherApproval ?? false
  );
  const [notes, setNotes] = React.useState(existing?.notes ?? "");
  const [colorMapRows, setColorMapRows] = React.useState<ColorMapRow[]>(
    colorMapToRows(existing?.operationColorMap)
  );
  // Phase 8.1d-4: lab selection. In edit mode, defaults to the
  // machine's current lab (or "" for orphan). In create mode, the
  // lab is fixed via mode.labId — dropdown is hidden.
  const [labId, setLabId] = React.useState<string>(
    mode.kind === "edit" ? mode.machine.labId ?? "" : mode.labId
  );

  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const isLaser = category === "laser_cutter";
  const colorMapErrors = React.useMemo(
    () => validateColorMapRows(colorMapRows),
    [colorMapRows]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Machine name is required.");
      return;
    }
    if (isLaser && colorMapErrors.length > 0) {
      setErrorMessage("Fix the colour-map errors before saving.");
      return;
    }
    const bedXNum = bedX === "" ? null : Number(bedX);
    const bedYNum = bedY === "" ? null : Number(bedY);
    if (
      mode.kind === "create" &&
      !mode.fromTemplate &&
      (!bedXNum || !bedYNum || !Number.isFinite(bedXNum) || !Number.isFinite(bedYNum))
    ) {
      setErrorMessage("Bed size (X and Y) is required for new machines.");
      return;
    }

    const colorMap: OperationColorMap | null = isLaser
      ? rowsToColorMap(colorMapRows)
      : null;

    const payload: Record<string, unknown> = {
      name: name.trim(),
      machineModel: machineModel.trim() || null,
      requiresTeacherApproval: requiresApproval,
      notes: notes.trim() || null,
      operationColorMap: isLaser ? colorMap : null,
    };
    // Optional numeric fields — only include if set.
    if (bedX !== "") payload.bedSizeXMm = Number(bedX);
    if (bedY !== "") payload.bedSizeYMm = Number(bedY);
    if (bedZ !== "") payload.bedSizeZMm = Number(bedZ);
    else if (mode.kind === "edit") payload.bedSizeZMm = null;
    if (nozzle !== "") payload.nozzleDiameterMm = Number(nozzle);
    else if (mode.kind === "edit") payload.nozzleDiameterMm = null;
    if (kerf !== "") payload.kerfMm = Number(kerf);
    else if (mode.kind === "edit") payload.kerfMm = null;
    if (minFeature !== "") payload.minFeatureMm = Number(minFeature);
    else if (mode.kind === "edit") payload.minFeatureMm = null;

    // Phase 8.1d-4: include labId only when we're editing AND it
    // changed. Create-mode lab assignment goes via createPayload.labId
    // below. labId="" in edit mode means "leave the orphan state
    // alone" — server ignores undefined.
    if (mode.kind === "edit" && labId && labId !== mode.machine.labId) {
      payload.labId = labId;
    }

    setSubmitting(true);
    try {
      let res: Response;
      if (mode.kind === "create") {
        const createPayload: Record<string, unknown> = {
          ...payload,
          labId: mode.labId,
          machineCategory: mode.fromTemplate
            ? undefined
            : category,
        };
        if (mode.fromTemplate) createPayload.fromTemplateId = mode.fromTemplate.id;
        res = await fetch("/api/teacher/machine-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
          credentials: "same-origin",
        });
      } else {
        res = await fetch(
          `/api/teacher/machine-profiles/${mode.machine.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "same-origin",
          }
        );
      }

      const body = await res.json().catch(() => ({ error: "" }));
      if (!res.ok) {
        setErrorMessage(body.error || `Save failed (HTTP ${res.status})`);
        setSubmitting(false);
        return;
      }

      onSaved(body.machine as MachineProfileRow);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4"
      >
        <h2 className="text-lg font-semibold text-gray-900">
          {mode.kind === "create"
            ? mode.fromTemplate
              ? `Add ${mode.fromTemplate.name}`
              : "Add a new machine"
            : `Edit ${mode.machine.name}`}
        </h2>

        {/* Phase 8.1d-8: category picker as segmented buttons at the top
             of the form for create-from-scratch. Replaces the dropdown
             which Matt didn't notice during S2 ("can't see kerf or min
             feature options, just nozzle"). Now you SEE which category
             you're configuring + the form fields update visibly below. */}
        {mode.kind === "create" && !mode.fromTemplate && (
          <div className="space-y-1">
            <span className="block text-sm font-medium text-gray-700">
              What kind of machine?
            </span>
            <div
              role="radiogroup"
              aria-label="Machine category"
              className="grid grid-cols-2 gap-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={category === "3d_printer"}
                onClick={() => setCategory("3d_printer")}
                className={
                  "flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border-2 transition-all text-sm " +
                  (category === "3d_printer"
                    ? "border-brand-purple bg-brand-purple/5 text-brand-purple font-semibold"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-400")
                }
              >
                <span className="w-7 h-7"><PrinterIcon /></span>
                <span>3D printer</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={category === "laser_cutter"}
                onClick={() => setCategory("laser_cutter")}
                className={
                  "flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border-2 transition-all text-sm " +
                  (category === "laser_cutter"
                    ? "border-brand-purple bg-brand-purple/5 text-brand-purple font-semibold"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-400")
                }
              >
                <span className="w-7 h-7"><LaserIcon /></span>
                <span>Laser cutter</span>
              </button>
            </div>
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700">
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        {/* Phase 8.1d-4: lab selector. Only shown in edit mode (creates
            inherit lab from the parent lab card's "+ Add machine"). */}
        {mode.kind === "edit" && availableLabs && availableLabs.length > 0 && (
          <label className="block text-sm font-medium text-gray-700">
            Lab
            <select
              value={labId}
              onChange={(e) => setLabId(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              {/* Empty option — only meaningful for orphan machines.
                  Hidden for normally-assigned ones to avoid an
                  accidental "unassign" via the dropdown. */}
              {!labId && <option value="">— Unassigned —</option>}
              {availableLabs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-gray-500">
              Move this machine to a different lab. The student picker
              filters by class → lab → machines.
            </span>
          </label>
        )}

        {/* Phase 8.1d-8: category dropdown moved to top of form
             as segmented buttons (see above). */}

        <label className="block text-sm font-medium text-gray-700">
          Model (optional)
          <input
            type="text"
            value={machineModel}
            onChange={(e) => setMachineModel(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="grid grid-cols-3 gap-2">
          <label className="block text-sm font-medium text-gray-700">
            Bed X (mm)
            <input
              type="number"
              value={bedX}
              min="1"
              onChange={(e) => setBedX(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Bed Y (mm)
            <input
              type="number"
              value={bedY}
              min="1"
              onChange={(e) => setBedY(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Bed Z (mm)
            <input
              type="number"
              value={bedZ}
              onChange={(e) => setBedZ(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {category === "3d_printer" && (
          <label className="block text-sm font-medium text-gray-700">
            Nozzle diameter (mm)
            <input
              type="number"
              step="0.01"
              value={nozzle}
              onChange={(e) => setNozzle(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        )}

        {category === "laser_cutter" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm font-medium text-gray-700">
                Kerf (mm)
                <input
                  type="number"
                  step="0.01"
                  value={kerf}
                  onChange={(e) => setKerf(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Min feature (mm)
                <input
                  type="number"
                  step="0.01"
                  value={minFeature}
                  onChange={(e) => setMinFeature(e.target.value)}
                  className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="rounded border border-gray-200 bg-gray-50 p-3">
              <OperationColorMapEditor
                rows={colorMapRows}
                onChange={setColorMapRows}
              />
            </div>
          </>
        )}

        {/* Phase 8.1d-8: approval checkbox only in edit mode. New machines
             default to "auto-approve"; teachers use the lab's Approval
             workflow card or come back to per-machine Edit to flip this.
             Keeps the create flow tight + avoids duplicating the workflow
             card's job. */}
        {mode.kind === "edit" && (
          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Require teacher approval before
              fabricator pickup</span>
              <br />
              <span className="text-xs text-gray-500">
                When checked, students' submissions land in your review queue
                before reaching the fabricator. Useful for higher-risk machines
                (lasers, expensive filament). Off = jobs auto-approve on clean scan.
              </span>
            </span>
          </label>
        )}

        <label className="block text-sm font-medium text-gray-700">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        {errorMessage && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-900">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-sm px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="text-sm px-3 py-1.5 rounded bg-brand-purple text-white hover:bg-brand-purple/90 disabled:opacity-50"
          >
            {submitting ? "Saving…" : mode.kind === "create" ? "Create" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
