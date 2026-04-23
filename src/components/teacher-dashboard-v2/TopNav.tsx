"use client";

import Link from "next/link";
import { useState } from "react";
import type { DashboardClass } from "@/types/dashboard";
import type { Teacher } from "@/types";
import { I } from "./icons";
import { NAV_ITEMS, activeNavHref, classColor, getInitials } from "./nav-config";

interface TopNavProps {
  /** Current teacher — null while TeacherContext resolves. */
  teacher: Teacher | null;
  /** Class list from /api/teacher/dashboard. Empty while loading. */
  classes: DashboardClass[];
  /** Active scope id — "all" or a class id. */
  scope: string;
  onScope: (id: string) => void;
  /** Current pathname for active-link highlighting. Resolved by the
   *  parent (via usePathname) so the nav doesn't double-subscribe. */
  pathname: string;
}

export function TopNav({
  teacher,
  classes,
  scope,
  onScope,
  pathname,
}: TopNavProps) {
  const [open, setOpen] = useState(false);

  // Scope options: "All classes" + one entry per class, colour-keyed
  // by hash(class.id) so colours stay stable across reloads.
  const scopeOptions = [
    { id: "all", name: "All classes", color: "#0A0A0A", icon: "🏠" },
    ...classes.map((c) => ({
      id: c.id,
      name: c.name,
      color: classColor(c.id).color,
      icon: "📓",
    })),
  ];
  const cur = scopeOptions.find((p) => p.id === scope) ?? scopeOptions[0];

  const initials = teacher ? getInitials(teacher.name) : "··";
  const activeHref = activeNavHref(pathname);

  return (
    <header className="sticky top-0 z-30 bg-[var(--bg)]/80 backdrop-blur-lg border-b border-[var(--hair)]">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-4">
        {/* Brand */}
        <Link
          href="/teacher/dashboard/v2"
          className="flex items-center gap-2.5"
        >
          <div className="w-9 h-9 rounded-2xl bg-[var(--ink)] flex items-center justify-center text-white display text-[15px]">
            #
          </div>
          <div className="display text-[17px] leading-none">StudioLoom</div>
        </Link>

        <div className="w-px h-6 bg-[var(--hair)] mx-1" />

        {/* Scope chip — class filter */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 bg-white border border-[var(--hair)] rounded-full pl-2 pr-3 py-1.5 hover:shadow-sm transition"
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[12px]"
              style={{ background: `${cur.color}1a` }}
            >
              {cur.icon}
            </span>
            <span className="text-[12.5px] font-bold">{cur.name}</span>
            <span className="text-[var(--ink-3)]">
              <I name="chev" size={12} s={2.5} />
            </span>
          </button>
          {open && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpen(false)}
              />
              <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl card-shadow-lg w-64 p-1.5 max-h-[60vh] overflow-y-auto">
                {scopeOptions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onScope(p.id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition ${
                      scope === p.id ? "bg-[var(--bg)]" : "hover:bg-[var(--bg)]"
                    }`}
                  >
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[13px]"
                      style={{ background: `${p.color}1a` }}
                    >
                      {p.icon}
                    </span>
                    <span className="flex-1 text-[12.5px] font-bold">
                      {p.name}
                    </span>
                    {scope === p.id && <I name="check" size={13} s={2.5} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-0.5 ml-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold transition ${
                  isActive
                    ? "bg-[var(--ink)] text-white"
                    : "text-[var(--ink-2)] hover:bg-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Right */}
        <button
          className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--ink-2)]"
          aria-label="Search"
        >
          <I name="search" size={16} />
        </button>
        <button
          className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--ink-2)] relative"
          aria-label="Notifications"
        >
          <I name="bell" size={16} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E86F2C] border-2 border-[var(--bg)]" />
        </button>
        <div className="flex items-center gap-2 pl-1">
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9333EA] to-[#E86F2C] text-white flex items-center justify-center font-bold text-[11px]"
            title={teacher?.name ?? undefined}
          >
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
