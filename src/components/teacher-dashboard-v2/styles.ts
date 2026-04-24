/* Scoped CSS for the Bold teacher dashboard.
 *
 * Every component assumes its parent (or an ancestor) has
 * `className="tl-v2"`. All utility classes (`display`, `cap`, `tnum`,
 * `card-shadow`, …) and CSS variables (`--bg`, `--ink`, `--hair`, …)
 * are scoped under `.tl-v2` so they don't bleed into the rest of the
 * teacher shell.
 *
 * Mirrors the `.sl-v2` pattern used by BoldTopNav for the student
 * dashboard — same CSS custom-property tokens, same class names.
 * Keeping the scope name distinct (`tl-` vs `sl-`) prevents layering
 * surprises if a page ever renders both shells at once.
 */

import { useEffect } from "react";

const SCOPED_CSS = `
.tl-v2 {
  --bg: #F7F6F2;
  --surface: #FFFFFF;
  --ink: #0A0A0A;
  --ink-2: #3A3A3A;
  --ink-3: #6B6B6B;
  --hair: #E8E6DF;
  --display-tracking: -0.035em;
  font-family: var(--font-dm-sans), system-ui, sans-serif;
  background: var(--bg);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}
.tl-v2 .display, .tl-v2 .display-lg {
  font-family: var(--font-manrope), system-ui, sans-serif;
  letter-spacing: var(--display-tracking);
  font-weight: 700;
}
.tl-v2 .display-lg { letter-spacing: -0.045em; }
.tl-v2 .tnum { font-variant-numeric: tabular-nums; }
.tl-v2 .cap {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  font-size: 10.5px;
}
.tl-v2 .card-shadow {
  box-shadow: 0 1px 2px rgba(10,10,10,0.04), 0 8px 24px -12px rgba(10,10,10,0.08);
}
.tl-v2 .card-shadow-lg {
  box-shadow: 0 1px 2px rgba(10,10,10,0.04), 0 16px 48px -20px rgba(10,10,10,0.18);
}
.tl-v2 .glow-inner::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: radial-gradient(circle at 20% 15%, rgba(255,255,255,0.28), transparent 55%);
}
.tl-v2 .pulse {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  position: relative;
}
.tl-v2 .pulse::after {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: 999px;
  border: 2px solid currentColor;
  opacity: 0;
  animation: tl-v2-ring 2s ease-out infinite;
}
@keyframes tl-v2-ring {
  0%   { opacity: 0.6; transform: scale(0.6); }
  100% { opacity: 0;   transform: scale(1.8); }
}
.tl-v2 .ring-live {
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px #0EA5A4;
}
.tl-v2 .btn-primary {
  background: var(--ink);
  color: white;
  font-weight: 700;
  letter-spacing: -0.01em;
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.tl-v2 .btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px -12px rgba(10,10,10,0.35);
}
`;

export function useScopedStyles(): void {
  useEffect(() => {
    const id = "tl-v2-scoped-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = SCOPED_CSS;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);
}
