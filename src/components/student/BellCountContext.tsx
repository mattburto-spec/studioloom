"use client";

/* ================================================================
 * BellCountContext — tiny shared context so page-level components
 * (currently only /dashboard) can surface their urgency count to the
 * layout-owned BoldTopNav bell.
 *
 * Default = 0 → bell shows no badge. On /dashboard the dashboard
 * client computes buckets.overdue.length + buckets.today.length
 * after fetching insights, then calls setCount().
 *
 * Intentionally minimal — no loading state, no structured payload,
 * no context per-type. If we ever want bell count on non-dashboard
 * routes, the layout can own the insights fetch and this file goes
 * away. For now it preserves the Phase 9 bell-count feature through
 * the Phase 10 header unification.
 * ================================================================ */

import { createContext, useContext } from "react";

type BellCountValue = {
  count: number;
  setCount: (n: number) => void;
};

export const BellCountContext = createContext<BellCountValue>({
  count: 0,
  setCount: () => {},
});

export function useBellCount() {
  return useContext(BellCountContext);
}
