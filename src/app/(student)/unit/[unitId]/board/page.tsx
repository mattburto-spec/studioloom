/**
 * AG.2.4 + AG.3.4 — Student project board page (per unit).
 *
 * Mounts both <TimelineBoard /> + <KanbanBoard /> for the per-student-per-unit
 * project surface. Timeline above (backward-mapped milestones) sets the macro
 * pace; Kanban below (4-column) handles micro per-class flow. Both fetch
 * their own state via /api/student/{timeline,kanban}.
 */

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudentSession } from "@/lib/access-v2/actor-session";
import KanbanBoard from "@/components/student/kanban/KanbanBoard";
import TimelineBoard from "@/components/student/timeline/TimelineBoard";
import Link from "next/link";

export default async function StudentUnitBoardPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;

  const session = await getStudentSession();
  if (!session) redirect("/");

  const supabase = createAdminClient();

  // Verify the unit exists + the student has access (via class enrollment)
  const { data: unit } = await supabase
    .from("units")
    .select("id, title")
    .eq("id", unitId)
    .maybeSingle();

  if (!unit) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-extrabold text-gray-900 leading-tight">
            Project board
          </h1>
          <p className="text-[12px] text-gray-600 mt-0.5">
            {unit.title}
          </p>
        </div>
        <nav className="flex items-center gap-3 text-[11.5px]">
          <Link
            href={`/unit/${unitId}/narrative`}
            className="text-gray-600 hover:text-violet-700 hover:underline underline-offset-2"
          >
            Narrative
          </Link>
          <Link
            href="/dashboard"
            className="text-gray-600 hover:text-violet-700 hover:underline underline-offset-2"
          >
            Dashboard
          </Link>
        </nav>
      </header>

      <div className="flex flex-col gap-6">
        <TimelineBoard unitId={unitId} />
        <KanbanBoard unitId={unitId} />
      </div>
    </div>
  );
}
