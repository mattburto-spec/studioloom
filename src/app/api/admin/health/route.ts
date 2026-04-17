import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getHealthSummary } from "@/lib/admin/health-checks";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const health = await getHealthSummary(supabase);
    return NextResponse.json(health);
  } catch (error) {
    console.error("[admin/health] Error:", error);
    return NextResponse.json({ error: "Failed to check health" }, { status: 500 });
  }
}
