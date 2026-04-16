"use client";

/**
 * Teacher Preview — read-only student lesson view.
 *
 * Renders the lesson content exactly as a student would see it, but under
 * teacher auth (no student session required). Read-only — no response inputs,
 * no save/progress, no student dashboard nav.
 *
 * Route: /teacher/units/[unitId]/preview/[pageId]
 */

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getPageList, normalizeContentData } from "@/lib/unit-adapter";
import { getPageColor, CRITERIA, type CriterionKey } from "@/lib/constants";
import { collectCriterionChips } from "@/lib/frameworks/render-helpers";
import { MarkdownPrompt } from "@/components/student/MarkdownPrompt";
import { toEmbedUrl } from "@/lib/video-embed";
import type { Unit, UnitPage, PageContent, ActivitySection } from "@/types";

// ---------------------------------------------------------------------------
// Read-only activity card — shows prompt, media, metadata but no inputs
// ---------------------------------------------------------------------------

function PreviewActivityCard({
  section,
  index,
  pageColor,
}: {
  section: ActivitySection;
  index: number;
  pageColor: string;
}) {
  const hasMedia = section.media?.type && section.media?.url;
  const embedUrl = section.media?.type === "video" ? toEmbedUrl(section.media.url) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      {/* Activity header */}
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-start gap-3">
          <span
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: pageColor }}
          >
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            {section.prompt && (
              <div className="text-gray-800 text-base leading-relaxed">
                <MarkdownPrompt text={section.prompt} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content style block (info/warning/tip) — uses prompt as the text */}
      {section.contentStyle && !section.responseType && (
        <div className="px-6 pb-3">
          <div
            className={`rounded-xl p-4 ${
              section.contentStyle === "info"
                ? "bg-blue-50 border-l-4 border-blue-400"
                : section.contentStyle === "warning"
                  ? "bg-amber-50 border-l-4 border-amber-400"
                  : section.contentStyle === "tip"
                    ? "bg-green-50 border-l-4 border-green-400"
                    : "bg-gray-50 border-l-4 border-gray-300"
            }`}
          >
            <p className="text-sm text-gray-700">{section.prompt}</p>
          </div>
        </div>
      )}

      {/* Media */}
      {hasMedia && (
        <div className="px-6 pb-3">
          {section.media?.type === "image" && (
            <div className="rounded-xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={section.media.url} alt="" className="w-full" />
            </div>
          )}
          {embedUrl && (
            <div className="rounded-xl overflow-hidden bg-black aspect-video">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
      )}

      {/* Response placeholder (read-only indicator) */}
      <div className="px-6 pb-5">
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-center">
          <p className="text-sm text-gray-400 italic">
            {section.responseType === "upload"
              ? "Student uploads their work here"
              : section.responseType === "voice"
                ? "Student records a voice response here"
                : "Student types their response here"}
          </p>
        </div>
      </div>

      {/* Metadata pills */}
      {(section.durationMinutes || section.bloom_level || section.grouping) && (
        <div className="px-6 pb-4 flex flex-wrap gap-1.5">
          {section.durationMinutes && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {section.durationMinutes} min
            </span>
          )}
          {section.bloom_level && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
              {section.bloom_level}
            </span>
          )}
          {section.grouping && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
              {section.grouping}
            </span>
          )}
          {section.timeWeight && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
              {section.timeWeight}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main preview page
// ---------------------------------------------------------------------------

export default function TeacherPreviewPage({
  params,
}: {
  params: Promise<{ unitId: string; pageId: string }>;
}) {
  const { unitId, pageId } = use(params);
  const router = useRouter();

  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUnit() {
      try {
        const supabase = createClient();
        const { data, error: dbErr } = await supabase
          .from("units")
          .select("*")
          .eq("id", unitId)
          .single();

        if (dbErr || !data) {
          setError("Unit not found");
          return;
        }
        setUnit(data as Unit);
      } catch {
        setError("Failed to load unit");
      } finally {
        setLoading(false);
      }
    }
    loadUnit();
  }, [unitId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading preview...</div>
      </div>
    );
  }

  if (error || !unit) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">{error || "Unit not found"}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Normalize content and get page list
  const contentData = normalizeContentData(unit.content_data);
  const allPages: UnitPage[] = getPageList(contentData);
  const currentPage = allPages.find((p) => p.id === pageId);
  const currentIndex = allPages.findIndex((p) => p.id === pageId);
  const pageContent: PageContent | undefined = currentPage?.content;
  const pageColor = currentPage ? getPageColor(currentPage) : "#7C3AED";

  // If pageId not found, redirect to first page
  if (!currentPage && allPages.length > 0) {
    router.replace(`/teacher/units/${unitId}/preview/${allPages[0].id}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Preview banner ── */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-sm font-semibold text-amber-800">Student Preview</span>
            <span className="text-xs text-amber-600">Read-only view of how students see this lesson</span>
          </div>
          <Link
            href={`/teacher/units/${unitId}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Exit Preview
          </Link>
        </div>
      </div>

      {/* ── Lesson nav bar ── */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 font-medium">
              {currentIndex + 1}/{allPages.length}
            </span>
            {/* Page nav pills */}
            <div className="hidden sm:flex items-center gap-1">
              {allPages.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/teacher/units/${unitId}/preview/${p.id}`}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition ${
                    p.id === pageId
                      ? "text-white shadow-sm"
                      : "text-gray-400 bg-gray-100 hover:bg-gray-200"
                  }`}
                  style={p.id === pageId ? { backgroundColor: pageColor } : undefined}
                  title={p.content?.title || p.title || `Page ${i + 1}`}
                >
                  {i + 1}
                </Link>
              ))}
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-700 truncate max-w-[40%]">
            {pageContent?.title || currentPage?.title || unit.title}
          </span>
          <Link
            href={`/teacher/units/${unitId}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Unit
          </Link>
        </div>
      </div>

      {/* ── Hero header ── */}
      {currentPage ? (
        <div className="w-full" style={{ background: `linear-gradient(135deg, #1A1A2E 0%, ${pageColor} 100%)` }}>
          <div className="max-w-5xl mx-auto px-6 pt-6 pb-10">
            <p className="text-sm text-white/70 font-medium mb-3 uppercase tracking-wider">
              Lesson {currentIndex + 1} of {allPages.length}
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
              {pageContent?.title || currentPage.title || "Lesson"}
            </h1>

            {/* Criterion badges */}
            {pageContent?.sections && (
              <div className="flex items-center gap-2 mt-5 flex-wrap">
                {collectCriterionChips(pageContent.sections, "IB_MYP").map((chip) => (
                  <span
                    key={chip.key}
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 text-white"
                  >
                    <span className="w-2 h-2 rounded-full bg-white/60" />
                    {chip.kind === "label" || chip.kind === "implicit"
                      ? `${chip.short}: ${chip.name}`
                      : chip.kind === "unknown"
                        ? chip.tag
                        : "Not assessed"}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full" style={{ background: "linear-gradient(135deg, #1A1A2E 0%, #6B7280 100%)" }}>
          <div className="max-w-5xl mx-auto px-6 pt-6 pb-10">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              {unit.title}
            </h1>
            <p className="text-white/70 mt-3">No lesson content for this page.</p>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="max-w-5xl mx-auto px-6 py-10 pb-28">
        {/* Learning Goal */}
        {pageContent?.learningGoal && (
          <div
            className="rounded-2xl py-8 px-6 mb-8"
            style={{ background: `linear-gradient(135deg, #1A1A2E 0%, ${pageColor} 100%)` }}
          >
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/70 mb-3">
              Learning Objectives
            </h2>
            <p className="text-xl md:text-2xl font-medium text-white leading-relaxed">
              {pageContent.learningGoal}
            </p>
          </div>
        )}

        {/* Introduction */}
        {pageContent?.introduction && (
          <div className="mb-8">
            <p className="text-lg text-gray-700 leading-relaxed">
              {pageContent.introduction.text}
            </p>
            {pageContent.introduction.media?.type === "image" && (
              <div className="mt-6 rounded-2xl overflow-hidden shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pageContent.introduction.media.url} alt="" className="w-full" />
              </div>
            )}
            {pageContent.introduction.media?.type === "video" && (() => {
              const embedUrl = toEmbedUrl(pageContent.introduction.media!.url);
              return embedUrl ? (
                <div className="mt-6 rounded-2xl overflow-hidden bg-black aspect-video shadow-sm">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : null;
            })()}
            {pageContent.introduction.links && pageContent.introduction.links.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {pageContent.introduction.links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ backgroundColor: pageColor + "15", color: pageColor }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Activity sections */}
        {pageContent?.sections && pageContent.sections.length > 0 ? (
          <div className="space-y-6">
            {pageContent.sections.map((section, i) => (
              <PreviewActivityCard
                key={section.activityId || i}
                section={section}
                index={i}
                pageColor={pageColor}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No activity sections on this page.</p>
          </div>
        )}

        {/* Next/prev nav */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t border-gray-100">
          {currentIndex > 0 ? (
            <Link
              href={`/teacher/units/${unitId}/preview/${allPages[currentIndex - 1].id}`}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Previous Lesson
            </Link>
          ) : (
            <div />
          )}
          {currentIndex < allPages.length - 1 ? (
            <Link
              href={`/teacher/units/${unitId}/preview/${allPages[currentIndex + 1].id}`}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition"
              style={{ backgroundColor: pageColor }}
            >
              Next Lesson
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ) : (
            <div />
          )}
        </div>
      </main>
    </div>
  );
}
