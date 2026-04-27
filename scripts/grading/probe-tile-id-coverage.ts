// Probe: count legacy lesson tiles in production that lack activityId.
//
// Output: total tiles + legacy count + percentage. Read-only — no writes.
// Used as the final pre-flight verification gate for G1's
// student_tile_grades migration. Threshold: legacy < 5% means accept
// positional fallback in tile_id; legacy >= 5% means migration includes
// a backfill step that mints nanoid(8) for each legacy section.
//
// Run: npx tsx -r dotenv/config scripts/grading/probe-tile-id-coverage.ts

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

interface TileShapeStats {
  totalTiles: number;
  withActivityId: number;
  withoutActivityId: number;
  withCriterionTags: number;
  byVersion: Record<string, number>;
  pageShape: Record<string, number>;
}

async function main() {
  console.log("Probing units.content_data for tile-ID coverage...\n");

  const { data: units, error } = await supabase
    .from("units")
    .select("id, title, content_data");

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  if (!units || units.length === 0) {
    console.log("No units found.");
    return;
  }

  console.log(`Found ${units.length} units in prod.\n`);

  const stats: TileShapeStats = {
    totalTiles: 0,
    withActivityId: 0,
    withoutActivityId: 0,
    withCriterionTags: 0,
    byVersion: {},
    pageShape: {},
  };

  type SectionLike = {
    activityId?: string;
    id?: string; // V4 TimelineActivity uses `id` instead of `activityId` — equivalent nanoid(8)
    criterionTags?: string[];
    [k: string]: unknown;
  };
  type PageLike = { id?: string; content?: { sections?: SectionLike[] } };
  type ContentLike = {
    version?: number | string;
    pages?: PageLike[];
    timeline?: SectionLike[];
  };

  for (const u of units as Array<{
    id: string;
    title: string;
    content_data: unknown;
  }>) {
    const cd = (u.content_data ?? {}) as ContentLike;
    const ver = String(cd.version ?? "unknown");
    stats.byVersion[ver] = (stats.byVersion[ver] ?? 0) + 1;

    let tiles: SectionLike[] = [];
    let isV4 = false;

    if (Array.isArray(cd.pages)) {
      // V2/V3: pages → content.sections[]. Stable key: ActivitySection.activityId.
      stats.pageShape["pages-with-content-sections"] =
        (stats.pageShape["pages-with-content-sections"] ?? 0) + 1;
      for (const p of cd.pages) {
        const secs = p?.content?.sections ?? [];
        tiles = tiles.concat(secs);
      }
    } else if (Array.isArray(cd.timeline)) {
      // V4: flat timeline of TimelineActivity[]. Stable key: TimelineActivity.id (becomes
      // ActivitySection.activityId at render time via src/lib/timeline.ts:142).
      stats.pageShape["timeline-flat"] =
        (stats.pageShape["timeline-flat"] ?? 0) + 1;
      tiles = cd.timeline;
      isV4 = true;
    } else {
      stats.pageShape["other"] =
        (stats.pageShape["other"] ?? 0) + 1;
    }

    for (const t of tiles) {
      stats.totalTiles += 1;
      // V4 tiles use `id`; V2/V3 tiles use `activityId`. Both are nanoid(8).
      const stableId = isV4 ? t.id : t.activityId;
      if (typeof stableId === "string" && stableId.length > 0) {
        stats.withActivityId += 1;
      } else {
        stats.withoutActivityId += 1;
      }
      if (Array.isArray(t.criterionTags) && t.criterionTags.length > 0) {
        stats.withCriterionTags += 1;
      }
    }
  }

  const legacyPct =
    stats.totalTiles === 0
      ? 0
      : (100 * stats.withoutActivityId) / stats.totalTiles;
  const critTagPct =
    stats.totalTiles === 0
      ? 0
      : (100 * stats.withCriterionTags) / stats.totalTiles;

  console.log("=== TILE-ID COVERAGE ===");
  console.log(`Total tiles:              ${stats.totalTiles}`);
  console.log(`With activityId:          ${stats.withActivityId}`);
  console.log(
    `Legacy (no activityId):   ${stats.withoutActivityId} (${legacyPct.toFixed(1)}%)`,
  );
  console.log("");
  console.log("=== CRITERION-TAG COVERAGE (informational) ===");
  console.log(
    `Tiles with criterionTags: ${stats.withCriterionTags} (${critTagPct.toFixed(1)}%)`,
  );
  console.log("");
  console.log("=== BY UNIT CONTENT VERSION ===");
  for (const [v, n] of Object.entries(stats.byVersion)) {
    console.log(`  v${v}: ${n} units`);
  }
  console.log("");
  console.log("=== BY PAGE SHAPE ===");
  for (const [s, n] of Object.entries(stats.pageShape)) {
    console.log(`  ${s}: ${n} units`);
  }
  console.log("");

  // Decision
  if (stats.totalTiles === 0) {
    console.log(
      "DECISION: No tiles found at all. Migration body should ship without backfill.",
    );
  } else if (legacyPct < 5) {
    console.log(
      `DECISION: Legacy is ${legacyPct.toFixed(1)}% (< 5% threshold). ` +
        "Migration body ships without backfill — accept positional fallback in tile_id (`section_${idx}`).",
    );
  } else if (legacyPct < 50) {
    console.log(
      `DECISION: Legacy is ${legacyPct.toFixed(1)}% (between 5% and 50%). ` +
        "Migration body INCLUDES a backfill step that mints nanoid(8) for each legacy section, " +
        "then re-saves units.content_data.",
    );
  } else {
    console.log(
      `DECISION: Legacy is ${legacyPct.toFixed(1)}% (≥ 50%). ` +
        "Backfill is mandatory — most prod tiles lack stable IDs. " +
        "Migration must include nanoid(8) backfill before code-write.",
    );
  }
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
