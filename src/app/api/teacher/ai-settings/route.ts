import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { encrypt } from "@/lib/encryption";

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
 */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: settings } = await supabase
    .from("ai_settings")
    .select("provider, api_endpoint, model_name, created_at, updated_at")
    .eq("teacher_id", user.id)
    .single();

  if (!settings) {
    return NextResponse.json({ settings: null });
  }

  // Check if key exists (never expose it)
  const { data: keyCheck } = await supabase
    .from("ai_settings")
    .select("encrypted_api_key")
    .eq("teacher_id", user.id)
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
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    .eq("teacher_id", user.id)
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
      .eq("teacher_id", user.id);

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
      teacher_id: user.id,
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
