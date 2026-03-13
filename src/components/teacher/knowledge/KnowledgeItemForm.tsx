"use client";

import { useState } from "react";
import { KNOWLEDGE_ITEM_TYPES, type KnowledgeItemTypeKey } from "@/lib/constants";
import type {
  KnowledgeItem,
  KnowledgeItemType,
  KnowledgeItemContent,
  KnowledgeItemCurriculum,
  TutorialContent,
  ChoiceBoardContent,
  ReferenceContent,
  SkillGuideContent,
  TextbookSectionContent,
  LessonResourceContent,
  MediaContent,
} from "@/types/knowledge-library";
import TagAutocomplete from "./TagAutocomplete";
import CurriculumMapper from "./CurriculumMapper";
import MediaUploader from "./MediaUploader";

type CurriculumRow = Omit<KnowledgeItemCurriculum, "id" | "item_id">;

interface KnowledgeItemFormProps {
  item: KnowledgeItem | null;
  onSave: () => void;
  onCancel: () => void;
}

const TYPE_OPTIONS = Object.entries(KNOWLEDGE_ITEM_TYPES).map(([key, meta]) => ({
  value: key as KnowledgeItemType,
  label: meta.label,
}));

interface FormState {
  title: string;
  description: string;
  item_type: KnowledgeItemType;
  tags: string[];
  content: KnowledgeItemContent;
  thumbnail_url: string | null;
  media_url: string | null;
  is_public: boolean;
  curricula: CurriculumRow[];
}

function getDefaultContent(type: KnowledgeItemType): KnowledgeItemContent {
  switch (type) {
    case "tutorial":
      return { steps: [{ title: "", instruction: "" }] } as TutorialContent;
    case "choice-board":
      return { tasks: [{ id: "1", label: "", description: "" }], instructions: "" } as ChoiceBoardContent;
    case "reference":
      return { body: "" } as ReferenceContent;
    case "skill-guide":
      return { steps: [{ title: "", description: "" }] } as SkillGuideContent;
    case "textbook-section":
      return { key_points: [""] } as TextbookSectionContent;
    case "lesson-resource":
      return { notes: "" } as LessonResourceContent;
    case "image":
    case "video":
    case "audio":
      return { url: "", alt_text: "" } as MediaContent;
    default:
      return {};
  }
}

export default function KnowledgeItemForm({
  item,
  onSave,
  onCancel,
}: KnowledgeItemFormProps) {
  const isEditing = !!item;

  const [form, setForm] = useState<FormState>(() => {
    if (item) {
      return {
        title: item.title,
        description: item.description,
        item_type: item.item_type,
        tags: item.tags,
        content: item.content,
        thumbnail_url: item.thumbnail_url,
        media_url: item.media_url,
        is_public: item.is_public,
        curricula: [],
      };
    }
    return {
      title: "",
      description: "",
      item_type: "reference",
      tags: [],
      content: getDefaultContent("reference"),
      thumbnail_url: null,
      media_url: null,
      is_public: false,
      curricula: [],
    };
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleTypeChange(type: KnowledgeItemType) {
    updateForm("item_type", type);
    updateForm("content", getDefaultContent(type));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = isEditing
        ? `/api/teacher/knowledge/items/${item!.id}`
        : "/api/teacher/knowledge/items";

      const body = isEditing
        ? {
            title: form.title.trim(),
            description: form.description.trim(),
            item_type: form.item_type,
            tags: form.tags,
            content: form.content,
            thumbnail_url: form.thumbnail_url,
            media_url: form.media_url,
            is_public: form.is_public,
          }
        : {
            title: form.title.trim(),
            description: form.description.trim(),
            item_type: form.item_type,
            tags: form.tags,
            content: form.content,
            thumbnail_url: form.thumbnail_url,
            media_url: form.media_url,
            is_public: form.is_public,
            curricula: form.curricula.length > 0 ? form.curricula : undefined,
          };

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      // Update curricula separately if editing
      if (isEditing && form.curricula.length > 0) {
        await fetch(`/api/teacher/knowledge/items/${item!.id}/curricula`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ curricula: form.curricula }),
        });
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-text-primary">
          {isEditing ? `Edit: ${item!.title}` : "Create Knowledge Item"}
        </h2>
        <button onClick={onCancel} className="text-text-secondary hover:text-text-primary transition">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Title */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-text-primary mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateForm("title", e.target.value)}
              placeholder="e.g. Introduction to 3D Printing"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
              required
            />
          </div>

          {/* Description */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-text-primary mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
              placeholder="Brief description of this resource"
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Type <span className="text-red-400">*</span>
            </label>
            <select
              value={form.item_type}
              onChange={(e) => handleTypeChange(e.target.value as KnowledgeItemType)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Public toggle */}
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={(e) => updateForm("is_public", e.target.checked)}
                className="rounded border-border text-brand-purple focus:ring-brand-purple/30"
              />
              <span className="text-sm text-text-primary">Public</span>
            </label>
          </div>

          {/* Tags */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-text-primary mb-1">
              Tags
            </label>
            <TagAutocomplete
              value={form.tags}
              onChange={(tags) => updateForm("tags", tags)}
            />
          </div>

          {/* Thumbnail */}
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Thumbnail
            </label>
            <MediaUploader
              value={form.thumbnail_url}
              onChange={(url) => updateForm("thumbnail_url", url)}
              accept="image/*"
              label="Upload thumbnail"
              maxSizeMB={5}
            />
          </div>

          {/* Media URL (for media types) */}
          {["image", "video", "audio"].includes(form.item_type) && (
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Media File
              </label>
              <MediaUploader
                value={form.media_url}
                onChange={(url) => updateForm("media_url", url)}
                label={`Upload ${form.item_type}`}
              />
            </div>
          )}

          {/* Type-specific content editor */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-text-primary mb-1">
              Content
            </label>
            <ContentEditor
              type={form.item_type}
              content={form.content}
              onChange={(content) => updateForm("content", content)}
            />
          </div>

          {/* Curriculum mapping */}
          <div className="col-span-2">
            <details>
              <summary className="text-xs font-medium text-text-secondary cursor-pointer hover:text-text-primary transition list-none flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform [details[open]>&]:rotate-90">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Curriculum mapping
              </summary>
              <div className="mt-2">
                <CurriculumMapper
                  value={form.curricula}
                  onChange={(curricula) => updateForm("curricula", curricula)}
                />
              </div>
            </details>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 gradient-cta text-white rounded-lg text-sm font-medium shadow-md shadow-brand-pink/20 hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : isEditing ? "Update Item" : "Create Item"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content editors per type
// ---------------------------------------------------------------------------

function ContentEditor({
  type,
  content,
  onChange,
}: {
  type: KnowledgeItemType;
  content: KnowledgeItemContent;
  onChange: (content: KnowledgeItemContent) => void;
}) {
  switch (type) {
    case "tutorial":
      return <TutorialEditor content={content as TutorialContent} onChange={onChange} />;
    case "choice-board":
      return <ChoiceBoardEditor content={content as ChoiceBoardContent} onChange={onChange} />;
    case "reference":
      return <ReferenceEditor content={content as ReferenceContent} onChange={onChange} />;
    case "skill-guide":
      return <SkillGuideEditor content={content as SkillGuideContent} onChange={onChange} />;
    case "textbook-section":
      return <TextbookEditor content={content as TextbookSectionContent} onChange={onChange} />;
    case "lesson-resource":
      return <LessonResourceEditor content={content as LessonResourceContent} onChange={onChange} />;
    case "image":
    case "video":
    case "audio":
      return <MediaContentEditor content={content as MediaContent} onChange={onChange} />;
    default:
      return (
        <textarea
          value={JSON.stringify(content, null, 2)}
          onChange={(e) => {
            try { onChange(JSON.parse(e.target.value)); } catch { /* ignore parse errors while typing */ }
          }}
          rows={4}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none"
          placeholder="JSON content..."
        />
      );
  }
}

// --- Tutorial editor ---
function TutorialEditor({ content, onChange }: { content: TutorialContent; onChange: (c: TutorialContent) => void }) {
  const steps = content.steps || [];

  function updateStep(i: number, field: string, value: string) {
    const updated = [...steps];
    updated[i] = { ...updated[i], [field]: value };
    onChange({ ...content, steps: updated });
  }

  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-xs text-text-secondary/50 pt-2 w-6 flex-shrink-0">{i + 1}.</span>
          <div className="flex-1 space-y-1">
            <input
              type="text"
              value={step.title}
              onChange={(e) => updateStep(i, "title", e.target.value)}
              placeholder="Step title"
              className="w-full border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40"
            />
            <textarea
              value={step.instruction}
              onChange={(e) => updateStep(i, "instruction", e.target.value)}
              placeholder="Instructions"
              rows={2}
              className="w-full border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40 resize-none"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...content, steps: steps.filter((_, j) => j !== i) })}
            className="text-text-secondary/30 hover:text-red-400 pt-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...content, steps: [...steps, { title: "", instruction: "" }] })}
        className="text-xs text-brand-purple hover:underline"
      >
        + Add step
      </button>
    </div>
  );
}

// --- Choice board editor ---
function ChoiceBoardEditor({ content, onChange }: { content: ChoiceBoardContent; onChange: (c: ChoiceBoardContent) => void }) {
  const tasks = content.tasks || [];

  function updateTask(i: number, field: string, value: string) {
    const updated = [...tasks];
    updated[i] = { ...updated[i], [field]: value };
    onChange({ ...content, tasks: updated });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={content.instructions || ""}
        onChange={(e) => onChange({ ...content, instructions: e.target.value })}
        placeholder="Instructions for students..."
        rows={2}
        className="w-full border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40 resize-none"
      />
      {tasks.map((task, i) => (
        <div key={i} className="flex gap-2 border border-border rounded-lg p-2">
          <div className="flex-1 space-y-1">
            <input
              type="text"
              value={task.label}
              onChange={(e) => updateTask(i, "label", e.target.value)}
              placeholder="Task label"
              className="w-full border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40"
            />
            <textarea
              value={task.description}
              onChange={(e) => updateTask(i, "description", e.target.value)}
              placeholder="Task description"
              rows={2}
              className="w-full border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40 resize-none"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...content, tasks: tasks.filter((_, j) => j !== i) })}
            className="text-text-secondary/30 hover:text-red-400 pt-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...content, tasks: [...tasks, { id: String(tasks.length + 1), label: "", description: "" }] })}
        className="text-xs text-brand-purple hover:underline"
      >
        + Add task
      </button>
    </div>
  );
}

// --- Reference editor ---
function ReferenceEditor({ content, onChange }: { content: ReferenceContent; onChange: (c: ReferenceContent) => void }) {
  return (
    <div className="space-y-2">
      <textarea
        value={content.body || ""}
        onChange={(e) => onChange({ ...content, body: e.target.value })}
        placeholder="Reference content (Markdown supported)"
        rows={8}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-y font-mono"
      />
      <input
        type="url"
        value={content.source_url || ""}
        onChange={(e) => onChange({ ...content, source_url: e.target.value })}
        placeholder="Source URL (optional)"
        className="w-full border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40"
      />
    </div>
  );
}

// --- Skill guide editor ---
function SkillGuideEditor({ content, onChange }: { content: SkillGuideContent; onChange: (c: SkillGuideContent) => void }) {
  const steps = content.steps || [];

  function updateStep(i: number, field: string, value: string) {
    const updated = [...steps];
    updated[i] = { ...updated[i], [field]: value };
    onChange({ ...content, steps: updated });
  }

  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-xs text-text-secondary/50 pt-2 w-6 flex-shrink-0">{i + 1}.</span>
          <div className="flex-1 space-y-1">
            <input
              type="text"
              value={step.title}
              onChange={(e) => updateStep(i, "title", e.target.value)}
              placeholder="Step title"
              className="w-full border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40"
            />
            <textarea
              value={step.description}
              onChange={(e) => updateStep(i, "description", e.target.value)}
              placeholder="Description"
              rows={2}
              className="w-full border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40 resize-none"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...content, steps: steps.filter((_, j) => j !== i) })}
            className="text-text-secondary/30 hover:text-red-400 pt-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ ...content, steps: [...steps, { title: "", description: "" }] })}
        className="text-xs text-brand-purple hover:underline"
      >
        + Add step
      </button>
    </div>
  );
}

// --- Textbook section editor ---
function TextbookEditor({ content, onChange }: { content: TextbookSectionContent; onChange: (c: TextbookSectionContent) => void }) {
  const points = content.key_points || [];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={content.chapter || ""}
          onChange={(e) => onChange({ ...content, chapter: e.target.value })}
          placeholder="Chapter"
          className="border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40"
        />
        <input
          type="text"
          value={content.page_range || ""}
          onChange={(e) => onChange({ ...content, page_range: e.target.value })}
          placeholder="Page range (e.g. 42-58)"
          className="border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40"
        />
      </div>
      <div className="space-y-1">
        <span className="text-xs text-text-secondary">Key points:</span>
        {points.map((point, i) => (
          <div key={i} className="flex gap-1">
            <input
              type="text"
              value={point}
              onChange={(e) => {
                const updated = [...points];
                updated[i] = e.target.value;
                onChange({ ...content, key_points: updated });
              }}
              placeholder={`Key point ${i + 1}`}
              className="flex-1 border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40"
            />
            <button
              type="button"
              onClick={() => onChange({ ...content, key_points: points.filter((_, j) => j !== i) })}
              className="text-text-secondary/30 hover:text-red-400"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...content, key_points: [...points, ""] })}
          className="text-xs text-brand-purple hover:underline"
        >
          + Add key point
        </button>
      </div>
    </div>
  );
}

// --- Lesson resource editor ---
function LessonResourceEditor({ content, onChange }: { content: LessonResourceContent; onChange: (c: LessonResourceContent) => void }) {
  return (
    <div className="space-y-2">
      <input
        type="url"
        value={content.resource_url || ""}
        onChange={(e) => onChange({ ...content, resource_url: e.target.value })}
        placeholder="Resource URL"
        className="w-full border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40"
      />
      <select
        value={content.embed_type || ""}
        onChange={(e) => onChange({ ...content, embed_type: (e.target.value || undefined) as "video" | "iframe" | "link" | undefined })}
        className="border border-border rounded px-2 py-1 text-xs text-text-primary"
      >
        <option value="">Embed type...</option>
        <option value="video">Video</option>
        <option value="iframe">iFrame</option>
        <option value="link">Link</option>
      </select>
      <textarea
        value={content.notes || ""}
        onChange={(e) => onChange({ ...content, notes: e.target.value })}
        placeholder="Teacher notes"
        rows={3}
        className="w-full border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40 resize-none"
      />
    </div>
  );
}

// --- Media content editor ---
function MediaContentEditor({ content, onChange }: { content: MediaContent; onChange: (c: MediaContent) => void }) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={content.alt_text || ""}
        onChange={(e) => onChange({ ...content, alt_text: e.target.value })}
        placeholder="Alt text / description"
        className="w-full border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40"
      />
      <input
        type="text"
        value={content.caption || ""}
        onChange={(e) => onChange({ ...content, caption: e.target.value })}
        placeholder="Caption"
        className="w-full border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40"
      />
    </div>
  );
}
