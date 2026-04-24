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
import { BLOCK_TYPES, SKILL_TIERS } from "@/types/skills";
import {
  validateQuizQuestions,
  validatePassThreshold,
  validateRetakeCooldown,
  validateQuestionCount,
} from "@/lib/skills/validate-quiz";
import type {
  Block,
  CardType,
  FrameworkAnchor,
  QuizQuestion,
  SkillCardHydrated,
  SkillCardRow,
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
      .select("id, slug, title, tier")
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
    if (payload.domain_id !== undefined) {
      const { data: dom } = await admin
        .from("skill_domains")
        .select("id")
        .eq("id", payload.domain_id)
        .maybeSingle();
      if (!dom) {
        return NextResponse.json(
          { error: `Unknown domain: ${payload.domain_id}` },
          { status: 400 }
        );
      }
      update.domain_id = payload.domain_id;
    }
    if (payload.tier !== undefined) {
      if (!SKILL_TIERS.includes(payload.tier)) {
        return NextResponse.json(
          { error: "tier must be bronze|silver|gold" },
          { status: 400 }
        );
      }
      update.tier = payload.tier;
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
    if (payload.age_min !== undefined) {
      if (
        payload.age_min !== null &&
        (!Number.isInteger(payload.age_min) ||
          payload.age_min < 5 ||
          payload.age_min > 25)
      ) {
        return NextResponse.json(
          { error: "age_min must be an integer between 5 and 25 (or null)" },
          { status: 400 }
        );
      }
      update.age_min = payload.age_min;
    }
    if (payload.age_max !== undefined) {
      if (
        payload.age_max !== null &&
        (!Number.isInteger(payload.age_max) ||
          payload.age_max < 5 ||
          payload.age_max > 25)
      ) {
        return NextResponse.json(
          { error: "age_max must be an integer between 5 and 25 (or null)" },
          { status: 400 }
        );
      }
      update.age_max = payload.age_max;
    }
    if (payload.framework_anchors !== undefined) {
      if (!validateFrameworkAnchors(payload.framework_anchors)) {
        return NextResponse.json(
          { error: "framework_anchors must be an array of {framework, label}" },
          { status: 400 }
        );
      }
      update.framework_anchors = payload.framework_anchors;
    }
    if (payload.demo_of_competency !== undefined) {
      update.demo_of_competency =
        payload.demo_of_competency?.toString().trim() || null;
    }
    if (payload.learning_outcomes !== undefined) {
      if (!validateStringArray(payload.learning_outcomes)) {
        return NextResponse.json(
          { error: "learning_outcomes must be an array of strings" },
          { status: 400 }
        );
      }
      update.learning_outcomes = payload.learning_outcomes.map((s) => s.trim()).filter(Boolean);
    }
    if (payload.applied_in !== undefined) {
      if (!validateStringArray(payload.applied_in)) {
        return NextResponse.json(
          { error: "applied_in must be an array of strings" },
          { status: 400 }
        );
      }
      update.applied_in = payload.applied_in.map((s) => s.trim()).filter(Boolean);
    }
    if (payload.card_type !== undefined) {
      if (!VALID_CARD_TYPES.includes(payload.card_type)) {
        return NextResponse.json(
          { error: "card_type must be lesson|routine" },
          { status: 400 }
        );
      }
      update.card_type = payload.card_type;
    }
    if (payload.author_name !== undefined) {
      update.author_name = payload.author_name?.toString().trim() || null;
    }

    // ---- Quiz fields (Phase A, migration 112) --------------------------------
    if (payload.quiz_questions !== undefined) {
      const err = validateQuizQuestions(payload.quiz_questions);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      update.quiz_questions = payload.quiz_questions as QuizQuestion[];
    }
    if (payload.pass_threshold !== undefined) {
      const err = validatePassThreshold(payload.pass_threshold);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      update.pass_threshold = payload.pass_threshold;
    }
    if (payload.retake_cooldown_minutes !== undefined) {
      const err = validateRetakeCooldown(payload.retake_cooldown_minutes);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      update.retake_cooldown_minutes = payload.retake_cooldown_minutes;
    }
    if (payload.question_count !== undefined) {
      const poolSize = Array.isArray(payload.quiz_questions)
        ? payload.quiz_questions.length
        : Infinity; // not patching pool simultaneously — can't cap-check
      const err = validateQuestionCount(payload.question_count, poolSize);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      update.question_count = payload.question_count;
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
