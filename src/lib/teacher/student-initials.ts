// ---------------------------------------------------------------------------
// studentInitials — avatar derivation that doesn't collide
// (DT canvas Phase 3.6 Step 3, 16 May 2026)
// ---------------------------------------------------------------------------
// The canvas student-grid avatar used to be `(display_name?.[0] ||
// username?.[0] || "?").toUpperCase()` — a single character. Two students
// with usernames starting "H" (HH + HP in CO2 Dragsters #2) both rendered
// as a single "H" and were indistinguishable at a glance. This helper
// widens to 2 chars when available and prefers the first letter of each
// word when the display_name has multiple words.
//
//   "Henry Park"     → HP    (first letter of each word)
//   "Bea Martinez"   → BM    (same)
//   "Alex"           → AL    (first 2 chars, single-word display_name)
//   "HH" / "hh"      → HH    (username fallback, 2-char)
//   "z"              → Z     (username fallback, 1-char)
//   ""               → ?     (empty-state)
//
// Lifted to its own module (from inline at the top of page.tsx) so
// StudentDrawer + StudentRosterDrawer can adopt the same logic and so
// vitest can import it cleanly (page.tsx isn't import-safe from test
// files because it carries `"use client"` JSX).
// ---------------------------------------------------------------------------

export function studentInitials(
  displayName: string | null | undefined,
  username: string | null | undefined,
): string {
  const dn = (displayName ?? "").trim();
  if (dn) {
    const words = dn.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return dn.slice(0, 2).toUpperCase();
  }
  const un = (username ?? "").trim();
  if (un) return un.slice(0, 2).toUpperCase();
  return "?";
}
