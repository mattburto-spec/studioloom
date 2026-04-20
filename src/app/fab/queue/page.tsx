/**
 * /fab/queue — Fabricator queue page.
 *
 * Phase 1B-2 ships a gated placeholder: proves auth works end-to-end
 * (getFabricator reads the cookie, hashes it, validates the session,
 * returns the fabricator record). Phase 2 replaces this body with the
 * real per-machine queue lists.
 *
 * Unauthenticated users are redirected to /fab/login.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { getFabricator } from "@/lib/fab/auth";

export const dynamic = "force-dynamic";

export default async function FabQueuePage() {
  // Build a NextRequest-shaped object from the incoming headers so we can
  // reuse getFabricator (which expects a NextRequest) without duplicating
  // the cookie-read logic. We only need `.cookies.get()` to work.
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          Welcome, {fabricator.display_name}
        </h1>
        <p className="mt-4 text-slate-400">
          You are signed in as a Fabricator.
        </p>
        <p className="mt-8 rounded-xl bg-slate-900 px-6 py-5 text-sm text-slate-300 ring-1 ring-slate-800">
          The job queue and pickup workflow land in <strong>Phase 2</strong>.
          For now, this page confirms your login session is active.
        </p>
        <form action="/api/fab/logout" method="post" className="mt-6">
          <button
            type="submit"
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
