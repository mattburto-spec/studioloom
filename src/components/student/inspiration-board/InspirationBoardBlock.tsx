"use client";

// Inspiration Board — first archetype-aware block.
//
// Students upload 3–5 images, write commentary on each, then synthesise
// the pattern across them. Pinterest-style CSS-columns masonry grid.
// Drag-to-reorder deferred to FU-IB-DRAG-REORDER (P3) — Framer's
// Reorder.Group is incompatible with CSS multi-column flow.
//
// Archetype-awareness: on mount, fetches /api/student/archetype/[unitId]
// → passes (cardSlug, archetypeId) chain to getArchetypeAwareContent so
// card-specific overrides win over archetype-level. The chain comes from
// the student's resolved archetype; when the student has both an
// archetype and a card pick, the resolver returns the archetype but the
// override authoring convention uses card slugs too — we look both up.
//
// Save: serialize state to JSON, push via onChange. Existing lesson
// autosave debounces + writes to student_progress.responses.
//
// Image upload: reuses /api/student/upload (existing student route with
// image moderation gate + responses bucket + proxy URL).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ActivitySection } from "@/types";
import type { InspirationBoardConfig } from "@/components/teacher/lesson-editor/BlockPalette.types";
import {
  getArchetypeAwareContent,
  getArchetypeAwareContentByChain,
} from "@/lib/blocks/archetype-aware";
import { compressImage } from "@/lib/compress-image";
// Note: checkClientImage (NSFW.js 4MB model) deliberately NOT used here.
// Server-side moderation in /api/student/upload (Phase 5F) still gates.
// FU-IB-CLIENT-IMAGE-CHECK to add back with proper error handling +
// timeout once we confirm the rest of the upload pipeline works.

interface BoardItem {
  id: string;
  url: string;
  commentary: string;
  stealNote: string;
  altText: string;
}

interface BoardState {
  items: BoardItem[];
  synthesis: string;
  completed: boolean;
}

const EMPTY: BoardState = { items: [], synthesis: "", completed: false };

function parseValue(raw: string): BoardState {
  if (!raw || !raw.startsWith("{")) return { ...EMPTY };
  try {
    const parsed = JSON.parse(raw) as Partial<BoardState>;
    return {
      items: Array.isArray(parsed.items)
        ? parsed.items.map((i) => ({
            id: String(i.id ?? cryptoRandomId()),
            url: String(i.url ?? ""),
            commentary: String(i.commentary ?? ""),
            stealNote: String(i.stealNote ?? ""),
            altText: String(i.altText ?? ""),
          }))
        : [],
      synthesis: typeof parsed.synthesis === "string" ? parsed.synthesis : "",
      completed: parsed.completed === true,
    };
  } catch {
    return { ...EMPTY };
  }
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface Props {
  activityId: string;
  section: ActivitySection;
  config: InspirationBoardConfig;
  unitId: string;
  value: string;
  onChange: (value: string) => void;
}

export default function InspirationBoardBlock({
  activityId,
  section,
  config,
  unitId,
  value,
  onChange,
}: Props) {
  const prefersReducedMotion = useReducedMotion();

  // Hydrate from `value` on mount + when value changes externally.
  const [state, setState] = useState<BoardState>(() => parseValue(value));

  // Archetype-aware copy.
  const [archetypeId, setArchetypeId] = useState<string | null>(null);
  const [cardSlug, setCardSlug] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch archetype on mount + look up card slug (newest pick wins).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/student/archetype/${encodeURIComponent(unitId)}`,
          { credentials: "same-origin" },
        );
        if (res.ok) {
          const data = (await res.json()) as { archetypeId: string | null };
          if (!cancelled) setArchetypeId(data.archetypeId ?? null);
        }
      } catch {
        // non-fatal — fall back to base content
      }
      // Card slug — look up via the same selection endpoint shape.
      // We pull from /api/student/choice-cards/<activityId>/selection
      // ONLY if we have a meaningful activityId associated with a card
      // block. For Inspiration Board we don't know which choice block
      // the student picked from, so fall through: card-slug-keyed
      // overrides require the slug to ALREADY match the archetypeId
      // (which won't happen). The current authoring convention has the
      // archetype-level overrides + card-specific overrides keyed
      // separately, and the resolver returns the archetypeId — so for
      // v1 we only use archetype-level matches. Card-slug-specific
      // overrides defined on the block are unused until we ship the
      // card-slug lookup helper. Tracked as FU-IB-CARD-SLUG-LOOKUP.
      if (!cancelled) setLoadingContent(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  // Persist state via onChange. Debounce isn't needed here — the parent
  // ActivityCard already debounces the autosave write.
  const persist = useCallback(
    (next: BoardState) => {
      setState(next);
      onChange(JSON.stringify(next));
    },
    [onChange],
  );

  const resolved = useMemo(
    () =>
      cardSlug
        ? getArchetypeAwareContentByChain(section, [cardSlug, archetypeId])
        : getArchetypeAwareContent(section, archetypeId),
    [section, archetypeId, cardSlug],
  );

  const synthesisPlaceholder = useMemo(() => {
    const fromOverride = resolved.extras.synthesis_placeholder;
    return typeof fromOverride === "string"
      ? fromOverride
      : "Something a stranger could spot from the board alone.";
  }, [resolved.extras]);

  const isAtMax = state.items.length >= config.maxItems;
  const isUnderMin = state.items.length < config.minItems;
  const synthesisFilled = state.synthesis.trim().length > 10;
  const canMarkComplete =
    !isUnderMin && (config.showSynthesisPrompt ? synthesisFilled : true);

  // Step-by-step state-visible upload. Each await is wrapped in its own
  // try/catch with a stage label so the user (and we) see exactly where
  // it failed. uploadError is replaced with uploadStatus that also
  // surfaces in-progress steps.
  const [uploadStatus, setUploadStatusState] = useState<string | null>(null);
  const setStatus = setUploadStatusState;

  async function handleFiles(files: FileList | File[]) {
    const remaining = config.maxItems - state.items.length;
    if (remaining <= 0) {
      setStatus("Max items already reached.");
      return;
    }
    const arr = Array.from(files).slice(0, remaining);
    setUploading(true);
    setUploadError(null);
    setStatus(`Starting upload (${arr.length} file${arr.length === 1 ? "" : "s"})…`);
    const newItems: BoardItem[] = [];
    try {
      for (let i = 0; i < arr.length; i++) {
        const file = arr[i];
        const prefix = arr.length > 1 ? `[${i + 1}/${arr.length}] ` : "";

        // 1. Compress (skipped silently for tiny files + non-images).
        setStatus(`${prefix}Compressing ${file.name}…`);
        let processedFile: File;
        try {
          processedFile = await compressImage(file);
        } catch (e) {
          throw new Error(
            `Compress failed for ${file.name}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }

        // 2. Upload.
        setStatus(`${prefix}Uploading ${file.name}…`);
        const fd = new FormData();
        fd.append("file", processedFile);
        fd.append("unitId", unitId);
        fd.append("pageId", activityId);

        let res: Response;
        try {
          res = await fetch("/api/student/upload", {
            method: "POST",
            credentials: "same-origin",
            body: fd,
          });
        } catch (e) {
          throw new Error(
            `Network error uploading ${file.name}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}) as { error?: string });
          throw new Error(
            `Server rejected ${file.name} (HTTP ${res.status}): ${
              (body as { error?: string }).error ?? "no error body"
            }`,
          );
        }

        // 3. Parse response.
        let data: { url: string };
        try {
          data = (await res.json()) as { url: string };
        } catch (e) {
          throw new Error(
            `Bad JSON from upload response: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        if (!data.url) {
          throw new Error("Upload response missing `url` field.");
        }

        newItems.push({
          id: cryptoRandomId(),
          url: data.url,
          commentary: "",
          stealNote: "",
          altText: `Inspiration image ${state.items.length + newItems.length + 1}`,
        });
      }

      setStatus(`Saved ${newItems.length} image${newItems.length === 1 ? "" : "s"}.`);
      persist({ ...state, items: [...state.items, ...newItems] });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
      setStatus(null);
    } finally {
      setUploading(false);
    }
  }

  function handleUrlPaste() {
    const url = window.prompt("Paste an image URL:");
    if (!url || !url.startsWith("http")) return;
    if (state.items.length >= config.maxItems) return;
    persist({
      ...state,
      items: [
        ...state.items,
        {
          id: cryptoRandomId(),
          url: url.trim(),
          commentary: "",
          stealNote: "",
          altText: `Inspiration image ${state.items.length + 1}`,
        },
      ],
    });
  }

  function updateItem(id: string, patch: Partial<BoardItem>) {
    persist({
      ...state,
      items: state.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    });
  }

  function removeItem(id: string) {
    if (!window.confirm("Remove this image?")) return;
    persist({
      ...state,
      items: state.items.filter((it) => it.id !== id),
      completed: false,
    });
  }

  function setSynthesis(synthesis: string) {
    persist({ ...state, synthesis });
  }

  function toggleComplete() {
    if (!canMarkComplete && !state.completed) return;
    persist({ ...state, completed: !state.completed });
  }

  if (loadingContent) {
    return (
      <div className="rounded-lg border border-pink-200 bg-pink-50/40 p-6 text-center text-sm text-pink-700">
        Loading inspiration board…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Framing + Task header */}
      <div>
        {resolved.framing && (
          <p className="mb-2 text-sm leading-relaxed text-zinc-700">
            {resolved.framing}
          </p>
        )}
        {resolved.task && (
          <p className="text-sm font-semibold leading-relaxed text-zinc-900">
            🎯 {resolved.task}
          </p>
        )}
      </div>

      {/* Counter banner */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-pink-50 px-3 py-1.5 text-[12px] text-pink-900">
        <strong>
          {state.items.length} / {config.maxItems} uploaded
        </strong>
        {isUnderMin && (
          <span className="text-pink-700">
            Need at least {config.minItems} to spot a pattern.
          </span>
        )}
      </div>

      {/* Upload buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isAtMax || uploading}
          className="rounded-lg bg-pink-600 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "Uploading…" : isAtMax ? "Max reached" : "+ Add image"}
        </button>
        {config.allowUrlPaste && (
          <button
            type="button"
            onClick={handleUrlPaste}
            disabled={isAtMax}
            className="rounded-lg border border-pink-300 bg-white px-3 py-1.5 text-sm font-semibold text-pink-800 transition hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Paste URL
          </button>
        )}
        {isAtMax && (
          <span className="text-[11px] text-zinc-500">
            Delete one to add another.
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            // CRITICAL: snapshot files BEFORE resetting input value.
            // Chrome/Safari clear e.target.files when value is set to ""
            // — so we must capture the File refs first via Array.from()
            // (which creates a real array holding the File objects).
            const fileList = e.target.files;
            const files = fileList ? Array.from(fileList) : [];
            e.target.value = "";
            if (files.length > 0) void handleFiles(files);
          }}
        />
      </div>

      {uploadError && (
        <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          ⚠ {uploadError}
        </div>
      )}

      {uploadStatus && !uploadError && (
        <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          {uploadStatus}
        </div>
      )}

      {/* Masonry grid via CSS columns. Drag-to-reorder deferred for v1
          (Framer Reorder.Group + CSS columns are mutually incompatible —
          Reorder uses transform tracking that breaks multi-column flow).
          File FU-IB-DRAG-REORDER (P3). */}
      {state.items.length > 0 && (
        <div className="inspiration-board-columns">
          {state.items.map((item) => (
            <BoardCard
              key={item.id}
              item={item}
              config={config}
              prefersReducedMotion={!!prefersReducedMotion}
              onChange={(patch) => updateItem(item.id, patch)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      )}
      <style jsx>{`
        .inspiration-board-columns {
          column-count: 3;
          column-gap: 1rem;
        }
        @media (max-width: 768px) {
          .inspiration-board-columns {
            column-count: 2;
          }
        }
        @media (max-width: 480px) {
          .inspiration-board-columns {
            column-count: 1;
          }
        }
        .inspiration-board-columns > :global(*) {
          break-inside: avoid;
          margin-bottom: 1rem;
          display: inline-block;
          width: 100%;
        }
      `}</style>

      {/* Synthesis card — locked under minItems */}
      {config.showSynthesisPrompt && (
        <div
          className={`rounded-2xl border-2 p-4 transition ${
            isUnderMin
              ? "border-dashed border-zinc-200 bg-zinc-50/50 opacity-60"
              : "border-pink-200 bg-white"
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">{isUnderMin ? "🔒" : "✨"}</span>
            <h3 className="text-sm font-bold text-zinc-900">What do these share?</h3>
            {isUnderMin && (
              <span className="text-[11px] text-zinc-500">
                Unlocks at {config.minItems} images
              </span>
            )}
          </div>
          <textarea
            value={state.synthesis}
            onChange={(e) => setSynthesis(e.target.value)}
            placeholder={synthesisPlaceholder}
            disabled={isUnderMin}
            rows={2}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-transparent"
            maxLength={400}
          />
          <div className="mt-1 text-right text-[10px] text-zinc-500">
            {state.synthesis.length} / 400 chars · 25-word soft cap
          </div>
        </div>
      )}

      {/* Mark complete */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggleComplete}
          disabled={!canMarkComplete && !state.completed}
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${
            state.completed
              ? "bg-emerald-100 text-emerald-800"
              : canMarkComplete
                ? "bg-pink-600 text-white hover:bg-pink-700"
                : "cursor-not-allowed bg-zinc-200 text-zinc-500"
          }`}
        >
          {state.completed ? "✓ Marked complete (click to unmark)" : "Mark complete"}
        </button>
        {resolved.success_signal && (
          <div className="ml-3 max-w-[60%] text-right text-[11px] italic text-zinc-600">
            {resolved.success_signal}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Single card
// ─────────────────────────────────────────────────────────────────────

interface CardProps {
  item: BoardItem;
  config: InspirationBoardConfig;
  prefersReducedMotion: boolean;
  onChange: (patch: Partial<BoardItem>) => void;
  onRemove: () => void;
}

function BoardCard({
  item,
  config,
  prefersReducedMotion,
  onChange,
  onRemove,
}: CardProps) {
  const [showSteal, setShowSteal] = useState(item.stealNote.length > 0);
  return (
    <motion.div
      whileHover={
        prefersReducedMotion
          ? undefined
          : { y: -6, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }
      }
      transition={{ duration: 0.2 }}
      className="group relative rounded-xl border border-zinc-200 bg-white shadow-sm"
    >
      {/* Image */}
      <div className="relative">
        <img
          src={item.url}
          alt={item.altText}
          className="w-full rounded-t-xl object-cover"
          loading="lazy"
        />
        {/* Delete (top-right) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-xs font-bold text-rose-600 opacity-0 shadow transition hover:bg-rose-50 group-hover:opacity-100"
          aria-label="Remove image"
        >
          ✕
        </button>
      </div>

      {/* Commentary */}
      <div className="p-3">
        <textarea
          value={item.commentary}
          onChange={(e) => onChange({ commentary: e.target.value })}
          placeholder="What caught your eye?"
          rows={2}
          maxLength={300}
          className="w-full resize-none rounded-lg border border-zinc-200 px-2 py-1.5 text-[12px] focus:border-pink-500 focus:outline-none"
        />
        <div className="mt-0.5 text-right text-[10px] text-zinc-500">
          {wordCount(item.commentary)} / 50 words
        </div>

        {config.showStealPrompt && !showSteal && (
          <button
            type="button"
            onClick={() => setShowSteal(true)}
            className="mt-1 text-[11px] font-semibold text-pink-700 hover:underline"
          >
            Add notes ▾
          </button>
        )}
        {config.showStealPrompt && showSteal && (
          <div className="mt-2 space-y-1">
            <input
              type="text"
              value={item.stealNote}
              onChange={(e) => onChange({ stealNote: e.target.value })}
              placeholder="What would you steal for your project?"
              maxLength={120}
              className="w-full rounded-lg border border-zinc-200 px-2 py-1 text-[11px] focus:border-pink-500 focus:outline-none"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function wordCount(s: string): number {
  return s.trim().length === 0 ? 0 : s.trim().split(/\s+/).length;
}
