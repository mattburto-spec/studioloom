"use client";

// Choice Card Brief Template Editor (Phase F.C).
//
// Modal opened from each card row in ChoiceCardsLibraryPicker. Lets a
// teacher author the brief_text + design constraints + lock map for a
// specific card. When a student picks the card, those values populate
// their student_brief at render time (Phase F.D).
//
// Reuses:
//   - DesignConstraintsEditor (Phase B/F.B) for the constraints fields
//     + per-field LockToggle (Phase F.B)
//   - The shared brief-template column shape on choice_cards (Phase F.A
//     migration)
//
// Fetches the card on open via GET /api/teacher/choice-cards/[cardId];
// saves via PATCH with { brief_text, brief_constraints, brief_locks }.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DesignConstraintsEditor } from "@/components/teacher/unit-brief/DesignConstraintsEditor";
import { LockToggle } from "@/components/teacher/unit-brief/LockToggle";
import type {
  DesignConstraints,
  LockableField,
  UnitBriefConstraints,
  UnitBriefLocks,
} from "@/types/unit-brief";

interface Props {
  open: boolean;
  cardId: string;
  cardLabel: string;
  onClose: () => void;
  onSaved?: () => void;
}

const GENERIC_CONSTRAINTS: UnitBriefConstraints = {
  archetype: "generic",
  data: {},
};

export default function ChoiceCardBriefTemplateEditor({
  open,
  cardId,
  cardLabel,
  onClose,
  onSaved,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [briefText, setBriefText] = useState<string>("");
  const [constraints, setConstraints] = useState<UnitBriefConstraints>({
    archetype: "design",
    data: {},
  });
  const [locks, setLocks] = useState<UnitBriefLocks>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Fetch on each open — same pattern as BriefDrawer so stale state
  // doesn't leak between cards if the modal reopens for a different one.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setSavedAt(null);
    void fetch(`/api/teacher/choice-cards/${encodeURIComponent(cardId)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErr(data.error ?? `Failed to load card (${res.status})`);
          return;
        }
        const data = await res.json();
        const card = data.card as
          | {
              brief_text?: string | null;
              brief_constraints?: unknown;
              brief_locks?: unknown;
            }
          | undefined;
        setBriefText((card?.brief_text as string | null) ?? "");
        // Defensive coerce: design archetype if data is non-empty,
        // generic fallback otherwise. Matches the unit-brief drawer
        // contract.
        const rawC = card?.brief_constraints;
        if (
          rawC &&
          typeof rawC === "object" &&
          !Array.isArray(rawC) &&
          (rawC as { archetype?: string }).archetype === "design"
        ) {
          setConstraints({
            archetype: "design",
            data:
              ((rawC as { data?: DesignConstraints }).data as DesignConstraints) ??
              {},
          });
        } else {
          // No template OR generic — start from a Design canvas so the
          // teacher can add constraints from scratch. They can always
          // leave it empty + only set brief_text + locks for prose-only.
          setConstraints({ archetype: "design", data: {} });
        }
        // Locks are validated/coerced server-side on save; for hydration
        // we just trust the shape and cast.
        const rawL = card?.brief_locks;
        setLocks(
          rawL && typeof rawL === "object" && !Array.isArray(rawL)
            ? (rawL as UnitBriefLocks)
            : {},
        );
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load card");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, cardId]);

  const save = useCallback(async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/teacher/choice-cards/${encodeURIComponent(cardId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief_text: briefText.length === 0 ? null : briefText,
            brief_constraints: constraints,
            brief_locks: locks,
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setSavedAt(new Date());
      onSaved?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [cardId, briefText, constraints, locks, onSaved]);

  const handleToggleLock = useCallback(
    (field: LockableField, next: boolean) => {
      setLocks((prev) => {
        const out: UnitBriefLocks = { ...prev };
        if (next) {
          out[field] = true;
        } else {
          delete out[field];
        }
        return out;
      });
    },
    [],
  );

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Brief template — ${cardLabel}`}
      data-testid="choice-card-brief-template-editor"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close brief template editor"
        data-testid="choice-card-brief-template-backdrop"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative flex h-full max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">📋 Brief template</h2>
            <p className="text-xs text-zinc-600">
              For card: <strong>{cardLabel}</strong>. Students who pick this
              card get this brief populated — locked fields stay teacher-only;
              open fields they can author.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="choice-card-brief-template-close"
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {err && (
            <div
              role="alert"
              className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
              data-testid="choice-card-brief-template-error"
            >
              {err}
            </div>
          )}
          {loading ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              Loading template…
            </div>
          ) : (
            <>
              {/* Brief prose */}
              <section className="mb-6">
                <div className="mb-2 flex items-center gap-2">
                  <label
                    htmlFor="cc_brief_text"
                    className="text-sm font-medium text-gray-700"
                  >
                    Brief
                  </label>
                  <LockToggle
                    field="brief_text"
                    locked={locks["brief_text"] === true}
                    onToggle={handleToggleLock}
                    disabled={saving}
                  />
                </div>
                <textarea
                  id="cc_brief_text"
                  value={briefText}
                  onChange={(e) => setBriefText(e.target.value)}
                  placeholder="Scenario / client for this choice card. Students who pick it see this prose first."
                  rows={6}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </section>

              {/* Constraints */}
              <section className="mb-6">
                <h3 className="mb-2 text-sm font-medium text-gray-700">
                  Constraints
                </h3>
                {constraints.archetype === "design" ? (
                  <DesignConstraintsEditor
                    value={constraints.data}
                    onChange={(nextData) =>
                      setConstraints({ archetype: "design", data: nextData })
                    }
                    locks={locks}
                    onToggleLock={handleToggleLock}
                    disabled={saving}
                  />
                ) : (
                  <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Generic archetype — prose-only template. Switch to Design
                    archetype by saving with any constraint field set (this
                    becomes the default for now; multi-archetype templates
                    follow in a future phase).
                  </p>
                )}
              </section>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-6 py-3">
          <div className="text-xs text-zinc-500">
            {saving
              ? "Saving…"
              : savedAt
                ? `✓ Saved ${savedAt.toLocaleTimeString()}`
                : "Click Save to apply the template to this card."}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || loading}
              data-testid="choice-card-brief-template-save"
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:bg-zinc-300"
            >
              {saving ? "Saving…" : "Save template"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Suppress unused-import warning for GENERIC_CONSTRAINTS — kept exported-
// shape-compatible with future "switch to generic" affordance.
void GENERIC_CONSTRAINTS;
