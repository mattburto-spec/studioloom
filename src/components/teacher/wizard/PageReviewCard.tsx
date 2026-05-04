"use client";

import { useState } from "react";
import type { PageContent, ResponseType } from "@/types";
import type { WizardDispatch } from "@/hooks/useWizardState";
import { composedPromptText } from "@/lib/lever-1/compose-prompt";

interface Props {
  pageId: string;
  content: PageContent;
  color: string;
  isExpanded: boolean;
  dispatch: WizardDispatch;
  onActivityDrop?: (pageId: string, activityId: string) => void;
  onRegeneratePage?: (pageId: string) => void;
}

const RESPONSE_TYPE_OPTIONS: { value: ResponseType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "upload", label: "Upload" },
  { value: "voice", label: "Voice" },
  { value: "link", label: "Link" },
  { value: "multi", label: "Multi-type" },
  { value: "decision-matrix", label: "Decision Matrix" },
  { value: "pmi", label: "PMI" },
  { value: "pairwise", label: "Pairwise" },
  { value: "trade-off-sliders", label: "Trade-off Sliders" },
];

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function PageReviewCard({ pageId, content, color, isExpanded, dispatch, onActivityDrop, onRegeneratePage }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);

  const toggleExpanded = () => {
    dispatch({ type: "TOGGLE_EXPANDED_PAGE", pageId });
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/questerra-activity")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the card (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const activityId = e.dataTransfer.getData("application/questerra-activity");
    if (activityId && onActivityDrop) {
      onActivityDrop(pageId, activityId);
    }
  };

  return (
    <div
      className={`rounded-xl border-2 transition-all duration-200 ${
        isDragOver
          ? "border-brand-purple border-dashed bg-brand-purple/5 shadow-lg scale-[1.01]"
          : isExpanded
            ? "border-brand-purple/30 shadow-md"
            : "border-border hover:border-gray-300"
      }`}
      style={{ minWidth: isExpanded ? "100%" : "220px" }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Card header */}
      <button
        onClick={toggleExpanded}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          {pageId}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">{content.title}</div>
          <div className="text-[10px] text-text-secondary mt-0.5">
            {content.sections.length} section{content.sections.length !== 1 ? "s" : ""}
          </div>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-text-secondary transition-transform duration-200 flex-shrink-0 ${
            isExpanded ? "rotate-180" : ""
          }`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border animate-fade-in">
          {/* Title edit */}
          <div className="pt-3">
            <label className="text-[10px] text-text-secondary uppercase tracking-wider">Title</label>
            <input
              type="text"
              value={content.title}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_PAGE",
                  pageId,
                  page: { ...content, title: e.target.value },
                })
              }
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
            />
          </div>

          {/* Learning goal edit */}
          <div>
            <label className="text-[10px] text-text-secondary uppercase tracking-wider">Learning Goal</label>
            <textarea
              value={content.learningGoal}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_PAGE",
                  pageId,
                  page: { ...content, learningGoal: e.target.value },
                })
              }
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none"
            />
          </div>

          {/* Sections */}
          {content.sections.map((section, si) => (
            <div key={si} className="bg-surface-alt rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] text-text-secondary uppercase tracking-wider">
                  Section {si + 1}
                </label>
                <div className="flex items-center gap-1.5">
                  {/* Word count — Lever 1 counts the composed text (slots when v2, prompt fallback) */}
                  <span className="text-[9px] text-text-secondary/50">
                    {wordCount(composedPromptText(section))} words
                  </span>

                  {/* Response type selector */}
                  <select
                    value={section.responseType}
                    onChange={(e) => {
                      const newSections = [...content.sections];
                      newSections[si] = { ...section, responseType: e.target.value as ResponseType };
                      dispatch({
                        type: "UPDATE_PAGE",
                        pageId,
                        page: { ...content, sections: newSections },
                      });
                    }}
                    className="text-[9px] text-text-secondary bg-white border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
                  >
                    {RESPONSE_TYPE_OPTIONS.map((rt) => (
                      <option key={rt.value} value={rt.value}>{rt.label}</option>
                    ))}
                  </select>

                  {/* Move up */}
                  {si > 0 && (
                    <button
                      onClick={() => dispatch({ type: "REORDER_SECTIONS", pageId, fromIndex: si, toIndex: si - 1 })}
                      className="w-5 h-5 flex items-center justify-center text-text-secondary/40 hover:text-text-secondary transition rounded"
                      title="Move up"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 15l-6-6-6 6" />
                      </svg>
                    </button>
                  )}

                  {/* Move down */}
                  {si < content.sections.length - 1 && (
                    <button
                      onClick={() => dispatch({ type: "REORDER_SECTIONS", pageId, fromIndex: si, toIndex: si + 1 })}
                      className="w-5 h-5 flex items-center justify-center text-text-secondary/40 hover:text-text-secondary transition rounded"
                      title="Move down"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  )}

                  {/* Delete section */}
                  {content.sections.length > 1 && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete section ${si + 1}?`)) {
                          dispatch({ type: "DELETE_SECTION", pageId, sectionIndex: si });
                        }
                      }}
                      className="w-5 h-5 flex items-center justify-center text-text-secondary/40 hover:text-red-500 transition rounded"
                      title="Delete section"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={section.prompt}
                onChange={(e) => {
                  const newSections = [...content.sections];
                  newSections[si] = { ...section, prompt: e.target.value };
                  dispatch({
                    type: "UPDATE_PAGE",
                    pageId,
                    page: { ...content, sections: newSections },
                  });
                }}
                rows={2}
                className="w-full px-2 py-1.5 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-purple/30 resize-none"
              />
            </div>
          ))}

          {/* Add section */}
          <button
            onClick={() => dispatch({ type: "ADD_SECTION", pageId })}
            className="w-full py-2 border border-dashed border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-gray-50 hover:border-gray-400 transition"
          >
            + Add Section
          </button>

          {/* Regenerate page */}
          {onRegeneratePage && (
            <button
              onClick={() => onRegeneratePage(pageId)}
              className="w-full py-2 border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-gray-50 hover:border-gray-400 transition flex items-center justify-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 4v6h6M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
              </svg>
              Regenerate this page
            </button>
          )}
        </div>
      )}
    </div>
  );
}
