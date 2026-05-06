"use client";

/**
 * Smoke-fix round 6 — generic in-page slide-in drawer for the lesson
 * page's right-side tools rail.
 *
 * Wraps either <KanbanBoard /> or <TimelineBoard /> so a student can
 * peek at their project tools without leaving the lesson. The full
 * board page at /(student)/unit/[unitId]/board still mounts both side-
 * by-side; this drawer is the in-lesson surface.
 *
 * Mirrors the visual language of PortfolioPanel — full-height right
 * drawer, scrim, ESC + outside-click to close, header with the title
 * and a close button.
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
  // ESC to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
        data-testid="board-drawer-scrim"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[min(100%,540px)] bg-white shadow-2xl flex flex-col overflow-hidden"
        data-testid="board-drawer"
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-extrabold text-gray-900 leading-tight">
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
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </>
  );
}
