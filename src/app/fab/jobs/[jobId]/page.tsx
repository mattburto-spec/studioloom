/**
 * /fab/jobs/[jobId] — Fabricator job detail (Phase 7-4).
 *
 * Server component (auth + redirect on unauth) + FabJobDetailClient
 * (everything interactive). Mirrors the /fab/queue split pattern.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { getFabricator } from "@/lib/fab/auth";
import FabJobDetailClient from "./FabJobDetailClient";

export const dynamic = "force-dynamic";

export default async function FabJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const hdrs = await headers();
  const cookieHeader = hdrs.get("cookie") ?? "";
  const fakeRequest = new NextRequest("http://localhost/fab/jobs", {
    headers: { cookie: cookieHeader },
  });

  const auth = await getFabricator(fakeRequest);
  if (!auth) {
    redirect("/fab/login");
  }

  const { jobId } = await params;
  const { fabricator } = auth;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-4xl px-6 h-14 flex items-center justify-between">
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

      <main className="mx-auto max-w-4xl px-6 py-8">
        <FabJobDetailClient jobId={jobId} />
      </main>
    </div>
  );
}
