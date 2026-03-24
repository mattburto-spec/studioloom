"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { ActivitySection } from "@/types";

// ─────────────────────────────────────────────────────────────────
// Drag-and-Drop context for cross-container block dragging
// Uses HTML5 Drag and Drop API (zero dependencies)
// Framer Motion Reorder still handles within-list reordering
// ─────────────────────────────────────────────────────────────────

export interface DragPayload {
  /** The activity to insert when dropped */
  activity: ActivitySection;
  /** Display label while dragging */
  label: string;
  /** Icon emoji */
  icon: string;
  /** Source: "palette" | "phase" */
  source: "palette" | "phase";
}

interface DndState {
  isDragging: boolean;
  payload: DragPayload | null;
  activeDropZone: string | null;
}

interface DndContextValue extends DndState {
  startDrag: (payload: DragPayload) => void;
  endDrag: () => void;
  setActiveDropZone: (zoneId: string | null) => void;
}

const DndCtx = createContext<DndContextValue | null>(null);

export function useDndContext() {
  const ctx = useContext(DndCtx);
  if (!ctx) throw new Error("useDndContext must be used within DndProvider");
  return ctx;
}

export function DndProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DndState>({
    isDragging: false,
    payload: null,
    activeDropZone: null,
  });

  const startDrag = useCallback((payload: DragPayload) => {
    setState({ isDragging: true, payload, activeDropZone: null });
  }, []);

  const endDrag = useCallback(() => {
    setState({ isDragging: false, payload: null, activeDropZone: null });
  }, []);

  const setActiveDropZone = useCallback((zoneId: string | null) => {
    setState((prev) => ({ ...prev, activeDropZone: zoneId }));
  }, []);

  return (
    <DndCtx.Provider value={{ ...state, startDrag, endDrag, setActiveDropZone }}>
      {children}
    </DndCtx.Provider>
  );
}
