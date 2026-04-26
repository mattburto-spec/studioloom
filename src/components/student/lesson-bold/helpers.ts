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
