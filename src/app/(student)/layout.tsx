"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { StudentContext } from "./student-context";
import { QuickToolFAB } from "@/components/toolkit/QuickToolFAB";
import { StudioSetup } from "@/components/student/StudioSetup";
import { BugReportButton } from "@/components/shared/BugReportButton";
import { BoldTopNav } from "@/components/student/BoldTopNav";
import { BellCountContext } from "@/components/student/BellCountContext";
import { SidebarSlotContext } from "@/components/student/SidebarSlotContext";
import { getThemeStyles, type ThemeId, THEMES } from "@/lib/student/themes";
import { MENTORS, type MentorId } from "@/lib/student/mentors";
import type { Student, Class } from "@/types";

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

  // BoldTopNav bell badge — Dashboard sets this via context after its
  // insights fetch. Other routes leave it at 0 for now.
  const [bellCount, setBellCount] = useState(0);

  // BoldTopNav mobile hamburger — /unit/[id]/layout.tsx registers a handler
  // to open its lesson drawer; other routes leave it null (no button shown).
  const [sidebarHandler, setSidebarHandler] = useState<(() => void) | null>(null);

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
  }, [router]);

  // Theme styles retained for the Studio Settings modal which still paints
  // against the legacy --st-* vars. All non-modal content in the student
  // shell now renders against the Bold cream palette (--sl-* vars) via the
  // .sl-v2 wrapper below.
  const themeStyles = useMemo(() => {
    const themeId = (student as any)?.theme_id as ThemeId | null;
    return getThemeStyles(themeId);
  }, [student]);

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
      await fetch("/api/student/studio-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentor_id: data.mentorId, theme_id: data.themeId }),
      });

      if (data.learningProfile) {
        await fetch("/api/student/learning-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data.learningProfile),
        });
      }

      setStudent((prev) =>
        prev
          ? { ...prev, mentor_id: data.mentorId, theme_id: data.themeId, learning_profile: data.learningProfile } as any
          : prev
      );
      setShowOnboarding(false);
    } catch (err) {
      console.error("[studio-setup] Save failed:", err);
      setShowOnboarding(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/student-session", { method: "DELETE" });
    router.push("/login");
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
      <BellCountContext.Provider value={{ count: bellCount, setCount: setBellCount }}>
        <SidebarSlotContext.Provider value={{ handler: sidebarHandler, setHandler: setSidebarHandler }}>
        <div className="sl-v2">
          <BoldTopNav
            student={student}
            classInfo={classInfo}
            loading={false}
            bellCount={bellCount}
            onOpenSettings={() => setShowSettings(true)}
            onLogout={handleLogout}
          />
          {children}

          {/* QuickToolFAB — available on all student pages except the dashboard */}
          {pathname !== "/dashboard" && <QuickToolFAB />}

          {/* Bug report button — always available for students */}
          <BugReportButton role="student" classId={classInfo?.id} />

          {/* Settings modal — quick mentor/theme switcher.
              Intentionally keeps the legacy --st-* themed surfaces since it
              still exposes the theme picker. When theme system is fully
              retired (or re-done as part of Bold), this modal can move
              over to the Bold palette. */}
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
                              // eslint-disable-next-line @next/next/no-img-element
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
        </SidebarSlotContext.Provider>
      </BellCountContext.Provider>
    </StudentContext.Provider>
  );
}
