/**
 * /fab/queue — Fabricator queue page (Phase 7-3).
 *
 * Replaces the Phase 1B-2 placeholder. Shows a per-machine queue
 * scoped to the fabricator's `fabricator_machines` assignments,
 * with two tabs:
 *
 *   Ready to pick up  — approved jobs waiting for a lab tech
 *   In progress       — this fabricator's own picked-up jobs
 *
 * Server component (auth check + page shell). The interactive queue
 * itself is a client component (FabQueueClient) so tab state + fetch
 * polling can live client-side without a full reload per tab switch.
 *
 * Dark slate theme continues from /fab/login — fab surface is the
 * "workshop terminal" visually distinct from the teacher/student
 * purple/gray surfaces.
 *
 * Unauthenticated users are redirected to /fab/login.
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

  const { fabricator } = auth;

  return (
    <div className="min-h-screen">
      {/* Page header — fabricator name + sign out. Kept minimal so
          the queue body stays prominent. */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-wide text-slate-100">
              Preflight · Fabricator
            </span>
            <span aria-hidden="true" className="text-slate-700">
              ·
            </span>
            <span className="text-sm text-slate-400">
              {fabricator.display_name}
            </span>
          </div>
          <form action="/api/fab/logout" method="post">
            <button
              type="submit"
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700 transition-all active:scale-[0.97]"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-3xl font-bold text-slate-100">Queue</h1>
        <p className="text-sm text-slate-400 mt-2">
          Approved submissions ready to run, and jobs you&apos;ve already picked
          up.
        </p>

        <FabQueueClient />
      </main>
    </div>
  );
}
