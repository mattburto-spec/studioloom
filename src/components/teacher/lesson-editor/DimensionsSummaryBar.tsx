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

// Bloom level → cognitive load score (1-6)
const BLOOM_LOAD: Record<BloomLevel, number> = {
  remember: 1,
  understand: 2,
  apply: 3,
  analyze: 4,
  evaluate: 5,
  create: 6,
};

// Interpolate between green (low) → amber (mid) → red (high) based on 1-6 score
function loadColor(score: number): string {
  if (score <= 2) return "#22c55e"; // green
  if (score <= 3) return "#eab308"; // yellow
  if (score <= 4) return "#f97316"; // orange
  return "#ef4444"; // red
}

/**
 * CognitiveLoadCurve — mini sparkline SVG showing how cognitive demand flows
 * across activities in order. Ideal Workshop Model pattern: low → peak → ease off.
 */
function CognitiveLoadCurve({ sections }: { sections: ActivitySection[] }) {
  // Extract load points for activities that have bloom_level
  const points = sections
    .map((s, i) => ({
      index: i,
      load: s.bloom_level ? BLOOM_LOAD[s.bloom_level] : null,
    }))
    .filter((p): p is { index: number; load: number } => p.load !== null);

  if (points.length < 2) return null;

  const W = 120;
  const H = 24;
  const padY = 3;
  const usableH = H - padY * 2;

  // Map points to SVG coordinates
  const coords = points.map((p, i) => ({
    x: points.length === 1 ? W / 2 : (i / (points.length - 1)) * W,
    y: padY + usableH - ((p.load - 1) / 5) * usableH, // 1→bottom, 6→top
    load: p.load,
  }));

  // Build smooth curve path using cardinal spline approximation
  // Simple: use SVG polyline with rounded corners via cubic bezier
  let linePath = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpx = (prev.x + curr.x) / 2;
    linePath += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  // Area path (line path + close to bottom)
  const areaPath = linePath + ` L ${coords[coords.length - 1].x} ${H} L ${coords[0].x} ${H} Z`;

  // Compute average load for label
  const avgLoad = points.reduce((sum, p) => sum + p.load, 0) / points.length;
  const avgLabel = avgLoad <= 2 ? "Low" : avgLoad <= 3.5 ? "Medium" : avgLoad <= 4.5 ? "High" : "Very High";
  const avgColor = loadColor(avgLoad);

  // Check if pattern follows good Workshop Model shape (ramp up then ease off)
  // Peak should be in middle-to-late section, not at very start or very end
  const peakIdx = coords.reduce((best, c, i) => (c.y < coords[best].y ? i : best), 0);
  const peakPosition = coords.length > 1 ? peakIdx / (coords.length - 1) : 0.5;
  const goodShape = peakPosition >= 0.3 && peakPosition <= 0.85;

  // Build hover title
  const levelNames = points.map((p) => {
    const name = Object.entries(BLOOM_LOAD).find(([, v]) => v === p.load)?.[0] || "";
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
  const title = `Cognitive load flow: ${levelNames.join(" → ")}${goodShape ? " ✓ Good shape" : ""}`;

  return (
    <div className="flex items-center gap-2" title={title}>
      <span className="text-xs text-gray-500 font-medium">Load</span>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
        {/* Gradient fill under curve */}
        <defs>
          <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={avgColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={avgColor} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path d={areaPath} fill="url(#loadGrad)" />
        {/* Line */}
        <path d={linePath} fill="none" stroke={avgColor} strokeWidth="1.5" strokeLinecap="round" />
        {/* Dots at each point */}
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="2" fill={loadColor(c.load)} stroke="white" strokeWidth="0.5" />
        ))}
      </svg>
      <span
        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
        style={{ color: avgColor, backgroundColor: `${avgColor}15` }}
      >
        {avgLabel}
      </span>
      {goodShape && (
        <span className="text-[10px] text-emerald-600" title="Cognitive load peaks in the middle — good Workshop Model shape">
          ✓
        </span>
      )}
    </div>
  );
}

/**
 * DimensionsSummaryBar — compact summary of Dimensions metadata for a lesson's activities.
 * Shows: Bloom distribution mini-bar, cognitive load curve, UDL coverage dots (3 principles), grouping variety.
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

  // Count activities with bloom_level (needed for cognitive load curve)
  const bloomSections = sections.filter((s) => s.bloom_level);

  // If nothing is set, don't show the bar
  if (bloomTotal === 0 && udlCount === 0 && groupings.size === 0 && aiRulesCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 mb-3 bg-gray-50 rounded-lg border border-gray-100 flex-wrap">
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

      {/* Cognitive load curve sparkline */}
      {bloomSections.length >= 2 && (
        <CognitiveLoadCurve sections={sections} />
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
