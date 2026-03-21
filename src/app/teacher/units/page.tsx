"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getPageList, isV3, isV4, normalizeContentData } from "@/lib/unit-adapter";
import type { Unit } from "@/types";
import { CRITERIA, type CriterionKey, getPageColor, MYP_GRADE_LEVELS } from "@/lib/constants";
import { UnitThumbnail } from "@/components/shared/UnitThumbnail";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JsonPreview {
  pages: Record<string, { title?: string; sections?: unknown[] }>;
  valid: boolean;
  errors: string[];
  pageCount: number;
}

interface RepoUnit {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  author_name: string | null;
  school_name: string | null;
  tags: string[];
  grade_level: string | null;
  duration_weeks: number | null;
  topic: string | null;
  global_context: string | null;
  key_concept: string | null;
  fork_count: number;
  created_at: string;
}

type ViewMode = "mine" | "community";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

  for (const [key, value] of Object.entries(pages)) {
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

// Design category filters — match against tags, topic, title, description
const CATEGORY_FILTERS = [
  { label: "All", keywords: [] },
  { label: "Electronics", keywords: ["electronics", "circuit", "arduino", "makey", "led", "sensor", "microcontroller", "soldering"] },
  { label: "CAD / 3D", keywords: ["cad", "3d print", "laser", "cnc", "fusion", "tinkercad", "onshape", "3d model"] },
  { label: "Woodwork", keywords: ["wood", "timber", "carpentry", "joint", "lathe"] },
  { label: "Textiles", keywords: ["textile", "fabric", "sewing", "fashion", "wearable"] },
  { label: "Materials", keywords: ["material", "plastic", "metal", "polymer", "composite", "acrylic"] },
  { label: "Product Design", keywords: ["product", "packaging", "ergonomic", "user", "prototype", "industrial"] },
  { label: "Digital", keywords: ["digital", "app", "web", "game", "animation", "coding", "programming"] },
  { label: "Sustainability", keywords: ["sustain", "recycle", "eco", "environment", "green", "waste", "circular"] },
];

function unitMatchesFilter(unit: { title?: string | null; description?: string | null; topic?: string | null; tags?: string[] | null }, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const haystack = [
    unit.title,
    unit.description,
    unit.topic,
    ...(unit.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return keywords.some((kw) => haystack.includes(kw));
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function TeacherUnitsPage() {
  // View toggle
  const [viewMode, setViewMode] = useState<ViewMode>("mine");

  // My units state
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [mySearch, setMySearch] = useState("");
  const [publishing, setPublishing] = useState<string | null>(null);

  // Community state
  const [communityUnits, setCommunityUnits] = useState<RepoUnit[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityLoaded, setCommunityLoaded] = useState(false);
  const [communitySearch, setCommunitySearch] = useState("");
  const [communityGrade, setCommunityGrade] = useState("");
  const [communitySort, setCommunitySort] = useState("newest");
  const [forking, setForking] = useState<string | null>(null);
  const [previewUnit, setPreviewUnit] = useState<RepoUnit | null>(null);

  // Modals
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

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

  const loadCommunityUnits = useCallback(async () => {
    setCommunityLoading(true);
    const params = new URLSearchParams({ browse: "true" });
    if (communitySearch) params.set("search", communitySearch);
    if (communityGrade) params.set("grade", communityGrade);
    if (communitySort) params.set("sort", communitySort);

    try {
      const res = await fetch(`/api/teacher/units?${params}`);
      const data = await res.json();
      setCommunityUnits(data.units || []);
    } catch {
      // silent
    }
    setCommunityLoading(false);
    setCommunityLoaded(true);
  }, [communitySearch, communityGrade, communitySort]);

  // Load community units when switching to community tab or when filters change
  useEffect(() => {
    if (viewMode === "community") {
      loadCommunityUnits();
    }
  }, [viewMode, loadCommunityUnits]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

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
    const { data: unitData, error: dbError } = await supabase
      .from("units")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        content_data: contentData,
      })
      .select("id")
      .single();

    if (dbError) {
      setError(dbError.message);
    } else {
      if (imageFile && unitData) {
        await uploadUnitImage(unitData.id, imageFile);
      }
      setTitle("");
      setDescription("");
      setJsonFile(null);
      setJsonPreview(null);
      setImageFile(null);
      setImagePreview(null);
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

  async function uploadUnitImage(unitId: string, file: File) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("unitId", unitId);
      const res = await fetch("/api/teacher/upload-unit-image", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        loadUnits();
      } else {
        const data = await res.json();
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Failed to upload image");
    }
  }

  async function deleteUnit(unitId: string) {
    const supabase = createClient();
    await supabase.from("units").delete().eq("id", unitId);
    setUnits((prev) => prev.filter((u) => u.id !== unitId));
  }

  async function togglePublish(unit: Unit) {
    setPublishing(unit.id);
    try {
      const res = await fetch("/api/teacher/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: unit.is_published ? "unpublish" : "publish",
          unitId: unit.id,
          authorName: "Teacher",
        }),
      });
      if (res.ok) {
        loadUnits();
      }
    } catch {
      // silent
    }
    setPublishing(null);
  }

  async function forkUnit(unitId: string) {
    setForking(unitId);
    try {
      const res = await fetch("/api/teacher/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fork", unitId }),
      });
      if (res.ok) {
        // Switch to "My Units" and reload
        setViewMode("mine");
        loadUnits();
      }
    } catch {
      // silent
    }
    setForking(null);
  }

  // ---------------------------------------------------------------------------
  // Sub-components
  // ---------------------------------------------------------------------------

  function PagePreviewGrid({ preview }: { preview: JsonPreview }) {
    const pageIds = Object.keys(preview.pages);
    return (
      <div className="mt-3">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-medium ${preview.valid ? "text-accent-green" : "text-amber-500"}`}>
            {preview.pageCount} pages found
            {!preview.valid && ` \u00B7 ${preview.errors.length} warnings`}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {pageIds.map((pageId) => {
            const criterion = pageId.charAt(0) as CriterionKey;
            const color = criterion in CRITERIA ? CRITERIA[criterion].color : "#6B7280";
            return (
              <div
                key={pageId}
                className="w-8 h-8 rounded flex items-center justify-center text-[8px] font-mono font-bold"
                style={{ backgroundColor: color, color: "#fff" }}
                title={`${pageId}: ${preview.pages[pageId]?.title || "untitled"}`}
              >
                {pageId}
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
                  \u2022 {err}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Filtered lists
  // ---------------------------------------------------------------------------

  const catKeywords = CATEGORY_FILTERS.find((c) => c.label === activeFilter)?.keywords || [];

  const filteredMyUnits = units.filter((u) => {
    if (!unitMatchesFilter(u, catKeywords)) return false;
    if (mySearch.trim()) {
      const q = mySearch.trim().toLowerCase();
      const haystack = [u.title, u.description, u.topic, ...(u.tags || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  const filteredCommunityUnits = communityUnits.filter((u) => unitMatchesFilter(u, catKeywords));

  // For category filter counts, use the appropriate source list
  const sourceForCounts = viewMode === "mine" ? units : communityUnits;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Units</h1>
          <p className="text-text-secondary mt-1">
            {viewMode === "mine"
              ? "Your units — created, uploaded, or forked"
              : "Browse and fork units shared by other teachers"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/teacher/units/import"
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition shadow-sm"
          >
            ↑ Import Plan
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 border border-border text-text-secondary rounded-lg text-sm font-medium hover:bg-surface-alt transition"
          >
            + Manual
          </button>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 mb-5 p-1 bg-surface-alt rounded-lg w-fit">
        <button
          onClick={() => setViewMode("mine")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
            viewMode === "mine"
              ? "bg-white text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          My Units
        </button>
        <button
          onClick={() => setViewMode("community")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
            viewMode === "community"
              ? "bg-white text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Community
        </button>
      </div>

      {/* Search bar — always visible, plus extra filters for community */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          value={viewMode === "mine" ? mySearch : communitySearch}
          onChange={(e) =>
            viewMode === "mine"
              ? setMySearch(e.target.value)
              : setCommunitySearch(e.target.value)
          }
          placeholder={viewMode === "mine" ? "Search your units..." : "Search community units..."}
          className="flex-1 min-w-[200px] px-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
        />
        {viewMode === "community" && (
          <>
            <select
              value={communityGrade}
              onChange={(e) => setCommunityGrade(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
            >
              <option value="">All grades</option>
              {MYP_GRADE_LEVELS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select
              value={communitySort}
              onChange={(e) => setCommunitySort(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
            >
              <option value="newest">Newest</option>
              <option value="most-forked">Most Forked</option>
            </select>
          </>
        )}
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        {CATEGORY_FILTERS.map((cat) => {
          const isActive = activeFilter === cat.label;
          const count = sourceForCounts.filter((u) => unitMatchesFilter(u, cat.keywords)).length;
          if (cat.label !== "All" && count === 0) return null;
          return (
            <button
              key={cat.label}
              onClick={() => setActiveFilter(cat.label)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                isActive
                  ? "bg-dark-blue text-white"
                  : "bg-surface-alt text-text-secondary hover:bg-gray-200"
              }`}
            >
              {cat.label}
              {cat.label !== "All" && (
                <span className={`ml-1 ${isActive ? "text-white/70" : "text-text-secondary/50"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================================================================= */}
      {/* MY UNITS VIEW                                                      */}
      {/* ================================================================= */}
      {viewMode === "mine" && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl animate-pulse h-56" />
              ))}
            </div>
          ) : filteredMyUnits.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <p className="text-text-secondary text-lg">
                {units.length === 0 ? "No units yet." : "No units match this filter."}
              </p>
              <p className="text-text-secondary/70 text-sm mt-2">
                {units.length === 0
                  ? "Create a unit with AI or upload one manually."
                  : "Try a different category or clear the filter."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMyUnits.map((unit) => {
                const unitPages = getPageList(unit.content_data);
                const normalized = normalizeContentData(unit.content_data);
                const isTimeline = isV4(normalized);
                const isJourney = isV3(normalized);
                const countLabel = isTimeline || isJourney
                  ? `${unitPages.length} lesson${unitPages.length !== 1 ? "s" : ""}`
                  : `${unitPages.length} page${unitPages.length !== 1 ? "s" : ""}`;

                return (
                  <div
                    key={unit.id}
                    className="bg-white rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                  >
                    <Link href={`/teacher/units/${unit.id}`} className="block flex-1">
                      <div className="w-full h-40 overflow-hidden">
                        <UnitThumbnail
                          thumbnailUrl={unit.thumbnail_url}
                          title={unit.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="px-4 pt-3 pb-3">
                        <p className="font-semibold text-text-primary text-sm leading-snug line-clamp-2 mb-1">
                          {unit.title}
                        </p>
                        {unit.description && (
                          <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-relaxed">
                            {unit.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                          <span className="text-[10px] text-text-secondary bg-surface-alt px-2 py-0.5 rounded">
                            {countLabel}
                          </span>
                          {isTimeline && (
                            <span className="text-[10px] text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded">
                              Timeline
                            </span>
                          )}
                          {isJourney && (
                            <span className="text-[10px] text-accent-purple bg-accent-purple/10 px-2 py-0.5 rounded">
                              Journey
                            </span>
                          )}
                          {unit.forked_from && (
                            <span className="text-[10px] text-accent-purple bg-accent-purple/10 px-2 py-0.5 rounded">
                              Forked
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                    <div className="px-4 pb-3 pt-2 flex items-center gap-2 border-t border-border-default mt-auto">
                      <Link
                        href={`/teacher/units/${unit.id}/edit`}
                        className="px-2.5 py-1 text-[10px] font-medium text-brand-purple bg-brand-purple/10 rounded-lg hover:bg-brand-purple/20 transition"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => deleteUnit(unit.id)}
                        className="ml-auto text-[10px] text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* COMMUNITY VIEW                                                     */}
      {/* ================================================================= */}
      {viewMode === "community" && (
        <>
          {communityLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl animate-pulse h-56" />
              ))}
            </div>
          ) : filteredCommunityUnits.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <p className="text-text-secondary text-lg">No published units found.</p>
              <p className="text-text-secondary/70 text-sm mt-2">
                Be the first to publish a unit and share it with other teachers!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCommunityUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="bg-white rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Thumbnail */}
                  <div className="w-full h-36 bg-surface-alt">
                    {unit.thumbnail_url ? (
                      <img src={unit.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl text-text-secondary/30">
                        &#x1F5BC;
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="px-4 pt-3 pb-2 flex-1">
                    <p className="font-medium text-text-primary text-sm leading-snug line-clamp-2">
                      {unit.title}
                    </p>
                    {unit.topic && (
                      <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                        {unit.topic}
                      </p>
                    )}

                    {/* Meta pills */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {unit.grade_level && (
                        <span className="text-[10px] text-text-secondary bg-surface-alt px-2 py-0.5 rounded">
                          {unit.grade_level}
                        </span>
                      )}
                      {unit.duration_weeks && (
                        <span className="text-[10px] text-text-secondary bg-surface-alt px-2 py-0.5 rounded">
                          {unit.duration_weeks}w
                        </span>
                      )}
                      {unit.key_concept && (
                        <span className="text-[10px] text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded">
                          {unit.key_concept}
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {unit.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {unit.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] text-accent-orange bg-accent-orange/10 px-2 py-0.5 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer — author + actions */}
                  <div className="px-4 pb-3 pt-1 flex items-center justify-between border-t border-border-default mt-auto">
                    <div className="text-[10px] text-text-tertiary truncate mr-2">
                      {unit.author_name && (
                        <span>
                          {unit.author_name}
                          {unit.school_name && ` \u00B7 ${unit.school_name}`}
                        </span>
                      )}
                      {unit.fork_count > 0 && (
                        <span className="ml-1.5">
                          {unit.fork_count} fork{unit.fork_count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setPreviewUnit(unit)}
                        className="px-2.5 py-1 text-[10px] text-text-secondary border border-border rounded-lg hover:bg-surface-alt transition"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => forkUnit(unit.id)}
                        disabled={forking === unit.id}
                        className="px-2.5 py-1 text-[10px] font-medium text-white bg-accent-blue rounded-lg hover:bg-accent-blue/90 transition disabled:opacity-50"
                      >
                        {forking === unit.id ? "..." : "Fork"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* MODALS                                                             */}
      {/* ================================================================= */}

      {/* Create Unit Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Create New Unit</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Title</label>
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
                <label className="block text-sm font-medium text-text-secondary mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this unit..."
                  rows={2}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Unit Image (optional)</label>
                {imagePreview ? (
                  <div className="relative w-full h-32 rounded-lg overflow-hidden bg-surface-alt mb-2">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); }}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full text-white text-xs flex items-center justify-center hover:bg-black/70"
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setImageFile(f);
                      if (f) setImagePreview(URL.createObjectURL(f));
                    }}
                    className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-surface-alt file:text-text-primary hover:file:bg-gray-200"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Content JSON (optional)</label>
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
                onClick={() => { setShowCreate(false); setError(""); setJsonPreview(null); }}
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
            <div className="bg-surface-alt rounded-lg p-3 mb-4">
              <p className="text-xs font-medium text-text-secondary mb-2">Current content:</p>
              {(() => {
                const editPages = getPageList(editingUnit.content_data);
                return editPages.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {editPages.map((page) => {
                      const color = getPageColor(page);
                      return (
                        <div
                          key={page.id}
                          className="w-8 h-8 rounded flex items-center justify-center text-[8px] font-mono font-bold"
                          style={{ backgroundColor: color, color: "#fff" }}
                          title={`${page.id}: ${page.title}`}
                        >
                          {page.id}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary/50">No pages yet</p>
                );
              })()}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">New Content JSON</label>
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
                onClick={() => { setEditingUnit(null); setEditJsonFile(null); setEditPreview(null); setError(""); }}
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

      {/* Community Preview Modal */}
      {previewUnit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-text-primary">{previewUnit.title}</h2>
                {previewUnit.topic && (
                  <p className="text-sm text-text-secondary">{previewUnit.topic}</p>
                )}
              </div>
              <button
                onClick={() => setPreviewUnit(null)}
                className="w-8 h-8 rounded-full hover:bg-surface-alt flex items-center justify-center"
              >
                &#x2715;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {previewUnit.grade_level && (
                  <div>
                    <span className="text-text-secondary">Grade:</span>{" "}
                    <span className="font-medium">{previewUnit.grade_level}</span>
                  </div>
                )}
                {previewUnit.duration_weeks && (
                  <div>
                    <span className="text-text-secondary">Duration:</span>{" "}
                    <span className="font-medium">{previewUnit.duration_weeks} weeks</span>
                  </div>
                )}
                {previewUnit.global_context && (
                  <div>
                    <span className="text-text-secondary">Global Context:</span>{" "}
                    <span className="font-medium">{previewUnit.global_context}</span>
                  </div>
                )}
                {previewUnit.key_concept && (
                  <div>
                    <span className="text-text-secondary">Key Concept:</span>{" "}
                    <span className="font-medium">{previewUnit.key_concept}</span>
                  </div>
                )}
              </div>
              {previewUnit.description && (
                <div>
                  <p className="text-xs font-medium text-text-secondary mb-1">Statement of Inquiry</p>
                  <p className="text-sm text-text-primary">{previewUnit.description}</p>
                </div>
              )}
              {previewUnit.author_name && (
                <p className="text-xs text-text-secondary">
                  Created by {previewUnit.author_name}
                  {previewUnit.school_name && ` at ${previewUnit.school_name}`}
                </p>
              )}
              <button
                onClick={() => {
                  setPreviewUnit(null);
                  forkUnit(previewUnit.id);
                }}
                disabled={forking === previewUnit.id}
                className="w-full py-2.5 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition disabled:opacity-50"
              >
                Fork to My Library
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
