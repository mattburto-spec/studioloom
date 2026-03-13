"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TeacherContext } from "./teacher-context";
import type { Teacher } from "@/types";

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
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        if (pathname !== "/teacher/login") {
          router.push("/teacher/login");
        }
        setLoading(false);
        return;
      }

      const { data: teacherData } = await supabase
        .from("teachers")
        .select("*")
        .eq("id", user.id)
        .single();

      setTeacher(teacherData);
      setLoading(false);
    }
    loadTeacher();
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-text-secondary">Loading...</div>
      </div>
    );
  }

  // Don't show nav on login page
  if (pathname === "/teacher/login") {
    return <>{children}</>;
  }

  const navItems = [
    { href: "/teacher/dashboard", label: "Dashboard" },
    { href: "/teacher/units", label: "Unit Gallery", exact: true },
    { href: "/teacher/units/create", label: "Unit Builder" },
    { href: "/teacher/activity-cards", label: "Activities" },
    { href: "/teacher/knowledge", label: "Knowledge" },
  ];

  const isSettingsActive = pathname.startsWith("/teacher/settings");

  return (
    <TeacherContext.Provider value={{ teacher }}>
      <div className="min-h-screen bg-surface-alt">
        <header className="gradient-hero text-white">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="font-bold">StudioLoom</span>
              <nav className="flex gap-1">
                {navItems.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href || (pathname.startsWith(item.href + "/") && !pathname.startsWith("/teacher/units/create"))
                    : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-3 py-1.5 rounded-md text-sm transition ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Link
                href="/teacher/settings"
                className={`p-1.5 rounded-md transition ${
                  isSettingsActive
                    ? "bg-white/20 text-white"
                    : "text-white/50 hover:text-white hover:bg-white/10"
                }`}
                title="Settings"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </Link>
              <span className="text-white/70">{teacher?.name}</span>
              <button
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  router.push("/teacher/login");
                }}
                className="text-white/50 hover:text-white"
              >
                Log out
              </button>
            </div>
          </div>
        </header>
        {children}
      </div>
    </TeacherContext.Provider>
  );
}
