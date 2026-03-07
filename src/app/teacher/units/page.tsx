"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { PAGES, CRITERIA, type CriterionKey } from "@/lib/constants";
import type { Unit } from "@/types";

interface JsonPreview {
  pages: Record<string, { title?: string; sections?: unknown[] }>;
  valid: boolean;
  errors: string[];
  pageCount: number;
}

function validateJson(data: unknown): JsonPreview {
  const errors: string[] = [];
  const result: JsonPreview = {
    pages: {},
    valid: true,
    errors: [],
    pageCount: 0,
  };

  if (!data || typeof data !== "object") {
    return { ...result, valid: false, errors: ["JSON must be an object"] };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.pages || typeof obj.pages !== "object") {
    return { ...result, valid: false, errors: ["Missing 'pages' object"] };
  }

  const pages = obj.pages as Record<string, unknown>;
  const validPageIds = PAGES.map((p) => p.id);

  for (const [key, value] of Object.entries(pages)) {
    if (!validPageIds.includes(key)) {
      errors.push(`Unknown page ID: "${key}" (expected A1-A4, B1-B4, C1-C4, D1-D4)`);
      continue;
    }

    if (!value || typeof value !== "object") {
      errors.push(`Page ${key}: must be an object`);
      continue;
    }

    const page = value as Record<string, unknown>;
    result.pages[key] = {
      title: (page.title as string) || undefined,
      sections: (page.sections as unknown[]) || [],
    };
    result.pageCount++;

    // Validate key fields
    if (!page.title) errors.push(`Page ${key}: missing 'title'`);
    if (!page.learningGoal) errors.push(`Page ${key}: missing 'learningGoal'`);
    if (!Array.isArray(page.sections) || page.sections.length === 0) {
      errors.push(`Page ${key}: missing or empty 'sections' array`);
    }
  }

  result.errors = errors;
  result.valid = errors.length === 0;
  return result;
}

export default function TeacherUnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [jsonPreview, setJsonPreview] = useState<JsonPreview | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editJsonFile, setEditJsonFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<JsonPreview | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadUnits();
  }, []);

  async function loadUnits() {
    const supabase = createClient();
    const { data } = await supabase
      .from("units")
      .select("*")
      .order("created_at", { ascending: false });

    setUnits(data || []);
    setLoading(false);
  }

  async function handleJsonFile(file: File, setPreview: (p: JsonPreview | null) => void) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setPreview(validateJson(data));
    } catch {
      setPreview({
        pages: {},
        valid: false,
        errors: ["Invalid JSON syntax"],
        pageCount: 0,
      });
    }
  }

  async function createUnit() {
    if (!title.trim()) return;
    setCreating(true);
    setError("");

    let contentData = {};
    if (jsonFile) {
      try {
        const text = await jsonFile.text();
        contentData = JSON.parse(text);
      } catch {
        setError("Invalid JSON file");
        setCreating(false);
        return;
      }
    }

    const supabase = createClient();
    const { error: dbError } = await supabase.from("units").insert({
      title: title.trim(),
      description: description.trim() || null,
      content_data: contentData,
    });

    if (dbError) {
      setError(dbError.message);
    } else {
      setTitle("");
      setDescription("");
      setJsonFile(null);
      setJsonPreview(null);
      setShowCreate(false);
      loadUnits();
    }
    setCreating(false);
  }

  async function updateUnitContent() {
    if (!editingUnit || !editJsonFile) return;
    setUpdating(true);

    try {
      const text = await editJsonFile.text();
      const contentData = JSON.parse(text);

      const supabase = createClient();
      const { error: dbError } = await supabase
        .from("units")
        .update({ content_data: contentData })
        .eq("id", editingUnit.id);

      if (dbError) {
        setError(dbError.message);
      } else {
        setEditingUnit(null);
        setEditJsonFile(null);
        setEditPreview(null);
        loadUnits();
      }
    } catch {
      setError("Invalid JSON");
    }
    setUpdating(false);
  }

  async function deleteUnit(unitId: string) {
    const supabase = createClient();
    await supabase.from("units").delete().eq("id", unitId);
    setUnits((prev) => prev.filter((u) => u.id !== unitId));
  }

  function PagePreviewGrid({ preview }: { preview: JsonPreview }) {
    return (
      <div className="mt-3">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-medium ${preview.valid ? "text-accent-green" : "text-amber-500"}`}>
            {preview.pageCount}/16 pages found
            {!preview.valid && ` · ${preview.errors.length} warnings`}
          </span>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(16, 1fr)" }}>
          {PAGES.map((page) => {
            const hasContent = !!preview.pages[page.id];
            const criterion = CRITERIA[page.criterion as CriterionKey];
            return (
              <div
                key={page.id}
                className="aspect-square rounded flex items-center justify-center text-[8px] font-mono font-bold"
                style={{
                  backgroundColor: hasContent ? criterion.color : "#f1f5f9",
                  color: hasContent ? "#fff" : "#94a3b8",
                }}
                title={`${page.id}: ${page.title}${hasContent ? " ✓" : " (empty)"}`}
              >
                {page.id}
              </div>
            );
          })}
        </div>
        {preview.errors.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-amber-500 cursor-pointer">
              {preview.errors.length} validation note{preview.errors.length > 1 ? "s" : ""}
            </summary>
            <ul className="mt-1 space-y-0.5">
              {preview.errors.map((err, i) => (
                <li key={i} className="text-xs text-text-secondary">
                  • {err}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Units</h1>
          <p className="text-text-secondary mt-1">
            Create and manage design cycle units
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-dark-blue text-white rounded-lg text-sm font-medium hover:bg-dark-blue/90 transition"
        >
          + New Unit
        </button>
      </div>

      {/* Create Unit Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Create New Unit</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Interactive Arcade Machine"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this unit..."
                  rows={2}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Content JSON (optional)
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setJsonFile(file);
                    if (file) handleJsonFile(file, setJsonPreview);
                    else setJsonPreview(null);
                  }}
                  className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-surface-alt file:text-text-primary hover:file:bg-gray-200"
                />
                <p className="text-xs text-text-secondary mt-1">
                  Upload a JSON file with page content, or add content later.
                </p>
                {jsonPreview && <PagePreviewGrid preview={jsonPreview} />}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setShowCreate(false);
                  setError("");
                  setJsonPreview(null);
                }}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-alt transition"
              >
                Cancel
              </button>
              <button
                onClick={createUnit}
                disabled={!title.trim() || creating}
                className="flex-1 py-2 bg-dark-blue text-white rounded-lg text-sm font-medium hover:bg-dark-blue/90 transition disabled:opacity-40"
              >
                {creating ? "Creating..." : "Create Unit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Content Modal */}
      {editingUnit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-1">Update Content</h2>
            <p className="text-sm text-text-secondary mb-4">{editingUnit.title}</p>

            {/* Current content summary */}
            <div className="bg-surface-alt rounded-lg p-3 mb-4">
              <p className="text-xs font-medium text-text-secondary mb-2">Current content:</p>
              <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(16, 1fr)" }}>
                {PAGES.map((page) => {
                  const hasContent = !!editingUnit.content_data?.pages?.[page.id as keyof typeof editingUnit.content_data.pages];
                  const criterion = CRITERIA[page.criterion as CriterionKey];
                  return (
                    <div
                      key={page.id}
                      className="aspect-square rounded flex items-center justify-center text-[8px] font-mono font-bold"
                      style={{
                        backgroundColor: hasContent ? criterion.color : "#e2e8f0",
                        color: hasContent ? "#fff" : "#94a3b8",
                      }}
                      title={`${page.id}: ${hasContent ? "has content" : "empty"}`}
                    >
                      {page.id}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                New Content JSON
              </label>
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setEditJsonFile(file);
                  if (file) handleJsonFile(file, setEditPreview);
                  else setEditPreview(null);
                }}
                className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-surface-alt file:text-text-primary hover:file:bg-gray-200"
              />
              {editPreview && <PagePreviewGrid preview={editPreview} />}
            </div>

            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setEditingUnit(null);
                  setEditJsonFile(null);
                  setEditPreview(null);
                  setError("");
                }}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-alt transition"
              >
                Cancel
              </button>
              <button
                onClick={updateUnitContent}
                disabled={!editJsonFile || updating}
                className="flex-1 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition disabled:opacity-40"
              >
                {updating ? "Updating..." : "Update Content"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unit list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 animate-pulse h-24" />
          ))}
        </div>
      ) : units.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-text-secondary text-lg">No units yet.</p>
          <p className="text-text-secondary/70 text-sm mt-2">
            Create a unit and upload its content JSON.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {units.map((unit) => {
            const pages = unit.content_data?.pages;
            const pageCount = pages ? Object.keys(pages).length : 0;

            return (
              <div
                key={unit.id}
                className="bg-white rounded-xl px-5 py-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-primary">{unit.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {unit.description && (
                        <p className="text-sm text-text-secondary">
                          {unit.description}
                        </p>
                      )}
                      <span className="text-xs text-text-secondary bg-surface-alt px-2 py-0.5 rounded">
                        {pageCount}/16 pages
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingUnit(unit)}
                      className="px-3 py-1.5 text-xs font-medium text-accent-blue bg-accent-blue/10 rounded-lg hover:bg-accent-blue/20 transition"
                    >
                      Update Content
                    </button>
                    <button
                      onClick={() => deleteUnit(unit.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Page grid preview */}
                <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: "repeat(16, 1fr)" }}>
                  {PAGES.map((page) => {
                    const hasContent = !!pages?.[page.id as keyof typeof pages];
                    const criterion = CRITERIA[page.criterion as CriterionKey];
                    return (
                      <div
                        key={page.id}
                        className="aspect-square rounded flex items-center justify-center text-[8px] font-mono font-bold"
                        style={{
                          backgroundColor: hasContent ? criterion.color : "#f1f5f9",
                          color: hasContent ? "#fff" : "#94a3b8",
                        }}
                        title={`${page.id}: ${page.title}${hasContent ? " ✓" : " (empty)"}`}
                      >
                        {page.id}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
