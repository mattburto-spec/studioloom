/* Nav item registry for the Bold teacher TopNav.
 *
 * `active` logic: longest-prefix match against the current pathname
 * so nested routes (e.g. /teacher/safety/alerts) activate the most
 * specific nav item (Alerts) rather than both Alerts *and* Badges.
 * Same pattern as src/app/teacher/layout.tsx NAV_ITEMS (the legacy
 * nav) — kept in sync until Phase 8 cutover, after which the legacy
 * list can be deleted.
 *
 * The Dashboard href points at /teacher/dashboard/v2 during the build
 * so clicks inside the Bold shell don't kick the user back to the
 * legacy dashboard. Swap to /teacher/dashboard at Phase 8 cutover.
 */

export interface NavItem {
  label: string;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/teacher/dashboard/v2" },
  { label: "Classes",   href: "/teacher/classes" },
  { label: "Units",     href: "/teacher/units" },
  { label: "Toolkit",   href: "/teacher/toolkit" },
  { label: "Badges",    href: "/teacher/safety" },
  { label: "Alerts",    href: "/teacher/safety/alerts" },
  { label: "Students",  href: "/teacher/students" },
  { label: "Library",   href: "/teacher/library" },
];

/** Find the nav item whose href is the longest prefix of the current
 *  pathname. Returns null if no item matches (e.g. on an unrelated
 *  route temporarily rendering this nav).
 */
export function activeNavHref(pathname: string): string | null {
  let best: NavItem | null = null;
  for (const item of NAV_ITEMS) {
    const matches =
      pathname === item.href || pathname.startsWith(item.href + "/");
    if (!matches) continue;
    if (!best || item.href.length > best.href.length) {
      best = item;
    }
  }
  return best?.href ?? null;
}

// ---------------------------------------------------------------------------
// Avatar helpers — lifted from BoldTopNav (student v2). Shared DNA means
// the two dashboards derive consistent colors from the same hash seed.
// ---------------------------------------------------------------------------

/** Initials: first + last letter when we have a multi-word name,
 *  else the first two letters. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return "??";
}

// ---------------------------------------------------------------------------
// Class color palette — stable per class via hash(class.id).
// Matches the Bold palette used throughout teacher_bold.jsx.
// ---------------------------------------------------------------------------

const CLASS_COLORS: ReadonlyArray<{ color: string; tint: string }> = [
  { color: "#0EA5A4", tint: "#CCFBF1" }, // teal
  { color: "#10B981", tint: "#D1FAE5" }, // emerald
  { color: "#E86F2C", tint: "#FED7AA" }, // orange
  { color: "#9333EA", tint: "#E9D5FF" }, // purple
  { color: "#EC4899", tint: "#FCE7F3" }, // pink
  { color: "#3B82F6", tint: "#DBEAFE" }, // blue
  { color: "#F59E0B", tint: "#FEF3C7" }, // amber
  { color: "#06B6D4", tint: "#CFFAFE" }, // cyan
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function classColor(classId: string): {
  color: string;
  tint: string;
} {
  return CLASS_COLORS[hashString(classId) % CLASS_COLORS.length];
}
