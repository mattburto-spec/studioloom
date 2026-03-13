import type { AIProvider, AIProviderConfig } from "./types";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { AnthropicProvider } from "./anthropic";

/**
 * Factory function to create an AI provider instance.
 * Adding a new AI backend = import + one case statement.
 *
 * Currently supported:
 * - "openai-compatible" — Any OpenAI-compatible API (OpenAI, DeepSeek, Qwen, Groq, Ollama, etc.)
 * - "anthropic"         — Anthropic Claude API (Messages API)
 *
 * Future providers (just add a case):
 * - "google"     — Google Gemini API
 */
export function createAIProvider(
  provider: string,
  config: AIProviderConfig
): AIProvider {
  if (!config.apiKey) {
    throw new Error("API key is required");
  }

  switch (provider) {
    case "openai-compatible":
      return new OpenAICompatibleProvider(config);

    case "anthropic":
      return new AnthropicProvider(config);

    // Future providers:
    // case "google":
    //   return new GoogleProvider(config);

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

// Re-export types
export type { AIProvider, AIProviderConfig } from "./types";
