"use client";

import { useState, useEffect } from "react";

interface MatrixData {
  criteria: { name: string; weight: number }[];
  options: string[];
  scores: number[][]; // [criterionIndex][optionIndex]
  justification: string;
}

interface DecisionMatrixProps {
  value: string;
  onChange: (value: string) => void;
}

function emptyMatrix(): MatrixData {
  return {
    criteria: [
      { name: "Cost", weight: 2 },
      { name: "Durability", weight: 3 },
      { name: "Aesthetics", weight: 2 },
    ],
    options: ["Option A", "Option B", "Option C"],
    scores: [
      [3, 3, 3],
      [3, 3, 3],
      [3, 3, 3],
    ],
    justification: "",
  };
}

function parseValue(value: string): MatrixData {
  if (!value) return emptyMatrix();
  try {
    return JSON.parse(value);
  } catch {
    return emptyMatrix();
  }
}

export function DecisionMatrix({ value, onChange }: DecisionMatrixProps) {
  const [data, setData] = useState<MatrixData>(() => parseValue(value));

  useEffect(() => {
    onChange(JSON.stringify(data));
  }, [data, onChange]);

  function updateCriterion(index: number, field: "name" | "weight", val: string | number) {
    setData((prev) => {
      const criteria = [...prev.criteria];
      criteria[index] = { ...criteria[index], [field]: val };
      return { ...prev, criteria };
    });
  }

  function updateOption(index: number, name: string) {
    setData((prev) => {
      const options = [...prev.options];
      options[index] = name;
      return { ...prev, options };
    });
  }

  function updateScore(ci: number, oi: number, score: number) {
    setData((prev) => {
      const scores = prev.scores.map((row) => [...row]);
      scores[ci][oi] = score;
      return { ...prev, scores };
    });
  }

  function addCriterion() {
    setData((prev) => ({
      ...prev,
      criteria: [...prev.criteria, { name: "", weight: 2 }],
      scores: [...prev.scores, prev.options.map(() => 3)],
    }));
  }

  function addOption() {
    setData((prev) => ({
      ...prev,
      options: [...prev.options, ""],
      scores: prev.scores.map((row) => [...row, 3]),
    }));
  }

  // Calculate weighted totals
  const totals = data.options.map((_, oi) =>
    data.criteria.reduce(
      (sum, c, ci) => sum + c.weight * (data.scores[ci]?.[oi] ?? 0),
      0
    )
  );
  const maxTotal = Math.max(...totals, 1);

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold text-brand-purple flex items-center gap-1.5 mb-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
        Decision Matrix
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 border border-border bg-gray-50 w-32">Criteria</th>
              <th className="p-2 border border-border bg-gray-50 w-16">Weight</th>
              {data.options.map((opt, i) => (
                <th key={i} className="p-2 border border-border bg-gray-50 min-w-[100px]">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="w-full text-center bg-transparent focus:outline-none font-semibold"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.criteria.map((c, ci) => (
              <tr key={ci}>
                <td className="p-2 border border-border">
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => updateCriterion(ci, "name", e.target.value)}
                    placeholder="Criterion"
                    className="w-full bg-transparent focus:outline-none"
                  />
                </td>
                <td className="p-2 border border-border text-center">
                  <select
                    value={c.weight}
                    onChange={(e) => updateCriterion(ci, "weight", Number(e.target.value))}
                    className="bg-transparent focus:outline-none text-center"
                  >
                    {[1, 2, 3].map((w) => (
                      <option key={w} value={w}>{"★".repeat(w)}</option>
                    ))}
                  </select>
                </td>
                {data.options.map((_, oi) => (
                  <td key={oi} className="p-2 border border-border text-center">
                    <select
                      value={data.scores[ci]?.[oi] ?? 3}
                      onChange={(e) => updateScore(ci, oi, Number(e.target.value))}
                      className="bg-transparent focus:outline-none text-center"
                    >
                      {[1, 2, 3, 4, 5].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
            {/* Totals row */}
            <tr className="font-bold">
              <td className="p-2 border border-border bg-gray-50" colSpan={2}>
                Weighted Total
              </td>
              {totals.map((total, i) => (
                <td
                  key={i}
                  className="p-2 border border-border text-center"
                  style={{
                    backgroundColor:
                      total === maxTotal ? "#2DA05E15" : undefined,
                    color: total === maxTotal ? "#2DA05E" : undefined,
                  }}
                >
                  {total}
                  {total === maxTotal && " ✓"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button
          onClick={addCriterion}
          className="px-3 py-1 text-xs border border-dashed border-border rounded hover:bg-gray-50 transition"
        >
          + Criterion
        </button>
        <button
          onClick={addOption}
          className="px-3 py-1 text-xs border border-dashed border-border rounded hover:bg-gray-50 transition"
        >
          + Option
        </button>
      </div>

      {/* Justification */}
      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1">
          Based on your matrix, explain your final choice:
        </label>
        <textarea
          value={data.justification}
          onChange={(e) => setData((prev) => ({ ...prev, justification: e.target.value }))}
          rows={3}
          placeholder="I chose this option because..."
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none"
        />
      </div>
    </div>
  );
}
