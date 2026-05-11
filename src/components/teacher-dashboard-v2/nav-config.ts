/* Nav item registry for the Bold teacher TopNav.
 *
 * `active` logic: longest-prefix match against the current pathname
 * so nested routes (e.g. /teacher/safety/alerts) activate the most
 * specific nav item (Alerts) rather than both Alerts *and* Badges.
 * Mirrors the pattern in src/app/teacher/layout.tsx NAV_ITEMS — both
 * still exist post-cutover: layout.tsx renders the legacy chrome on
 * everything except /teacher/dashboard (the Bold shell brings its
 * own TopNav). The legacy NAV_ITEMS is deleted when dashboard-legacy
 * is removed.
 */

export type NavItem =
  | {
      label: string;
      href: string;
      /** Extra paths that should also light up this nav item as
       *  "active" (longest-prefix match). Used for the TFL.3 inbox
       *  rewire — "Marking" links to /teacher/inbox but still
       *  highlights when the teacher deep-dives into the legacy
       *  /teacher/marking cohort page. */
      alsoActiveOn?: string[];
      disabled?: false;
    }
  | { label: string; disabled: true };

/** Primary nav. Matches the shipped legacy teacher layout on main as
 *  of 2026-04-24 — Toolkit / Badges / Library moved into the avatar
 *  dropdown, Skills added, Resources stays as a disabled "SOON" pill
 *  until Phase 18. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/teacher/dashboard" },
  { label: "Classes",   href: "/teacher/classes" },
  // TFL.3 C.1 polish (12 May 2026): "Marking" points at the new
  // /teacher/inbox surface — the daily-driver approve-and-go view.
  // The legacy /teacher/marking page (cohort heatmap + calibrate)
  // is still reachable via the "Marking page →" link inside the
  // inbox header. alsoActiveOn keeps the nav item highlighted
  // when the teacher deep-dives — no "lost" active state.
  {
    label: "Marking",
    href: "/teacher/inbox",
    alsoActiveOn: ["/teacher/marking"],
  },
  { label: "Units",     href: "/teacher/units" },
  { label: "Students",  href: "/teacher/students" },
  { label: "Skills",    href: "/teacher/skills" },
  { label: "Resources", disabled: true },
  { label: "Preflight", href: "/teacher/preflight" },
];

/** Secondary items surfaced inside the avatar dropdown. Parked here
 *  until the teacher redesign reshuffles (comment in the shipped
 *  legacy layout calls this out as temporary). */
export interface DropdownItem {
  label: string;
  href: string;
}

export const DROPDOWN_ITEMS: DropdownItem[] = [
  { label: "Toolkit", href: "/teacher/toolkit" },
  { label: "Badges",  href: "/teacher/safety" },
  { label: "Library", href: "/teacher/library" },
];

/** Find the nav item whose href is the longest prefix of the current
 *  pathname. Returns null if no item matches (e.g. on an unrelated
 *  route temporarily rendering this nav, or on the disabled
 *  Resources pill). */
export function activeNavHref(pathname: string): string | null {
  let best: { href: string; matchLen: number } | null = null;
  for (const item of NAV_ITEMS) {
    if (item.disabled) continue;
    // Primary href + any alsoActiveOn paths share the same match
    // semantics (exact OR prefix). We track the matched path's
    // length for longest-prefix tie-breaking, but the RETURN value
    // is always the item's primary href so callers can map back
    // to NAV_ITEMS unambiguously.
    const candidates = [item.href, ...(item.alsoActiveOn ?? [])];
    let bestPathForItem: string | null = null;
    for (const p of candidates) {
      const matches = pathname === p || pathname.startsWith(p + "/");
      if (!matches) continue;
      if (!bestPathForItem || p.length > bestPathForItem.length) {
        bestPathForItem = p;
      }
    }
    if (!bestPathForItem) continue;
    if (!best || bestPathForItem.length > best.matchLen) {
      best = { href: item.href, matchLen: bestPathForItem.length };
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
