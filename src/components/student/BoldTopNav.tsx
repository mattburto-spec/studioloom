"use client";

/* ================================================================
 * BoldTopNav — unified top navigation for every (student) route.
 *
 * Originally lived inside src/app/(student)/dashboard/DashboardClient.tsx
 * during the Phase 1-9 build of the Bold dashboard. Extracted in
 * Phase 10 so every student route (/dashboard, /unit/*, /gallery/*,
 * /safety/*, /my-tools/*, /discovery/*, /open-studio/*) shares the
 * same nav instead of having a split look.
 *
 * Also exports the shared Icon component used by the dashboard's
 * content sections. Scoped CSS (.sl-v2) injected on mount — make
 * sure layout.tsx wraps children in a div with className="sl-v2" so
 * these vars apply throughout the student shell.
 * ================================================================ */

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Student } from "@/types";
import { useSidebarSlot } from "./SidebarSlotContext";
import { CommandPalette } from "@/components/search/CommandPalette";

// ================= SESSION STUDENT =================

export type SessionStudent = {
  name: string;
  first: string;
  initials: string;
  avatarGrad: string;
  classTag: string | null;
};

const AVATAR_GRADS = [
  "from-[#E86F2C] to-[#EC4899]",
  "from-[#0EA5A4] to-[#3B82F6]",
  "from-[#9333EA] to-[#E86F2C]",
  "from-[#EC4899] to-[#F59E0B]",
  "from-[#10B981] to-[#0EA5A4]",
  "from-[#6366F1] to-[#9333EA]",
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function gradFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADS[Math.abs(hash) % AVATAR_GRADS.length];
}

export const STUDENT_MOCK: SessionStudent = {
  name: "Sam",
  first: "Sam",
  initials: "SM",
  avatarGrad: "from-[#E86F2C] to-[#EC4899]",
  classTag: "Year 7 · Design",
};

/** Derive a SessionStudent view-model from the raw Student object held in
 *  StudentContext. Falls back to STUDENT_MOCK if the context hasn't
 *  resolved yet (preview / scaffold mode). */
export function studentToSession(
  student: Student | null,
  className?: string | null,
): SessionStudent {
  if (!student) return STUDENT_MOCK;
  const name = student.display_name?.trim() || student.username;
  const first = name.split(/\s+/)[0];
  return {
    name,
    first,
    initials: getInitials(name),
    avatarGrad: gradFor(name),
    classTag: className ?? null,
  };
}

// ================= ICONS =================

export type IconName =
  | "arrow" | "play" | "check" | "chev" | "chevR" | "plus" | "more"
  | "bell" | "search" | "alert" | "clock" | "shield" | "star" | "book"
  | "wrench" | "bolt" | "print" | "flame" | "trophy" | "msg" | "sparkle"
  | "gear" | "logout" | "menu";

export function Icon({ name, size = 16, s = 2 }: { name: IconName; size?: number; s?: number }) {
  const p = {
    strokeWidth: s,
    stroke: "currentColor",
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
  };
  const shapes: Record<IconName, JSX.Element> = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    play:  <path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none" />,
    check: <path d="M20 6L9 17l-5-5" />,
    chev:  <path d="M6 9l6 6 6-6" />,
    chevR: <path d="M9 6l6 6-6 6" />,
    plus:  <path d="M12 5v14M5 12h14" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1.5" fill="currentColor" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <circle cx="19" cy="12" r="1.5" fill="currentColor" />
      </>
    ),
    bell:  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" />
      </>
    ),
    alert: <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    star:   <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
    book:   <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5V21h15" />,
    wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
    bolt:   <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />,
    print: (
      <>
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </>
    ),
    flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
    trophy: <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M12 15v6M8 21h8M6 4v5a6 6 0 0 0 12 0V4z" />,
    msg:    <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9 8.5 8.5 0 0 1 7.6 4.7 8.4 8.4 0 0 1 .9 3.8z" />,
    sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />,
    gear: (
      <>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </>
    ),
    menu: (
      <>
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </>
    ),
  };
  return <svg {...p}>{shapes[name]}</svg>;
}

// ================= PILL NAV =================

// Pill nav supports three variants:
//   - { anchor } → smooth-scroll to an id on /dashboard; /dashboard#id elsewhere
//   - { route }  → navigate to a dedicated route (supports subroutes for active match)
//   - {}         → disabled "Coming soon"
type NavItem =
  | { label: string; anchor: string }
  | { label: string; route: string }
  | { label: string };

const NAV_S: NavItem[] = [
  { label: "My work",   anchor: "dashboard-hero" },
  { label: "Units",     anchor: "dashboard-units" },
  { label: "Skills",    route:  "/skills" },
  // Preflight Phase 6-6i — lands students on the /fabrication
  // overview (list of their submissions). "+ New submission" CTA on
  // that page jumps to /fabrication/new. Pill highlights across every
  // /fabrication/* subpath via the route + startsWith match below.
  { label: "Preflight", route:  "/fabrication" },
  { label: "Journal"    }, // disabled — Phase 14 notes system
  { label: "Resources"  }, // disabled — Phase 18 resources library
];

// ================= SCOPED STYLES =================
// Injected once on first BoldTopNav mount. The layout wraps everything
// in .sl-v2 so these vars apply across the whole student shell.

const SCOPED_CSS = `
.sl-v2 {
  --sl-bg: #F7F6F2;
  --sl-surface: #FFFFFF;
  --sl-ink: #0A0A0A;
  --sl-ink-2: #3A3A3A;
  --sl-ink-3: #6B6B6B;
  --sl-hair: #E8E6DF;
  --sl-display-tracking: -0.035em;
  font-family: var(--font-dm-sans), system-ui, sans-serif;
  background: var(--sl-bg);
  color: var(--sl-ink);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}
.sl-v2 .display, .sl-v2 .display-lg {
  font-family: var(--font-manrope), system-ui, sans-serif;
  letter-spacing: var(--sl-display-tracking);
  font-weight: 700;
}
.sl-v2 .display-lg { letter-spacing: -0.045em; }
.sl-v2 .tnum { font-variant-numeric: tabular-nums; }
.sl-v2 .cap {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  font-size: 10.5px;
}
.sl-v2 .card-shadow {
  box-shadow: 0 1px 2px rgba(10,10,10,0.04), 0 8px 24px -12px rgba(10,10,10,0.08);
}
.sl-v2 .card-shadow-lg {
  box-shadow: 0 1px 2px rgba(10,10,10,0.04), 0 16px 48px -20px rgba(10,10,10,0.18);
}
.sl-v2 .glow-inner::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: radial-gradient(circle at 20% 15%, rgba(255,255,255,0.28), transparent 55%);
}
.sl-v2 .pulse {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  position: relative;
}
.sl-v2 .pulse::after {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: 999px;
  border: 2px solid currentColor;
  opacity: 0;
  animation: sl-v2-ring 2s ease-out infinite;
}
@keyframes sl-v2-ring {
  0%   { opacity: 0.6; transform: scale(0.6); }
  100% { opacity: 0;   transform: scale(1.8); }
}
.sl-v2 .btn-primary {
  background: var(--sl-ink);
  color: white;
  font-weight: 700;
  letter-spacing: -0.01em;
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.sl-v2 .btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px -12px rgba(10,10,10,0.35);
}
.sl-v2 .ring-track { stroke: var(--sl-hair); }

/* Lesson Bold — warm-paper scope for /unit/[unitId]/[pageId]. Nested inside .sl-v2
   so dashboard + nav styles above stay untouched. Activated by the page wrapper
   adding class="lesson-bold" to its root. */
.sl-v2 .lesson-bold {
  --sl-bg: #F5F1EA;
  --sl-paper: #FDFBF6;
  --sl-ink: #0F0E0C;
  --sl-ink-2: #413D36;
  --sl-ink-3: #8A8477;
  --sl-hair: #E5DFD2;
  --sl-hair-2: #EFE9DB;
  --sl-accent: #E86F2C;
  --sl-phase-default: #9333EA;
  background: var(--sl-bg);
  color: var(--sl-ink);
}
.sl-v2 .lesson-bold .serif-em {
  font-family: var(--font-instrument-serif), "Instrument Serif", serif;
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.01em;
}
.sl-v2 .lesson-bold .card-lb {
  background: var(--sl-paper);
  border: 1px solid var(--sl-hair);
  border-radius: 20px;
}
.sl-v2 .lesson-bold .bar-phase {
  height: 3px;
  border-radius: 3px;
  background: var(--sl-phase-default);
}
`;

function useScopedStyles() {
  useEffect(() => {
    const id = "sl-v2-scoped-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = SCOPED_CSS;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);
}

// ================= TOP NAV =================

export function BoldTopNav({
  student,
  classInfo,
  loading,
  bellCount,
  onOpenSettings,
  onLogout,
}: {
  student: Student | null;
  classInfo: { name: string } | null;
  loading: boolean;
  bellCount: number;
  onOpenSettings?: () => void;
  onLogout?: () => void;
}) {
  useScopedStyles();
  const pathname = usePathname();
  const onDashboard = pathname === "/dashboard";
  const session = studentToSession(student, classInfo?.name);
  const showMock = !student && !loading; // preview / unauthenticated fallback
  const { handler: sidebarHandler } = useSidebarSlot();

  const scrollTo = (anchor: string | null) => {
    if (!anchor) return;
    const el = document.getElementById(anchor);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
  };

  // Avatar dropdown state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
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

  // Command palette state — wired to the search button + ⌘K shortcut.
  // Same shortcut behaviour as the teacher TopNav: skip while typing in
  // inputs/textareas/contentEditable so it doesn't hijack normal typing.
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        const inField =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          (t?.isContentEditable ?? false);
        if (inField && !paletteOpen) return;
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen]);

  const avatarInitials = loading ? "" : showMock ? session.initials : session.initials;
  const avatarGrad = loading ? "from-[#E8E6DF] to-[#D4D1C8]" : session.avatarGrad;

  return (
    <header className="sticky top-0 z-30 bg-[var(--sl-bg)]/80 backdrop-blur-lg border-b border-[var(--sl-hair)]">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-4">
        {/* Mobile-only sidebar hamburger — rendered when a child route
            (currently /unit/*) has registered a handler via SidebarSlotContext. */}
        {sidebarHandler && (
          <button
            onClick={sidebarHandler}
            className="md:hidden w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--sl-ink-2)]"
            aria-label="Open lesson list"
          >
            <Icon name="menu" size={18} />
          </button>
        )}
        <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="Dashboard">
          <div className="w-9 h-9 rounded-2xl bg-[var(--sl-ink)] flex items-center justify-center text-white display text-[15px]">#</div>
          <div className="display text-[17px] leading-none hidden sm:block">StudioLoom</div>
        </Link>
        <div className="w-px h-6 bg-[var(--sl-hair)] mx-1 hidden md:block" />
        {/* Pill nav hides below md — mobile students scroll through sections rather than jump. */}
        <nav className="hidden md:flex items-center gap-0.5">
          {NAV_S.map((n) => {
            const hasAnchor = "anchor" in n;
            const hasRoute = "route" in n;
            const disabled = !hasAnchor && !hasRoute;
            // Active when on the matching route or any subroute (for route
            // pills; e.g. /fabrication/jobs/... lights up Preflight) OR on
            // dashboard for the default "My work" anchor pill.
            const active =
              (hasRoute && (pathname === n.route || pathname.startsWith(n.route + "/") || (n.route === "/fabrication/new" && pathname.startsWith("/fabrication/")))) ||
              (onDashboard && hasAnchor && n.anchor === "dashboard-hero");
            const classNames = `px-3 py-1.5 rounded-full text-[12.5px] font-semibold transition ${
              active
                ? "bg-[var(--sl-ink)] text-white"
                : disabled
                  ? "text-[var(--sl-ink-3)]/50 cursor-not-allowed"
                  : "text-[var(--sl-ink-2)] hover:bg-white"
            }`;
            if (disabled) {
              return (
                <button key={n.label} disabled aria-disabled title="Coming soon" className={classNames}>
                  {n.label}
                </button>
              );
            }
            if (hasRoute) {
              return (
                <Link key={n.label} href={n.route} className={classNames}>
                  {n.label}
                </Link>
              );
            }
            // anchor variant
            if (onDashboard) {
              return (
                <button key={n.label} onClick={() => scrollTo(n.anchor)} className={classNames}>
                  {n.label}
                </button>
              );
            }
            return (
              <Link key={n.label} href={`/dashboard#${n.anchor}`} className={classNames}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <button
          onClick={() => setPaletteOpen(true)}
          className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--sl-ink-2)]"
          aria-label="Search"
          title="Search (⌘K)"
        >
          <Icon name="search" size={16} />
        </button>
        <button
          onClick={() => {
            // On dashboard → smooth scroll to priority queue. Elsewhere → navigate.
            if (onDashboard) {
              scrollTo("dashboard-priority");
            } else {
              window.location.href = "/dashboard#dashboard-priority";
            }
          }}
          className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--sl-ink-2)] relative"
          aria-label={bellCount > 0 ? `${bellCount} urgent items — open priority queue` : "Notifications"}
        >
          <Icon name="bell" size={16} />
          {bellCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#DC2626] border-2 border-[var(--sl-bg)] text-white text-[9px] font-extrabold tnum flex items-center justify-center leading-none">
              {bellCount > 9 ? "9+" : bellCount}
            </span>
          )}
        </button>

        {/* Avatar dropdown — click to reveal Studio Settings + Log out */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2.5 pl-1 rounded-full hover:bg-white transition pr-1 py-1"
            aria-label="Account menu"
            aria-expanded={menuOpen}
          >
            {/* Name + class hidden below sm — just the avatar circle on phones to save width. */}
            <div className="text-right hidden sm:block">
              {loading ? (
                <>
                  <div className="h-3 w-16 rounded bg-[var(--sl-hair)] animate-pulse" />
                  <div className="h-2.5 w-20 rounded bg-[var(--sl-hair)] animate-pulse mt-1" />
                </>
              ) : (
                <>
                  <div className="text-[12px] font-bold leading-none">{session.name}</div>
                  {session.classTag && (
                    <div className="text-[10.5px] text-[var(--sl-ink-3)] mt-0.5 leading-none">{session.classTag}</div>
                  )}
                </>
              )}
            </div>
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGrad} text-white flex items-center justify-center font-bold text-[11px]`}>
              {avatarInitials}
            </div>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl card-shadow-lg border border-[var(--sl-hair)] overflow-hidden">
              {onOpenSettings && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-[13px] font-semibold text-[var(--sl-ink-2)] hover:bg-[var(--sl-bg)]"
                >
                  <Icon name="gear" size={14} /> Studio Settings
                </button>
              )}
              {onLogout && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-[13px] font-semibold text-[var(--sl-ink-2)] hover:bg-[var(--sl-bg)] border-t border-[var(--sl-hair)]"
                >
                  <Icon name="logout" size={14} /> Log out
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        searchUrl="/api/student/search"
      />
    </header>
  );
}
