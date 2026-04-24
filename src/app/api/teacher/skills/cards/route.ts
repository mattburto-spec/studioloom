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
 *
 * Migration 110 replaced `difficulty` with `tier` (bronze/silver/gold),
 * added `domain_id`, `age_min`, `age_max`, `framework_anchors`,
 * `demo_of_competency`, `learning_outcomes`, `applied_in`, `card_type`,
 * `author_name` — all surfaced here.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { BLOCK_TYPES, SKILL_TIERS } from "@/types/skills";
import type {
  Block,
  CardType,
  CreateSkillCardPayload,
  FrameworkAnchor,
  SkillCardRow,
  SkillTier,
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

const VALID_BLOCK_TYPES = new Set<string>(BLOCK_TYPES);
const VALID_CARD_TYPES: readonly CardType[] = ["lesson", "routine"];
const VALID_FRAMEWORKS = new Set<FrameworkAnchor["framework"]>([
  "ATL",
  "CASEL",
  "WEF",
  "StudioHabits",
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

function validateFrameworkAnchors(
  anchors: unknown
): anchors is FrameworkAnchor[] {
  if (!Array.isArray(anchors)) return false;
  return anchors.every(
    (a) =>
      a &&
      typeof a === "object" &&
      typeof (a as { framework: unknown }).framework === "string" &&
      VALID_FRAMEWORKS.has((a as { framework: FrameworkAnchor["framework"] }).framework) &&
      typeof (a as { label: unknown }).label === "string" &&
      (a as { label: string }).label.trim().length > 0
  );
}

function validateStringArray(a: unknown): a is string[] {
  return Array.isArray(a) && a.every((x) => typeof x === "string");
}

function slugIsValid(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 80;
}

// Shared select list — keep one copy so GET list + POST insert agree on field order.
const CARD_LIST_SELECT =
  "id, slug, title, summary, category_id, domain_id, tier, age_min, age_max, card_type, estimated_min, framework_anchors, is_built_in, is_published, created_by_teacher_id, forked_from, author_name, updated_at, created_at";

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
    const domain = url.searchParams.get("domain");
    const tier = url.searchParams.get("tier");
    const cardType = url.searchParams.get("card_type");
    const ownership = url.searchParams.get("ownership"); // 'mine' | 'built_in' | 'all' (default)
    // ageBand filter: 'primary' (8-11) | 'middle' (11-14) | 'senior' (14-18) | 'all' (default)
    // Filters cards whose age_min/age_max overlaps the requested band. Cards with
    // NULL age_min/age_max are treated as "any band" (always included) — they're
    // legacy rows or cards the author hasn't age-scoped yet.
    const ageBand = url.searchParams.get("age_band");

    const admin = createAdminClient();

    let query = admin.from("skill_cards").select(CARD_LIST_SELECT);

    // Visibility: RLS would scope this for the teacher's session, but we're
    // using admin — so reproduce the equivalent read rule in the query.
    //   - built-ins: always visible
    //   - published: always visible
    //   - drafts: only own
    query = query.or(
      `is_built_in.eq.true,is_published.eq.true,created_by_teacher_id.eq.${user.id}`
    );

    if (category) query = query.eq("category_id", category);
    if (domain) query = query.eq("domain_id", domain);
    if (tier && SKILL_TIERS.includes(tier as SkillTier)) {
      query = query.eq("tier", tier);
    }
    if (cardType && VALID_CARD_TYPES.includes(cardType as CardType)) {
      query = query.eq("card_type", cardType);
    }

    // Age-band overlap filter. A card is "in" a band if its age_min..age_max
    // range overlaps the band range, OR if its age_min/age_max are NULL
    // (unscoped). PostgREST can't express "null OR range-overlap" in one .or
    // clause cleanly, so we pick the simpler formulation: include cards whose
    // age_max >= band.min AND age_min <= band.max (classic overlap), treating
    // NULL as open-ended. We do that with .or() conditionals.
    if (ageBand && ageBand !== "all") {
      const bands: Record<string, { min: number; max: number }> = {
        primary: { min: 8, max: 11 },
        middle: { min: 11, max: 14 },
        senior: { min: 14, max: 18 },
      };
      const b = bands[ageBand];
      if (b) {
        // (age_max IS NULL OR age_max >= b.min) AND (age_min IS NULL OR age_min <= b.max)
        query = query
          .or(`age_max.is.null,age_max.gte.${b.min}`)
          .or(`age_min.is.null,age_min.lte.${b.max}`);
      }
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
      domain_id,
      tier,
      body,
      estimated_min,
      age_min,
      age_max,
      framework_anchors,
      demo_of_competency,
      learning_outcomes,
      applied_in,
      card_type,
      author_name,
      tags,
      external_links,
      prerequisite_ids,
    } = payload;

    // ---- Validation --------------------------------------------------------
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
    if (!domain_id) {
      return NextResponse.json({ error: "domain_id required" }, { status: 400 });
    }
    if (!tier || !SKILL_TIERS.includes(tier)) {
      return NextResponse.json(
        { error: "tier must be bronze|silver|gold" },
        { status: 400 }
      );
    }
    if (!validateBody(body)) {
      return NextResponse.json(
        { error: "body must be an array of valid blocks" },
        { status: 400 }
      );
    }
    if (age_min !== undefined && age_min !== null) {
      if (!Number.isInteger(age_min) || age_min < 5 || age_min > 25) {
        return NextResponse.json(
          { error: "age_min must be an integer between 5 and 25" },
          { status: 400 }
        );
      }
    }
    if (age_max !== undefined && age_max !== null) {
      if (!Number.isInteger(age_max) || age_max < 5 || age_max > 25) {
        return NextResponse.json(
          { error: "age_max must be an integer between 5 and 25" },
          { status: 400 }
        );
      }
    }
    if (
      typeof age_min === "number" &&
      typeof age_max === "number" &&
      age_min > age_max
    ) {
      return NextResponse.json(
        { error: "age_min must be <= age_max" },
        { status: 400 }
      );
    }
    if (framework_anchors !== undefined && !validateFrameworkAnchors(framework_anchors)) {
      return NextResponse.json(
        { error: "framework_anchors must be an array of {framework, label}" },
        { status: 400 }
      );
    }
    if (learning_outcomes !== undefined && !validateStringArray(learning_outcomes)) {
      return NextResponse.json(
        { error: "learning_outcomes must be an array of strings" },
        { status: 400 }
      );
    }
    if (applied_in !== undefined && !validateStringArray(applied_in)) {
      return NextResponse.json(
        { error: "applied_in must be an array of strings" },
        { status: 400 }
      );
    }
    if (card_type !== undefined && !VALID_CARD_TYPES.includes(card_type)) {
      return NextResponse.json(
        { error: "card_type must be lesson|routine" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Check slug uniqueness
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

    // Verify category + domain exist
    const [{ data: cat }, { data: dom }] = await Promise.all([
      admin.from("skill_categories").select("id").eq("id", category_id).maybeSingle(),
      admin.from("skill_domains").select("id").eq("id", domain_id).maybeSingle(),
    ]);
    if (!cat) {
      return NextResponse.json(
        { error: `Unknown category: ${category_id}` },
        { status: 400 }
      );
    }
    if (!dom) {
      return NextResponse.json(
        { error: `Unknown domain: ${domain_id}` },
        { status: 400 }
      );
    }

    // ---- Insert card -------------------------------------------------------
    const { data: card, error: insertError } = await admin
      .from("skill_cards")
      .insert({
        slug,
        title: title.trim(),
        summary: summary?.trim() || null,
        category_id,
        domain_id,
        tier,
        body,
        estimated_min: estimated_min ?? null,
        age_min: age_min ?? null,
        age_max: age_max ?? null,
        framework_anchors: framework_anchors ?? [],
        demo_of_competency: demo_of_competency?.toString().trim() || null,
        learning_outcomes: learning_outcomes ?? [],
        applied_in: applied_in ?? [],
        card_type: card_type ?? "lesson",
        author_name: author_name?.toString().trim() || null,
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

    // ---- Side inserts: tags, external links, prereqs ----------------------
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
