/**
 * /fab/queue/laser — Laser cutting dashboard (Phase 8.1d-23).
 *
 * Mirror of /fab/queue/printer with category="laser_cutter". See
 * that file's header for the rationale on the category-page split.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { getFabricator } from "@/lib/fab/auth";
import CategoryDashboard from "../FabQueueClient";

export const dynamic = "force-dynamic";

export default async function FabQueueLaserPage() {
  const hdrs = await headers();
  const cookieHeader = hdrs.get("cookie") ?? "";
  const fakeRequest = new NextRequest("http://localhost/fab/queue/laser", {
    headers: { cookie: cookieHeader },
  });
  const auth = await getFabricator(fakeRequest);
  if (!auth) {
    redirect("/fab/login");
  }

  return (
    <CategoryDashboard
      category="laser_cutter"
      fabricatorName={auth.fabricator.display_name}
      fabricatorInitials={initialsFor(auth.fabricator.display_name)}
    />
  );
}

function initialsFor(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
}
