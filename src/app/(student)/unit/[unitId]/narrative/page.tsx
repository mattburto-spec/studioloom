import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
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
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) redirect("/");

  const supabase = createAdminClient();

  // Validate session
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) redirect("/");

  // Get student info
  const { data: student } = await supabase
    .from("students")
    .select("class_id, display_name, username")
    .eq("id", session.student_id)
    .single();

  if (!student) redirect("/");

  // Get the unit
  const { data: unit } = await supabase
    .from("units")
    .select("*")
    .eq("id", unitId)
    .single();

  if (!unit) redirect("/dashboard");

  // Check safety badge requirements for this unit
  const { data: badgeRequirements } = await supabase
    .from("unit_badge_requirements")
    .select(`
      badge_id,
      is_required,
      badges (
        id, name, slug
      )
    `)
    .eq("unit_id", unitId);

  if (badgeRequirements && badgeRequirements.length > 0) {
    const requiredBadges = badgeRequirements.filter((r: any) => r.is_required);
    if (requiredBadges.length > 0) {
      const badgeIds = requiredBadges.map((r: any) => (r.badges as any)?.id).filter(Boolean);
      const { data: studentBadges } = await supabase
        .from("student_badges")
        .select("badge_id, status, expires_at")
        .eq("student_id", session.student_id)
        .in("badge_id", badgeIds);

      const now = new Date();
      const unmetBadges = requiredBadges.filter((req: any) => {
        const badge = req.badges as any;
        const sb = (studentBadges || []).find((s: any) => s.badge_id === badge.id);
        if (!sb || sb.status !== "active") return true;
        if (sb.expires_at && new Date(sb.expires_at) < now) return true;
        return false;
      });

      if (unmetBadges.length > 0) {
        return (
          <div style={{ minHeight: "100vh", background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ maxWidth: 480, width: "100%", padding: "32px 24px", textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#FDE68A", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "#92400E", marginBottom: 8 }}>Safety Tests Required</h1>
              <p style={{ fontSize: 14, color: "#A16207", marginBottom: 24 }}>
                You need to pass the following safety tests before you can access this unit.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                {unmetBadges.map((req: any) => {
                  const badge = req.badges as any;
                  return (
                    <a
                      key={badge.id}
                      href={`/safety/${badge.id}`}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 16px", background: "white", borderRadius: 12,
                        border: "2px solid #FDE68A", textDecoration: "none",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "#1F2937", fontSize: 14 }}>{badge.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#D97706", background: "#FEF3C7", padding: "4px 10px", borderRadius: 6 }}>Take Test</span>
                    </a>
                  );
                })}
              </div>
              <a href="/dashboard" style={{ fontSize: 14, color: "#7C3AED", textDecoration: "none", fontWeight: 500 }}>
                ← Back to Dashboard
              </a>
            </div>
          </div>
        );
      }
    }
  }

  // Get all progress + portfolio entries for this student + unit
  const [{ data: progress }, { data: portfolioEntries }] = await Promise.all([
    supabase
      .from("student_progress")
      .select("*")
      .eq("student_id", session.student_id)
      .eq("unit_id", unitId),
    supabase
      .from("portfolio_entries")
      .select("*")
      .eq("student_id", session.student_id)
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

  // Get ordered pages and build narrative sections (with portfolio filtering)
  const allPages = getPageList(unit.content_data);
  const sections = buildNarrativeSections(allPages, allProgress);

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
