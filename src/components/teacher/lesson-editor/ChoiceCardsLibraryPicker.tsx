"use client";

// Choice Cards — library picker modal (teacher unit-builder).
//
// Opens from ChoiceCardsConfigPanel. Lists cards from the library
// (GET /api/teacher/choice-cards/library), supports tag filtering +
// free-text search, multi-select checkboxes to compose the deck. An
// inline "Create new card" form at the top creates a fresh library row
// via POST /api/teacher/choice-cards.
//
// Returns the picked cardIds[] to the parent on Save. Cancel discards.
//
// Inline editing of existing cards is FU-CCB-INLINE-CARD-EDIT (P3) —
// for v1 teachers only edit cards via the create-new form (which can
// hold the same slug to overwrite if they re-create with admin help).

import { useEffect, useMemo, useState } from "react";
import { nanoid } from "nanoid";
import { ChoiceCardImageUploadButton } from "./ChoiceCardImageUploadButton";

interface ChoiceCardSummary {
  id: string;
  label: string;
  hook_text: string;
  image_url: string | null;
  emoji: string | null;
  bg_color: string | null;
  tags: string[];
  ships_to_platform: boolean;
  is_seeded: boolean;
}

interface NewCardForm {
  label: string;
  hook_text: string;
  detail_md: string;
  emoji: string;
  bg_color: string;
  imageUrl: string | null;
  tags: string;
  actionType: ActionType;
  actionPayload: string; // JSON or simple payload for set-archetype / set-theme / etc.
  shipsToPlatform: boolean;
}

type ActionType =
  | "set-archetype"
  | "set-theme"
  | "set-mentor"
  | "set-constraint"
  | "pitch-to-teacher"
  | "navigate"
  | "emit-event";

const TAG_CHIPS = ["brief", "mentor", "theme", "constraint", "g8", "g9", "custom"];

interface Props {
  open: boolean;
  selectedIds: string[];
  onClose: () => void;
  onSave: (cardIds: string[]) => void;
}

export default function ChoiceCardsLibraryPicker({ open, selectedIds, onClose, onSave }: Props) {
  const [cards, setCards] = useState<ChoiceCardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set(selectedIds));
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked(new Set(selectedIds));
  }, [open, selectedIds]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams();
        if (activeTags.size > 0) params.set("tags", Array.from(activeTags).join(","));
        if (q.trim().length > 0) params.set("q", q.trim());
        const res = await fetch(`/api/teacher/choice-cards/library?${params}`, {
          credentials: "same-origin",
        });
        if (!res.ok) {
          throw new Error(`Library load failed (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) setCards(data.cards ?? []);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, q, activeTags]);

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pickedOrdered = useMemo(() => {
    // Preserve selectedIds order for the leading cards, append new ones at the end.
    const fromExisting = selectedIds.filter((id) => picked.has(id));
    const fromNew = Array.from(picked).filter((id) => !selectedIds.includes(id));
    return [...fromExisting, ...fromNew];
  }, [picked, selectedIds]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Pick cards for this deck</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {picked.size} selected · {cards.length} in library
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
          >
            {showCreate ? "Close form" : "+ Create new card"}
          </button>
        </div>

        {showCreate && (
          <CreateCardForm
            onCreated={(newCard) => {
              setCards((cs) => [newCard, ...cs]);
              setPicked((p) => new Set(p).add(newCard.id));
              setShowCreate(false);
            }}
          />
        )}

        <div className="border-b border-zinc-200 px-6 py-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by label or hook…"
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TAG_CHIPS.map((tag) => {
              const active = activeTags.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {err && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {err}
            </div>
          )}
          {loading ? (
            <div className="py-12 text-center text-sm text-zinc-500">Loading library…</div>
          ) : cards.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              No cards match. Try clearing filters or create a new card.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {cards.map((c) => (
                <CardPreview
                  key={c.id}
                  card={c}
                  selected={picked.has(c.id)}
                  onToggle={() => togglePick(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(pickedOrdered)}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700"
          >
            Save selection ({picked.size})
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Card preview — small thumbnail for the picker grid.
// ─────────────────────────────────────────────────────────────────────

function CardPreview({
  card,
  selected,
  onToggle,
}: {
  card: ChoiceCardSummary;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative flex h-40 flex-col overflow-hidden rounded-xl border-2 text-left transition ${
        selected ? "border-emerald-500 shadow-md" : "border-transparent hover:border-zinc-300"
      }`}
      style={{
        background: card.image_url ? undefined : card.bg_color || "#10B981",
        backgroundImage: card.image_url ? `url(${card.image_url})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Selected check */}
      {selected && (
        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow">
          ✓
        </div>
      )}
      {card.ships_to_platform && (
        <div className="absolute left-2 top-2 rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
          🚀
        </div>
      )}
      {!card.image_url && card.emoji && (
        <div className="flex flex-1 items-center justify-center text-5xl">{card.emoji}</div>
      )}
      {card.image_url && <div className="flex-1" />}
      <div
        className="px-2 py-2"
        style={{
          background: card.image_url ? "linear-gradient(transparent, rgba(0,0,0,0.55))" : "rgba(255,255,255,0.92)",
          color: card.image_url ? "white" : "#0f172a",
        }}
      >
        <div className="text-xs font-bold leading-tight">{card.label}</div>
        <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug opacity-80">{card.hook_text}</div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Inline create-card form
// ─────────────────────────────────────────────────────────────────────

function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  // Append a 4-char suffix to avoid collisions with seeded slugs.
  const suffix = nanoid(4).toLowerCase().replace(/[^a-z0-9]/g, "x");
  return base.length > 0 ? `${base}-${suffix}` : `card-${suffix}`;
}

const ACTION_TYPES: ActionType[] = [
  "set-archetype",
  "set-theme",
  "set-mentor",
  "set-constraint",
  "pitch-to-teacher",
  "navigate",
  "emit-event",
];

function CreateCardForm({ onCreated }: { onCreated: (card: ChoiceCardSummary) => void }) {
  const [form, setForm] = useState<NewCardForm>({
    label: "",
    hook_text: "",
    detail_md: "",
    emoji: "🃏",
    bg_color: "#10B981",
    imageUrl: null,
    tags: "",
    actionType: "pitch-to-teacher",
    actionPayload: "",
    shipsToPlatform: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (form.label.trim().length === 0 || form.hook_text.trim().length === 0 || form.detail_md.trim().length === 0) {
      setErr("Label, hook, and detail are all required.");
      return;
    }

    let on_pick_action: { type: ActionType; payload?: unknown } = { type: form.actionType };
    if (form.actionType !== "pitch-to-teacher") {
      try {
        on_pick_action = {
          type: form.actionType,
          payload: form.actionPayload.trim().length > 0 ? JSON.parse(form.actionPayload) : {},
        };
      } catch {
        setErr("Action payload must be valid JSON (or leave blank).");
        return;
      }
    }

    const id = slugify(form.label);
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      const res = await fetch("/api/teacher/choice-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          id,
          label: form.label.trim(),
          hook_text: form.hook_text.trim(),
          detail_md: form.detail_md.trim(),
          image_url: form.imageUrl,
          emoji: form.emoji.trim() || null,
          bg_color: form.bg_color.trim() || null,
          tags,
          on_pick_action,
          ships_to_platform: form.shipsToPlatform,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Create failed (${res.status})`);
      }
      const data = await res.json();
      onCreated({
        id: data.card.id,
        label: data.card.label,
        hook_text: data.card.hook_text,
        image_url: data.card.image_url,
        emoji: data.card.emoji,
        bg_color: data.card.bg_color,
        tags: data.card.tags,
        ships_to_platform: data.card.ships_to_platform,
        is_seeded: false,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-b border-zinc-200 bg-zinc-50 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          type="text"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="Card label (e.g. Design a Designer Mentor)"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
        />
        <input
          type="text"
          value={form.hook_text}
          onChange={(e) => setForm({ ...form, hook_text: e.target.value })}
          placeholder="One-line hook (front of card)"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
        />
        <textarea
          value={form.detail_md}
          onChange={(e) => setForm({ ...form, detail_md: e.target.value })}
          placeholder="Detail (markdown — shown on card back)"
          rows={3}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm md:col-span-2"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-zinc-600">Emoji</label>
          <input
            type="text"
            value={form.emoji}
            onChange={(e) => setForm({ ...form, emoji: e.target.value })}
            maxLength={4}
            className="w-16 rounded-lg border border-zinc-300 px-2 py-1.5 text-center text-sm"
          />
          <label className="text-xs text-zinc-600">Color</label>
          <input
            type="color"
            value={form.bg_color}
            onChange={(e) => setForm({ ...form, bg_color: e.target.value })}
            className="h-8 w-12 cursor-pointer rounded border border-zinc-300"
          />
          <div className="flex items-center gap-1.5">
            <ChoiceCardImageUploadButton
              onUploaded={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
              label={form.imageUrl ? "📷 Replace" : "📷 Add image"}
            />
            {form.imageUrl && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, imageUrl: null }))}
                className="text-[11px] font-semibold text-rose-700 hover:underline"
              >
                Remove image
              </button>
            )}
          </div>
        </div>
        <input
          type="text"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder="Tags (comma-separated)"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
        />
        <select
          value={form.actionType}
          onChange={(e) => setForm({ ...form, actionType: e.target.value as ActionType })}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
        >
          {ACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              On pick → {t}
            </option>
          ))}
        </select>
        {form.actionType !== "pitch-to-teacher" && (
          <input
            type="text"
            value={form.actionPayload}
            onChange={(e) => setForm({ ...form, actionPayload: e.target.value })}
            placeholder='Action payload JSON, e.g. {"archetypeId":"toy-design"}'
            className="rounded-lg border border-zinc-300 px-3 py-1.5 font-mono text-xs md:col-span-2"
          />
        )}
        <label className="flex items-center gap-2 text-xs text-zinc-700">
          <input
            type="checkbox"
            checked={form.shipsToPlatform}
            onChange={(e) => setForm({ ...form, shipsToPlatform: e.target.checked })}
          />
          Ships to platform (shows 🚀 Can ship badge)
        </label>
      </div>
      {err && <div className="mt-3 text-xs text-rose-700">{err}</div>}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create card"}
        </button>
      </div>
    </div>
  );
}
