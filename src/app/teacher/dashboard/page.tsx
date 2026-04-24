import TeacherDashboardClient from "./TeacherDashboardClient";

/* /teacher/dashboard — Bold teacher dashboard.
 *
 * Cutover landed 2026-04-24 (Phase 8); universal Bold chrome landed
 * in Phase 11 (2026-04-24) — font loading + TopNav now live in
 * src/app/teacher/layout.tsx via TeacherShell, so this page is just
 * the dashboard body. The pre-Phase-8 1258-line monolith still lives
 * at /teacher/dashboard-legacy as a rollback until ≥ 2026-05-01.
 *
 * Tracker: docs/projects/teacher-dashboard-v1.md.
 */
export default function TeacherDashboardPage() {
  return <TeacherDashboardClient />;
}
