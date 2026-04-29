"use client";

/**
 * Teacher Preview — read-only student lesson view.
 *
 * Mounts the SAME components the live student lesson page uses
 * (LessonHeader + LessonIntro from lesson-bold, ActivityCard from
 * student/) — so what teachers see here is exactly what students see,
 * not a separate render.
 *
 * Read-only: no save/progress, no integrity monitoring, response inputs
 * are inert (onChange is a no-op).
 *
 * Accepts ?classId= to render the class fork content, matching the
 * student API's resolution. Without classId, falls back to master.
 *
 * Route: /teacher/units/[unitId]/preview/[pageId]?classId=...
 */

import { useState, useEffect, useMemo, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getPageList, normalizeContentData } from "@/lib/unit-adapter";
import { getPageColor } from "@/lib/constants";
import { collectCriterionChips } from "@/lib/frameworks/render-helpers";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import { LessonHeader, LessonIntro } from "@/components/student/lesson-bold";
import { ActivityCard } from "@/components/student/ActivityCard";
import { SectionDivider } from "@/components/student/SectionDivider";
import type { Unit, UnitPage, PageContent, UnitContentData } from "@/types";

export default function TeacherPreviewPage({
  params,
}: {
  params: Promise<{ unitId: string; pageId: string }>;
}) {
  const { unitId, pageId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = searchParams.get("classId");

  const [unit, setUnit] = useState<Unit | null>(null);
  const [forkContent, setForkContent] = useState<UnitContentData | null>(null);
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

        if (classId) {
          const { data: cu } = await supabase
            .from("class_units")
            .select("content_data")
            .eq("class_id", classId)
            .eq("unit_id", unitId)
            .maybeSingle();
          if (cu?.content_data) setForkContent(cu.content_data as UnitContentData);
        }
      } catch {
        setError("Failed to load unit");
      } finally {
        setLoading(false);
      }
    }
    loadUnit();
  }, [unitId, classId]);

  const { allPages, currentPage, currentIndex, pageContent, pageColor } = useMemo(() => {
    if (!unit) {
      return {
        allPages: [] as UnitPage[],
        currentPage: undefined as UnitPage | undefined,
        currentIndex: -1,
        pageContent: undefined as PageContent | undefined,
        pageColor: "#7C3AED",
      };
    }
    const resolved = classId
      ? resolveClassUnitContent(unit.content_data as UnitContentData, forkContent)
      : (unit.content_data as UnitContentData);
    const pages = getPageList(normalizeContentData(resolved));
    const page = pages.find((p) => p.id === pageId);
    const idx = pages.findIndex((p) => p.id === pageId);
    return {
      allPages: pages,
      currentPage: page,
      currentIndex: idx,
      pageContent: page?.content,
      pageColor: page ? getPageColor(page) : "#7C3AED",
    };
  }, [unit, forkContent, classId, pageId]);

  // Redirect to first page if pageId not found
  useEffect(() => {
    if (!loading && allPages.length > 0 && !currentPage) {
      const qs = classId ? `?classId=${classId}` : "";
      router.replace(`/teacher/units/${unitId}/preview/${allPages[0].id}${qs}`);
    }
  }, [loading, allPages, currentPage, router, unitId, classId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--sl-bg, #F5F1EA)" }}>
        <div className="animate-pulse text-gray-400">Loading preview...</div>
      </div>
    );
  }

  if (error || !unit) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--sl-bg, #F5F1EA)" }}>
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

  const lessonCriterionChips =
    pageContent?.sections && currentPage
      ? collectCriterionChips(pageContent.sections, "IB_MYP")
      : undefined;

  // Allowed response types — derived from sections, fed into ResponseInput
  const allowedTypes = useMemoAllowed(pageContent);

  return (
    <div className="lesson-bold min-h-screen" style={{ background: "var(--sl-bg, #F5F1EA)" }}>
      {/* Preview banner */}
      <div className="bg-violet-600 text-white text-[12px] font-semibold text-center py-1.5 sticky top-0 z-30">
        👁 Teacher Preview · this is exactly what students see
        {classId && <span className="opacity-70"> · class fork</span>}
      </div>

      {/* Lesson header (warm-paper Bold) */}
      {currentPage ? (
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <LessonHeader
            phaseName={currentPage.phaseLabel}
            phaseColor={pageColor}
            lessonIndex={currentIndex + 1}
            lessonTotal={allPages.length}
            title={pageContent?.title || currentPage.title || "Lesson"}
            whyItMatters={pageContent?.learningGoal}
            learningObjectives={pageContent?.success_criteria}
            criterionChips={lessonCriterionChips}
          />
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <div className="card-lb p-8">
            <h1 className="display-lg" style={{ fontSize: "clamp(32px, 4.5vw, 44px)", lineHeight: 1, color: "var(--sl-ink, #0F0E0C)" }}>
              {unit.title}
            </h1>
            <p className="mt-3" style={{ fontSize: 15, color: "var(--sl-ink-2, #413D36)" }}>
              No lesson content for this page.
            </p>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-10 pb-28">
        {/* Context block — vocab + intro + media + links */}
        {(pageContent?.vocabWarmup || pageContent?.introduction) && (
          <LessonIntro
            vocabWarmup={pageContent?.vocabWarmup}
            introduction={pageContent?.introduction}
            ellLevel={0}
            pageColor={pageColor}
          />
        )}

        {/* Activities */}
        {pageContent?.sections && pageContent.sections.length > 0 ? (
          <div className="space-y-6 mt-6">
            {pageContent.sections.map((section, i) => (
              <div key={section.activityId || i}>
                <SectionDivider number={i + 1} color={pageColor} />
                <ActivityCard
                  section={section}
                  index={i}
                  ellLevel={0}
                  responseValue=""
                  onResponseChange={() => {
                    /* no-op in preview */
                  }}
                  isLast={i === pageContent.sections.length - 1}
                  arrowOffset={0}
                  allowedTypes={allowedTypes}
                  unitId={unitId}
                  pageId={pageId}
                  pageColor={pageColor}
                  enableIntegrityMonitoring={false}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No activity sections on this page.</p>
          </div>
        )}

        {/* Prev / next nav */}
        <div className="flex items-center justify-between mt-12 pt-6 border-t border-[var(--le-hair,#E5DFD2)]">
          {currentIndex > 0 ? (
            <Link
              href={`/teacher/units/${unitId}/preview/${allPages[currentIndex - 1].id}${classId ? `?classId=${classId}` : ""}`}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white/70 rounded-lg hover:bg-white transition border border-[var(--le-hair,#E5DFD2)]"
            >
              ← Previous Lesson
            </Link>
          ) : (
            <div />
          )}
          {currentIndex < allPages.length - 1 ? (
            <Link
              href={`/teacher/units/${unitId}/preview/${allPages[currentIndex + 1].id}${classId ? `?classId=${classId}` : ""}`}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition"
              style={{ backgroundColor: pageColor }}
            >
              Next Lesson →
            </Link>
          ) : (
            <div />
          )}
        </div>
      </main>
    </div>
  );
}

// Hook helper kept inline — derives ResponseInput's allowed-types prop
// from whatever response types appear in this lesson's activities.
function useMemoAllowed(pageContent: PageContent | undefined): ("text" | "upload" | "voice" | "link")[] {
  return useMemo(() => {
    if (!pageContent?.sections) return ["text", "upload", "voice", "link"];
    const present = new Set<string>();
    pageContent.sections.forEach((s) => {
      if (s.responseType) present.add(s.responseType);
    });
    const allowed: ("text" | "upload" | "voice" | "link")[] = [];
    if (present.has("text")) allowed.push("text");
    if (present.has("upload")) allowed.push("upload");
    if (present.has("voice")) allowed.push("voice");
    if (present.has("link")) allowed.push("link");
    return allowed.length > 0 ? allowed : ["text", "upload", "voice", "link"];
  }, [pageContent]);
}
