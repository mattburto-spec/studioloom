"use client";

/**
 * Fallback client wrapper for the legacy canvas URL.
 *
 * Only reached when the server-side class lookup in the parent
 * page.tsx fails (RLS edge case / network). Renders <ClassCanvas />
 * directly with the legacy unitId + classId so the user is not
 * blocked. Once every inbound link has migrated to the slug URL
 * (B.5) this file can be deleted along with the legacy route.
 *
 * DT canvas Package B.4 (17 May 2026).
 */

import { ClassCanvas } from "@/components/teacher/class-hub/ClassCanvas";

export default function LegacyCanvasClient({
  unitId,
  classId,
}: {
  unitId: string;
  classId: string;
}) {
  return <ClassCanvas unitId={unitId} classId={classId} />;
}
