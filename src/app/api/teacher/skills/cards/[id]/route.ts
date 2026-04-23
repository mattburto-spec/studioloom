/**
 * Teacher Skills Library — single card load + update.
 *
 *   GET   /api/teacher/skills/cards/[id]    → hydrated card (own or built-in read-only)
 *   PATCH /api/teacher/skills/cards/[id]    → update own card (tags/links/prereqs replaced wholesale)
 *
 * Built-in cards return read-only for GET and 403 for PATCH. S2B introduces
 * the Fork action to turn a built-in into an editable copy owned by the
 * teacher.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { BLOCK_TYPES } from "@/types/skills";
import type {
  Block,
  SkillCardHydrated,
  SkillCardRow,
  SkillDifficulty,
  UpdateSkillCardPayload,
} from "@/types/skills";

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

const DIFFICULTIES: SkillDifficulty[] = ["foundational", "intermediate", "advanced"];
const VALID_BLOCK_TYPES = new Set<string>(BLOCK_TYPES);

function validateBody(body: unknown): body is Block[] {
  if (!Array.isArray(body)) return false;
  return body.every(
    (b) =>
      b &&
      typeof b === "object" &&
      "type" in b &&
      typeof (b as { type: unknown }).type === "string" &&
      VALID_BLOCK_TYPES.has((b as { type: string }).type)
  );
}

async function loadHydrated(
  admin: ReturnType<typeof createAdminClient>,
  cardId: string
): Promise<SkillCardHydrated | null> {
  const { data: card } = await admin
    .from("skill_cards")
    .select("*")
    .eq("id", cardId)
    .maybeSingle();
  if (!card) return null;
  const row = card as SkillCardRow;

  const [{ data: tagRows }, { data: linkRows }, { data: prereqRows }] =
    await Promise.all([
      admin.from("skill_card_tags").select("tag").eq("skill_id", cardId),
      admin
        .from("skill_external_links")
        .select("*")
        .eq("skill_id", cardId)
        .order("display_order", { ascending: true }),
      admin
        .from("skill_prerequisites")
        .select("prerequisite_id")
        .eq("skill_id", cardId),
    ]);

  // Second query to resolve prereq titles/slugs — small list so denormalise.
  const prereqIds = (prereqRows ?? []).map(
    (r: { prerequisite_id: string }) => r.prerequisite_id
  );
  let prereqs: SkillCardHydrated["prerequisites"] = [];
  if (prereqIds.length > 0) {
    const { data: prereqCards } = await admin
      .from("skill_cards")
      .select("id, slug, title, difficulty")
      .in("id", prereqIds);
    prereqs = (prereqCards ?? []) as SkillCardHydrated["prerequisites"];
  }

  return {
    ...row,
    tags: (tagRows ?? []).map((r: { tag: string }) => r.tag),
    external_links: (linkRows ?? []) as SkillCardHydrated["external_links"],
    prerequisites: prereqs,
  };
}

// ============================================================================
// GET
// ============================================================================
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServer(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const card = await loadHydrated(admin, id);
    if (!card) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Visibility: own drafts, published, or built-ins
    const visible =
      card.is_published ||
      card.is_built_in ||
      card.created_by_teacher_id === user.id;
    if (!visible) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const editable = !card.is_built_in && card.created_by_teacher_id === user.id;

    return NextResponse.json({ card, editable });
  } catch (error) {
    console.error("[teacher/skills/cards/[id]:GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH
// ============================================================================
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServer(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: card } = await admin
      .from("skill_cards")
      .select("id, is_built_in, created_by_teacher_id")
      .eq("id", id)
      .maybeSingle();
    if (!card) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (card.is_built_in) {
      return NextResponse.json(
        { error: "Built-in cards cannot be edited. Fork a copy first." },
        { status: 403 }
      );
    }
    if (card.created_by_teacher_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = (await request.json()) as UpdateSkillCardPayload;

    const update: Record<string, unknown> = {};
    if (payload.title !== undefined) {
      const t = payload.title.trim();
      if (t.length < 3 || t.length > 200) {
        return NextResponse.json(
          { error: "title must be 3–200 chars" },
          { status: 400 }
        );
      }
      update.title = t;
    }
    if (payload.summary !== undefined) {
      update.summary = payload.summary?.toString().trim() || null;
    }
    if (payload.category_id !== undefined) {
      const { data: cat } = await admin
        .from("skill_categories")
        .select("id")
        .eq("id", payload.category_id)
        .maybeSingle();
      if (!cat) {
        return NextResponse.json(
          { error: `Unknown category: ${payload.category_id}` },
          { status: 400 }
        );
      }
      update.category_id = payload.category_id;
    }
    if (payload.difficulty !== undefined) {
      if (!DIFFICULTIES.includes(payload.difficulty)) {
        return NextResponse.json(
          { error: "difficulty must be foundational|intermediate|advanced" },
          { status: 400 }
        );
      }
      update.difficulty = payload.difficulty;
    }
    if (payload.body !== undefined) {
      if (!validateBody(payload.body)) {
        return NextResponse.json(
          { error: "body must be an array of valid blocks" },
          { status: 400 }
        );
      }
      update.body = payload.body;
    }
    if (payload.estimated_min !== undefined) {
      update.estimated_min = payload.estimated_min;
    }

    if (Object.keys(update).length > 0) {
      const { error: updateError } = await admin
        .from("skill_cards")
        .update(update)
        .eq("id", id);
      if (updateError) {
        console.error("[teacher/skills/cards/[id]:PATCH] Update error:", updateError);
        return NextResponse.json(
          { error: "Failed to update card" },
          { status: 500 }
        );
      }
    }

    // ---- Replace tags (wholesale if provided) ------------------------------
    if (payload.tags !== undefined) {
      await admin.from("skill_card_tags").delete().eq("skill_id", id);
      const cleanTags = payload.tags
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 40);
      if (cleanTags.length) {
        await admin
          .from("skill_card_tags")
          .insert(cleanTags.map((tag) => ({ skill_id: id, tag })));
      }
    }

    // ---- Replace external links (wholesale) --------------------------------
    if (payload.external_links !== undefined) {
      await admin.from("skill_external_links").delete().eq("skill_id", id);
      const cleanLinks = payload.external_links
        .filter((l) => l && typeof l.url === "string" && l.url.trim().length > 0)
        .map((l, i) => ({
          skill_id: id,
          url: l.url.trim(),
          title: l.title?.trim() || null,
          kind: l.kind ?? null,
          display_order: i,
          status: "unchecked" as const,
        }));
      if (cleanLinks.length) {
        await admin.from("skill_external_links").insert(cleanLinks);
      }
    }

    // ---- Replace prereqs (wholesale) ---------------------------------------
    if (payload.prerequisite_ids !== undefined) {
      await admin.from("skill_prerequisites").delete().eq("skill_id", id);
      const cleanPrereqs = payload.prerequisite_ids.filter(
        (pid) => typeof pid === "string" && pid !== id
      );
      if (cleanPrereqs.length) {
        await admin.from("skill_prerequisites").insert(
          cleanPrereqs.map((pid) => ({
            skill_id: id,
            prerequisite_id: pid,
          }))
        );
      }
    }

    const hydrated = await loadHydrated(admin, id);
    return NextResponse.json({ card: hydrated });
  } catch (error) {
    console.error("[teacher/skills/cards/[id]:PATCH] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE — hard-delete a teacher's own card (built-ins forbidden)
// ============================================================================
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServer(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: card } = await admin
      .from("skill_cards")
      .select("id, is_built_in, created_by_teacher_id")
      .eq("id", id)
      .maybeSingle();
    if (!card) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (card.is_built_in) {
      return NextResponse.json(
        { error: "Built-in cards cannot be deleted." },
        { status: 403 }
      );
    }
    if (card.created_by_teacher_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // skill_card_tags / skill_prerequisites / skill_external_links all cascade
    // via ON DELETE CASCADE — no manual cleanup needed.
    const { error: delError } = await admin
      .from("skill_cards")
      .delete()
      .eq("id", id);
    if (delError) {
      console.error("[teacher/skills/cards/[id]:DELETE] Error:", delError);
      return NextResponse.json(
        { error: "Failed to delete card" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[teacher/skills/cards/[id]:DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
