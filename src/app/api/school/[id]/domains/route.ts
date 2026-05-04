// audit-skip: school-scoped operation; audit covered by school_settings_history (mig 087)
/**
 * /api/school/[id]/domains
 *
 * Phase 4.2 — same-school teacher CRUD against school_domains.
 *
 * GET   list — returns the school's verified + unverified domains.
 *              RLS gates to current_teacher_school_id() match.
 * POST  add  — auto-verify path: when the requester's email domain
 *              matches the domain being added, verified=true on insert
 *              (low-stakes, instant). Non-matching domain returns 501
 *              "requires governance proposal" — that path lands in
 *              Phase 4.3 via proposeSchoolSettingChange() helper.
 *
 * DELETE is deferred to Phase 4.3 — always high-stakes per brief §4.2;
 * needs the governance helper that doesn't exist yet.
 *
 * Response shapes:
 *   GET  → { domains: [{ id, domain, verified, added_by, created_at }] }
 *   POST → { domain: {...}, autoVerified: true } | 501 { error, requires }
 *
 * Note: doesn't use withErrorHandler — the wrapper drops the second
 * route-context arg and we need it for params extraction.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

type RouteContext = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────
// Auth helper — pulls teacherId + email + school_id in one go.
// requireTeacherAuth doesn't expose email; school_id lives on teachers.
// ─────────────────────────────────────────────────────────────────────

async function authenticateTeacher(
  request: NextRequest
): Promise<
  | { teacherId: string; email: string; schoolId: string | null; error?: never }
  | { error: NextResponse }
> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: teacher } = await admin
    .from("teachers")
    .select("school_id")
    .eq("id", user.id)
    .maybeSingle();

  return {
    teacherId: user.id,
    email: user.email,
    schoolId: teacher?.school_id ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// GET — list school's domains
// ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    const auth = await authenticateTeacher(request);
    if ("error" in auth) return auth.error;

    const { id: schoolId } = await ctx.params;

    if (!UUID_RE.test(schoolId)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    if (auth.schoolId !== schoolId) {
      // Cross-school read: 404 not 403 (don't leak existence)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("school_domains")
      .select("id, domain, verified, added_by, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[school/domains:GET] failed:", error.message);
      return NextResponse.json(
        { error: "Failed to load domains" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { domains: data ?? [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("[school/domains:GET] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────
// POST — add domain (auto-verify only in Phase 4.2)
// ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const auth = await authenticateTeacher(request);
    if ("error" in auth) return auth.error;

    const { id: schoolId } = await ctx.params;

    if (!UUID_RE.test(schoolId)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    if (auth.schoolId !== schoolId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const domain = (body as { domain?: unknown })?.domain;
    if (typeof domain !== "string" || !DOMAIN_RE.test(domain.trim())) {
      return NextResponse.json(
        { error: "Invalid domain — must be a valid hostname like 'school.org'" },
        { status: 400 }
      );
    }

    const normalisedDomain = domain.trim().toLowerCase();
    const requesterDomain = auth.email.split("@")[1]?.toLowerCase() ?? "";

    // ─── Auto-verify path: requester's email domain matches ────────
    //
    // Tier resolution (per brief §3.8 Q2): if the requesting teacher
    // is on @<domain>, this is a low-stakes change (instant apply).
    // Anyone else on the same school can attest later via a manual
    // proposal in Phase 4.3.
    if (requesterDomain !== normalisedDomain) {
      return NextResponse.json(
        {
          error:
            "Adding a domain you don't own requires a high-stakes proposal (2-teacher confirm). Phase 4.3 ships the governance flow.",
          requires: "phase_4_3_governance_engine",
        },
        { status: 501 }
      );
    }

    // Check free-email blocklist client-side too (defence-in-depth — the
    // DB lookup function blocks them, but no point creating a row that
    // can never be returned by lookup).
    const admin = createAdminClient();
    const { data: blockCheck } = await admin.rpc("is_free_email_domain", {
      _domain: normalisedDomain,
    });
    if (blockCheck === true) {
      return NextResponse.json(
        {
          error:
            "Free-email providers (gmail.com, qq.com, etc.) cannot be claimed as a school domain.",
          requires: "use_school_owned_domain",
        },
        { status: 400 }
      );
    }

    const { data: inserted, error } = await admin
      .from("school_domains")
      .insert({
        school_id: schoolId,
        domain: normalisedDomain,
        verified: true,
        added_by: auth.teacherId,
      })
      .select("id, domain, verified, added_by, created_at")
      .single();

    if (error) {
      // Unique violation = domain already claimed (possibly by another school)
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: "This domain is already claimed by another school.",
            code: "domain_already_claimed",
          },
          { status: 409 }
        );
      }
      console.error("[school/domains:POST] insert failed:", error.message);
      return NextResponse.json(
        { error: "Failed to add domain" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { domain: inserted, autoVerified: true },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[school/domains:POST] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
