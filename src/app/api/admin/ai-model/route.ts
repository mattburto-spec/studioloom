import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getModelConfig, saveModelConfig, getRawConfig, invalidateConfigCache } from "@/lib/ai/model-config";
import { DEFAULT_MODEL_CONFIG } from "@/lib/ai/model-config-defaults";
import type { AIModelConfig, RelativeEmphasis } from "@/types/ai-model-config";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "mattburto@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

function createSupabaseServer(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
}

async function verifyAdmin(request: NextRequest): Promise<string | null> {
  const supabase = createSupabaseServer(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) return null;
  return user.email;
}

/**
 * GET /api/admin/ai-model
 * Returns the fully resolved config (defaults + overrides) plus raw overrides.
 */
export async function GET(request: NextRequest) {
  const email = await verifyAdmin(request);
  if (!email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [resolved, raw] = await Promise.all([
      getModelConfig(),
      getRawConfig(),
    ]);

    return NextResponse.json({
      resolved,
      raw,
      defaults: DEFAULT_MODEL_CONFIG,
    });
  } catch (err) {
    console.error("[admin/ai-model] GET error:", err);
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/ai-model
 * Saves config overrides to the database.
 */
export async function PUT(request: NextRequest) {
  const email = await verifyAdmin(request);
  if (!email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const config = body.config as AIModelConfig;
    const changeNote = body.changeNote as string | undefined;

    // Validate relativeEmphasis sums to 100 if provided
    if (config.relativeEmphasis) {
      const re = { ...DEFAULT_MODEL_CONFIG.relativeEmphasis, ...config.relativeEmphasis } as RelativeEmphasis;
      const sum = Object.values(re).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 0.5) {
        return NextResponse.json(
          { error: `Relative emphasis must sum to 100% (currently ${sum}%)` },
          { status: 400 }
        );
      }
    }

    await saveModelConfig(config, email, changeNote);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/ai-model] PUT error:", err);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}
