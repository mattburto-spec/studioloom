"use client";

/**
 * AddMachineModal — Phase 8-4.
 *
 * Two-step picker: choose EITHER a system template to copy (most
 * common — one of the 12 seeded machines) OR "Start from scratch"
 * (custom machine not in the template library). Either choice hands
 * off to MachineEditModal for the actual field editing.
 */

import * as React from "react";
import { MachineEditModal } from "./MachineEditModal";
import type { MachineProfileRow } from "@/lib/fabrication/machine-orchestration";

interface Props {
  labId: string;
  templates: MachineProfileRow[];
  onClose: () => void;
  onSaved: () => void;
}

export function AddMachineModal({ labId, templates, onClose, onSaved }: Props) {
  const [choice, setChoice] = React.useState<
    | { kind: "picker" }
    | { kind: "template"; template: MachineProfileRow }
    | { kind: "scratch" }
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
        mode={{ kind: "create", labId }}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  // Picker view.
  const printers = templates.filter(
    (t) => t.machineCategory === "3d_printer"
  );
  const lasers = templates.filter((t) => t.machineCategory === "laser_cutter");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Add a machine
            </h2>
            <p className="text-sm text-gray-600">
              Pick a template to copy specs from, or start from scratch.
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
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              3D printers
            </h3>
            {printers.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No templates.</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {printers.map((t) => (
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
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Laser cutters
            </h3>
            {lasers.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No templates.</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {lasers.map((t) => (
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
                        {t.bedSizeXMm}×{t.bedSizeYMm} mm · kerf{" "}
                        {t.kerfMm ?? "—"} mm
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
              onClick={() => setChoice({ kind: "scratch" })}
              className="w-full text-left rounded border border-dashed border-gray-300 bg-white p-3 hover:border-brand-purple/50 hover:bg-gray-50 transition"
            >
              <p className="text-sm font-semibold text-gray-900">
                + Start from scratch
              </p>
              <p className="text-xs text-gray-500">
                Not in the template list? Build a custom machine profile.
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
