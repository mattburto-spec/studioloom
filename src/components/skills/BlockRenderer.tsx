"use client";

/**
 * BlockRenderer — read-only renderer for skill card body blocks.
 *
 * Used by:
 *   - Student viewer: /skills/cards/[slug]
 *   - Teacher preview pane in the editor
 *
 * All 6 block types from src/types/skills.ts. Pure presentational; no data
 * fetching, no analytics — event logging happens in the parent page.
 */

import * as React from "react";
import type {
  Block,
  CalloutBlock,
  ChecklistBlock,
  ImageBlock,
  ProseBlock,
  VideoBlock,
  WorkedExampleBlock,
} from "@/types/skills";

// ----------------------------------------------------------------------------
// Prose: markdown-lite (**bold**, *italic*, line breaks only). Keeping the
// parser small avoids pulling a markdown lib for content that's mostly plain.
// ----------------------------------------------------------------------------
function renderInline(text: string): React.ReactNode {
  // Split on **bold** and *italic* tokens, preserving them.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

function Prose({ block }: { block: ProseBlock }) {
  const paragraphs = block.text.split(/\n\n+/);
  return (
    <div className="sl-skill-block sl-skill-prose">
      {paragraphs.map((p, i) => (
        <p key={i}>
          {p.split("\n").map((line, j, arr) => (
            <React.Fragment key={j}>
              {renderInline(line)}
              {j < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Callout: tip / warning / note — tone-coloured box
// ----------------------------------------------------------------------------
function Callout({ block }: { block: CalloutBlock }) {
  const icons: Record<CalloutBlock["tone"], string> = {
    tip: "💡",
    warning: "⚠️",
    note: "📝",
  };
  return (
    <div className={`sl-skill-block sl-skill-callout sl-skill-callout--${block.tone}`}>
      <span className="sl-skill-callout__icon" aria-hidden>
        {icons[block.tone]}
      </span>
      <div className="sl-skill-callout__body">{renderInline(block.text)}</div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Checklist — non-interactive tick list
// ----------------------------------------------------------------------------
function Checklist({ block }: { block: ChecklistBlock }) {
  return (
    <ul className="sl-skill-block sl-skill-checklist">
      {block.items.map((item, i) => (
        <li key={i}>
          <span className="sl-skill-checklist__tick" aria-hidden>
            ☐
          </span>
          <span>{renderInline(item)}</span>
        </li>
      ))}
    </ul>
  );
}

// ----------------------------------------------------------------------------
// Image — external URL; uploadPath is resolved upstream in S2B
// ----------------------------------------------------------------------------
function SkillImage({ block }: { block: ImageBlock }) {
  const src = block.uploadPath
    ? `/api/skills/media/${encodeURIComponent(block.uploadPath)}`
    : block.url;
  if (!src) return null;
  return (
    <figure className="sl-skill-block sl-skill-image">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={block.alt ?? block.caption ?? ""} loading="lazy" />
      {block.caption && (
        <figcaption>{renderInline(block.caption)}</figcaption>
      )}
    </figure>
  );
}

// ----------------------------------------------------------------------------
// Video — YouTube/Vimeo embed, or direct mp4
// ----------------------------------------------------------------------------
function youtubeId(url: string): string | null {
  const m =
    url.match(/[?&]v=([\w-]{11})/) ||
    url.match(/youtu\.be\/([\w-]{11})/) ||
    url.match(/youtube\.com\/embed\/([\w-]{11})/);
  return m ? m[1] : null;
}
function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

function SkillVideo({ block }: { block: VideoBlock }) {
  const url = block.uploadPath
    ? `/api/skills/media/${encodeURIComponent(block.uploadPath)}`
    : block.url;
  if (!url) return null;

  const yt = youtubeId(url);
  if (yt) {
    return (
      <figure className="sl-skill-block sl-skill-video">
        <div className="sl-skill-video__embed">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${yt}`}
            title={block.caption ?? "Video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {block.caption && <figcaption>{renderInline(block.caption)}</figcaption>}
      </figure>
    );
  }

  const vm = vimeoId(url);
  if (vm) {
    return (
      <figure className="sl-skill-block sl-skill-video">
        <div className="sl-skill-video__embed">
          <iframe
            src={`https://player.vimeo.com/video/${vm}`}
            title={block.caption ?? "Video"}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
        {block.caption && <figcaption>{renderInline(block.caption)}</figcaption>}
      </figure>
    );
  }

  // Direct video file fallback
  return (
    <figure className="sl-skill-block sl-skill-video">
      <video controls src={url} preload="metadata" />
      {block.caption && <figcaption>{renderInline(block.caption)}</figcaption>}
    </figure>
  );
}

// ----------------------------------------------------------------------------
// Worked example — titled ordered list
// ----------------------------------------------------------------------------
function WorkedExample({ block }: { block: WorkedExampleBlock }) {
  return (
    <section className="sl-skill-block sl-skill-worked">
      <h3 className="sl-skill-worked__title">{block.title}</h3>
      <ol className="sl-skill-worked__steps">
        {block.steps.map((step, i) => (
          <li key={i}>{renderInline(step)}</li>
        ))}
      </ol>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Root renderer
// ----------------------------------------------------------------------------
export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  if (!blocks || blocks.length === 0) {
    return (
      <p className="sl-skill-empty">This card has no content yet.</p>
    );
  }

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "prose":
            return <Prose key={i} block={block} />;
          case "callout":
            return <Callout key={i} block={block} />;
          case "checklist":
            return <Checklist key={i} block={block} />;
          case "image":
            return <SkillImage key={i} block={block} />;
          case "video":
            return <SkillVideo key={i} block={block} />;
          case "worked_example":
            return <WorkedExample key={i} block={block} />;
          default:
            return null;
        }
      })}
    </>
  );
}

