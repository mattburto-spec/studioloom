import { Manrope, DM_Sans, Instrument_Serif } from "next/font/google";

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

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export default function UnitTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${manrope.variable} ${dmSans.variable} ${instrumentSerif.variable}`}>
      {children}
    </div>
  );
}
