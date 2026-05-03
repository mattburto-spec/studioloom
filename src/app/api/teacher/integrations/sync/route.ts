// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";
import { createLMSProvider } from "@/lib/lms";
import { provisionStudentAuthUser } from "@/lib/access-v2/provision-student-auth-user";

function createSupabaseServer(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
}

/**
 * POST /api/teacher/integrations/sync
 * Sync students from the LMS into a Questerra class.
 * Uses the provider factory — works with any LMS.
 *
 * Body: { classId: string, externalClassId: string }
 */
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServer(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { classId, externalClassId } = await request.json();

  if (!classId || !externalClassId) {
    return NextResponse.json(
      { error: "classId and externalClassId are required" },
      { status: 400 }
    );
  }

  // Verify the teacher owns this class.
  // Also load school_id so newly-synced students can be provisioned with
  // their auth.users metadata pointing at the right school (Phase 1.1d).
  const { data: classData } = await supabase
    .from("classes")
    .select("id, teacher_id, school_id")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .single();

  if (!classData) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  // Get teacher's integration config
  const { data: integration } = await supabase
    .from("teacher_integrations")
    .select("provider, subdomain, encrypted_api_token")
    .eq("teacher_id", user.id)
    .single();

  if (!integration?.encrypted_api_token || !integration.subdomain) {
    return NextResponse.json(
      { error: "LMS integration not configured" },
      { status: 400 }
    );
  }

  try {
    // Create provider and fetch students
    const apiToken = decrypt(integration.encrypted_api_token);
    const provider = createLMSProvider(integration.provider, {
      subdomain: integration.subdomain,
      apiToken,
    });

    const lmsStudents = await provider.getClassStudents(externalClassId);

    // Use admin client for writes (students don't have auth.users entries)
    const admin = createAdminClient();

    // Get existing students in this class
    const { data: existingStudents } = await admin
      .from("students")
      .select("id, username, display_name, external_id, external_provider")
      .eq("class_id", classId);

    const existingByExternalId = new Map<string, { id: string; display_name: string | null; username: string }>();
    const existingUsernames = new Set<string>();

    for (const s of existingStudents || []) {
      if (s.external_id && s.external_provider === integration.provider) {
        existingByExternalId.set(s.external_id, {
          id: s.id,
          display_name: s.display_name,
          username: s.username,
        });
      }
      existingUsernames.add(s.username);
    }

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const lmsStudent of lmsStudents) {
      const existing = existingByExternalId.get(lmsStudent.id);

      if (existing) {
        // Student already exists — update display name if changed
        if (existing.display_name !== lmsStudent.name) {
          await admin
            .from("students")
            .update({ display_name: lmsStudent.name })
            .eq("id", existing.id);
          updated++;
        } else {
          unchanged++;
        }
      } else {
        // New student — generate a unique username
        let username = generateUsername(lmsStudent);

        // Ensure uniqueness within the class
        let suffix = 0;
        let candidate = username;
        while (existingUsernames.has(candidate)) {
          suffix++;
          candidate = `${username}${suffix}`;
        }
        username = candidate;
        existingUsernames.add(username);

        // Insert + return id so we can provision the matching auth.users row.
        // Phase 1.1d: server-side INSERT sites must auto-provision so students
        // can log in via the new flow without lazy-provision fallback.
        const { data: insertedRow, error: insertError } = await admin
          .from("students")
          .insert({
            username,
            display_name: lmsStudent.name,
            class_id: classId,
            external_id: lmsStudent.id,
            external_provider: integration.provider,
            school_id: classData.school_id ?? null,
          })
          .select("id")
          .single();

        if (insertError || !insertedRow) {
          console.error(`Failed to create student ${lmsStudent.name}:`, insertError?.message);
        } else {
          created++;
          // Provision auth.users immediately. Per-student failures are logged
          // but don't fail the sync — lazy provision on first login is the
          // safety net.
          const provisionResult = await provisionStudentAuthUser(admin, {
            id: insertedRow.id,
            user_id: null,
            school_id: classData.school_id ?? null,
          });
          if (!provisionResult.ok) {
            console.error(
              `[integrations/sync] provisionStudentAuthUser failed for student=${insertedRow.id}: ${provisionResult.error}`
            );
          }
        }
      }
    }

    // Update the class with external class link and sync timestamp
    await admin
      .from("classes")
      .update({
        external_class_id: externalClassId,
        external_provider: integration.provider,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", classId);

    return NextResponse.json({
      success: true,
      summary: { created, updated, unchanged, total: lmsStudents.length },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Generate a username from LMS student data.
 * Prefers email prefix, falls back to first name, then external ID.
 */
function generateUsername(student: { name: string; email?: string; id: string }): string {
  if (student.email) {
    return student.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
  }

  // Use first name from display name
  const firstName = student.name.split(" ")[0];
  if (firstName) {
    return firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  return `student_${student.id}`;
}
