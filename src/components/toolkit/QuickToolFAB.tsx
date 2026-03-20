"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useStudent } from "@/app/(student)/student-context";
import { tools, type Phase } from "@/app/toolkit/tools-data";
import { ToolModal } from "./ToolModal";
import { motion, AnimatePresence } from "framer-motion";

interface QuickToolFABProps {
  hidden?: boolean;
  hideButton?: boolean;
}

/* ─── Phase config ─── */
const PHASES: {
  key: Phase;
  label: string;
  color: string;
  surface: string;    // light tinted background when unselected
  surfaceText: string; // text color on light surface
}[] = [
  { key: "test",      label: "Test",      color: "#10b981", surface: "#ecfdf5", surfaceText: "#065f46" },
  { key: "prototype", label: "Prototype", color: "#f59e0b", surface: "#fffbeb", surfaceText: "#92400e" },
  { key: "ideate",    label: "Ideate",    color: "#a855f7", surface: "#faf5ff", surfaceText: "#6b21a8" },
  { key: "define",    label: "Define",    color: "#ec4899", surface: "#fdf2f8", surfaceText: "#9d174d" },
  { key: "discover",  label: "Discover",  color: "#6366f1", surface: "#eef2ff", surfaceText: "#3730a3" },
];

/* ─── Spring configs ─── */
const bouncySpring = { type: "spring" as const, stiffness: 500, damping: 20 };
const snappySpring = { type: "spring" as const, stiffness: 400, damping: 24 };
const gentleSpring = { type: "spring" as const, stiffness: 300, damping: 22 };

/* ─── FAB size ─── */
const FAB_SIZE = 56;

export function QuickToolFAB({ hidden = false, hideButton = false }: QuickToolFABProps) {
  const { student } = useStudent();
  const pathname = usePathname();
  const isUnitPage = pathname?.includes("/unit/");
  const shouldHideButton = hideButton || isUnitPage;

  const [open, setOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [inProgressCount, setInProgressCount] = useState(0);

  const phaseTools = useMemo(
    () =>
      selectedPhase
        ? tools.filter((t) => t.slug && t.phases.includes(selectedPhase))
        : [],
    [selectedPhase]
  );

  useEffect(() => {
    if (!student) return;
    (async () => {
      try {
        const res = await fetch("/api/student/tool-sessions?status=in_progress");
        if (res.ok) {
          const data = await res.json();
          setInProgressCount(data.sessions?.length || 0);
        }
      } catch { /* silent */ }
    })();
  }, [student, open]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("questerra:open-tools", handler);
    return () => window.removeEventListener("questerra:open-tools", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSelectedPhase(null);
  }, []);

  if (hidden || !student) return null;

  return (
    <>
      {selectedToolId && (
        <ToolModal
          toolId={selectedToolId}
          onClose={() => { setSelectedToolId(null); handleClose(); }}
        />
      )}

      {/* ─── Scrim ─── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            className="fixed inset-0 z-[45]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            style={{
              background: "rgba(10, 8, 24, 0.4)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          />
        )}
      </AnimatePresence>

      {/* ─── Menu ─── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="fan-menu"
            className="fixed z-[50]"
            style={{
              right: 16,
              bottom: `calc(9.5rem + ${FAB_SIZE + 12}px)`,
              display: "flex",
              flexDirection: "column-reverse",
              alignItems: "flex-end",
              gap: 6,
            }}
          >
            {PHASES.map((phase, i) => {
              const isSelected = selectedPhase === phase.key;
              const toolCount = tools.filter(
                (t) => t.slug && t.phases.includes(phase.key)
              ).length;

              return (
                <motion.div
                  key={phase.key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexDirection: "row-reverse",
                  }}
                >
                  {/* ── Phase pill ── */}
                  <motion.button
                    initial={{ opacity: 0, y: 20, scale: 0.6 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.8 }}
                    transition={{ ...bouncySpring, delay: i * 0.04 }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhase(isSelected ? null : phase.key);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      height: 48,
                      padding: "0 18px",
                      borderRadius: 24,
                      border: "none",
                      cursor: "pointer",
                      background: isSelected
                        ? phase.color
                        : phase.surface,
                      boxShadow: isSelected
                        ? `0 6px 24px ${phase.color}50, 0 0 0 2px ${phase.color}40`
                        : "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
                      whiteSpace: "nowrap" as const,
                      transition: "background 0.15s ease, box-shadow 0.2s ease",
                    }}
                    title={`${phase.label} (${toolCount} tools)`}
                    aria-label={`${phase.label} phase — ${toolCount} tools`}
                  >
                    {/* Color indicator */}
                    <motion.div
                      animate={{
                        scale: isSelected ? 1.2 : 1,
                        background: isSelected ? "#fff" : phase.color,
                      }}
                      transition={snappySpring}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: isSelected ? "#fff" : phase.surfaceText,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {phase.label}
                    </span>
                    {toolCount > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: isSelected ? "rgba(255,255,255,0.8)" : phase.color,
                          background: isSelected ? "rgba(255,255,255,0.2)" : `${phase.color}15`,
                          borderRadius: 8,
                          padding: "2px 7px",
                          minWidth: 20,
                          textAlign: "center" as const,
                        }}
                      >
                        {toolCount}
                      </span>
                    )}
                  </motion.button>

                  {/* ── Tool pills ── */}
                  <AnimatePresence>
                    {isSelected && phaseTools.length > 0 && (
                      <motion.div
                        key={`tools-${phase.key}`}
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexDirection: "row-reverse",
                          overflow: "hidden",
                        }}
                      >
                        {phaseTools.map((tool, ti) => (
                          <motion.button
                            key={tool.slug}
                            initial={{ opacity: 0, x: 24, scale: 0.7 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 16, scale: 0.85 }}
                            transition={{ ...snappySpring, delay: ti * 0.03 }}
                            whileHover={{
                              scale: 1.05,
                              y: -2,
                              boxShadow: `0 6px 20px ${tool.color}30, 0 0 0 2px ${tool.color}40`,
                            }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedToolId(tool.slug || "");
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                              height: 40,
                              padding: "0 14px 0 11px",
                              borderRadius: 20,
                              border: "none",
                              cursor: "pointer",
                              background: "#fff",
                              boxShadow: `0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px ${tool.color}25`,
                              whiteSpace: "nowrap" as const,
                            }}
                            title={tool.name}
                            aria-label={`Open ${tool.name}`}
                          >
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 2,
                                background: tool.color,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#1A1A2E",
                              }}
                            >
                              {tool.name}
                            </span>
                          </motion.button>
                        ))}
                      </motion.div>
                    )}

                    {isSelected && phaseTools.length === 0 && (
                      <motion.span
                        key={`empty-${phase.key}`}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={gentleSpring}
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "#9CA3AF",
                          padding: "8px 14px",
                          background: "#fff",
                          borderRadius: 16,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        }}
                      >
                        Coming soon
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── FAB ─── */}
      {!shouldHideButton && (
        <div className="fixed right-4 z-[46]" style={{ bottom: "9.5rem" }}>
          {/* Glow ring behind FAB when open */}
          <AnimatePresence>
            {open && (
              <motion.div
                key="glow-ring"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.8, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={bouncySpring}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(123,47,242,0.15) 0%, transparent 70%)",
                  pointerEvents: "none",
                }}
              />
            )}
          </AnimatePresence>

          <motion.button
            onClick={() => { if (open) handleClose(); else setOpen(true); }}
            className="relative text-white flex items-center justify-center group"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            animate={{
              width: FAB_SIZE,
              height: FAB_SIZE,
              borderRadius: open ? 18 : FAB_SIZE / 2,
              boxShadow: open
                ? "0 8px 30px rgba(123,47,242,0.45)"
                : [
                    "0 4px 14px rgba(123,47,242,0.3)",
                    "0 6px 28px rgba(123,47,242,0.5)",
                    "0 4px 14px rgba(123,47,242,0.3)",
                  ],
            }}
            transition={open
              ? { ...snappySpring, boxShadow: { duration: 0.2 } }
              : { boxShadow: { duration: 3, repeat: Infinity, ease: "easeInOut" }, borderRadius: snappySpring }
            }
            style={{
              background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
              border: "none",
              cursor: "pointer",
            }}
            title="Design Tools"
            aria-label="Open design tools"
          >
            {/* Icon morph: # → × */}
            <motion.svg
              width="20" height="20" viewBox="0 0 32 32" fill="none"
              animate={{ rotate: open ? 45 : 0 }}
              transition={bouncySpring}
            >
              {/* Horizontal bars */}
              <motion.rect
                x="4" y="9" width="24" height="4" rx="2" fill="white"
                animate={{ y: open ? 14 : 9 }}
                transition={bouncySpring}
              />
              <motion.rect
                x="4" y="19" width="24" height="4" rx="2" fill="white"
                animate={{ y: open ? 14 : 19, opacity: open ? 0 : 1 }}
                transition={bouncySpring}
              />
              {/* Vertical bars */}
              <motion.rect
                x="9" y="4" width="4" height="24" rx="2" fill="white"
                animate={{ x: open ? 14 : 9 }}
                transition={bouncySpring}
              />
              <motion.rect
                x="19" y="4" width="4" height="24" rx="2" fill="white"
                animate={{ x: open ? 14 : 19, opacity: open ? 0 : 1 }}
                transition={bouncySpring}
              />
            </motion.svg>

            {/* Tooltip */}
            {!open && (
              <span
                className="absolute right-16 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none whitespace-nowrap"
                style={{
                  background: "#1A1A2E",
                  color: "#fff",
                  transition: "opacity 0.2s ease, transform 0.2s ease",
                }}
              >
                Design Tools
              </span>
            )}

            {/* Badge */}
            <AnimatePresence>
              {inProgressCount > 0 && !open && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={bouncySpring}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #f97316, #ea580c)",
                    boxShadow: "0 2px 8px rgba(249,115,22,0.4)",
                  }}
                >
                  {inProgressCount}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      )}
    </>
  );
}
