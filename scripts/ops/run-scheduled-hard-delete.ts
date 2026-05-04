/**
 * SCAFFOLD — Phase 5.5 (Q5 resolution)
 *
 * Entry point for the scheduled-deletions hard-delete cron.
 * Single cron, two consumers (student-delete endpoint + retention cron).
 * Mirrors scripts/ops/run-cost-alert.ts pattern.
 *
 * Wired into nightly.yml in Phase 5.5.
 */

import { createClient } from "@supabase/supabase-js";
import { run } from "../../src/lib/jobs/scheduled-hard-delete-cron";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  console.log("Running scheduled hard-delete cron...");
  const result = await run(supabase);
  console.log("Run ID:", result.runId);
  console.log("Summary:", JSON.stringify(result.summary, null, 2));
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
