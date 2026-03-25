/**
 * Mesh Gradient Generator
 *
 * Creates ElevenLabs-style organic mesh gradients using overlapping
 * radial gradients. Each class gets a deterministic but visually rich
 * abstract background based on its index.
 *
 * Technique: 4-5 large radial-gradient blobs positioned at different
 * points, using the class's primary color plus complementary/analogous
 * tones. No blur filter needed — the radial gradients themselves are
 * soft enough.
 */

// ── Color palette per class (primary + 2-3 accent hues) ──────────────────
// Each entry: [primary, accent1, accent2, accent3]
// Designed to feel warm/organic like ElevenLabs, not flat/corporate.
const MESH_PALETTES: string[][] = [
  // 0 – blue: sky blue + lavender + soft pink + pale peach
  ["#4F8BF9", "#818CF8", "#C084FC", "#F9A8D4"],
  // 1 – emerald: mint + teal + soft lime + warm yellow
  ["#34D399", "#2DD4BF", "#86EFAC", "#FDE68A"],
  // 2 – amber: golden + peach + rose + soft orange
  ["#FBBF24", "#FB923C", "#F472B6", "#FCA5A5"],
  // 3 – purple: violet + indigo + pink + soft blue
  ["#A78BFA", "#818CF8", "#F472B6", "#C4B5FD"],
  // 4 – pink: hot pink + rose + peach + lavender
  ["#F472B6", "#FB7185", "#FDBA74", "#C4B5FD"],
  // 5 – cyan: aqua + sky + mint + soft lilac
  ["#22D3EE", "#38BDF8", "#6EE7B7", "#A5B4FC"],
  // 6 – orange: tangerine + coral + golden + rose
  ["#FB923C", "#F97316", "#FBBF24", "#FDA4AF"],
  // 7 – indigo: deep blue + violet + soft pink + periwinkle
  ["#818CF8", "#6366F1", "#C084FC", "#F9A8D4"],
];

interface MeshGradientStyle {
  background: string;
  // For cards that also need a text-safe overlay
  overlay?: string;
}

/**
 * Generate a mesh gradient CSS background string for a given class index.
 *
 * @param classIdx - The class index (mod 8 for palette selection)
 * @param seed - Optional extra seed for variation (e.g., unitId hash)
 * @returns CSS background property value
 */
export function getMeshGradient(classIdx: number, seed = 0): MeshGradientStyle {
  const palette = MESH_PALETTES[classIdx % MESH_PALETTES.length];
  const [c1, c2, c3, c4] = palette;

  // Deterministic position offsets based on seed
  const s = ((seed * 7 + classIdx * 13) % 40) - 20; // -20 to +20

  const background = [
    // Base fill — slightly lighter version of primary
    `radial-gradient(ellipse 120% 120% at ${15 + s}% ${15 + s}%, ${c1}EE 0%, transparent 60%)`,
    // Top-right accent blob
    `radial-gradient(ellipse 100% 90% at ${80 - s}% ${20 + s * 0.5}%, ${c2}DD 0%, transparent 55%)`,
    // Bottom-left warm blob
    `radial-gradient(ellipse 90% 110% at ${25 + s * 0.5}% ${80 - s}%, ${c3}CC 0%, transparent 50%)`,
    // Bottom-right subtle glow
    `radial-gradient(ellipse 80% 80% at ${75 - s * 0.3}% ${75 + s * 0.3}%, ${c4}BB 0%, transparent 50%)`,
    // Center soft fill to avoid harsh white gaps
    `radial-gradient(ellipse 140% 140% at 50% 50%, ${c1}44 0%, ${c2}22 50%, transparent 70%)`,
  ].join(", ");

  return { background };
}

/**
 * Get the CSS class color config + mesh gradient for a given class index.
 * Drop-in replacement for the old CLASS_COLORS + getClassColor pattern.
 */
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
