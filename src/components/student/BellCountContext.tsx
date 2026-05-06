"use client";

/* ================================================================
 * BellCountContext — shared context so page-level components
 * (currently only /dashboard) can surface their urgency count AND
 * the actual notification items to the layout-owned BoldTopNav bell.
 *
 * Round 11 (6 May 2026) — extended from count-only to also carry an
 * items array so the bell can render a small inline popover instead
 * of navigating to /dashboard#dashboard-priority. Per Matt: clicking
 * the alert icon shouldn't take students to another page.
 *
 * Default = 0 + [] → bell shows no badge, popover says nothing urgent.
 * On /dashboard the dashboard client computes buckets after fetching
 * insights, then maps to NotificationItem[] and calls setItems().
 *
 * Intentionally minimal. If notifications need to surface from
 * non-dashboard routes (e.g. Preflight, NM teacher feedback), the
 * layout can own the fetch directly and this file goes away.
 * ================================================================ */

import { createContext, useContext } from "react";

/** A single bell-popover row. Sourced from the dashboard's QueueItem. */
export interface NotificationItem {
  /** Stable key. */
  id: string;
  kind: "overdue" | "today" | "soon";
  title: string;
  /** Short context line, e.g. unit name + criterion. */
  sub: string;
  /** Pre-rendered due-date string ("today", "tomorrow", "in 3d"). */
  dueText: string;
  /** Where clicking the row navigates. */
  href?: string;
}

type BellCountValue = {
  count: number;
  setCount: (n: number) => void;
  items: NotificationItem[];
  setItems: (items: NotificationItem[]) => void;
};

export const BellCountContext = createContext<BellCountValue>({
  count: 0,
  setCount: () => {},
  items: [],
  setItems: () => {},
});

export function useBellCount() {
  return useContext(BellCountContext);
}
