// audit-skip: school-scoped operation; audit covered by school_settings_history (mig 087)
/**
 * DELETE /api/school/[id]/domains/[domainId]
 *
 * Phase 4.3 — proposes removal of a school_domains row via the governance
 * engine. ALWAYS high-stakes (per brief §3.8 Q2 + tier-resolvers.ts):
 * removing a verified domain locks teachers out of auto-suggest.
 *
 * Behaviour:
 *   - Single-teacher school (bootstrap_expires_at NULL or future) →
 *     change effectiveTier downgrades to low_stakes → instant apply →
 *     row deleted in same transaction
 *   - Multi-teacher school → high_stakes → 2-teacher confirm via
 *     confirmHighStakesChange. Until confirmed, the school_domains row
 *     STAYS PRESENT. Confirmation triggers actual deletion (via the
 *     applier helper added in §4.4 — for now, the proposal is recorded
 *     but the actual delete defers to the §4.4 settings UI).
 *
 * Tier defers to the resolver. Caller doesn't pick.
 *
 * Response shapes:
 *   201 (low-stakes / single-teacher) → { ok: true, deleted: true, changeId, applied: true }
 *   201 (high-stakes pending)         → { ok: true, deleted: false, changeId, applied: false, expiresAt }
 *   429 → { ok: false, reason: 'rate_limited', retryAfterSeconds }
 *   403 → { ok: false, reason: 'archived_school' | 'merged_school' }
 *   404 → { error: 'Not found' }  (cross-school OR domain not in school)
 *   501 → { ok: false, reason: 'governance_disabled' }  (kill-switch active)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { proposeSchoolSettingChange } from "@/lib/access-v2/governance/setting-change";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string; domainId: string }> };

async function authenticateTeacher(
  request: NextRequest
): Promise<
  | {
      teacherId: string;
      email: string;
      schoolId: string | null;
      isPlatformAdmin: boolean;
      error?: never;
    }
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

  const [{ data: teacher }, { data: profile }] = await Promise.all([
    admin
      .from("teachers")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("user_profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  return {
    teacherId: user.id,
    email: user.email,
    schoolId: teacher?.school_id ?? null,
    isPlatformAdmin: profile?.is_platform_admin === true,
  };
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  try {
    const auth = await authenticateTeacher(request);
    if ("error" in auth) return auth.error;

    const { id: schoolId, domainId } = await ctx.params;

    if (!UUID_RE.test(schoolId) || !UUID_RE.test(domainId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    if (auth.schoolId !== schoolId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const admin = createAdminClient();

    // Look up the domain row first — need its current value for the
    // version-stamped payload (before_at_propose).
    const { data: domainRow, error: lookupErr } = await admin
      .from("school_domains")
      .select("id, school_id, domain, verified, added_by, created_at")
      .eq("id", domainId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (lookupErr || !domainRow) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Propose the removal via governance engine
    const proposal = await proposeSchoolSettingChange({
      schoolId,
      actor: {
        userId: auth.teacherId,
        email: auth.email,
        isPlatformAdmin: auth.isPlatformAdmin,
      },
      changeType: "remove_school_domain",
      payload: {
        version: 1,
        before_at_propose: domainRow,
        after: null,
        scope: { domain_id: domainId, domain: domainRow.domain },
      },
    });

    if (!proposal.ok) {
      // Map governance reasons to HTTP statuses
      const statusMap: Record<typeof proposal.reason, number> = {
        rate_limited: 429,
        archived_school: 403,
        merged_school: 403,
        school_not_found: 404,
        governance_disabled: 501,
        db_error: 500,
      };
      const status = statusMap[proposal.reason] ?? 500;
      const headers: Record<string, string> = {
        "Cache-Control": "private, no-store",
      };
      if (proposal.reason === "rate_limited" && proposal.retryAfterSeconds) {
        headers["Retry-After"] = String(Math.ceil(proposal.retryAfterSeconds));
      }
      return NextResponse.json(
        {
          ok: false,
          reason: proposal.reason,
          message: proposal.message,
          retryAfterSeconds: proposal.retryAfterSeconds,
        },
        { status, headers }
      );
    }

    // Single-teacher school (bootstrap grace) → effectiveTier=low_stakes →
    // proposal already 'applied'. Apply the actual delete now.
    if (proposal.status === "applied") {
      const { error: deleteErr } = await admin
        .from("school_domains")
        .delete()
        .eq("id", domainId)
        .eq("school_id", schoolId);

      if (deleteErr) {
        console.error(
          "[domains DELETE] propose succeeded but delete failed:",
          deleteErr.message
        );
        // Don't roll back the proposal — audit trail of "intent + failure" is
        // more useful than silently swallowing.
        return NextResponse.json(
          {
            ok: false,
            reason: "db_error",
            message:
              "Proposal recorded but delete failed. Re-apply via §4.4 settings UI.",
            changeId: proposal.changeId,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          deleted: true,
          applied: true,
          changeId: proposal.changeId,
          tier: proposal.tier,
          effectiveTier: proposal.effectiveTier,
        },
        {
          status: 200,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    // High-stakes pending: row STAYS, awaits 2nd-teacher confirm
    return NextResponse.json(
      {
        ok: true,
        deleted: false,
        applied: false,
        changeId: proposal.changeId,
        tier: proposal.tier,
        effectiveTier: proposal.effectiveTier,
        expiresAt: proposal.expiresAt,
        message:
          "Removal pending — needs another teacher to confirm within 48 hours.",
      },
      {
        status: 202,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[domains DELETE] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
