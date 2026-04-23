"use client";

/**
 * BlockEditor — teacher authoring surface for skill card body.
 *
 * Controlled component: parent owns the Block[] state and passes in an
 * onChange callback. Provides:
 *   - per-block editor forms (prose / callout / checklist / image / video / worked_example)
 *   - add-block menu
 *   - move up / move down
 *   - delete block (with inline confirm)
 *
 * S2A intentionally ships with a textarea-based prose editor — no
 * rich-text toolbar. The markdown-lite (**bold** / *italic*) is enough
 * for v1 and keeps the surface small.
 *
 * Each per-type form is a dedicated component, which sidesteps the
 * TypeScript limitation where nested functions inside a switch case
 * don't preserve discriminated-union narrowing.
 */

import { useState } from "react";
import {
  BLOCK_TYPES,
  emptyBlock,
  isSafeEmbedUrl,
  type AccordionBlock,
  type Block,
  type BlockType,
  type CalloutBlock,
  type ChecklistBlock,
  type CodeBlockBlock,
  type CompareImagesBlock,
  type EmbedBlock,
  type GalleryBlock,
  type ImageBlock,
  type ProseBlock,
  type SideBySideBlock,
  type ThinkAloudBlock,
  type VideoBlock,
  type WorkedExampleBlock,
} from "@/types/skills";

interface Props {
  blocks: Block[];
  onChange: (next: Block[]) => void;
}

const BLOCK_LABELS: Record<BlockType, string> = {
  prose: "Text",
  callout: "Callout",
  checklist: "Checklist",
  image: "Image",
  video: "Video",
  worked_example: "Worked example",
  embed: "Embed",
  accordion: "Accordion",
  think_aloud: "Think-aloud",
  compare_images: "Before/After",
  gallery: "Gallery",
  code: "Code",
  side_by_side: "Side-by-side",
};

export function BlockEditor({ blocks, onChange }: Props) {
  const [addOpen, setAddOpen] = useState(false);

  function updateAt(i: number, next: Block) {
    const copy = blocks.slice();
    copy[i] = next;
    onChange(copy);
  }
  function removeAt(i: number) {
    const copy = blocks.slice();
    copy.splice(i, 1);
    onChange(copy);
  }
  function moveUp(i: number) {
    if (i === 0) return;
    const copy = blocks.slice();
    [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
    onChange(copy);
  }
  function moveDown(i: number) {
    if (i === blocks.length - 1) return;
    const copy = blocks.slice();
    [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]];
    onChange(copy);
  }
  function appendBlock(type: BlockType) {
    onChange([...blocks, emptyBlock(type)]);
    setAddOpen(false);
  }

  return (
    <div className="sl-skill-editor">
      {blocks.length === 0 && (
        <p className="sl-skill-editor__empty">
          No content blocks yet. Add one below to start authoring.
        </p>
      )}

      <ol className="sl-skill-editor__list">
        {blocks.map((block, i) => (
          <li key={i} className="sl-skill-editor__item">
            <div className="sl-skill-editor__header">
              <span className="sl-skill-editor__badge">
                {BLOCK_LABELS[block.type]}
              </span>
              <div className="sl-skill-editor__ctrls">
                <button
                  type="button"
                  className="sl-skill-btn sl-skill-btn--tiny"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  aria-label="Move block up"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="sl-skill-btn sl-skill-btn--tiny"
                  onClick={() => moveDown(i)}
                  disabled={i === blocks.length - 1}
                  aria-label="Move block down"
                  title="Move down"
                >
                  ↓
                </button>
                <DeleteBlockButton onConfirm={() => removeAt(i)} />
              </div>
            </div>
            <div className="sl-skill-editor__body">
              <BlockForm
                block={block}
                onChange={(next) => updateAt(i, next)}
              />
            </div>
          </li>
        ))}
      </ol>

      <div className="sl-skill-editor__add">
        {!addOpen ? (
          <button
            type="button"
            className="sl-skill-btn sl-skill-btn--primary"
            onClick={() => setAddOpen(true)}
          >
            + Add block
          </button>
        ) : (
          <div className="sl-skill-editor__add-menu">
            <span>Choose block type:</span>
            {BLOCK_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className="sl-skill-btn"
                onClick={() => appendBlock(t)}
              >
                {BLOCK_LABELS[t]}
              </button>
            ))}
            <button
              type="button"
              className="sl-skill-btn sl-skill-btn--ghost"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Per-block form dispatch — each variant is its own component so TS's
// discriminated-union narrowing survives into nested closures.
// ============================================================================
function BlockForm({
  block,
  onChange,
}: {
  block: Block;
  onChange: (next: Block) => void;
}) {
  switch (block.type) {
    case "prose":
      return <ProseForm block={block} onChange={onChange} />;
    case "callout":
      return <CalloutForm block={block} onChange={onChange} />;
    case "checklist":
      return <ChecklistForm block={block} onChange={onChange} />;
    case "image":
      return <ImageForm block={block} onChange={onChange} />;
    case "video":
      return <VideoForm block={block} onChange={onChange} />;
    case "worked_example":
      return <WorkedExampleForm block={block} onChange={onChange} />;
    case "embed":
      return <EmbedForm block={block} onChange={onChange} />;
    case "accordion":
      return <AccordionForm block={block} onChange={onChange} />;
    case "think_aloud":
      return <ThinkAloudForm block={block} onChange={onChange} />;
    case "compare_images":
      return <CompareImagesForm block={block} onChange={onChange} />;
    case "gallery":
      return <GalleryForm block={block} onChange={onChange} />;
    case "code":
      return <CodeForm block={block} onChange={onChange} />;
    case "side_by_side":
      return <SideBySideForm block={block} onChange={onChange} />;
  }
}

// ----- Prose -----
function ProseForm({
  block,
  onChange,
}: {
  block: ProseBlock;
  onChange: (next: Block) => void;
}) {
  return (
    <textarea
      className="sl-skill-input sl-skill-textarea"
      placeholder="Paragraph text. Use **bold** or *italic*. Double line-breaks start a new paragraph."
      value={block.text}
      onChange={(e) => onChange({ ...block, text: e.target.value })}
      rows={6}
    />
  );
}

// ----- Callout -----
function CalloutForm({
  block,
  onChange,
}: {
  block: CalloutBlock;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="sl-skill-form">
      <label className="sl-skill-label">
        Tone
        <select
          className="sl-skill-input"
          value={block.tone}
          onChange={(e) =>
            onChange({ ...block, tone: e.target.value as CalloutBlock["tone"] })
          }
        >
          <option value="tip">Tip</option>
          <option value="warning">Warning</option>
          <option value="note">Note</option>
        </select>
      </label>
      <textarea
        className="sl-skill-input sl-skill-textarea"
        placeholder="Callout text"
        value={block.text}
        onChange={(e) => onChange({ ...block, text: e.target.value })}
        rows={3}
      />
    </div>
  );
}

// ----- Checklist -----
function ChecklistForm({
  block,
  onChange,
}: {
  block: ChecklistBlock;
  onChange: (next: Block) => void;
}) {
  function updateItem(idx: number, value: string) {
    const items = block.items.slice();
    items[idx] = value;
    onChange({ ...block, items });
  }
  function removeItem(idx: number) {
    const items = block.items.slice();
    items.splice(idx, 1);
    onChange({ ...block, items: items.length ? items : [""] });
  }
  function addItem() {
    onChange({ ...block, items: [...block.items, ""] });
  }
  return (
    <div className="sl-skill-form">
      {block.items.map((item, i) => (
        <div key={i} className="sl-skill-row">
          <input
            type="text"
            className="sl-skill-input"
            placeholder={`Item ${i + 1}`}
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
          />
          <button
            type="button"
            className="sl-skill-btn sl-skill-btn--tiny sl-skill-btn--danger"
            onClick={() => removeItem(i)}
            disabled={block.items.length === 1}
            aria-label={`Remove item ${i + 1}`}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="sl-skill-btn sl-skill-btn--ghost"
        onClick={addItem}
      >
        + Add item
      </button>
    </div>
  );
}

// ----- Image -----
function ImageForm({
  block,
  onChange,
}: {
  block: ImageBlock;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="sl-skill-form">
      <label className="sl-skill-label">
        Image URL
        <input
          type="url"
          className="sl-skill-input"
          placeholder="https://..."
          value={block.url}
          onChange={(e) => onChange({ ...block, url: e.target.value })}
        />
      </label>
      <label className="sl-skill-label">
        Alt text (for screen readers)
        <input
          type="text"
          className="sl-skill-input"
          placeholder="Brief description of the image"
          value={block.alt ?? ""}
          onChange={(e) => onChange({ ...block, alt: e.target.value })}
        />
      </label>
      <label className="sl-skill-label">
        Caption (optional)
        <input
          type="text"
          className="sl-skill-input"
          value={block.caption ?? ""}
          onChange={(e) => onChange({ ...block, caption: e.target.value })}
        />
      </label>
      <p className="sl-skill-help">
        Upload from disk is coming next — use a public URL for now.
      </p>
    </div>
  );
}

// ----- Video -----
function VideoForm({
  block,
  onChange,
}: {
  block: VideoBlock;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="sl-skill-form">
      <label className="sl-skill-label">
        Video URL (YouTube, Vimeo, or direct MP4)
        <input
          type="url"
          className="sl-skill-input"
          placeholder="https://..."
          value={block.url}
          onChange={(e) => onChange({ ...block, url: e.target.value })}
        />
      </label>
      <label className="sl-skill-label">
        Caption (optional)
        <input
          type="text"
          className="sl-skill-input"
          value={block.caption ?? ""}
          onChange={(e) => onChange({ ...block, caption: e.target.value })}
        />
      </label>
    </div>
  );
}

// ----- Worked example -----
function WorkedExampleForm({
  block,
  onChange,
}: {
  block: WorkedExampleBlock;
  onChange: (next: Block) => void;
}) {
  function updateStep(idx: number, value: string) {
    const steps = block.steps.slice();
    steps[idx] = value;
    onChange({ ...block, steps });
  }
  function removeStep(idx: number) {
    const steps = block.steps.slice();
    steps.splice(idx, 1);
    onChange({ ...block, steps: steps.length ? steps : [""] });
  }
  function addStep() {
    onChange({ ...block, steps: [...block.steps, ""] });
  }
  return (
    <div className="sl-skill-form">
      <label className="sl-skill-label">
        Title
        <input
          type="text"
          className="sl-skill-input"
          placeholder="e.g. Worked example: levelling the bed"
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </label>
      <div>
        <div className="sl-skill-sublabel">Steps</div>
        {block.steps.map((step, i) => (
          <div key={i} className="sl-skill-row">
            <span className="sl-skill-row__num">{i + 1}.</span>
            <input
              type="text"
              className="sl-skill-input"
              placeholder={`Step ${i + 1}`}
              value={step}
              onChange={(e) => updateStep(i, e.target.value)}
            />
            <button
              type="button"
              className="sl-skill-btn sl-skill-btn--tiny sl-skill-btn--danger"
              onClick={() => removeStep(i)}
              disabled={block.steps.length === 1}
              aria-label={`Remove step ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="sl-skill-btn sl-skill-btn--ghost"
          onClick={addStep}
        >
          + Add step
        </button>
      </div>
    </div>
  );
}

// ----- Embed -----
function EmbedForm({
  block,
  onChange,
}: {
  block: EmbedBlock;
  onChange: (next: Block) => void;
}) {
  const safe = !block.url || isSafeEmbedUrl(block.url);
  return (
    <div className="sl-skill-form">
      <label className="sl-skill-label">
        Embed URL
        <input
          type="url"
          className="sl-skill-input"
          placeholder="https://sketchfab.com/models/..., https://www.figma.com/..., https://codepen.io/..."
          value={block.url}
          onChange={(e) => onChange({ ...block, url: e.target.value })}
        />
      </label>
      {!safe && (
        <p className="sl-skill-help" style={{ color: "#b91c1c" }}>
          Domain not allowed. Supported: Sketchfab, Figma, Codepen, Miro,
          Desmos, Observable, GeoGebra. Use the Video block for YouTube/Vimeo.
        </p>
      )}
      <label className="sl-skill-label">
        Title (for accessibility)
        <input
          type="text"
          className="sl-skill-input"
          placeholder="e.g. 3D model of a bicycle frame"
          value={block.title ?? ""}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </label>
      <label className="sl-skill-label">
        Aspect ratio
        <select
          className="sl-skill-input"
          value={block.aspectRatio ?? "16:9"}
          onChange={(e) =>
            onChange({
              ...block,
              aspectRatio: e.target.value as EmbedBlock["aspectRatio"],
            })
          }
        >
          <option value="16:9">16:9 (widescreen)</option>
          <option value="4:3">4:3 (standard)</option>
          <option value="1:1">1:1 (square)</option>
        </select>
      </label>
      <label className="sl-skill-label">
        Caption (optional)
        <input
          type="text"
          className="sl-skill-input"
          value={block.caption ?? ""}
          onChange={(e) => onChange({ ...block, caption: e.target.value })}
        />
      </label>
    </div>
  );
}

// ----- Accordion -----
function AccordionForm({
  block,
  onChange,
}: {
  block: AccordionBlock;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="sl-skill-form">
      <label className="sl-skill-label">
        Section title (always visible)
        <input
          type="text"
          className="sl-skill-input"
          placeholder="e.g. Optional — advanced settings"
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </label>
      <label className="sl-skill-label">
        Body (shown when the student clicks to expand)
        <textarea
          className="sl-skill-input sl-skill-textarea"
          placeholder="Use **bold** / *italic*. Double line-breaks start a new paragraph."
          value={block.body}
          onChange={(e) => onChange({ ...block, body: e.target.value })}
          rows={5}
        />
      </label>
    </div>
  );
}

// ----- Think-aloud -----
function ThinkAloudForm({
  block,
  onChange,
}: {
  block: ThinkAloudBlock;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="sl-skill-form">
      <label className="sl-skill-label">
        Prompt (the question students see first)
        <textarea
          className="sl-skill-input sl-skill-textarea"
          placeholder="e.g. Why might a thinner wall cause your print to fail?"
          value={block.prompt}
          onChange={(e) => onChange({ ...block, prompt: e.target.value })}
          rows={3}
        />
      </label>
      <label className="sl-skill-label">
        Answer (hidden until they click &ldquo;Reveal answer&rdquo;)
        <textarea
          className="sl-skill-input sl-skill-textarea"
          placeholder="e.g. Thin walls warp because..."
          value={block.answer}
          onChange={(e) => onChange({ ...block, answer: e.target.value })}
          rows={4}
        />
      </label>
      <p className="sl-skill-help">
        Nudges students to predict before reading — high-impact teaching move.
      </p>
    </div>
  );
}

// ----- Compare images -----
function CompareImagesForm({
  block,
  onChange,
}: {
  block: CompareImagesBlock;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="sl-skill-form">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="sl-skill-label">
          Before image URL
          <input
            type="url"
            className="sl-skill-input"
            placeholder="https://..."
            value={block.beforeUrl}
            onChange={(e) => onChange({ ...block, beforeUrl: e.target.value })}
          />
        </label>
        <label className="sl-skill-label">
          After image URL
          <input
            type="url"
            className="sl-skill-input"
            placeholder="https://..."
            value={block.afterUrl}
            onChange={(e) => onChange({ ...block, afterUrl: e.target.value })}
          />
        </label>
        <label className="sl-skill-label">
          Before label
          <input
            type="text"
            className="sl-skill-input"
            placeholder="Before"
            value={block.beforeLabel ?? ""}
            onChange={(e) =>
              onChange({ ...block, beforeLabel: e.target.value })
            }
          />
        </label>
        <label className="sl-skill-label">
          After label
          <input
            type="text"
            className="sl-skill-input"
            placeholder="After"
            value={block.afterLabel ?? ""}
            onChange={(e) => onChange({ ...block, afterLabel: e.target.value })}
          />
        </label>
      </div>
      <label className="sl-skill-label">
        Caption (optional)
        <input
          type="text"
          className="sl-skill-input"
          value={block.caption ?? ""}
          onChange={(e) => onChange({ ...block, caption: e.target.value })}
        />
      </label>
      <p className="sl-skill-help">
        Both images should have the same aspect ratio for the slider to line up.
      </p>
    </div>
  );
}

// ----- Gallery -----
function GalleryForm({
  block,
  onChange,
}: {
  block: GalleryBlock;
  onChange: (next: Block) => void;
}) {
  function updateAt(
    i: number,
    patch: Partial<GalleryBlock["images"][number]>
  ) {
    const next = block.images.slice();
    next[i] = { ...next[i], ...patch };
    onChange({ ...block, images: next });
  }
  function removeAt(i: number) {
    const next = block.images.slice();
    next.splice(i, 1);
    onChange({
      ...block,
      images: next.length ? next : [{ url: "", caption: "", alt: "" }],
    });
  }
  function addOne() {
    onChange({
      ...block,
      images: [...block.images, { url: "", caption: "", alt: "" }],
    });
  }
  return (
    <div className="sl-skill-form">
      {block.images.map((img, i) => (
        <div
          key={i}
          className="sl-skill-form"
          style={{
            padding: "0.75rem",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
          }}
        >
          <div className="sl-skill-row">
            <span className="sl-skill-row__num">{i + 1}.</span>
            <input
              type="url"
              className="sl-skill-input"
              placeholder="Image URL"
              value={img.url}
              onChange={(e) => updateAt(i, { url: e.target.value })}
            />
            <button
              type="button"
              className="sl-skill-btn sl-skill-btn--tiny sl-skill-btn--danger"
              onClick={() => removeAt(i)}
              disabled={block.images.length === 1}
              aria-label={`Remove image ${i + 1}`}
            >
              ×
            </button>
          </div>
          <input
            type="text"
            className="sl-skill-input"
            placeholder="Alt text (screen readers)"
            value={img.alt ?? ""}
            onChange={(e) => updateAt(i, { alt: e.target.value })}
          />
          <input
            type="text"
            className="sl-skill-input"
            placeholder="Caption (optional)"
            value={img.caption ?? ""}
            onChange={(e) => updateAt(i, { caption: e.target.value })}
          />
        </div>
      ))}
      <button
        type="button"
        className="sl-skill-btn sl-skill-btn--ghost"
        onClick={addOne}
      >
        + Add image
      </button>
    </div>
  );
}

// ----- Code -----
function CodeForm({
  block,
  onChange,
}: {
  block: CodeBlockBlock;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="sl-skill-form">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="sl-skill-label">
          Language (display only)
          <input
            type="text"
            className="sl-skill-input"
            placeholder="e.g. js, python, gcode"
            value={block.language ?? ""}
            onChange={(e) => onChange({ ...block, language: e.target.value })}
          />
        </label>
        <label className="sl-skill-label">
          Filename (optional)
          <input
            type="text"
            className="sl-skill-input"
            placeholder="e.g. slicer-config.ini"
            value={block.filename ?? ""}
            onChange={(e) => onChange({ ...block, filename: e.target.value })}
          />
        </label>
      </div>
      <label className="sl-skill-label">
        Code
        <textarea
          className="sl-skill-input sl-skill-textarea"
          style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: "0.875rem" }}
          placeholder="Paste your code here…"
          value={block.code}
          onChange={(e) => onChange({ ...block, code: e.target.value })}
          rows={8}
        />
      </label>
    </div>
  );
}

// ----- Side-by-side -----
function SideBySideForm({
  block,
  onChange,
}: {
  block: SideBySideBlock;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="sl-skill-form">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="sl-skill-form">
          <label className="sl-skill-label">
            Left title (optional)
            <input
              type="text"
              className="sl-skill-input"
              placeholder="e.g. Good example"
              value={block.leftTitle ?? ""}
              onChange={(e) => onChange({ ...block, leftTitle: e.target.value })}
            />
          </label>
          <textarea
            className="sl-skill-input sl-skill-textarea"
            placeholder="Left column text. Use **bold** / *italic*."
            value={block.leftText}
            onChange={(e) => onChange({ ...block, leftText: e.target.value })}
            rows={5}
          />
        </div>
        <div className="sl-skill-form">
          <label className="sl-skill-label">
            Right title (optional)
            <input
              type="text"
              className="sl-skill-input"
              placeholder="e.g. Weak example"
              value={block.rightTitle ?? ""}
              onChange={(e) =>
                onChange({ ...block, rightTitle: e.target.value })
              }
            />
          </label>
          <textarea
            className="sl-skill-input sl-skill-textarea"
            placeholder="Right column text. Use **bold** / *italic*."
            value={block.rightText}
            onChange={(e) => onChange({ ...block, rightText: e.target.value })}
            rows={5}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Delete-block inline confirm
// ============================================================================
function DeleteBlockButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button
        type="button"
        className="sl-skill-btn sl-skill-btn--tiny sl-skill-btn--danger"
        onClick={() => setArmed(true)}
        aria-label="Delete block"
        title="Delete"
      >
        ×
      </button>
    );
  }
  return (
    <span className="sl-skill-confirm">
      Delete?
      <button
        type="button"
        className="sl-skill-btn sl-skill-btn--tiny sl-skill-btn--danger"
        onClick={onConfirm}
      >
        Yes
      </button>
      <button
        type="button"
        className="sl-skill-btn sl-skill-btn--tiny sl-skill-btn--ghost"
        onClick={() => setArmed(false)}
      >
        No
      </button>
    </span>
  );
}
