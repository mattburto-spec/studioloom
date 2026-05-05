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
import {
  getElementsForCompetency,
  type NMUnitConfig,
  type NMElement,
} from "@/lib/nm/constants";
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
  // Lever-MM (option B): read-only NM banner in preview. Resolved from
  // class_units.nm_config (per-class) with fallback to units.nm_config
  // (template). Does NOT call /api/student/nm-checkpoint — that route
  // requires a student session and would 401 here. Direct DB read is
  // safe because the teacher is already authenticated for this unit.
  const [nmConfig, setNmConfig] = useState<NMUnitConfig | null>(null);
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
        // Template-level NM config — used as fallback if no class fork.
        const templateNm = (data as Unit & { nm_config?: NMUnitConfig | null }).nm_config;

        if (classId) {
          const { data: cu } = await supabase
            .from("class_units")
            .select("content_data, nm_config")
            .eq("class_id", classId)
            .eq("unit_id", unitId)
            .maybeSingle();
          if (cu?.content_data) setForkContent(cu.content_data as UnitContentData);
          // Class-specific NM config wins; fall back to unit template.
          const classNm = (cu as { nm_config?: NMUnitConfig | null } | null)?.nm_config;
          setNmConfig(classNm ?? templateNm ?? null);
        } else {
          // No classId — show template-level config so unit-level previews
          // (rare in practice; mostly used by the editor's "view as student"
          // link with classId set) still surface NM if it's configured.
          setNmConfig(templateNm ?? null);
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

  // Lever-MM (option B): resolve NM checkpoint elements for the current
  // page. Reads nm_config.checkpoints[pageId].elements, looks up the
  // active competency's element metadata, and returns enriched objects
  // for the read-only banner. Returns [] when NM isn't configured for
  // this page — banner won't render.
  const nmCheckpointElements = useMemo<NMElement[]>(() => {
    if (!nmConfig?.enabled) return [];
    const elementIds = nmConfig.checkpoints?.[pageId]?.elements;
    if (!elementIds || elementIds.length === 0) return [];
    const competencyId = nmConfig.competencies?.[0];
    if (!competencyId) return [];
    const allElements = getElementsForCompetency(competencyId);
    const byId = new Map(allElements.map((el) => [el.id, el] as const));
    return elementIds
      .map((id) => byId.get(id))
      .filter((el): el is NMElement => Boolean(el));
  }, [nmConfig, pageId]);

  // Allowed response types — derived from sections. MUST be called unconditionally
  // (before any early returns) to keep hook order stable across renders.
  const allowedTypes = useMemo<("text" | "upload" | "voice" | "link")[]>(() => {
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

        {/* Lever-MM (option B): read-only NM banner.
            Mirrors the editor's chip strip styling (yellow card + element
            chips with color tile accent) but without × remove buttons —
            preview is for visual verification, not configuration.
            Renders only when NM is enabled AND this page has at least
            one checkpoint element. The actual interactive component (
            CompetencyPulse) mounts on the REAL student page, not here. */}
        {nmCheckpointElements.length > 0 && (
          <div className="mt-6 px-4 py-3 rounded-xl border border-yellow-200 bg-yellow-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-yellow-700 text-[11px] font-extrabold tracking-wider uppercase">
                🎯 NM checkpoint on this lesson
              </span>
              <span className="text-[10px] text-yellow-700/70 italic ml-auto">
                Read-only preview · students see the interactive version
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {nmCheckpointElements.map((el) => (
                <span
                  key={el.id}
                  className="inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-yellow-300 text-[12px] font-medium text-yellow-900"
                  style={el.color ? { borderLeft: `3px solid ${el.color}` } : undefined}
                  title={el.studentDescription || el.definition}
                >
                  {el.name}
                </span>
              ))}
            </div>
          </div>
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

