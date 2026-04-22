"use client";

/* ================================================================
 * SidebarSlotContext — lets a child route layout register a
 * "mobile-sidebar-open" handler with the layout-owned BoldTopNav.
 *
 * When a student is on /unit/[id]/[page], the unit layout registers
 * a callback that opens the lesson drawer. BoldTopNav consumes this
 * context and renders a mobile-only hamburger button when a handler
 * is present. On routes with no sidebar (dashboard, gallery, etc.)
 * handler stays null → no button renders.
 *
 * Minimal by design. If more routes need their own mobile drawers,
 * the pattern generalises by adding more slots.
 * ================================================================ */

import { createContext, useContext } from "react";

type SidebarSlotValue = {
  /** Registered by the unit layout (or any future route layout with a sidebar).
   *  null = no hamburger shown in the nav. */
  handler: (() => void) | null;
  setHandler: (h: (() => void) | null) => void;
};

export const SidebarSlotContext = createContext<SidebarSlotValue>({
  handler: null,
  setHandler: () => {},
});

export function useSidebarSlot() {
  return useContext(SidebarSlotContext);
}
