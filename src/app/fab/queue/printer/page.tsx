/**
 * /fab/queue/printer — 3D printing dashboard (Phase 8.1d-23).
 *
 * Server component thin wrapper — auth check + CategoryDashboard
 * mount. Same shape as the laser route (`/fab/queue/laser`) so
 * adding future categories (vinyl, CNC) is a one-file copy.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { getFabricator } from "@/lib/fab/auth";
import CategoryDashboard from "../FabQueueClient";

export const dynamic = "force-dynamic";

export default async function FabQueuePrinterPage() {
  const hdrs = await headers();
  const cookieHeader = hdrs.get("cookie") ?? "";
  const fakeRequest = new NextRequest("http://localhost/fab/queue/printer", {
    headers: { cookie: cookieHeader },
  });
  const auth = await getFabricator(fakeRequest);
  if (!auth) {
    redirect("/fab/login");
  }

  return (
    <CategoryDashboard
      category="3d_printer"
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
