/**
 * POST /api/schools
 *
 * Authenticated: a teacher adds a school that's not in the seeded list.
 * Forced to source='user_submitted' + verified=false — admin can promote
 * to verified later via service_role. The RLS policy on schools also
 * enforces this, but we set it explicitly here so the admin client
 * (which bypasses RLS) still produces the right row.
 *
 * Handles the unique (normalized_name, country) violation by returning
 * the existing row with { duplicate: true } — the picker can then select
 * that row instead of erroring.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

export const POST = withErrorHandler("schools:POST", async (request: NextRequest) => {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, city, country } = (body ?? {}) as {
    name?: unknown;
    city?: unknown;
    country?: unknown;
  };

  if (typeof name !== "string" || name.trim().length < 3) {
    return NextResponse.json(
      { error: "School name is required (min 3 chars)" },
      { status: 400 }
    );
  }
  if (typeof country !== "string" || country.trim().length === 0) {
    return NextResponse.json({ error: "Country is required" }, { status: 400 });
  }

  const cleanName = name.trim();
  const cleanCity = typeof city === "string" && city.trim().length > 0 ? city.trim() : null;
  const cleanCountry = country.trim().toUpperCase();

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("schools")
    .insert({
      name: cleanName,
      city: cleanCity,
      country: cleanCountry,
      ib_programmes: [],
      source: "user_submitted",
      verified: false,
      created_by: teacherId,
    })
    .select("id, name, city, country, ib_programmes, verified, source")
    .single();

  if (error) {
    // 23505 = unique_violation on (normalized_name, country)
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("schools")
        .select("id, name, city, country, ib_programmes, verified, source")
        .ilike("name", cleanName)
        .eq("country", cleanCountry)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ school: existing, duplicate: true });
      }
    }

    console.error("[schools:POST] Insert failed:", error.message, error.code);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ school: data });
});
