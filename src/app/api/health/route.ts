/**
 * Health Check Endpoint
 *
 * GET /api/health
 *
 * Public uptime monitoring endpoint. No authentication required.
 * Verifies Supabase database connectivity and measures response time.
 *
 * Response (200 OK on success):
 * {
 *   ok: true,
 *   db: true,
 *   timestamp: "2026-04-07T12:34:56.789Z",
 *   responseTime: 45
 * }
 *
 * Response (503 Service Unavailable on failure):
 * {
 *   ok: false,
 *   db: false,
 *   error: "Database connection failed",
 *   timestamp: "2026-04-07T12:34:56.789Z"
 * }
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    // Initialize Supabase admin client
    const supabase = createAdminClient();

    // Perform a trivial database query to verify connectivity
    // Query the students table with a limit of 1 to minimize DB load
    const { error } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) {
      const responseTime = Date.now() - startTime;
      return NextResponse.json(
        {
          ok: false,
          db: false,
          error: error.message || "Database connection failed",
          timestamp,
        },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Success: return health status
    const responseTime = Date.now() - startTime;
    return NextResponse.json(
      {
        ok: true,
        db: true,
        timestamp,
        responseTime,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    const responseTime = Date.now() - startTime;
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";

    return NextResponse.json(
      {
        ok: false,
        db: false,
        error: errorMessage,
        timestamp,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
