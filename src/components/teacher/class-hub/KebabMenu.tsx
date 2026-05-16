"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// KebabMenu — reusable dropdown for canvas-header + row kebabs (DT canvas
// Phase 3.4, 16 May 2026). Sectioned item list, click-outside + Escape
// close, optional left/right alignment, supports Link items (with optional
// newTab), onClick items, disabled items, danger styling, and "conditional"
// (greyed) hints for actions that depend on state (e.g. "Restore class" only
// makes sense if the class is archived).
// ---------------------------------------------------------------------------

export interface KebabMenuItem {
  label: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  newTab?: boolean;
  disabled?: boolean;
  danger?: boolean;
  /** Text shown in light italic on the right (e.g. "coming soon", "if archived") */
  conditional?: string;
  testId?: string;
}

export interface KebabMenuSection {
  label?: string;
  items: KebabMenuItem[];
}

interface KebabMenuProps {
  trigger: ReactNode;
  triggerAriaLabel: string;
  sections: KebabMenuSection[];
  /** Override the wrapper testid (so consumers can put the menu on the right shape) */
  testId?: string;
  align?: "left" | "right";
}

export default function KebabMenu({
  trigger,
  triggerAriaLabel,
  sections,
  testId,
  align = "right",
}: KebabMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={wrapperRef} data-testid={testId}>
      <button
        type="button"
        aria-label={triggerAriaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          data-testid={testId ? `${testId}-panel` : undefined}
          className={`absolute top-full mt-2 ${align === "right" ? "right-0" : "left-0"} w-[280px] bg-white border border-border rounded-2xl shadow-xl p-1.5 z-50`}
        >
          {sections.map((section, sIdx) => (
            <div key={sIdx}>
              {section.label && (
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                  {section.label}
                </div>
              )}
              {section.items.map((item, iIdx) => {
                const baseClass = `flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                  item.disabled
                    ? "text-text-tertiary cursor-not-allowed"
                    : item.danger
                      ? "text-red-600 hover:bg-red-50"
                      : "text-text-primary hover:bg-surface-alt"
                }`;
                const content = (
                  <>
                    {item.icon && (
                      <span className="w-4 text-text-tertiary flex-shrink-0 flex items-center justify-center">
                        {item.icon}
                      </span>
                    )}
                    <span className="flex-1">{item.label}</span>
                    {item.conditional && (
                      <span className="text-[10px] text-text-tertiary italic ml-2">
                        {item.conditional}
                      </span>
                    )}
                  </>
                );
                if (item.href && !item.disabled) {
                  return (
                    <Link
                      key={iIdx}
                      href={item.href}
                      target={item.newTab ? "_blank" : undefined}
                      rel={item.newTab ? "noopener noreferrer" : undefined}
                      role="menuitem"
                      data-testid={item.testId}
                      className={baseClass}
                      onClick={() => setOpen(false)}
                    >
                      {content}
                    </Link>
                  );
                }
                return (
                  <button
                    key={iIdx}
                    type="button"
                    role="menuitem"
                    data-testid={item.testId}
                    disabled={item.disabled}
                    onClick={() => {
                      if (item.disabled) return;
                      item.onClick?.();
                      setOpen(false);
                    }}
                    className={baseClass}
                  >
                    {content}
                  </button>
                );
              })}
              {sIdx < sections.length - 1 && (
                <div className="h-px bg-border my-1.5" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
