"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  tools,
  type Phase,
  type ToolGroup,
  PHASE_COLORS,
  PHASE_LABELS,
  SEARCH_RULES,
  INTERACTIVE_SLUGS,
  getToolUrl,
  COMING_SOON,
} from "@/app/toolkit/tools-data";
import { ToolkitThumbnail } from "@/app/toolkit/toolkit-thumbnails";
import { ToolModal } from "@/components/toolkit/ToolModal";

/* ── Category tabs (shared with public page) ─────────────────── */
const TOOLKIT_TABS = [
  { id: "design-thinking", label: "Design Thinking", active: true },
  { id: "systems-thinking", label: "Systems Thinking", active: false },
  { id: "entrepreneurship", label: "Entrepreneurship", active: false },
  { id: "scientific-method", label: "Scientific Method", active: false },
  { id: "creative-arts", label: "Creative Arts", active: false },
];

/* ── Animation variants ─────────────────────────────────────── */
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03, delayChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 320, damping: 28 },
  },
};

/* ── Phase pills ────────────────────────────────────────────── */
const PHASES: { key: Phase; label: string; color: string }[] = [
  { key: "discover", label: "Discover", color: PHASE_COLORS.discover },
  { key: "define", label: "Define", color: PHASE_COLORS.define },
  { key: "ideate", label: "Ideate", color: PHASE_COLORS.ideate },
  { key: "prototype", label: "Prototype", color: PHASE_COLORS.prototype },
  { key: "test", label: "Test", color: PHASE_COLORS.test },
];

/* ── Group pills ────────────────────────────────────────────── */
const GROUPS: { key: ToolGroup; label: string }[] = [
  { key: "ideation", label: "Ideation" },
  { key: "analysis", label: "Analysis" },
  { key: "evaluation", label: "Evaluation" },
  { key: "research", label: "Research" },
  { key: "planning", label: "Planning" },
];

/* ── AI search helper (same as public page) ─────────────────── */
function aiSearch(query: string): string[] | null {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return null;
  for (const rule of SEARCH_RULES) {
    if (rule.keywords.some((kw) => q.includes(kw))) return rule.tools;
  }
  return null;
}

/* ── Difficulty badge color ──────────────────────────────────── */
const diffColor = (d: string) =>
  d === "beginner"
    ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : d === "intermediate"
    ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-red-500 bg-red-50 border-red-200";

export default function TeacherToolkitPage() {
  const [search, setSearch] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ToolGroup | null>(null);
  const [selectedToolSlug, setSelectedToolSlug] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  /* ── Filtered tool list ───────────────────────────────────── */
  const { filtered, aiActive } = useMemo(() => {
    const aiHits = search ? aiSearch(search) : null;
    const result = tools.filter((t) => {
      if (selectedPhase && t.phase !== selectedPhase) return false;
      if (selectedGroup && t.group !== selectedGroup) return false;
      if (aiHits) return aiHits.includes(t.id);
      if (search) {
        const q = search.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q);
      }
      return true;
    });
    return { filtered: result, aiActive: aiHits !== null && aiHits.length > 0 };
  }, [search, selectedPhase, selectedGroup]);

  const interactiveTools = filtered.filter((t) => t.interactive);
  const catalogTools = filtered.filter((t) => !t.interactive);
  const hasFilter = !!selectedPhase || !!selectedGroup || search.length > 0;

  /* ── Handlers ─────────────────────────────────────────────── */
  const handlePhaseClick = (phase: Phase) => {
    setSelectedPhase(selectedPhase === phase ? null : phase);
    setTimeout(() => {
      if (gridRef.current) {
        const y = gridRef.current.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }, 100);
  };

  const handleToolClick = (toolId: string) => {
    const slug = INTERACTIVE_SLUGS[toolId];
    if (slug) setSelectedToolSlug(slug);
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      {/* Tool modal */}
      <AnimatePresence>
        {selectedToolSlug && (
          <ToolModal toolId={selectedToolSlug} onClose={() => setSelectedToolSlug(null)} />
        )}
      </AnimatePresence>

      {/* ── Header ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Design Thinking Toolkit
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            {tools.length} tools across {PHASES.length} phases — assign to units or use in class
          </p>
        </div>
        <Link
          href="/toolkit"
          target="_blank"
          className="text-xs text-brand-purple hover:underline font-medium flex items-center gap-1"
        >
          Open public toolkit
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </Link>
      </motion.div>

      {/* ── Category tabs ─────────────────────────────────────── */}
      <div className="relative mb-5">
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-400 via-purple-500 to-blue-400 opacity-60" />
        <div className="flex gap-0 overflow-auto">
          {TOOLKIT_TABS.map((tab) => (
            <div
              key={tab.id}
              className={`px-5 py-2.5 text-xs font-bold whitespace-nowrap relative ${
                tab.active
                  ? "text-text-primary border-b-2 border-white -mb-px z-10"
                  : "text-text-secondary/30 cursor-not-allowed"
              }`}
            >
              {tab.label}
              {!tab.active && (
                <span className="text-[9px] font-semibold ml-1.5 px-1.5 py-0.5 rounded bg-gray-100 text-text-secondary/30 align-middle">
                  Soon
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="flex flex-wrap items-center gap-3 mb-6 sticky top-0 z-40 bg-white/90 backdrop-blur-lg -mx-6 px-6 py-3 border-b border-transparent"
        style={{ top: 0 }}
      >
        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/40"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Try "I need to prioritise ideas" or "compare options"'
            className="pl-8 pr-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple w-80"
          />
        </div>

        {/* Phase pills */}
        <div className="flex gap-1.5">
          {PHASES.map((p) => (
            <motion.button
              key={p.key}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => handlePhaseClick(p.key)}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: selectedPhase === p.key ? p.color : p.color + "10",
                color: selectedPhase === p.key ? "#fff" : p.color,
                border: `1.5px solid ${selectedPhase === p.key ? p.color : p.color + "30"}`,
              }}
            >
              {p.label}
            </motion.button>
          ))}
        </div>

        {/* Group filter */}
        <select
          value={selectedGroup || ""}
          onChange={(e) => setSelectedGroup((e.target.value as ToolGroup) || null)}
          className="px-3 py-2 border border-border rounded-xl text-xs text-text-secondary bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
        >
          <option value="">All groups</option>
          {GROUPS.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
        </select>

        {/* Clear */}
        <AnimatePresence>
          {hasFilter && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => {
                setSelectedPhase(null);
                setSelectedGroup(null);
                setSearch("");
              }}
              className="text-xs text-red-400 hover:text-red-500 font-medium px-2 py-1 rounded-lg border border-red-200 hover:border-red-300 transition"
            >
              Clear
            </motion.button>
          )}
        </AnimatePresence>

        {/* Count */}
        <motion.span
          key={filtered.length}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xs text-text-secondary ml-auto flex items-center gap-2"
        >
          {filtered.length} of {tools.length} tools
          {aiActive && (
            <span className="text-[10px] font-semibold text-purple-500 bg-purple-50 px-2 py-0.5 rounded">
              AI matched
            </span>
          )}
        </motion.span>
      </motion.div>

      {/* ── Tool Grid ───────────────────────────────────────── */}
      <div ref={gridRef}>
        {/* Interactive Tools */}
        <AnimatePresence mode="wait">
          {interactiveTools.length > 0 && (
            <motion.div
              key="interactive"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-8"
            >
              <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <span className="w-5 h-5 bg-purple-600 text-white rounded flex items-center justify-center text-[10px] font-bold">
                  #
                </span>
                Interactive Tools
                <span className="text-xs font-normal text-text-secondary">
                  AI-powered, student-facing
                </span>
              </h2>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid gap-3"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
              >
                {interactiveTools.map((tool) => (
                  <motion.button
                    key={tool.id}
                    variants={cardVariants}
                    layout
                    whileHover={{
                      y: -3,
                      boxShadow:
                        "0 8px 30px rgba(0,0,0,0.08), 0 0 20px rgba(123,47,242,0.04)",
                    }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleToolClick(tool.id)}
                    className="bg-white rounded-2xl border border-border shadow-sm text-left hover:border-brand-purple/20 transition-all group overflow-hidden"
                  >
                    {/* SVG thumbnail */}
                    <div
                      className="h-28 flex items-center justify-center"
                      style={{ background: PHASE_COLORS[tool.phase] + "0a" }}
                    >
                      <ToolkitThumbnail toolId={tool.id} phase={tool.phase} />
                    </div>

                    {/* Info */}
                    <div className="px-4 pb-3 pt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{
                            color: PHASE_COLORS[tool.phase],
                            background: PHASE_COLORS[tool.phase] + "18",
                          }}
                        >
                          {PHASE_LABELS[tool.phase]}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${diffColor(
                            tool.difficulty
                          )}`}
                        >
                          {tool.difficulty}
                        </span>
                        <span className="text-[10px] text-purple-600 font-bold ml-auto">
                          INTERACTIVE
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-text-primary truncate group-hover:text-brand-purple transition">
                        {tool.name}
                      </p>
                      <p className="text-xs text-text-secondary mt-0.5 line-clamp-2 leading-relaxed">
                        {tool.desc}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-text-secondary/60">
                        <span>{tool.time}</span>
                        <span>{tool.group}</span>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Catalog Tools */}
        <AnimatePresence mode="wait">
          {catalogTools.length > 0 && (
            <motion.div
              key="catalog"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                Catalog Tools
                <span className="text-xs font-normal text-text-secondary">
                  Printable worksheets &amp; guides — coming soon as interactive
                </span>
              </h2>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid gap-3"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
              >
                {catalogTools.map((tool) => (
                  <motion.div
                    key={tool.id}
                    variants={cardVariants}
                    layout
                    whileHover={{ y: -2 }}
                    className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden opacity-80"
                  >
                    {/* SVG thumbnail */}
                    <div
                      className="h-24 flex items-center justify-center opacity-50"
                      style={{ background: PHASE_COLORS[tool.phase] + "06" }}
                    >
                      <ToolkitThumbnail toolId={tool.id} phase={tool.phase} />
                    </div>

                    {/* Info */}
                    <div className="px-4 pb-3 pt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{
                            color: PHASE_COLORS[tool.phase],
                            background: PHASE_COLORS[tool.phase] + "12",
                          }}
                        >
                          {PHASE_LABELS[tool.phase]}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${diffColor(
                            tool.difficulty
                          )}`}
                        >
                          {tool.difficulty}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-text-primary truncate">
                        {tool.name}
                      </p>
                      <p className="text-xs text-text-secondary mt-0.5 line-clamp-2 leading-relaxed">
                        {tool.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-text-secondary">
            <p className="text-sm">No tools match your filters.</p>
            <button
              onClick={() => {
                setSelectedPhase(null);
                setSelectedGroup(null);
                setSearch("");
              }}
              className="text-brand-purple text-xs mt-2 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
