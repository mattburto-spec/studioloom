import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

async function getTeacherId(request: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * PATCH: Update a unit's thumbnail_url (gallery selection or null to reset)
 */
export async function PATCH(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { unitId, thumbnailUrl } = body;

  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify teacher owns this unit
  const { data: unit } = await admin
    .from("units")
    .select("id, author_teacher_id")
    .eq("id", unitId)
    .maybeSingle();

  if (!unit || unit.author_teacher_id !== teacherId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Update thumbnail_url (null = reset to default)
  const { error } = await admin
    .from("units")
    .update({ thumbnail_url: thumbnailUrl ?? null })
    .eq("id", unitId);

  if (error) {
    // Graceful degradation if column doesn't exist yet
    if (error.message?.includes("thumbnail_url") || error.code === "PGRST204") {
      return NextResponse.json({ error: "Migration 052 not yet applied" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, thumbnailUrl: thumbnailUrl ?? null });
}
