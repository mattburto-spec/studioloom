import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";

/**
 * Student Safety Certifications API
 *
 * GET /api/student/safety-certs
 *   → Returns all workshop certifications for the authenticated student.
 *   Response: { certs: [{ cert_type, granted_at, expires_at, notes }] }
 */

export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;

  const db = createAdminClient();

  const { data: certs, error } = await db
    .from("safety_certifications")
    .select("cert_type, granted_at, expires_at, notes")
    .eq("student_id", auth.studentId)
    .order("granted_at", { ascending: true });

  if (error) {
    console.error("[safety-certs] Error fetching certs:", error);
    return NextResponse.json({ error: "Failed to load certifications" }, { status: 500 });
  }

  return NextResponse.json({ certs: certs || [] });
}
