/**
 * Discovery Engine — Image Asset Registry
 *
 * Maps asset IDs to file paths in /public/discovery/
 * When images haven't been generated yet (not in /public/discovery/), components fall back
 * to CSS gradients (backgrounds) or emoji (icons).
 *
 * Art direction: Another World (Éric Chahi) flat-polygon style.
 * @see docs/specs/discovery-engine-image-prompts.md
 */

// ─── Station Backgrounds ────────────────────────────────────────
export const STATION_BACKGROUNDS: Record<number, string> = {
  0: '/discovery/backgrounds/s0-foyer.png',
  1: '/discovery/backgrounds/s1-campfire.png',
  2: '/discovery/backgrounds/s2-workshop.png',
  3: '/discovery/backgrounds/s3-collection.png',
  4: '/discovery/backgrounds/s4-window.png',
  5: '/discovery/backgrounds/s5-toolkit.png',
  6: '/discovery/backgrounds/s6-crossroads.png',
  7: '/discovery/backgrounds/s7-launchpad.png',
};

// ─── Kit Expressions ────────────────────────────────────────────
// Batch 1-3: encouraging, thinking, excited, gentle available
// Batch 4+: neutral (pending)
export const KIT_EXPRESSIONS: Record<string, string> = {
  neutral: '/discovery/kit/neutral.png',         // not yet generated
  encouraging: '/discovery/kit/encouraging.png',
  thinking: '/discovery/kit/thinking.png',
  excited: '/discovery/kit/excited.png',
  gentle: '/discovery/kit/gentle.png',
};

// ─── S0 Tool Icons ──────────────────────────────────────────────
// Batch 2-3: 12 images generated. Mapped to Station0 content IDs where possible.
// Exact matches: hammer, paintbrush, pencil, microscope, camera, laptop
// Remapped: ruler→compass_drawing, microphone→megaphone, chart→clipboard
// Unmatched content IDs (emoji fallback): magnifying_glass, gear, scissors
// Extra generated images (available for future tools): lightning, puzzle, seedling
export const TOOL_ICONS: Record<string, string> = {
  hammer: '/discovery/tools/hammer.png',
  paintbrush: '/discovery/tools/paintbrush.png',
  pencil: '/discovery/tools/pencil.png',
  microscope: '/discovery/tools/microscope.png',
  camera: '/discovery/tools/camera.png',
  laptop: '/discovery/tools/laptop.png',
  compass_drawing: '/discovery/tools/ruler.png',      // ruler image → drawing compass
  megaphone: '/discovery/tools/microphone.png',        // microphone image → megaphone
  clipboard: '/discovery/tools/chart.png',             // chart/clipboard image
  // magnifying_glass, gear, scissors: not yet generated — emoji fallback
  // Extra images available in /discovery/tools/: lightning.png, puzzle.png, seedling.png
};

// ─── S0 Workspace Items ─────────────────────────────────────────
export const WORKSPACE_ICONS: Record<string, string> = {
  tidy_desk: '/discovery/desk-tidy.webp',
  messy_desk: '/discovery/desk-messy.webp',
  whiteboard: '/discovery/desk-whiteboard.webp',
  sticky_notes: '/discovery/desk-stickies.webp',
  plants: '/discovery/desk-plant.webp',
  clock: '/discovery/desk-clock.webp',
  headphones: '/discovery/desk-headphones.webp',
  two_chairs: '/discovery/desk-chairs.webp',
  reference_books: '/discovery/desk-books.webp',
  prototype_models: '/discovery/desk-model.webp',
  inspiration_board: '/discovery/desk-inspo.webp',
  tool_organizer: '/discovery/desk-toolkit.webp',
  coffee_setup: '/discovery/desk-coffee.webp',
  calendar: '/discovery/desk-calendar.webp',
  sketchbook: '/discovery/desk-sketchbook.webp',
  collab_board: '/discovery/desk-collab.webp',
};

// ─── S6 Fear Cards ──────────────────────────────────────────────
export const FEAR_CARD_IMAGES: Record<string, string> = {
  wrong_choice: '/discovery/fear-wrong-choice.webp',
  not_creative: '/discovery/fear-not-creative.webp',
  nobody_cares: '/discovery/fear-nobody-cares.webp',
  too_big: '/discovery/fear-too-big.webp',
  wont_finish: '/discovery/fear-wont-finish.webp',
};

// ─── Special Scenes ─────────────────────────────────────────────
export const SPECIAL_SCENES = {
  studioEntry: '/discovery/studio-entry.webp',
  communityScene: '/discovery/community-scene.webp',
  grandReveal: '/discovery/grand-reveal.webp',
};

// ─── Asset Loader Utilities ─────────────────────────────────────

/** Cache of checked image paths — avoids repeated HEAD requests */
const checkedPaths = new Map<string, boolean>();

/**
 * Check if an image file exists (client-side).
 * Uses Image() preload — resolves true if loadable, false otherwise.
 * Results are cached so each path is only checked once.
 */
export function checkImageExists(path: string): Promise<boolean> {
  if (checkedPaths.has(path)) {
    return Promise.resolve(checkedPaths.get(path)!);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { checkedPaths.set(path, true); resolve(true); };
    img.onerror = () => { checkedPaths.set(path, false); resolve(false); };
    img.src = path;
  });
}

/**
 * Preload images for the next station (call when student is ~80% through current).
 * Returns when all images have started loading (not necessarily finished).
 */
export function preloadStationAssets(station: number): void {
  const bgPath = STATION_BACKGROUNDS[station];
  if (bgPath) {
    const img = new Image();
    img.src = bgPath;
  }
}
