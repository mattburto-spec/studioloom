"use client";

import { createContext, useContext } from "react";
import type { Teacher } from "@/types";

interface TeacherContextValue {
  teacher: Teacher | null;
}

export const TeacherContext = createContext<TeacherContextValue>({ teacher: null });

export function useTeacher() {
  return useContext(TeacherContext);
}
