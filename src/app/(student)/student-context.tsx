"use client";

import { createContext, useContext } from "react";
import type { Student, Class } from "@/types";

interface StudentContextValue {
  student: Student | null;
  classInfo: Class | null;
}

export const StudentContext = createContext<StudentContextValue>({
  student: null,
  classInfo: null,
});

export function useStudent() {
  return useContext(StudentContext);
}
