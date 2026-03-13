import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { decrypt } from "@/lib/encryption";
import { createLMSProvider } from "@/lib/lms";

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

/**
 * GET /api/teacher/integrations/classes
 * Fetch classes from the teacher's configured LMS provider.
 * Uses the provider factory — works with any LMS that implements LMSProvider.
 */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get teacher's integration config
  const { data: integration } = await supabase
    .from("teacher_integrations")
    .select("provider, subdomain, encrypted_api_token")
    .eq("teacher_id", user.id)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: "No LMS integration configured. Go to Settings to set up." },
      { status: 404 }
    );
  }

  if (!integration.encrypted_api_token || !integration.subdomain) {
    return NextResponse.json(
      { error: "LMS integration is incomplete. Please update your settings." },
      { status: 400 }
    );
  }

  try {
    const apiToken = decrypt(integration.encrypted_api_token);
    const provider = createLMSProvider(integration.provider, {
      subdomain: integration.subdomain,
      apiToken,
    });

    const classes = await provider.getClasses();
    return NextResponse.json({ classes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch classes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
