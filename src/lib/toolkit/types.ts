/**
 * Shared types for all toolkit API routes.
 */

export interface ToolkitAIResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export type EffortLevel = "low" | "medium" | "high";

export interface ToolkitRequestBody {
  action: string;
  challenge: string;
  sessionId: string;
  stepIndex?: number;
  idea?: string;
  existingIdeas?: string[];
  effortLevel?: EffortLevel;
  allIdeas?: string[][];
  /** Tool-specific extra fields */
  [key: string]: unknown;
}
