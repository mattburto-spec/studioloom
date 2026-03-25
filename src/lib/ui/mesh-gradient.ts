/**
 * Mesh Gradient System
 *
 * AI-generated mesh gradient images (ChatGPT gpt-image-1) for class
 * identity panels throughout StudioLoom. Each class index maps to a
 * rich, saturated, painterly abstract background.
 *
 * Images live in /public/images/mesh/ as optimized WebP (~120KB each).
 * Original PNGs stored in /images/ for future use (other site areas,
 * marketing, etc.).
 *
 * Usage:
 *   getMeshGradientImage(classIdx) → "/images/mesh/mesh-0-blue.webp"
 *   getMeshGradientStyle(classIdx) → { backgroundImage, backgroundSize, backgroundPosition }
 */

// ── Image paths (indexed 0-7, wraps via modulo) ──────────────────────────
const MESH_IMAGES = [
  "/images/mesh/mesh-0-blue.webp",
  "/images/mesh/mesh-1-emerald.webp",
  "/images/mesh/mesh-2-amber.webp",
  "/images/mesh/mesh-3-purple.webp",
  "/images/mesh/mesh-4-pink.webp",
  "/images/mesh/mesh-5-cyan.webp",
  "/images/mesh/mesh-6-orange.webp",
  "/images/mesh/mesh-7-indigo.webp",
];

/**
 * Get the mesh gradient image path for a given class index.
 */
export function getMeshGradientImage(classIdx: number): string {
  return MESH_IMAGES[classIdx % MESH_IMAGES.length];
}

/**
 * Get a complete inline style object for applying a mesh gradient
 * as a background image on an element. Covers the element fully.
 */
export function getMeshGradientStyle(classIdx: number): React.CSSProperties {
  return {
    backgroundImage: `url(${MESH_IMAGES[classIdx % MESH_IMAGES.length]})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

// ── Class color palette (for text colors, light backgrounds, etc.) ───────
export const CLASS_COLORS = [
  { fill: "#3B82F6", light: "#EFF6FF", text: "#1E40AF" },  // blue
  { fill: "#10B981", light: "#ECFDF5", text: "#065F46" },  // emerald
  { fill: "#F59E0B", light: "#FFFBEB", text: "#92400E" },  // amber
  { fill: "#8B5CF6", light: "#F5F3FF", text: "#5B21B6" },  // purple
  { fill: "#EC4899", light: "#FDF2F8", text: "#9D174D" },  // pink
  { fill: "#06B6D4", light: "#ECFEFF", text: "#155E75" },  // cyan
  { fill: "#F97316", light: "#FFF7ED", text: "#9A3412" },  // orange
  { fill: "#6366F1", light: "#EEF2FF", text: "#3730A3" },  // indigo
];

export function getClassColor(classIdx: number) {
  return CLASS_COLORS[classIdx % CLASS_COLORS.length];
}
