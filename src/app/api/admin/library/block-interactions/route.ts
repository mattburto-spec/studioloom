/**
 * GET /api/admin/library/block-interactions?blockId=<uuid>
 *
 * Returns a block and its related blocks based on:
 * - prerequisite_tags ↔ tags overlap (prerequisite/dependent)
 * - Same phase
 * - Shared tags (tag-overlap)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface BlockRow {
  id: string;
  title: string;
  phase: string | null;
  bloom_level: string | null;
  tags: string[] | null;
  prerequisite_tags: string[] | null;
  activity_category: string | null;
  efficacy_score: number;
}

export async function GET(request: NextRequest) {
  const blockId = request.nextUrl.searchParams.get("blockId");
  if (!blockId) {
    return NextResponse.json({ error: "blockId required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    // Get the target block
    const { data: block, error: blockErr } = await supabase
      .from("activity_blocks")
      .select("id, title, phase, bloom_level, tags, prerequisite_tags, activity_category, efficacy_score")
      .eq("id", blockId)
      .single();

    if (blockErr || !block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    const b = block as BlockRow;
    const tags = b.tags || [];
    const prereqTags = b.prerequisite_tags || [];

    // Get candidate related blocks (same teacher or public, limit for performance)
    const { data: candidates } = await supabase
      .from("activity_blocks")
      .select("id, title, phase, bloom_level, tags, prerequisite_tags, activity_category, efficacy_score")
      .neq("id", blockId)
      .eq("is_archived", false)
      .limit(200);

    const related: Array<{
      id: string;
      title: string;
      phase: string | null;
      bloom_level: string | null;
      tags: string[];
      prerequisite_tags: string[];
      activity_category: string | null;
      efficacy_score: number;
      relation: string;
      sharedTags: string[];
    }> = [];

    const seen = new Set<string>();

    for (const c of (candidates || []) as BlockRow[]) {
      const cTags = c.tags || [];
      const cPrereqTags = c.prerequisite_tags || [];

      // Prerequisite: this block's prerequisite_tags overlap with candidate's tags
      if (prereqTags.length > 0) {
        const shared = prereqTags.filter((t) => cTags.includes(t));
        if (shared.length > 0 && !seen.has(c.id)) {
          seen.add(c.id);
          related.push({
            ...c,
            tags: cTags,
            prerequisite_tags: cPrereqTags,
            relation: "prerequisite",
            sharedTags: shared,
          });
          continue;
        }
      }

      // Dependent: candidate's prerequisite_tags overlap with this block's tags
      if (cPrereqTags.length > 0 && tags.length > 0) {
        const shared = cPrereqTags.filter((t) => tags.includes(t));
        if (shared.length > 0 && !seen.has(c.id)) {
          seen.add(c.id);
          related.push({
            ...c,
            tags: cTags,
            prerequisite_tags: cPrereqTags,
            relation: "dependent",
            sharedTags: shared,
          });
          continue;
        }
      }

      // Same phase
      if (b.phase && c.phase === b.phase && !seen.has(c.id)) {
        seen.add(c.id);
        related.push({
          ...c,
          tags: cTags,
          prerequisite_tags: cPrereqTags,
          relation: "same-phase",
          sharedTags: [],
        });
        continue;
      }

      // Tag overlap (at least 2 shared tags to be meaningful)
      if (tags.length > 0 && cTags.length > 0) {
        const shared = tags.filter((t) => cTags.includes(t));
        if (shared.length >= 2 && !seen.has(c.id)) {
          seen.add(c.id);
          related.push({
            ...c,
            tags: cTags,
            prerequisite_tags: cPrereqTags,
            relation: "tag-overlap",
            sharedTags: shared,
          });
        }
      }
    }

    return NextResponse.json({
      block: {
        ...b,
        tags,
        prerequisite_tags: prereqTags,
      },
      related,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load interactions" },
      { status: 500 }
    );
  }
}
