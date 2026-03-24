"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import LessonEditor from "@/components/teacher/lesson-editor/LessonEditor";

// ---------------------------------------------------------------------------
// Class-Local Unit Editor — Phase 0.5
// ---------------------------------------------------------------------------
// Full lesson editor with drag-and-drop activities, inline editing,
// Workshop Model phases, undo/redo, and auto-save (fork-on-write).
// URL: /teacher/units/[unitId]/class/[classId]/edit
// ---------------------------------------------------------------------------

export default function ClassUnitEditPage({
  params,
}: {
  params: Promise<{ unitId: string; classId: string }>;
}) {
  const { unitId, classId } = use(params);
  const router = useRouter();

  return (
    <LessonEditor
      unitId={unitId}
      classId={classId}
      onBack={() => router.push(`/teacher/units/${unitId}/class/${classId}`)}
    />
  );
}
