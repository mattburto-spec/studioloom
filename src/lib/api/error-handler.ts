/**
 * Shared API route error handler with Sentry integration.
 *
 * Wraps any API route handler to:
 * 1. Catch unhandled exceptions
 * 2. Report them to Sentry with route name tag
 * 3. Return a clean 500 JSON response
 *
 * Usage:
 *   export const POST = withErrorHandler("teacher/dashboard", async (req) => {
 *     // ... route logic
 *     return NextResponse.json({ data });
 *   });
 *
 * Or wrap in-place for routes that need multiple handlers:
 *   export async function POST(request: NextRequest) {
 *     return withErrorHandler("teacher/profile", async (req) => {
 *       // ... route logic
 *       return NextResponse.json({ data });
 *     })(request);
 *   }
 */

import { NextRequest, NextResponse } from "next/server";

let Sentry: typeof import("@sentry/nextjs") | null = null;
try {
  // Dynamic import so routes don't hard-fail if Sentry isn't configured
  Sentry = require("@sentry/nextjs");
} catch {
  // Sentry not available — no-op
}

/**
 * Wrap an API route handler with error catching + Sentry reporting.
 */
export function withErrorHandler(
  routeName: string,
  handler: (request: NextRequest) => Promise<NextResponse | Response>
) {
  return async (request: NextRequest): Promise<NextResponse | Response> => {
    try {
      return await handler(request);
    } catch (error) {
      console.error(`[${routeName}] Unhandled error:`, error);

      if (Sentry) {
        Sentry.captureException(error, {
          tags: { route: routeName, layer: "api-route" },
          extra: {
            method: request.method,
            url: request.url,
          },
        });
      }

      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
