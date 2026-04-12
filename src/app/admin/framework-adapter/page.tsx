"use client";

import { getCriterionLabels, toLabel, NEUTRAL_CRITERION_KEYS } from "@/lib/frameworks/adapter";
import type { FrameworkId } from "@/lib/frameworks/adapter";

/** All 8 supported framework IDs (mirrors the FrameworkId union type). */
const FRAMEWORKS: FrameworkId[] = [
  "IB_MYP",
  "GCSE_DT",
  "A_LEVEL_DT",
  "IGCSE_DT",
  "ACARA_DT",
  "PLTW",
  "NESA_DT",
  "VIC_DT",
];

const KIND_STYLES = {
  label: "bg-emerald-50 text-emerald-800 border-emerald-200",
  implicit: "bg-amber-50 text-amber-700 border-amber-200",
  not_assessed: "bg-gray-50 text-gray-400 border-gray-200",
} as const;

export default function FrameworkAdapterPanel() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        FrameworkAdapter Test Panel
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        8 neutral keys × 8 frameworks — visual verification of{" "}
        <code className="text-xs bg-gray-100 px-1 rounded">toLabel()</code>{" "}
        output for every cell.
      </p>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        <span className="px-2 py-1 rounded border bg-emerald-50 text-emerald-800 border-emerald-200">
          label
        </span>
        <span className="px-2 py-1 rounded border bg-amber-50 text-amber-700 border-amber-200">
          implicit
        </span>
        <span className="px-2 py-1 rounded border bg-gray-50 text-gray-400 border-gray-200">
          not assessed
        </span>
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-r border-gray-200 sticky left-0 bg-gray-100 z-10">
                Neutral Key
              </th>
              {FRAMEWORKS.map((fw) => (
                <th
                  key={fw}
                  className="px-3 py-2 text-center font-semibold text-gray-700 border-b border-r border-gray-200 whitespace-nowrap"
                >
                  {fw}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NEUTRAL_CRITERION_KEYS.map((key, i) => (
              <tr
                key={key}
                className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
              >
                <td className="px-3 py-2 font-mono font-medium text-gray-800 border-r border-gray-200 sticky left-0 bg-inherit z-10">
                  {key}
                </td>
                {FRAMEWORKS.map((fw) => {
                  const result = toLabel(key, fw);
                  return (
                    <td
                      key={fw}
                      className={`px-3 py-2 border-r border-gray-200 ${KIND_STYLES[result.kind]}`}
                    >
                      {result.kind === "label" && (
                        <div>
                          <span className="font-semibold">{result.short}</span>
                          <span className="text-gray-500"> — </span>
                          <span>{result.full}</span>
                        </div>
                      )}
                      {result.kind === "implicit" && (
                        <div>
                          <span className="font-semibold">{result.short}</span>
                          <span className="text-gray-500"> — </span>
                          <span>{result.full}</span>
                          <div className="text-[10px] mt-0.5 italic opacity-75">
                            implicit → {result.mappedTo}
                          </div>
                        </div>
                      )}
                      {result.kind === "not_assessed" && (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per-framework criterion list */}
      <h2 className="text-lg font-semibold text-gray-800 mt-10 mb-4">
        getCriterionLabels() per framework
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {FRAMEWORKS.map((fw) => {
          const labels = getCriterionLabels(fw);
          return (
            <div
              key={fw}
              className="border border-gray-200 rounded-lg p-3 bg-white"
            >
              <h3 className="font-semibold text-sm text-gray-700 mb-2">
                {fw}{" "}
                <span className="text-gray-400 font-normal">
                  ({labels.length} criteria)
                </span>
              </h3>
              <ul className="space-y-1">
                {labels.map((def) => (
                  <li key={def.short} className="text-xs">
                    <span className="font-mono font-semibold text-indigo-600">
                      {def.short}
                    </span>{" "}
                    <span className="text-gray-600">{def.full}</span>
                    <span className="text-gray-400 ml-1">({def.name})</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
