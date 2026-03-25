/**
 * Class Color System
 *
 * Each class gets a rich two-tone gradient with a lighter accent color.
 * Used for class identity panels, icon squares, and badges throughout
 * the teacher dashboard and class management pages.
 *
 * AI-generated mesh gradient images are available in /images/ and
 * /public/images/mesh/ for future use (marketing, heroes, etc.)
 * but are NOT used for class cards — CSS gradients are cleaner and
 * more consistent for UI elements.
 */

export interface ClassColor {
  /** Primary brand color */
  fill: string;
  /** Lighter accent for gradient end / glow */
  accent: string;
  /** Very light tint for backgrounds, badges */
  light: string;
  /** Dark shade for text on light backgrounds */
  text: string;
}

export const CLASS_COLORS: ClassColor[] = [
  { fill: "#3B82F6", accent: "#818CF8", light: "#EFF6FF", text: "#1E40AF" },  // blue → indigo
  { fill: "#10B981", accent: "#2DD4BF", light: "#ECFDF5", text: "#065F46" },  // emerald → teal
  { fill: "#F59E0B", accent: "#FB923C", light: "#FFFBEB", text: "#92400E" },  // amber → orange
  { fill: "#8B5CF6", accent: "#C084FC", light: "#F5F3FF", text: "#5B21B6" },  // purple → violet
  { fill: "#EC4899", accent: "#F472B6", light: "#FDF2F8", text: "#9D174D" },  // pink → rose
  { fill: "#06B6D4", accent: "#38BDF8", light: "#ECFEFF", text: "#155E75" },  // cyan → sky
  { fill: "#F97316", accent: "#FBBF24", light: "#FFF7ED", text: "#9A3412" },  // orange → amber
  { fill: "#6366F1", accent: "#A78BFA", light: "#EEF2FF", text: "#3730A3" },  // indigo → violet
];

export function getClassColor(classIdx: number): ClassColor {
  return CLASS_COLORS[classIdx % CLASS_COLORS.length];
}

/**
 * Get a CSS background string for a class gradient panel.
 * Two-tone diagonal gradient from fill → accent, richer than a single color.
 */
export function getClassGradient(classIdx: number): string {
  const c = CLASS_COLORS[classIdx % CLASS_COLORS.length];
  return `linear-gradient(135deg, ${c.fill} 0%, ${c.accent} 100%)`;
}
