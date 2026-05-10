import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudentSession } from "@/lib/access-v2/actor-session";
import { getPageList } from "@/lib/unit-adapter";
import { buildNarrativeSections } from "@/lib/narrative-utils";
import { NarrativeView } from "@/components/portfolio/NarrativeView";
import type { StudentProgress, PortfolioEntry } from "@/types";

// Forward mapping for pre-migration-011 fallback
const NUMBER_TO_PAGE_ID: Record<number, string> = {
  1: "A1", 2: "A2", 3: "A3", 4: "A4",
  5: "B1", 6: "B2", 7: "B3", 8: "B4",
  9: "C1", 10: "C2", 11: "C3", 12: "C4",
  13: "D1", 14: "D2", 15: "D3", 16: "D4",
};

export default async function NarrativePage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;

  // Phase 6.1 — Supabase Auth via sb-* cookies (legacy table dropped).
  const session = await getStudentSession();
  if (!session) redirect("/");

  const supabase = createAdminClient();

  const { data: student } = await supabase
    .from("students")
    .select("class_id, display_name, username")
    .eq("id", session.studentId)
    .single();

  if (!student) redirect("/");

  // Get the unit
  const { data: unit } = await supabase
    .from("units")
    .select("*")
    .eq("id", unitId)
    .single();

  if (!unit) redirect("/dashboard");

  // Safety badge requirements are tracked but do NOT block unit access.
  // Teachers check completion status on their dashboard instead.

  // Get all progress + portfolio entries for this student + unit
  const [{ data: progress }, { data: portfolioEntries }] = await Promise.all([
    supabase
      .from("student_progress")
      .select("*")
      .eq("student_id", session.studentId)
      .eq("unit_id", unitId),
    supabase
      .from("portfolio_entries")
      .select("*")
      .eq("student_id", session.studentId)
      .eq("unit_id", unitId)
      .order("created_at", { ascending: true }),
  ]);

  // Normalize progress — ensure page_id exists on every record
  const rawProgress = (progress || []) as unknown as Record<string, unknown>[];
  const allProgress: StudentProgress[] = rawProgress.map((p) => {
    if (!p.page_id && p.page_number) {
      return { ...p, page_id: NUMBER_TO_PAGE_ID[p.page_number as number] || `page_${p.page_number}` } as unknown as StudentProgress;
    }
    return p as unknown as StudentProgress;
  });

  // Get ordered pages and build narrative sections (with portfolio
  // filtering). LIS.E — pass portfolioEntries so sections the student
  // manually sent to portfolio surface in Narrative even when the
  // section itself doesn't carry portfolioCapture: true.
  const allPages = getPageList(unit.content_data);
  const sections = buildNarrativeSections(
    allPages,
    allProgress,
    (portfolioEntries || []) as PortfolioEntry[],
  );

  const studentName = student.display_name || student.username;

  // Calculate date range from progress + portfolio entries
  const dates = [
    ...allProgress.map((p) => p.updated_at),
    ...(portfolioEntries || []).map((e) => e.created_at),
  ]
    .filter(Boolean)
    .sort();
  const dateRange =
    dates.length > 0
      ? {
          start: dates[0],
          end: dates[dates.length - 1],
        }
      : null;

  // First page ID for "Back to unit" link
  const firstPageId = allPages.length > 0 ? allPages[0].id : null;

  return (
    <NarrativeView
      unitTitle={unit.title}
      unitDescription={unit.description}
      studentName={studentName}
      sections={sections}
      portfolioEntries={(portfolioEntries || []) as PortfolioEntry[]}
      dateRange={dateRange}
      unitId={unitId}
      firstPageId={firstPageId}
    />
  );
}
