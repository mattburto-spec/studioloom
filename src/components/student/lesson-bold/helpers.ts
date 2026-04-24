/**
 * Pure helpers for lesson-bold shell components. Kept separate from the `.tsx`
 * components so vitest tests can import them without a JSX transform plugin
 * (project convention — see ClassMachinePicker.test.tsx + DesignAssistantWidget.test.tsx).
 */

export type PhaseState = "done" | "current" | "upcoming";

export type PhaseInput = { done?: boolean; current?: boolean };

/**
 * Priority: done > current > upcoming. A phase that is both done AND current
 * resolves to done — completion wins over progress marker.
 */
export function derivePhaseState(phase: PhaseInput): PhaseState {
  if (phase.done) return "done";
  if (phase.current) return "current";
  return "upcoming";
}

export type AutonomyLevel = "scaffolded" | "balanced" | "independent";

export type AutonomyLevelConfig = {
  id: AutonomyLevel;
  name: string;
  sub: string;
  color: string;
};

/**
 * Canonical order: scaffolded → balanced → independent. Consumers must not
 * reorder — test at helpers.test.ts asserts this matches the UI order.
 */
export const AUTONOMY_LEVELS: readonly AutonomyLevelConfig[] = [
  {
    id: "scaffolded",
    name: "Show me the path",
    sub: "Hints on · examples on · step-by-step",
    color: "#FBBF24",
  },
  {
    id: "balanced",
    name: "Keep hints nearby",
    sub: "Hints hidden until asked · examples gated",
    color: "#0EA5A4",
  },
  {
    id: "independent",
    name: "I want to drive",
    sub: "No hints · no examples · Kit only on request",
    color: "#9333EA",
  },
] as const;

export function isLevelSelected(value: AutonomyLevel | null, id: AutonomyLevel): boolean {
  return value === id;
}
