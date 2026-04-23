import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/* See /teacher/dashboard/v2/enable — this is the opt-out. Deleted at
 * Phase 8 cutover.
 */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete("tl_v2");
  return NextResponse.redirect(new URL("/teacher/dashboard", request.url));
}
