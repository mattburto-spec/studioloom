"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TeacherContext } from "./teacher-context";
import TeacherAIFAB from "@/components/teacher/TeacherAIFAB";
import type { Teacher } from "@/types";

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
  { href: "/teacher/students", label: "Students", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )},
  { href: "/teacher/knowledge", label: "Knowledge", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
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

  useEffect(() => {
    async function loadTeacher() {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError && authError.message !== "Auth session missing!") {
          console.error("[TeacherLayout] Auth error:", authError.message);
        }

        if (!user) {
          if (pathname !== "/teacher/login") {
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

  if (pathname === "/teacher/login") {
    return <>{children}</>;
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
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname.startsWith(item.href);
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
                    </Link>
                  );
                })}
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
      </div>
    </TeacherContext.Provider>
  );
}
