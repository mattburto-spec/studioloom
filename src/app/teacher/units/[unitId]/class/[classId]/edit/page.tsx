"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getPageList, newPageId } from "@/lib/unit-adapter";
import { CRITERIA, type CriterionKey, getPageColor } from "@/lib/constants";
import type { UnitPage, UnitContentData } from "@/types";

// ---------------------------------------------------------------------------
// Class-Local Unit Editor
// ---------------------------------------------------------------------------
// Edits the forked content for a specific class.
// On first edit, automatically forks from master via the API.
// URL: /teacher/units/[unitId]/class/[classId]/edit
// ---------------------------------------------------------------------------

export default function ClassUnitEditPage({
  params,
}: {
  params: Promise<{ unitId: string; classId: string }>;
}) {
  const { unitId, classId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [unitTitle, setUnitTitle] = useState("");
  const [className, setClassName] = useState("");
  const [pages, setPages] = useState<UnitPage[]>([]);
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const [isForked, setIsForked] = useState(false);
  const [forkedAt, setForkedAt] = useState<string | null>(null);
  const [masterVersion, setMasterVersion] = useState(1);

  // P1: version save + reset state
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [savingVersion, setSavingVersion] = useState(false);
  const [versionSaved, setVersionSaved] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Fetch resolved content from API
        const [contentRes, classRes] = await Promise.all([
          fetch(`/api/teacher/class-units/content?unitId=${unitId}&classId=${classId}`),
          fetch(`/api/teacher/dashboard`), // We'll get class name from here
        ]);

        if (!contentRes.ok) {
          setError("Failed to load content");
          setLoading(false);
          return;
        }

        const contentData = await contentRes.json();
        setPages(getPageList(contentData.content));
        setIsForked(contentData.isForked);
        setForkedAt(contentData.forkedAt);
        setMasterVersion(contentData.masterVersion ?? 1);

        // Get unit title + class name from Supabase directly
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();

        const [unitRes, clsRes] = await Promise.all([
          supabase.from("units").select("title").eq("id", unitId).single(),
          supabase.from("classes").select("name").eq("id", classId).single(),
        ]);

        setUnitTitle(unitRes.data?.title || "Unit");
        setClassName(clsRes.data?.name || "Class");
      } catch {
        setError("Failed to load editor");
      }
      setLoading(false);
    }
    load();
  }, [unitId, classId]);

  function updatePage(pageId: string, updater: (page: UnitPage) => UnitPage) {
    setPages((prev) => prev.map((p) => (p.id === pageId ? updater(p) : p)));
  }

  async function saveContent() {
    setSaving(true);
    setError("");

    try {
      const contentData: UnitContentData = { version: 2, pages } as UnitContentData;

      const res = await fetch("/api/teacher/class-units/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, unitId, content_data: contentData }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
      } else {
        setIsForked(true);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("Failed to save content");
    }
    setSaving(false);
  }

  function addPage() {
    const id = newPageId();
    const newPage: UnitPage = {
      id,
      type: "custom",
      title: `New Page ${pages.length + 1}`,
      content: { title: `New Page ${pages.length + 1}`, sections: [] },
    };
    setPages((prev) => [...prev, newPage]);
    setEditingPage(id);
  }

  function removePage(pageId: string) {
    setPages((prev) => prev.filter((p) => p.id !== pageId));
    if (editingPage === pageId) setEditingPage(null);
  }

  function movePage(pageId: string, direction: "up" | "down") {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === pageId);
      if (idx < 0) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  }

  async function saveAsVersion() {
    if (!versionLabel.trim()) return;
    setSavingVersion(true);
    try {
      const res = await fetch("/api/teacher/units/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, classId, label: versionLabel.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setVersionSaved(data.versionNumber);
        setShowVersionModal(false);
        setVersionLabel("");
        setTimeout(() => setVersionSaved(null), 4000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save version");
      }
    } catch {
      setError("Failed to save version");
    }
    setSavingVersion(false);
  }

  async function resetToMaster() {
    setResetting(true);
    try {
      const res = await fetch("/api/teacher/class-units/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, unitId }),
      });
      if (res.ok) {
        // Reload the page to fetch master content
        setShowResetConfirm(false);
        setIsForked(false);
        setForkedAt(null);
        // Re-fetch content from API
        const contentRes = await fetch(`/api/teacher/class-units/content?unitId=${unitId}&classId=${classId}`);
        if (contentRes.ok) {
          const contentData = await contentRes.json();
          setPages(getPageList(contentData.content));
          setIsForked(contentData.isForked);
          setForkedAt(contentData.forkedAt);
          setMasterVersion(contentData.masterVersion ?? 1);
        }
      } else {
        const data = await res.json();
        setError(data.error || "Failed to reset");
      }
    } catch {
      setError("Failed to reset to master");
    }
    setResetting(false);
  }

  // ─── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (error && !pages.length) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Link
            href={`/teacher/units/${unitId}/class/${classId}`}
            className="text-purple-600 hover:underline"
          >
            Back to Class Settings
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/teacher/units/${unitId}/class/${classId}`}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{unitTitle}</h1>
          <p className="text-sm text-gray-500">
            Editing for <span className="font-semibold">{className}</span>
          </p>
        </div>

        {/* Fork indicator */}
        {isForked && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" />
              <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" /><path d="M12 12v3" />
            </svg>
            <span className="text-xs font-medium text-amber-700">
              Class fork{forkedAt ? ` (${new Date(forkedAt).toLocaleDateString()})` : ""}
            </span>
          </div>
        )}

        {!isForked && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span className="text-xs font-medium text-blue-700">
              Using master template (v{masterVersion})
            </span>
          </div>
        )}

        {/* Version saved toast */}
        {versionSaved && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            <span className="text-xs font-medium text-green-700">Saved as v{versionSaved}</span>
          </div>
        )}

        {/* P1 action buttons */}
        <div className="flex items-center gap-1.5">
          {isForked && (
            <button
              onClick={() => setShowVersionModal(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition"
              title="Save this version to the master unit template"
            >
              Save as Version
            </button>
          )}
          {isForked && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
              title="Discard class changes and revert to master template"
            >
              Reset to Master
            </button>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={saveContent}
          disabled={saving}
          className="px-5 py-2 rounded-xl text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }}
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Page list */}
      <div className="space-y-3">
        {pages.map((page, idx) => {
          const color = getPageColor(page);
          const isEditing = editingPage === page.id;

          return (
            <div
              key={page.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Page header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setEditingPage(isEditing ? null : page.id)}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: color }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate text-sm">
                    {page.title || page.content?.title || `Page ${idx + 1}`}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {page.type} &middot; {page.content?.sections?.length || 0} sections
                  </p>
                </div>

                {/* Move/delete controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); movePage(page.id, "up"); }}
                    disabled={idx === 0}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6" /></svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); movePage(page.id, "down"); }}
                    disabled={idx === pages.length - 1}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removePage(page.id); }}
                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>

                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`text-gray-400 transition-transform ${isEditing ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>

              {/* Expanded editor */}
              {isEditing && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Page Title</label>
                    <input
                      type="text"
                      value={page.title || page.content?.title || ""}
                      onChange={(e) =>
                        updatePage(page.id, (p) => ({
                          ...p,
                          title: e.target.value,
                          content: p.content ? { ...p.content, title: e.target.value } : { title: e.target.value, sections: [] },
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                  </div>

                  {/* Page type */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Page Type</label>
                    <select
                      value={page.type || "custom"}
                      onChange={(e) => updatePage(page.id, (p) => ({ ...p, type: e.target.value }))}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    >
                      <option value="strand">Strand (Criterion-linked)</option>
                      <option value="context">Context / Introduction</option>
                      <option value="skill">Skill Building</option>
                      <option value="reflection">Reflection</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  {/* Criterion */}
                  {page.type === "strand" && (
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Criterion</label>
                      <div className="flex gap-2">
                        {(Object.keys(CRITERIA) as CriterionKey[]).map((key) => (
                          <button
                            key={key}
                            onClick={() => updatePage(page.id, (p) => ({ ...p, criterion: key }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition ${
                              page.criterion === key
                                ? "text-white border-transparent"
                                : "text-gray-500 border-gray-200 hover:border-gray-300"
                            }`}
                            style={page.criterion === key ? { background: CRITERIA[key].color } : {}}
                          >
                            {CRITERIA[key].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sections preview */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">
                      Sections ({page.content?.sections?.length || 0})
                    </label>
                    {page.content?.sections && page.content.sections.length > 0 ? (
                      <div className="space-y-2">
                        {page.content.sections.map((s: Record<string, unknown>, i: number) => (
                          <div key={i} className="p-2 rounded-lg bg-gray-50 text-xs text-gray-600">
                            <span className="font-semibold">{(s.title as string) || `Section ${i + 1}`}</span>
                            {s.type && <span className="ml-2 text-gray-400">({s.type as string})</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No sections yet. Content will be generated or added.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add page button */}
      <button
        onClick={addPage}
        className="mt-4 w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm font-semibold text-gray-400 hover:text-purple-500 hover:border-purple-300 transition"
      >
        + Add Page
      </button>

      {/* ─── Save as Version Modal ─── */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Save as Version</h3>
            <p className="text-sm text-gray-500 mb-4">
              This saves your class changes as a new version on the master unit. Other classes can then use this version. Your class keeps its current content.
            </p>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Version Label</label>
            <input
              type="text"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder={`e.g. "Refined for ${className} 2026"`}
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 mb-4"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") saveAsVersion(); }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowVersionModal(false); setVersionLabel(""); }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={saveAsVersion}
                disabled={savingVersion || !versionLabel.trim()}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }}
              >
                {savingVersion ? "Saving..." : "Save Version"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reset to Master Confirmation ─── */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reset to Master?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will discard all class-specific changes and revert to the master template. Student progress is preserved, but any custom pages or edits will be lost.
            </p>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 mb-4">
              <strong>Tip:</strong> Save your changes as a version first if you might want them later.
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={resetToMaster}
                disabled={resetting}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 shadow-sm transition disabled:opacity-50"
              >
                {resetting ? "Resetting..." : "Reset to Master"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
