import { createClient } from "@supabase/supabase-js";
import { sendCostAlert } from "../../src/lib/monitoring/cost-alert-delivery";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const result = await sendCostAlert(supabase, {
    period: "daily",
    currentCost: 1.0,
    threshold: 0.01,
    thresholdName: "A6 fire drill",
  });
  console.log("Result:", result);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
