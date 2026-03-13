import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

async function getStudentId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  return session?.student_id || null;
}

// GET: List portfolio entries
export async function GET(request: NextRequest) {
  const studentId = await getStudentId(request);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const unitId = request.nextUrl.searchParams.get("unitId");
  const limit = Number(request.nextUrl.searchParams.get("limit")) || 20;

  const supabase = createAdminClient();
  let query = supabase
    .from("portfolio_entries")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unitId) {
    query = query.eq("unit_id", unitId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data || [] });
}

// POST: Create a new portfolio entry
export async function POST(request: NextRequest) {
  const studentId = await getStudentId(request);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { unitId, type, content, mediaUrl, linkUrl, linkTitle, pageId, sectionIndex } = body;

  if (!unitId || !type) {
    return NextResponse.json(
      { error: "unitId and type required" },
      { status: 400 }
    );
  }

  if (!["entry", "photo", "link", "note", "mistake", "auto"].includes(type)) {
    return NextResponse.json(
      { error: "Invalid entry type" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Auto-captured entries: upsert by (student, unit, page, section) to prevent duplicates
  if (type === "auto" && pageId && sectionIndex !== undefined && sectionIndex !== null) {
    // Check for existing entry
    const { data: existing } = await supabase
      .from("portfolio_entries")
      .select("id")
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .eq("page_id", pageId)
      .eq("section_index", sectionIndex)
      .maybeSingle();

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from("portfolio_entries")
        .update({
          content: content || null,
          media_url: mediaUrl || null,
          link_url: linkUrl || null,
          link_title: linkTitle || null,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ entry: data });
    }

    // Create new auto entry
    const { data, error } = await supabase
      .from("portfolio_entries")
      .insert({
        student_id: studentId,
        unit_id: unitId,
        type: "auto",
        content: content || null,
        media_url: mediaUrl || null,
        link_url: linkUrl || null,
        link_title: linkTitle || null,
        page_id: pageId,
        section_index: sectionIndex,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ entry: data });
  }

  // Manual entries: standard insert
  const { data, error } = await supabase
    .from("portfolio_entries")
    .insert({
      student_id: studentId,
      unit_id: unitId,
      type,
      content: content || null,
      media_url: mediaUrl || null,
      link_url: linkUrl || null,
      link_title: linkTitle || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data });
}

// DELETE: Remove own entry
export async function DELETE(request: NextRequest) {
  const studentId = await getStudentId(request);
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("portfolio_entries")
    .delete()
    .eq("id", id)
    .eq("student_id", studentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
