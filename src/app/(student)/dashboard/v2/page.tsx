import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Manrope, DM_Sans } from "next/font/google";
import DashboardV2Client from "./DashboardV2Client";

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

export default async function DashboardV2Page() {
  const cookieStore = await cookies();
  if (cookieStore.get("sl_v2")?.value !== "1") {
    notFound();
  }
  return (
    <div className={`${manrope.variable} ${dmSans.variable}`}>
      <DashboardV2Client />
    </div>
  );
}
