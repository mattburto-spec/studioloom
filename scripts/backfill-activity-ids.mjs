/**
 * Backfill activityId on all existing ActivitySection entries.
 *
 * Run via: node scripts/backfill-activity-ids.mjs
 *
 * This script:
 * 1. Reads all units.content_data
 * 2. For each page's sections, assigns random 8-char IDs where missing
 * 3. Also migrates response keys in student_progress.responses from section_N to activity_X
 * 4. Writes back to units.content_data
 * 5. Same for class_units.content_data (forks)
 *
 * Safe to run multiple times (idempotent — skips sections that already have activityId).
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
const envPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Remove quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error("Could not read .env.local — make sure you're in the project root");
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/** Generate a random 8-char alphanumeric ID (replaces nanoid) */
function makeId() {
  return randomBytes(6).toString("base64url").slice(0, 8);
}

function backfillContent(contentData) {
  let backfilledCount = 0;
  let sectionCount = 0;

  if (!contentData) return { updated: false, sectionCount: 0, backfilledCount: 0 };

  // v4 timeline
  if (contentData.version === 4 && Array.isArray(contentData.timeline)) {
    for (const activity of contentData.timeline) {
      sectionCount++;
      if (!activity.id) {
        activity.id = makeId();
        backfilledCount++;
      }
    }
    return { updated: backfilledCount > 0, sectionCount, backfilledCount };
  }

  // v2/v3 — pages array with content.sections
  if (Array.isArray(contentData.pages)) {
    for (const page of contentData.pages) {
      const sections = page.content?.sections;
      if (!Array.isArray(sections)) continue;
      for (const section of sections) {
        sectionCount++;
        if (!section.activityId) {
          section.activityId = makeId();
          backfilledCount++;
        }
      }
    }
    return { updated: backfilledCount > 0, sectionCount, backfilledCount };
  }

  // v1 — pages as object
  if (contentData.pages && typeof contentData.pages === "object" && !Array.isArray(contentData.pages)) {
    for (const pageKey of Object.keys(contentData.pages)) {
      const pageContent = contentData.pages[pageKey];
      if (!Array.isArray(pageContent?.sections)) continue;
      for (const section of pageContent.sections) {
        sectionCount++;
        if (!section.activityId) {
          section.activityId = makeId();
          backfilledCount++;
        }
      }
    }
    return { updated: backfilledCount > 0, sectionCount, backfilledCount };
  }

  return { updated: false, sectionCount, backfilledCount };
}

async function migrateResponseKeys(unitId, contentData) {
  if (!Array.isArray(contentData.pages)) return 0;

  let migratedCount = 0;

  for (const page of contentData.pages) {
    const pageId = page.id;
    const sections = page.content?.sections;
    if (!pageId || !Array.isArray(sections)) continue;

    const keyMap = {};
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].activityId) {
        keyMap[`section_${i}`] = `activity_${sections[i].activityId}`;
      }
    }

    if (Object.keys(keyMap).length === 0) continue;

    const { data: progressRows } = await supabase
      .from("student_progress")
      .select("id, responses")
      .eq("unit_id", unitId)
      .eq("page_id", pageId);

    if (!progressRows || progressRows.length === 0) continue;

    for (const row of progressRows) {
      if (!row.responses || typeof row.responses !== "object") continue;
      let changed = false;
      const newResponses = {};

      for (const [key, value] of Object.entries(row.responses)) {
        if (keyMap[key] && !row.responses[keyMap[key]]) {
          newResponses[keyMap[key]] = value;
          newResponses[key] = value; // keep old key as fallback
          changed = true;
        } else {
          newResponses[key] = value;
        }
      }

      if (changed) {
        await supabase
          .from("student_progress")
          .update({ responses: newResponses })
          .eq("id", row.id);
        migratedCount++;
      }
    }
  }

  return migratedCount;
}

async function main() {
  console.log("=== Backfill activityId on existing sections ===\n");

  const { data: units, error: unitsError } = await supabase
    .from("units")
    .select("id, title, content_data");

  if (unitsError) {
    console.error("Failed to fetch units:", unitsError);
    process.exit(1);
  }

  let totalUnits = 0;
  let updatedUnits = 0;
  let totalSections = 0;
  let totalBackfilled = 0;
  let totalResponsesMigrated = 0;

  for (const unit of units || []) {
    totalUnits++;
    if (!unit.content_data) continue;

    const content = structuredClone(unit.content_data);
    const { updated, sectionCount, backfilledCount } = backfillContent(content);
    totalSections += sectionCount;
    totalBackfilled += backfilledCount;

    if (updated) {
      const { error } = await supabase
        .from("units")
        .update({ content_data: content })
        .eq("id", unit.id);

      if (error) {
        console.error(`  ✗ Failed to update unit ${unit.id}:`, error);
      } else {
        updatedUnits++;
        console.log(`  ✓ Unit "${unit.title}" — ${backfilledCount} sections backfilled`);

        const migrated = await migrateResponseKeys(unit.id, content);
        totalResponsesMigrated += migrated;
        if (migrated > 0) {
          console.log(`    → ${migrated} student progress rows migrated`);
        }
      }
    }
  }

  console.log(`\nUnits: ${totalUnits} total, ${updatedUnits} updated`);
  console.log(`Sections: ${totalSections} total, ${totalBackfilled} backfilled`);
  console.log(`Response keys migrated: ${totalResponsesMigrated}`);

  // 2. Process class_units forks
  console.log("\n--- Processing class_units forks ---");

  const { data: classUnits, error: cuError } = await supabase
    .from("class_units")
    .select("unit_id, class_id, content_data")
    .not("content_data", "is", null);

  if (cuError) {
    console.error("Failed to fetch class_units:", cuError);
  } else {
    let forkCount = 0;
    let forksUpdated = 0;

    for (const cu of classUnits || []) {
      forkCount++;
      const content = structuredClone(cu.content_data);
      const { updated, backfilledCount } = backfillContent(content);

      if (updated) {
        const { error } = await supabase
          .from("class_units")
          .update({ content_data: content })
          .eq("unit_id", cu.unit_id)
          .eq("class_id", cu.class_id);

        if (error) {
          console.error(`  ✗ Failed to update class_unit ${cu.id}:`, error);
        } else {
          forksUpdated++;
          console.log(`  ✓ Fork (unit=${cu.unit_id}, class=${cu.class_id}) — ${backfilledCount} sections`);
        }
      }
    }

    console.log(`\nForks: ${forkCount} total, ${forksUpdated} updated`);
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
