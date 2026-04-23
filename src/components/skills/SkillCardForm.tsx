"use client";

/**
 * SkillCardForm — shared authoring form for /teacher/skills/new and /edit.
 *
 * Controlled component that owns the card metadata + tags + external links +
 * prereqs state locally, then calls onSubmit(payload) with the final shape.
 *
 * Read-only mode renders a preview (e.g. for built-in cards): no inputs, just
 * the rendered blocks.
 */

import { useEffect, useMemo, useState } from "react";
import { BlockEditor } from "./BlockEditor";
import { BlockRenderer } from "./BlockRenderer";
import "./skills.css";
import type {
  Block,
  CreateSkillCardPayload,
  SkillCardHydrated,
  SkillDifficulty,
} from "@/types/skills";

interface Category {
  id: string;
  label: string;
  description: string;
}

interface PrereqOption {
  id: string;
  slug: string;
  title: string;
  difficulty: string | null;
}

interface Props {
  mode: "create" | "edit";
  initial?: SkillCardHydrated;
  categories: Category[];
  onSubmit: (payload: CreateSkillCardPayload) => Promise<void>;
  submitting: boolean;
  submitError: string | null;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function SkillCardForm({
  mode,
  initial,
  categories,
  onSubmit,
  submitting,
  submitError,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [difficulty, setDifficulty] = useState<SkillDifficulty | "">(
    initial?.difficulty ?? ""
  );
  const [estimatedMin, setEstimatedMin] = useState<string>(
    initial?.estimated_min?.toString() ?? ""
  );
  const [body, setBody] = useState<Block[]>(initial?.body ?? []);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [links, setLinks] = useState<
    Array<{ url: string; title: string; kind: string }>
  >(
    (initial?.external_links ?? []).map((l) => ({
      url: l.url,
      title: l.title ?? "",
      kind: l.kind ?? "",
    }))
  );
  const [prereqIds, setPrereqIds] = useState<string[]>(
    (initial?.prerequisites ?? []).map((p) => p.id)
  );
  const [prereqSearch, setPrereqSearch] = useState("");
  const [prereqOptions, setPrereqOptions] = useState<PrereqOption[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Auto-slug from title until the user edits slug manually.
  useEffect(() => {
    if (!slugTouched && mode === "create") {
      setSlug(slugify(title));
    }
  }, [title, slugTouched, mode]);

  // Fuzzy prereq search — debounced.
  useEffect(() => {
    const q = prereqSearch.trim();
    if (q.length < 2) {
      setPrereqOptions([]);
      return;
    }
    const id = window.setTimeout(async () => {
      const res = await fetch(
        `/api/teacher/skills/cards?ownership=all`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const json = await res.json();
      const matches = (json.cards ?? [])
        .filter(
          (c: PrereqOption & { is_published?: boolean; is_built_in?: boolean }) =>
            (c.is_published || c.is_built_in) &&
            c.id !== initial?.id &&
            !prereqIds.includes(c.id) &&
            c.title.toLowerCase().includes(q.toLowerCase())
        )
        .slice(0, 8);
      setPrereqOptions(matches);
    }, 200);
    return () => window.clearTimeout(id);
  }, [prereqSearch, initial?.id, prereqIds]);

  const prereqById = useMemo(() => {
    const map = new Map<string, PrereqOption>();
    (initial?.prerequisites ?? []).forEach((p) =>
      map.set(p.id, { ...p, difficulty: p.difficulty ?? null })
    );
    prereqOptions.forEach((o) => map.set(o.id, o));
    return map;
  }, [initial?.prerequisites, prereqOptions]);

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (!t || tags.includes(t) || t.length > 40) return;
    setTags([...tags, t]);
    setTagInput("");
  }
  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  function addLink() {
    setLinks([...links, { url: "", title: "", kind: "" }]);
  }
  function updateLink(i: number, patch: Partial<(typeof links)[0]>) {
    const next = links.slice();
    next[i] = { ...next[i], ...patch };
    setLinks(next);
  }
  function removeLink(i: number) {
    const next = links.slice();
    next.splice(i, 1);
    setLinks(next);
  }

  function addPrereq(id: string) {
    if (!prereqIds.includes(id)) {
      setPrereqIds([...prereqIds, id]);
    }
    setPrereqSearch("");
    setPrereqOptions([]);
  }
  function removePrereq(id: string) {
    setPrereqIds(prereqIds.filter((x) => x !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!title.trim() || !slug || !categoryId || !difficulty) {
      return;
    }
    await onSubmit({
      slug,
      title: title.trim(),
      summary: summary.trim() || undefined,
      category_id: categoryId,
      difficulty,
      body,
      estimated_min: estimatedMin ? parseInt(estimatedMin, 10) : null,
      tags,
      external_links: links
        .filter((l) => l.url.trim())
        .map((l) => ({
          url: l.url.trim(),
          title: l.title.trim() || undefined,
          kind: (l.kind as "video" | "pdf" | "doc" | "website" | "other") || undefined,
        })),
      prerequisite_ids: prereqIds,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="sl-skill-scope space-y-6">
      {/* ---------- Metadata ---------- */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Card details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700 font-medium">Title *</span>
            <input
              type="text"
              required
              minLength={3}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2"
              placeholder="e.g. Ideation sketching"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700 font-medium">Slug *</span>
            <input
              type="text"
              required
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 font-mono"
              placeholder="ideation-sketching"
              disabled={mode === "edit"}
            />
            {mode === "edit" && (
              <span className="text-xs text-gray-400">
                Slugs are permanent once created.
              </span>
            )}
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-700 font-medium">Summary</span>
          <input
            type="text"
            maxLength={280}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2"
            placeholder="One-sentence overview shown on the card list."
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700 font-medium">Category *</span>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700 font-medium">Difficulty *</span>
            <select
              required
              value={difficulty}
              onChange={(e) =>
                setDifficulty(e.target.value as SkillDifficulty | "")
              }
              className="border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">Choose…</option>
              <option value="foundational">Foundational</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-700 font-medium">Estimated time (min)</span>
            <input
              type="number"
              min={1}
              max={240}
              value={estimatedMin}
              onChange={(e) => setEstimatedMin(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2"
              placeholder="e.g. 15"
            />
          </label>
        </div>
      </section>

      {/* ---------- Body blocks ---------- */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Body</h2>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
        </div>
        {showPreview ? (
          <div className="prose prose-sm max-w-none">
            <BlockRenderer blocks={body} />
          </div>
        ) : (
          <BlockEditor blocks={body} onChange={setBody} />
        )}
      </section>

      {/* ---------- Tags ---------- */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Tags</h2>
        <p className="text-sm text-gray-500">
          Short lowercase labels for filtering (e.g. <code>3d-printing</code>,{" "}
          <code>safety</code>).
        </p>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                aria-label={`Remove tag ${t}`}
                className="hover:text-indigo-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add a tag and press Enter"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addTag}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            Add
          </button>
        </div>
      </section>

      {/* ---------- External links ---------- */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">External links</h2>
          <button
            type="button"
            onClick={addLink}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            + Add link
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Supplementary videos, PDFs, or reference pages. We&apos;ll check them
          periodically for dead links.
        </p>
        {links.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No links attached.</p>
        ) : (
          <ul className="space-y-2">
            {links.map((link, i) => (
              <li
                key={i}
                className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_auto_auto] gap-2 items-center"
              >
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(i, { url: e.target.value })}
                  placeholder="https://..."
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={link.title}
                  onChange={(e) => updateLink(i, { title: e.target.value })}
                  placeholder="Title (optional)"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={link.kind}
                  onChange={(e) => updateLink(i, { kind: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">Kind…</option>
                  <option value="video">Video</option>
                  <option value="pdf">PDF</option>
                  <option value="doc">Doc</option>
                  <option value="website">Website</option>
                  <option value="other">Other</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  className="text-rose-600 hover:text-rose-700 text-sm px-2"
                  aria-label="Remove link"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Prereqs ---------- */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Prerequisites</h2>
        <p className="text-sm text-gray-500">
          Cards students should master before attempting this one. Shown as
          prompts in the library, not hard locks.
        </p>

        {prereqIds.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {prereqIds.map((id) => {
              const p = prereqById.get(id);
              return (
                <li
                  key={id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
                >
                  <span>{p?.title ?? id}</span>
                  <button
                    type="button"
                    onClick={() => removePrereq(id)}
                    aria-label="Remove prerequisite"
                    className="hover:text-rose-600"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="relative">
          <input
            type="text"
            value={prereqSearch}
            onChange={(e) => setPrereqSearch(e.target.value)}
            placeholder="Search for a card to add as prerequisite…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          {prereqOptions.length > 0 && (
            <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
              {prereqOptions.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => addPrereq(o.id)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                  >
                    <span className="font-medium">{o.title}</span>
                    {o.difficulty && (
                      <span className="ml-2 text-xs text-gray-500">
                        {o.difficulty}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---------- Submit ---------- */}
      {submitError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
          {submitError}
        </div>
      )}

      <div className="flex justify-end gap-3 sticky bottom-0 bg-white border-t border-gray-100 -mx-6 px-6 py-3">
        <button
          type="submit"
          disabled={submitting || !title.trim() || !categoryId || !difficulty}
          className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? "Saving…"
            : mode === "create"
              ? "Create draft"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
