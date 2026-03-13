"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StudentContext } from "./student-context";
import { StudentAvatar } from "@/components/student/StudentAvatar";
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
        <header className="gradient-hero text-white">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <span className="font-bold text-white">StudioLoom</span>
            <div className="flex items-center gap-3 text-sm">
              {student && (
                <div className="flex items-center gap-2">
                  <StudentAvatar
                    student={student}
                    size={30}
                    editable
                    onAvatarChange={(newUrl) => {
                      setStudent((prev) =>
                        prev ? { ...prev, avatar_url: newUrl || null } : prev
                      );
                    }}
                  />
                  <span className="text-white/80 font-medium">
                    {student.display_name || student.username}
                  </span>
                </div>
              )}
              <button
                onClick={async () => {
                  await fetch("/api/auth/student-session", { method: "DELETE" });
                  router.push("/login");
                }}
                className="text-white/50 hover:text-white transition"
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
