"use client";

import type { WizardState } from "@/hooks/useWizardState";

interface Props {
  state: WizardState;
}

export function SummaryRail({ state }: Props) {
  const { input } = state;
  const items: Array<{ label: string; value: string }> = [];

  if (input.globalContext) items.push({ label: "Global Context", value: input.globalContext });
  if (input.keyConcept) items.push({ label: "Key Concept", value: input.keyConcept });
  if (input.relatedConcepts.length > 0) items.push({ label: "Related", value: input.relatedConcepts.join(", ") });
  if (input.specificSkills.length > 0) items.push({ label: "Skills", value: input.specificSkills.join(", ") });
  if (input.atlSkills.length > 0) items.push({ label: "ATL Skills", value: input.atlSkills.join(", ") });

  const emphasis = Object.entries(input.criteriaFocus)
    .filter(([, v]) => v !== "standard")
    .map(([k, v]) => `${k}: ${v}`);
  if (emphasis.length > 0) items.push({ label: "Focus", value: emphasis.join(", ") });

  if (input.statementOfInquiry?.trim()) {
    items.push({ label: "SOI", value: input.statementOfInquiry });
  }

  if (items.length === 0) return null;

  return (
    <div className="animate-slide-up bg-surface-alt rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-accent-green/10 flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="#2DA05E">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-text-primary">Your choices</span>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label}>
            <div className="text-[10px] text-text-secondary uppercase tracking-wider">{item.label}</div>
            <div className="text-xs text-text-primary font-medium mt-0.5 line-clamp-3">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
