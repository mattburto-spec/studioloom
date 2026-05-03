// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/teacher/request-access
 * Public endpoint — anyone can submit a request. No auth required.
 * Upserts by email so repeated submissions update the same row instead
 * of spamming the admin queue.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, school, role, message } = body as {
      email?: string;
      name?: string;
      school?: string;
      role?: string;
      message?: string;
    };

    // Basic email validation
    const emailNormalized = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!emailNormalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Check if this email already belongs to an existing teacher
    const { data: existingTeacher } = await adminClient
      .from("teachers")
      .select("id")
      .eq("email", emailNormalized)
      .maybeSingle();

    if (existingTeacher) {
      return NextResponse.json(
        { error: "This email already has an account. Try logging in instead." },
        { status: 400 }
      );
    }

    // Check for existing pending request
    const { data: existing } = await adminClient
      .from("teacher_access_requests")
      .select("id, status")
      .eq("email", emailNormalized)
      .maybeSingle();

    if (existing) {
      if (existing.status === "invited") {
        return NextResponse.json(
          { error: "An invite has already been sent to this email. Check your inbox." },
          { status: 400 }
        );
      }
      // Update existing pending/rejected request with new info, reset to pending
      const { error: updateError } = await adminClient
        .from("teacher_access_requests")
        .update({
          name: name?.trim() || null,
          school: school?.trim() || null,
          role: role?.trim() || null,
          message: message?.trim() || null,
          status: "pending",
          reviewed_at: null,
          reviewed_by: null,
          rejection_reason: null,
          created_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, updated: true });
    }

    // Insert new request
    const { error: insertError } = await adminClient
      .from("teacher_access_requests")
      .insert({
        email: emailNormalized,
        name: name?.trim() || null,
        school: school?.trim() || null,
        role: role?.trim() || null,
        message: message?.trim() || null,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[request-access] error:", err);
    return NextResponse.json(
      { error: "Failed to submit request" },
      { status: 500 }
    );
  }
}
