"use client";

/**
 * SlotInput — dispatcher for the 5 input kinds the Project Spec
 * block family supports (text, text-multifield, chip-picker,
 * size-reference, number-pair).
 *
 * Extracted from v1's ProjectSpecResponse during the v2 split.
 * Consumed by v1 + all 3 v2 blocks. Purple styling kept uniform
 * across blocks for visual coherence (the per-block accent shows
 * in the BlockPalette card + the activity-card header, not inside
 * the inputs).
 */

import { useRef, useState } from "react";
import type { SlotInputType, SlotValue } from "@/lib/project-spec/archetypes";

/**
 * Callback contract for the `image-upload` input kind. The consuming
 * block component owns the actual POST to its dedicated upload
 * endpoint (different bucket per block). Returns the proxy URL of
 * the uploaded asset.
 */
export type ImageUploadFn = (file: File) => Promise<{ url: string }>;

export function SlotInput({
  input,
  value,
  onChange,
  onUploadImage,
}: {
  input: SlotInputType;
  value: SlotValue | null;
  onChange: (v: SlotValue | null) => void;
  /** Only consulted when `input.kind === "image-upload"`. */
  onUploadImage?: ImageUploadFn;
}) {
  if (input.kind === "text") {
    const text = value?.kind === "text" ? value.text : "";
    return (
      <textarea
        value={text}
        onChange={(e) =>
          onChange(
            e.target.value ? { kind: "text", text: e.target.value } : null,
          )
        }
        placeholder="Type here…"
        className="w-full min-h-[80px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
      />
    );
  }

  if (input.kind === "text-multifield") {
    const values =
      value?.kind === "text-multifield"
        ? value.values
        : input.fields.map(() => "");
    return (
      <div className="space-y-2">
        {input.fields.map((field, i) => (
          <div key={i}>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">
              {field.label}
            </label>
            <input
              type="text"
              value={values[i] ?? ""}
              onChange={(e) => {
                const next = [...values];
                next[i] = e.target.value;
                onChange({ kind: "text-multifield", values: next });
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        ))}
      </div>
    );
  }

  if (input.kind === "chip-picker") {
    const primary = value?.kind === "chip" ? value.primary : null;
    const secondary = value?.kind === "chip" ? value.secondary : undefined;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {input.chips.map((chip) => {
            const selected = chip.id === primary;
            return (
              <button
                key={chip.id}
                onClick={() =>
                  onChange({ kind: "chip", primary: chip.id, secondary })
                }
                className={`px-4 py-2 rounded-full text-sm border-2 transition ${
                  selected
                    ? "border-purple-600 bg-purple-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-purple-400"
                }`}
              >
                {chip.emoji ? `${chip.emoji} ` : ""}
                {chip.label}
              </button>
            );
          })}
        </div>
        {input.allowSecondary && primary && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">
              {input.allowSecondary.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {input.allowSecondary.chips.map((chip) => {
                const selected = chip.id === secondary;
                return (
                  <button
                    key={chip.id}
                    onClick={() =>
                      onChange({
                        kind: "chip",
                        primary,
                        secondary: selected ? undefined : chip.id,
                      })
                    }
                    className={`px-3 py-1 rounded-full text-xs border transition ${
                      selected
                        ? "border-purple-500 bg-purple-100 text-purple-900"
                        : "border-gray-300 bg-white text-gray-600 hover:border-purple-300"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (input.kind === "size-reference") {
    const ref = value?.kind === "size" ? value.ref : null;
    const cm = value?.kind === "size" ? value.cm : undefined;
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {input.references.map((r) => {
            const selected = r.id === ref;
            return (
              <button
                key={r.id}
                onClick={() => onChange({ kind: "size", ref: r.id, cm })}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-xs transition ${
                  selected
                    ? "border-purple-600 bg-purple-50"
                    : "border-gray-200 bg-white hover:border-purple-300"
                }`}
              >
                <span className="text-2xl">{r.emoji}</span>
                <span className="text-center text-gray-700">{r.label}</span>
              </button>
            );
          })}
        </div>
        {input.allowCm && ref && (
          <div className="flex gap-2 items-center">
            <span className="text-xs text-gray-600">Optional cm:</span>
            {(["w", "h", "d"] as const).map((axis) => (
              <input
                key={axis}
                type="number"
                placeholder={axis.toUpperCase()}
                value={cm?.[axis] ?? ""}
                onChange={(e) => {
                  const n = e.target.value ? Number(e.target.value) : undefined;
                  onChange({
                    kind: "size",
                    ref,
                    cm: { ...(cm ?? {}), [axis]: n },
                  });
                }}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (input.kind === "image-upload") {
    return (
      <ImageUploadInput
        value={value?.kind === "image" ? value : null}
        onChange={onChange}
        onUploadImage={onUploadImage}
        altPlaceholder={input.altPlaceholder ?? "Caption (optional)"}
      />
    );
  }

  if (input.kind === "multi-chip-picker") {
    const selected = value?.kind === "multi-chip" ? value.selected : [];
    const cap = input.maxSelected;
    const toggle = (id: string) => {
      const has = selected.includes(id);
      const next = has
        ? selected.filter((s) => s !== id)
        : [...selected, id];
      if (cap && next.length > cap) return; // refuse to exceed cap
      onChange(
        next.length === 0
          ? null
          : { kind: "multi-chip", selected: next },
      );
    };
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {input.chips.map((chip) => {
            const isSelected = selected.includes(chip.id);
            return (
              <button
                key={chip.id}
                onClick={() => toggle(chip.id)}
                className={`px-3 py-1.5 rounded-full text-sm border-2 transition ${
                  isSelected
                    ? "border-purple-600 bg-purple-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-purple-400"
                }`}
              >
                {chip.emoji ? `${chip.emoji} ` : ""}
                {chip.label}
              </button>
            );
          })}
        </div>
        {cap && (
          <p className="text-xs text-gray-500">
            Pick up to {cap}. Selected: {selected.length}
          </p>
        )}
      </div>
    );
  }

  if (input.kind === "number-pair") {
    const first = value?.kind === "pair" ? value.first : NaN;
    const second = value?.kind === "pair" ? value.second : NaN;
    return (
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">
            {input.firstLabel}
          </label>
          <input
            type="number"
            value={Number.isFinite(first) ? first : ""}
            min={input.firstMin}
            max={input.firstMax}
            onChange={(e) => {
              const f = Number(e.target.value);
              onChange({
                kind: "pair",
                first: f,
                second: Number.isFinite(second) ? second : 0,
              });
            }}
            className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <span className="pb-2 text-gray-400">×</span>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">
            {input.secondLabel}
          </label>
          <input
            type="number"
            value={Number.isFinite(second) ? second : ""}
            min={input.secondMin}
            max={input.secondMax}
            onChange={(e) => {
              const s = Number(e.target.value);
              onChange({
                kind: "pair",
                first: Number.isFinite(first) ? first : 0,
                second: s,
              });
            }}
            className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
        {input.unit && (
          <span className="pb-2 text-sm text-gray-600">{input.unit}</span>
        )}
      </div>
    );
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────
// Image upload sub-component
// ────────────────────────────────────────────────────────────────────

function ImageUploadInput({
  value,
  onChange,
  onUploadImage,
  altPlaceholder,
}: {
  value: { kind: "image"; url: string; alt?: string } | null;
  onChange: (v: SlotValue | null) => void;
  onUploadImage?: ImageUploadFn;
  altPlaceholder: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!onUploadImage) {
      setError("Upload not wired in this context");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image too large (max 10MB).");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const { url } = await onUploadImage(file);
      onChange({ kind: "image", url, alt: value?.alt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Empty state — no photo yet
  if (!value) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !onUploadImage}
          className="w-full rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/30 px-4 py-6 text-sm text-purple-700 hover:border-purple-500 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading…" : "📷  Upload a photo or sketch"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    );
  }

  // Filled state — thumbnail + replace + remove
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-purple-200 bg-white p-3 flex gap-3 items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value.url}
          alt={value.alt ?? "User photo"}
          className="w-28 h-28 object-cover rounded-md border border-gray-200 bg-gray-50"
        />
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={value.alt ?? ""}
            onChange={(e) => onChange({ ...value, alt: e.target.value })}
            placeholder={altPlaceholder}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1 text-xs rounded border border-purple-300 text-purple-700 hover:bg-purple-50 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Replace"}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={uploading}
              className="px-3 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
