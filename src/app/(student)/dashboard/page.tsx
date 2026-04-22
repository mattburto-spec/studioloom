import { Manrope, DM_Sans } from "next/font/google";
import DashboardClient from "./DashboardClient";

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

export default function DashboardPage() {
  return (
    <div className={`${manrope.variable} ${dmSans.variable}`}>
      <DashboardClient />
    </div>
  );
}
