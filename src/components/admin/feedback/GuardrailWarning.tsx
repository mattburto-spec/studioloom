"use client";

/**
 * §5.4: Red banner for requires_manual_approval,
 * amber for tier boundary crossing (30 or 70).
 */

interface GuardrailWarningProps {
  requiresManualApproval: boolean;
  guardrailFlags: string[];
  currentValue: unknown;
  proposedValue: unknown;
  field: string;
}

export default function GuardrailWarning({
  requiresManualApproval,
  guardrailFlags,
  currentValue,
  proposedValue,
  field,
}: GuardrailWarningProps) {
  const warnings: Array<{ level: "red" | "amber"; message: string }> = [];

  // Red: requires manual approval
  if (requiresManualApproval) {
    warnings.push({
      level: "red",
      message: "Requires manual approval — cannot be auto-processed",
    });
  }

  // Red: guardrail flags (clamped, invalid step, etc.)
  for (const flag of guardrailFlags) {
    warnings.push({ level: "red", message: flag });
  }

  // Amber: tier boundary crossing for efficacy_score
  if (field === "efficacy_score" && typeof currentValue === "number" && typeof proposedValue === "number") {
    const boundaries = [30, 70];
    for (const b of boundaries) {
      const crossesUp = currentValue < b && proposedValue >= b;
      const crossesDown = currentValue >= b && proposedValue < b;
      if (crossesUp || crossesDown) {
        warnings.push({
          level: "amber",
          message: `Crosses tier boundary at ${b} (${currentValue} → ${proposedValue})`,
        });
      }
    }
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-1">
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`text-xs rounded px-3 py-1.5 font-medium ${
            w.level === "red"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          {w.level === "red" ? "🚫" : "⚠️"} {w.message}
        </div>
      ))}
    </div>
  );
}
