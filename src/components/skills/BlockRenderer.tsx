"use client";

/**
 * BlockRenderer — read-only renderer for skill card body blocks.
 *
 * Used by:
 *   - Student viewer: /skills/cards/[slug]
 *   - Teacher preview pane in the editor
 *
 * All 13 block types from src/types/skills.ts. Pure presentational; no data
 * fetching, no analytics — event logging happens in the parent page.
 */

import * as React from "react";
import { useRef, useState, useEffect, useCallback } from "react";
import { isSafeEmbedUrl } from "@/types/skills";
import type {
  AccordionBlock,
  BeforeAfterBlock,
  Block,
  CalloutBlock,
  ChecklistBlock,
  CodeBlockBlock,
  CompareImagesBlock,
  ComprehensionCheckBlock,
  EmbedBlock,
  GalleryBlock,
  ImageBlock,
  KeyConceptBlock,
  MicroStoryBlock,
  ProseBlock,
  ScenarioBlock,
  SideBySideBlock,
  StepByStepBlock,
  ThinkAloudBlock,
  VideoBlock,
  VideoEmbedBlock,
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
// Embed — safelisted iframe (Sketchfab / Figma / Codepen / Miro / Desmos / etc.)
// Non-safelisted URLs fall back to an "Open in new tab" link.
// ----------------------------------------------------------------------------
function Embed({ block }: { block: EmbedBlock }) {
  if (!block.url) return null;
  const safe = isSafeEmbedUrl(block.url);
  const aspectClass =
    block.aspectRatio === "4:3"
      ? "sl-skill-embed--4-3"
      : block.aspectRatio === "1:1"
        ? "sl-skill-embed--1-1"
        : "sl-skill-embed--16-9";

  if (!safe) {
    return (
      <div className="sl-skill-block sl-skill-embed sl-skill-embed--fallback">
        <p>
          This embed is from an unsupported domain.{" "}
          <a href={block.url} target="_blank" rel="noopener noreferrer">
            Open link →
          </a>
        </p>
        {block.caption && (
          <p className="sl-skill-embed__caption">{renderInline(block.caption)}</p>
        )}
      </div>
    );
  }

  return (
    <figure className={`sl-skill-block sl-skill-embed ${aspectClass}`}>
      <div className="sl-skill-embed__frame">
        <iframe
          src={block.url}
          title={block.title ?? "Embedded content"}
          allow="fullscreen; xr-spatial-tracking; autoplay; clipboard-write"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      {(block.caption || block.title) && (
        <figcaption>{renderInline(block.caption ?? block.title ?? "")}</figcaption>
      )}
    </figure>
  );
}

// ----------------------------------------------------------------------------
// Accordion — click-to-reveal collapsible. Uses native <details> for a11y.
// ----------------------------------------------------------------------------
function Accordion({ block }: { block: AccordionBlock }) {
  return (
    <details className="sl-skill-block sl-skill-accordion">
      <summary>{block.title || "Details"}</summary>
      <div className="sl-skill-accordion__body">
        {block.body.split(/\n\n+/).map((p, i) => (
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
    </details>
  );
}

// ----------------------------------------------------------------------------
// Think-aloud — question visible, answer hidden behind a reveal button.
// ----------------------------------------------------------------------------
function ThinkAloud({ block }: { block: ThinkAloudBlock }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <section className="sl-skill-block sl-skill-think">
      <div className="sl-skill-think__prompt">
        <span className="sl-skill-think__label">Think it through</span>
        <div>{renderInline(block.prompt)}</div>
      </div>
      {revealed ? (
        <div className="sl-skill-think__answer">
          <span className="sl-skill-think__answer-label">Answer</span>
          <div>{renderInline(block.answer)}</div>
        </div>
      ) : (
        <button
          type="button"
          className="sl-skill-think__reveal"
          onClick={() => setRevealed(true)}
        >
          Reveal answer
        </button>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Before/after image slider — draggable vertical divider.
// Keyboard a11y via a range input overlaid invisibly on top.
// ----------------------------------------------------------------------------
function CompareImages({ block }: { block: CompareImagesBlock }) {
  const [pos, setPos] = useState(50); // 0-100
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPos(pct);
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!draggingRef.current) return;
      const x = "touches" in e ? e.touches[0].clientX : e.clientX;
      updateFromClientX(x);
    }
    function onUp() {
      draggingRef.current = false;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [updateFromClientX]);

  if (!block.beforeUrl || !block.afterUrl) return null;

  return (
    <figure className="sl-skill-block sl-skill-compare">
      <div
        ref={containerRef}
        className="sl-skill-compare__frame"
        onMouseDown={(e) => {
          draggingRef.current = true;
          updateFromClientX(e.clientX);
        }}
        onTouchStart={(e) => {
          draggingRef.current = true;
          updateFromClientX(e.touches[0].clientX);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.afterUrl}
          alt={block.afterLabel ?? "After"}
          className="sl-skill-compare__img sl-skill-compare__img--after"
          draggable={false}
        />
        <div
          className="sl-skill-compare__clip"
          style={{ width: `${pos}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.beforeUrl}
            alt={block.beforeLabel ?? "Before"}
            className="sl-skill-compare__img sl-skill-compare__img--before"
            draggable={false}
          />
        </div>
        <div
          className="sl-skill-compare__divider"
          style={{ left: `${pos}%` }}
          aria-hidden
        >
          <div className="sl-skill-compare__handle">⇆</div>
        </div>
        {block.beforeLabel && (
          <span className="sl-skill-compare__label sl-skill-compare__label--before">
            {block.beforeLabel}
          </span>
        )}
        {block.afterLabel && (
          <span className="sl-skill-compare__label sl-skill-compare__label--after">
            {block.afterLabel}
          </span>
        )}
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="sl-skill-compare__range"
          aria-label={`Compare ${block.beforeLabel ?? "before"} and ${block.afterLabel ?? "after"}`}
        />
      </div>
      {block.caption && <figcaption>{renderInline(block.caption)}</figcaption>}
    </figure>
  );
}

// ----------------------------------------------------------------------------
// Image gallery — one at a time, prev/next + dot indicators.
// ----------------------------------------------------------------------------
function Gallery({ block }: { block: GalleryBlock }) {
  const [idx, setIdx] = useState(0);
  const valid = (block.images ?? []).filter((img) => img.url);
  if (valid.length === 0) return null;
  const current = valid[Math.min(idx, valid.length - 1)];
  const count = valid.length;

  return (
    <figure className="sl-skill-block sl-skill-gallery">
      <div className="sl-skill-gallery__frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.url}
          src={current.url}
          alt={current.alt ?? current.caption ?? `Image ${idx + 1} of ${count}`}
          className="sl-skill-gallery__img"
          loading="lazy"
        />
        {count > 1 && (
          <>
            <button
              type="button"
              className="sl-skill-gallery__nav sl-skill-gallery__nav--prev"
              onClick={() => setIdx((i) => (i - 1 + count) % count)}
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              type="button"
              className="sl-skill-gallery__nav sl-skill-gallery__nav--next"
              onClick={() => setIdx((i) => (i + 1) % count)}
              aria-label="Next image"
            >
              ›
            </button>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="sl-skill-gallery__dots">
          {valid.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to image ${i + 1}`}
              aria-current={i === idx}
              className={`sl-skill-gallery__dot${i === idx ? " sl-skill-gallery__dot--active" : ""}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      )}
      {current.caption && (
        <figcaption>{renderInline(current.caption)}</figcaption>
      )}
    </figure>
  );
}

// ----------------------------------------------------------------------------
// Code block — monospaced <pre><code> with filename + copy button.
// Syntax highlighting deliberately deferred (no new deps for v1).
// ----------------------------------------------------------------------------
function CodeRenderer({ block }: { block: CodeBlockBlock }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(block.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }
  return (
    <div className="sl-skill-block sl-skill-code">
      <div className="sl-skill-code__head">
        <span className="sl-skill-code__meta">
          {block.filename && <strong>{block.filename}</strong>}
          {block.language && <span>{block.language}</span>}
        </span>
        <button
          type="button"
          onClick={copy}
          className="sl-skill-code__copy"
          aria-label="Copy code"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="sl-skill-code__pre">
        <code>{block.code}</code>
      </pre>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Side-by-side — two columns of markdown-lite.
// ----------------------------------------------------------------------------
function SideBySide({ block }: { block: SideBySideBlock }) {
  return (
    <section className="sl-skill-block sl-skill-sidebyside">
      <div className="sl-skill-sidebyside__col">
        {block.leftTitle && (
          <h4 className="sl-skill-sidebyside__title">{block.leftTitle}</h4>
        )}
        {block.leftText.split(/\n\n+/).map((p, i) => (
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
      <div className="sl-skill-sidebyside__col">
        {block.rightTitle && (
          <h4 className="sl-skill-sidebyside__title">{block.rightTitle}</h4>
        )}
        {block.rightText.split(/\n\n+/).map((p, i) => (
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
    </section>
  );
}

// ============================================================================
// ============================================================================
// RICH BLOCKS — the primary authoring vocabulary
// ============================================================================
// ============================================================================

// ----------------------------------------------------------------------------
// KeyConcept — rich teaching card: markdown + icon + tips + examples + warning
// ----------------------------------------------------------------------------
function renderParagraphs(text: string): React.ReactNode {
  return text.split(/\n\n+/).map((p, i) => (
    <p key={i}>
      {p.split("\n").map((line, j, arr) => (
        <React.Fragment key={j}>
          {renderInline(line)}
          {j < arr.length - 1 && <br />}
        </React.Fragment>
      ))}
    </p>
  ));
}

function KeyConcept({ block }: { block: KeyConceptBlock }) {
  return (
    <section className="sl-skill-block sl-skill-kc">
      <div className="sl-skill-kc__head">
        {block.icon && (
          <span className="sl-skill-kc__icon" aria-hidden>
            {block.icon}
          </span>
        )}
        <h3 className="sl-skill-kc__title">{block.title}</h3>
      </div>
      {block.image && (
        <figure className="sl-skill-kc__image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.image} alt={block.title} loading="lazy" />
        </figure>
      )}
      {block.content && (
        <div className="sl-skill-kc__content sl-skill-prose">
          {renderParagraphs(block.content)}
        </div>
      )}
      {block.tips && block.tips.length > 0 && (
        <div className="sl-skill-kc__tips">
          <div className="sl-skill-kc__sublabel">Tips</div>
          <ul>
            {block.tips.map((t, i) => (
              <li key={i}>{renderInline(t)}</li>
            ))}
          </ul>
        </div>
      )}
      {block.examples && block.examples.length > 0 && (
        <div className="sl-skill-kc__examples">
          <div className="sl-skill-kc__sublabel">Examples</div>
          <ul>
            {block.examples.map((e, i) => (
              <li key={i}>{renderInline(e)}</li>
            ))}
          </ul>
        </div>
      )}
      {block.warning && (
        <aside className="sl-skill-kc__warning" role="note">
          <span className="sl-skill-kc__warning-icon" aria-hidden>⚠️</span>
          <div>{renderInline(block.warning)}</div>
        </aside>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// MicroStory — narrative + analysis reveals + key_lesson + optional rule ref
// ----------------------------------------------------------------------------
function MicroStory({ block }: { block: MicroStoryBlock }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <section className="sl-skill-block sl-skill-story">
      <header className="sl-skill-story__head">
        {block.is_real_incident && (
          <span className="sl-skill-story__badge">Real incident</span>
        )}
        <h3 className="sl-skill-story__title">{block.title}</h3>
      </header>
      <div className="sl-skill-story__narrative sl-skill-prose">
        {renderParagraphs(block.narrative)}
      </div>
      {block.analysis_prompts.length > 0 && (
        <div className="sl-skill-story__analysis">
          <div className="sl-skill-kc__sublabel">Think it through</div>
          <ul>
            {block.analysis_prompts.map((p, i) => (
              <li key={i} className="sl-skill-story__prompt">
                <div className="sl-skill-story__q">{renderInline(p.question)}</div>
                {revealed.has(i) ? (
                  <div className="sl-skill-story__a">
                    {renderInline(p.reveal_answer)}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="sl-skill-story__reveal"
                    onClick={() => toggle(i)}
                  >
                    Reveal answer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {block.key_lesson && (
        <aside className="sl-skill-story__lesson">
          <span className="sl-skill-kc__sublabel">Key lesson</span>
          <div>{renderInline(block.key_lesson)}</div>
        </aside>
      )}
      {block.related_rule && (
        <div className="sl-skill-story__rule">
          Related: {renderInline(block.related_rule)}
        </div>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Scenario — branching decision. Student picks a branch, gets feedback +
// optional consequence. Supports chaining via next_branch_id. Render walks
// the chain as student makes picks; a simple state machine in useState.
// ----------------------------------------------------------------------------
function Scenario({ block }: { block: ScenarioBlock }) {
  const [history, setHistory] = useState<
    Array<{ branchId: string; choice: ScenarioBlock["branches"][number] }>
  >([]);
  const branchById = (id: string) => block.branches.find((b) => b.id === id);

  // Which branches are currently "choice-able"? The root is any branch
  // that isn't the next_branch_id of an earlier one; for simplicity we
  // treat ALL branches as choices for the first step.
  const firstStepRoot = history.length === 0 ? block.branches : null;

  // For subsequent steps we follow next_branch_id chains — but safety's
  // scenarios mostly use single-step branches (pick once, done), so this
  // is a minimal implementation.
  function pick(branch: ScenarioBlock["branches"][number]) {
    setHistory((prev) => [
      ...prev,
      { branchId: branch.id, choice: branch },
    ]);
  }
  function reset() {
    setHistory([]);
  }

  const lastChoice = history.length > 0 ? history[history.length - 1]?.choice : null;
  const nextBranches =
    lastChoice?.next_branch_id && branchById(lastChoice.next_branch_id)
      ? [branchById(lastChoice.next_branch_id)!]
      : null;

  return (
    <section className="sl-skill-block sl-skill-scenario">
      <header className="sl-skill-scenario__head">
        <h3 className="sl-skill-scenario__title">{block.title}</h3>
      </header>
      {block.illustration && (
        <figure className="sl-skill-scenario__image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.illustration} alt="" loading="lazy" />
        </figure>
      )}
      <div className="sl-skill-scenario__setup sl-skill-prose">
        {renderParagraphs(block.setup)}
      </div>

      {history.map((h, i) => (
        <div key={i} className="sl-skill-scenario__step">
          <div className="sl-skill-scenario__chosen">
            You chose: <strong>{h.choice.choice_text}</strong>
          </div>
          <div
            className={`sl-skill-scenario__feedback sl-skill-scenario__feedback--${
              h.choice.is_correct ? "correct" : "incorrect"
            }`}
          >
            {renderInline(h.choice.feedback)}
          </div>
          {h.choice.consequence && (
            <div className="sl-skill-scenario__consequence">
              <span className="sl-skill-kc__sublabel">Consequence</span>
              <div>{renderInline(h.choice.consequence)}</div>
            </div>
          )}
        </div>
      ))}

      {(firstStepRoot || nextBranches) && (
        <div className="sl-skill-scenario__choices">
          {(firstStepRoot ?? nextBranches ?? []).map((b) => (
            <button
              key={b.id}
              type="button"
              className="sl-skill-scenario__choice"
              onClick={() => pick(b)}
            >
              {b.choice_text}
            </button>
          ))}
        </div>
      )}

      {history.length > 0 && (!nextBranches || nextBranches.length === 0) && (
        <div className="sl-skill-scenario__reset">
          <button
            type="button"
            className="sl-skill-scenario__reset-btn"
            onClick={reset}
          >
            Try again
          </button>
        </div>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// BeforeAfter — structured comparison with hazards + principles + key_difference
// ----------------------------------------------------------------------------
function BeforeAfter({ block }: { block: BeforeAfterBlock }) {
  return (
    <section className="sl-skill-block sl-skill-ba">
      <header className="sl-skill-ba__head">
        <h3 className="sl-skill-ba__title">{block.title}</h3>
      </header>
      <div className="sl-skill-ba__pair">
        <div className="sl-skill-ba__col sl-skill-ba__col--before">
          <div className="sl-skill-ba__label">Before</div>
          {block.before.image && (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={block.before.image} alt="Before" loading="lazy" />
            </figure>
          )}
          <p className="sl-skill-ba__caption">{renderInline(block.before.caption)}</p>
          {block.before.hazards.length > 0 && (
            <>
              <div className="sl-skill-kc__sublabel">Hazards</div>
              <ul className="sl-skill-ba__list sl-skill-ba__list--hazards">
                {block.before.hazards.map((h, i) => (
                  <li key={i}>{renderInline(h)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="sl-skill-ba__col sl-skill-ba__col--after">
          <div className="sl-skill-ba__label">After</div>
          {block.after.image && (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={block.after.image} alt="After" loading="lazy" />
            </figure>
          )}
          <p className="sl-skill-ba__caption">{renderInline(block.after.caption)}</p>
          {block.after.principles.length > 0 && (
            <>
              <div className="sl-skill-kc__sublabel">Principles</div>
              <ul className="sl-skill-ba__list sl-skill-ba__list--principles">
                {block.after.principles.map((p, i) => (
                  <li key={i}>{renderInline(p)}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      {block.key_difference && (
        <aside className="sl-skill-ba__key">
          <span className="sl-skill-kc__sublabel">Key difference</span>
          <div>{renderInline(block.key_difference)}</div>
        </aside>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// StepByStep — numbered steps with per-step image + warning + checkpoint
// ----------------------------------------------------------------------------
function StepByStep({ block }: { block: StepByStepBlock }) {
  return (
    <section className="sl-skill-block sl-skill-sbs">
      <header>
        <h3 className="sl-skill-sbs__title">{block.title}</h3>
      </header>
      <ol className="sl-skill-sbs__steps">
        {block.steps.map((s, i) => (
          <li key={i} className="sl-skill-sbs__step">
            <div className="sl-skill-sbs__num">{s.number}</div>
            <div className="sl-skill-sbs__body">
              <div className="sl-skill-sbs__instruction">
                {renderInline(s.instruction)}
              </div>
              {s.image && (
                <figure className="sl-skill-sbs__image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image} alt={`Step ${s.number}`} loading="lazy" />
                </figure>
              )}
              {s.warning && (
                <aside className="sl-skill-sbs__warning">
                  <span aria-hidden>⚠️</span>
                  <div>{renderInline(s.warning)}</div>
                </aside>
              )}
              {s.checkpoint && (
                <aside className="sl-skill-sbs__checkpoint">
                  <span className="sl-skill-kc__sublabel">Check before continuing</span>
                  <div>{renderInline(s.checkpoint)}</div>
                </aside>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ----------------------------------------------------------------------------
// ComprehensionCheck — single MC with per-option feedback + optional hint
// ----------------------------------------------------------------------------
function ComprehensionCheck({ block }: { block: ComprehensionCheckBlock }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const showHint = attempts >= 1 && selected !== null && selected !== block.correct_index && !!block.hint;

  function pick(i: number) {
    setSelected(i);
    setAttempts((a) => a + 1);
  }
  function retry() {
    setSelected(null);
  }

  const isCorrect = selected !== null && selected === block.correct_index;
  const isWrong = selected !== null && selected !== block.correct_index;

  return (
    <section className="sl-skill-block sl-skill-cc">
      <div className="sl-skill-cc__question">{renderInline(block.question)}</div>
      <ul className="sl-skill-cc__options">
        {block.options.map((opt, i) => {
          const active = selected === i;
          const correct = i === block.correct_index;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={isCorrect}
                onClick={() => pick(i)}
                className={`sl-skill-cc__option${
                  active && correct ? " sl-skill-cc__option--correct" : ""
                }${active && !correct ? " sl-skill-cc__option--wrong" : ""}`}
              >
                {opt}
              </button>
            </li>
          );
        })}
      </ul>
      {isCorrect && (
        <div className="sl-skill-cc__feedback sl-skill-cc__feedback--correct">
          {renderInline(block.feedback_correct)}
        </div>
      )}
      {isWrong && (
        <>
          <div className="sl-skill-cc__feedback sl-skill-cc__feedback--wrong">
            {renderInline(block.feedback_wrong)}
          </div>
          {showHint && (
            <div className="sl-skill-cc__hint">
              <span className="sl-skill-kc__sublabel">Hint</span>
              <div>{renderInline(block.hint!)}</div>
            </div>
          )}
          <div className="sl-skill-cc__retry">
            <button type="button" onClick={retry} className="sl-skill-cc__retry-btn">
              Try again
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// VideoEmbed — YouTube / Vimeo / direct mp4 with start/end trim
// ----------------------------------------------------------------------------
function youtubeIdFull(url: string): string | null {
  const m =
    url.match(/[?&]v=([\w-]{11})/) ||
    url.match(/youtu\.be\/([\w-]{11})/) ||
    url.match(/youtube\.com\/embed\/([\w-]{11})/);
  return m ? m[1] : null;
}
function vimeoIdFull(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

function VideoEmbed({ block }: { block: VideoEmbedBlock }) {
  if (!block.url) return null;
  const yt = youtubeIdFull(block.url);
  if (yt) {
    const params = new URLSearchParams();
    if (block.start_time) params.set("start", String(block.start_time));
    if (block.end_time) params.set("end", String(block.end_time));
    const qs = params.toString();
    return (
      <figure className="sl-skill-block sl-skill-video">
        <div className="sl-skill-video__embed">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${yt}${qs ? `?${qs}` : ""}`}
            title={block.title ?? "Video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {(block.caption || block.title) && (
          <figcaption>{renderInline(block.caption ?? block.title ?? "")}</figcaption>
        )}
      </figure>
    );
  }
  const vm = vimeoIdFull(block.url);
  if (vm) {
    const params = new URLSearchParams();
    if (block.start_time) params.set("#t", `${block.start_time}s`);
    return (
      <figure className="sl-skill-block sl-skill-video">
        <div className="sl-skill-video__embed">
          <iframe
            src={`https://player.vimeo.com/video/${vm}${params.toString() ? `?${params.toString()}` : ""}`}
            title={block.title ?? "Video"}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
        {(block.caption || block.title) && (
          <figcaption>{renderInline(block.caption ?? block.title ?? "")}</figcaption>
        )}
      </figure>
    );
  }
  // Direct mp4 fallback (trim via <source media-fragment>#t=start,end).
  const mpSrc = block.start_time || block.end_time
    ? `${block.url}#t=${block.start_time ?? 0}${block.end_time ? `,${block.end_time}` : ""}`
    : block.url;
  return (
    <figure className="sl-skill-block sl-skill-video">
      <video controls src={mpSrc} preload="metadata" />
      {(block.caption || block.title) && (
        <figcaption>{renderInline(block.caption ?? block.title ?? "")}</figcaption>
      )}
    </figure>
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
          // Rich pedagogical blocks
          case "key_concept":
            return <KeyConcept key={i} block={block} />;
          case "micro_story":
            return <MicroStory key={i} block={block} />;
          case "scenario":
            return <Scenario key={i} block={block} />;
          case "before_after":
            return <BeforeAfter key={i} block={block} />;
          case "step_by_step":
            return <StepByStep key={i} block={block} />;
          case "comprehension_check":
            return <ComprehensionCheck key={i} block={block} />;
          case "video_embed":
            return <VideoEmbed key={i} block={block} />;
          // Generic (kept)
          case "embed":
            return <Embed key={i} block={block} />;
          case "accordion":
            return <Accordion key={i} block={block} />;
          case "gallery":
            return <Gallery key={i} block={block} />;
          // Deprecated — legacy renderers kept so old bodies don't blank
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
          case "think_aloud":
            return <ThinkAloud key={i} block={block} />;
          case "compare_images":
            return <CompareImages key={i} block={block} />;
          case "code":
            return <CodeRenderer key={i} block={block} />;
          case "side_by_side":
            return <SideBySide key={i} block={block} />;
          default:
            return null;
        }
      })}
    </>
  );
}

