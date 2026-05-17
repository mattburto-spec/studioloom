"use client";

import { use } from "react";
import { ClassCanvas } from "@/components/teacher/class-hub/ClassCanvas";

// ---------------------------------------------------------------------------
// Legacy canvas route. Kept for backward compat with bookmarks +
// external links that point at the unit-first URL pattern.
// (DT canvas Package B.3 / B.4, 17 May 2026)
// ---------------------------------------------------------------------------
// The canvas itself lives in <ClassCanvas /> — this file just unwraps
// the URL params and renders the shared component. The class-canonical
// slug URL at /teacher/c/[classSlugId] mounts the same canvas via a
// server-side resolver.
//
// Package B.4 wires a server-side redirect from this URL to the new
// slug URL (with the resolved class name + 6-char prefix). The route
// file remains here as a thin client wrapper until every inbound link
// migrates to the new URL — then we can switch this file to a pure
// redirect.
// ---------------------------------------------------------------------------

export default function ClassHubPage({
  params,
}: {
  params: Promise<{ unitId: string; classId: string }>;
}) {
  const { unitId, classId } = use(params);
  return <ClassCanvas unitId={unitId} classId={classId} />;
}
