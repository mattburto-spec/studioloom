/**
 * GET /api/teacher/fabrication/classes
 *
 * Phase 8.1d-3 (PH8-FU-CLASS-LAB-ASSIGN). Lightweight list of the
 * teacher's classes for the lab-setup picker — id, name, code,
 * default_lab_id. Distinct from /api/teacher/integrations/classes
 * (Canvas/Google sync). Distinct from the per-class fabrication
 * history endpoints. Just the minimal class list the lab admin UI
 * needs to show "Used by class X" chips and route a class to a
 * different lab.
 *
 * Auth: teacher Supabase Auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { FAB_PRIVATE_CACHE_HEADERS } from "@/lib/fab/auth";

async function getTeacherUser(request: NextRequest) {
  const supabase = createServerClient(
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: FAB_PRIVATE_CACHE_HEADERS });
}

export async function GET(request: NextRequest) {
  const user = await getTeacherUser(request);
  if (!user) return privateJson({ error: "Unauthorized" }, 401);

  const admin = createAdminClient();
  const result = await admin
    .from("classes")
    .select("id, name, code, default_lab_id, is_archived")
    .eq("teacher_id", user.id)
    .eq("is_archived", false)
    .order("name", { ascending: true });

  if (result.error) {
    return privateJson(
      { error: `Class list failed: ${result.error.message}` },
      500
    );
  }

  return privateJson({ classes: result.data ?? [] });
}
