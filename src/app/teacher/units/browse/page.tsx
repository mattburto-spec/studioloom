"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MYP_GRADE_LEVELS, PAGES, CRITERIA, type CriterionKey } from "@/lib/constants";
import { UnitThumbnail } from "@/components/shared/UnitThumbnail";

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

export default function BrowseUnitsPage() {
  const router = useRouter();
  const [units, setUnits] = useState<RepoUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [forking, setForking] = useState<string | null>(null);
  const [previewUnit, setPreviewUnit] = useState<RepoUnit | null>(null);

  const loadUnits = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ browse: "true" });
    if (search) params.set("search", search);
    if (gradeFilter) params.set("grade", gradeFilter);
    if (sort) params.set("sort", sort);

    try {
      const res = await fetch(`/api/teacher/units?${params}`);
      const data = await res.json();
      setUnits(data.units || []);
    } catch {
      // silent
    }
    setLoading(false);
  }, [search, gradeFilter, sort]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  async function forkUnit(unitId: string) {
    setForking(unitId);
    try {
      const res = await fetch("/api/teacher/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fork", unitId }),
      });
      if (res.ok) {
        router.push("/teacher/units");
      }
    } catch {
      // silent
    }
    setForking(null);
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-2">
        <Link
          href="/teacher/units"
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          &larr; Back to My Units
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Unit Repository
          </h1>
          <p className="text-text-secondary mt-1">
            Browse and fork units shared by other teachers.
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search units..."
          className="flex-1 min-w-[200px] px-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
        />
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
        >
          <option value="">All grades</option>
          {MYP_GRADE_LEVELS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
        >
          <option value="newest">Newest</option>
          <option value="most-forked">Most Forked</option>
        </select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 animate-pulse h-28" />
          ))}
        </div>
      ) : units.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-text-secondary text-lg">No published units found.</p>
          <p className="text-text-secondary/70 text-sm mt-2">
            Be the first to publish a unit and share it with other teachers!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((unit) => (
            <div
              key={unit.id}
              className="bg-white rounded-xl border border-border overflow-hidden hover:shadow-md transition"
            >
              {/* Thumbnail */}
              <UnitThumbnail
                thumbnailUrl={unit.thumbnail_url}
                title={unit.title}
                className="h-32"
              />

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-text-primary text-sm line-clamp-1">
                  {unit.title}
                </h3>
                {unit.topic && (
                  <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                    {unit.topic}
                  </p>
                )}

                {/* Meta */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {unit.grade_level && (
                    <span className="px-2 py-0.5 bg-surface-alt rounded text-xs text-text-secondary">
                      {unit.grade_level}
                    </span>
                  )}
                  {unit.duration_weeks && (
                    <span className="px-2 py-0.5 bg-surface-alt rounded text-xs text-text-secondary">
                      {unit.duration_weeks}w
                    </span>
                  )}
                  {unit.key_concept && (
                    <span className="px-2 py-0.5 bg-accent-blue/10 rounded text-xs text-accent-blue">
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
                        className="px-2 py-0.5 bg-accent-orange/10 rounded text-xs text-accent-orange"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Author + Fork */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="text-xs text-text-secondary">
                    {unit.author_name && (
                      <span>
                        by {unit.author_name}
                        {unit.school_name && ` · ${unit.school_name}`}
                      </span>
                    )}
                    {unit.fork_count > 0 && (
                      <span className="ml-2">
                        {unit.fork_count} fork{unit.fork_count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreviewUnit(unit)}
                      className="px-3 py-1 text-xs text-text-secondary border border-border rounded hover:bg-surface-alt transition"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => forkUnit(unit.id)}
                      disabled={forking === unit.id}
                      className="px-3 py-1 text-xs font-medium text-white bg-accent-blue rounded hover:bg-accent-blue/90 transition disabled:opacity-50"
                    >
                      {forking === unit.id ? "..." : "Fork"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewUnit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-text-primary">
                  {previewUnit.title}
                </h2>
                {previewUnit.topic && (
                  <p className="text-sm text-text-secondary">
                    {previewUnit.topic}
                  </p>
                )}
              </div>
              <button
                onClick={() => setPreviewUnit(null)}
                className="w-8 h-8 rounded-full hover:bg-surface-alt flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Details */}
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
                    <span className="font-medium">
                      {previewUnit.duration_weeks} weeks
                    </span>
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
                  <p className="text-xs font-medium text-text-secondary mb-1">
                    Statement of Inquiry
                  </p>
                  <p className="text-sm text-text-primary">
                    {previewUnit.description}
                  </p>
                </div>
              )}

              {/* Author */}
              {previewUnit.author_name && (
                <p className="text-xs text-text-secondary">
                  Created by {previewUnit.author_name}
                  {previewUnit.school_name && ` at ${previewUnit.school_name}`}
                </p>
              )}

              {/* Fork button */}
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
