import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";

// Mappings for pre-migration-011 fallback
const PAGE_ID_TO_NUMBER: Record<string, number> = {
  A1: 1, A2: 2, A3: 3, A4: 4,
  B1: 5, B2: 6, B3: 7, B4: 8,
  C1: 9, C2: 10, C3: 11, C4: 12,
  D1: 13, D2: 14, D3: 15, D4: 16,
};
const NUMBER_TO_PAGE_ID: Record<number, string> = {
  1: "A1", 2: "A2", 3: "A3", 4: "A4",
  5: "B1", 6: "B2", 7: "B3", 8: "B4",
  9: "C1", 10: "C2", 11: "C3", 12: "C4",
  13: "D1", 14: "D2", 15: "D3", 16: "D4",
};

// GET: Load progress for a specific unit
export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");

  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: progress } = await supabase
    .from("student_progress")
    .select("*")
    .eq("student_id", studentId)
    .eq("unit_id", unitId);

  // Normalize progress — ensure page_id exists on every record
  const normalized = (progress || []).map((p: Record<string, unknown>) => {
    if (!p.page_id && p.page_number) {
      return { ...p, page_id: NUMBER_TO_PAGE_ID[p.page_number as number] || `page_${p.page_number}` };
    }
    return p;
  });

  return NextResponse.json({ progress: normalized });
}

// POST: Save/update progress for a specific page
export async function POST(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  const { unitId, pageId, status, responses, timeSpent } =
    await request.json();

  if (!unitId || !pageId) {
    return NextResponse.json(
      { error: "unitId and pageId required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Try page_id-based upsert (post-migration 011)
  const { data, error } = await supabase
    .from("student_progress")
    .upsert(
      {
        student_id: studentId,
        unit_id: unitId,
        page_id: pageId,
        ...(status && { status }),
        ...(responses && { responses }),
        ...(timeSpent !== undefined && { time_spent: timeSpent }),
      },
      {
        onConflict: "student_id,unit_id,page_id",
      }
    )
    .select()
    .single();

  if (error && (error.message?.includes("does not exist") || error.message?.includes("Could not find"))) {
    // Fallback: migration 011 not yet applied, use page_number
    const pageNumber = PAGE_ID_TO_NUMBER[pageId];
    if (!pageNumber) {
      return NextResponse.json(
        { error: "Custom pages require database migration 011" },
        { status: 500 }
      );
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("student_progress")
      .upsert(
        {
          student_id: studentId,
          unit_id: unitId,
          page_number: pageNumber,
          ...(status && { status }),
          ...(responses && { responses }),
          ...(timeSpent !== undefined && { time_spent: timeSpent }),
        },
        {
          onConflict: "student_id,unit_id,page_number",
        }
      )
      .select()
      .single();

    if (fallbackError) {
      return NextResponse.json(
        { error: fallbackError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ progress: fallbackData });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ progress: data });
}
