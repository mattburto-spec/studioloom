/**
 * GET /api/schools/search?q=&country=
 *
 * Authenticated typeahead for the welcome-wizard school picker.
 * Returns up to 20 matches, ranked:
 *   1. Exact prefix match (case-insensitive)
 *   2. Substring match
 *   3. Alphabetical
 *
 * Uses the GIN trigram index on schools.name (migration 085) — %ILIKE%
 * is index-accelerated, so we don't need a separate prefix-only path.
 *
 * q < 2 chars → returns empty array (avoids full-scan on first keystroke).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

export const GET = withErrorHandler("schools/search:GET", async (request: NextRequest) => {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const country = searchParams.get("country")?.trim().toUpperCase() || null;

  if (q.length < 2) {
    return NextResponse.json({ schools: [] });
  }

  // Escape PostgREST/SQL wildcards so user input can't pollute the pattern.
  const safeQ = q.replace(/[%_\\]/g, "\\$&");

  const supabase = createAdminClient();

  let query = supabase
    .from("schools")
    .select("id, name, city, country, ib_programmes, verified, source")
    .ilike("name", `%${safeQ}%`)
    .limit(20);

  if (country) {
    query = query.eq("country", country);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[schools/search] Query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Re-rank client-side: prefix matches first, then substring, then alpha
  const qLower = q.toLowerCase();
  const schools = (data || []).sort((a, b) => {
    const aN = (a.name || "").toLowerCase();
    const bN = (b.name || "").toLowerCase();
    const aPrefix = aN.startsWith(qLower);
    const bPrefix = bN.startsWith(qLower);
    if (aPrefix !== bPrefix) return aPrefix ? -1 : 1;
    // Verified rows before user_submitted within the same tier
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    return aN.localeCompare(bN);
  });

  return NextResponse.json(
    { schools },
    {
      headers: {
        // Private cache: safe per-user, cheap to revalidate, prevents Vercel
        // edge from holding stale typeahead results for other teachers.
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    }
  );
});
