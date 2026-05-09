export type RichTextPrompt = {
  /** Small ALL-CAPS eyebrow above the heading. */
  eyebrow?: string;
  /** Main heading rendered as <h1>. */
  heading: string;
  /** Editor placeholder shown when the value is empty. */
  placeholder?: string;
};

/** Sanitisable HTML — the editor only emits these tags. */
export const ALLOWED_TAGS = [
  "P",
  "BR",
  "STRONG",
  "B",
  "EM",
  "I",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
] as const;

export type AllowedTag = (typeof ALLOWED_TAGS)[number];
