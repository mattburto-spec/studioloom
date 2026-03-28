"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// Code-split: LessonEditor (12 components, ~4,000 lines)
// Only loaded when teacher opens the class-local content editor
const LessonEditor = dynamic(
  () => import("@/components/teacher/lesson-editor/LessonEditor"),
  {
    ssr: false,
    loading: () => (
      <div style={{ minHeight: "100vh", background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "48px", height: "48px", border: "4px solid #E5E7EB",
            borderTop: "4px solid #7C3AED", borderRadius: "50%", margin: "0 auto",
            animation: "spin 1s linear infinite"
          }} />
          <p style={{ fontSize: "16px", color: "#9CA3AF", fontWeight: 500, marginTop: "12px" }}>Loading editor...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    ),
  }
);

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
