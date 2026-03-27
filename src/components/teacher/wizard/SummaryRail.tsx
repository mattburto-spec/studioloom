"use client";

import type { WizardState } from "@/hooks/useWizardState";
import type { UnitType } from "@/lib/ai/unit-types";

interface Props {
  state: WizardState;
}

export function SummaryRail({ state }: Props) {
  const { input } = state;
  const unitType = input.unitType || "design";
  const items: Array<{ label: string; value: string }> = [];

  // Type-aware field extraction
  if (unitType === "design") {
    if (input.globalContext) items.push({ label: "Global Context", value: input.globalContext });
    if (input.keyConcept) items.push({ label: "Key Concept", value: input.keyConcept });
    if (input.relatedConcepts.length > 0) items.push({ label: "Related", value: input.relatedConcepts.join(", ") });
    if (input.specificSkills.length > 0) items.push({ label: "Skills", value: input.specificSkills.join(", ") });
  } else if (unitType === "service") {
    if (input.communityContext) items.push({ label: "Community", value: input.communityContext });
    if (input.sdgConnection) items.push({ label: "SDG", value: input.sdgConnection });
    if (input.serviceOutcomes?.length) items.push({ label: "Outcomes", value: input.serviceOutcomes.join(", ") });
    if (input.partnerType) items.push({ label: "Partner", value: input.partnerType });
  } else if (unitType === "personal_project") {
    if (input.personalInterest) items.push({ label: "Interest", value: input.personalInterest });
    if (input.goalType) items.push({ label: "Goal", value: input.goalType });
    if (input.presentationFormat) items.push({ label: "Format", value: input.presentationFormat });
  } else if (unitType === "inquiry") {
    if (input.centralIdea) items.push({ label: "Central Idea", value: input.centralIdea });
    if (input.transdisciplinaryTheme) items.push({ label: "Theme", value: input.transdisciplinaryTheme });
    if (input.linesOfInquiry?.length) items.push({ label: "Lines of Inquiry", value: input.linesOfInquiry.join(", ") });
  }

  // Shared fields across all types
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
