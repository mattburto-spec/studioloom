"use client";

/**
 * §5.4: Before/after block JSON side-by-side with changed fields highlighted.
 */

interface FeedbackDiffProps {
  field: string;
  currentValue: unknown;
  proposedValue: unknown;
  /** Optional full block data for richer context */
  blockData?: Record<string, unknown> | null;
}

export default function FeedbackDiff({ field, currentValue, proposedValue, blockData }: FeedbackDiffProps) {
  const isNumeric = typeof currentValue === "number" && typeof proposedValue === "number";

  return (
    <div className="border rounded-lg overflow-hidden text-xs">
      <div className="grid grid-cols-2 divide-x">
        {/* Before */}
        <div className="p-3 bg-red-50">
          <div className="font-medium text-red-700 mb-1">Before</div>
          <div className="font-mono text-red-900">
            <span className="text-gray-500">{field}: </span>
            {formatValue(currentValue)}
          </div>
        </div>

        {/* After */}
        <div className="p-3 bg-emerald-50">
          <div className="font-medium text-emerald-700 mb-1">After (proposed)</div>
          <div className="font-mono text-emerald-900">
            <span className="text-gray-500">{field}: </span>
            {formatValue(proposedValue)}
          </div>
        </div>
      </div>

      {/* Delta bar for numeric values */}
      {isNumeric && (
        <div className="border-t px-3 py-2 bg-gray-50 flex items-center gap-2">
          <span className="text-gray-500">Change:</span>
          <span className={`font-medium ${(proposedValue as number) > (currentValue as number) ? "text-emerald-600" : "text-red-600"}`}>
            {(proposedValue as number) > (currentValue as number) ? "+" : ""}
            {((proposedValue as number) - (currentValue as number)).toFixed(1)}
          </span>
          {field === "efficacy_score" && (
            <TierIndicator current={currentValue as number} proposed={proposedValue as number} />
          )}
        </div>
      )}

      {/* Block context */}
      {blockData && (
        <div className="border-t px-3 py-2 bg-gray-50">
          <div className="text-gray-500 mb-1">Block context</div>
          <div className="flex gap-3 flex-wrap">
            {blockData.title ? <span>Title: {String(blockData.title)}</span> : null}
            {blockData.time_weight ? <span>Time: {String(blockData.time_weight)}</span> : null}
            {blockData.bloom_level ? <span>Bloom: {String(blockData.bloom_level)}</span> : null}
          </div>
        </div>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function TierIndicator({ current, proposed }: { current: number; proposed: number }) {
  const getTier = (score: number) => {
    if (score >= 70) return { label: "High", color: "text-emerald-600" };
    if (score >= 30) return { label: "Mid", color: "text-amber-600" };
    return { label: "Low", color: "text-red-600" };
  };

  const currentTier = getTier(current);
  const proposedTier = getTier(proposed);

  if (currentTier.label === proposedTier.label) return null;

  return (
    <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
      Tier: {currentTier.label} → {proposedTier.label}
    </span>
  );
}
