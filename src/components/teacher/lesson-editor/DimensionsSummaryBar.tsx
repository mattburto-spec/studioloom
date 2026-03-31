"use client";

import type { ActivitySection, BloomLevel } from "@/types";

interface DimensionsSummaryBarProps {
  sections: ActivitySection[];
}

// UDL checkpoint → principle mapping (CAST framework)
// 1.x-3.x = Engagement, 4.x-6.x = Representation, 7.x-9.x = Action & Expression
function getUDLPrinciple(checkpoint: string): "engagement" | "representation" | "action_expression" | null {
  const num = parseFloat(checkpoint);
  if (isNaN(num)) return null;
  if (num >= 1 && num < 4) return "engagement";
  if (num >= 4 && num < 7) return "representation";
  if (num >= 7 && num < 10) return "action_expression";
  return null;
}

const BLOOM_COLORS: Record<BloomLevel, string> = {
  remember: "#ef4444",   // red
  understand: "#f97316", // orange
  apply: "#eab308",      // yellow
  analyze: "#22c55e",    // green
  evaluate: "#3b82f6",   // blue
  create: "#a855f7",     // purple
};

const BLOOM_ORDER: BloomLevel[] = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

/**
 * DimensionsSummaryBar — compact summary of Dimensions metadata for a lesson's activities.
 * Shows: Bloom distribution mini-bar, UDL coverage dots (3 principles), grouping variety.
 */
export default function DimensionsSummaryBar({ sections }: DimensionsSummaryBarProps) {
  // Compute Bloom distribution
  const bloomCounts: Record<BloomLevel, number> = {
    remember: 0, understand: 0, apply: 0, analyze: 0, evaluate: 0, create: 0,
  };
  let bloomTotal = 0;
  sections.forEach((s) => {
    if (s.bloom_level) {
      bloomCounts[s.bloom_level]++;
      bloomTotal++;
    }
  });

  // Compute UDL coverage
  const udlCoverage = { engagement: false, representation: false, action_expression: false };
  sections.forEach((s) => {
    (s.udl_checkpoints || []).forEach((cp) => {
      const principle = getUDLPrinciple(cp);
      if (principle) udlCoverage[principle] = true;
    });
  });
  const udlCount = [udlCoverage.engagement, udlCoverage.representation, udlCoverage.action_expression].filter(Boolean).length;

  // Compute grouping variety
  const groupings = new Set<string>();
  sections.forEach((s) => {
    if (s.grouping) groupings.add(s.grouping);
  });

  // Count activities with ai_rules set
  const aiRulesCount = sections.filter((s) => s.ai_rules && s.ai_rules.phase !== "neutral").length;

  // If nothing is set, don't show the bar
  if (bloomTotal === 0 && udlCount === 0 && groupings.size === 0 && aiRulesCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 mb-3 bg-gray-50 rounded-lg border border-gray-100">
      {/* Bloom distribution mini-bar */}
      {bloomTotal > 0 && (
        <div className="flex items-center gap-2" title="Bloom's level distribution across activities">
          <span className="text-xs text-gray-500 font-medium">Bloom&apos;s</span>
          <div className="flex h-3 w-24 rounded-full overflow-hidden border border-gray-200">
            {BLOOM_ORDER.map((level) => {
              const count = bloomCounts[level];
              if (count === 0) return null;
              const pct = (count / bloomTotal) * 100;
              return (
                <div
                  key={level}
                  style={{ width: `${pct}%`, backgroundColor: BLOOM_COLORS[level] }}
                  title={`${level}: ${count} activit${count === 1 ? "y" : "ies"}`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* UDL coverage dots */}
      <div className="flex items-center gap-1.5" title={`UDL coverage: ${udlCount}/3 principles`}>
        <span className="text-xs text-gray-500 font-medium">UDL</span>
        <div className="flex gap-1">
          <span
            className={`w-2.5 h-2.5 rounded-full border ${
              udlCoverage.engagement
                ? "bg-emerald-500 border-emerald-600"
                : "bg-gray-200 border-gray-300"
            }`}
            title={`Engagement: ${udlCoverage.engagement ? "Covered" : "Not covered"}`}
          />
          <span
            className={`w-2.5 h-2.5 rounded-full border ${
              udlCoverage.representation
                ? "bg-blue-500 border-blue-600"
                : "bg-gray-200 border-gray-300"
            }`}
            title={`Representation: ${udlCoverage.representation ? "Covered" : "Not covered"}`}
          />
          <span
            className={`w-2.5 h-2.5 rounded-full border ${
              udlCoverage.action_expression
                ? "bg-purple-500 border-purple-600"
                : "bg-gray-200 border-gray-300"
            }`}
            title={`Action & Expression: ${udlCoverage.action_expression ? "Covered" : "Not covered"}`}
          />
        </div>
      </div>

      {/* Grouping variety */}
      {groupings.size > 0 && (
        <div className="flex items-center gap-1.5" title={`Grouping: ${Array.from(groupings).join(", ")}`}>
          <span className="text-xs text-gray-500 font-medium">Groups</span>
          <span className="text-xs text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
            {groupings.size} type{groupings.size !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* AI rules count */}
      {aiRulesCount > 0 && (
        <div className="flex items-center gap-1.5" title={`${aiRulesCount} activities with custom AI rules`}>
          <span className="text-xs text-gray-500 font-medium">AI</span>
          <span className="text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
            {aiRulesCount} custom
          </span>
        </div>
      )}
    </div>
  );
}
