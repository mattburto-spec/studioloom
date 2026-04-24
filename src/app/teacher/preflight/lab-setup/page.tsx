/**
 * /teacher/preflight/lab-setup — Phase 8-4 visual lab admin page.
 *
 * Click-based per parent brief §2 Option B. Vertical stack of lab
 * cards, each expandable to a machine grid. Teachers can add / rename
 * / delete labs, add machines (from templates or from scratch), edit
 * specs including the operation colour map for lasers, toggle
 * per-machine approval, and bulk-toggle a whole lab.
 *
 * Fabricator assignments for v1 still flow through the existing
 * `/teacher/preflight/fabricators` page (reachable via the header
 * button). Merging the two pages is a Phase 9 polish pass.
 *
 * Server shell only — all interactive behaviour lives in the
 * "use client" `LabSetupClient` it mounts.
 */

import { LabSetupClient } from "@/components/fabrication/LabSetupClient";

export const metadata = {
  title: "Lab setup · Preflight · StudioLoom",
};

export default function LabSetupPage() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <LabSetupClient />
    </main>
  );
}
