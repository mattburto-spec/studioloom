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

interface ClassAssignment {
  unit_id: string;
  class_id: string;
  content_data: unknown;
  classes: { name: string } | null;
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

// Colour palette for category pills
const CATEGORY_COLORS: Record<string, { bg: string; text: string; activeBg: string }> = {
  "Electronics": { bg: "#FEF3C7", text: "#92400E", activeBg: "#F59E0B" },
  "CAD / 3D": { bg: "#DBEAFE", text: "#1E40AF", activeBg: "#3B82F6" },
  "Woodwork": { bg: "#FDE68A", text: "#78350F", activeBg: "#D97706" },
  "Textiles": { bg: "#FCE7F3", text: "#9D174D", activeBg: "#EC4899" },
  "Materials": { bg: "#E0E7FF", text: "#3730A3", activeBg: "#6366F1" },
  "Product Design": { bg: "#D1FAE5", text: "#065F46", activeBg: "#10B981" },
  "Digital": { bg: "#CFFAFE", text: "#155E75", activeBg: "#06B6D4" },
  "Sustainability": { bg: "#DCFCE7", text: "#166534", activeBg: "#22C55E" },
};

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

  // Class assignments for enrichment
  const [classMap, setClassMap] = useState<Map<string, { classId: string; name: string; isForked: boolean }[]>>(new Map());

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

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    loadUnits();
  }, []);

  async function loadUnits() {
    try {
      const supabase = createClient();
      const [{ data: unitData }, { data: classUnitData }] = await Promise.all([
        supabase.from("units").select("*").order("created_at", { ascending: false }),
        supabase.from("class_units").select("unit_id, class_id, content_data, classes(name)"),
      ]);
      setUnits(unitData || []);

      // Build class assignment map
      const map = new Map<string, { classId: string; name: string; isForked: boolean }[]>();
      if (classUnitData) {
        for (const cu of classUnitData as unknown as ClassAssignment[]) {
          const list = map.get(cu.unit_id) || [];
          list.push({
            classId: cu.class_id,
            name: (cu.classes as { name: string } | null)?.name || "Unknown",
            isForked: !!cu.content_data,
          });
          map.set(cu.unit_id, list);
        }
      }
      setClassMap(map);
    } catch (err) {
      console.error("[loadUnits] Failed:", err);
    } finally {
      setLoading(false);
    }
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
    setDeletingId(null);
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
                  {"\u2022"} {err}
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

  // Compute stats
  const totalLessons = units.reduce((sum, u) => sum + getPageList(u.content_data).length, 0);
  const publishedCount = units.filter((u) => (u as Unit & { is_published?: boolean }).is_published).length;
  const assignedCount = units.filter((u) => (classMap.get(u.id) || []).length > 0).length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Units</h1>
          <p className="text-gray-500 mt-1">
            {viewMode === "mine"
              ? "Create, manage, and assign your teaching units"
              : "Browse and fork units shared by other teachers"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/teacher/units/import"
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
            Manual
          </button>
          <Link
            href="/teacher/units/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md hover:shadow-lg hover:opacity-90 transition-all"
            style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
            Build with AI
          </Link>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          ), value: units.length, label: "Total Units", bg: "#F3E8FF", border: "#E9D5FF" },
          { icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          ), value: totalLessons, label: "Total Lessons", bg: "#DBEAFE", border: "#BFDBFE" },
          { icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          ), value: assignedCount, label: "Assigned to Classes", bg: "#D1FAE5", border: "#A7F3D0" },
          { icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ), value: publishedCount, label: "Published", bg: "#FEF3C7", border: "#FDE68A" },
        ].map((stat, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: stat.bg, border: `1px solid ${stat.border}` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "white" }}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xl font-extrabold text-gray-900">{stat.value}</p>
              <p className="text-[11px] text-gray-500 font-medium">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Search bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-5">
        <div className="flex items-center justify-between px-4 pt-3 pb-0">
          <div className="flex items-center gap-1">
            {(["mine", "community"] as ViewMode[]).map((mode) => {
              const isActive = viewMode === mode;
              const label = mode === "mine" ? "My Units" : "Community";
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition"
                  style={isActive ? {
                    background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                    color: "white",
                  } : {
                    color: "#6B7280",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            {viewMode === "community" && (
              <>
                <select
                  value={communityGrade}
                  onChange={(e) => setCommunityGrade(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="">All grades</option>
                  {MYP_GRADE_LEVELS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <select
                  value={communitySort}
                  onChange={(e) => setCommunitySort(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="newest">Newest</option>
                  <option value="most-forked">Most Forked</option>
                </select>
              </>
            )}
          </div>
        </div>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              value={viewMode === "mine" ? mySearch : communitySearch}
              onChange={(e) =>
                viewMode === "mine"
                  ? setMySearch(e.target.value)
                  : setCommunitySearch(e.target.value)
              }
              placeholder={viewMode === "mine" ? "Search your units..." : "Search community units..."}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent"
            />
          </div>
        </div>
        {/* Category filter pills */}
        <div className="px-4 pb-3 flex items-center gap-1.5 flex-wrap">
          {CATEGORY_FILTERS.map((cat) => {
            const isActive = activeFilter === cat.label;
            const count = sourceForCounts.filter((u) => unitMatchesFilter(u, cat.keywords)).length;
            if (cat.label !== "All" && count === 0) return null;
            const colorSet = CATEGORY_COLORS[cat.label];
            return (
              <button
                key={cat.label}
                onClick={() => setActiveFilter(cat.label)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
                style={isActive ? {
                  background: cat.label === "All" ? "linear-gradient(135deg, #7B2FF2, #5C16C5)" : (colorSet?.activeBg || "#7B2FF2"),
                  color: "white",
                } : {
                  background: colorSet?.bg || "#F3F4F6",
                  color: colorSet?.text || "#6B7280",
                }}
              >
                {cat.label}
                {cat.label !== "All" && (
                  <span style={{ opacity: 0.7 }} className="ml-1">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================================================================= */}
      {/* MY UNITS VIEW                                                      */}
      {/* ================================================================= */}
      {viewMode === "mine" && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl animate-pulse h-64 border border-gray-100" />
              ))}
            </div>
          ) : filteredMyUnits.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "#F3E8FF" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              </div>
              <p className="text-gray-700 text-lg font-semibold">
                {units.length === 0 ? "No units yet" : "No units match this filter"}
              </p>
              <p className="text-gray-400 text-sm mt-1 max-w-sm mx-auto">
                {units.length === 0
                  ? "Create your first unit with AI, import an existing lesson plan, or build one manually."
                  : "Try a different category or clear the search."}
              </p>
              {units.length === 0 && (
                <div className="flex items-center justify-center gap-3 mt-5">
                  <Link
                    href="/teacher/units/create"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl"
                    style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
                  >
                    Build with AI
                  </Link>
                  <Link
                    href="/teacher/units/import"
                    className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
                  >
                    Import Plan
                  </Link>
                </div>
              )}
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
                const classes = classMap.get(unit.id) || [];
                const hasForkedClasses = classes.some((c) => c.isForked);
                const isPublished = (unit as Unit & { is_published?: boolean }).is_published;

                return (
                  <div
                    key={unit.id}
                    className="bg-white rounded-2xl overflow-hidden hover:shadow-md transition-shadow flex flex-col border border-gray-100 group"
                  >
                    <Link href={`/teacher/units/${unit.id}`} className="block flex-1">
                      <div className="w-full h-40 overflow-hidden relative">
                        <UnitThumbnail
                          thumbnailUrl={unit.thumbnail_url}
                          title={unit.title}
                          className="w-full h-full object-cover"
                        />
                        {/* Overlay badges */}
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          {isJourney && (
                            <span className="text-[10px] font-semibold text-white px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.85)" }}>
                              Journey
                            </span>
                          )}
                          {isTimeline && (
                            <span className="text-[10px] font-semibold text-white px-2 py-0.5 rounded-full" style={{ background: "rgba(37,99,235,0.85)" }}>
                              Timeline
                            </span>
                          )}
                          {unit.forked_from && (
                            <span className="text-[10px] font-semibold text-white px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.7)" }}>
                              Forked
                            </span>
                          )}
                        </div>
                        {isPublished && (
                          <span className="absolute top-2 right-2 text-[10px] font-semibold text-white px-2 py-0.5 rounded-full" style={{ background: "rgba(5,150,105,0.85)" }}>
                            Published
                          </span>
                        )}
                      </div>
                      <div className="px-4 pt-3 pb-2">
                        <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">
                          {unit.title}
                        </p>
                        {unit.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                            {unit.description}
                          </p>
                        )}

                        {/* Meta row */}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 font-medium">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                            {countLabel}
                          </span>
                          {classes.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: "#059669" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                              {classes.length} class{classes.length !== 1 ? "es" : ""}
                            </span>
                          )}
                          {hasForkedClasses && (
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: "#FEF3C7", color: "#92400E" }}
                            >
                              Customized
                            </span>
                          )}
                        </div>

                        {/* Class pills */}
                        {classes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {classes.slice(0, 3).map((c, i) => (
                              <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                {c.name}
                              </span>
                            ))}
                            {classes.length > 3 && (
                              <span className="text-[10px] text-gray-400 px-1 py-0.5">
                                +{classes.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Actions */}
                    <div className="px-4 pb-3 pt-2 flex items-center gap-2 border-t border-gray-100 mt-auto">
                      <Link
                        href={`/teacher/units/${unit.id}`}
                        className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition"
                        style={{ background: "#F3E8FF", color: "#7C3AED" }}
                      >
                        View
                      </Link>
                      <Link
                        href={classes.length > 0
                          ? `/teacher/units/${unit.id}/class/${classes[0].classId}/edit`
                          : `/teacher/units/${unit.id}`
                        }
                        className="px-3 py-1.5 text-[11px] font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={(e) => { e.preventDefault(); togglePublish(unit); }}
                        disabled={publishing === unit.id}
                        className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition disabled:opacity-50"
                        style={isPublished ? {
                          background: "#D1FAE5", color: "#065F46",
                        } : {
                          background: "#F3F4F6", color: "#6B7280",
                        }}
                      >
                        {publishing === unit.id ? "..." : isPublished ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); setDeletingId(unit.id); }}
                        className="ml-auto px-2 py-1.5 text-[11px] text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
                <div key={i} className="bg-white rounded-2xl animate-pulse h-64 border border-gray-100" />
              ))}
            </div>
          ) : filteredCommunityUnits.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "#DBEAFE" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <p className="text-gray-700 text-lg font-semibold">No published units found</p>
              <p className="text-gray-400 text-sm mt-1">
                Be the first to publish a unit and share it with other teachers!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCommunityUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="bg-white rounded-2xl overflow-hidden hover:shadow-md transition-shadow flex flex-col border border-gray-100"
                >
                  {/* Thumbnail */}
                  <div className="w-full h-36 bg-gray-50 relative">
                    {unit.thumbnail_url ? (
                      <img src={unit.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      </div>
                    )}
                    {unit.fork_count > 0 && (
                      <span className="absolute top-2 right-2 text-[10px] font-semibold text-white px-2 py-0.5 rounded-full" style={{ background: "rgba(37,99,235,0.85)" }}>
                        {unit.fork_count} fork{unit.fork_count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="px-4 pt-3 pb-2 flex-1">
                    <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">
                      {unit.title}
                    </p>
                    {unit.topic && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                        {unit.topic}
                      </p>
                    )}

                    {/* Meta pills */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {unit.grade_level && (
                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {unit.grade_level}
                        </span>
                      )}
                      {unit.duration_weeks && (
                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {unit.duration_weeks}w
                        </span>
                      )}
                      {unit.key_concept && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#DBEAFE", color: "#1E40AF" }}>
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
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                            style={{ background: "#FEF3C7", color: "#92400E" }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer — author + actions */}
                  <div className="px-4 pb-3 pt-2 flex items-center justify-between border-t border-gray-100 mt-auto">
                    <div className="text-[11px] text-gray-400 truncate mr-2">
                      {unit.author_name && (
                        <span className="font-medium text-gray-500">
                          {unit.author_name}
                          {unit.school_name && ` \u00B7 ${unit.school_name}`}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setPreviewUnit(unit)}
                        className="px-3 py-1.5 text-[11px] font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => forkUnit(unit.id)}
                        disabled={forking === unit.id}
                        className="px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg transition disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
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

      {/* Delete Confirmation */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: "#FEE2E2" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center">Delete Unit?</h3>
            <p className="text-sm text-gray-500 text-center mt-1">
              This will permanently remove this unit and all its content. This action cannot be undone.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUnit(deletingId)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Unit Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create New Unit</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Interactive Arcade Machine"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this unit..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Unit Image (optional)</label>
                {imagePreview ? (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden bg-gray-50 mb-2">
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
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Content JSON (optional)</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setJsonFile(file);
                    if (file) handleJsonFile(file, setJsonPreview);
                    else setJsonPreview(null);
                  }}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Upload a JSON file with page content, or add content later.
                </p>
                {jsonPreview && <PagePreviewGrid preview={jsonPreview} />}
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowCreate(false); setError(""); setJsonPreview(null); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={createUnit}
                disabled={!title.trim() || creating}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Update Content</h2>
            <p className="text-sm text-gray-500 mb-4">{editingUnit.title}</p>
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Current content:</p>
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
                  <p className="text-xs text-gray-400">No pages yet</p>
                );
              })()}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">New Content JSON</label>
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setEditJsonFile(file);
                  if (file) handleJsonFile(file, setEditPreview);
                  else setEditPreview(null);
                }}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
              {editPreview && <PagePreviewGrid preview={editPreview} />}
            </div>
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setEditingUnit(null); setEditJsonFile(null); setEditPreview(null); setError(""); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={updateUnitContent}
                disabled={!editJsonFile || updating}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
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
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{previewUnit.title}</h2>
                {previewUnit.topic && (
                  <p className="text-sm text-gray-500">{previewUnit.topic}</p>
                )}
              </div>
              <button
                onClick={() => setPreviewUnit(null)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400"
              >
                &#x2715;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {previewUnit.grade_level && (
                  <div>
                    <span className="text-gray-500">Grade:</span>{" "}
                    <span className="font-medium text-gray-900">{previewUnit.grade_level}</span>
                  </div>
                )}
                {previewUnit.duration_weeks && (
                  <div>
                    <span className="text-gray-500">Duration:</span>{" "}
                    <span className="font-medium text-gray-900">{previewUnit.duration_weeks} weeks</span>
                  </div>
                )}
                {previewUnit.global_context && (
                  <div>
                    <span className="text-gray-500">Global Context:</span>{" "}
                    <span className="font-medium text-gray-900">{previewUnit.global_context}</span>
                  </div>
                )}
                {previewUnit.key_concept && (
                  <div>
                    <span className="text-gray-500">Key Concept:</span>{" "}
                    <span className="font-medium text-gray-900">{previewUnit.key_concept}</span>
                  </div>
                )}
              </div>
              {previewUnit.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Statement of Inquiry</p>
                  <p className="text-sm text-gray-900">{previewUnit.description}</p>
                </div>
              )}
              {previewUnit.author_name && (
                <p className="text-xs text-gray-400">
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
                className="w-full py-2.5 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
              >
                Fork to My Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tip */}
      <div className="mt-8 bg-purple-50 border border-purple-100 rounded-2xl px-5 py-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#E9D5FF" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </div>
        <p className="text-xs text-purple-700 leading-relaxed pt-1.5">
          <span className="font-semibold">Tip:</span> Build a unit with AI to generate a complete lesson sequence with scaffolding, timing, and extensions. You can then assign it to multiple classes and customize content per class.
        </p>
      </div>
    </main>
  );
}
