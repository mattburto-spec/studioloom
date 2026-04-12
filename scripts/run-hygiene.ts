import { createClient } from "@supabase/supabase-js";
import { runWeeklyHygiene } from "../src/lib/jobs/library-hygiene-weekly";
import { runMonthlyHygiene } from "../src/lib/jobs/library-hygiene-monthly";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const mode = process.argv[2];

if (mode !== "weekly" && mode !== "monthly") {
  console.error("Usage: npx tsx scripts/run-hygiene.ts <weekly|monthly>");
  process.exit(1);
}

async function main() {
  console.log(`Running ${mode} hygiene...`);

  try {
    const result =
      mode === "weekly"
        ? await runWeeklyHygiene(supabase)
        : await runMonthlyHygiene(supabase);

    console.log("Alert ID:", result.alertId);
    console.log("Summary:", JSON.stringify(result.summary, null, 2));
  } catch (err) {
    console.error("Failed:", err);
    process.exit(1);
  }
}

main();
