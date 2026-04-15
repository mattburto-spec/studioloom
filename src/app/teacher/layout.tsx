"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TeacherContext } from "./teacher-context";
import TeacherAIFAB from "@/components/teacher/TeacherAIFAB";
import { BugReportButton } from "@/components/shared/BugReportButton";
import type { Teacher } from "@/types";

/**
 * Bare auth-flow pages: render without the teacher chrome AND are exempt
 * from the "no user → /teacher/login" and "onboarded_at IS NULL → /teacher/welcome"
 * redirects. Each of these pages handles its own session state internally.
 *
 *   /teacher/login            — credential entry, no session yet.
 *   /teacher/welcome          — onboarding wizard, session set but onboarded_at NULL.
 *   /teacher/forgot-password  — password-reset request, works logged-in or out.
 *   /teacher/set-password     — set/change password (invite, recovery, self-service);
 *                               has its own session guard.
 */
const PUBLIC_TEACHER_PATHS: readonly string[] = [
  "/teacher/login",
  "/teacher/welcome",
  "/teacher/forgot-password",
  "/teacher/set-password",
];

function isPublicTeacherPath(pathname: string): boolean {
  return PUBLIC_TEACHER_PATHS.includes(pathname);
}

const NAV_ITEMS = [
  { href: "/teacher/dashboard", label: "Dashboard", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )},
  { href: "/teacher/classes", label: "Classes", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )},
  { href: "/teacher/units", label: "Units", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  )},
  { href: "/teacher/toolkit", label: "Toolkit", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M12 4v16" /><path d="M2 12h20" />
    </svg>
  )},
  { href: "/teacher/safety", label: "Badges", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )},
  { href: "/teacher/safety/alerts", label: "Alerts", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )},
  { href: "/teacher/students", label: "Students", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )},
  { href: "/teacher/library", label: "Library", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )},
];

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [criticalAlertCount, setCriticalAlertCount] = useState(0);

  useEffect(() => {
    async function loadTeacher() {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError && authError.message !== "Auth session missing!") {
          console.error("[TeacherLayout] Auth error:", authError.message);
        }

        if (!user) {
          // Don't trap users who are legitimately on a bare auth-flow page.
          if (!isPublicTeacherPath(pathname)) {
            router.push("/teacher/login");
          }
          setLoading(false);
          return;
        }

        const { data: teacherData, error: teacherError } = await supabase
          .from("teachers")
          .select("*")
          .eq("id", user.id)
          .single();

        if (teacherError) {
          console.error("[TeacherLayout] Teacher query error:", teacherError.message);
        }

        setTeacher(teacherData);

        // Phase 1B: first-login detector. If the teacher hasn't finished the
        // welcome wizard, redirect them there on every request. The wizard
        // itself (and all bare auth-flow pages) must render without this
        // redirect or the teacher would be trapped — critically, the
        // /teacher/set-password step that the invite callback routes to.
        // See migration 083.
        if (
          teacherData &&
          !teacherData.onboarded_at &&
          !isPublicTeacherPath(pathname)
        ) {
          router.push("/teacher/welcome");
          return;
        }

        // Phase 6B: count unreviewed critical alerts for nav badge
        const { count } = await supabase
          .from("student_content_moderation_log")
          .select("id", { count: "exact", head: true })
          .eq("teacher_reviewed", false)
          .eq("severity", "critical");
        setCriticalAlertCount(count || 0);
      } catch (err) {
        console.error("[TeacherLayout] Unexpected error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTeacher();
  }, [router, pathname]);

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

  // Bare-render any of the public auth-flow pages without the header /
  // nav — these screens manage their own visual chrome.
  if (isPublicTeacherPath(pathname)) {
    return (
      <TeacherContext.Provider value={{ teacher }}>
        {children}
      </TeacherContext.Provider>
    );
  }

  const isSettingsActive = pathname.startsWith("/teacher/settings");

  return (
    <TeacherContext.Provider value={{ teacher }}>
      <div className="min-h-screen bg-surface-alt">
        {/* Header */}
        <header
          className="sticky top-0 z-30 border-b"
          style={{
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderColor: "rgba(0,0,0,0.06)",
          }}
        >
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            {/* Left: brand + nav */}
            <div className="flex items-center gap-8">
              <Link href="/teacher/dashboard" className="flex items-center gap-2">
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

              <nav className="flex items-center gap-1">
                {(() => {
                  // Longest-prefix match so nested routes (e.g. /teacher/safety/alerts)
                  // don't also activate their parent (e.g. /teacher/safety for Badges).
                  const activeHref = NAV_ITEMS
                    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
                    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
                  return NAV_ITEMS.map((item) => {
                    const isActive = item.href === activeHref;
                    return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150"
                      style={{
                        color: isActive ? "#7B2FF2" : "#6B7280",
                        background: isActive ? "rgba(123,47,242,0.08)" : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "rgba(0,0,0,0.04)";
                          e.currentTarget.style.color = "#1A1A2E";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "#6B7280";
                        }
                      }}
                    >
                      <span style={{ opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
                      {item.label}
                      {item.href === "/teacher/safety/alerts" && criticalAlertCount > 0 && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: "18px",
                            height: "18px",
                            padding: "0 5px",
                            borderRadius: "9px",
                            fontSize: "11px",
                            fontWeight: 700,
                            lineHeight: 1,
                            color: "#fff",
                            background: "#DC2626",
                          }}
                        >
                          {criticalAlertCount}
                        </span>
                      )}
                    </Link>
                    );
                  });
                })()}
              </nav>
            </div>

            {/* Right: settings + user + logout */}
            <div className="flex items-center gap-2">
              <Link
                href="/teacher/settings"
                className="p-2 rounded-lg transition-colors duration-150"
                style={{
                  color: isSettingsActive ? "#7B2FF2" : "#9CA3AF",
                  background: isSettingsActive ? "rgba(123,47,242,0.08)" : "transparent",
                }}
                title="Settings"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </Link>
              <div className="w-px h-5 bg-border mx-1" />
              <span className="text-sm text-text-secondary">{teacher?.name}</span>
              <button
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  window.location.href = "/";
                }}
                className="text-sm text-text-secondary/60 hover:text-text-primary transition-colors px-2 py-1 rounded-lg hover:bg-surface-alt"
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        {children}
        <TeacherAIFAB />
        <BugReportButton role="teacher" />
      </div>
    </TeacherContext.Provider>
  );
}
