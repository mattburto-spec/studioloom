"use client";

/**
 * Generic in-page slide-in drawer used by the lesson page's right-
 * side tools rail to wrap <KanbanBoard /> or <TimelineBoard />.
 *
 * Round 16 (6 May 2026) — match the PortfolioPanel slide animation
 * pattern (drawer stays mounted, slides via translate-x with
 * pointer-events gating + scrim opacity transition). Previous
 * version unmounted on close → sudden appearance with no motion.
 *
 * Also widened: min(100%, 720px) so the Kanban's 4 columns don't
 * cramp + the Timeline's milestone list breathes.
 */

import { useEffect, type ReactNode } from "react";

interface BoardDrawerProps {
  open: boolean;
  title: string;
  /** Short note rendered below the title — explain what the drawer is for. */
  subtitle?: string;
  onClose: () => void;
  /** A "Open full board" link to the unit's board page (optional). */
  fullBoardHref?: string;
  children: ReactNode;
}

export function BoardDrawer({
  open,
  title,
  subtitle,
  onClose,
  fullBoardHref,
  children,
}: BoardDrawerProps) {
  // ESC to close — only when open so we don't compete with other handlers
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Scrim — always mounted; opacity transitions cleanly. */}
      <div
        className={
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 " +
          (open ? "opacity-100" : "opacity-0 pointer-events-none")
        }
        onClick={onClose}
        aria-hidden="true"
        data-testid="board-drawer-scrim"
      />
      {/* Drawer — always mounted; slides in via translate-x. Wider
          (720px) so the Kanban + Timeline have room. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        className={
          "fixed top-0 right-0 z-50 h-full w-full sm:w-[min(100%,720px)] bg-white shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 ease-out " +
          (open ? "translate-x-0" : "translate-x-full pointer-events-none")
        }
        data-testid="board-drawer"
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-[16px] font-extrabold text-gray-900 leading-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11.5px] text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {fullBoardHref && (
              <a
                href={fullBoardHref}
                className="text-[11px] text-violet-700 hover:text-violet-900 font-semibold underline underline-offset-2"
                data-testid="board-drawer-full-link"
              >
                Full board →
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
              data-testid="board-drawer-close"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </>
  );
}
