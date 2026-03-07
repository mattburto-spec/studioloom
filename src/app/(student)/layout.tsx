"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StudentContext } from "./student-context";
import type { Student, Class } from "@/types";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/student-session");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setStudent(data.student);
        setClassInfo(data.student.classes);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <StudentContext.Provider value={{ student, classInfo }}>
      <div className="min-h-screen bg-surface-alt">
        <header className="bg-white border-b border-border">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <span className="font-bold text-dark-blue">Questerra</span>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-text-secondary">
                {student?.display_name || student?.username}
              </span>
              <button
                onClick={async () => {
                  await fetch("/api/auth/student-session", { method: "DELETE" });
                  router.push("/login");
                }}
                className="text-text-secondary hover:text-text-primary"
              >
                Log out
              </button>
            </div>
          </div>
        </header>
        {children}
      </div>
    </StudentContext.Provider>
  );
}
