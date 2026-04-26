/**
 * Phase 8.1d-20: stable class-name → hex color mapping for the
 * fabricator dashboard.
 *
 * The redesign uses a per-class color stripe + chip throughout (job
 * cards, lane rows, done-today strip). We don't store a color on
 * the `classes` table yet — adding a column for purely-visual
 * chrome felt premature. Instead we hash the class name to a slot
 * in a fixed 8-color palette: deterministic across requests, no
 * DB change, teachers don't get to pick. If they want control,
 * file `PH9-FU-CLASS-COLOR-COLUMN` and add `classes.color` then.
 *
 * The palette is intentionally distinct in hue + roughly equal in
 * lightness so adjacent classes (e.g. "9 Design" + "10 Design")
 * don't both end up red. Avoids brand purple — that belongs to
 * the action accents (CTAs, focus rings).
 */

/** 8 distinct hues, balanced for the dark fabricator surface. */
const PALETTE = [
  "#8B5CF6", // violet
  "#06B6D4", // cyan
  "#F59E0B", // amber
  "#EF4444", // red
  "#10B981", // emerald
  "#EC4899", // pink
  "#3B82F6", // blue
  "#14B8A6", // teal
] as const;

const FALLBACK = "#6E6A60"; // ink-3 — used for null/empty class names

/**
 * Stable djb2-style hash → palette index. Deterministic and
 * portable; we don't need crypto strength, just spread. Two calls
 * with the same input always return the same color.
 */
function hashClassName(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    // h * 33 ^ ch — classic djb2.
    h = ((h << 5) + h) ^ name.charCodeAt(i);
  }
  // >>> 0 forces unsigned, then modulo into the palette range.
  return (h >>> 0) % PALETTE.length;
}

/**
 * Resolve a class name to a palette colour. Falls back to a muted
 * neutral for null/whitespace input so the UI never renders a
 * stray color it can't explain.
 */
export function colorForClassName(name: string | null | undefined): string {
  if (!name) return FALLBACK;
  const trimmed = name.trim();
  if (trimmed.length === 0) return FALLBACK;
  return PALETTE[hashClassName(trimmed)];
}

/**
 * Same colour at low alpha — used for chip backgrounds where the
 * border + text use the saturated colour and the fill is a tint.
 * 0x22 ≈ 13% alpha matches the design's `${color}22` convention.
 */
export function colorTintForClassName(
  name: string | null | undefined,
  alpha: "subtle" | "soft" = "subtle"
): string {
  const c = colorForClassName(name);
  if (c === FALLBACK) {
    return alpha === "soft" ? "rgba(110,106,96,0.18)" : "rgba(110,106,96,0.10)";
  }
  // Append alpha as a 2-digit hex suffix. 0x22 = 34/255 ≈ 13%
  // (subtle); 0x33 = 51/255 ≈ 20% (soft, used on hover / selection).
  return alpha === "soft" ? `${c}33` : `${c}22`;
}
