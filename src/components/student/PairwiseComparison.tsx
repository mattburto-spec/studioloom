"use client";

import { useState, useEffect, useMemo } from "react";

interface PairwiseData {
  options: string[];
  comparisons: { a: number; b: number; winner: number | null; reason: string }[];
  summary: string;
}

interface PairwiseComparisonProps {
  value: string;
  onChange: (value: string) => void;
}

function generatePairs(count: number): { a: number; b: number }[] {
  const pairs: { a: number; b: number }[] = [];
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      pairs.push({ a: i, b: j });
    }
  }
  return pairs;
}

function emptyData(): PairwiseData {
  return {
    options: ["Option A", "Option B", "Option C"],
    comparisons: generatePairs(3).map((p) => ({
      ...p,
      winner: null,
      reason: "",
    })),
    summary: "",
  };
}

function parseValue(value: string): PairwiseData {
  if (!value) return emptyData();
  try {
    return JSON.parse(value);
  } catch {
    return emptyData();
  }
}

export function PairwiseComparison({ value, onChange }: PairwiseComparisonProps) {
  const [data, setData] = useState<PairwiseData>(() => parseValue(value));

  useEffect(() => {
    onChange(JSON.stringify(data));
  }, [data, onChange]);

  // Recalculate comparisons when options change
  function updateOptions(newOptions: string[]) {
    const pairs = generatePairs(newOptions.length);
    const comparisons = pairs.map((p) => {
      const existing = data.comparisons.find(
        (c) => c.a === p.a && c.b === p.b
      );
      return existing || { ...p, winner: null, reason: "" };
    });
    setData((prev) => ({ ...prev, options: newOptions, comparisons }));
  }

  // Win counts
  const winCounts = useMemo(() => {
    const counts = data.options.map(() => 0);
    data.comparisons.forEach((c) => {
      if (c.winner !== null) counts[c.winner]++;
    });
    return counts;
  }, [data]);

  const maxWins = Math.max(...winCounts, 1);
  const allDecided = data.comparisons.every((c) => c.winner !== null);

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold text-brand-purple flex items-center gap-1.5 mb-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M16 3h5v5M8 3H3v5M16 21h5v-5M8 21H3v-5" />
        </svg>
        Pairwise Comparison
      </div>

      {/* Option names */}
      <div className="flex flex-wrap gap-2">
        {data.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
              style={{ backgroundColor: ["#2E86AB", "#2DA05E", "#E86F2C", "#8B2FC9"][i % 4] }}
            >
              {String.fromCharCode(65 + i)}
            </div>
            <input
              type="text"
              value={opt}
              onChange={(e) => {
                const opts = [...data.options];
                opts[i] = e.target.value;
                updateOptions(opts);
              }}
              className="px-2 py-1 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-brand-purple/30 w-28"
            />
          </div>
        ))}
        {data.options.length < 5 && (
          <button
            onClick={() => updateOptions([...data.options, ""])}
            className="px-2 py-1 text-xs border border-dashed border-border rounded hover:bg-gray-50 transition"
          >
            + Option
          </button>
        )}
      </div>

      {/* Comparison cards */}
      <div className="space-y-3">
        {data.comparisons.map((comp, ci) => {
          const optA = data.options[comp.a] || `Option ${String.fromCharCode(65 + comp.a)}`;
          const optB = data.options[comp.b] || `Option ${String.fromCharCode(65 + comp.b)}`;

          return (
            <div
              key={ci}
              className="border border-border rounded-xl p-3 space-y-2"
            >
              <div className="text-xs text-text-secondary font-medium">
                Round {ci + 1}: Which is better?
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setData((prev) => {
                      const comps = [...prev.comparisons];
                      comps[ci] = { ...comps[ci], winner: comp.a };
                      return { ...prev, comparisons: comps };
                    })
                  }
                  className={`flex-1 py-2 px-3 text-xs rounded-lg border-2 transition font-medium ${
                    comp.winner === comp.a
                      ? "border-accent-green bg-accent-green/10 text-accent-green"
                      : "border-border hover:border-gray-300"
                  }`}
                >
                  {optA}
                </button>
                <span className="text-xs text-text-secondary self-center">vs</span>
                <button
                  onClick={() =>
                    setData((prev) => {
                      const comps = [...prev.comparisons];
                      comps[ci] = { ...comps[ci], winner: comp.b };
                      return { ...prev, comparisons: comps };
                    })
                  }
                  className={`flex-1 py-2 px-3 text-xs rounded-lg border-2 transition font-medium ${
                    comp.winner === comp.b
                      ? "border-accent-green bg-accent-green/10 text-accent-green"
                      : "border-border hover:border-gray-300"
                  }`}
                >
                  {optB}
                </button>
              </div>
              {comp.winner !== null && (
                <input
                  type="text"
                  value={comp.reason}
                  onChange={(e) =>
                    setData((prev) => {
                      const comps = [...prev.comparisons];
                      comps[ci] = { ...comps[ci], reason: e.target.value };
                      return { ...prev, comparisons: comps };
                    })
                  }
                  placeholder="Why did you choose this one?"
                  className="w-full px-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Results */}
      {allDecided && (
        <div className="bg-accent-green/5 border border-accent-green/20 rounded-xl p-3 space-y-2">
          <div className="text-xs font-semibold text-accent-green">Ranking</div>
          <div className="space-y-1">
            {data.options
              .map((opt, i) => ({ name: opt || `Option ${String.fromCharCode(65 + i)}`, wins: winCounts[i], index: i }))
              .sort((a, b) => b.wins - a.wins)
              .map((item, rank) => (
                <div key={item.index} className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-text-secondary w-4">
                    {rank + 1}.
                  </span>
                  <div className="flex-1">
                    <span className={rank === 0 ? "font-bold text-accent-green" : "text-text-primary"}>
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-2 rounded-full bg-accent-green"
                      style={{ width: `${(item.wins / maxWins) * 60}px` }}
                    />
                    <span className="text-text-secondary">{item.wins} wins</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
