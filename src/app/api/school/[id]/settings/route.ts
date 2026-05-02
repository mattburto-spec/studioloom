/**
 * PATCH /api/school/[id]/settings
 *
 * Phase 4.4b — single endpoint for any school setting change. The
 * proposing teacher hits this with `{ changeType, currentValue, newValue,
 * scope? }`; the route:
 *
 *   1. Authenticates teacher
 *   2. Verifies same-school OR is_platform_admin
 *   3. Reads the actor's email (needed for tier resolution; the
 *      add_school_domain resolver checks email-domain match)
 *   4. Calls proposeSchoolSettingChange (which does the kill-switch +
 *      archived guard + rate limit + tier resolution + bootstrap grace
 *      adjustment + ledger insert with version-stamped payload)
 *   5. If the proposal is auto-applied (low-stakes OR bootstrap grace
 *      downgraded high → low), call applyChange to update the actual
 *      schools column
 *   6. Return ProposeResult mapped to HTTP status
 *
 * Status mapping (mirrors §4.3 DELETE pattern):
 *   200 — applied immediately (low-stakes or bootstrap-grace downgrade)
 *   202 — high-stakes pending; needs 2nd teacher to confirm in §4.4c
 *   429 — rate limited (Retry-After header set)
 *   403 — archived_school OR merged_school
 *   404 — school_not_found
 *   501 — governance_disabled (kill-switch flipped off)
 *   500 — db_error or unhandled
 *
 * Response body always includes:
 *   { ok, status, tier, effectiveTier, applied, changeId, expiresAt? }
 *
 * Used by the §4.4 settings page editable sections + by the §4.4c
 * confirm/revert flow when 2nd teacher acts on a pending proposal.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { proposeSchoolSettingChange } from "@/lib/access-v2/governance/setting-change";
import { applyChange } from "@/lib/access-v2/governance/applier";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

async function authenticateTeacher(request: NextRequest): Promise<
  | {
      teacherId: string;
      email: string;
      schoolId: string | null;
      isPlatformAdmin: boolean;
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

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const auth = await authenticateTeacher(request);
    if ("error" in auth) return auth.error;

    const { id: schoolId } = await ctx.params;

    if (!UUID_RE.test(schoolId)) {
      return NextResponse.json(
        { error: "Invalid school id" },
        { status: 400 }
      );
    }

    if (auth.schoolId !== schoolId && !auth.isPlatformAdmin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const {
      changeType,
      currentValue,
      newValue,
      scope,
    } = (body ?? {}) as {
      changeType?: unknown;
      currentValue?: unknown;
      newValue?: unknown;
      scope?: unknown;
    };

    if (typeof changeType !== "string" || changeType.length === 0) {
      return NextResponse.json(
        { error: "changeType (string) is required" },
        { status: 400 }
      );
    }

    // Hotfix C2 — server-side trim. Trailing/leading whitespace on string
    // values is never meaningful for school settings; trimming at the
    // edge means the audit ledger + the column write + future reverts
    // all use the same canonical value. Only string-typed newValue gets
    // trimmed; objects/arrays/numbers pass through as-is.
    const trimmedNewValue =
      typeof newValue === "string" ? newValue.trim() : newValue;
    const trimmedCurrentValue =
      typeof currentValue === "string" ? currentValue.trim() : currentValue;

    // Compose the version-stamped PayloadV1 (using trimmed values)
    const payload = {
      version: 1 as const,
      before_at_propose: trimmedCurrentValue ?? null,
      after: trimmedNewValue ?? null,
      ...(scope && typeof scope === "object"
        ? { scope: scope as Record<string, unknown> }
        : {}),
    };

    const proposal = await proposeSchoolSettingChange({
      schoolId,
      actor: {
        userId: auth.teacherId,
        email: auth.email,
        isPlatformAdmin: auth.isPlatformAdmin,
      },
      changeType,
      payload,
    });

    if (!proposal.ok) {
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

    // Auto-apply for low-stakes (or bootstrap-grace downgraded high→low).
    // High-stakes pending stays in school_setting_changes as 'pending';
    // §4.4c confirm flow calls applyChange when the 2nd teacher confirms.
    if (proposal.status === "applied") {
      const applyResult = await applyChange({
        schoolId,
        changeType,
        newValue: trimmedNewValue,
        scope: scope as Record<string, unknown> | undefined,
      });

      if (!applyResult.ok) {
        // The proposal is already in the audit ledger as 'applied' but
        // the actual schools column write failed. This is an unusual
        // state — we surface it loudly so the caller can re-apply via
        // the settings UI, but we don't roll back the proposal (audit
        // trail of "intent + failure" is more useful than swallowing).
        console.error(
          "[settings PATCH] proposal applied but applier failed:",
          applyResult
        );
        return NextResponse.json(
          {
            ok: false,
            reason: "apply_failed",
            message: applyResult.message,
            changeId: proposal.changeId,
            tier: proposal.tier,
            effectiveTier: proposal.effectiveTier,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          applied: true,
          changeId: proposal.changeId,
          tier: proposal.tier,
          effectiveTier: proposal.effectiveTier,
          rowsAffected: applyResult.rowsAffected,
        },
        {
          status: 200,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    // High-stakes pending — column NOT updated yet; 2nd teacher must confirm
    return NextResponse.json(
      {
        ok: true,
        applied: false,
        changeId: proposal.changeId,
        tier: proposal.tier,
        effectiveTier: proposal.effectiveTier,
        expiresAt: proposal.expiresAt,
        message:
          "Change pending — needs another teacher to confirm within 48 hours.",
      },
      {
        status: 202,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[settings PATCH] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
