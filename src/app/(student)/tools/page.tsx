"use client";

import { useState } from "react";
import { tools, type Phase } from "@/app/toolkit/tools-data";
import { ToolModal } from "@/components/toolkit/ToolModal";

const PHASES: Phase[] = ["discover", "define", "ideate", "prototype", "test"];

/**
 * StudentToolBrowser
 *
 * Simplified tool browser for students (not the full teacher toolkit).
 * - Shows only interactive tools (those with slugs)
 * - Simple phase-based filtering
 * - Recent sessions section
 * - Dark theme matching toolkit aesthetic
 */
export default function StudentToolsPage() {
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter to interactive tools only
  const interactiveTools = tools.filter((t) => t.slug);

  // Apply filters
  const filteredTools = interactiveTools.filter((tool) => {
    if (selectedPhase && !tool.phases.includes(selectedPhase)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.desc.toLowerCase().includes(q) ||
        tool.synonyms.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const phaseColors: Record<Phase, string> = {
    discover: "#6366f1",
    define: "#ec4899",
    ideate: "#a855f7",
    prototype: "#f59e0b",
    test: "#10b981",
  };

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#0f0f1a" }}>
      {/* Modal overlay */}
      {selectedToolId && (
        <ToolModal
          toolId={selectedToolId}
          onClose={() => setSelectedToolId(null)}
        />
      )}

      {/* Hero section */}
      <div className="relative px-4 py-12 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <h1
            className="text-4xl font-bold mb-2 bg-gradient-to-r from-white via-blue-200 to-purple-300 bg-clip-text text-transparent"
          >
            Design Thinking Tools
          </h1>
          <p className="text-white/60 text-lg">
            Powerful tools to guide you through every phase of the design cycle
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-6 border-b border-white/10 sticky top-0 z-40 bg-gradient-to-b from-[#0f0f1a] to-[#0f0f1a]/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-3 w-4 h-4 text-white/40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Phase filter pills */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedPhase(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                selectedPhase === null
                  ? "bg-white text-[#0f0f1a]"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              All phases
            </button>
            {PHASES.map((phase) => (
              <button
                key={phase}
                onClick={() => setSelectedPhase(selectedPhase === phase ? null : phase)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition capitalize ${
                  selectedPhase === phase
                    ? "text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
                style={{
                  backgroundColor: selectedPhase === phase ? phaseColors[phase] : undefined,
                }}
              >
                {phase}
              </button>
            ))}
          </div>

          {/* Results count */}
          <p className="text-white/50 text-sm">
            Showing {filteredTools.length} of {interactiveTools.length} tools
          </p>
        </div>
      </div>

      {/* Tools grid */}
      <div className="px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {filteredTools.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/60 text-lg mb-2">No tools found</p>
              <p className="text-white/40">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTools.map((tool) => (
                <button
                  key={tool.slug}
                  onClick={() => setSelectedToolId(tool.slug || "")}
                  className="text-left group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-6 hover:border-white/20 hover:bg-gradient-to-br hover:from-white/10 hover:to-white/5 transition-all"
                >
                  {/* Background glow */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity"
                    style={{ backgroundColor: tool.color }}
                  />

                  {/* Content */}
                  <div className="relative z-10">
                    {/* Color dot + name */}
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-white group-hover:text-blue-200 transition">
                        {tool.name}
                      </h3>
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tool.color }}
                      />
                    </div>

                    {/* Description */}
                    <p className="text-white/60 text-sm mb-4 line-clamp-2">
                      {tool.desc}
                    </p>

                    {/* Metadata */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {/* Difficulty badge */}
                      <span
                        className="text-xs px-2 py-1 rounded-full font-medium capitalize"
                        style={{
                          backgroundColor: `${tool.color}20`,
                          color: tool.color,
                        }}
                      >
                        {tool.difficulty}
                      </span>

                      {/* Time estimate */}
                      <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded-full">
                        {tool.time}
                      </span>
                    </div>

                    {/* Phases */}
                    <div className="flex gap-1 flex-wrap">
                      {tool.phases.map((phase) => (
                        <span
                          key={phase}
                          className="text-xs px-2 py-0.5 rounded capitalize text-white/70"
                          style={{ backgroundColor: `${phaseColors[phase]}30` }}
                        >
                          {phase}
                        </span>
                      ))}
                    </div>

                    {/* CTA */}
                    <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-300 group-hover:text-blue-200 transition">
                      Open tool
                      <svg
                        className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
