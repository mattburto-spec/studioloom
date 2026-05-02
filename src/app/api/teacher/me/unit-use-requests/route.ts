/**
 * GET /api/teacher/me/unit-use-requests
 *
 * Phase 4.6 — author's inbox + requester's outbox in one route. Returns
 * both:
 *   - inbox: requests where me = author_user_id (others requesting MY
 *            units; status filter ?status=pending|approved|denied|withdrawn)
 *   - outbox: requests where me = requester_user_id (MY requests for
 *            others' units)
 *
 * Auth: any authenticated teacher.
 *
 * Query params:
 *   ?status=pending|approved|denied|withdrawn  (optional; comma-separated for multi)
 *   ?box=inbox|outbox  (optional; default returns both)
 *
 * Response:
 *   { inbox: [...], outbox: [...] }
 *   Each row includes: id, unit_id, status, intent_message,
 *     author_response, decided_at, forked_unit_id, created_at,
 *     unit_title, unit_thumbnail, requester_name, author_name
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_STATUSES = ["pending", "approved", "denied", "withdrawn"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

export async function GET(request: NextRequest) {
  try {
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
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const box = url.searchParams.get("box");

    const statusFilter: ValidStatus[] = [];
    if (statusParam) {
      const requested = statusParam.split(",").map((s) => s.trim());
      for (const s of requested) {
        if (VALID_STATUSES.includes(s as ValidStatus)) {
          statusFilter.push(s as ValidStatus);
        }
      }
      if (statusFilter.length === 0) {
        return NextResponse.json(
          { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const admin = createAdminClient();

    const baseSelect =
      "id, unit_id, requester_user_id, author_user_id, school_id, intent_message, status, author_response, decided_at, decided_by_user_id, forked_unit_id, created_at";
    const userId = user.id;

    async function fetchSide(role: "inbox" | "outbox") {
      const idColumn = role === "inbox" ? "author_user_id" : "requester_user_id";
      let q = admin
        .from("unit_use_requests")
        .select(baseSelect)
        .eq(idColumn, userId)
        .order("created_at", { ascending: false });
      if (statusFilter.length > 0) {
        q = q.in("status", statusFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    }

    const wantInbox = !box || box === "inbox";
    const wantOutbox = !box || box === "outbox";

    const [inbox, outbox] = await Promise.all([
      wantInbox ? fetchSide("inbox") : Promise.resolve([]),
      wantOutbox ? fetchSide("outbox") : Promise.resolve([]),
    ]);

    // Hydrate with unit + name fields (small N — typical inbox is 0-20 rows)
    const allRows = [...inbox, ...outbox];
    const unitIds = [...new Set(allRows.map((r) => r.unit_id))];
    const userIds = [
      ...new Set(
        allRows.flatMap((r) => [r.requester_user_id, r.author_user_id])
      ),
    ];

    const [unitsRes, teachersRes] =
      unitIds.length || userIds.length
        ? await Promise.all([
            unitIds.length
              ? admin
                  .from("units")
                  .select("id, title, thumbnail_url")
                  .in("id", unitIds)
              : Promise.resolve({ data: [] }),
            userIds.length
              ? admin
                  .from("teachers")
                  .select("id, name, display_name, email")
                  .in("id", userIds)
              : Promise.resolve({ data: [] }),
          ])
        : [{ data: [] }, { data: [] }];

    const unitMap = new Map<string, { title: string; thumbnail_url: string | null }>();
    for (const u of (unitsRes.data ?? []) as Array<{
      id: string;
      title: string;
      thumbnail_url: string | null;
    }>) {
      unitMap.set(u.id, { title: u.title, thumbnail_url: u.thumbnail_url });
    }
    const teacherMap = new Map<string, { name: string }>();
    for (const t of (teachersRes.data ?? []) as Array<{
      id: string;
      name: string | null;
      display_name: string | null;
      email: string | null;
    }>) {
      teacherMap.set(t.id, {
        name: t.display_name ?? t.name ?? t.email ?? "Unknown",
      });
    }

    function hydrate(rows: typeof inbox) {
      return rows.map((r) => ({
        ...r,
        unit_title: unitMap.get(r.unit_id)?.title ?? "(unknown)",
        unit_thumbnail: unitMap.get(r.unit_id)?.thumbnail_url ?? null,
        requester_name: teacherMap.get(r.requester_user_id)?.name ?? "Unknown",
        author_name: teacherMap.get(r.author_user_id)?.name ?? "Unknown",
      }));
    }

    return NextResponse.json(
      {
        inbox: hydrate(inbox),
        outbox: hydrate(outbox),
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[unit-use-requests GET] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
