import { Manrope, DM_Sans } from "next/font/google";
import TeacherDashboardClient from "./TeacherDashboardClient";

/* /teacher/dashboard — Bold teacher dashboard.
 *
 * Cutover landed 2026-04-24 (Phase 8 of the teacher-dashboard-v1
 * build). Before cutover this was a 1258-line monolith; that file
 * now lives at /teacher/dashboard-legacy as a one-click rollback
 * and is scheduled for deletion ≥ 2026-05-01 once the Bold version
 * has soaked in prod for a week.
 *
 * Full rebuild tracker: docs/projects/teacher-dashboard-v1.md.
 */

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export default function TeacherDashboardPage() {
  return (
    <div className={`${manrope.variable} ${dmSans.variable}`}>
      <TeacherDashboardClient />
    </div>
  );
}
