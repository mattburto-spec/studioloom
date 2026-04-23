import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/* One-click toggle for the Bold dashboard v2 preview.
 *
 * Hitting /teacher/dashboard/v2/enable sets tl_v2=1 and sends you to
 * the Bold dashboard. /disable clears the cookie and sends you back
 * to the legacy dashboard. Saves teachers from having to poke
 * DevTools while Phase 1-7 builds are in flight.
 *
 * Both routes are deleted at Phase 8 cutover when the Bold dashboard
 * becomes the production /teacher/dashboard (tracker:
 * docs/projects/teacher-dashboard-v1.md).
 */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  cookieStore.set("tl_v2", "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });
  return NextResponse.redirect(new URL("/teacher/dashboard/v2", request.url));
}
