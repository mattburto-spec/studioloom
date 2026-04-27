"use client";

import React from "react";

export type LessonTool = {
  id: string;
  /** Inline SVG node. Project does not use lucide-react (Lesson #16). */
  icon: React.ReactNode;
  /** Label shown in the hover tooltip. */
  label: string;
  onClick: () => void;
  /** Optional hotpink-on-ink accent for stand-out CTAs (e.g. Class Gallery). */
  accent?: boolean;
  /** Accessible label override — falls back to `label` when omitted. */
  ariaLabel?: string;
};

type Props = {
  tools: LessonTool[];
  /** Hide the rail on small viewports so it doesn't fight with MobileBottomNav. Default: true. */
  hideOnMobile?: boolean;
};

export function LessonToolsRail({ tools, hideOnMobile = true }: Props) {
  if (tools.length === 0) return null;

  return (
    <div
      className={`fixed right-4 top-1/2 -translate-y-1/2 z-30 flex-col gap-2 ${
        hideOnMobile ? "hidden md:flex" : "flex flex-col"
      }`}
    >
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={t.onClick}
          aria-label={t.ariaLabel ?? t.label}
          className="group w-11 h-11 rounded-full card-shadow flex items-center justify-center transition relative hover:-translate-x-1"
          style={{
            background: t.accent ? "var(--sl-ink)" : "var(--sl-paper)",
            color: t.accent ? "white" : "var(--sl-ink-2)",
            border: t.accent ? "none" : "1px solid var(--sl-hair)",
          }}
        >
          <span className="flex items-center justify-center" aria-hidden="true">
            {t.icon}
          </span>
          <span
            className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md font-extrabold opacity-0 group-hover:opacity-100 transition pointer-events-none"
            style={{
              background: "var(--sl-ink)",
              color: "white",
              padding: "4px 10px",
              fontSize: "11px",
            }}
          >
            {t.label}
          </span>
        </button>
      ))}
    </div>
  );
}
