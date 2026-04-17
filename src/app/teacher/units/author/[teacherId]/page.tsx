"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

interface RepoUnit {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  author_teacher_id: string | null;
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

export default function AuthorUnitsPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = use(params);
  const [units, setUnits] = useState<RepoUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/teacher/units?browse=true&authorTeacherId=${encodeURIComponent(teacherId)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setUnits(data.units || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [teacherId]);

  // Best-effort author metadata from the first unit (author_name + school_name)
  const author = units[0];
  const authorName = author?.author_name || "This teacher";
  const schoolName = author?.school_name || null;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      {/* Back link */}
      <Link
        href="/teacher/units"
        className="text-xs text-text-secondary hover:text-text-primary transition mb-3 flex items-center gap-1 w-fit"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Community
      </Link>

      {/* Author header */}
      <div className="mt-4 mb-6 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl font-bold text-white"
          style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
        >
          {authorName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-text-primary truncate">{authorName}</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {schoolName && <span>{schoolName} · </span>}
            {loading
              ? "Loading units…"
              : `${units.length} published unit${units.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Units grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl animate-pulse h-64 border border-gray-100" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      ) : units.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <p className="text-gray-700 text-lg font-semibold">No published units yet</p>
          <p className="text-gray-400 text-sm mt-1">
            This teacher hasn&rsquo;t published anything to the community yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((unit) => (
            <Link
              key={unit.id}
              href={`/teacher/units/${unit.id}`}
              className="bg-white rounded-2xl overflow-hidden hover:shadow-md hover:border-purple-200 transition-all flex flex-col border border-gray-100 cursor-pointer"
            >
              {/* Thumbnail */}
              <div className="w-full h-36 bg-gray-50 relative">
                {unit.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={unit.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
                {unit.fork_count > 0 && (
                  <span
                    className="absolute top-2 right-2 text-[10px] font-semibold text-white px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(37,99,235,0.85)" }}
                  >
                    {unit.fork_count} use{unit.fork_count !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="px-4 pt-3 pb-3 flex-1">
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
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "#DBEAFE", color: "#1E40AF" }}
                    >
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
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
