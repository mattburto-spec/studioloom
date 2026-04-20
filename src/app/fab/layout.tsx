/**
 * Fabricator layout wrapper.
 *
 * Minimal by design — Fabricators are busy lab techs, the UI should be a
 * single column of big hit targets. No sidebar, no analytics clutter.
 * Dark workshop feel, not the teacher purple gradient.
 */

import type { ReactNode } from "react";

export const metadata = {
  title: "Preflight — Fabricator",
  description: "Scan queue and pickup for StudioLoom Preflight fabrication jobs.",
};

export default function FabLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      {children}
    </div>
  );
}
