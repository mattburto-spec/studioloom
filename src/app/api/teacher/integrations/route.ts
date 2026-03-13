import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { encrypt } from "@/lib/encryption";
import { nanoid } from "nanoid";

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
 * GET /api/teacher/integrations
 * Returns the teacher's LMS integration config (never exposes raw API token).
 */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: integration } = await supabase
    .from("teacher_integrations")
    .select("id, provider, subdomain, lti_consumer_key, created_at, updated_at")
    .eq("teacher_id", user.id)
    .single();

  if (!integration) {
    return NextResponse.json({ integration: null });
  }

  // Check if token exists (never expose it)
  const { data: tokenCheck } = await supabase
    .from("teacher_integrations")
    .select("encrypted_api_token")
    .eq("teacher_id", user.id)
    .single();

  return NextResponse.json({
    integration: {
      ...integration,
      has_api_token: !!tokenCheck?.encrypted_api_token,
    },
  });
}

/**
 * POST /api/teacher/integrations
 * Save or update LMS integration config.
 * Body: { provider, subdomain, apiToken? }
 * Generates LTI consumer key + secret on first save.
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { provider, subdomain, apiToken } = body as {
    provider?: string;
    subdomain?: string;
    apiToken?: string;
  };

  if (!provider) {
    return NextResponse.json({ error: "Provider is required" }, { status: 400 });
  }

  // Check if integration already exists
  const { data: existing } = await supabase
    .from("teacher_integrations")
    .select("id, lti_consumer_key")
    .eq("teacher_id", user.id)
    .single();

  const updateData: Record<string, unknown> = {
    provider,
    subdomain: subdomain || null,
    updated_at: new Date().toISOString(),
  };

  // Only encrypt and save token if provided (allows updating other fields without re-entering token)
  if (apiToken) {
    updateData.encrypted_api_token = encrypt(apiToken);
  }

  if (existing) {
    // Update existing integration
    const { error } = await supabase
      .from("teacher_integrations")
      .update(updateData)
      .eq("teacher_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return the existing LTI credentials
    return NextResponse.json({
      success: true,
      lti_consumer_key: existing.lti_consumer_key,
    });
  } else {
    // Create new integration with LTI credentials
    const ltiConsumerKey = `questerra_${nanoid(16)}`;
    const ltiConsumerSecret = nanoid(32);

    const { error } = await supabase.from("teacher_integrations").insert({
      teacher_id: user.id,
      ...updateData,
      lti_consumer_key: ltiConsumerKey,
      lti_consumer_secret: encrypt(ltiConsumerSecret),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      lti_consumer_key: ltiConsumerKey,
      lti_consumer_secret: ltiConsumerSecret,
      message: "Save this LTI secret — it will not be shown again.",
    });
  }
}
