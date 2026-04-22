"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { StudentContext } from "./student-context";
import { StudentAvatar } from "@/components/student/StudentAvatar";
import { QuickToolFAB } from "@/components/toolkit/QuickToolFAB";
import { StudioSetup } from "@/components/student/StudioSetup";
import { BugReportButton } from "@/components/shared/BugReportButton";
import { getThemeStyles, type ThemeId, THEMES } from "@/lib/student/themes";
import { MENTORS, type MentorId } from "@/lib/student/mentors";
import type { Student, Class } from "@/types";

/** Inline gear icon — project doesn't use lucide-react */
const GearIcon = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [student, setStudent] = useState<Student | null>(null);
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // v2 scaffold opts out of auth during Phase 1
    if (pathname === "/dashboard/v2") {
      setLoading(false);
      return;
    }
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
        // Only trigger when mentor_id is explicitly null (column exists, not set)
        // — not when it's undefined (pre-migration 050, column doesn't exist yet)
        if ("mentor_id" in data.student && data.student.mentor_id === null) {
          setShowOnboarding(true);
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, [router, pathname]);

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

  // v2 dashboard is scaffold-only during Phase 1 — opts out of the student shell
  // (no auth redirect, no header, no onboarding). It renders its own nav.
  // Remove this escape hatch in Phase 8 when v2 becomes the real /dashboard.
  if (pathname === "/dashboard/v2") {
    return <>{children}</>;
  }

  return (
    <StudentContext.Provider value={{ student, classInfo }}>
      <div className="min-h-screen" style={{ ...themeStyles, background: themeStyles["--st-bg"] }}>
        <header
          className="sticky top-0 z-50 border-b"
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
                onClick={() => setShowSettings(true)}
                className="p-1.5 rounded-lg transition-opacity hover:opacity-100"
                style={{ opacity: 0.5, color: themeStyles["--st-header-text"] }}
                title="Studio settings"
              >
                <GearIcon size={16} />
              </button>
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

        {/* QuickToolFAB — available on all student pages except dashboard */}
        {pathname !== "/dashboard" && <QuickToolFAB />}

        {/* Bug report button — always available for students */}
        <BugReportButton role="student" classId={classInfo?.id} />

        {/* Settings modal — quick mentor/theme switcher */}
        {showSettings && student && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
          >
            <div
              className="w-full max-w-md rounded-2xl p-6 shadow-xl"
              style={{ background: themeStyles["--st-surface"], color: themeStyles["--st-text"] }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Studio Settings</h2>
                <button onClick={() => setShowSettings(false)} className="p-1 rounded-lg opacity-50 hover:opacity-100">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Current mentor */}
              <div className="mb-4">
                <label className="text-xs font-semibold uppercase tracking-wider opacity-60">Your Mentor</label>
                <div className="flex gap-2 mt-2">
                  {(Object.values(MENTORS) as { id: MentorId; name: string; emoji: string; image: string | null; accent: string; tagline: string }[]).map((m) => {
                    const isActive = (student as any).mentor_id === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={async () => {
                          await fetch("/api/student/studio-preferences", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ mentor_id: m.id }),
                          });
                          setStudent((prev) => prev ? { ...prev, mentor_id: m.id } as any : prev);
                        }}
                        className="flex-1 p-3 rounded-xl text-center transition-all"
                        style={{
                          border: isActive ? `2px solid ${m.accent}` : "2px solid transparent",
                          background: isActive ? `${m.accent}18` : themeStyles["--st-bg"],
                        }}
                      >
                        <div className="text-2xl mb-1">
                          {m.image ? (
                            <img src={m.image} alt={m.name} className="w-10 h-10 rounded-lg object-cover mx-auto" />
                          ) : (
                            m.emoji
                          )}
                        </div>
                        <div className="text-sm font-semibold">{m.name}</div>
                        <div className="text-xs opacity-60">{m.tagline}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Current theme */}
              <div className="mb-6">
                <label className="text-xs font-semibold uppercase tracking-wider opacity-60">Visual Theme</label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {(Object.values(THEMES) as { id: ThemeId; name: string; preview: { accent: string; bg: string } }[]).map((t) => {
                    const isActive = (student as any).theme_id === t.id;
                    const isDarkTheme = ["dark", "neon", "vapor", "cyber", "ocean"].includes(t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={async () => {
                          await fetch("/api/student/studio-preferences", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ theme_id: t.id }),
                          });
                          setStudent((prev) => prev ? { ...prev, theme_id: t.id } as any : prev);
                        }}
                        className="p-3 rounded-xl text-center transition-all"
                        style={{
                          border: isActive ? `2px solid ${t.preview.accent}` : "2px solid transparent",
                          background: t.preview.bg,
                        }}
                      >
                        <div
                          className="w-6 h-6 rounded-full mx-auto mb-1"
                          style={{ background: t.preview.accent }}
                        />
                        <div className="text-xs font-semibold" style={{ color: isDarkTheme ? "#fff" : "#333" }}>
                          {t.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Re-run full setup */}
              <button
                onClick={() => {
                  setShowSettings(false);
                  setShowOnboarding(true);
                }}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{
                  background: themeStyles["--st-bg"],
                  color: themeStyles["--st-text-secondary"],
                  border: `1px solid ${themeStyles["--st-border"]}`,
                }}
              >
                Redo full Studio Setup
              </button>
            </div>
          </div>
        )}
      </div>
    </StudentContext.Provider>
  );
}
