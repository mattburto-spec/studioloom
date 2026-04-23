import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Manrope, DM_Sans } from "next/font/google";
import TeacherDashboardClient from "./TeacherDashboardClient";

/* ================================================================
 * /teacher/dashboard/v2 — Bold redesign, build-time preview.
 *
 * Gated by the `tl_v2` cookie (set to `1` to opt in). Teachers
 * without the cookie get redirected to the shipped dashboard so
 * this route is invisible to them during the build.
 *
 * Cookie is dropped at Phase 8 cutover, after which `/teacher/dashboard`
 * itself renders this component and `/teacher/dashboard/v2` stops
 * existing (tracker: docs/projects/teacher-dashboard-v1.md).
 * ================================================================ */

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

export default async function TeacherDashboardV2Page() {
  const cookieStore = await cookies();
  if (cookieStore.get("tl_v2")?.value !== "1") {
    redirect("/teacher/dashboard");
  }
  return (
    <div className={`${manrope.variable} ${dmSans.variable}`}>
      <TeacherDashboardClient />
    </div>
  );
}
