"use client";

import React from "react";

type Props = {
  /** Embed URL already resolved via toEmbedUrl(). Callers pass pre-processed string. */
  embedUrl: string;
  /** Eyebrow label — e.g. "Watch · 3 min". Defaults to "Watch". */
  eyebrow?: string;
  /** Title shown alongside the eyebrow. */
  title?: string;
  /** Optional right-side caption — e.g. "Auto-pauses for reflection". */
  rightNote?: string;
  /**
   * Editorial prompt rendered below the player in italic serif. Activates
   * effort-gated watching per the education-ai-patterns soft-gating model.
   */
  watchPrompt?: string;
  /** Phase color for the watch-prompt emphasis. Defaults to --sl-phase-default. */
  accentColor?: string;
};

function EyeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function VideoBlock({
  embedUrl,
  eyebrow = "Watch",
  title,
  rightNote,
  watchPrompt,
  accentColor = "var(--sl-phase-default)",
}: Props) {
  return (
    <div className="card-lb overflow-hidden">
      <div className="p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--sl-ink)", color: "white" }}
          >
            <EyeIcon />
          </div>
          <div className="min-w-0">
            <div className="cap" style={{ color: "var(--sl-ink-3)" }}>
              {eyebrow}
            </div>
            {title && (
              <div
                className="display leading-tight truncate"
                style={{ fontSize: "16px", color: "var(--sl-ink)" }}
              >
                {title}
              </div>
            )}
          </div>
        </div>
        {rightNote && (
          <div
            className="font-extrabold flex-shrink-0"
            style={{ fontSize: "11px", color: "var(--sl-ink-3)" }}
          >
            {rightNote}
          </div>
        )}
      </div>

      <div
        className="mx-5 rounded-2xl overflow-hidden"
        style={{ background: "var(--sl-ink)", aspectRatio: "16 / 9" }}
      >
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title || "Lesson video"}
        />
      </div>

      {watchPrompt && (
        <div className="p-5 flex items-center gap-3 flex-wrap">
          <div className="cap" style={{ color: "var(--sl-ink-3)" }}>
            As you watch, ask
          </div>
          <div
            className="flex-1 serif-em"
            style={{ fontSize: "17px", color: accentColor }}
          >
            &ldquo;{watchPrompt}&rdquo;
          </div>
        </div>
      )}
    </div>
  );
}
