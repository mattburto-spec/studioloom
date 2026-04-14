/**
 * GET /api/admin/generation-sandbox/[runId]
 *
 * Fetches a specific generation run with all stage results.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from("generation_runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json({ run: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load run" },
      { status: 500 }
    );
  }
}
