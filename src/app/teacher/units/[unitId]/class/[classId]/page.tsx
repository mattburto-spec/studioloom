/**
 * Legacy UUID-soup canvas URL — server-redirects to the new
 * class-canonical slug URL at /teacher/c/[classSlugId].
 *
 * DT canvas Package B.4 (17 May 2026).
 *
 * Was a thin client wrapper around <ClassCanvas /> (B.3); now a server
 * component that looks up the class name, builds the canonical slug,
 * and redirects. Kept around so bookmarks + external links pointing
 * at the old unit-first URL pattern keep working — they just bounce
 * once to the new URL.
 *
 * Note: the `unitId` segment is intentionally ignored. The new URL
 * has no unit segment — the canvas always renders the class's
 * currently-active unit (one per class, enforced by the partial unique
 * index on class_units.is_active from migration
 * 20260515214045_class_units_one_active_per_class). If a link was
 * minted while a different unit was active, the redirect lands on the
 * current active one.
 *
 * Failure modes:
 *   - class lookup returns no rows (deleted / no RLS access) → 404
 *     via the new slug URL's own resolveClassBySlug() handling
 *   - query error → falls back to client-side render of <ClassCanvas />
 *     using the legacy unitId so the user still sees something
 *
 * The fallback path keeps existing bookmarks usable even if the
 * lookup race-conditions or the prefix collides. Once every inbound
 * link migrates to the slug URL (B.5), the fallback can be deleted
 * and this file can become a pure redirect stub.
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import { buildSlugWithId } from "@/lib/url/slug";
import LegacyCanvasClient from "./legacy-client";

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
          // server component — cookies are read-only here
        },
      },
    },
  );
}

export default async function ClassHubLegacyPage({
  params,
}: {
  params: Promise<{ unitId: string; classId: string }>;
}) {
  const { unitId, classId } = await params;
  const supabase = await getSupabase();

  // Look up the class so we can build the canonical slug URL.
  // RLS-scoped — a teacher who can't see the class gets no row back
  // and we fall through to the client wrapper (which will hit its
  // own load errors and surface them in-place).
  const { data: cls, error } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .maybeSingle();

  if (!error && cls) {
    const slugUrl = `/teacher/c/${buildSlugWithId(cls.name, cls.id)}`;
    redirect(slugUrl);
  }

  // Fallback: lookup failed (network / RLS edge case). Render the
  // canvas inline using the legacy unitId + classId so the user is
  // not blocked. This branch should be very rare in practice.
  return <LegacyCanvasClient unitId={unitId} classId={classId} />;
}
