import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const search = req.nextUrl.searchParams.get("search") || "";
    const category = req.nextUrl.searchParams.get("category") || "";
    const phase = req.nextUrl.searchParams.get("phase") || "";
    const format = req.nextUrl.searchParams.get("format") || "";
    const sort = req.nextUrl.searchParams.get("sort") || "created_at";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");

    let query = supabase
      .from("activity_blocks")
      .select("*", { count: "exact" })
      .range(offset, offset + limit - 1);

    if (search) query = query.ilike("title", `%${search}%`);
    if (category) query = query.eq("activity_category", category);
    if (phase) query = query.eq("phase", phase);
    if (format) query = query.eq("source_format_hint", format);

    // Sort
    if (sort === "efficacy") {
      query = query.order("efficacy_score", { ascending: false, nullsFirst: false });
    } else if (sort === "usage") {
      query = query.order("times_used", { ascending: false, nullsFirst: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data: blocks, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ blocks: blocks || [], total: count || 0 });
  } catch (error) {
    console.error("[admin/library] Error:", error);
    return NextResponse.json({ blocks: [], total: 0 });
  }
}
