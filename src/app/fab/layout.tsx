/**
 * Fabricator layout wrapper.
 *
 * Minimal by design — Fabricators are busy lab techs, the UI should be a
 * single column of big hit targets. No sidebar, no analytics clutter.
 * Dark workshop feel, not the teacher purple gradient.
 *
 * Phase 8.1d-20: Manrope + Instrument Serif italic + JetBrains Mono
 * loaded here so the queue page (and future fab subpages) inherit
 * the new typography without each page wiring its own font tag.
 * Uses next/font for self-host + zero CLS — the prototype's
 * `<link>` to fonts.googleapis would add a network hop per page in
 * prod. Body classes still use system-ui everywhere outside
 * /fab/* via the unscoped `bg-slate-950` wrapper below.
 */

import type { ReactNode } from "react";
import { Manrope, Instrument_Serif, JetBrains_Mono } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata = {
  title: "Preflight — Fabricator",
  description: "Scan queue and pickup for StudioLoom Preflight fabrication jobs.",
};

export default function FabLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${manrope.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} min-h-screen bg-slate-950 text-slate-100 antialiased`}
    >
      {children}
    </div>
  );
}
