/**
 * AI Provider interface — mirrors the LMS provider pattern.
 * Each AI backend (Anthropic, OpenAI-compatible) implements this interface.
 * API routes use the factory to get the right provider — no AI-specific code in routes.
 */

import type { PageContent, UnitWizardInput, TimelineActivity, TimelineSkeleton } from "@/types";
import type { CriterionKey } from "@/lib/constants";
import type { UnitType } from "./unit-types";

export interface AIProvider {
  /**
   * Generate the 4 pages for a single criterion (A, B, C, or D).
   * Called 4 times by the wizard (once per criterion) for progress feedback.
   */
  generateCriterionPages(
    criterion: CriterionKey,
    input: UnitWizardInput,
    systemPrompt: string,
    userPrompt: string,
    unitType?: UnitType
  ): Promise<Record<string, PageContent>>;

  /**
   * Stream criterion pages — yields events as generation progresses.
   * Optional: providers that don't support streaming fall back to generateCriterionPages.
   */
  streamCriterionPages?(
    criterion: CriterionKey,
    input: UnitWizardInput,
    systemPrompt: string,
    userPrompt: string,
    unitType?: UnitType
  ): AsyncGenerator<
    | { type: "partial_json"; json: string }
    | { type: "complete"; pages: Record<string, PageContent> }
  >;

  /**
   * Generate outlines using structured output.
   * Optional: providers that don't support it use raw text generation.
   */
  generateOutlines?(
    systemPrompt: string,
    userPrompt: string,
    tool: unknown
  ): Promise<Record<string, unknown>>;

  /**
   * Lightweight text generation for suggestions/autoconfig.
   * Optional: providers can implement for lighter-weight calls.
   */
  generateText?(
    systemPrompt: string,
    userPrompt: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<string>;

  // --- Journey Mode ---

  /**
   * Generate a batch of lesson pages for journey-mode units.
   * Optional: only needed for journey-mode generation.
   */
  generateLessonPages?(
    lessonIds: string[],
    systemPrompt: string,
    userPrompt: string,
    unitType?: UnitType
  ): Promise<Record<string, PageContent>>;

  /**
   * Stream lesson pages for journey mode.
   * Optional: providers that don't support streaming fall back to generateLessonPages.
   */
  streamLessonPages?(
    lessonIds: string[],
    systemPrompt: string,
    userPrompt: string,
    unitType?: UnitType
  ): AsyncGenerator<
    | { type: "partial_json"; json: string }
    | { type: "complete"; pages: Record<string, PageContent> }
  >;

  // --- Timeline Mode ---

  /**
   * Generate a batch of timeline activities for a phase or full unit.
   * Optional: only needed for timeline-mode (v4) generation.
   */
  generateTimelineActivities?(
    estimatedCount: number,
    systemPrompt: string,
    userPrompt: string
  ): Promise<TimelineActivity[]>;

  /**
   * Stream timeline activities — yields partial data as it arrives.
   * Optional: providers that don't support streaming fall back to generateTimelineActivities.
   */
  streamTimelineActivities?(
    estimatedCount: number,
    systemPrompt: string,
    userPrompt: string
  ): AsyncGenerator<
    | { type: "partial_json"; json: string }
    | { type: "complete"; activities: TimelineActivity[] }
  >;

  /**
   * Generate a lesson skeleton — fast, non-streaming.
   * Returns lesson titles, key questions, timing, activity hints.
   */
  generateSkeleton?(
    systemPrompt: string,
    userPrompt: string,
    totalLessons: number
  ): Promise<TimelineSkeleton>;
}

export interface AIProviderConfig {
  apiEndpoint: string;
  apiKey: string;
  modelName: string;
}
