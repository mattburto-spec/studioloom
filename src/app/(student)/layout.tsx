"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { StudentContext } from "./student-context";
// QuickToolFAB import removed 23 Apr 2026 — Matt's call, was floating on
// every student route including /fabrication/* where it didn't belong.
// Component file preserved for future re-integration via a unified surface.
import { StudioSetup } from "@/components/student/StudioSetup";
import { BugReportButton } from "@/components/shared/BugReportButton";
import { WrongRoleBanner } from "@/components/shared/WrongRoleBanner";
import { BoldTopNav } from "@/components/student/BoldTopNav";
import { BellCountContext } from "@/components/student/BellCountContext";
import { SidebarSlotContext } from "@/components/student/SidebarSlotContext";
import { TapAWordProvider } from "@/components/student/tap-a-word/TapAWordProvider";
import { getThemeStyles, type ThemeId } from "@/lib/student/themes";
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
  // Bug 1.5: per-route classInfo override. When the URL contains a
  // /unit/[unitId]/... segment, we ask the server which class the
  // student is doing this unit IN and display that class in the topnav
  // — even when it differs from the session-default class. Cached by
  // unitId so navigating between pages of the same unit doesn't re-fetch.
  const [unitClassByUnitId, setUnitClassByUnitId] = useState<Record<string, Class | null>>({});
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // BoldTopNav bell badge — Dashboard sets this via context after its
  // insights fetch. Other routes leave it at 0 for now.
  const [bellCount, setBellCount] = useState(0);
  const [bellItems, setBellItems] = useState<
    import("@/components/student/BellCountContext").NotificationItem[]
  >([]);

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

  // Bug 1.5: when the URL is /unit/[unitId]/..., resolve the class that
  // owns this unit (server-verified via class_units × class_students). One
  // fetch per unitId; cached locally so revisiting the same unit is free.
  // The Class displayed in the topnav follows the URL — fixes multi-class
  // students seeing the wrong class label.
  const UNIT_RE = /^\/unit\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const urlUnitId = useMemo(() => {
    const m = pathname?.match(UNIT_RE);
    return m?.[1] ?? null;
  }, [pathname]);

  useEffect(() => {
    if (!urlUnitId) return;
    if (urlUnitId in unitClassByUnitId) return; // cached (incl. resolved-to-null)
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/student/me/unit-context?unitId=${encodeURIComponent(urlUnitId)}`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const body = (await res.json()) as { class: Class | null };
        if (!cancelled) {
          setUnitClassByUnitId((prev) => ({ ...prev, [urlUnitId]: body.class }));
        }
      } catch {
        // Silent fail — topnav falls back to session classInfo.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlUnitId, unitClassByUnitId]);

  // The class the topnav + StudentContext expose: unit-derived when on a
  // unit route AND we've resolved it; session-default otherwise. Keeps a
  // safe fallback (null derives → session) so the UI never goes blank
  // mid-fetch.
  const effectiveClassInfo: Class | null = useMemo(() => {
    if (urlUnitId && unitClassByUnitId[urlUnitId]) {
      return unitClassByUnitId[urlUnitId];
    }
    return classInfo;
  }, [urlUnitId, unitClassByUnitId, classInfo]);

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
    onboardingPicks: string[];
  }) => {
    try {
      await fetch("/api/student/studio-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentor_id: data.mentorId,
          theme_id: data.themeId,
          onboarding_picks: data.onboardingPicks,
        }),
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
    // Warm-paper Bold loading screen — matches the lesson page palette so
    // students don't get a cold gray-on-purple flash before their workspace
    // mounts. Uses literal hex values because .sl-v2 .lesson-bold tokens
    // aren't in scope yet (BoldTopNav hasn't injected the scoped <style>).
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#F5F1EA" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 rounded-full animate-spin"
            style={{
              border: "2px solid #E5DFD2",
              borderTopColor: "#0F0E0C",
            }}
          />
          <span className="text-sm font-semibold" style={{ color: "#413D36" }}>
            Loading…
          </span>
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
    <StudentContext.Provider value={{ student, classInfo: effectiveClassInfo }}>
      <BellCountContext.Provider
        value={{
          count: bellCount,
          setCount: setBellCount,
          items: bellItems,
          setItems: setBellItems,
        }}
      >
        <SidebarSlotContext.Provider value={{ handler: sidebarHandler, setHandler: setSidebarHandler }}>
        <TapAWordProvider>
        <div className="sl-v2">
          <BoldTopNav
            student={student}
            classInfo={effectiveClassInfo}
            loading={false}
            bellCount={bellCount}
            onOpenSettings={() => setShowSettings(true)}
            onLogout={handleLogout}
          />
          {/* FU-AV2-WRONG-ROLE-TOAST: surfaces when middleware Phase 6.3b
              or the TeacherLayout/SchoolLayout fail-closed fix bounces a
              wrong-role session here with ?wrong_role=1. Render BETWEEN
              the top nav and the page content so the banner appears in
              the content column, not above the chrome. */}
          <WrongRoleBanner role="student" />
          {children}

          {/* QuickToolFAB removed 23 Apr 2026 — was floating on every
              student route (including /fabrication/*) where it didn't
              belong. Design Tools access will return via the /my-tools
              route or a future unified tools surface. */}

          {/* Bug report button — always available for students */}
          <BugReportButton role="student" classId={effectiveClassInfo?.id} />

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

                {/* Theme picker removed in v1 — theme auto-derives from
                    chosen mentor (see lib/student/onboarding-images.ts →
                    MENTOR_THEME_MAP). v2 (Designer Mentor System) restores
                    per-designer theme assignment. */}

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
        </TapAWordProvider>
        </SidebarSlotContext.Provider>
      </BellCountContext.Provider>
    </StudentContext.Provider>
  );
}
