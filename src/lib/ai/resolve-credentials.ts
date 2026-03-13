import { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";

export interface ResolvedCredentials {
  provider: "anthropic" | "openai-compatible";
  apiKey: string;
  apiEndpoint: string;
  modelName: string;
  source: "teacher" | "platform";
}

/**
 * Resolve AI credentials for a given teacher.
 *
 * Priority:
 * 1. Teacher's own ai_settings (BYOK)
 * 2. Platform ANTHROPIC_API_KEY env var
 * 3. Platform GROQ_API_KEY env var (free tier, fast, OpenAI-compatible)
 * 4. Platform GEMINI_API_KEY env var (OpenAI-compatible endpoint)
 *
 * The `preferredModel` param lets callers pick a lighter model for
 * fast tasks (e.g. llama-3.3-70b-versatile for suggestions).
 */
export async function resolveCredentials(
  supabase: SupabaseClient,
  teacherId: string,
  preferredModel?: string
): Promise<ResolvedCredentials | null> {
  // 1. Try teacher's own key
  const { data: settings } = await supabase
    .from("ai_settings")
    .select("*")
    .eq("teacher_id", teacherId)
    .single();

  if (settings?.encrypted_api_key) {
    try {
      const apiKey = decrypt(settings.encrypted_api_key);
      return {
        provider: settings.provider === "anthropic" ? "anthropic" : "openai-compatible",
        apiKey,
        apiEndpoint: settings.api_endpoint,
        modelName: settings.model_name,
        source: "teacher",
      };
    } catch {
      // Decryption failed — fall through to platform key
    }
  }

  // 2. Fall back to platform Anthropic key
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return {
      provider: "anthropic",
      apiKey: anthropicKey,
      apiEndpoint: "https://api.anthropic.com/v1",
      modelName: preferredModel || "claude-sonnet-4-6",
      source: "platform",
    };
  }

  // 3. Fall back to platform Groq key (free tier, OpenAI-compatible)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      provider: "openai-compatible",
      apiKey: groqKey,
      apiEndpoint: "https://api.groq.com/openai/v1",
      modelName: preferredModel || "llama-3.3-70b-versatile",
      source: "platform",
    };
  }

  // 4. Fall back to platform Gemini key (OpenAI-compatible)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return {
      provider: "openai-compatible",
      apiKey: geminiKey,
      apiEndpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
      modelName: preferredModel || "gemini-2.0-flash",
      source: "platform",
    };
  }

  return null;
}
