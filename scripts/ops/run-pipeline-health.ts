import { createClient } from "@supabase/supabase-js";
import { run } from "../../src/lib/jobs/pipeline-health-monitor";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Running pipeline health monitor...");
  const result = await run(supabase);
  console.log("Alert ID:", result.alertId);
  console.log("Summary:", JSON.stringify(result.summary, null, 2));
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
