"use client";

import { useState } from "react";
import type { ConversationTurn as TurnType } from "@/hooks/useWizardState";
import { getCriterionDisplay, getCriterionKeys, type CriterionKey } from "@/lib/constants";

interface Props {
  turn: TurnType;
  onAnswer: (answer: string | string[]) => void;
  onSkip: () => void;
  isMultiSelect?: boolean;
  selectedValues?: string[];
  criteriaFocus?: Partial<Record<CriterionKey, "light" | "standard" | "emphasis">>;
  selectedCriteria?: CriterionKey[];
  unitType?: string;
  framework?: string;
  suggestionStatus?: "loading" | undefined;
}

const EMPHASIS_LEVELS = ["light", "standard", "emphasis"] as const;
const EMPHASIS_LABELS: Record<string, string> = {
  light: "Light",
  standard: "Standard",
  emphasis: "Deep",
};

export function ConversationTurn({
  turn,
  onAnswer,
  onSkip,
  isMultiSelect = false,
  selectedValues = [],
  criteriaFocus,
  selectedCriteria: selectedCriteriaProp,
  unitType,
  framework,
  suggestionStatus,
}: Props) {
  const [soiText, setSoiText] = useState("");
  const [localSelected, setLocalSelected] = useState<CriterionKey[]>(
    selectedCriteriaProp || ["A", "B", "C", "D"]
  );
  const [localCriteriaFocus, setLocalCriteriaFocus] = useState<Partial<Record<CriterionKey, "light" | "standard" | "emphasis">>>({
    A: criteriaFocus?.A || "standard",
    B: criteriaFocus?.B || "standard",
    C: criteriaFocus?.C || "standard",
    D: criteriaFocus?.D || "standard",
  });

  if (turn.status !== "active") return null;

  const handleSelect = (value: string) => {
    if (isMultiSelect) {
      const current = selectedValues;
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onAnswer(updated);
    } else {
      onAnswer(value);
    }
  };

  // --- Criteria Emphasis Turn (custom UI) ---
  if (turn.id === "criteriaEmphasis") {
    return (
      <div className="animate-slide-up">
        {/* AI question bubble */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-brand-purple/10 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#7B2FF2">
              <path d="M8 0l1.5 5.5L15 7l-5.5 1.5L8 14l-1.5-5.5L1 7l5.5-1.5z" />
            </svg>
          </div>
          <div className="bg-surface-alt rounded-2xl rounded-tl-md px-4 py-3 max-w-md">
            <p className="text-sm text-text-primary">{turn.question}</p>
          </div>
        </div>

        {/* Criterion selection + emphasis */}
        <div className="pl-11 space-y-3">
          {(getCriterionKeys(unitType || "design") as CriterionKey[]).map((key) => {
            const c = getCriterionDisplay(key, unitType, framework);
            const isSelected = localSelected.includes(key);
            return (
              <div key={key} className={`flex items-center gap-3 transition-opacity ${isSelected ? "" : "opacity-40"}`}>
                {/* Toggle checkbox */}
                <button
                  onClick={() => {
                    if (isSelected && localSelected.length <= 1) return;
                    if (isSelected) {
                      setLocalSelected((prev) => prev.filter((k) => k !== key));
                      setLocalCriteriaFocus((prev) => {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                      });
                    } else {
                      setLocalSelected((prev) => [...prev, key].sort() as CriterionKey[]);
                      setLocalCriteriaFocus((prev) => ({ ...prev, [key]: "standard" }));
                    }
                  }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border-2 transition-all ${
                    isSelected ? "text-white border-transparent" : "border-gray-300 text-gray-400 bg-white"
                  }`}
                  style={isSelected ? { backgroundColor: c.color } : undefined}
                  title={isSelected ? `Deselect Criterion ${key}` : `Select Criterion ${key}`}
                >
                  {key}
                </button>
                <div className="flex-1 flex gap-1">
                  {EMPHASIS_LEVELS.map((level) => (
                    <button
                      key={level}
                      disabled={!isSelected}
                      onClick={() => {
                        setLocalCriteriaFocus((prev) => ({ ...prev, [key]: level }));
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                        isSelected && localCriteriaFocus[key] === level
                          ? "text-white shadow-sm"
                          : "text-text-secondary bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      }`}
                      style={
                        isSelected && localCriteriaFocus[key] === level
                          ? { backgroundColor: c.color }
                          : undefined
                      }
                    >
                      {EMPHASIS_LABELS[level]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Selected summary */}
          <p className="text-[10px] text-text-secondary pl-1">
            {localSelected.length === 4
              ? "All 4 criteria selected"
              : `${localSelected.length} criteria selected: ${localSelected.join(", ")}`}
          </p>

          {/* Confirm button */}
          <button
            onClick={() => onAnswer(JSON.stringify({ selectedCriteria: localSelected, criteriaFocus: localCriteriaFocus }))}
            className="w-full py-2 bg-brand-purple text-white rounded-xl text-xs font-semibold hover:bg-brand-purple/90 transition mt-2"
          >
            Confirm emphasis
          </button>

          <button
            onClick={onSkip}
            className="text-xs text-text-secondary/60 hover:text-text-secondary transition pl-1 mt-1"
          >
            Skip (keep all standard)
          </button>
        </div>
      </div>
    );
  }

  // --- Statement of Inquiry Turn (custom UI) ---
  if (turn.id === "statementOfInquiry") {
    const aiSuggestion = turn.options[0]?.value || "";

    return (
      <div className="animate-slide-up">
        {/* AI question bubble */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-brand-purple/10 flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="#7B2FF2">
              <path d="M8 0l1.5 5.5L15 7l-5.5 1.5L8 14l-1.5-5.5L1 7l5.5-1.5z" />
            </svg>
          </div>
          <div className="bg-surface-alt rounded-2xl rounded-tl-md px-4 py-3 max-w-md">
            <p className="text-sm text-text-primary">{turn.question}</p>
          </div>
        </div>

        <div className="pl-11 space-y-3">
          {/* Loading state while waiting for AI suggestion */}
          {suggestionStatus === "loading" && !aiSuggestion && (
            <div className="flex items-center gap-2 text-xs text-text-secondary animate-pulse">
              <div className="w-3 h-3 rounded-full border-2 border-brand-purple/30 border-t-brand-purple animate-spin" />
              Generating a suggestion based on your choices...
            </div>
          )}

          {/* AI suggestion card */}
          {aiSuggestion && !soiText && (
            <div className="border-2 border-brand-purple/20 bg-brand-purple/5 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="#7B2FF2">
                  <path d="M8 0l1.5 5.5L15 7l-5.5 1.5L8 14l-1.5-5.5L1 7l5.5-1.5z" />
                </svg>
                <span className="text-[10px] text-brand-purple font-semibold uppercase tracking-wider">AI Suggestion</span>
              </div>
              <p className="text-sm text-text-primary italic leading-relaxed">{aiSuggestion}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onAnswer(aiSuggestion)}
                  className="flex-1 py-2 bg-brand-purple text-white rounded-lg text-xs font-semibold hover:bg-brand-purple/90 transition"
                >
                  Accept
                </button>
                <button
                  onClick={() => setSoiText(aiSuggestion)}
                  className="flex-1 py-2 border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-gray-50 transition"
                >
                  Edit
                </button>
              </div>
            </div>
          )}

          {/* No suggestion yet and not loading — show write your own */}
          {!aiSuggestion && suggestionStatus !== "loading" && !soiText && (
            <button
              onClick={() => setSoiText(" ")}
              className="w-full py-3 border-2 border-dashed border-border rounded-xl text-xs text-text-secondary hover:border-brand-purple/30 hover:text-brand-purple transition"
            >
              Write your own statement of inquiry
            </button>
          )}

          {/* Edit mode */}
          {soiText && (
            <div className="space-y-2">
              <textarea
                value={soiText.trim() ? soiText : ""}
                onChange={(e) => setSoiText(e.target.value)}
                placeholder="Students will understand that..."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none"
                autoFocus
              />
              <button
                onClick={() => {
                  if (soiText.trim()) onAnswer(soiText.trim());
                }}
                disabled={!soiText.trim()}
                className="w-full py-2 bg-brand-purple text-white rounded-xl text-xs font-semibold hover:bg-brand-purple/90 transition disabled:opacity-40"
              >
                Confirm
              </button>
            </div>
          )}

          <button
            onClick={onSkip}
            className="text-xs text-text-secondary/60 hover:text-text-secondary transition pl-1 mt-1"
          >
            Skip this
          </button>
        </div>
      </div>
    );
  }

  // --- Standard Turn (options list) ---
  return (
    <div className="animate-slide-up">
      {/* AI question bubble */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-brand-purple/10 flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="#7B2FF2">
            <path d="M8 0l1.5 5.5L15 7l-5.5 1.5L8 14l-1.5-5.5L1 7l5.5-1.5z" />
          </svg>
        </div>
        <div className="bg-surface-alt rounded-2xl rounded-tl-md px-4 py-3 max-w-md">
          <p className="text-sm text-text-primary">{turn.question}</p>
          {suggestionStatus === "loading" && (
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-brand-purple animate-pulse">
              <div className="w-2.5 h-2.5 rounded-full border border-brand-purple/30 border-t-brand-purple animate-spin" />
              Loading AI recommendations...
            </div>
          )}
        </div>
      </div>

      {/* Option cards */}
      <div className="pl-11 space-y-2">
        {turn.options.map((option) => {
          const isSelected = isMultiSelect
            ? selectedValues.includes(option.value)
            : turn.answer === option.value;

          return (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                isSelected
                  ? "border-brand-purple bg-brand-purple/5 shadow-sm"
                  : "border-border hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected ? "border-brand-purple bg-brand-purple" : "border-gray-300"
                }`}>
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="white">
                      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{option.label}</span>
                    {option.description === "Recommended" && (
                      <span className="text-[9px] font-semibold text-brand-purple bg-brand-purple/10 px-1.5 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                  {option.description && option.description !== "Recommended" && (
                    <p className="text-xs text-text-secondary mt-0.5">{option.description}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {/* Multi-select confirm button */}
        {isMultiSelect && selectedValues.length > 0 && (
          <button
            onClick={() => onAnswer(selectedValues)}
            className="w-full py-2 bg-brand-purple text-white rounded-xl text-xs font-semibold hover:bg-brand-purple/90 transition mt-2"
          >
            Confirm ({selectedValues.length} selected)
          </button>
        )}

        {/* Skip button */}
        <button
          onClick={onSkip}
          className="text-xs text-text-secondary/60 hover:text-text-secondary transition pl-1 mt-1"
        >
          Skip this
        </button>
      </div>
    </div>
  );
}
