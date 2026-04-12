"use client";

/**
 * §5.4: Render the 6 formula input values from the reasoning JSONB
 * as a human-readable explanation.
 */

interface ProposalReasoningProps {
  reasoning: Record<string, number> | null | undefined;
  evidenceCount: number;
}

const LABELS: Record<string, { label: string; format: (v: number) => string; weight: string }> = {
  keptRate:        { label: "Kept rate",       format: v => `${Math.round(v * 100)}%`, weight: "0.30" },
  completionRate:  { label: "Completion",      format: v => `${Math.round(v * 100)}%`, weight: "0.25" },
  timeAccuracy:    { label: "Time accuracy",   format: v => `${Math.round(v * 100)}%`, weight: "0.20" },
  deletionRate:    { label: "Deletion rate",   format: v => `${Math.round(v * 100)}%`, weight: "0.10" },
  paceScore:       { label: "Pace score",      format: v => `${Math.round(v * 100)}%`, weight: "0.10" },
  editRate:        { label: "Edit rate",       format: v => `${Math.round(v * 100)}%`, weight: "0.05" },
};

function getBarColor(key: string, value: number): string {
  // For deletion and edit rate, lower is better (inverted)
  const inverted = key === "deletionRate" || key === "editRate";
  const effective = inverted ? 1 - value : value;
  if (effective >= 0.7) return "bg-emerald-400";
  if (effective >= 0.4) return "bg-amber-400";
  return "bg-red-400";
}

export default function ProposalReasoning({ reasoning, evidenceCount }: ProposalReasoningProps) {
  if (!reasoning || Object.keys(reasoning).length === 0) {
    return (
      <div className="text-xs text-gray-400 italic">
        No reasoning data available (pre-migration proposal)
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-gray-600 mb-2">
        Formula breakdown ({evidenceCount} evidence points)
      </div>
      {Object.entries(LABELS).map(([key, meta]) => {
        const value = reasoning[key] ?? 0;
        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="w-24 text-gray-500 truncate">{meta.label}</span>
            <span className="w-8 text-gray-400 text-right">{meta.weight}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${getBarColor(key, value)}`}
                style={{ width: `${Math.min(100, Math.round(value * 100))}%` }}
              />
            </div>
            <span className="w-10 text-right font-medium text-gray-700">{meta.format(value)}</span>
          </div>
        );
      })}
    </div>
  );
}
