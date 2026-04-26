/**
 * /fab/queue — Fabricator queue page (Phase 7-3 + 8.1d-20 redesign).
 *
 * Renders the full fabricator dashboard: Now Running strip + machine
 * lanes (one column per machine the teacher owns) + Done Today strip.
 *
 * Pre-redesign this was a small wrapper around a tab list (Ready /
 * In progress). The 8.1d-20 redesign promoted the page to a real
 * dashboard — but the auth + redirect logic stays here in the
 * server component while the interactive surface lives in
 * FabQueueClient (client component, manages its own state +
 * fetches).
 *
 * Unauthenticated users → /fab/login.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { getFabricator } from "@/lib/fab/auth";
import FabQueueClient from "./FabQueueClient";

export const dynamic = "force-dynamic";

export default async function FabQueuePage() {
  // Build a NextRequest-shaped object from the incoming headers so
  // we can reuse getFabricator (which expects a NextRequest) without
  // duplicating the cookie-read logic.
  const hdrs = await headers();
  const cookieHeader = hdrs.get("cookie") ?? "";
  const fakeRequest = new NextRequest("http://localhost/fab/queue", {
    headers: { cookie: cookieHeader },
  });

  const auth = await getFabricator(fakeRequest);
  if (!auth) {
    redirect("/fab/login");
  }

  return (
    <FabQueueClient
      fabricatorName={auth.fabricator.display_name}
      fabricatorInitials={initialsFor(auth.fabricator.display_name)}
    />
  );
}

/** "Sam Fabricator" → "SF". Falls back to "?" for empty / one-token
 *  names so the avatar never renders blank. Mirrors the design's
 *  monogram in the top-right of the nav bar. */
function initialsFor(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
}
