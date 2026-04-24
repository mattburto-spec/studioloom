"use client";

/* Shared state the Bold shell exposes to any teacher-page child.
 *
 * Phase 12 only needs { scope, classes } so the dashboard can filter
 * its body by the selected program. Phase 13 will likely add the
 * program-aware view-registry lookup here too.
 *
 * Kept separate from teacher-context.tsx (which carries the auth
 * teacher record) so pages can opt into the shell's derived state
 * without reaching up through the auth layer.
 */

import { createContext, useContext } from "react";
import type { DashboardClass } from "@/types/dashboard";
import type { ProgramMeta } from "./program";

export interface TeacherShellContextValue {
  /** Full class roster as returned by /api/teacher/dashboard. */
  classes: DashboardClass[];
  /** Programs the teacher actually teaches (a subset of PROGRAMS). */
  programs: ProgramMeta[];
  /** "all" or a ProgramId. */
  scope: string;
  setScope: (s: string) => void;
  /** False while the shell's class fetch is still in flight. */
  classesLoaded: boolean;
}

export const TeacherShellContext = createContext<TeacherShellContextValue>({
  classes: [],
  programs: [],
  scope: "all",
  setScope: () => {},
  classesLoaded: false,
});

export function useTeacherShell(): TeacherShellContextValue {
  return useContext(TeacherShellContext);
}
