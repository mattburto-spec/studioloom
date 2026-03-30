import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getKnowledgeItems,
  searchKnowledgeItems,
  createKnowledgeItem,
  generateItemChunks,
} from "@/lib/knowledge-library";
import type {
  CreateKnowledgeItemRequest,
  KnowledgeItemType,
} from "@/types/knowledge-library";

/**
 * Profile summary for knowledge item cards + detail panel.
 * Extracted from lesson_profiles.profile_data JSONB.
 */
interface ProfileSummary {
  pedagogicalApproach?: string;
  complexityLevel?: string;
  criteriaCovered?: string[];
  lessonDurationMinutes?: number;
  analysisDate?: string;
  bloomDistribution?: Record<string, number>;
  // Full profile_data for detail panel (only when available)
  profileData?: Record<string, unknown>;
}

/**
 * GET /api/teacher/knowledge/items
 *
 * List or search knowledge items for the authenticated teacher.
 * Query params: search, type, tags (comma-separated), framework, archived
 */
export async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const type = searchParams.get("type");
  const tagsStr = searchParams.get("tags");
  const framework = searchParams.get("framework");
  const archived = searchParams.get("archived");

  const filters = {
    item_type: (type || undefined) as KnowledgeItemType | undefined,
    tags: tagsStr ? tagsStr.split(",").map((t) => t.trim()) : undefined,
    framework: framework || undefined,
    is_archived: archived === "true" ? true : undefined,
  };

  // Use semantic search if query provided, otherwise list with filters
  const items = search
    ? await searchKnowledgeItems(search, teacherId, filters)
    : await getKnowledgeItems(teacherId, filters);

  // Fetch lightweight profile summaries for items that came from uploads
  // (Lesson Learned #19: separate try/catch query, never nested PostgREST)
  let profileMap: Record<string, ProfileSummary> = {};
  try {
    const uploadIds = items
      .map((item) => item.source_upload_id)
      .filter((id): id is string => !!id);

    if (uploadIds.length > 0) {
      const supabase = createAdminClient();
      const { data: profiles } = await supabase
        .from("lesson_profiles")
        .select("upload_id, pedagogical_approach, complexity_level, criteria_covered, estimated_duration_minutes, created_at, profile_data")
        .in("upload_id", uploadIds);

      if (profiles) {
        for (const p of profiles) {
          // Extract bloom_distribution from profile_data JSONB if available
          const pd = p.profile_data as Record<string, unknown> | null;
          const rawBloom = pd?.bloom_distribution as Record<string, unknown> | undefined;
          // Clean bloom: keep only numeric values, coerce strings, strip dominant_level
          let bloom: Record<string, number> | undefined;
          if (rawBloom && typeof rawBloom === "object") {
            const cleaned: Record<string, number> = {};
            for (const [k, v] of Object.entries(rawBloom)) {
              if (k === "dominant_level") continue; // Skip non-numeric field
              const num = typeof v === "string" ? parseFloat(v) : Number(v);
              if (!isNaN(num) && num > 0) cleaned[k] = num;
            }
            if (Object.keys(cleaned).length > 0) bloom = cleaned;
          }

          profileMap[p.upload_id] = {
            pedagogicalApproach: p.pedagogical_approach || undefined,
            complexityLevel: p.complexity_level || undefined,
            criteriaCovered: p.criteria_covered || undefined,
            lessonDurationMinutes: p.estimated_duration_minutes || undefined,
            analysisDate: p.created_at || undefined,
            bloomDistribution: bloom || undefined,
            profileData: pd || undefined,
          };
        }
      }
    }
  } catch (err) {
    // Non-critical — cards still render without profile data
    console.log("[knowledge-items] Profile summary fetch failed (non-critical):", err);
  }

  return NextResponse.json({ items, profileMap });
}

/**
 * POST /api/teacher/knowledge/items
 *
 * Create a new knowledge item. Generates RAG chunks in the background.
 */
export async function POST(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const body: CreateKnowledgeItemRequest = await request.json();

  if (!body.title || !body.item_type) {
    return NextResponse.json(
      { error: "title and item_type are required" },
      { status: 400 }
    );
  }

  const item = await createKnowledgeItem(body, teacherId);

  if (!item) {
    return NextResponse.json(
      { error: "Failed to create item" },
      { status: 500 }
    );
  }

  // Fire-and-forget: generate RAG chunks
  generateItemChunks(item).catch((err) => {
    console.error("[knowledge-items] Chunk generation failed:", err);
  });

  return NextResponse.json({ item }, { status: 201 });
}
