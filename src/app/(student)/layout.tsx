"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StudentContext } from "./student-context";
import { StudentAvatar } from "@/components/student/StudentAvatar";
import { QuickToolFAB } from "@/components/toolkit/QuickToolFAB";
import { StudioSetup } from "@/components/student/StudioSetup";
import { getThemeStyles, type ThemeId } from "@/lib/student/themes";
import type { MentorId } from "@/lib/student/mentors";
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
  const [showOnboarding, setShowOnboarding] = useState(false);

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

        // Show onboarding if student hasn't picked a mentor yet
        if (!data.student.mentor_id) {
          setShowOnboarding(true);
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [router]);

  // Compute theme styles from student preference
  const themeStyles = useMemo(() => {
    const themeId = (student as any)?.theme_id as ThemeId | null;
    return getThemeStyles(themeId);
  }, [student]);

  const isDarkTheme = (student as any)?.theme_id === "dark";

  // Handle onboarding completion
  const handleOnboardingComplete = async (data: {
    mentorId: MentorId;
    themeId: ThemeId;
    learningProfile: {
      languages_at_home: string[];
      countries_lived_in: string[];
      design_confidence: 1 | 2 | 3 | 4 | 5;
      working_style: "solo" | "partner" | "small_group";
      feedback_preference: "private" | "public";
      learning_differences: string[];
    } | null;
  }) => {
    try {
      // Save studio preferences (mentor + theme)
      await fetch("/api/student/studio-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentor_id: data.mentorId, theme_id: data.themeId }),
      });

      // Save learning profile if provided
      if (data.learningProfile) {
        await fetch("/api/student/learning-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data.learningProfile),
        });
      }

      // Update local state
      setStudent((prev) =>
        prev
          ? { ...prev, mentor_id: data.mentorId, theme_id: data.themeId, learning_profile: data.learningProfile } as any
          : prev
      );
      setShowOnboarding(false);
    } catch (err) {
      console.error("[studio-setup] Save failed:", err);
      // Still dismiss onboarding — can retry later via settings
      setShowOnboarding(false);
    }
  };

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

  // Show onboarding overlay
  if (showOnboarding && student) {
    return (
      <StudioSetup
        studentName={student.display_name || student.username}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  return (
    <StudentContext.Provider value={{ student, classInfo }}>
      <div className="min-h-screen" style={{ ...themeStyles, background: themeStyles["--st-bg"] }}>
        <header
          className="sticky top-0 z-30 border-b"
          style={{
            background: themeStyles["--st-header-bg"],
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderColor: themeStyles["--st-border"],
          }}
        >
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${themeStyles["--st-accent"]}, ${themeStyles["--st-accent"]}CC)` }}
              >
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                  <rect x="2" y="8" width="28" height="5" rx="2.5" fill="white" />
                  <rect x="2" y="19" width="28" height="5" rx="2.5" fill="white" />
                  <rect x="8" y="2" width="5" height="28" rx="2.5" fill="white" />
                  <rect x="19" y="2" width="5" height="28" rx="2.5" fill="white" />
                </svg>
              </div>
              <span className="font-bold text-sm tracking-tight" style={{ color: themeStyles["--st-header-text"] }}>
                StudioLoom
              </span>
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
                  <span className="font-medium" style={{ color: themeStyles["--st-header-text"] }}>
                    {student.display_name || student.username}
                  </span>
                </div>
              )}
              <button
                onClick={async () => {
                  await fetch("/api/auth/student-session", { method: "DELETE" });
                  router.push("/login");
                }}
                className="px-2 py-1 rounded-lg transition-colors"
                style={{ color: themeStyles["--st-text-secondary"], opacity: 0.6 }}
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
