"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StudentContext } from "./student-context";
import { StudentAvatar } from "@/components/student/StudentAvatar";
import { QuickToolFAB } from "@/components/toolkit/QuickToolFAB";
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
      <div className="min-h-screen flex items-center justify-center bg-surface-alt">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <StudentContext.Provider value={{ student, classInfo }}>
      <div className="min-h-screen bg-surface-alt">
        <header
          className="sticky top-0 z-30 border-b"
          style={{
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderColor: "rgba(0,0,0,0.06)",
          }}
        >
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
              >
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                  <rect x="2" y="8" width="28" height="5" rx="2.5" fill="white" />
                  <rect x="2" y="19" width="28" height="5" rx="2.5" fill="white" />
                  <rect x="8" y="2" width="5" height="28" rx="2.5" fill="white" />
                  <rect x="19" y="2" width="5" height="28" rx="2.5" fill="white" />
                </svg>
              </div>
              <span className="font-bold text-text-primary text-sm tracking-tight">StudioLoom</span>
            </Link>

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
                  <span className="text-text-primary font-medium">
                    {student.display_name || student.username}
                  </span>
                </div>
              )}
              <button
                onClick={async () => {
                  await fetch("/api/auth/student-session", { method: "DELETE" });
                  router.push("/login");
                }}
                className="text-text-secondary/50 hover:text-text-primary transition-colors px-2 py-1 rounded-lg hover:bg-surface-alt"
              >
                Log out
              </button>
            </div>
          </div>
        </header>
        {children}

        {/* QuickToolFAB — available on all student pages */}
        <QuickToolFAB />
      </div>
    </StudentContext.Provider>
  );
}
