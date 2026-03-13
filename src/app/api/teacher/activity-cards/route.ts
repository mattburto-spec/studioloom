import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  getActivityCards,
  searchActivityCards,
  recordActivityUsage,
} from "@/lib/activity-cards";
import type { ActivityCardFilters } from "@/types/activity-cards";

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

/**
 * GET /api/teacher/activity-cards
 *
 * Query params:
 *   search     — semantic + FTS search query (triggers hybrid search)
 *   category   — filter by category
 *   criterion  — filter by assessment criterion (e.g. A/B/C/D for MYP, AO1/AO2 for GCSE)
 *   thinkingType — creative/critical/analytical/metacognitive
 *   groupSize  — individual/pairs/small-group/whole-class/flexible
 *   maxDuration — max duration in minutes
 */
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const filters: ActivityCardFilters = {};
  const search = searchParams.get("search");
  const category = searchParams.get("category");
  const criterion = searchParams.get("criterion");
  const thinkingType = searchParams.get("thinkingType");
  const groupSize = searchParams.get("groupSize");
  const maxDuration = searchParams.get("maxDuration");
  const source = searchParams.get("source");

  if (category) filters.category = category as ActivityCardFilters["category"];
  if (criterion) filters.criterion = criterion;
  if (thinkingType) filters.thinkingType = thinkingType as ActivityCardFilters["thinkingType"];
  if (groupSize) filters.groupSize = groupSize as ActivityCardFilters["groupSize"];
  if (maxDuration) filters.maxDuration = parseInt(maxDuration, 10);
  if (source) filters.source = source as ActivityCardFilters["source"];

  // Semantic search if query provided, otherwise filtered list
  const cards = search
    ? await searchActivityCards(search, filters)
    : await getActivityCards(filters);

  return NextResponse.json({ cards });
}

/**
 * POST /api/teacher/activity-cards
 *
 * Record a usage event when a card is inserted into a unit.
 * Body: { cardId, unitId?, pageId?, criterion?, modifiersApplied?, customPrompt?, sectionsBefore?, sectionsAfter? }
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.cardId) {
    return NextResponse.json(
      { error: "cardId is required" },
      { status: 400 }
    );
  }

  await recordActivityUsage({
    cardId: body.cardId,
    teacherId: user.id,
    unitId: body.unitId,
    pageId: body.pageId,
    criterion: body.criterion,
    modifiersApplied: body.modifiersApplied,
    customPrompt: body.customPrompt,
    sectionsBefore: body.sectionsBefore,
    sectionsAfter: body.sectionsAfter,
  });

  return NextResponse.json({ ok: true });
}
