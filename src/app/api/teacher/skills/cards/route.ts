/**
 * Teacher Skills Library — list + create.
 *
 *   GET  /api/teacher/skills/cards               → list (built-ins + own)
 *   POST /api/teacher/skills/cards               → create draft
 *
 * Auth: Supabase teacher session (createServerClient cookies).
 * Writes: use admin client; the teacher-write RLS policies in migration
 *   109 enforce ownership regardless, but admin bypass keeps error surfaces
 *   symmetric with the rest of /api/teacher/*.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Block,
  CreateSkillCardPayload,
  SkillCardRow,
  SkillDifficulty,
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
const VALID_BLOCK_TYPES = new Set([
  "prose",
  "callout",
  "checklist",
  "image",
  "video",
  "worked_example",
]);

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

function slugIsValid(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 80;
}

// ============================================================================
// GET — list cards (built-ins + teacher's own drafts/published)
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServer(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const difficulty = url.searchParams.get("difficulty");
    const ownership = url.searchParams.get("ownership"); // 'mine' | 'built_in' | 'all' (default)

    const admin = createAdminClient();

    let query = admin
      .from("skill_cards")
      .select(
        "id, slug, title, summary, category_id, difficulty, estimated_min, is_built_in, is_published, created_by_teacher_id, forked_from, updated_at, created_at"
      );

    // Visibility: RLS would scope this for the teacher's session, but we're
    // using admin — so reproduce the equivalent read rule in the query.
    //   - built-ins: always visible
    //   - published: always visible
    //   - drafts: only own
    query = query.or(
      `is_built_in.eq.true,is_published.eq.true,created_by_teacher_id.eq.${user.id}`
    );

    if (category) query = query.eq("category_id", category);
    if (difficulty && DIFFICULTIES.includes(difficulty as SkillDifficulty)) {
      query = query.eq("difficulty", difficulty);
    }

    if (ownership === "mine") {
      query = query.eq("created_by_teacher_id", user.id);
    } else if (ownership === "built_in") {
      query = query.eq("is_built_in", true);
    }

    query = query.order("updated_at", { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error("[teacher/skills/cards:GET] Query error:", error);
      return NextResponse.json(
        { error: "Failed to list skill cards" },
        { status: 500 }
      );
    }

    return NextResponse.json({ cards: data ?? [] });
  } catch (error) {
    console.error("[teacher/skills/cards:GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST — create draft card
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as CreateSkillCardPayload;
    const {
      slug,
      title,
      summary,
      category_id,
      difficulty,
      body,
      estimated_min,
      tags,
      external_links,
      prerequisite_ids,
    } = payload;

    // ---- Validation ---------------------------------------------------------
    if (!slug || !slugIsValid(slug)) {
      return NextResponse.json(
        { error: "slug must be lowercase-kebab, 3–80 chars" },
        { status: 400 }
      );
    }
    if (!title || title.trim().length < 3 || title.length > 200) {
      return NextResponse.json(
        { error: "title must be 3–200 chars" },
        { status: 400 }
      );
    }
    if (!category_id) {
      return NextResponse.json({ error: "category_id required" }, { status: 400 });
    }
    if (!difficulty || !DIFFICULTIES.includes(difficulty)) {
      return NextResponse.json(
        { error: "difficulty must be foundational|intermediate|advanced" },
        { status: 400 }
      );
    }
    if (!validateBody(body)) {
      return NextResponse.json(
        { error: "body must be an array of valid blocks" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Check slug uniqueness (skill_cards.slug is UNIQUE; PG would 23505, but
    // we pre-check for a nicer error).
    const { data: existing } = await admin
      .from("skill_cards")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "A card with that slug already exists" },
        { status: 409 }
      );
    }

    // Verify category exists
    const { data: cat } = await admin
      .from("skill_categories")
      .select("id")
      .eq("id", category_id)
      .maybeSingle();
    if (!cat) {
      return NextResponse.json(
        { error: `Unknown category: ${category_id}` },
        { status: 400 }
      );
    }

    // ---- Insert card --------------------------------------------------------
    const { data: card, error: insertError } = await admin
      .from("skill_cards")
      .insert({
        slug,
        title: title.trim(),
        summary: summary?.trim() || null,
        category_id,
        difficulty,
        body,
        estimated_min: estimated_min ?? null,
        is_built_in: false,
        created_by_teacher_id: user.id,
        is_published: false,
      })
      .select()
      .single();

    if (insertError || !card) {
      console.error("[teacher/skills/cards:POST] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create card" },
        { status: 500 }
      );
    }
    const cardRow = card as SkillCardRow;

    // ---- Side inserts: tags, external links, prereqs -----------------------
    const cleanTags = (tags ?? [])
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 40);
    if (cleanTags.length) {
      await admin
        .from("skill_card_tags")
        .insert(cleanTags.map((tag) => ({ skill_id: cardRow.id, tag })));
    }

    const cleanLinks = (external_links ?? [])
      .filter((l) => l && typeof l.url === "string" && l.url.trim().length > 0)
      .map((l, i) => ({
        skill_id: cardRow.id,
        url: l.url.trim(),
        title: l.title?.trim() || null,
        kind: l.kind ?? null,
        display_order: i,
        status: "unchecked" as const,
      }));
    if (cleanLinks.length) {
      await admin.from("skill_external_links").insert(cleanLinks);
    }

    const cleanPrereqs = (prerequisite_ids ?? []).filter(
      (id) => typeof id === "string" && id !== cardRow.id
    );
    if (cleanPrereqs.length) {
      await admin
        .from("skill_prerequisites")
        .insert(
          cleanPrereqs.map((pid) => ({
            skill_id: cardRow.id,
            prerequisite_id: pid,
          }))
        );
    }

    return NextResponse.json({ card: cardRow }, { status: 201 });
  } catch (error) {
    console.error("[teacher/skills/cards:POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
