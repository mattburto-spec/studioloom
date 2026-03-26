/**
 * Student visual themes for "Set Up Your Studio" onboarding.
 *
 * 4 themes that skin the entire student experience via CSS custom properties.
 * Applied via data-student-theme="clean" attribute on the student layout root.
 *
 * Theme tokens override the default (clean) values.
 * Components use var(--st-*) properties for themed elements.
 */

export type ThemeId = "clean" | "bold" | "warm" | "dark";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  /** Preview mini-card colors for the selection screen */
  preview: {
    bg: string;
    card: string;
    accent: string;
    text: string;
    textSecondary: string;
  };
  /** CSS custom properties applied to the student layout */
  tokens: {
    /** Page background */
    "--st-bg": string;
    /** Card / surface background */
    "--st-surface": string;
    /** Elevated surface (modals, dropdowns) */
    "--st-surface-elevated": string;
    /** Primary text */
    "--st-text": string;
    /** Secondary / muted text */
    "--st-text-secondary": string;
    /** Border color */
    "--st-border": string;
    /** Header background (frosted glass base) */
    "--st-header-bg": string;
    /** Header text */
    "--st-header-text": string;
    /** Accent highlight (buttons, active states) */
    "--st-accent": string;
    /** Accent text (on accent bg) */
    "--st-accent-text": string;
    /** Subtle accent for hover states */
    "--st-accent-subtle": string;
    /** Card shadow */
    "--st-shadow": string;
    /** Input background */
    "--st-input-bg": string;
    /** Input border */
    "--st-input-border": string;
  };
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  clean: {
    id: "clean",
    name: "Clean",
    description: "Minimal and focused. White space, thin lines, calm colors.",
    preview: {
      bg: "#F8F9FA",
      card: "#FFFFFF",
      accent: "#7B2FF2",
      text: "#1A1A2E",
      textSecondary: "#6B7280",
    },
    tokens: {
      "--st-bg": "#F8F9FA",
      "--st-surface": "#FFFFFF",
      "--st-surface-elevated": "#FFFFFF",
      "--st-text": "#1A1A2E",
      "--st-text-secondary": "#6B7280",
      "--st-border": "rgba(0,0,0,0.08)",
      "--st-header-bg": "rgba(255,255,255,0.82)",
      "--st-header-text": "#1A1A2E",
      "--st-accent": "#7B2FF2",
      "--st-accent-text": "#FFFFFF",
      "--st-accent-subtle": "rgba(123,47,242,0.08)",
      "--st-shadow": "0 1px 3px rgba(0,0,0,0.06)",
      "--st-input-bg": "#FFFFFF",
      "--st-input-border": "rgba(0,0,0,0.12)",
    },
  },

  bold: {
    id: "bold",
    name: "Bold",
    description: "Saturated colors, thick borders, high contrast. Memphis meets pop art.",
    preview: {
      bg: "#FFF8F0",
      card: "#FFFFFF",
      accent: "#FF3366",
      text: "#1A1A2E",
      textSecondary: "#52525B",
    },
    tokens: {
      "--st-bg": "#FFF8F0",
      "--st-surface": "#FFFFFF",
      "--st-surface-elevated": "#FFFFFF",
      "--st-text": "#1A1A2E",
      "--st-text-secondary": "#52525B",
      "--st-border": "rgba(0,0,0,0.14)",
      "--st-header-bg": "rgba(255,248,240,0.88)",
      "--st-header-text": "#1A1A2E",
      "--st-accent": "#FF3366",
      "--st-accent-text": "#FFFFFF",
      "--st-accent-subtle": "rgba(255,51,102,0.08)",
      "--st-shadow": "3px 3px 0 rgba(0,0,0,0.08)",
      "--st-input-bg": "#FFFFFF",
      "--st-input-border": "rgba(0,0,0,0.18)",
    },
  },

  warm: {
    id: "warm",
    name: "Warm",
    description: "Earthy tones, rounded shapes, organic feel. Calm and grounded.",
    preview: {
      bg: "#FAF7F2",
      card: "#FFFDF9",
      accent: "#B45309",
      text: "#292524",
      textSecondary: "#78716C",
    },
    tokens: {
      "--st-bg": "#FAF7F2",
      "--st-surface": "#FFFDF9",
      "--st-surface-elevated": "#FFFDF9",
      "--st-text": "#292524",
      "--st-text-secondary": "#78716C",
      "--st-border": "rgba(120,113,108,0.15)",
      "--st-header-bg": "rgba(250,247,242,0.88)",
      "--st-header-text": "#292524",
      "--st-accent": "#B45309",
      "--st-accent-text": "#FFFFFF",
      "--st-accent-subtle": "rgba(180,83,9,0.08)",
      "--st-shadow": "0 1px 4px rgba(120,113,108,0.10)",
      "--st-input-bg": "#FFFDF9",
      "--st-input-border": "rgba(120,113,108,0.18)",
    },
  },

  dark: {
    id: "dark",
    name: "Dark",
    description: "Dark mode with neon accents. Sleek and modern.",
    preview: {
      bg: "#0F0F1A",
      card: "#1A1A2E",
      accent: "#A78BFA",
      text: "#F1F1F4",
      textSecondary: "#9CA3AF",
    },
    tokens: {
      "--st-bg": "#0F0F1A",
      "--st-surface": "#1A1A2E",
      "--st-surface-elevated": "#252540",
      "--st-text": "#F1F1F4",
      "--st-text-secondary": "#9CA3AF",
      "--st-border": "rgba(255,255,255,0.08)",
      "--st-header-bg": "rgba(15,15,26,0.88)",
      "--st-header-text": "#F1F1F4",
      "--st-accent": "#A78BFA",
      "--st-accent-text": "#0F0F1A",
      "--st-accent-subtle": "rgba(167,139,250,0.12)",
      "--st-shadow": "0 1px 4px rgba(0,0,0,0.3)",
      "--st-input-bg": "#1A1A2E",
      "--st-input-border": "rgba(255,255,255,0.12)",
    },
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

/** Get theme definition with clean as fallback */
export function getTheme(themeId: ThemeId | null): ThemeDefinition {
  if (!themeId || !THEMES[themeId]) return THEMES.clean;
  return THEMES[themeId];
}

/** Generate CSS custom property string from theme tokens */
export function getThemeStyles(themeId: ThemeId | null): Record<string, string> {
  return getTheme(themeId).tokens;
}
