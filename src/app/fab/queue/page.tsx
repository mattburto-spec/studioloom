/**
 * /fab/queue — Phase 8.1d-23 redirect.
 *
 * The fabricator dashboard split into per-category pages:
 *   /fab/queue/printer  (default)
 *   /fab/queue/laser
 * Either is bookmark-friendly; switching is one click via the
 * category switcher in the page header. /fab/queue itself just
 * redirects to printer (the higher-volume category at NIS, +
 * stable URL for legacy bookmarks).
 *
 * Auth check stays on the redirect path — unauthenticated users
 * see the /fab/login page, not a redirect chain.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { getFabricator } from "@/lib/fab/auth";

export const dynamic = "force-dynamic";

export default async function FabQueuePage() {
  const hdrs = await headers();
  const cookieHeader = hdrs.get("cookie") ?? "";
  const fakeRequest = new NextRequest("http://localhost/fab/queue", {
    headers: { cookie: cookieHeader },
  });
  const auth = await getFabricator(fakeRequest);
  if (!auth) {
    redirect("/fab/login");
  }
  redirect("/fab/queue/printer");
}
