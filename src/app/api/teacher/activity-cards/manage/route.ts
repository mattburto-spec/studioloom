import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActivityCardCategory, ThinkingType, GroupSize } from "@/types/activity-cards";

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

/** Slugify a card name */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const VALID_CATEGORIES: ActivityCardCategory[] = [
  "design-thinking", "visible-thinking", "evaluation",
  "brainstorming", "analysis", "skills",
];

const VALID_THINKING_TYPES: ThinkingType[] = [
  "creative", "critical", "analytical", "metacognitive",
];

const VALID_GROUP_SIZES: GroupSize[] = [
  "individual", "pairs", "small-group", "whole-class", "flexible",
];

/**
 * POST /api/teacher/activity-cards/manage
 *
 * Create a new activity card.
 * Body: { name, description, category, criteria?, phases?, thinkingType?, durationMinutes?,
 *         groupSize?, materials?, tools?, resourcesNeeded?, teacherNotes?,
 *         template?, aiHints?, isPublic? }
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Validate required fields
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.description?.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  if (!body.category || !VALID_CATEGORIES.includes(body.category)) {
    return NextResponse.json(
      { error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate optional enums
  if (body.thinkingType && !VALID_THINKING_TYPES.includes(body.thinkingType)) {
    return NextResponse.json(
      { error: `thinkingType must be one of: ${VALID_THINKING_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (body.groupSize && !VALID_GROUP_SIZES.includes(body.groupSize)) {
    return NextResponse.json(
      { error: `groupSize must be one of: ${VALID_GROUP_SIZES.join(", ")}` },
      { status: 400 }
    );
  }

  const slug = body.slug?.trim() || slugify(body.name);

  const admin = createAdminClient();

  // Check slug uniqueness
  const { data: existing } = await admin
    .from("activity_cards")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `A card with slug "${slug}" already exists` },
      { status: 409 }
    );
  }

  const { data: card, error } = await admin
    .from("activity_cards")
    .insert({
      slug,
      name: body.name.trim(),
      description: body.description.trim(),
      category: body.category,
      criteria: body.criteria || [],
      phases: body.phases || [],
      thinking_type: body.thinkingType || null,
      duration_minutes: body.durationMinutes || null,
      group_size: body.groupSize || null,
      materials: body.materials || [],
      tools: body.tools || [],
      resources_needed: body.resourcesNeeded || null,
      teacher_notes: body.teacherNotes || null,
      template: body.template || { sections: [] },
      ai_hints: body.aiHints || { whenToUse: "", topicAdaptation: "", modifierAxes: [] },
      is_public: body.isPublic !== false,
      source: "teacher",
      created_by: user.id,
      curriculum_frameworks: body.curriculumFrameworks || [],
    })
    .select()
    .single();

  if (error) {
    console.error("[activity-cards/manage] Create error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Try to generate embedding (non-blocking)
  generateEmbedding(card.id, body.name, body.description).catch(() => {});

  return NextResponse.json({ card }, { status: 201 });
}

/**
 * PUT /api/teacher/activity-cards/manage
 *
 * Update an existing activity card.
 * Body: { id, ...fields to update }
 */
export async function PUT(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify ownership (teachers can only edit their own non-system cards)
  const { data: existing } = await admin
    .from("activity_cards")
    .select("id, created_by, source")
    .eq("id", body.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  if (existing.source === "system") {
    return NextResponse.json(
      { error: "System cards cannot be edited. Fork it instead." },
      { status: 403 }
    );
  }

  if (existing.created_by !== user.id) {
    return NextResponse.json(
      { error: "You can only edit cards you created" },
      { status: 403 }
    );
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description.trim();
  if (body.category !== undefined) {
    if (!VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    updates.category = body.category;
  }
  if (body.criteria !== undefined) updates.criteria = body.criteria;
  if (body.phases !== undefined) updates.phases = body.phases;
  if (body.thinkingType !== undefined) updates.thinking_type = body.thinkingType;
  if (body.durationMinutes !== undefined) updates.duration_minutes = body.durationMinutes;
  if (body.groupSize !== undefined) updates.group_size = body.groupSize;
  if (body.materials !== undefined) updates.materials = body.materials;
  if (body.tools !== undefined) updates.tools = body.tools;
  if (body.resourcesNeeded !== undefined) updates.resources_needed = body.resourcesNeeded;
  if (body.teacherNotes !== undefined) updates.teacher_notes = body.teacherNotes;
  if (body.template !== undefined) updates.template = body.template;
  if (body.aiHints !== undefined) updates.ai_hints = body.aiHints;
  if (body.isPublic !== undefined) updates.is_public = body.isPublic;

  const { data: card, error } = await admin
    .from("activity_cards")
    .update(updates)
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    console.error("[activity-cards/manage] Update error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Re-generate embedding if name or description changed
  if (body.name !== undefined || body.description !== undefined) {
    generateEmbedding(
      card.id,
      card.name,
      card.description
    ).catch(() => {});
  }

  return NextResponse.json({ card });
}

/**
 * DELETE /api/teacher/activity-cards/manage
 *
 * Delete a teacher-created card.
 * Body: { id }
 */
export async function DELETE(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify ownership
  const { data: existing } = await admin
    .from("activity_cards")
    .select("id, created_by, source")
    .eq("id", body.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  if (existing.source === "system") {
    return NextResponse.json(
      { error: "System cards cannot be deleted" },
      { status: 403 }
    );
  }

  if (existing.created_by !== user.id) {
    return NextResponse.json(
      { error: "You can only delete cards you created" },
      { status: 403 }
    );
  }

  const { error } = await admin
    .from("activity_cards")
    .delete()
    .eq("id", body.id);

  if (error) {
    console.error("[activity-cards/manage] Delete error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Helper: generate embedding for a card (fire-and-forget)
// ---------------------------------------------------------------------------

async function generateEmbedding(
  cardId: string,
  name: string,
  description: string
) {
  try {
    const { embedText } = await import("@/lib/ai/embeddings");
    const text = `${name}: ${description}`;
    const embedding = await embedText(text);

    const admin = createAdminClient();
    await admin
      .from("activity_cards")
      .update({ embedding: `[${embedding.join(",")}]` })
      .eq("id", cardId);
  } catch (err) {
    console.warn("[activity-cards/manage] Embedding generation failed:", err);
  }
}
