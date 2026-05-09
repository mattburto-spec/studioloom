"use client";

import React from "react";
import { BRAND_SPINE, type CalloutBullet, type CalloutPalette } from "./types";

export type { CalloutBullet, CalloutPalette };

type Props = {
  /** Title — array → one word per line for visual rhythm. Optional: bulletless callouts often have no title (the body carries the message). */
  title?: string | string[];
  /** Optional eyebrow on the chip; default "Worth remembering". */
  eyebrow?: string;
  /** Short intro paragraph beneath the title. */
  intro?: string;
  /** Bullet cards — typically 3, but accepts more (palette repeats). When empty/missing, the component renders the `body` slot in a single warm card instead of the 3-card magazine layout. */
  bullets?: CalloutBullet[];
  /** Single-card body content. Used when `bullets` is empty/missing — typically a `<ComposedPrompt />` plus optional media/links. */
  body?: React.ReactNode;
  /** Override the default brand-spine palette. */
  palette?: CalloutPalette[];
  className?: string;
};

function Lightbulb({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 1.5a4.5 4.5 0 0 0-2.6 8.2c.5.4.8 1 .8 1.6V12h3.6v-.7c0-.6.3-1.2.8-1.6A4.5 4.5 0 0 0 8 1.5Z" />
      <path d="M6.5 13.5h3M7 15h2" />
    </svg>
  );
}

export function KeyInformationCallout({
  title,
  eyebrow = "Worth remembering",
  intro,
  bullets,
  body,
  palette = BRAND_SPINE,
  className = "",
}: Props) {
  const titleLines = title
    ? Array.isArray(title)
      ? title
      : [title]
    : [];
  const hasBullets = Array.isArray(bullets) && bullets.length > 0;
  const accent = palette[0];

  // Eyebrow + title block — shared across both layouts.
  const heading = (
    <>
      <span
        className="inline-flex items-center gap-1.5"
        style={{
          padding: "6px 11px",
          borderRadius: "var(--sl-radius-pill)",
          background: "white",
          border: "1px solid #ECE6DA",
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--sl-primary)",
        }}
      >
        <Lightbulb />
        {eyebrow}
      </span>
      {titleLines.length > 0 && (
        <h2
          style={{
            marginTop: 18,
            fontSize: hasBullets ? 44 : 30,
            fontWeight: 800,
            lineHeight: hasBullets ? 0.95 : 1.1,
            letterSpacing: "-0.025em",
            color: "var(--sl-fg-primary)",
          }}
        >
          {titleLines.map((line, i) => (
            <span key={i} style={{ display: "block" }}>
              {line}
            </span>
          ))}
        </h2>
      )}
      {intro && (
        <p
          style={{
            marginTop: 14,
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--sl-fg-secondary)",
            maxWidth: hasBullets ? 280 : 720,
          }}
        >
          {intro}
        </p>
      )}
    </>
  );

  return (
    <section
      className={className}
      style={{
        fontFamily: "var(--sl-font-sans)",
        background: "var(--sl-surface-cream)",
        borderRadius: "var(--sl-radius-2xl)",
        padding: "32px 28px",
      }}
      aria-label={titleLines.length > 0 ? titleLines.join(" ") : eyebrow}
    >
      {hasBullets ? (
        <div
          className="grid gap-5"
          style={{
            gridTemplateColumns: "minmax(0, 4fr) minmax(0, 8fr)",
          }}
        >
          <div>{heading}</div>
          <div className="flex flex-col gap-3">
            {bullets!.map((b, i) => {
              const { bg, edge, ink } = palette[i % palette.length];
              const firstLetter = b.term.charAt(0);
              return (
                <article
                  key={`${b.term}-${i}`}
                  style={{
                    background: bg,
                    border: `2px solid ${edge}40`,
                    borderRadius: "var(--sl-radius-2xl)",
                    padding: "18px 20px",
                    boxShadow: "0 2px 8px -4px rgba(15,14,12,0.08)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      style={{
                        fontSize: 42,
                        fontWeight: 800,
                        lineHeight: 0.9,
                        color: edge,
                        letterSpacing: "-0.04em",
                        fontFamily: "var(--sl-font-sans)",
                        flexShrink: 0,
                      }}
                    >
                      {firstLetter}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          letterSpacing: "-0.01em",
                          color: ink,
                          lineHeight: 1.15,
                        }}
                      >
                        {b.term}
                      </div>
                      {b.hint && (
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 10.5,
                            fontWeight: 700,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: edge,
                          }}
                        >
                          {b.hint}
                        </div>
                      )}
                      <p
                        style={{
                          marginTop: 8,
                          fontSize: 14,
                          lineHeight: 1.55,
                          color: ink,
                        }}
                      >
                        {b.body}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        // Single-card fallback — no bullets. Eyebrow + optional title +
        // intro stack at the top, then the body in one warm card using
        // palette[0] so the visual identity matches a 1-bullet version
        // of the magazine layout.
        <>
          {heading}
          {body && (
            <article
              style={{
                marginTop: titleLines.length > 0 || intro ? 20 : 14,
                background: accent.bg,
                border: `2px solid ${accent.edge}40`,
                borderRadius: "var(--sl-radius-2xl)",
                padding: "20px 22px",
                boxShadow: "0 2px 8px -4px rgba(15,14,12,0.08)",
                color: accent.ink,
                fontSize: 15,
                lineHeight: 1.6,
              }}
            >
              {body}
            </article>
          )}
        </>
      )}
    </section>
  );
}
