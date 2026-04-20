/**
 * /teacher/preflight/* segment layout.
 *
 * Minimal for Phase 1B-2 — Preflight admin surfaces currently render
 * within the parent teacher chrome. Phase 2 may add a sub-nav here
 * (queue / fabricators / settings).
 */

import type { ReactNode } from "react";

export const metadata = {
  title: "Preflight — StudioLoom",
};

export default function TeacherPreflightLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
