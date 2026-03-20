"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { tools, type Phase, type ToolType } from "@/app/toolkit/tools-data";
import { ToolModal } from "@/components/toolkit/ToolModal";

const PHASES: { key: Phase; label: string; color: string }[] = [
  { key: "discover", label: "Discover", color: "#6366f1" },
  { key: "define", label: "Define", color: "#ec4899" },
  { key: "ideate", label: "Ideate", color: "#a855f7" },
  { key: "prototype", label: "Prototype", color: "#f59e0b" },
  { key: "test", label: "Test", color: "#10b981" },
];

const TYPES: { key: ToolType; label: string }[] = [
  { key: "ideation", label: "Ideation" },
  { key: "analysis", label: "Analysis" },
  { key: "evaluation", label: "Evaluation" },
  { key: "research", label: "Research" },
  { key: "planning", label: "Planning" },
  { key: "communication", label: "Communication" },
  { key: "reflection", label: "Reflection" },
];

export default function TeacherToolkitPage() {
  const [search, setSearch] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [selectedType, setSelectedType] = useState<ToolType | null>(null);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return tools.filter((t) => {
      if (selectedPhase && !t.phases.includes(selectedPhase)) return false;
      if (selectedType && t.type !== selectedType) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.desc.toLowerCase().includes(q) ||
          t.synonyms.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [search, selectedPhase, selectedType]);

  const interactiveTools = filtered.filter((t) => t.slug);
  const templateTools = filtered.filter((t) => !t.slug);

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      {selectedToolId && (
        <ToolModal
          toolId={selectedToolId}
          onClose={() => setSelectedToolId(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Design Thinking Toolkit
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            {tools.length} tools across {PHASES.length} design phases — assign to units or use in class
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
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/40" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools..."
            className="pl-8 pr-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple w-56"
          />
        </div>

        {/* Phase pills */}
        <div className="flex gap-1.5">
          {PHASES.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelectedPhase(selectedPhase === p.key ? null : p.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: selectedPhase === p.key ? p.color : "transparent",
                color: selectedPhase === p.key ? "#fff" : p.color,
                border: `1.5px solid ${selectedPhase === p.key ? p.color : p.color + "40"}`,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select
          value={selectedType || ""}
          onChange={(e) => setSelectedType((e.target.value as ToolType) || null)}
          className="px-3 py-2 border border-border rounded-xl text-xs text-text-secondary bg-white focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>

        {/* Count */}
        <span className="text-xs text-text-secondary ml-auto">
          {filtered.length} of {tools.length} tools
        </span>
      </div>

      {/* Interactive tools */}
      {interactiveTools.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            Interactive Tools
            <span className="text-xs font-normal text-text-secondary">AI-powered, student-facing</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {interactiveTools.map((tool) => (
              <button
                key={tool.slug}
                onClick={() => setSelectedToolId(tool.slug || "")}
                className="bg-white rounded-2xl border border-border shadow-sm p-4 text-left hover:shadow-md hover:border-brand-purple/20 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${tool.color}15` }}
                  >
                    <div
                      className="w-4 h-4 rounded-sm"
                      style={{ background: tool.color }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary group-hover:text-brand-purple transition">
                      {tool.name}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{tool.desc}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {tool.phases.map((ph) => {
                        const phaseData = PHASES.find((p) => p.key === ph);
                        return (
                          <span
                            key={ph}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{ color: phaseData?.color, background: `${phaseData?.color}15` }}
                          >
                            {phaseData?.label}
                          </span>
                        );
                      })}
                      <span className="text-[10px] text-text-secondary/50">{tool.time}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Template tools */}
      {templateTools.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            Template Tools
            <span className="text-xs font-normal text-text-secondary">Printable worksheets & guides</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templateTools.map((tool) => (
              <div
                key={tool.name}
                className="bg-white rounded-2xl border border-border shadow-sm p-4"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 opacity-60"
                    style={{ background: `${tool.color}10` }}
                  >
                    <div
                      className="w-4 h-4 rounded-sm"
                      style={{ background: tool.color }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{tool.name}</p>
                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{tool.desc}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {tool.phases.map((ph) => {
                        const phaseData = PHASES.find((p) => p.key === ph);
                        return (
                          <span
                            key={ph}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{ color: phaseData?.color, background: `${phaseData?.color}10` }}
                          >
                            {phaseData?.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
