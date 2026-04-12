"use client";

import { useState, useMemo } from "react";
import {
  getCriterionLabels,
  toLabel,
  fromLabel,
  NEUTRAL_CRITERION_KEYS,
} from "@/lib/frameworks/adapter";
import type {
  FrameworkId,
  NeutralCriterionKey,
  CriterionLabelResult,
} from "@/lib/frameworks/adapter";
import { getCriterionColor } from "@/lib/frameworks/render-helpers";

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

type TabId = "matrix" | "batch" | "roundtrip" | "grading";

const TABS: { id: TabId; label: string }[] = [
  { id: "matrix", label: "8\u00d78 Matrix" },
  { id: "batch", label: "Batch Validation" },
  { id: "roundtrip", label: "Round-Trip Test" },
  { id: "grading", label: "Grading Simulation" },
];

// ---------------------------------------------------------------------------
// Shared framework selector
// ---------------------------------------------------------------------------
function FrameworkSelector({
  value,
  onChange,
  label,
}: {
  value: FrameworkId;
  onChange: (fw: FrameworkId) => void;
  label?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      {label && <span className="font-medium text-gray-700">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FrameworkId)}
        className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
      >
        {FRAMEWORKS.map((fw) => (
          <option key={fw} value={fw}>
            {fw}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Matrix (existing)
// ---------------------------------------------------------------------------
function MatrixTab() {
  return (
    <div>
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
                          <span className="text-gray-500"> &mdash; </span>
                          <span>{result.full}</span>
                        </div>
                      )}
                      {result.kind === "implicit" && (
                        <div>
                          <span className="font-semibold">{result.short}</span>
                          <span className="text-gray-500"> &mdash; </span>
                          <span>{result.full}</span>
                          <div className="text-[10px] mt-0.5 italic opacity-75">
                            implicit &rarr; {result.mappedTo}
                          </div>
                        </div>
                      )}
                      {result.kind === "not_assessed" && (
                        <span className="text-gray-400">&mdash;</span>
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

// ---------------------------------------------------------------------------
// Tab 2: Batch Validation (§4.6b)
// ---------------------------------------------------------------------------
interface BatchRow {
  neutralKey: NeutralCriterionKey;
  framework: FrameworkId;
  result: CriterionLabelResult;
  status: "green" | "amber" | "red";
}

function BatchValidationTab() {
  const [ran, setRan] = useState(false);

  const rows = useMemo<BatchRow[]>(() => {
    if (!ran) return [];
    const out: BatchRow[] = [];
    for (const nk of NEUTRAL_CRITERION_KEYS) {
      for (const fw of FRAMEWORKS) {
        const result = toLabel(nk, fw);
        let status: BatchRow["status"] = "green";
        if (result.kind === "not_assessed") status = "red";
        else if (result.kind === "implicit") status = "amber";
        out.push({ neutralKey: nk, framework: fw, result, status });
      }
    }
    return out;
  }, [ran]);

  const greenCount = rows.filter((r) => r.status === "green").length;
  const amberCount = rows.filter((r) => r.status === "amber").length;
  const redCount = rows.filter((r) => r.status === "red").length;

  function downloadCsv() {
    const header = "neutral_key,framework,kind,short,full,name,status\n";
    const csvRows = rows.map((r) => {
      const short = r.result.kind !== "not_assessed" ? r.result.short : "";
      const full = r.result.kind !== "not_assessed" ? r.result.full : "";
      const name = r.result.kind !== "not_assessed" ? r.result.name : "";
      return `${r.neutralKey},${r.framework},${r.result.kind},"${short}","${full}","${name}",${r.status}`;
    });
    const blob = new Blob([header + csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "framework-adapter-batch-validation.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Tests every neutral key &times; framework combination via{" "}
        <code className="text-xs bg-gray-100 px-1 rounded">toLabel()</code>.
        Green = label, Amber = implicit, Red = not_assessed.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setRan(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Run Batch Validation
        </button>
        {ran && (
          <button
            onClick={downloadCsv}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Download CSV
          </button>
        )}
      </div>

      {ran && (
        <>
          {/* Summary */}
          <div className="flex gap-4 mb-4 text-sm">
            <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 font-semibold">
              {greenCount} green
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 font-semibold">
              {amberCount} amber
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-red-100 text-red-800 font-semibold">
              {redCount} red
            </span>
            <span className="px-3 py-1.5 text-gray-500">
              {rows.length} total ({NEUTRAL_CRITERION_KEYS.length} keys &times;{" "}
              {FRAMEWORKS.length} frameworks)
            </span>
          </div>

          {/* Results table */}
          <div className="overflow-x-auto border border-gray-200 rounded-xl max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-gray-100 z-10">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                    Neutral Key
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                    Framework
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                    Kind
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                    Short
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                    Full
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                    Name
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700 border-b border-gray-200">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const bg =
                    r.status === "green"
                      ? "bg-emerald-50/50"
                      : r.status === "amber"
                        ? "bg-amber-50/50"
                        : "bg-red-50/50";
                  return (
                    <tr key={`${r.neutralKey}-${r.framework}`} className={bg}>
                      <td className="px-3 py-1.5 font-mono text-gray-800 border-b border-gray-100">
                        {r.neutralKey}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700 border-b border-gray-100">
                        {r.framework}
                      </td>
                      <td className="px-3 py-1.5 border-b border-gray-100">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${KIND_STYLES[r.result.kind]}`}
                        >
                          {r.result.kind}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-semibold text-gray-800 border-b border-gray-100">
                        {r.result.kind !== "not_assessed" ? r.result.short : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600 border-b border-gray-100">
                        {r.result.kind !== "not_assessed" ? r.result.full : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500 border-b border-gray-100">
                        {r.result.kind !== "not_assessed" ? r.result.name : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-center border-b border-gray-100">
                        <span
                          className={`inline-block w-3 h-3 rounded-full ${
                            r.status === "green"
                              ? "bg-emerald-500"
                              : r.status === "amber"
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Round-Trip Test (§4.6c)
// ---------------------------------------------------------------------------
interface RoundTripRow {
  neutralKey: NeutralCriterionKey;
  framework: FrameworkId;
  forwardResult: CriterionLabelResult;
  reverseKeys: readonly NeutralCriterionKey[];
  roundTrips: boolean;
  note: string;
}

function RoundTripTab() {
  const [ran, setRan] = useState(false);

  const rows = useMemo<RoundTripRow[]>(() => {
    if (!ran) return [];
    const out: RoundTripRow[] = [];
    for (const nk of NEUTRAL_CRITERION_KEYS) {
      for (const fw of FRAMEWORKS) {
        const forward = toLabel(nk, fw);
        if (forward.kind === "not_assessed") {
          out.push({
            neutralKey: nk,
            framework: fw,
            forwardResult: forward,
            reverseKeys: [],
            roundTrips: true, // not_assessed is expected to have no reverse
            note: "Not assessed — skip",
          });
          continue;
        }

        // Reverse: use the short label to go back
        const reverseKeys = fromLabel(forward.short, fw);
        const roundTrips = reverseKeys.includes(nk);
        let note = "";
        if (!roundTrips) {
          note = `Expected ${nk} in reverse, got [${reverseKeys.join(", ")}]`;
        } else if (forward.kind === "implicit") {
          note = `Implicit mapping via ${forward.mappedTo}`;
        }

        out.push({
          neutralKey: nk,
          framework: fw,
          forwardResult: forward,
          reverseKeys,
          roundTrips,
          note,
        });
      }
    }
    return out;
  }, [ran]);

  const passCount = rows.filter((r) => r.roundTrips).length;
  const failCount = rows.filter((r) => !r.roundTrips).length;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Tests neutral &rarr; <code className="text-xs bg-gray-100 px-1 rounded">toLabel()</code>{" "}
        &rarr; <code className="text-xs bg-gray-100 px-1 rounded">fromLabel()</code>{" "}
        &rarr; neutral. Flags any key that doesn&apos;t return to its source.
      </p>

      <button
        onClick={() => setRan(true)}
        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors mb-4"
      >
        Run Round-Trip Test
      </button>

      {ran && (
        <>
          <div className="flex gap-4 mb-4 text-sm">
            <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 font-semibold">
              {passCount} pass
            </span>
            {failCount > 0 && (
              <span className="px-3 py-1.5 rounded-lg bg-red-100 text-red-800 font-semibold">
                {failCount} fail
              </span>
            )}
          </div>

          {/* Only show failures and implicit if any */}
          <div className="overflow-x-auto border border-gray-200 rounded-xl max-h-[500px] overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-gray-100 z-10">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                    Neutral Key
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                    Framework
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                    Forward (short)
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                    Reverse Keys
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700 border-b border-gray-200">
                    Round-trips?
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => !r.roundTrips || r.forwardResult.kind === "implicit")
                  .map((r) => (
                    <tr
                      key={`${r.neutralKey}-${r.framework}`}
                      className={r.roundTrips ? "bg-amber-50/30" : "bg-red-50/50"}
                    >
                      <td className="px-3 py-1.5 font-mono text-gray-800 border-b border-gray-100">
                        {r.neutralKey}
                      </td>
                      <td className="px-3 py-1.5 text-gray-700 border-b border-gray-100">
                        {r.framework}
                      </td>
                      <td className="px-3 py-1.5 font-semibold text-gray-800 border-b border-gray-100">
                        {r.forwardResult.kind !== "not_assessed"
                          ? r.forwardResult.short
                          : "—"}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-gray-600 border-b border-gray-100">
                        [{r.reverseKeys.join(", ")}]
                      </td>
                      <td className="px-3 py-1.5 text-center border-b border-gray-100">
                        {r.roundTrips ? (
                          <span className="text-emerald-600 font-bold">&#10003;</span>
                        ) : (
                          <span className="text-red-600 font-bold">&#10007;</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500 border-b border-gray-100">
                        {r.note}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {rows.filter((r) => !r.roundTrips || r.forwardResult.kind === "implicit").length === 0 && (
            <p className="text-sm text-emerald-700 mt-2 font-medium">
              All {passCount} round-trips pass cleanly (no implicit mappings).
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Grading UI Simulation (§4.6d)
// ---------------------------------------------------------------------------
function GradingSimulationTab() {
  const [framework, setFramework] = useState<FrameworkId>("IB_MYP");

  const criteria = useMemo(() => {
    const labels = getCriterionLabels(framework);
    return labels.map((def) => ({
      short: def.short,
      full: def.full,
      name: def.name,
      color: getCriterionColor(def.short, framework),
    }));
  }, [framework]);

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Simulates how the grading UI renders criterion tabs for a chosen framework.
        Validates criteria count, order, labels, and colors.
      </p>

      <div className="mb-6">
        <FrameworkSelector
          value={framework}
          onChange={setFramework}
          label="Framework:"
        />
      </div>

      {/* Grading tab bar simulation */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">
            Criterion Tab Bar &mdash; {framework}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {criteria.length} criteria rendered
          </p>
        </div>

        {/* Tab pills */}
        <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-gray-100">
          {criteria.map((c, i) => (
            <div
              key={c.short}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm"
              style={{
                borderColor: c.color,
                backgroundColor: c.color + "15",
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: c.color }}
              />
              <span className="font-semibold" style={{ color: c.color }}>
                {c.short}
              </span>
              <span className="text-gray-500 text-xs">{c.name}</span>
            </div>
          ))}
        </div>

        {/* Detailed criterion cards */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {criteria.map((c, i) => (
            <div
              key={c.short}
              className="border rounded-lg p-3"
              style={{ borderColor: c.color + "40" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: c.color }}
                >
                  {c.short}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{c.full}</p>
                  <p className="text-xs text-gray-400">{c.name}</p>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>Order</span>
                  <span className="font-mono">{i + 1} of {criteria.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Color</span>
                  <span className="font-mono flex items-center gap-1">
                    {c.color}
                    <span
                      className="inline-block w-3 h-3 rounded"
                      style={{ backgroundColor: c.color }}
                    />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Validation checks */}
      <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          Validation Checks
        </h4>
        <ul className="space-y-1.5 text-xs">
          <ValidationCheck
            label="Has at least 1 criterion"
            pass={criteria.length > 0}
          />
          <ValidationCheck
            label="All criteria have non-empty short labels"
            pass={criteria.every((c) => c.short.length > 0)}
          />
          <ValidationCheck
            label="All criteria have non-empty full labels"
            pass={criteria.every((c) => c.full.length > 0)}
          />
          <ValidationCheck
            label="All criteria have valid hex colors"
            pass={criteria.every((c) => /^#[0-9a-fA-F]{6}$/.test(c.color))}
          />
          <ValidationCheck
            label="No duplicate short labels"
            pass={
              new Set(criteria.map((c) => c.short)).size === criteria.length
            }
          />
          <ValidationCheck
            label={`Criteria count matches getCriterionLabels(${framework}).length`}
            pass={criteria.length === getCriterionLabels(framework).length}
          />
        </ul>
      </div>
    </div>
  );
}

function ValidationCheck({ label, pass }: { label: string; pass: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
          pass ? "bg-emerald-500" : "bg-red-500"
        }`}
      >
        {pass ? "\u2713" : "\u2717"}
      </span>
      <span className={pass ? "text-gray-700" : "text-red-700 font-medium"}>
        {label}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function FrameworkAdapterPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("matrix");

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        FrameworkAdapter Test Panel
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Visual verification of the FrameworkAdapter system &mdash; 8 neutral keys
        &times; 8 frameworks.
      </p>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "matrix" && <MatrixTab />}
      {activeTab === "batch" && <BatchValidationTab />}
      {activeTab === "roundtrip" && <RoundTripTab />}
      {activeTab === "grading" && <GradingSimulationTab />}
    </div>
  );
}
