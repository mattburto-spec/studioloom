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
  AUTHORABLE_BLOCK_TYPES,
  emptyBlock,
  isSafeEmbedUrl,
  type AccordionBlock,
  type BeforeAfterBlock,
  type Block,
  type BlockType,
  type CalloutBlock,
  type ChecklistBlock,
  type CodeBlockBlock,
  type CompareImagesBlock,
  type ComprehensionCheckBlock,
  type EmbedBlock,
  type GalleryBlock,
  type ImageBlock,
  type KeyConceptBlock,
  type MicroStoryBlock,
  type ProseBlock,
  type ScenarioBlock,
  type SideBySideBlock,
  type StepByStepBlock,
  type ThinkAloudBlock,
  type VideoBlock,
  type VideoEmbedBlock,
  type WorkedExampleBlock,
} from "@/types/skills";

interface Props {
  blocks: Block[];
  onChange: (next: Block[]) => void;
}

const BLOCK_LABELS: Record<BlockType, string> = {
  // Rich (primary authoring vocabulary)
  key_concept: "Key concept",
  micro_story: "Micro-story",
  scenario: "Scenario",
  before_after: "Before / After",
  step_by_step: "Step by step",
  comprehension_check: "Quick check",
  video_embed: "Video",
  spot_the_hazard: "Spot the hazard",
  // Generic (kept)
  embed: "Embed",
  accordion: "Accordion",
  gallery: "Gallery",
  // Deprecated — never added via UI, labels only used for existing bodies
  prose: "Text (legacy)",
  callout: "Callout (legacy)",
  checklist: "Checklist (legacy)",
  image: "Image (legacy)",
  video: "Video (legacy)",
  worked_example: "Worked example (legacy)",
  think_aloud: "Think-aloud (legacy)",
  compare_images: "Before/After (legacy)",
  code: "Code (legacy)",
  side_by_side: "Side-by-side (legacy)",
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
            {AUTHORABLE_BLOCK_TYPES.map((t) => (
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
    // Rich pedagogical blocks
    case "key_concept":
      return <KeyConceptForm block={block} onChange={onChange} />;
    case "micro_story":
      return <MicroStoryForm block={block} onChange={onChange} />;
    case "scenario":
      return <ScenarioForm block={block} onChange={onChange} />;
    case "before_after":
      return <BeforeAfterForm block={block} onChange={onChange} />;
    case "step_by_step":
      return <StepByStepForm block={block} onChange={onChange} />;
    case "comprehension_check":
      return <ComprehensionCheckForm block={block} onChange={onChange} />;
    case "video_embed":
      return <VideoEmbedForm block={block} onChange={onChange} />;
    // Deprecated — can be edited if authored in a previous version, but
    // never added fresh via the add-block menu.
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
// ============================================================================
// RICH BLOCK FORMS — the primary authoring vocabulary (from the safety system).
// ============================================================================
// ============================================================================

// ----- KeyConcept -----
function KeyConceptForm({
  block,
  onChange,
}: {
  block: KeyConceptBlock;
  onChange: (next: Block) => void;
}) {
  function updateStringAt(
    field: "tips" | "examples",
    idx: number,
    value: string
  ) {
    const arr = (block[field] ?? []).slice();
    arr[idx] = value;
    onChange({ ...block, [field]: arr });
  }
  function removeStringAt(field: "tips" | "examples", idx: number) {
    const arr = (block[field] ?? []).slice();
    arr.splice(idx, 1);
    onChange({ ...block, [field]: arr.length ? arr : undefined });
  }
  function addString(field: "tips" | "examples") {
    const arr = (block[field] ?? []).slice();
    arr.push("");
    onChange({ ...block, [field]: arr });
  }
  return (
    <div className="sl-skill-form">
      <div className="grid grid-cols-1 md:grid-cols-[4rem_1fr] gap-3">
        <label className="sl-skill-label">
          Icon
          <input
            type="text"
            maxLength={4}
            className="sl-skill-input"
            placeholder="🔥"
            value={block.icon ?? ""}
            onChange={(e) => onChange({ ...block, icon: e.target.value })}
          />
        </label>
        <label className="sl-skill-label">
          Title
          <input
            type="text"
            className="sl-skill-input"
            placeholder="e.g. Soldering iron: handling &amp; storage"
            value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
          />
        </label>
      </div>
      <label className="sl-skill-label">
        Content (markdown-lite: **bold** / *italic* / paragraphs)
        <textarea
          className="sl-skill-input sl-skill-textarea"
          rows={6}
          value={block.content}
          onChange={(e) => onChange({ ...block, content: e.target.value })}
        />
      </label>
      <label className="sl-skill-label">
        Image URL (optional)
        <input
          type="url"
          className="sl-skill-input"
          placeholder="https://..."
          value={block.image ?? ""}
          onChange={(e) =>
            onChange({ ...block, image: e.target.value || undefined })
          }
        />
      </label>
      <div>
        <div className="flex items-center justify-between">
          <span className="sl-skill-sublabel">Tips</span>
          <button
            type="button"
            className="sl-skill-btn sl-skill-btn--ghost sl-skill-btn--tiny"
            onClick={() => addString("tips")}
          >
            + Tip
          </button>
        </div>
        {(block.tips ?? []).map((tip, i) => (
          <div key={i} className="sl-skill-row">
            <input
              type="text"
              className="sl-skill-input"
              value={tip}
              onChange={(e) => updateStringAt("tips", i, e.target.value)}
            />
            <button
              type="button"
              className="sl-skill-btn sl-skill-btn--tiny sl-skill-btn--danger"
              onClick={() => removeStringAt("tips", i)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between">
          <span className="sl-skill-sublabel">Examples</span>
          <button
            type="button"
            className="sl-skill-btn sl-skill-btn--ghost sl-skill-btn--tiny"
            onClick={() => addString("examples")}
          >
            + Example
          </button>
        </div>
        {(block.examples ?? []).map((ex, i) => (
          <div key={i} className="sl-skill-row">
            <input
              type="text"
              className="sl-skill-input"
              value={ex}
              onChange={(e) => updateStringAt("examples", i, e.target.value)}
            />
            <button
              type="button"
              className="sl-skill-btn sl-skill-btn--tiny sl-skill-btn--danger"
              onClick={() => removeStringAt("examples", i)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <label className="sl-skill-label">
        Warning (optional — shown as a highlighted callout)
        <textarea
          className="sl-skill-input sl-skill-textarea"
          rows={2}
          placeholder="e.g. Never leave the iron out of the stand, even for a second."
          value={block.warning ?? ""}
          onChange={(e) =>
            onChange({ ...block, warning: e.target.value || undefined })
          }
        />
      </label>
    </div>
  );
}

// ----- MicroStory -----
function MicroStoryForm({
  block,
  onChange,
}: {
  block: MicroStoryBlock;
  onChange: (next: Block) => void;
}) {
  function updatePrompt(
    idx: number,
    patch: Partial<MicroStoryBlock["analysis_prompts"][number]>
  ) {
    const next = block.analysis_prompts.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...block, analysis_prompts: next });
  }
  function removePrompt(idx: number) {
    const next = block.analysis_prompts.slice();
    next.splice(idx, 1);
    onChange({
      ...block,
      analysis_prompts: next.length
        ? next
        : [{ question: "", reveal_answer: "" }],
    });
  }
  function addPrompt() {
    onChange({
      ...block,
      analysis_prompts: [
        ...block.analysis_prompts,
        { question: "", reveal_answer: "" },
      ],
    });
  }
  return (
    <div className="sl-skill-form">
      <label className="sl-skill-label">
        Title
        <input
          type="text"
          className="sl-skill-input"
          placeholder="e.g. The Lithium Battery Incident"
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </label>
      <label className="sl-skill-label">
        <input
          type="checkbox"
          checked={block.is_real_incident}
          onChange={(e) =>
            onChange({ ...block, is_real_incident: e.target.checked })
          }
        />{" "}
        Mark as a real incident (adds &ldquo;Real incident&rdquo; badge)
      </label>
      <label className="sl-skill-label">
        Narrative — the story itself
        <textarea
          className="sl-skill-input sl-skill-textarea"
          rows={6}
          value={block.narrative}
          onChange={(e) => onChange({ ...block, narrative: e.target.value })}
        />
      </label>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="sl-skill-sublabel">
            Analysis prompts (question → click to reveal answer)
          </span>
          <button
            type="button"
            className="sl-skill-btn sl-skill-btn--ghost sl-skill-btn--tiny"
            onClick={addPrompt}
          >
            + Prompt
          </button>
        </div>
        {block.analysis_prompts.map((p, i) => (
          <div
            key={i}
            className="sl-skill-form"
            style={{
              padding: "0.75rem",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="sl-skill-sublabel">Prompt {i + 1}</span>
              <button
                type="button"
                className="sl-skill-btn sl-skill-btn--tiny sl-skill-btn--danger"
                onClick={() => removePrompt(i)}
              >
                ×
              </button>
            </div>
            <input
              type="text"
              className="sl-skill-input"
              placeholder="Question"
              value={p.question}
              onChange={(e) => updatePrompt(i, { question: e.target.value })}
            />
            <textarea
              className="sl-skill-input sl-skill-textarea"
              rows={2}
              placeholder="Answer (hidden until revealed)"
              value={p.reveal_answer}
              onChange={(e) =>
                updatePrompt(i, { reveal_answer: e.target.value })
              }
            />
          </div>
        ))}
      </div>
      <label className="sl-skill-label">
        Key lesson
        <textarea
          className="sl-skill-input sl-skill-textarea"
          rows={2}
          placeholder="The headline takeaway from this story."
          value={block.key_lesson}
          onChange={(e) => onChange({ ...block, key_lesson: e.target.value })}
        />
      </label>
      <label className="sl-skill-label">
        Related rule (optional)
        <input
          type="text"
          className="sl-skill-input"
          placeholder="e.g. Workshop rule #3: never charge unfamiliar batteries"
          value={block.related_rule ?? ""}
          onChange={(e) =>
            onChange({ ...block, related_rule: e.target.value || undefined })
          }
        />
      </label>
    </div>
  );
}

// ----- Scenario -----
function ScenarioForm({
  block,
  onChange,
}: {
  block: ScenarioBlock;
  onChange: (next: Block) => void;
}) {
  function updateBranch(
    idx: number,
    patch: Partial<ScenarioBlock["branches"][number]>
  ) {
    const next = block.branches.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...block, branches: next });
  }
  function removeBranch(idx: number) {
    const next = block.branches.slice();
    next.splice(idx, 1);
    onChange({ ...block, branches: next });
  }
  function addBranch() {
    const id = `b${block.branches.length + 1}`;
    onChange({
      ...block,
      branches: [
        ...block.branches,
        { id, choice_text: "", is_correct: false, feedback: "" },
      ],
    });
  }
  return (
    <div className="sl-skill-form">
      <label className="sl-skill-label">
        Title
        <input
          type="text"
          className="sl-skill-input"
          placeholder="e.g. Your partner leaves the saw running"
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </label>
      <label className="sl-skill-label">
        Setup — describe the situation
        <textarea
          className="sl-skill-input sl-skill-textarea"
          rows={4}
          value={block.setup}
          onChange={(e) => onChange({ ...block, setup: e.target.value })}
        />
      </label>
      <label className="sl-skill-label">
        Illustration URL (optional)
        <input
          type="url"
          className="sl-skill-input"
          placeholder="https://..."
          value={block.illustration ?? ""}
          onChange={(e) =>
            onChange({ ...block, illustration: e.target.value || undefined })
          }
        />
      </label>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="sl-skill-sublabel">Choices / branches</span>
          <button
            type="button"
            className="sl-skill-btn sl-skill-btn--ghost sl-skill-btn--tiny"
            onClick={addBranch}
          >
            + Branch
          </button>
        </div>
        {block.branches.map((b, i) => (
          <div
            key={b.id}
            className="sl-skill-form"
            style={{
              padding: "0.75rem",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="sl-skill-sublabel">Branch {i + 1} · id: {b.id}</span>
              <button
                type="button"
                className="sl-skill-btn sl-skill-btn--tiny sl-skill-btn--danger"
                onClick={() => removeBranch(i)}
                disabled={block.branches.length <= 2}
                title={
                  block.branches.length <= 2
                    ? "A scenario needs at least 2 branches"
                    : undefined
                }
              >
                ×
              </button>
            </div>
            <input
              type="text"
              className="sl-skill-input"
              placeholder="Choice text (what the student picks)"
              value={b.choice_text}
              onChange={(e) =>
                updateBranch(i, { choice_text: e.target.value })
              }
            />
            <label className="sl-skill-label">
              <input
                type="checkbox"
                checked={b.is_correct}
                onChange={(e) =>
                  updateBranch(i, { is_correct: e.target.checked })
                }
              />{" "}
              This is a correct choice
            </label>
            <textarea
              className="sl-skill-input sl-skill-textarea"
              rows={2}
              placeholder="Feedback shown after they pick this"
              value={b.feedback}
              onChange={(e) => updateBranch(i, { feedback: e.target.value })}
            />
            <input
              type="text"
              className="sl-skill-input"
              placeholder="Consequence (optional — what happens next)"
              value={b.consequence ?? ""}
              onChange={(e) =>
                updateBranch(i, { consequence: e.target.value || undefined })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ----- BeforeAfter -----
function BeforeAfterForm({
  block,
  onChange,
}: {
  block: BeforeAfterBlock;
  onChange: (next: Block) => void;
}) {
  // Split per side so TS narrowing holds — the two sides have different
  // child-list fields (hazards vs principles).
  function patchBefore(patch: Partial<BeforeAfterBlock["before"]>) {
    onChange({ ...block, before: { ...block.before, ...patch } });
  }
  function patchAfter(patch: Partial<BeforeAfterBlock["after"]>) {
    onChange({ ...block, after: { ...block.after, ...patch } });
  }
  function updateHazard(idx: number, value: string) {
    const next = block.before.hazards.slice();
    next[idx] = value;
    patchBefore({ hazards: next });
  }
  function removeHazard(idx: number) {
    const next = block.before.hazards.slice();
    next.splice(idx, 1);
    patchBefore({ hazards: next.length ? next : [""] });
  }
  function addHazard() {
    patchBefore({ hazards: [...block.before.hazards, ""] });
  }
  function updatePrinciple(idx: number, value: string) {
    const next = block.after.principles.slice();
    next[idx] = value;
    patchAfter({ principles: next });
  }
  function removePrinciple(idx: number) {
    const next = block.after.principles.slice();
    next.splice(idx, 1);
    patchAfter({ principles: next.length ? next : [""] });
  }
  function addPrinciple() {
    patchAfter({ principles: [...block.after.principles, ""] });
  }
  return (
    <div className="sl-skill-form">
      <label className="sl-skill-label">
        Title
        <input
          type="text"
          className="sl-skill-input"
          placeholder="e.g. Good bench setup vs messy bench setup"
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* BEFORE side */}
        <div
          className="sl-skill-form"
          style={{
            padding: "0.75rem",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
          }}
        >
          <div className="sl-skill-sublabel">Before</div>
          <input
            type="url"
            className="sl-skill-input"
            placeholder="Image URL (optional)"
            value={block.before.image ?? ""}
            onChange={(e) =>
              patchBefore({ image: e.target.value || undefined })
            }
          />
          <input
            type="text"
            className="sl-skill-input"
            placeholder="Caption"
            value={block.before.caption}
            onChange={(e) => patchBefore({ caption: e.target.value })}
          />
          <div className="flex items-center justify-between">
            <span className="sl-skill-sublabel">Hazards</span>
            <button
              type="button"
              className="sl-skill-btn sl-skill-btn--ghost sl-skill-btn--tiny"
              onClick={addHazard}
            >
              + Hazard
            </button>
          </div>
          {block.before.hazards.map((item, i) => (
            <div key={i} className="sl-skill-row">
              <input
                type="text"
                className="sl-skill-input"
                value={item}
                onChange={(e) => updateHazard(i, e.target.value)}
              />
              <button
                type="button"
                className="sl-skill-btn sl-skill-btn--tiny sl-skill-btn--danger"
                onClick={() => removeHazard(i)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* AFTER side */}
        <div
          className="sl-skill-form"
          style={{
            padding: "0.75rem",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
          }}
        >
          <div className="sl-skill-sublabel">After</div>
          <input
            type="url"
            className="sl-skill-input"
            placeholder="Image URL (optional)"
            value={block.after.image ?? ""}
            onChange={(e) =>
              patchAfter({ image: e.target.value || undefined })
            }
          />
          <input
            type="text"
            className="sl-skill-input"
            placeholder="Caption"
            value={block.after.caption}
            onChange={(e) => patchAfter({ caption: e.target.value })}
          />
          <div className="flex items-center justify-between">
            <span className="sl-skill-sublabel">Principles</span>
            <button
              type="button"
              className="sl-skill-btn sl-skill-btn--ghost sl-skill-btn--tiny"
              onClick={addPrinciple}
            >
              + Principle
            </button>
          </div>
          {block.after.principles.map((item, i) => (
            <div key={i} className="sl-skill-row">
              <input
                type="text"
                className="sl-skill-input"
                value={item}
                onChange={(e) => updatePrinciple(i, e.target.value)}
              />
              <button
                type="button"
                className="sl-skill-btn sl-skill-btn--tiny sl-skill-btn--danger"
                onClick={() => removePrinciple(i)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
      <label className="sl-skill-label">
        Key difference (the headline takeaway)
        <textarea
          className="sl-skill-input sl-skill-textarea"
          rows={2}
          value={block.key_difference}
          onChange={(e) =>
            onChange({ ...block, key_difference: e.target.value })
          }
        />
      </label>
    </div>
  );
}

// ----- StepByStep -----
function StepByStepForm({
  block,
  onChange,
}: {
  block: StepByStepBlock;
  onChange: (next: Block) => void;
}) {
  function updateStep(
    idx: number,
    patch: Partial<StepByStepBlock["steps"][number]>
  ) {
    const next = block.steps.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...block, steps: next });
  }
  function removeStep(idx: number) {
    const next = block.steps.slice();
    next.splice(idx, 1);
    onChange({
      ...block,
      steps: next.length
        ? next.map((s, i) => ({ ...s, number: i + 1 }))
        : [{ number: 1, instruction: "" }],
    });
  }
  function addStep() {
    onChange({
      ...block,
      steps: [
        ...block.steps,
        { number: block.steps.length + 1, instruction: "" },
      ],
    });
  }
  return (
    <div className="sl-skill-form">
      <label className="sl-skill-label">
        Title
        <input
          type="text"
          className="sl-skill-input"
          placeholder="e.g. Setting up the 3D printer"
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </label>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="sl-skill-sublabel">Steps</span>
          <button
            type="button"
            className="sl-skill-btn sl-skill-btn--ghost sl-skill-btn--tiny"
            onClick={addStep}
          >
            + Step
          </button>
        </div>
        {block.steps.map((s, i) => (
          <div
            key={i}
            className="sl-skill-form"
            style={{
              padding: "0.75rem",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="sl-skill-sublabel">Step {s.number}</span>
              <button
                type="button"
                className="sl-skill-btn sl-skill-btn--tiny sl-skill-btn--danger"
                onClick={() => removeStep(i)}
                disabled={block.steps.length === 1}
              >
                ×
              </button>
            </div>
            <textarea
              className="sl-skill-input sl-skill-textarea"
              rows={2}
              placeholder="Instruction"
              value={s.instruction}
              onChange={(e) => updateStep(i, { instruction: e.target.value })}
            />
            <input
              type="url"
              className="sl-skill-input"
              placeholder="Image URL (optional)"
              value={s.image ?? ""}
              onChange={(e) =>
                updateStep(i, { image: e.target.value || undefined })
              }
            />
            <input
              type="text"
              className="sl-skill-input"
              placeholder="Warning (optional)"
              value={s.warning ?? ""}
              onChange={(e) =>
                updateStep(i, { warning: e.target.value || undefined })
              }
            />
            <input
              type="text"
              className="sl-skill-input"
              placeholder="Checkpoint — thing to verify before moving on (optional)"
              value={s.checkpoint ?? ""}
              onChange={(e) =>
                updateStep(i, { checkpoint: e.target.value || undefined })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ----- ComprehensionCheck -----
function ComprehensionCheckForm({
  block,
  onChange,
}: {
  block: ComprehensionCheckBlock;
  onChange: (next: Block) => void;
}) {
  function updateOption(idx: number, value: string) {
    const next = block.options.slice();
    next[idx] = value;
    onChange({ ...block, options: next });
  }
  function removeOption(idx: number) {
    const next = block.options.slice();
    next.splice(idx, 1);
    let correctIndex = block.correct_index;
    if (correctIndex >= next.length) correctIndex = 0;
    onChange({ ...block, options: next.length >= 2 ? next : block.options, correct_index: correctIndex });
  }
  function addOption() {
    onChange({ ...block, options: [...block.options, ""] });
  }
  return (
    <div className="sl-skill-form">
      <label className="sl-skill-label">
        Question
        <textarea
          className="sl-skill-input sl-skill-textarea"
          rows={2}
          value={block.question}
          onChange={(e) => onChange({ ...block, question: e.target.value })}
        />
      </label>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="sl-skill-sublabel">
            Options (select the radio for the correct one)
          </span>
          <button
            type="button"
            className="sl-skill-btn sl-skill-btn--ghost sl-skill-btn--tiny"
            onClick={addOption}
          >
            + Option
          </button>
        </div>
        {block.options.map((opt, i) => (
          <div key={i} className="sl-skill-row">
            <input
              type="radio"
              name={`cc-correct-${block.question.slice(0, 8)}`}
              checked={block.correct_index === i}
              onChange={() => onChange({ ...block, correct_index: i })}
              aria-label={`Mark option ${i + 1} as correct`}
            />
            <input
              type="text"
              className="sl-skill-input"
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
            />
            <button
              type="button"
              className="sl-skill-btn sl-skill-btn--tiny sl-skill-btn--danger"
              onClick={() => removeOption(i)}
              disabled={block.options.length <= 2}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <label className="sl-skill-label">
        Feedback on correct pick
        <textarea
          className="sl-skill-input sl-skill-textarea"
          rows={2}
          value={block.feedback_correct}
          onChange={(e) =>
            onChange({ ...block, feedback_correct: e.target.value })
          }
        />
      </label>
      <label className="sl-skill-label">
        Feedback on wrong pick
        <textarea
          className="sl-skill-input sl-skill-textarea"
          rows={2}
          value={block.feedback_wrong}
          onChange={(e) =>
            onChange({ ...block, feedback_wrong: e.target.value })
          }
        />
      </label>
      <label className="sl-skill-label">
        Hint (shown on 2nd attempt, optional)
        <input
          type="text"
          className="sl-skill-input"
          value={block.hint ?? ""}
          onChange={(e) =>
            onChange({ ...block, hint: e.target.value || undefined })
          }
        />
      </label>
    </div>
  );
}

// ----- VideoEmbed (with trim) -----
function VideoEmbedForm({
  block,
  onChange,
}: {
  block: VideoEmbedBlock;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="sl-skill-form">
      <label className="sl-skill-label">
        Video URL (YouTube / Vimeo / direct MP4)
        <input
          type="url"
          className="sl-skill-input"
          placeholder="https://..."
          value={block.url}
          onChange={(e) => onChange({ ...block, url: e.target.value })}
        />
      </label>
      <label className="sl-skill-label">
        Title (for accessibility)
        <input
          type="text"
          className="sl-skill-input"
          value={block.title ?? ""}
          onChange={(e) =>
            onChange({ ...block, title: e.target.value || undefined })
          }
        />
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="sl-skill-label">
          Trim: start time (seconds, optional)
          <input
            type="number"
            min={0}
            className="sl-skill-input"
            value={block.start_time ?? ""}
            onChange={(e) =>
              onChange({
                ...block,
                start_time: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </label>
        <label className="sl-skill-label">
          Trim: end time (seconds, optional)
          <input
            type="number"
            min={0}
            className="sl-skill-input"
            value={block.end_time ?? ""}
            onChange={(e) =>
              onChange({
                ...block,
                end_time: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </label>
      </div>
      <label className="sl-skill-label">
        Caption (optional)
        <input
          type="text"
          className="sl-skill-input"
          value={block.caption ?? ""}
          onChange={(e) =>
            onChange({ ...block, caption: e.target.value || undefined })
          }
        />
      </label>
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
