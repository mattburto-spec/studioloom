/**
 * Badge thumbnail mapping — maps badge slug to SVG illustration path.
 * SVGs are in /public/badges/ and show stylized workshop tool scenes.
 */

export const BADGE_THUMBNAILS: Record<string, string> = {
  'general-workshop-safety': '/badges/general-workshop-safety.svg',
  'hand-tool-safety': '/badges/hand-tool-safety.svg',
  'wood-workshop': '/badges/wood-workshop.svg',
  'metal-workshop': '/badges/metal-workshop.svg',
  'plastics-composites': '/badges/plastics-composites.svg',
  'electronics-soldering': '/badges/electronics-soldering.svg',
  'digital-fabrication': '/badges/digital-fabrication.svg',
};

/**
 * Get the thumbnail URL for a badge by slug.
 * Returns a default shield icon path if no specific thumbnail exists.
 */
export function getBadgeThumbnail(slug: string): string | null {
  return BADGE_THUMBNAILS[slug] || null;
}
