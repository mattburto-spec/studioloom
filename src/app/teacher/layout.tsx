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
    { href: "/teacher/units", label: "Units" },
  ];

  return (
    <TeacherContext.Provider value={{ teacher }}>
      <div className="min-h-screen bg-surface-alt">
        <header className="bg-dark-blue text-white">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="font-bold">Questerra</span>
              <nav className="flex gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-md text-sm transition ${
                      pathname.startsWith(item.href)
                        ? "bg-white/20 text-white"
                        : "text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3 text-sm">
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
