"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import {
  resolvePosition,
  displayName,
  CARD_WIDTH,
  CARD_HEIGHT,
  DEBOUNCE_MS,
  type CanvasSubmission,
  type CanvasLayoutChange,
} from "./gallery-canvas-helpers";

// Re-export the helper types so existing consumers keep importing from this module.
export type { CanvasSubmission, CanvasLayoutChange } from "./gallery-canvas-helpers";

interface GalleryCanvasViewProps {
  roundId: string;
  submissions: CanvasSubmission[];
  isTeacher: boolean;
  anonymous: boolean;
  /** Called with batched changes ~600ms after the last card move. Teacher-only. */
  onLayoutChange?: (changes: CanvasLayoutChange[]) => void;
}

export function GalleryCanvasView({
  roundId: _roundId,
  submissions,
  isTeacher,
  anonymous,
  onLayoutChange,
}: GalleryCanvasViewProps) {
  // Positions in canvas coordinates. Seeded from props, then mutated locally
  // during drags. Parent updates flow in via the effect below.
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const seed: Record<string, { x: number; y: number }> = {};
    submissions.forEach((s, i) => {
      seed[s.id] = resolvePosition(s, i);
    });
    return seed;
  });

  // Reseed positions when submissions array identity changes (e.g., after
  // server refetch). Preserves any local changes already in `positions`
  // for submissions that exist in both old and new arrays.
  useEffect(() => {
    setPositions((prev) => {
      const next: Record<string, { x: number; y: number }> = {};
      submissions.forEach((s, i) => {
        next[s.id] = prev[s.id] ?? resolvePosition(s, i);
      });
      return next;
    });
  }, [submissions]);

  // Track the current scale so drag deltas convert from screen → canvas space
  const scaleRef = useRef(1);

  // Debounced emit of layout changes. Keyed per submission so the most recent
  // drop per card survives, and all pending drops flush together after DEBOUNCE_MS
  // of idleness.
  const pendingRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleEmit = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const pending = pendingRef.current;
      if (pending.size > 0 && onLayoutChange) {
        const changes: CanvasLayoutChange[] = Array.from(pending.entries()).map(
          ([submissionId, { x, y }]) => ({ submissionId, x, y })
        );
        pendingRef.current = new Map();
        onLayoutChange(changes);
      }
      timerRef.current = null;
    }, DEBOUNCE_MS);
  }, [onLayoutChange]);

  // Flush any pending changes on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  // Drag state for the active card
  const dragStateRef = useRef<{
    submissionId: string;
    startPointerX: number;
    startPointerY: number;
    startCardX: number;
    startCardY: number;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  const handleCardPointerDown = useCallback(
    (submissionId: string, e: React.PointerEvent<HTMLDivElement>) => {
      if (!isTeacher) return;
      e.stopPropagation();
      const pos = positions[submissionId];
      if (!pos) return;
      dragStateRef.current = {
        submissionId,
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startCardX: pos.x,
        startCardY: pos.y,
      };
      setIsDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [isTeacher, positions]
  );

  const handleCardPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const dxScreen = e.clientX - drag.startPointerX;
      const dyScreen = e.clientY - drag.startPointerY;
      const scale = scaleRef.current || 1;
      const x = drag.startCardX + dxScreen / scale;
      const y = drag.startCardY + dyScreen / scale;
      setPositions((prev) => ({ ...prev, [drag.submissionId]: { x, y } }));
    },
    []
  );

  const handleCardPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const finalPos = positions[drag.submissionId];
      if (finalPos) {
        pendingRef.current.set(drag.submissionId, finalPos);
        scheduleEmit();
      }
      dragStateRef.current = null;
      setIsDragging(false);
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    },
    [positions, scheduleEmit]
  );

  // Empty state — show a friendly message instead of an empty canvas
  if (submissions.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-96 bg-gray-50 rounded-2xl border border-dashed border-gray-300"
        data-testid="gallery-canvas-empty"
      >
        <p className="text-gray-500 text-sm">No submissions yet</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-[600px] bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden"
      data-testid="gallery-canvas"
    >
      <TransformWrapper
        initialScale={1}
        minScale={0.25}
        maxScale={2}
        panning={{ disabled: isDragging }}
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: true }}
        onTransformed={(_ref, state) => {
          scaleRef.current = state.scale;
        }}
      >
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ width: "4000px", height: "3000px" }}
        >
          <div className="relative" style={{ width: "4000px", height: "3000px" }}>
            {submissions.map((submission, index) => {
              const pos = positions[submission.id] ?? resolvePosition(submission, index);
              const label = displayName(submission, index, anonymous);
              return (
                <div
                  key={submission.id}
                  data-testid={`gallery-canvas-card-${submission.id}`}
                  data-x={pos.x}
                  data-y={pos.y}
                  onPointerDown={(e) => handleCardPointerDown(submission.id, e)}
                  onPointerMove={handleCardPointerMove}
                  onPointerUp={handleCardPointerUp}
                  onPointerCancel={handleCardPointerUp}
                  className={`absolute bg-white rounded-xl shadow-md border border-gray-200 p-4 flex flex-col gap-2 ${
                    isTeacher ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                  }`}
                  style={{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    width: `${CARD_WIDTH}px`,
                    height: `${CARD_HEIGHT}px`,
                    touchAction: isTeacher ? "none" : "auto",
                  }}
                >
                  <p className="font-semibold text-sm text-gray-900 truncate">{label}</p>
                  {submission.contextNote ? (
                    <p className="text-xs text-gray-600 line-clamp-2 flex-1">
                      {submission.contextNote}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 italic flex-1">No context note</p>
                  )}
                </div>
              );
            })}
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
