import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBlocksBySourceType,
  getCategoryDistribution,
  getStaleBlocks,
  getDuplicateSuspects,
  getLowEfficacyBlocks,
  getOrphanBlocks,
  getEmbeddingHealth,
  getCoverageHeatmap,
} from "@/lib/admin/library-health-queries";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const [
      sourceTypes,
      categories,
      staleBlocks,
      duplicates,
      lowEfficacy,
      orphans,
      embeddingHealth,
      coverage,
    ] = await Promise.all([
      getBlocksBySourceType(supabase),
      getCategoryDistribution(supabase),
      getStaleBlocks(supabase),
      getDuplicateSuspects(supabase),
      getLowEfficacyBlocks(supabase),
      getOrphanBlocks(supabase),
      getEmbeddingHealth(supabase),
      getCoverageHeatmap(supabase),
    ]);

    return NextResponse.json({
      sourceTypes,
      categories,
      staleBlocks,
      duplicates,
      lowEfficacy,
      orphans,
      embeddingHealth,
      coverage,
    });
  } catch (err) {
    console.error("[admin/library/health GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch health data" },
      { status: 500 }
    );
  }
}
