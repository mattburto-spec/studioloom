"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DashboardClass } from "@/types/dashboard";
import type { Teacher } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { I } from "./icons";
import {
  DROPDOWN_ITEMS,
  NAV_ITEMS,
  activeNavHref,
  classColor,
  getInitials,
} from "./nav-config";

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

async function handleLogout() {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // Even if signOut fails, force-navigate — the next page load will
    // trip the middleware and re-send to /teacher/login cleanly.
  }
  window.location.href = "/";
}

export function TopNav({
  teacher,
  classes,
  scope,
  onScope,
  pathname,
}: TopNavProps) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close account menu on outside click. Same pattern as the student
  // BoldTopNav avatar dropdown (~line 316).
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

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
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-16 flex items-center gap-2 md:gap-4">
        {/* Brand */}
        <Link
          href="/teacher/dashboard"
          className="flex items-center gap-2.5 shrink-0"
        >
          <div className="w-9 h-9 rounded-2xl bg-[var(--ink)] flex items-center justify-center text-white display text-[15px]">
            #
          </div>
          <div className="hidden sm:block display text-[17px] leading-none">
            StudioLoom
          </div>
        </Link>

        <div className="hidden md:block w-px h-6 bg-[var(--hair)] mx-1" />

        {/* Scope chip — class filter */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 bg-white border border-[var(--hair)] rounded-full pl-2 pr-3 py-1.5 hover:shadow-sm transition whitespace-nowrap"
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

        {/* Nav — horizontally scrolls on tablet/mobile so all items stay
         *  reachable without a hamburger. Fits inline on desktop
         *  ≥ 1024px with the current 7 items. */}
        <nav className="hidden md:flex items-center gap-0.5 ml-2 overflow-x-auto scrollbar-hide">
          {NAV_ITEMS.map((item) => {
            if (item.disabled) {
              return (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-[12.5px] font-semibold text-[var(--ink-3)]/60 cursor-not-allowed"
                  title="Coming soon"
                >
                  {item.label}
                  <span className="bg-[var(--hair)] text-[var(--ink-3)] rounded-full px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide">
                    SOON
                  </span>
                </span>
              );
            }
            const isActive = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[12.5px] font-semibold transition ${
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
          className="hidden sm:flex w-9 h-9 rounded-full hover:bg-white items-center justify-center text-[var(--ink-2)] shrink-0"
          aria-label="Search"
        >
          <I name="search" size={16} />
        </button>
        <button
          className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--ink-2)] relative shrink-0"
          aria-label="Notifications"
        >
          <I name="bell" size={16} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E86F2C] border-2 border-[var(--bg)]" />
        </button>
        {/* Avatar dropdown — click to reveal Settings + Log out. Same
         *  pattern as the student BoldTopNav. Kept inline in TopNav
         *  rather than a shared component because the two navs have
         *  diverged enough already (scope chip vs. class tag). */}
        <div className="relative pl-1 shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full hover:bg-white transition px-1 py-1"
            aria-label="Account menu"
            aria-expanded={menuOpen}
          >
            {/* Name hidden below sm to save width. */}
            <div className="hidden sm:block text-right">
              {teacher ? (
                <div className="text-[12px] font-bold leading-none">
                  {teacher.name}
                </div>
              ) : (
                <div className="h-3 w-20 rounded bg-[var(--hair)] animate-pulse" />
              )}
            </div>
            <div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-[#9333EA] to-[#E86F2C] text-white flex items-center justify-center font-bold text-[11px]"
              title={teacher?.name ?? undefined}
            >
              {initials}
            </div>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 w-60 bg-white rounded-2xl card-shadow-lg border border-[var(--hair)] overflow-hidden z-50">
              {/* Identity header — matches the legacy dropdown pattern
               *  (name + email). Gives the menu an anchor and
               *  disambiguates multi-account users. */}
              {teacher && (
                <div className="px-4 py-3 border-b border-[var(--hair)]">
                  <div className="text-[13px] font-bold truncate leading-tight">
                    {teacher.name}
                  </div>
                  <div className="text-[11.5px] text-[var(--ink-3)] truncate mt-0.5">
                    {teacher.email}
                  </div>
                </div>
              )}
              <Link
                href="/teacher/settings"
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--ink-2)] hover:bg-[var(--bg)]"
              >
                <I name="gear" size={14} /> Settings
              </Link>
              {/* Parked secondary items (Toolkit / Badges / Library) —
               *  mirrors the shipped legacy dropdown. Moves back into
               *  the top nav once Phase 18 reshuffles. */}
              <div className="border-t border-[var(--hair)]" />
              {DROPDOWN_ITEMS.map((d) => (
                <Link
                  key={d.href}
                  href={d.href}
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--ink-2)] hover:bg-[var(--bg)]"
                >
                  {d.label}
                </Link>
              ))}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--ink-2)] hover:bg-[var(--bg)] border-t border-[var(--hair)]"
              >
                <I name="logout" size={14} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
