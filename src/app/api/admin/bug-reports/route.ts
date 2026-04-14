/**
 * GET /api/admin/bug-reports — list all bug reports with filters
 * PATCH /api/admin/bug-reports — update a bug report status/notes
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const status = request.nextUrl.searchParams.get("status");

  try {
    let query = supabase
      .from("bug_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ reports: data || [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load bug reports" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { id, status, admin_notes, response } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (admin_notes !== undefined) updates.admin_notes = admin_notes;
    if (response !== undefined) updates.response = response;

    const { data, error } = await supabase
      .from("bug_reports")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ report: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update bug report" },
      { status: 500 }
    );
  }
}
