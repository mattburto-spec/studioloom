"use client";

// Choice Cards block — Framer Motion flippable deck.
//
// State machine:
//   loading        → fetching deck + existing selection
//   picking        → grid is interactive; hover lifts, tap flips
//   posting        → POST /pick in flight after a Pick button click
//   picked         → chosen card centred + scaled; others fade + lock;
//                     "Continue →" appears after 800ms
//
// Single-pick lock is the v1 contract — once a row exists in
// choice_card_selections for (student, activityId), the deck renders
// read-only with the chosen card highlighted. "Change pick" affordance
// is `FU-CCB-CHANGE-PICK-TOGGLE` (P3).

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MarkdownPrompt } from "@/components/student/MarkdownPrompt";
import type { ChoiceCardsBlockConfig } from "@/components/teacher/lesson-editor/BlockPalette.types";

interface ChoiceCard {
  id: string;
  label: string;
  hook_text: string;
  detail_md: string;
  image_url: string | null;
  emoji: string | null;
  bg_color: string | null;
  tags: string[];
  on_pick_action: unknown;
  ships_to_platform: boolean;
}

interface Selection {
  cardId: string;
  label: string;
  action_resolved: unknown;
  picked_at?: string;
}

interface Props {
  activityId: string;
  config: ChoiceCardsBlockConfig;
  unitId?: string;
  onChange: (value: string) => void;
}

const PITCH_OWN_ID = "_pitch-your-own";

export default function ChoiceCardsBlock({ activityId, config, unitId, onChange }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [cards, setCards] = useState<ChoiceCard[] | null>(null);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [posting, setPosting] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const continueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch deck + existing selection on mount. Re-fetch when activityId
  // or cardIds change (only meaningful in editor preview / SSR rehydrate).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [deckRes, selRes] = await Promise.all([
          config.cardIds.length > 0
            ? fetch(
                `/api/student/choice-cards/deck?ids=${encodeURIComponent(config.cardIds.join(","))}`,
                { credentials: "same-origin" },
              )
            : Promise.resolve(null),
          fetch(`/api/student/choice-cards/${encodeURIComponent(activityId)}/selection`, {
            credentials: "same-origin",
          }),
        ]);
        if (cancelled) return;

        const deck: ChoiceCard[] = deckRes && deckRes.ok ? (await deckRes.json()).cards ?? [] : [];
        setCards(deck);

        if (selRes.ok) {
          const sel = (await selRes.json()).selection;
          if (sel) {
            setSelection(sel);
            onChange(sel.label);
          }
        }
      } catch (e) {
        if (!cancelled) setErrorMsg(e instanceof Error ? e.message : "Failed to load cards");
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (continueTimerRef.current) clearTimeout(continueTimerRef.current);
    };
    // We intentionally only re-fetch when activityId / cardIds change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId, config.cardIds.join(",")]);

  // Trigger "Continue →" delay when a fresh pick lands.
  useEffect(() => {
    if (!selection) return;
    setShowContinue(false);
    const t = setTimeout(() => setShowContinue(true), 800);
    continueTimerRef.current = t;
    return () => clearTimeout(t);
  }, [selection]);

  async function handlePick(cardId: string, label: string) {
    if (posting || selection) return;
    setPosting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/student/choice-cards/${encodeURIComponent(activityId)}/pick`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ cardId, unitId }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Pick failed (${res.status})`);
      }
      const data = await res.json();
      const sel: Selection = {
        cardId: data.cardId,
        label: data.label ?? label,
        action_resolved: data.action_resolved,
      };
      setSelection(sel);
      onChange(sel.label);
      setFlippedId(null);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Pick failed");
    } finally {
      setPosting(false);
    }
  }

  const deckWithPitch = useMemo<Array<ChoiceCard | "pitch">>(() => {
    const list: Array<ChoiceCard | "pitch"> = cards ? [...cards] : [];
    if (config.showPitchYourOwn) list.push("pitch");
    return list;
  }, [cards, config.showPitchYourOwn]);

  if (errorMsg) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        Couldn&apos;t load the deck: {errorMsg}
      </div>
    );
  }

  if (cards === null) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center text-sm text-emerald-700">
        Loading cards…
      </div>
    );
  }

  if (cards.length === 0 && !config.showPitchYourOwn) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-600">
        Your teacher hasn&apos;t added any cards to this deck yet.
      </div>
    );
  }

  const isLocked = selection !== null;

  return (
    <div className="relative">
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
        }}
        role="radiogroup"
        aria-label="Choice cards — pick one"
      >
        {deckWithPitch.map((card) => {
          const isPitch = card === "pitch";
          const id = isPitch ? PITCH_OWN_ID : card.id;
          const isFlipped = flippedId === id;
          const isChosen = selection?.cardId === id;
          const isFocused = isChosen;
          const isDimmed = isLocked && !isChosen;
          return (
            <CardFace
              key={id}
              card={card}
              isPitch={isPitch}
              isFlipped={isFlipped}
              isLocked={isLocked}
              isFocused={isFocused}
              isDimmed={isDimmed}
              posting={posting}
              prefersReducedMotion={!!prefersReducedMotion}
              onFlip={() => {
                if (isLocked) return;
                setFlippedId((cur) => (cur === id ? null : id));
              }}
              onPick={() => {
                const label = isPitch ? "Pitch your own idea" : card.label;
                void handlePick(id, label);
              }}
            />
          );
        })}
      </div>

      {/* Continue button — emitted as an event for the lesson page; v1 has
          no destination yet, so we just surface visual confirmation. */}
      <AnimatePresence>
        {isLocked && showContinue && (
          <motion.div
            className="mt-6 flex justify-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-800">
              ✓ Picked: {selection?.label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Card face — single flippable card.
// ─────────────────────────────────────────────────────────────────────

interface CardFaceProps {
  card: ChoiceCard | "pitch";
  isPitch: boolean;
  isFlipped: boolean;
  isLocked: boolean;
  isFocused: boolean;
  isDimmed: boolean;
  posting: boolean;
  prefersReducedMotion: boolean;
  onFlip: () => void;
  onPick: () => void;
}

function CardFace({
  card,
  isPitch,
  isFlipped,
  isLocked,
  isFocused,
  isDimmed,
  posting,
  prefersReducedMotion,
  onFlip,
  onPick,
}: CardFaceProps) {
  const cardData = isPitch ? null : (card as ChoiceCard);
  const label = isPitch ? "I have a different idea" : cardData!.label;
  const hook = isPitch ? "Pitch it to your teacher." : cardData!.hook_text;

  const scale = isFocused ? 1.05 : isDimmed ? 0.92 : 1;
  const opacity = isDimmed ? 0.35 : 1;
  const pointerEvents = isDimmed ? "none" : "auto";

  return (
    <motion.div
      className="relative h-72"
      style={{ pointerEvents }}
      animate={{ scale, opacity }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <motion.div
        className="relative h-full w-full cursor-pointer select-none"
        style={{ transformStyle: prefersReducedMotion ? "flat" : "preserve-3d" }}
        whileHover={
          !isLocked && !prefersReducedMotion
            ? { y: -8, rotate: 1, transition: { duration: 0.2 } }
            : undefined
        }
        animate={
          prefersReducedMotion
            ? {}
            : { rotateY: isFlipped ? 180 : 0 }
        }
        transition={{ duration: 0.5, ease: "easeInOut" }}
        onClick={onFlip}
        role="radio"
        aria-checked={isFocused}
        aria-label={`${label}. ${hook}`}
        tabIndex={isLocked ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onFlip();
          }
        }}
      >
        {/* Reduced motion: crossfade between front and back. */}
        {prefersReducedMotion ? (
          isFlipped ? (
            <CardBack
              cardData={cardData}
              isPitch={isPitch}
              posting={posting}
              isLocked={isLocked}
              onPick={onPick}
            />
          ) : (
            <CardFront cardData={cardData} isPitch={isPitch} label={label} hook={hook} />
          )
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <CardFront cardData={cardData} isPitch={isPitch} label={label} hook={hook} />
            </div>
            <div
              className="absolute inset-0"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              <CardBack
                cardData={cardData}
                isPitch={isPitch}
                posting={posting}
                isLocked={isLocked}
                onPick={onPick}
              />
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function CardFront({
  cardData,
  isPitch,
  label,
  hook,
}: {
  cardData: ChoiceCard | null;
  isPitch: boolean;
  label: string;
  hook: string;
}) {
  if (isPitch) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-6 text-center">
        <div className="text-5xl text-zinc-400">+</div>
        <div className="mt-3 text-base font-semibold text-zinc-800">{label}</div>
        <div className="mt-1 text-xs text-zinc-500">{hook}</div>
      </div>
    );
  }

  const c = cardData!;
  const bg = c.image_url
    ? undefined
    : c.bg_color || "#10B981";
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-2xl shadow-sm"
      style={{
        background: c.image_url ? undefined : bg,
        backgroundImage: c.image_url ? `url(${c.image_url})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Top-right badge */}
      {c.ships_to_platform && (
        <div className="absolute right-3 top-3 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 shadow-sm">
          🚀 Can ship
        </div>
      )}

      {/* Centre — emoji (only if no image) */}
      {!c.image_url && c.emoji && (
        <div className="flex flex-1 items-center justify-center text-[88px] leading-none drop-shadow-sm">
          {c.emoji}
        </div>
      )}
      {c.image_url && <div className="flex-1" />}

      {/* Bottom text overlay */}
      <div
        className="px-4 py-3"
        style={{
          background: c.image_url
            ? "linear-gradient(transparent, rgba(0,0,0,0.55))"
            : "rgba(255,255,255,0.92)",
          color: c.image_url ? "white" : "#0f172a",
        }}
      >
        <div className="text-base font-bold leading-tight">{label}</div>
        <div className="mt-1 text-xs leading-snug opacity-90">{hook}</div>
      </div>
    </div>
  );
}

function CardBack({
  cardData,
  isPitch,
  posting,
  isLocked,
  onPick,
}: {
  cardData: ChoiceCard | null;
  isPitch: boolean;
  posting: boolean;
  isLocked: boolean;
  onPick: () => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex-1 overflow-auto pr-1">
        {isPitch ? (
          <p className="text-sm leading-relaxed text-zinc-700">
            Got an idea that&apos;s not in the deck? Pick this card and your teacher will work
            through it with you in class.
          </p>
        ) : (
          <div className="text-sm leading-relaxed text-zinc-700">
            <MarkdownPrompt text={cardData!.detail_md} />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!isLocked && !posting) onPick();
        }}
        disabled={isLocked || posting}
        className="mt-3 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {posting ? "Picking…" : isPitch ? "✨ Pitch this" : "✨ Pick this"}
      </button>
    </div>
  );
}
