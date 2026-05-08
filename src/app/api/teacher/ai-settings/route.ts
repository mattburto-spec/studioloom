// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { encrypt } from "@/lib/encryption";
import { requireTeacher } from "@/lib/auth/require-teacher";

function createSupabaseServer(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Read-only for API routes
        },
      },
    }
  );
}

/**
 * GET /api/teacher/ai-settings
 * Returns the teacher's AI provider config (never exposes raw API key).
 *
 * Hardened 2026-05-09: requireTeacher() enforces user_type==='teacher'.
 * Pre-fix, a student session could read this endpoint and learn whether the
 * teacher had a BYOK key configured. (The encrypted_api_key column itself
 * was never returned, but `has_api_key` was — a yes/no PII signal.)
 */
export async function GET(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const supabase = createSupabaseServer(request);

  const { data: settings } = await supabase
    .from("ai_settings")
    .select("provider, api_endpoint, model_name, created_at, updated_at")
    .eq("teacher_id", teacherId)
    .single();

  if (!settings) {
    return NextResponse.json({ settings: null });
  }

  // Check if key exists (never expose it)
  const { data: keyCheck } = await supabase
    .from("ai_settings")
    .select("encrypted_api_key")
    .eq("teacher_id", teacherId)
    .single();

  return NextResponse.json({
    settings: {
      ...settings,
      has_api_key: !!keyCheck?.encrypted_api_key,
    },
  });
}

/**
 * POST /api/teacher/ai-settings
 * Save or update AI provider config.
 * Body: { provider?, apiEndpoint?, modelName?, apiKey? }
 *
 * Hardened 2026-05-09: requireTeacher() enforces user_type==='teacher' so a
 * student session can no longer overwrite a teacher's BYOK config.
 */
export async function POST(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const supabase = createSupabaseServer(request);

  const body = await request.json();
  const { provider, apiEndpoint, modelName, apiKey } = body as {
    provider?: string;
    apiEndpoint?: string;
    modelName?: string;
    apiKey?: string;
  };

  if (!apiKey && !provider) {
    return NextResponse.json(
      { error: "At least provider or apiKey is required" },
      { status: 400 }
    );
  }

  // Check if settings already exist
  const { data: existing } = await supabase
    .from("ai_settings")
    .select("teacher_id")
    .eq("teacher_id", teacherId)
    .single();

  if (existing) {
    // Update existing
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (provider) updateData.provider = provider;
    if (apiEndpoint) updateData.api_endpoint = apiEndpoint;
    if (modelName) updateData.model_name = modelName;
    if (apiKey) updateData.encrypted_api_key = encrypt(apiKey);

    const { error } = await supabase
      .from("ai_settings")
      .update(updateData)
      .eq("teacher_id", teacherId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } else {
    // Create new
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required for initial setup" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("ai_settings").insert({
      teacher_id: teacherId,
      provider: provider || "openai-compatible",
      api_endpoint: apiEndpoint || "https://api.openai.com/v1",
      model_name: modelName || "gpt-4o-mini",
      encrypted_api_key: encrypt(apiKey),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }
}
