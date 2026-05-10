import { SupabaseClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";
import { createAdminClient } from "@/lib/supabase/admin";

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
    } catch (err) {
      // F-16 9 May 2026: don't swallow silently. The most common cause is
      // ENCRYPTION_KEY rotation drift (key was rotated but ai_settings rows
      // still have ciphertext encrypted with the old key). Without a log,
      // the teacher's BYOK silently stops working and the platform falls
      // back to the env-var key — which charges the platform tier instead
      // of the teacher's tier with no visibility.
      const cause = err instanceof Error ? err.message : "unknown";
      const teacherShortId = teacherId.slice(0, 8);
      console.error(
        `[resolve-credentials] BYOK decrypt failed for teacher=${teacherShortId} cause=${cause} — falling back to platform key`,
      );
      // Best-effort audit emit so the failure shows up on /admin/audit-log.
      // Use a fresh admin client (the SSR client passed in is RLS-bound and
      // can't write audit_events). Fire-and-forget; never throw.
      try {
        const audit = createAdminClient();
        await audit.from("audit_events").insert({
          event_type: "byok.decrypt_failed",
          actor_user_id: teacherId,
          target_table: "ai_settings",
          target_id: teacherId,
          metadata: { cause, fell_back_to: "platform" },
        });
      } catch (auditErr) {
        // Audit emit best-effort; don't block fallback chain.
        console.warn("[resolve-credentials] audit emit failed:", auditErr);
      }
      // NEVER log key material (settings.encrypted_api_key, the decrypted
      // apiKey, or the underlying ENCRYPTION_KEY env var).
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
