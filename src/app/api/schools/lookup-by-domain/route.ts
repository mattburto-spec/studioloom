/**
 * GET /api/schools/lookup-by-domain?domain=foo.org
 *
 * Phase 4.2 — public, unauthenticated. Used by the welcome wizard to
 * auto-suggest a teacher's school based on their email domain.
 *
 * Calls the SECURITY DEFINER function public.lookup_school_by_domain
 * which (a) bakes in the free-email-provider blocklist (gmail.com,
 * outlook.com, qq.com, 163.com, etc. — see migration 4.2 for full list),
 * and (b) returns a NARROW projection (school_id, school_name only —
 * never added_by, verified flag, or created_at).
 *
 * Response shape:
 *   { match: { id, name } | null }
 *
 * Always 200; absent match returns `match: null`. Free-email domains
 * never return a match (DB-level guard, not just app-level).
 *
 * Cache-Control: no-store — the answer can change as schools add/remove
 * domains, and we don't want CDN caching the wrong answer for a domain
 * that just changed schools.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export const GET = withErrorHandler(
  "schools/lookup-by-domain:GET",
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const raw = (searchParams.get("domain") || "").trim().toLowerCase();

    // Cheap shape validation. The DB function will short-circuit blocklisted
    // domains regardless, but rejecting garbage at the edge keeps the
    // function call cost-free for malformed inputs.
    if (!raw || raw.length > 253 || !DOMAIN_RE.test(raw)) {
      return NextResponse.json(
        { match: null },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("lookup_school_by_domain", {
      _domain: raw,
    });

    if (error) {
      console.error(
        "[schools/lookup-by-domain] rpc failed:",
        error.message
      );
      return NextResponse.json(
        { match: null },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // RPC returning TABLE comes back as an array.
    const row = Array.isArray(data) ? data[0] : null;
    const match = row
      ? { id: row.school_id as string, name: row.school_name as string }
      : null;

    return NextResponse.json(
      { match },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
);
