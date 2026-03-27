import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AIProviderConfig } from "./types";
import type { PageContent, UnitWizardInput, LessonJourneyInput, TimelineActivity, TimelineSkeleton } from "@/types";
import { type CriterionKey, EMPHASIS_PAGE_COUNT } from "@/lib/constants";
import { buildPageGenerationTool, buildLessonGenerationTool, buildTimelineGenerationTool, buildSkeletonGenerationTool } from "./schemas";
import type { UnitType } from "./unit-types";

/**
 * Anthropic Claude provider — uses the official SDK.
 *
 * Key improvements over raw fetch:
 * - Automatic retries on transient failures (429, 500, network)
 * - Tool use for guaranteed structured JSON output
 * - Proper TypeScript types throughout
 * - Streaming support (via streamCriterionPages)
 */
export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      maxRetries: 2,
    });
  }

  async generateCriterionPages(
    criterion: CriterionKey,
    input: UnitWizardInput,
    systemPrompt: string,
    userPrompt: string,
    unitType: UnitType = "design"
  ): Promise<Record<string, PageContent>> {
    const emphasis = input.criteriaFocus?.[criterion] || "standard";
    const pageCount = EMPHASIS_PAGE_COUNT[emphasis] || 3;
    const tool = buildPageGenerationTool(criterion, pageCount, unitType);

    const response = await this.client.messages.create({
      model: this.config.modelName || "claude-sonnet-4-6",
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 16000,
      temperature: 0.7,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
    });

    // Extract the tool use result — guaranteed to be valid JSON matching our schema
    const toolUseBlock = response.content.find(
      (block) => block.type === "tool_use"
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error("AI did not return structured output via tool use");
    }

    const pages = toolUseBlock.input as Record<string, PageContent>;

    // Verify we got the expected pages
    const expectedKeys = Array.from({ length: pageCount }, (_, i) => `${criterion}${i + 1}`);
    for (const key of expectedKeys) {
      if (!pages[key]) {
        throw new Error(`Missing page ${key} in AI response`);
      }
    }

    return pages;
  }

  /**
   * Generate outlines using tool use for structured output.
   */
  async generateOutlines(
    systemPrompt: string,
    userPrompt: string,
    tool: Anthropic.Tool
  ): Promise<Record<string, unknown>> {
    const response = await this.client.messages.create({
      model: this.config.modelName || "claude-sonnet-4-6",
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 6000,
      temperature: 0.8,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
    });

    const toolUseBlock = response.content.find(
      (block) => block.type === "tool_use"
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error("AI did not return structured output via tool use");
    }

    return toolUseBlock.input as Record<string, unknown>;
  }

  /**
   * Stream criterion pages — yields partial page data as it arrives.
   * Uses streaming with tool use to progressively deliver content.
   */
  async *streamCriterionPages(
    criterion: CriterionKey,
    input: UnitWizardInput,
    systemPrompt: string,
    userPrompt: string,
    unitType: UnitType = "design"
  ): AsyncGenerator<{ type: "partial_json"; json: string } | { type: "complete"; pages: Record<string, PageContent> }> {
    const emphasis = input.criteriaFocus?.[criterion] || "standard";
    const pageCount = EMPHASIS_PAGE_COUNT[emphasis] || 3;
    const tool = buildPageGenerationTool(criterion, pageCount, unitType);

    const stream = this.client.messages.stream({
      model: this.config.modelName || "claude-sonnet-4-6",
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 16000,
      temperature: 0.7,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
    });

    // Yield partial JSON chunks as they arrive
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "input_json_delta"
      ) {
        yield { type: "partial_json", json: event.delta.partial_json };
      }
    }

    // Get the final complete message
    const finalMessage = await stream.finalMessage();
    const toolUseBlock = finalMessage.content.find(
      (block) => block.type === "tool_use"
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error("AI did not return structured output via tool use");
    }

    const pages = toolUseBlock.input as Record<string, PageContent>;
    yield { type: "complete", pages };
  }

  // =========================================================================
  // Journey Mode — Lesson-based generation
  // =========================================================================

  /**
   * Generate a batch of lesson pages for journey mode.
   */
  async generateLessonPages(
    lessonIds: string[],
    systemPrompt: string,
    userPrompt: string,
    unitType: UnitType = "design"
  ): Promise<Record<string, PageContent>> {
    const tool = buildLessonGenerationTool(lessonIds, unitType);
    const maxTokens = Math.max(16000, lessonIds.length * 2500);

    const response = await this.client.messages.create({
      model: this.config.modelName || "claude-sonnet-4-6",
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: maxTokens,
      temperature: 0.7,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
    });

    const toolUseBlock = response.content.find(
      (block) => block.type === "tool_use"
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error("AI did not return structured output via tool use");
    }

    const pages = toolUseBlock.input as Record<string, PageContent>;

    // Verify we got the expected lessons
    for (const id of lessonIds) {
      if (!pages[id]) {
        throw new Error(`Missing lesson ${id} in AI response`);
      }
    }

    return pages;
  }

  /**
   * Stream lesson pages for journey mode — yields partial data as it arrives.
   */
  async *streamLessonPages(
    lessonIds: string[],
    systemPrompt: string,
    userPrompt: string,
    unitType: UnitType = "design"
  ): AsyncGenerator<{ type: "partial_json"; json: string } | { type: "complete"; pages: Record<string, PageContent> }> {
    const tool = buildLessonGenerationTool(lessonIds, unitType);
    const maxTokens = Math.max(16000, lessonIds.length * 2500);

    const stream = this.client.messages.stream({
      model: this.config.modelName || "claude-sonnet-4-6",
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: maxTokens,
      temperature: 0.7,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "input_json_delta"
      ) {
        yield { type: "partial_json", json: event.delta.partial_json };
      }
    }

    const finalMessage = await stream.finalMessage();
    const toolUseBlock = finalMessage.content.find(
      (block) => block.type === "tool_use"
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error("AI did not return structured output via tool use");
    }

    const pages = toolUseBlock.input as Record<string, PageContent>;
    yield { type: "complete", pages };
  }

  // =========================================================================
  // Timeline Mode — Flat activity sequence generation
  // =========================================================================

  /**
   * Generate a batch of timeline activities for a phase or full unit.
   */
  async generateTimelineActivities(
    estimatedCount: number,
    systemPrompt: string,
    userPrompt: string
  ): Promise<TimelineActivity[]> {
    const tool = buildTimelineGenerationTool(estimatedCount);
    const maxTokens = Math.max(16000, estimatedCount * 800);

    const response = await this.client.messages.create({
      model: this.config.modelName || "claude-sonnet-4-6",
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: maxTokens,
      temperature: 0.7,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
    });

    const toolUseBlock = response.content.find(
      (block) => block.type === "tool_use"
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error("AI did not return structured output via tool use");
    }

    const result = toolUseBlock.input as { activities: TimelineActivity[] };

    if (!result.activities || !Array.isArray(result.activities)) {
      throw new Error("AI response missing activities array");
    }

    return result.activities;
  }

  /**
   * Stream timeline activities — yields partial data as it arrives.
   */
  async *streamTimelineActivities(
    estimatedCount: number,
    systemPrompt: string,
    userPrompt: string
  ): AsyncGenerator<{ type: "partial_json"; json: string } | { type: "complete"; activities: TimelineActivity[] }> {
    const tool = buildTimelineGenerationTool(estimatedCount);
    const maxTokens = Math.max(16000, estimatedCount * 800);

    const stream = this.client.messages.stream({
      model: this.config.modelName || "claude-sonnet-4-6",
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: maxTokens,
      temperature: 0.7,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "input_json_delta"
      ) {
        yield { type: "partial_json", json: event.delta.partial_json };
      }
    }

    const finalMessage = await stream.finalMessage();
    const toolUseBlock = finalMessage.content.find(
      (block) => block.type === "tool_use"
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error("AI did not return structured output via tool use");
    }

    const result = toolUseBlock.input as { activities: TimelineActivity[] };
    yield { type: "complete", activities: result.activities || [] };
  }

  /**
   * Generate a lesson skeleton — fast, non-streaming, lightweight.
   * Returns lesson titles, key questions, timing, activity hints.
   */
  async generateSkeleton(
    systemPrompt: string,
    userPrompt: string,
    totalLessons: number
  ): Promise<TimelineSkeleton> {
    const tool = buildSkeletonGenerationTool(totalLessons);

    // Always use generous max_tokens — skeleton JSON is large.
    // Each lesson needs ~300-400 tokens of output. Add 2000 for narrativeArc + overhead.
    // Use 16384 as ceiling to handle even 30+ lesson units safely.
    const maxTokens = Math.min(Math.max(8192, totalLessons * 400 + 2000), 16384);

    const callAPI = async (tokens: number) => {
      return this.client.messages.create({
        model: this.config.modelName || "claude-sonnet-4-6",
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: tokens,
        temperature: 0.7,
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
      });
    };

    let response = await callAPI(maxTokens);

    // Log stop reason for debugging truncation issues
    let stopReason = response.stop_reason;
    console.log(`[generateSkeleton] stop_reason=${stopReason}, content_blocks=${response.content.length}, model=${response.model}, usage=${JSON.stringify(response.usage)}, max_tokens=${maxTokens}`);

    // Auto-retry on truncation: if stop_reason is max_tokens or end_turn with empty input,
    // retry once with maximum tokens
    const toolUseBlockFirst = response.content.find((block) => block.type === "tool_use");
    const firstInputEmpty = toolUseBlockFirst?.type === "tool_use" && Object.keys(toolUseBlockFirst.input as Record<string, unknown>).length === 0;

    if ((stopReason === "max_tokens" || firstInputEmpty) && maxTokens < 16384) {
      console.warn(`[generateSkeleton] Truncation detected (stop_reason=${stopReason}, emptyInput=${firstInputEmpty}). Retrying with max_tokens=16384...`);
      response = await callAPI(16384);
      stopReason = response.stop_reason;
      console.log(`[generateSkeleton] RETRY: stop_reason=${stopReason}, content_blocks=${response.content.length}, model=${response.model}, usage=${JSON.stringify(response.usage)}, max_tokens=16384`);
    }

    const toolUseBlock = response.content.find(
      (block) => block.type === "tool_use"
    );

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      // Log full response for debugging
      console.error("[generateSkeleton] No tool_use block found. Content types:", response.content.map(b => b.type));
      throw new Error(`AI did not return structured skeleton output. Stop reason: ${stopReason}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = toolUseBlock.input as any;
    const rawKeys = Object.keys(raw);

    // Log what we got for debugging
    if (rawKeys.length === 0) {
      console.error("[generateSkeleton] Empty tool input after all attempts.", {
        stopReason,
        usage: response.usage,
        contentBlockTypes: response.content.map(b => b.type),
        fullResponse: JSON.stringify(response.content).slice(0, 1000),
      });
      throw new Error(
        `Skeleton generation failed: AI returned empty tool input (likely truncated). ` +
        `Stop reason: ${stopReason}. Lessons requested: ${totalLessons}. ` +
        `Try reducing the number of lessons or regenerating.`
      );
    }

    // The AI sometimes nests the data differently — try to find lessons
    let result: TimelineSkeleton;
    if (raw.lessons && Array.isArray(raw.lessons)) {
      result = raw as TimelineSkeleton;
    } else {
      // Try common nesting patterns: { skeleton: { lessons: [...] } }, { output: { lessons: [...] } }
      const nested = raw.skeleton || raw.output || raw.result || raw.data;
      if (nested?.lessons && Array.isArray(nested.lessons)) {
        result = nested as TimelineSkeleton;
      } else {
        // Last resort: look for any array property that looks like lessons
        const arrayKeys = rawKeys.filter(k => Array.isArray(raw[k]) && raw[k].length > 0 && raw[k][0]?.title);
        if (arrayKeys.length > 0) {
          result = { lessons: raw[arrayKeys[0]], narrativeArc: raw.narrativeArc || "" } as TimelineSkeleton;
        } else {
          const keys = rawKeys.join(", ");
          throw new Error(`AI response missing lessons array. Got keys: [${keys}]. Stop reason: ${stopReason}. Response may have been truncated or malformed — try again.`);
        }
      }
    }

    // Ensure every lesson has required array fields (defensive against partial AI output)
    result.lessons = result.lessons.map((l, i) => ({
      ...l,
      lessonNumber: l.lessonNumber || i + 1,
      lessonId: l.lessonId || `L${String(i + 1).padStart(2, "0")}`,
      criterionTags: l.criterionTags || [],
      activityHints: l.activityHints || [],
      successCriteria: l.successCriteria || [],
      cumulativeVocab: l.cumulativeVocab || [],
      cumulativeSkills: l.cumulativeSkills || [],
    }));

    return result;
  }

  /**
   * Lightweight generation for suggestions/autoconfig (no tool use, just text).
   */
  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: this.config.modelName || "claude-sonnet-4-6",
      system: systemPrompt + "\n\nReturn ONLY valid JSON. No markdown fences, no explanations.",
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: options?.maxTokens ?? 500,
      temperature: options?.temperature ?? 0.3,
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "";
  }
}
