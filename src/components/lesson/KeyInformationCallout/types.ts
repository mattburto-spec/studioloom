export type CalloutBullet = {
  /** The term being defined, e.g. "Choice". */
  term: string;
  /** Tiny ALL-CAPS hint shown beneath the term, e.g. "autonomy". */
  hint?: string;
  /** Body paragraph. */
  body: string;
};

export type CalloutPalette = { bg: string; edge: string; ink: string };

/** Brand-spine palette — purple → brand-purple → brand-pink. */
export const BRAND_SPINE: CalloutPalette[] = [
  { bg: "#F1E6F7", edge: "#8B2FC9", ink: "#3F1561" },
  { bg: "#EFE3FE", edge: "#7B2FF2", ink: "#37127A" },
  { bg: "#FFE4E9", edge: "#FF3366", ink: "#7A1530" },
];
