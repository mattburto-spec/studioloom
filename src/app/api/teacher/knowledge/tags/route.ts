import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getItemTags } from "@/lib/knowledge-library";

// Un-quarantined (9 Apr 2026) — Knowledge pipeline restored.

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
 * GET /api/teacher/knowledge/tags
 *
 * Returns all unique tags across the teacher's knowledge items.
 * Used for tag autocomplete in the library UI.
 */
export async function GET(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tags = await getItemTags(teacherId);

  return NextResponse.json({ tags });
}
