"use client";

/**
 * OperationColorMapEditor — Phase 8-4.
 *
 * Row-based editor for a machine's `operation_color_map`. Each row =
 * one (hex colour, operation) pair. Used inside the MachineEditModal
 * for laser-cutter category machines. 3D printer rows skip this
 * editor entirely.
 *
 * Validation logic lives in `lab-setup-helpers.ts` (pure functions).
 * This component is just the form UI.
 */

import * as React from "react";
import {
  operationLabel,
  validateColorMapRows,
  type ColorMapRow,
} from "./lab-setup-helpers";

interface Props {
  rows: ColorMapRow[];
  onChange: (rows: ColorMapRow[]) => void;
}

const OPERATIONS: Array<ColorMapRow["operation"]> = ["cut", "score", "engrave"];

export function OperationColorMapEditor({ rows, onChange }: Props) {
  const errors = React.useMemo(() => validateColorMapRows(rows), [rows]);

  function updateRow(index: number, patch: Partial<ColorMapRow>) {
    const next = rows.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function removeRow(index: number) {
    const next = rows.slice();
    next.splice(index, 1);
    onChange(next);
  }

  function addRow() {
    onChange([...rows, { hex: "#000000", operation: "cut" }]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Operation colour map
          </p>
          <p className="text-xs text-gray-500">
            Stroke colour → operation. Students colour their SVG strokes
            to match; the scanner checks this map to catch mis-tagged layers.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
        >
          + Add row
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-gray-500 italic py-3">
          No colour mappings yet. Add a row for each operation your machine
          supports.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9A-Fa-f]{6}$/.test(row.hex) ? row.hex : "#000000"}
                onChange={(e) => updateRow(i, { hex: e.target.value })}
                className="w-10 h-8 border border-gray-300 rounded cursor-pointer"
                aria-label={`Colour for row ${i + 1}`}
              />
              <input
                type="text"
                value={row.hex}
                onChange={(e) => updateRow(i, { hex: e.target.value })}
                placeholder="#RRGGBB"
                className="w-24 text-sm font-mono px-2 py-1 border border-gray-300 rounded"
                aria-label={`Hex value for row ${i + 1}`}
              />
              <select
                value={row.operation}
                onChange={(e) =>
                  updateRow(i, {
                    operation: e.target.value as ColorMapRow["operation"],
                  })
                }
                className="text-sm px-2 py-1 border border-gray-300 rounded bg-white"
                aria-label={`Operation for row ${i + 1}`}
              >
                {OPERATIONS.map((op) => (
                  <option key={op} value={op}>
                    {operationLabel(op)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="text-xs text-gray-400 hover:text-red-600 px-2"
                aria-label={`Remove row ${i + 1}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {errors.length > 0 && (
        <ul className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 space-y-0.5">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
