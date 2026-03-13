import type { AIProvider, AIProviderConfig } from "./types";
import type { PageContent, UnitWizardInput } from "@/types";
import { type CriterionKey, EMPHASIS_PAGE_COUNT } from "@/lib/constants";

/**
 * OpenAI-compatible provider.
 * Works with: OpenAI, DeepSeek, Qwen, Groq, Together, Ollama, LM Studio, etc.
 * Any API that follows the OpenAI chat completions format.
 */
export class OpenAICompatibleProvider implements AIProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async generateCriterionPages(
    criterion: CriterionKey,
    input: UnitWizardInput,
    systemPrompt: string,
    userPrompt: string
  ): Promise<Record<string, PageContent>> {
    const endpoint = this.config.apiEndpoint.replace(/\/+$/, "");
    const url = `${endpoint}/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `AI API error (${response.status}): ${errorText.slice(0, 200)}`
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    // Extract pages — handle both { pages: { A1: ... } } and { A1: ... } formats
    const pages = (parsed.pages as Record<string, PageContent>) || parsed;

    // Validate we got the right pages for this criterion
    const emphasis = input.criteriaFocus?.[criterion] || "standard";
    const pageCount = EMPHASIS_PAGE_COUNT[emphasis] || 3;
    const expectedKeys = Array.from({ length: pageCount }, (_, i) => `${criterion}${i + 1}`);
    const result: Record<string, PageContent> = {};

    for (const key of expectedKeys) {
      if (!pages[key]) {
        throw new Error(`Missing page ${key} in AI response`);
      }
      result[key] = pages[key] as PageContent;
    }

    return result;
  }
}
