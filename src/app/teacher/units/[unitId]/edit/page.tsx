"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CRITERIA, type CriterionKey, getPageColor } from "@/lib/constants";
import { getPageList, newPageId } from "@/lib/unit-adapter";
import type { UnitPage } from "@/types";
import { ActivityBrowser } from "@/components/teacher/ActivityBrowser";
import type { ActivityTemplate } from "@/lib/activity-library";

export default function EditUnitPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [unitTitle, setUnitTitle] = useState("");
  const [pages, setPages] = useState<UnitPage[]>([]);
  const [editingPage, setEditingPage] = useState<string | null>(null);

  // Modify (regenerate) state
  const [modifyingPage, setModifyingPage] = useState<string | null>(null);
  const [modifyInstruction, setModifyInstruction] = useState("");
  const [modifyError, setModifyError] = useState("");

  // Activity browser state
  const [activityBrowserOpen, setActivityBrowserOpen] = useState(false);
  const [activityBrowserPage, setActivityBrowserPage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Check if this unit has assigned classes — if exactly 1, redirect to Phase 0.5 editor
      const { data: classUnits } = await supabase
        .from("class_units")
        .select("class_id")
        .eq("unit_id", unitId);
      if (classUnits && classUnits.length === 1) {
        router.replace(`/teacher/units/${unitId}/class/${classUnits[0].class_id}/edit`);
        return;
      }

      const { data: unit } = await supabase
        .from("units")
        .select("title, content_data")
        .eq("id", unitId)
        .single();

      if (!unit) {
        router.push("/teacher/units");
        return;
      }

      setUnitTitle(unit.title);
      setPages(getPageList(unit.content_data));
      setLoading(false);
    }
    load();
  }, [unitId, router]);

  // Helper to update a page in the array
  function updatePage(pageId: string, updater: (page: UnitPage) => UnitPage) {
    setPages((prev) => prev.map((p) => (p.id === pageId ? updater(p) : p)));
  }

  function addPage(afterIndex: number, criterion?: CriterionKey) {
    const id = newPageId();
    const newPage: UnitPage = {
      id,
      type: "strand",
      criterion,
      title: criterion ? `${CRITERIA[criterion].name} - New Page` : "New Page",
      content: { title: "", learningGoal: "", sections: [{ prompt: "", responseType: "text" }] },
    };
    setPages((prev) => {
      const next = [...prev];
      next.splice(afterIndex + 1, 0, newPage);
      return next;
    });
    setEditingPage(id);
  }

  function removePage(pageId: string) {
    if (pages.length <= 1) return;
    if (!window.confirm("Remove this page? This cannot be undone.")) return;
    setPages((prev) => prev.filter((p) => p.id !== pageId));
    if (editingPage === pageId) setEditingPage(null);
  }

  function movePage(pageId: string, direction: "up" | "down") {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === pageId);
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  async function regeneratePage(pageId: string, instruction?: string) {
    setModifyingPage(pageId);
    setModifyError("");

    try {
      const res = await fetch("/api/teacher/regenerate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, pageId, instruction }),
      });

      const data = await res.json();
      if (!res.ok) {
        setModifyError(data.error || "Failed to regenerate");
        return;
      }

      updatePage(pageId, (p) => ({
        ...p,
        content: data.page,
        title: data.page.title || p.title,
      }));
      setModifyInstruction("");
    } catch {
      setModifyError("Network error — please try again");
    } finally {
      setModifyingPage(null);
    }
  }

  async function saveUnit() {
    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("units")
      .update({ content_data: { version: 2, pages } })
      .eq("id", unitId);

    if (error) {
      setModifyError(error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Auto-ingest updated content into knowledge base (fire-and-forget)
      fetch("/api/teacher/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId }),
      }).catch(() => {});
    }
    setSaving(false);
  }

  const QUICK_PRESETS = [
    { label: "Make easier", instruction: "Simplify the language and reduce complexity. Use shorter sentences and more scaffolding." },
    { label: "Make harder", instruction: "Add depth and complexity. Include extension tasks and higher-order thinking questions." },
    { label: "Add hands-on activity", instruction: "Add a practical, hands-on making or building activity with clear steps." },
    { label: "Add reflection", instruction: "Add a reflection section that prompts metacognitive thinking about the learning process." },
    { label: "Shorten", instruction: "Reduce to 2 focused sections. Keep it concise and efficient." },
    { label: "Add SCAMPER", instruction: "Incorporate a SCAMPER brainstorming activity adapted to the topic." },
  ];

  // Group pages by criterion for display
  const criterionGroups: { key: CriterionKey; pages: UnitPage[] }[] = [];
  const otherPages: UnitPage[] = [];
  const seenCriteria = new Set<CriterionKey>();

  for (const page of pages) {
    if (page.type === "strand" && page.criterion && page.criterion in CRITERIA) {
      const key = page.criterion as CriterionKey;
      if (!seenCriteria.has(key)) {
        seenCriteria.add(key);
        criterionGroups.push({ key, pages: [] });
      }
      criterionGroups.find((g) => g.key === key)!.pages.push(page);
    } else {
      otherPages.push(page);
    }
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-2">
        <Link
          href="/teacher/units"
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          &larr; Back to Units
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Edit Unit</h1>
          <p className="text-text-secondary">{unitTitle}</p>
        </div>
      </div>

      {/* Page grid overview */}
      <div
        className="grid gap-1 mb-6"
        style={{ gridTemplateColumns: `repeat(${Math.min(pages.length, 16)}, 1fr)` }}
      >
        {pages.map((page) => {
          const color = getPageColor(page);
          return (
            <div
              key={page.id}
              className="aspect-square rounded flex items-center justify-center text-[8px] font-mono font-bold cursor-pointer hover:opacity-80 transition"
              style={{
                backgroundColor: page.content ? color : "#f1f5f9",
                color: page.content ? "#fff" : "#94a3b8",
              }}
              title={`${page.id}: ${page.title}`}
              onClick={() =>
                setEditingPage(editingPage === page.id ? null : page.id)
              }
            >
              {page.id}
            </div>
          );
        })}
      </div>

      {/* Criterion sections */}
      <div className="space-y-5">
        {criterionGroups.map(({ key, pages: groupPages }) => {
          const c = CRITERIA[key];

          return (
            <div
              key={key}
              className="border border-border rounded-lg overflow-hidden"
            >
              <div
                className="px-4 py-2 flex items-center gap-2"
                style={{ backgroundColor: `${c.color}10` }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: c.color }}
                >
                  {key}
                </div>
                <span className="text-sm font-semibold text-text-primary">
                  {c.name}
                </span>
              </div>

              <div className="divide-y divide-border">
                {groupPages.map((page) => renderPageRow(page))}
              </div>

              {/* Add page button */}
              <button
                onClick={() => {
                  const lastPage = groupPages[groupPages.length - 1];
                  const lastIdx = pages.findIndex((p) => p.id === lastPage.id);
                  addPage(lastIdx, key);
                }}
                className="w-full py-2 text-xs text-text-secondary hover:text-brand-purple hover:bg-brand-purple/5 transition flex items-center justify-center gap-1.5 border-t border-border"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add page to Criterion {key}
              </button>
            </div>
          );
        })}

        {/* Non-criterion pages */}
        {otherPages.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 flex items-center gap-2 bg-gray-50">
              <span className="text-sm font-semibold text-text-primary">
                Other Pages
              </span>
            </div>
            <div className="divide-y divide-border">
              {otherPages.map((page) => renderPageRow(page))}
            </div>
          </div>
        )}

        {/* Add page button (no criterion) */}
        <button
          onClick={() => addPage(pages.length - 1)}
          className="w-full py-3 border-2 border-dashed border-border rounded-lg text-xs text-text-secondary hover:text-brand-purple hover:border-brand-purple/30 transition flex items-center justify-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Page
        </button>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 bg-white border-t border-border py-4 px-6 -mx-4 mt-6 flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm text-accent-green font-medium">
            Saved!
          </span>
        )}
        <button
          onClick={saveUnit}
          disabled={saving}
          className="px-6 py-2.5 bg-dark-blue text-white rounded-lg text-sm font-medium hover:bg-dark-blue/90 transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Activity Browser panel */}
      <ActivityBrowser
        isOpen={activityBrowserOpen}
        onClose={() => {
          setActivityBrowserOpen(false);
          setActivityBrowserPage(null);
        }}
        filterCriterion={
          activityBrowserPage
            ? pages.find((p) => p.id === activityBrowserPage)?.criterion as CriterionKey | undefined
            : undefined
        }
        onInsert={(activity: ActivityTemplate) => {
          if (!activityBrowserPage) return;
          updatePage(activityBrowserPage, (p) => ({
            ...p,
            content: {
              ...p.content,
              sections: [
                ...p.content.sections,
                ...activity.template.sections,
              ],
            },
          }));
          setActivityBrowserOpen(false);
          setActivityBrowserPage(null);
        }}
      />
    </main>
  );

  function renderPageRow(page: UnitPage) {
    const content = page.content;
    const isEditing = editingPage === page.id;
    const isModifying = modifyingPage === page.id;
    const pageColor = getPageColor(page);

    if (!content || !content.sections) {
      return (
        <div
          key={page.id}
          className="px-4 py-3 flex items-center justify-between"
        >
          <span className="text-sm text-text-secondary/50">
            {page.id}: No content
          </span>
          <button
            onClick={() => regeneratePage(page.id)}
            disabled={!!modifyingPage}
            className="text-xs text-brand-purple hover:text-brand-purple/80 transition disabled:opacity-40"
          >
            Generate
          </button>
        </div>
      );
    }

    const pageIndex = pages.findIndex((p) => p.id === page.id);

    return (
      <div key={page.id} className="px-4 py-3">
        <div className="flex items-center gap-1">
          {/* Reorder buttons */}
          <div className="flex flex-col gap-0.5 mr-1">
            <button
              onClick={() => movePage(page.id, "up")}
              disabled={pageIndex === 0}
              className="w-5 h-4 flex items-center justify-center text-text-secondary/40 hover:text-text-primary disabled:opacity-20 transition"
              title="Move up"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 15l-6-6-6 6"/></svg>
            </button>
            <button
              onClick={() => movePage(page.id, "down")}
              disabled={pageIndex === pages.length - 1}
              className="w-5 h-4 flex items-center justify-center text-text-secondary/40 hover:text-text-primary disabled:opacity-20 transition"
              title="Move down"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          </div>

          <button
            onClick={() =>
              setEditingPage(isEditing ? null : page.id)
            }
            className="flex-1 text-left flex items-center justify-between min-w-0"
          >
            <div className="min-w-0">
              <span
                className="text-xs font-mono mr-2 px-1 py-0.5 rounded"
                style={{ color: pageColor, backgroundColor: pageColor + "15" }}
              >
                {page.id}
              </span>
              <span className="text-sm font-medium text-text-primary">
                {content.title}
              </span>
            </div>
            <span className="text-xs text-text-secondary flex-shrink-0 ml-2">
              {content.sections.length} sections
              {isEditing ? " ▲" : " ▼"}
            </span>
          </button>

          {/* Delete button */}
          <button
            onClick={() => removePage(page.id)}
            disabled={pages.length <= 1}
            className="w-6 h-6 flex items-center justify-center text-text-secondary/30 hover:text-red-500 disabled:opacity-20 transition flex-shrink-0 ml-1"
            title="Remove page"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </div>

        {isEditing && (
          <div className="mt-3 space-y-3 pl-6 border-l-2 border-gray-100">
            {/* Title edit */}
            <div>
              <label className="text-xs text-text-secondary">
                Title
              </label>
              <input
                type="text"
                value={content.title}
                onChange={(e) =>
                  updatePage(page.id, (p) => ({
                    ...p,
                    content: { ...p.content, title: e.target.value },
                  }))
                }
                className="w-full px-3 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue"
              />
            </div>

            {/* Learning goal edit */}
            <div>
              <label className="text-xs text-text-secondary">
                Learning Goal
              </label>
              <textarea
                value={content.learningGoal}
                onChange={(e) =>
                  updatePage(page.id, (p) => ({
                    ...p,
                    content: { ...p.content, learningGoal: e.target.value },
                  }))
                }
                rows={2}
                className="w-full px-3 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue resize-none"
              />
            </div>

            {/* Sections */}
            {content.sections.map((section, si) => (
              <div
                key={si}
                className="bg-surface-alt rounded p-2.5"
              >
                <label className="text-xs text-text-secondary">
                  Section {si + 1} Prompt
                </label>
                <textarea
                  value={section.prompt}
                  onChange={(e) => {
                    const newSections = [...content.sections];
                    newSections[si] = {
                      ...section,
                      prompt: e.target.value,
                    };
                    updatePage(page.id, (p) => ({
                      ...p,
                      content: { ...p.content, sections: newSections },
                    }));
                  }}
                  rows={2}
                  className="w-full px-3 py-1.5 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-accent-blue resize-none mt-1"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-text-secondary/60">
                    Response: {section.responseType}
                    {section.scaffolding?.ell1 && " · ELL ✓"}
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={section.portfolioCapture || false}
                      onChange={(e) => {
                        const newSections = [...content.sections];
                        newSections[si] = {
                          ...section,
                          portfolioCapture: e.target.checked,
                        };
                        updatePage(page.id, (p) => ({
                          ...p,
                          content: { ...p.content, sections: newSections },
                        }));
                      }}
                      className="accent-brand-pink w-3.5 h-3.5"
                    />
                    <span className="text-[11px] text-text-secondary group-hover:text-brand-pink transition">
                      Portfolio
                    </span>
                  </label>
                </div>
              </div>
            ))}

            {/* Insert activity button */}
            <button
              onClick={() => {
                setActivityBrowserPage(page.id);
                setActivityBrowserOpen(true);
              }}
              className="w-full py-2 border-2 border-dashed border-brand-purple/30 rounded-lg text-xs font-medium text-brand-purple hover:bg-brand-purple/5 transition flex items-center justify-center gap-1.5"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Insert Activity from Library
            </button>

            {/* AI Modify section */}
            <div className="bg-brand-purple/5 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-brand-purple flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3v3m6.36.64l-2.12 2.12M21 12h-3m-.64 6.36l-2.12-2.12M12 21v-3m-6.36-.64l2.12-2.12M3 12h3m.64-6.36l2.12 2.12" />
                </svg>
                AI Modify
              </div>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() =>
                      regeneratePage(page.id, preset.instruction)
                    }
                    disabled={!!modifyingPage}
                    className="px-2.5 py-1 text-[11px] rounded-full bg-white border border-border text-text-secondary hover:border-brand-purple hover:text-brand-purple transition disabled:opacity-40"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom instruction */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Custom instruction, e.g. 'Add a sustainability focus'"
                  value={modifyInstruction}
                  onChange={(e) =>
                    setModifyInstruction(e.target.value)
                  }
                  className="flex-1 px-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-purple"
                />
                <button
                  onClick={() =>
                    regeneratePage(page.id, modifyInstruction)
                  }
                  disabled={
                    !!modifyingPage || !modifyInstruction.trim()
                  }
                  className="px-3 py-1.5 text-xs bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition disabled:opacity-40"
                >
                  Regenerate
                </button>
              </div>

              {isModifying && (
                <div className="text-xs text-brand-purple animate-pulse">
                  Regenerating page...
                </div>
              )}
              {modifyError && modifyingPage === null && (
                <div className="text-xs text-red-500">
                  {modifyError}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
}
