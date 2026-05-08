/**
 * GET /api/admin/cost-usage?period=today|7d|30d|all
 *
 * Unified spend-by-endpoint view. Reads ai_usage_log (every Anthropic call
 * lands here post Phase A.3 via callAnthropicMessages) and groups by
 * endpoint + attribution type (student / teacher / anonymous / lib).
 *
 * The "today" boundary respects school timezone (default Asia/Shanghai —
 * same convention as the per-student AI budget reset; see migration
 * 20260503012514_phase_5_2_atomic_ai_budget_increment.sql §3 step 2).
 *
 * Auth: admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

type Period = "today" | "7d" | "30d" | "all";
type AttributionType = "student" | "teacher" | "anonymous" | "lib";

// Cap on rows pulled for in-process aggregation. With ~5 students burning
// ~35k tokens/day plus teacher + tool calls, we expect <2k rows/day, so 30d
// stays well under this. If we ever exceed it, push the GROUP BY into a
// SECURITY DEFINER RPC (the (endpoint, created_at) index makes it cheap).
const ROW_FETCH_CAP = 50_000;
const TOP_ENDPOINTS = 100;

const DEFAULT_TZ = "Asia/Shanghai";

/**
 * Start of "today" in the school's local timezone, expressed as a UTC Date.
 * Mirrors the SQL convention `(now() AT TIME ZONE tz)::date AT TIME ZONE tz`
 * from the AI budget reset function.
 */
function startOfTodayInTimezone(tz: string): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  // Build "YYYY-MM-DDT00:00:00" *as if it were local in tz* by getting the
  // offset for that local instant. Trick: format the same instant in the
  // target tz and in UTC, the difference gives the offset.
  const localMidnightAsIfUTC = new Date(`${y}-${m}-${d}T00:00:00Z`);
  const offsetMs = tzOffsetMs(localMidnightAsIfUTC, tz);
  return new Date(localMidnightAsIfUTC.getTime() - offsetMs);
}

function tzOffsetMs(at: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const asUTC = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")) === 24 ? 0 : Number(get("hour")),
    Number(get("minute")),
    Number(get("second")),
  );
  return asUTC - at.getTime();
}

function periodSince(period: Period): Date | null {
  if (period === "all") return null;
  if (period === "today") return startOfTodayInTimezone(DEFAULT_TZ);
  const days = period === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 86_400_000);
}

function attributionFor(
  studentId: string | null,
  userId: string | null,
  endpoint: string,
): AttributionType {
  if (studentId) return "student";
  if (userId) return "teacher";
  if (endpoint.startsWith("tools/")) return "anonymous";
  return "lib";
}

interface UsageRow {
  endpoint: string;
  student_id: string | null;
  user_id: string | null;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | string | null;
}

interface EndpointAgg {
  endpoint: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
  attributionCounts: Record<AttributionType, number>;
  modelCounts: Record<string, number>;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const periodParam = (request.nextUrl.searchParams.get("period") ||
    "7d") as Period;
  const period: Period = ["today", "7d", "30d", "all"].includes(periodParam)
    ? periodParam
    : "7d";

  const since = periodSince(period);

  try {
    let query = supabase
      .from("ai_usage_log")
      .select(
        "endpoint, student_id, user_id, model, input_tokens, output_tokens, estimated_cost_usd",
      )
      .order("created_at", { ascending: false })
      .limit(ROW_FETCH_CAP);

    if (since) query = query.gte("created_at", since.toISOString());

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as UsageRow[];

    const totals = {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUSD: 0,
    };
    const byAttribution: Record<AttributionType, number> = {
      student: 0,
      teacher: 0,
      anonymous: 0,
      lib: 0,
    };
    const endpointMap = new Map<string, EndpointAgg>();

    for (const r of rows) {
      const endpoint = r.endpoint || "(unknown)";
      const inT = Number(r.input_tokens) || 0;
      const outT = Number(r.output_tokens) || 0;
      const cost = Number(r.estimated_cost_usd) || 0;
      const attr = attributionFor(r.student_id, r.user_id, endpoint);

      totals.calls += 1;
      totals.inputTokens += inT;
      totals.outputTokens += outT;
      totals.estimatedCostUSD += cost;
      byAttribution[attr] += inT + outT;

      let agg = endpointMap.get(endpoint);
      if (!agg) {
        agg = {
          endpoint,
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUSD: 0,
          attributionCounts: { student: 0, teacher: 0, anonymous: 0, lib: 0 },
          modelCounts: {},
        };
        endpointMap.set(endpoint, agg);
      }
      agg.calls += 1;
      agg.inputTokens += inT;
      agg.outputTokens += outT;
      agg.estimatedCostUSD += cost;
      agg.attributionCounts[attr] += 1;
      const m = r.model || "(unknown)";
      agg.modelCounts[m] = (agg.modelCounts[m] || 0) + 1;
    }

    const byEndpoint = Array.from(endpointMap.values())
      .sort((a, b) => b.calls - a.calls)
      .slice(0, TOP_ENDPOINTS)
      .map((a) => ({
        endpoint: a.endpoint,
        calls: a.calls,
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        estimatedCostUSD: Math.round(a.estimatedCostUSD * 1_000_000) / 1_000_000,
        attributionType: dominantKey(a.attributionCounts) as AttributionType,
        topModel: dominantKey(a.modelCounts),
      }));

    return NextResponse.json({
      period,
      totals: {
        calls: totals.calls,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        estimatedCostUSD:
          Math.round(totals.estimatedCostUSD * 1_000_000) / 1_000_000,
      },
      byEndpoint,
      byAttribution,
      truncated: rows.length === ROW_FETCH_CAP,
    });
  } catch (e) {
    console.error("[admin/cost-usage] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load cost data" },
      { status: 500 },
    );
  }
}

function dominantKey(counts: Record<string, number>): string {
  let best = "";
  let bestN = -1;
  for (const [k, n] of Object.entries(counts)) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}
