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

/**
 * Resolves a stored autonomy level (which may be NULL when the student
 * hasn't picked yet) to the level the UI should display under. Default
 * fallback is 'balanced' — the middle ground that preserves the
 * pre-AutonomyPicker behaviour (hints behind try-first, examples collapsed).
 *
 * Sub-Phase 3 of Lesson Bold. Used everywhere ActivityCard renders.
 */
export function resolveAutonomyDisplay(
  level: AutonomyLevel | null | undefined
): AutonomyLevel {
  return level ?? "balanced";
}

/**
 * Are hints AVAILABLE on this card at all? `independent` hides them entirely
 * (the student wants to drive — Kit only on request).
 */
export function hintsAvailable(level: AutonomyLevel): boolean {
  return level !== "independent";
}

/**
 * Should the hints block render OPEN by default vs sit behind a try-first
 * button? `scaffolded` opens by default. `balanced` gates behind a button.
 * `independent` is irrelevant — hints aren't available at all.
 */
export function hintsOpenByDefault(level: AutonomyLevel): boolean {
  return level === "scaffolded";
}

/**
 * Is the example response visible at all? Mirrors hintsAvailable.
 */
export function exampleVisible(level: AutonomyLevel): boolean {
  return level !== "independent";
}

/**
 * Should the example response render EXPANDED by default vs collapsed under
 * a `<details>` summary? Mirrors hintsOpenByDefault.
 */
export function exampleOpenByDefault(level: AutonomyLevel): boolean {
  return level === "scaffolded";
}
