// Client-side image filter — Phase 5C
// NSFW.js (MobileNet v2) for pre-upload image classification.
// Lazy-loaded: the ~4MB model is only fetched when checkClientImage() is first called.
// Defence in depth: if model fails to load, returns ok:true so server-side Haiku (5D) catches it.

import type { ModerationResult } from './types';

// Threshold: combined porn + hentai + sexy score above this → block
const BLOCK_THRESHOLD = parseFloat(
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_NSFW_BLOCK_THRESHOLD) || '0.6'
);

// Categories returned by NSFW.js
type NSFWClassName = 'Drawing' | 'Hentai' | 'Neutral' | 'Porn' | 'Sexy';

interface NSFWPrediction {
  className: NSFWClassName;
  probability: number;
}

interface NSFWModel {
  classify: (img: HTMLImageElement) => Promise<NSFWPrediction[]>;
}

// Lazy-loaded model singleton
let modelPromise: Promise<NSFWModel | null> | null = null;

async function loadModel(): Promise<NSFWModel | null> {
  try {
    const nsfwjs = await import('nsfwjs');
    const model = await nsfwjs.load();
    return model as unknown as NSFWModel;
  } catch (err) {
    console.warn('[content-safety] NSFW.js model failed to load — images will pass to server check:', err);
    return null;
  }
}

function getModel() {
  if (!modelPromise) {
    modelPromise = loadModel();
  }
  return modelPromise;
}

/** Reset the cached model — used for testing */
export function _resetModelCache(): void {
  modelPromise = null;
}

/**
 * Create an HTMLImageElement from a File.
 * Returns null if the file is not an image or can't be loaded.
 */
function fileToImage(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Extract a score map from NSFW.js predictions.
 */
function toScoreMap(predictions: NSFWPrediction[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of predictions) {
    map[p.className.toLowerCase()] = p.probability;
  }
  return map;
}

/**
 * Check an image file against the NSFW.js model before upload.
 *
 * - Lazy-loads the model on first call (~4MB).
 * - If the model fails to load or the file isn't an image, returns ok:true
 *   (defence in depth — server-side Haiku catches it).
 * - Blocks if combined porn + hentai + sexy > BLOCK_THRESHOLD (default 0.6).
 */
export async function checkClientImage(file: File): Promise<ModerationResult> {
  if (!file.type.startsWith('image/')) {
    return { ok: true, status: 'clean', flags: [], layer: 'client_image' };
  }

  const model = await getModel();
  if (!model) {
    return { ok: true, status: 'clean', flags: [], layer: 'client_image' };
  }

  const img = await fileToImage(file);
  if (!img) {
    return { ok: true, status: 'clean', flags: [], layer: 'client_image' };
  }

  try {
    const predictions = await model.classify(img);
    const scores = toScoreMap(predictions);

    const porn = scores['porn'] || 0;
    const hentai = scores['hentai'] || 0;
    const sexy = scores['sexy'] || 0;
    const combined = porn + hentai + sexy;

    if (combined > BLOCK_THRESHOLD) {
      return {
        ok: false,
        status: 'blocked',
        flags: [{
          type: 'sexual',
          severity: 'critical',
          confidence: combined,
          detail: `NSFW scores: porn=${porn.toFixed(3)}, hentai=${hentai.toFixed(3)}, sexy=${sexy.toFixed(3)}`,
        }],
        layer: 'client_image',
      };
    }

    return { ok: true, status: 'clean', flags: [], layer: 'client_image' };
  } catch (err) {
    console.warn('[content-safety] NSFW.js classify failed — passing to server:', err);
    return { ok: true, status: 'clean', flags: [], layer: 'client_image' };
  }
}

/** Localised block messages */
export const IMAGE_MODERATION_MESSAGES = {
  en: "This image can't be uploaded. If you think this is a mistake, talk to your teacher.",
  zh: "此图片无法上传。如有疑问请联系老师。",
} as const;
