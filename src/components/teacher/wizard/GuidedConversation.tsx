"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import {
  MYP_GLOBAL_CONTEXTS,
  MYP_KEY_CONCEPTS,
  MYP_RELATED_CONCEPTS_DESIGN,
  MYP_ATL_SKILL_CATEGORIES,
  DESIGN_SKILLS,
  SERVICE_COMMUNITY_CONTEXTS,
  SERVICE_SDG_OPTIONS,
  SERVICE_OUTCOMES,
  SERVICE_PARTNER_TYPES,
  PP_GOAL_TYPES,
  PP_PRESENTATION_FORMATS,
  INQUIRY_THEMES,
  CRITERIA,
  getCriteriaForType,
  getCriterionKeys,
  type CriterionKey,
} from "@/lib/constants";
import type { WizardState, WizardDispatch, ConversationTurn as TurnType } from "@/hooks/useWizardState";
import type { Suggestions, SuggestionStatus } from "@/hooks/useWizardSuggestions";
import type { UnitType } from "@/lib/ai/unit-types";
import { ConversationTurn } from "./ConversationTurn";
import { SummaryRail } from "./SummaryRail";

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  suggestions: Suggestions;
  suggestionStatus: SuggestionStatus;
}

// Generate the conversation turns template — type-aware, returns different turns based on unitType
function buildTurns(unitType: UnitType | string = "design", suggestions?: Suggestions, journeyMode?: boolean): TurnType[] {
  const turns: TurnType[] = [];

  // Helper function to build ATL options (shared across all types)
  const atlOptions: Array<{ label: string; value: string; description?: string }> = [];
  for (const category of MYP_ATL_SKILL_CATEGORIES) {
    for (const skill of category.skills) {
      atlOptions.push({
        label: skill,
        value: skill,
        description: category.category,
      });
    }
  }

  // Helper function to build criteria options for a given type
  const buildCriteriaOptions = (type: UnitType | string) => {
    const typeMap = getCriteriaForType(type);
    return Object.entries(typeMap).map(([key, def]) => ({
      label: `${key}: ${def.name}`,
      value: key,
      description: "standard",
    }));
  };

  // === TYPE: DESIGN (default, preserve existing) ===
  if (unitType === "design") {
    const gcOptions = MYP_GLOBAL_CONTEXTS.map((gc) => ({
      label: gc.label,
      value: gc.label,
      description: gc.description,
    }));

    if (suggestions?.globalContext) {
      const suggested = new Set(suggestions.globalContext);
      gcOptions.sort((a, b) => {
        const aS = suggested.has(a.value) ? 0 : 1;
        const bS = suggested.has(b.value) ? 0 : 1;
        return aS - bS;
      });
    }

    const kcOptions = (MYP_KEY_CONCEPTS as readonly string[]).map((kc) => ({
      label: kc,
      value: kc,
    }));

    if (suggestions?.keyConcept) {
      const suggested = new Set(suggestions.keyConcept);
      kcOptions.sort((a, b) => {
        const aS = suggested.has(a.value) ? 0 : 1;
        const bS = suggested.has(b.value) ? 0 : 1;
        return aS - bS;
      });
    }

    const rcOptions = (MYP_RELATED_CONCEPTS_DESIGN as readonly string[]).map((rc) => ({
      label: rc,
      value: rc,
      description: suggestions?.relatedConcepts?.includes(rc) ? "Recommended" : undefined,
    }));

    if (suggestions?.relatedConcepts) {
      const suggestedSet = new Set(suggestions.relatedConcepts);
      rcOptions.sort((a, b) => {
        const aS = suggestedSet.has(a.value) ? 0 : 1;
        const bS = suggestedSet.has(b.value) ? 0 : 1;
        return aS - bS;
      });
    }

    const skillOptions = (DESIGN_SKILLS as readonly string[]).map((s) => ({
      label: s,
      value: s,
    }));

    const criteriaOptions = buildCriteriaOptions("design");

    const soiOptions: Array<{ label: string; value: string; description?: string }> = [];
    if (suggestions?.statementOfInquiry) {
      soiOptions.push({
        label: suggestions.statementOfInquiry,
        value: suggestions.statementOfInquiry,
        description: "AI-suggested based on your choices",
      });
    }

    return [
      {
        id: "globalContext",
        question: "Which MYP global context fits best? I'll use this to frame the unit around real-world connections.",
        field: "globalContext",
        options: gcOptions,
        answer: null,
        status: "active",
      },
      {
        id: "keyConcept",
        question: "What's the big idea driving this unit? Pick the key concept that best captures your focus.",
        field: "keyConcept",
        options: kcOptions,
        answer: null,
        status: "active",
      },
      {
        id: "relatedConcepts",
        question: "Which related concepts will students explore? These add depth to the key concept. Pick 2–3.",
        field: "relatedConcepts",
        options: rcOptions,
        answer: null,
        status: "active",
      },
      {
        id: "specificSkills",
        question: "Which making skills will students use? Pick all that apply.",
        field: "specificSkills",
        options: skillOptions,
        answer: null,
        status: "active",
      },
      {
        id: "atlSkills",
        question: "Which ATL (Approaches to Learning) skills will this unit develop?",
        field: "atlSkills",
        options: atlOptions,
        answer: null,
        status: "active",
      },
      {
        id: "criteriaEmphasis",
        question: journeyMode
          ? "Which criteria will you assess in this unit? The AI will tag activities accordingly."
          : "How deep should each criterion go? Adjust the emphasis for your unit's needs.",
        field: "criteriaFocus",
        options: criteriaOptions,
        answer: null,
        status: "active",
      },
      {
        id: "statementOfInquiry",
        question: "Here's a statement of inquiry based on your choices. You can accept it, edit it, or write your own.",
        field: "statementOfInquiry",
        options: soiOptions,
        answer: null,
        status: "active",
      },
    ];
  }

  // === TYPE: SERVICE ===
  if (unitType === "service") {
    const contextOptions = (SERVICE_COMMUNITY_CONTEXTS as readonly string[]).map((c) => ({
      label: c,
      value: c,
    }));

    const sdgOptions = (SERVICE_SDG_OPTIONS as readonly string[]).map((s) => ({
      label: s,
      value: s,
    }));

    const outcomeOptions = (SERVICE_OUTCOMES as readonly string[]).map((o) => ({
      label: o,
      value: o,
    }));

    const partnerOptions = (SERVICE_PARTNER_TYPES as readonly string[]).map((p) => ({
      label: p,
      value: p,
    }));

    const criteriaOptions = buildCriteriaOptions("service");

    const soiOptions: Array<{ label: string; value: string; description?: string }> = [];
    if (suggestions?.statementOfInquiry) {
      soiOptions.push({
        label: suggestions.statementOfInquiry,
        value: suggestions.statementOfInquiry,
        description: "AI-suggested based on your choices",
      });
    }

    return [
      {
        id: "communityContext",
        question: "What community need will students address?",
        field: "communityContext",
        options: contextOptions,
        answer: null,
        status: "active",
      },
      {
        id: "sdgConnection",
        question: "Which UN Sustainable Development Goal connects to this project? (Optional — you can skip this)",
        field: "sdgConnection",
        options: sdgOptions,
        answer: null,
        status: "active",
      },
      {
        id: "serviceOutcomes",
        question: "What outcomes should the service achieve? Pick 2–3.",
        field: "serviceOutcomes",
        options: outcomeOptions,
        answer: null,
        status: "active",
      },
      {
        id: "partnerType",
        question: "Will students work with a community partner?",
        field: "partnerType",
        options: partnerOptions,
        answer: null,
        status: "active",
      },
      {
        id: "atlSkills",
        question: "Which ATL (Approaches to Learning) skills will this unit develop?",
        field: "atlSkills",
        options: atlOptions,
        answer: null,
        status: "active",
      },
      {
        id: "criteriaEmphasis",
        question: journeyMode
          ? "Which criteria will you assess in this unit? The AI will tag activities accordingly."
          : "How deep should each criterion go? Adjust the emphasis for your unit's needs.",
        field: "criteriaFocus",
        options: criteriaOptions,
        answer: null,
        status: "active",
      },
      {
        id: "statementOfInquiry",
        question: "Here's a statement of inquiry based on your choices. You can accept it, edit it, or write your own.",
        field: "statementOfInquiry",
        options: soiOptions,
        answer: null,
        status: "active",
      },
    ];
  }

  // === TYPE: PERSONAL PROJECT ===
  if (unitType === "personal_project") {
    const goalOptions = (PP_GOAL_TYPES as readonly string[]).map((g) => ({
      label: g,
      value: g,
    }));

    const formatOptions = (PP_PRESENTATION_FORMATS as readonly string[]).map((f) => ({
      label: f,
      value: f,
    }));

    const criteriaOptions = buildCriteriaOptions("personal_project");

    const soiOptions: Array<{ label: string; value: string; description?: string }> = [];
    if (suggestions?.statementOfInquiry) {
      soiOptions.push({
        label: suggestions.statementOfInquiry,
        value: suggestions.statementOfInquiry,
        description: "AI-suggested based on your choices",
      });
    }

    return [
      {
        id: "personalInterest",
        question: "What area of personal interest will students explore? You can type your own.",
        field: "personalInterest",
        options: [],
        answer: null,
        status: "active",
      },
      {
        id: "goalType",
        question: "What type of product or outcome will students create?",
        field: "goalType",
        options: goalOptions,
        answer: null,
        status: "active",
      },
      {
        id: "presentationFormat",
        question: "How will students present their project?",
        field: "presentationFormat",
        options: formatOptions,
        answer: null,
        status: "active",
      },
      {
        id: "atlSkills",
        question: "Which ATL (Approaches to Learning) skills will this unit develop?",
        field: "atlSkills",
        options: atlOptions,
        answer: null,
        status: "active",
      },
      {
        id: "criteriaEmphasis",
        question: journeyMode
          ? "Which criteria will you assess in this unit? The AI will tag activities accordingly."
          : "How deep should each criterion go? Adjust the emphasis for your unit's needs.",
        field: "criteriaFocus",
        options: criteriaOptions,
        answer: null,
        status: "active",
      },
      {
        id: "statementOfInquiry",
        question: "Here's a statement of inquiry based on your choices. You can accept it, edit it, or write your own.",
        field: "statementOfInquiry",
        options: soiOptions,
        answer: null,
        status: "active",
      },
    ];
  }

  // === TYPE: INQUIRY ===
  if (unitType === "inquiry") {
    const themeOptions = (INQUIRY_THEMES as readonly string[]).map((t) => ({
      label: t,
      value: t,
    }));

    const criteriaOptions = buildCriteriaOptions("inquiry");

    const soiOptions: Array<{ label: string; value: string; description?: string }> = [];
    if (suggestions?.statementOfInquiry) {
      soiOptions.push({
        label: suggestions.statementOfInquiry,
        value: suggestions.statementOfInquiry,
        description: "AI-suggested based on your choices",
      });
    }

    return [
      {
        id: "centralIdea",
        question: "What is the central idea students will investigate? You can type your own.",
        field: "centralIdea",
        options: [],
        answer: null,
        status: "active",
      },
      {
        id: "transdisciplinaryTheme",
        question: "Which transdisciplinary theme connects?",
        field: "transdisciplinaryTheme",
        options: themeOptions,
        answer: null,
        status: "active",
      },
      {
        id: "linesOfInquiry",
        question: "What specific lines of inquiry will students follow? Pick 2–3 or write your own.",
        field: "linesOfInquiry",
        options: [],
        answer: null,
        status: "active",
      },
      {
        id: "atlSkills",
        question: "Which ATL (Approaches to Learning) skills will this unit develop?",
        field: "atlSkills",
        options: atlOptions,
        answer: null,
        status: "active",
      },
      {
        id: "criteriaEmphasis",
        question: journeyMode
          ? "Which criteria will you assess in this unit? The AI will tag activities accordingly."
          : "How deep should each criterion go? Adjust the emphasis for your unit's needs.",
        field: "criteriaFocus",
        options: criteriaOptions,
        answer: null,
        status: "active",
      },
      {
        id: "statementOfInquiry",
        question: "Here's a statement of inquiry based on your choices. You can accept it, edit it, or write your own.",
        field: "statementOfInquiry",
        options: soiOptions,
        answer: null,
        status: "active",
      },
    ];
  }

  // Fallback to Design if type is unknown
  return buildTurns("design", suggestions, journeyMode);
}

// Build dynamic multi-select turn IDs based on unit type
function getMultiSelectTurns(unitType: UnitType | string = "design"): Set<string> {
  const baseMultiSelect = new Set(["atlSkills"]);

  if (unitType === "design") {
    baseMultiSelect.add("relatedConcepts");
    baseMultiSelect.add("specificSkills");
  }
  if (unitType === "service") {
    baseMultiSelect.add("serviceOutcomes");
  }
  if (unitType === "inquiry") {
    baseMultiSelect.add("linesOfInquiry");
  }

  return baseMultiSelect;
}

export function GuidedConversation({ state, dispatch, suggestions, suggestionStatus }: Props) {
  const [multiSelectValues, setMultiSelectValues] = useState<string[]>([]);

  // Refs to track what suggestion values we've already applied (prevents infinite loops)
  const appliedSOIRef = useRef<string | undefined>(undefined);
  const appliedRCRef = useRef<string | undefined>(undefined);
  const turnsRef = useRef(state.conversationTurns);
  turnsRef.current = state.conversationTurns;

  // Initialize turns on mount
  useEffect(() => {
    if (state.conversationTurns.length === 0) {
      const unitType = state.input.unitType || "design";
      const turns = buildTurns(unitType, suggestions, state.journeyMode);
      dispatch({ type: "SET_TURNS", turns });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.conversationTurns.length, dispatch]);

  // Update SOI turn options when Tier 3 suggestions arrive
  useEffect(() => {
    const soi = suggestions?.statementOfInquiry;
    if (!soi || soi === appliedSOIRef.current) return;

    const turns = turnsRef.current;
    if (turns.length === 0) return;

    const soiTurn = turns.find((t) => t.id === "statementOfInquiry");
    if (!soiTurn || soiTurn.status === "answered") return;

    appliedSOIRef.current = soi;

    const updatedTurns = turns.map((t) => {
      if (t.id === "statementOfInquiry") {
        return {
          ...t,
          options: [{
            label: soi,
            value: soi,
            description: "AI-suggested based on your choices",
          }],
        };
      }
      return t;
    });
    dispatch({ type: "SET_TURNS", turns: updatedTurns });
  }, [suggestions?.statementOfInquiry, dispatch]);

  // Update related concepts options when Tier 2 suggestions arrive
  useEffect(() => {
    const rc = suggestions?.relatedConcepts;
    if (!rc || rc.length === 0) return;

    // Use a serialized key to detect actual changes
    const rcKey = rc.join(",");
    if (rcKey === appliedRCRef.current) return;

    const turns = turnsRef.current;
    if (turns.length === 0) return;

    const rcTurn = turns.find((t) => t.id === "relatedConcepts");
    if (!rcTurn || rcTurn.status === "answered") return;

    appliedRCRef.current = rcKey;

    const suggestedSet = new Set(rc);
    const sortedOptions = [...rcTurn.options]
      .map((o) => ({
        ...o,
        description: suggestedSet.has(o.value) ? "Recommended" : undefined,
      }))
      .sort((a, b) => {
        const aS = suggestedSet.has(a.value) ? 0 : 1;
        const bS = suggestedSet.has(b.value) ? 0 : 1;
        return aS - bS;
      });

    const updatedTurns = turns.map((t) =>
      t.id === "relatedConcepts" ? { ...t, options: sortedOptions } : t
    );
    dispatch({ type: "SET_TURNS", turns: updatedTurns });
  }, [suggestions?.relatedConcepts, dispatch]);

  const handleAnswer = useCallback((turnId: string, answer: string | string[]) => {
    dispatch({ type: "ANSWER_TURN", turnId, answer });

    // Apply answer to wizard input (and journey input when in journey mode)
    const isJourney = state.journeyMode;

    switch (turnId) {
      // Design-specific
      case "globalContext":
        dispatch({ type: "SET_INPUT", key: "globalContext", value: answer });
        if (isJourney) dispatch({ type: "SET_JOURNEY_INPUT", key: "globalContext", value: answer });
        break;
      case "keyConcept":
        dispatch({ type: "SET_INPUT", key: "keyConcept", value: answer });
        if (isJourney) dispatch({ type: "SET_JOURNEY_INPUT", key: "keyConcept", value: answer });
        break;
      case "relatedConcepts":
        if (Array.isArray(answer)) {
          dispatch({ type: "BULK_SET_INPUT", values: { relatedConcepts: answer } });
          if (isJourney) dispatch({ type: "BULK_SET_JOURNEY_INPUT", values: { relatedConcepts: answer } });
        }
        break;
      case "specificSkills":
        if (Array.isArray(answer)) {
          dispatch({ type: "BULK_SET_INPUT", values: { specificSkills: answer } });
          if (isJourney) dispatch({ type: "BULK_SET_JOURNEY_INPUT", values: { specificSkills: answer } });
        }
        break;

      // Service-specific
      case "communityContext":
        if (typeof answer === "string") {
          dispatch({ type: "SET_INPUT", key: "communityContext", value: answer });
          if (isJourney) dispatch({ type: "SET_JOURNEY_INPUT", key: "communityContext", value: answer });
        }
        break;
      case "sdgConnection":
        if (typeof answer === "string") {
          dispatch({ type: "SET_INPUT", key: "sdgConnection", value: answer });
          if (isJourney) dispatch({ type: "SET_JOURNEY_INPUT", key: "sdgConnection", value: answer });
        }
        break;
      case "serviceOutcomes":
        if (Array.isArray(answer)) {
          dispatch({ type: "BULK_SET_INPUT", values: { serviceOutcomes: answer } });
          if (isJourney) dispatch({ type: "BULK_SET_JOURNEY_INPUT", values: { serviceOutcomes: answer } });
        }
        break;
      case "partnerType":
        if (typeof answer === "string") {
          dispatch({ type: "SET_INPUT", key: "partnerType", value: answer });
          if (isJourney) dispatch({ type: "SET_JOURNEY_INPUT", key: "partnerType", value: answer });
        }
        break;

      // Personal Project-specific
      case "personalInterest":
        if (typeof answer === "string") {
          dispatch({ type: "SET_INPUT", key: "personalInterest", value: answer });
          if (isJourney) dispatch({ type: "SET_JOURNEY_INPUT", key: "personalInterest", value: answer });
        }
        break;
      case "goalType":
        if (typeof answer === "string") {
          dispatch({ type: "SET_INPUT", key: "goalType", value: answer });
          if (isJourney) dispatch({ type: "SET_JOURNEY_INPUT", key: "goalType", value: answer });
        }
        break;
      case "presentationFormat":
        if (typeof answer === "string") {
          dispatch({ type: "SET_INPUT", key: "presentationFormat", value: answer });
          if (isJourney) dispatch({ type: "SET_JOURNEY_INPUT", key: "presentationFormat", value: answer });
        }
        break;

      // Inquiry-specific
      case "centralIdea":
        if (typeof answer === "string") {
          dispatch({ type: "SET_INPUT", key: "centralIdea", value: answer });
          if (isJourney) dispatch({ type: "SET_JOURNEY_INPUT", key: "centralIdea", value: answer });
        }
        break;
      case "transdisciplinaryTheme":
        if (typeof answer === "string") {
          dispatch({ type: "SET_INPUT", key: "transdisciplinaryTheme", value: answer });
          if (isJourney) dispatch({ type: "SET_JOURNEY_INPUT", key: "transdisciplinaryTheme", value: answer });
        }
        break;
      case "linesOfInquiry":
        if (Array.isArray(answer)) {
          dispatch({ type: "BULK_SET_INPUT", values: { linesOfInquiry: answer } });
          if (isJourney) dispatch({ type: "BULK_SET_JOURNEY_INPUT", values: { linesOfInquiry: answer } });
        }
        break;

      // Shared across all types
      case "atlSkills":
        if (Array.isArray(answer)) {
          dispatch({ type: "BULK_SET_INPUT", values: { atlSkills: answer } });
          if (isJourney) dispatch({ type: "BULK_SET_JOURNEY_INPUT", values: { atlSkills: answer } });
        }
        break;
      case "criteriaEmphasis":
        if (state.journeyMode) {
          // Journey mode: answer is the selected criteria as array or JSON
          if (Array.isArray(answer)) {
            dispatch({ type: "SET_JOURNEY_INPUT", key: "assessmentCriteria", value: answer });
          } else if (typeof answer === "string") {
            try {
              const parsed = JSON.parse(answer);
              const criteria = parsed.selectedCriteria || parsed.assessmentCriteria || [answer];
              dispatch({ type: "SET_JOURNEY_INPUT", key: "assessmentCriteria", value: criteria });
            } catch {
              dispatch({ type: "SET_JOURNEY_INPUT", key: "assessmentCriteria", value: [answer] });
            }
          }
        } else {
          // Criterion mode: Answer comes as JSON string: { selectedCriteria, criteriaFocus }
          if (typeof answer === "string") {
            try {
              const parsed = JSON.parse(answer);
              if (parsed.selectedCriteria && parsed.criteriaFocus) {
                dispatch({ type: "BULK_SET_INPUT", values: {
                  selectedCriteria: parsed.selectedCriteria,
                  criteriaFocus: parsed.criteriaFocus,
                }});
              } else {
                // Legacy: plain criteriaFocus object
                dispatch({ type: "BULK_SET_INPUT", values: { criteriaFocus: parsed } });
              }
            } catch { /* ignore */ }
          }
        }
        break;
      case "statementOfInquiry":
        if (typeof answer === "string") {
          dispatch({ type: "SET_INPUT", key: "statementOfInquiry", value: answer });
          if (isJourney) dispatch({ type: "SET_JOURNEY_INPUT", key: "statementOfInquiry", value: answer });
        }
        break;
    }

    setMultiSelectValues([]);

    // Advance to next turn after a short delay for visual feedback
    setTimeout(() => {
      dispatch({ type: "ADVANCE_TURN" });
    }, 300);
  }, [dispatch]);

  const handleSkip = useCallback((turnId: string) => {
    dispatch({ type: "SKIP_TURN", turnId });
    setMultiSelectValues([]);
    setTimeout(() => {
      dispatch({ type: "ADVANCE_TURN" });
    }, 200);
  }, [dispatch]);

  const currentTurn = state.conversationTurns[state.currentTurnIndex];
  const answeredTurns = state.conversationTurns.slice(0, state.currentTurnIndex);

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-4xl mx-auto">
      {/* Left: conversation */}
      <div className="flex-1 space-y-4">
        {/* Previous answers (compact) */}
        {answeredTurns.map((turn) => {
          if (turn.status === "skipped") return null;

          let answerLabel: string;
          if (turn.id === "criteriaEmphasis") {
            try {
              const raw = typeof turn.answer === "string" ? JSON.parse(turn.answer) : {};
              const focus = raw.criteriaFocus || raw;
              const selected: string[] = raw.selectedCriteria || Object.keys(focus);
              const parts: string[] = [];
              if (selected.length < 4) {
                parts.push(`Criteria: ${selected.join(", ")}`);
              }
              const nonStandard = Object.entries(focus)
                .filter(([, v]) => v !== "standard")
                .map(([k, v]) => `${k}: ${v}`);
              if (nonStandard.length > 0) parts.push(...nonStandard);
              answerLabel = parts.length > 0 ? parts.join(", ") : "All standard";
            } catch {
              answerLabel = "Standard";
            }
          } else if (Array.isArray(turn.answer)) {
            answerLabel = turn.answer.join(", ");
          } else {
            answerLabel = turn.options.find((o) => o.value === turn.answer)?.label || (turn.answer as string) || "";
          }

          return (
            <div key={turn.id} className="flex items-start gap-3 opacity-60">
              <div className="w-8 h-8 rounded-full bg-brand-purple/10 flex items-center justify-center flex-shrink-0">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="#7B2FF2">
                  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                </svg>
              </div>
              <div className="bg-surface-alt rounded-2xl rounded-tl-md px-4 py-2">
                <p className="text-xs text-text-secondary">{turn.question}</p>
                <p className="text-sm font-medium text-text-primary mt-1">{answerLabel}</p>
              </div>
            </div>
          );
        })}

        {/* Current turn */}
        {currentTurn && (
          <ConversationTurn
            turn={currentTurn}
            onAnswer={(answer) => handleAnswer(currentTurn.id, answer)}
            onSkip={() => handleSkip(currentTurn.id)}
            isMultiSelect={getMultiSelectTurns(state.input.unitType || "design").has(currentTurn.id)}
            selectedValues={getMultiSelectTurns(state.input.unitType || "design").has(currentTurn.id) ? multiSelectValues : undefined}
            criteriaFocus={state.input.criteriaFocus}
            selectedCriteria={state.input.selectedCriteria}
            suggestionStatus={
              (currentTurn.id === "relatedConcepts" || currentTurn.id === "statementOfInquiry") && suggestionStatus === "loading"
                ? "loading"
                : undefined
            }
          />
        )}

        {/* All done message */}
        {!currentTurn && state.currentTurnIndex >= state.conversationTurns.length && (
          <div className="animate-slide-up flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-green/10 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="#2DA05E">
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
              </svg>
            </div>
            <div className="bg-accent-green/5 border border-accent-green/20 rounded-2xl rounded-tl-md px-4 py-3">
              <p className="text-sm text-text-primary font-medium">
                Great, I have everything I need! Let me find the best approaches for your unit...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right: summary rail */}
      <div className="lg:w-64 lg:flex-shrink-0">
        <div className="lg:sticky lg:top-24">
          <SummaryRail state={state} />
        </div>
      </div>
    </div>
  );
}
