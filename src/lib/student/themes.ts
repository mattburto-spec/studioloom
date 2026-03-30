/**
 * Student visual themes for "Set Up Your Studio" onboarding.
 *
 * Themes skin the entire student experience via CSS custom properties.
 * Applied via inline styles on the student layout root.
 *
 * Theme tokens override the default (clean) values.
 * Components use var(--st-*) properties for themed elements.
 */

export type ThemeId =
  | "clean"
  | "bold"
  | "warm"
  | "dark"
  | "neon"
  | "vapor"
  | "cyber"
  | "ocean";

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
      bg: "#FFFAE6",
      card: "#FFFFFF",
      accent: "#FF3366",
      text: "#1A1A2E",
      textSecondary: "#52525B",
    },
    tokens: {
      "--st-bg": "#FFFAE6",
      "--st-surface": "#FFFFFF",
      "--st-surface-elevated": "#FFF5CC",
      "--st-text": "#1A1A2E",
      "--st-text-secondary": "#52525B",
      "--st-border": "#FF336640",
      "--st-header-bg": "rgba(255,250,230,0.92)",
      "--st-header-text": "#1A1A2E",
      "--st-accent": "#FF3366",
      "--st-accent-text": "#FFFFFF",
      "--st-accent-subtle": "rgba(255,51,102,0.12)",
      "--st-shadow": "4px 4px 0 rgba(255,51,102,0.12)",
      "--st-input-bg": "#FFFFFF",
      "--st-input-border": "#FF336630",
    },
  },

  warm: {
    id: "warm",
    name: "Warm",
    description: "Earthy tones, rounded shapes, organic feel. Calm and grounded.",
    preview: {
      bg: "#F5EDE0",
      card: "#FDF8F0",
      accent: "#C2660A",
      text: "#292524",
      textSecondary: "#78716C",
    },
    tokens: {
      "--st-bg": "#F5EDE0",
      "--st-surface": "#FDF8F0",
      "--st-surface-elevated": "#FFF8EB",
      "--st-text": "#292524",
      "--st-text-secondary": "#78716C",
      "--st-border": "rgba(194,102,10,0.18)",
      "--st-header-bg": "rgba(245,237,224,0.92)",
      "--st-header-text": "#292524",
      "--st-accent": "#C2660A",
      "--st-accent-text": "#FFFFFF",
      "--st-accent-subtle": "rgba(194,102,10,0.10)",
      "--st-shadow": "0 2px 8px rgba(120,80,20,0.10)",
      "--st-input-bg": "#FDF8F0",
      "--st-input-border": "rgba(194,102,10,0.20)",
    },
  },

  dark: {
    id: "dark",
    name: "Dark",
    description: "Dark mode with neon accents. Sleek and modern.",
    preview: {
      bg: "#0C0C18",
      card: "#161628",
      accent: "#A78BFA",
      text: "#F1F1F4",
      textSecondary: "#9CA3AF",
    },
    tokens: {
      "--st-bg": "#0C0C18",
      "--st-surface": "#161628",
      "--st-surface-elevated": "#1E1E38",
      "--st-text": "#F1F1F4",
      "--st-text-secondary": "#9CA3AF",
      "--st-border": "rgba(167,139,250,0.15)",
      "--st-header-bg": "rgba(12,12,24,0.92)",
      "--st-header-text": "#F1F1F4",
      "--st-accent": "#A78BFA",
      "--st-accent-text": "#0C0C18",
      "--st-accent-subtle": "rgba(167,139,250,0.15)",
      "--st-shadow": "0 2px 8px rgba(0,0,0,0.4)",
      "--st-input-bg": "#161628",
      "--st-input-border": "rgba(167,139,250,0.20)",
    },
  },

  // ── NEW RADICAL / TEENAGE THEMES ──────────────────────────────────────

  neon: {
    id: "neon",
    name: "Neon",
    description: "Electric green on black. Hacker vibes, terminal energy.",
    preview: {
      bg: "#0A0A0A",
      card: "#111111",
      accent: "#39FF14",
      text: "#E0FFE0",
      textSecondary: "#6BCB77",
    },
    tokens: {
      "--st-bg": "#0A0A0A",
      "--st-surface": "#111111",
      "--st-surface-elevated": "#1A1A1A",
      "--st-text": "#E0FFE0",
      "--st-text-secondary": "#6BCB77",
      "--st-border": "rgba(57,255,20,0.12)",
      "--st-header-bg": "rgba(10,10,10,0.95)",
      "--st-header-text": "#E0FFE0",
      "--st-accent": "#39FF14",
      "--st-accent-text": "#0A0A0A",
      "--st-accent-subtle": "rgba(57,255,20,0.10)",
      "--st-shadow": "0 0 12px rgba(57,255,20,0.15)",
      "--st-input-bg": "#111111",
      "--st-input-border": "rgba(57,255,20,0.20)",
    },
  },

  vapor: {
    id: "vapor",
    name: "Vapor",
    description: "Pink-to-blue gradients. Retro sunset, vaporwave aesthetic.",
    preview: {
      bg: "#1A0A2E",
      card: "#241442",
      accent: "#FF6EC7",
      text: "#F0E6FF",
      textSecondary: "#C4A8FF",
    },
    tokens: {
      "--st-bg": "#1A0A2E",
      "--st-surface": "#241442",
      "--st-surface-elevated": "#2E1A52",
      "--st-text": "#F0E6FF",
      "--st-text-secondary": "#C4A8FF",
      "--st-border": "rgba(255,110,199,0.15)",
      "--st-header-bg": "rgba(26,10,46,0.95)",
      "--st-header-text": "#F0E6FF",
      "--st-accent": "#FF6EC7",
      "--st-accent-text": "#1A0A2E",
      "--st-accent-subtle": "rgba(255,110,199,0.12)",
      "--st-shadow": "0 0 16px rgba(255,110,199,0.15)",
      "--st-input-bg": "#241442",
      "--st-input-border": "rgba(255,110,199,0.25)",
    },
  },

  cyber: {
    id: "cyber",
    name: "Cyber",
    description: "Yellow on dark steel. Cyberpunk 2077, danger zone energy.",
    preview: {
      bg: "#0D0D0D",
      card: "#1A1A1D",
      accent: "#FFD600",
      text: "#F5F5F0",
      textSecondary: "#A0A09A",
    },
    tokens: {
      "--st-bg": "#0D0D0D",
      "--st-surface": "#1A1A1D",
      "--st-surface-elevated": "#242428",
      "--st-text": "#F5F5F0",
      "--st-text-secondary": "#A0A09A",
      "--st-border": "rgba(255,214,0,0.12)",
      "--st-header-bg": "rgba(13,13,13,0.95)",
      "--st-header-text": "#F5F5F0",
      "--st-accent": "#FFD600",
      "--st-accent-text": "#0D0D0D",
      "--st-accent-subtle": "rgba(255,214,0,0.08)",
      "--st-shadow": "0 0 10px rgba(255,214,0,0.10)",
      "--st-input-bg": "#1A1A1D",
      "--st-input-border": "rgba(255,214,0,0.20)",
    },
  },

  ocean: {
    id: "ocean",
    name: "Ocean",
    description: "Deep sea blues and aqua. Cool, calm, and immersive.",
    preview: {
      bg: "#0B1929",
      card: "#0F2137",
      accent: "#00E5FF",
      text: "#E0F4FF",
      textSecondary: "#7EB8D8",
    },
    tokens: {
      "--st-bg": "#0B1929",
      "--st-surface": "#0F2137",
      "--st-surface-elevated": "#132D4A",
      "--st-text": "#E0F4FF",
      "--st-text-secondary": "#7EB8D8",
      "--st-border": "rgba(0,229,255,0.12)",
      "--st-header-bg": "rgba(11,25,41,0.95)",
      "--st-header-text": "#E0F4FF",
      "--st-accent": "#00E5FF",
      "--st-accent-text": "#0B1929",
      "--st-accent-subtle": "rgba(0,229,255,0.10)",
      "--st-shadow": "0 2px 12px rgba(0,229,255,0.10)",
      "--st-input-bg": "#0F2137",
      "--st-input-border": "rgba(0,229,255,0.20)",
    },
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

/** Get theme definition with clean as fallback */
export function getTheme(themeId: ThemeId | null): ThemeDefinition {
  if (!themeId || !THEMES[themeId as ThemeId]) return THEMES.clean;
  return THEMES[themeId as ThemeId];
}

/** Generate CSS custom property string from theme tokens */
export function getThemeStyles(themeId: ThemeId | null): Record<string, string> {
  return getTheme(themeId).tokens;
}
