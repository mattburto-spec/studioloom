/**
 * /teacher/c/[classSlugId] — class-canonical canvas URL.
 *
 * DT canvas Package B.4 (17 May 2026).
 *
 * Replaces the UUID-soup /teacher/units/<unit-uuid>/class/<class-uuid>
 * with a human-readable URL whose segment is "<class-slug>-<6-hex-id>"
 * (e.g. `/teacher/c/9-design-science-s2-b97888`).
 *
 * Server component flow:
 *   1. Parse the segment (legacy raw UUID OR `<slug>-<6id>` — both work).
 *   2. Call resolveClassBySlug() — RLS-scoped read of the classes table.
 *   3. On not_found / collision → notFound() (Next 404 page).
 *   4. On query_error → throw (root error boundary handles it).
 *   5. If the segment doesn't match the canonical slug (e.g. class was
 *      renamed since the link was minted) → server-redirect to the
 *      canonical URL so the URL bar stays in sync.
 *   6. If the class has no active unit yet → render empty-state shell
 *      with a CTA back to the class settings page (no unit = nothing
 *      for the canvas to render).
 *   7. Otherwise render <ClassCanvas /> with the resolved unit + class.
 *
 * The legacy URL /teacher/units/[unitId]/class/[classId] still works for
 * bookmarks + external links but now server-redirects here on hit (see
 * src/app/teacher/units/[unitId]/class/[classId]/page.tsx after B.4).
 *
 * Auth: middleware Phase 6.3b matches /teacher/* page routes and
 * redirects unauthenticated users to /teacher/login, so this server
 * component never needs to re-check auth — by the time it runs the
 * caller is a teacher. resolveClassBySlug() uses the same teacher
 * cookies, so RLS scopes the query to classes the teacher can access.
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ClassCanvas } from "@/components/teacher/class-hub/ClassCanvas";
import { resolveClassBySlug } from "@/lib/classes/resolve-by-slug";

export const dynamic = "force-dynamic";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // page server component — cookies are read-only here
        },
      },
    },
  );
}

export default async function ClassCanvasSlugPage({
  params,
}: {
  params: Promise<{ classSlugId: string }>;
}) {
  const { classSlugId } = await params;
  const supabase = await getSupabase();

  const result = await resolveClassBySlug(supabase, classSlugId);

  if (!result.ok) {
    if (result.reason === "not_found" || result.reason === "collision") {
      notFound();
    }
    // query_error — surface to the error boundary instead of silently 404ing
    throw new Error(`resolveClassBySlug failed: ${result.error ?? "unknown"}`);
  }

  const { classId, name, activeUnitId, canonicalSlug } = result.data;

  // Canonical-slug redirect: if the incoming segment doesn't match the
  // slug we'd mint for this class right now, bounce to the canonical
  // URL. Keeps URL bar in sync after a class rename without breaking
  // already-shipped links (the 6-char ID suffix is stable).
  if (canonicalSlug !== classSlugId) {
    redirect(`/teacher/c/${canonicalSlug}`);
  }

  // No active unit assigned — render an empty-state shell. The class
  // settings page lets the teacher pick one. Once they do, the active
  // unit is set on class_units and this page renders the canvas next
  // load.
  if (!activeUnitId) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-gray-900">
          {name || "Untitled class"}
        </h1>
        <p className="mt-4 text-gray-600">
          This class doesn&apos;t have an active unit yet. Pick one from the
          unit library to start teaching.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href={`/teacher/classes/${classId}`}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Open class settings
          </Link>
          <Link
            href="/teacher/units"
            className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Browse units
          </Link>
        </div>
      </div>
    );
  }

  return <ClassCanvas unitId={activeUnitId} classId={classId} />;
}
