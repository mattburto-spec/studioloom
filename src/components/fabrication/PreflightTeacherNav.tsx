"use client";

/**
 * PreflightTeacherNav — Phase 8-4/5 follow-up (PH8-FU-LAB-SETUP-NAV).
 *
 * A persistent tab strip at the top of every `/teacher/preflight/*`
 * page. Gives teachers one-click access to the three core surfaces
 * regardless of which one they landed on first:
 *
 *   Queue       — /teacher/preflight         (Phase 6)
 *   Lab setup   — /teacher/preflight/lab-setup (Phase 8-4)
 *   Fabricators — /teacher/preflight/fabricators (Phase 1B-2)
 *
 * Design: active tab underlined + coloured. Non-active tabs are
 * muted. Mobile: same layout, wraps naturally.
 *
 * Replaces the ad-hoc header buttons that lived on /teacher/preflight
 * and the `← Back to Lab setup` link on /teacher/preflight/fabricators.
 * Pages now mount <PreflightTeacherNav /> at the top instead.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavTab {
  href: string;
  label: string;
  /** Match predicate — `true` when this tab should render as active
   *  given the current pathname. More precise than `startsWith` alone
   *  because /teacher/preflight is a prefix of every tab's href. */
  isActive: (pathname: string) => boolean;
}

const TABS: NavTab[] = [
  {
    href: "/teacher/preflight",
    label: "Queue",
    // Active on the root /teacher/preflight only — subpaths are their
    // own tabs. Also covers /teacher/preflight/jobs/[jobId] (detail).
    isActive: (p) =>
      p === "/teacher/preflight" || p.startsWith("/teacher/preflight/jobs"),
  },
  {
    href: "/teacher/preflight/lab-setup",
    label: "Lab setup",
    isActive: (p) => p.startsWith("/teacher/preflight/lab-setup"),
  },
  {
    href: "/teacher/preflight/fabricators",
    label: "Fabricators",
    isActive: (p) => p.startsWith("/teacher/preflight/fabricators"),
  },
];

export function PreflightTeacherNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Preflight sections"
      className="border-b border-gray-200 mb-6"
    >
      <ul className="flex items-center gap-1 -mb-px overflow-x-auto">
        {TABS.map((tab) => {
          const active = tab.isActive(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={
                  "inline-block px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap " +
                  (active
                    ? "border-brand-purple text-brand-purple font-semibold"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300")
                }
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
