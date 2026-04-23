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
  type Block,
  type BlockType,
  type CalloutBlock,
  type ChecklistBlock,
  type ImageBlock,
  type ProseBlock,
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
