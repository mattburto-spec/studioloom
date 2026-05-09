import { NextRequest, NextResponse } from "next/server";
import { getItemTags } from "@/lib/knowledge-library";
import { requireTeacher } from "@/lib/auth/require-teacher";

// Un-quarantined (9 Apr 2026) — Knowledge pipeline restored.

/**
 * GET /api/teacher/knowledge/tags
 *
 * Returns all unique tags across the teacher's knowledge items.
 * Used for tag autocomplete in the library UI.
 */
export async function GET(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const tags = await getItemTags(teacherId);

  return NextResponse.json({ tags });
}
