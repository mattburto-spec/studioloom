// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { recordGenerationUsage } from "@/lib/knowledge/feedback";

// Un-quarantined (9 Apr 2026) — Knowledge pipeline restored.

async function getUser(request: NextRequest) {
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
  return user ? { id: user.id } : null;
}

/**
 * POST /api/teacher/knowledge/record-usage
 * Record that specific RAG chunks were used in a generation.
 * Called fire-and-forget when a teacher saves a generated unit.
 *
 * Body: { chunkIds: string[] }
 */
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { chunkIds } = body as { chunkIds: string[] };

  if (!chunkIds || !Array.isArray(chunkIds) || chunkIds.length === 0) {
    return NextResponse.json({ ok: true }); // Nothing to record
  }

  try {
    await recordGenerationUsage(chunkIds);
    return NextResponse.json({ ok: true });
  } catch {
    // Non-critical — usage tracking should never fail the save
    return NextResponse.json({ ok: true });
  }
}
