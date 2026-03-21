"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TimelineSkeleton, TimelineLessonSkeleton } from "@/types";

/* ─── Types ─── */

interface FrameworkDetection {
  framework: string;
  frameworkName: string;
  confidence: "high" | "medium" | "low";
  signals: string[];
  curriculumCodes: string[];
  assessmentModel?: string;
}

interface ExtractedResource {
  url: string;
  title: string;
  lessonNumber: number;
  type: "video" | "worksheet" | "website" | "image" | "reference" | "other";
}

interface ExtractedRubric {
  criterionName: string;
  levels: Array<{ label: string; description: string }>;
}

interface DocumentLayout {
  type: string;
  columns: string[];
  weekCount: number;
  lessonsPerWeek: number;
  mergedWeeks: string[];
  totalLessons: number;
  lessonDurationMinutes: number | null;
  hasDifferentiationColumn: boolean;
}

interface ExtractionResult {
  skeleton: TimelineSkeleton;
  extraction: {
    unitTopic: string;
    gradeLevel: string;
    subjectArea: string;
    totalLessons: number;
    lessons: Array<{
      title: string;
      activities: Array<{ description: string; type: string; estimatedMinutes: number }>;
      learningObjective: string;
      criterionTags: string[];
      materials: string[];
      resources?: ExtractedResource[];
      weekNumbers?: number[];
      isDoublePeriod?: boolean;
      differentiation?: string;
    }>;
    framework?: FrameworkDetection;
    rubrics?: ExtractedRubric[];
  };
  rawText: string;
  classification: {
    detectedType: string;
    confidence: number;
    signals: string[];
  };
  framework?: FrameworkDetection;
  layout?: DocumentLayout;
  resources?: ExtractedResource[];
  rubrics?: ExtractedRubric[];
  lessonDurationMinutes?: number;
  totalDuration?: string;
  mode: string;
  targetUnitId: string | null;
  filename: string;
}

type Screen = "upload" | "review" | "generating" | "complete";

/* ─── Criterion colors ─── */
const CRITERION_COLORS: Record<string, string> = {
  A: "bg-indigo-100 text-indigo-700",
  B: "bg-emerald-100 text-emerald-700",
  C: "bg-amber-100 text-amber-700",
  D: "bg-violet-100 text-violet-700",
  AO1: "bg-blue-100 text-blue-700",
  AO2: "bg-green-100 text-green-700",
  AO3: "bg-orange-100 text-orange-700",
  AO4: "bg-purple-100 text-purple-700",
  AO5: "bg-pink-100 text-pink-700",
  KU: "bg-sky-100 text-sky-700",
  "P&P": "bg-teal-100 text-teal-700",
};

const RESOURCE_ICONS: Record<string, string> = {
  video: "🎬",
  worksheet: "📄",
  website: "🌐",
  image: "🖼",
  reference: "📚",
  other: "🔗",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-700 border-green-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-gray-100 text-gray-500 border-gray-200",
};

/* ─── Component ─── */

export default function LessonPlanConverter() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Screen state
  const [screen, setScreen] = useState<Screen>("upload");

  // Upload state
  const [mode, setMode] = useState<"full_unit" | "single_lesson">("full_unit");
  const [targetUnitId, setTargetUnitId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extraction result
  const [result, setResult] = useState<ExtractionResult | null>(null);

  // Editable skeleton
  const [editedSkeleton, setEditedSkeleton] = useState<TimelineSkeleton | null>(null);

  // Generation state
  const [generationProgress, setGenerationProgress] = useState("");
  const [generatedUnit, setGeneratedUnit] = useState<{ unitId?: string } | null>(null);

  // Units for "add to existing" picker
  const [existingUnits, setExistingUnits] = useState<Array<{ id: string; title: string }>>([]);
  const [unitsLoaded, setUnitsLoaded] = useState(false);

  // Collapsible panels
  const [showResources, setShowResources] = useState(false);
  const [showRubrics, setShowRubrics] = useState(false);

  /* ─── Load existing units for single lesson mode ─── */
  const loadExistingUnits = useCallback(async () => {
    if (unitsLoaded) return;
    try {
      const res = await fetch("/api/teacher/units");
      if (res.ok) {
        const data = await res.json();
        setExistingUnits(data.units || []);
      }
    } catch {
      // Silent fail
    }
    setUnitsLoaded(true);
  }, [unitsLoaded]);

  /* ─── File upload handler ─── */
  const handleUpload = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    setUploadProgress("Uploading file...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      if (targetUnitId) formData.append("targetUnitId", targetUnitId);

      setUploadProgress("Extracting text from document...");

      // Simulate progress updates
      const progressTimer = setTimeout(() => setUploadProgress("Detecting curriculum framework..."), 3000);
      const progressTimer2 = setTimeout(() => setUploadProgress("Analysing document layout..."), 6000);
      const progressTimer3 = setTimeout(() => setUploadProgress("Extracting lesson structure..."), 9000);

      const res = await fetch("/api/teacher/convert-lesson", {
        method: "POST",
        body: formData,
      });

      clearTimeout(progressTimer);
      clearTimeout(progressTimer2);
      clearTimeout(progressTimer3);

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "not_lesson_plan") {
          setError(data.message);
        } else {
          setError(data.error || "Upload failed");
        }
        setUploading(false);
        return;
      }

      setResult(data);
      setEditedSkeleton(data.skeleton);
      setScreen("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  }, [mode, targetUnitId]);

  /* ─── Drag & Drop ─── */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  /* ─── Skeleton editing ─── */
  const updateLessonTitle = (index: number, title: string) => {
    if (!editedSkeleton) return;
    const lessons = [...editedSkeleton.lessons];
    lessons[index] = { ...lessons[index], title };
    setEditedSkeleton({ ...editedSkeleton, lessons });
  };

  const updateLessonMinutes = (index: number, minutes: number) => {
    if (!editedSkeleton) return;
    const lessons = [...editedSkeleton.lessons];
    lessons[index] = { ...lessons[index], estimatedMinutes: minutes };
    setEditedSkeleton({ ...editedSkeleton, lessons });
  };

  const removeLesson = (index: number) => {
    if (!editedSkeleton) return;
    const lessons = editedSkeleton.lessons.filter((_, i) => i !== index);
    lessons.forEach((l, i) => {
      l.lessonNumber = i + 1;
      l.lessonId = `L${String(i + 1).padStart(2, "0")}`;
    });
    setEditedSkeleton({ ...editedSkeleton, lessons });
  };

  const moveLessonUp = (index: number) => {
    if (!editedSkeleton || index === 0) return;
    const lessons = [...editedSkeleton.lessons];
    [lessons[index - 1], lessons[index]] = [lessons[index], lessons[index - 1]];
    lessons.forEach((l, i) => {
      l.lessonNumber = i + 1;
      l.lessonId = `L${String(i + 1).padStart(2, "0")}`;
    });
    setEditedSkeleton({ ...editedSkeleton, lessons });
  };

  const moveLessonDown = (index: number) => {
    if (!editedSkeleton || index === editedSkeleton.lessons.length - 1) return;
    const lessons = [...editedSkeleton.lessons];
    [lessons[index], lessons[index + 1]] = [lessons[index + 1], lessons[index]];
    lessons.forEach((l, i) => {
      l.lessonNumber = i + 1;
      l.lessonId = `L${String(i + 1).padStart(2, "0")}`;
    });
    setEditedSkeleton({ ...editedSkeleton, lessons });
  };

  /* ─── Generate from approved skeleton ─── */
  const handleGenerate = useCallback(async () => {
    if (!editedSkeleton || !result) return;

    setScreen("generating");
    const lessonCount = editedSkeleton.lessons.length;
    setGenerationProgress(`Converting ${lessonCount} lessons (this may take 1-2 minutes)...`);

    try {
      const res = await fetch("/api/teacher/convert-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skeleton: editedSkeleton,
          rawText: result.rawText,
          extraction: result.extraction,
          mode: result.mode,
          targetUnitId: result.targetUnitId,
          lessonDurationMinutes: result.lessonDurationMinutes,
          frameworkKey: result.framework?.framework,
        }),
      });

      // Check response status BEFORE parsing JSON — timeout/error returns non-JSON
      if (!res.ok) {
        let errorMsg = "Generation failed";
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          // Response wasn't JSON (e.g. Vercel timeout)
          const text = await res.text().catch(() => "");
          errorMsg = res.status === 504
            ? "Generation timed out — try with fewer lessons or contact support."
            : text.slice(0, 200) || `Server error (${res.status})`;
        }
        setError(errorMsg);
        setScreen("review");
        return;
      }

      const data = await res.json();
      setGeneratedUnit(data);
      setScreen("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed — check your connection and try again.");
      setScreen("review");
    }
  }, [editedSkeleton, result]);

  /* ─── Derived data ─── */
  const framework = result?.framework || result?.extraction?.framework;
  const resources = result?.resources || [];
  const rubrics = result?.rubrics || result?.extraction?.rubrics || [];
  const layout = result?.layout;
  const totalResourceCount = resources.length;
  const videoCount = resources.filter(r => r.type === "video").length;

  /* ─── Render ─── */
  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-6">
        <Link href="/teacher/dashboard" className="hover:text-text-primary transition">
          Dashboard
        </Link>
        <ChevronRight />
        <Link href="/teacher/units" className="hover:text-text-primary transition">
          Units
        </Link>
        <ChevronRight />
        <span className="text-text-primary font-medium">Import Lesson Plan</span>
      </div>

      <h1 className="text-2xl font-bold text-text-primary mb-1">Import Lesson Plan</h1>
      <p className="text-sm text-text-secondary mb-6">
        Upload your existing lesson plan and we&apos;ll convert it into a StudioLoom unit — preserving your activities, resources, and rubrics.
      </p>

      {/* Progress Steps */}
      <div className="flex items-center gap-3 mb-8">
        {["Upload", "Review", "Generate"].map((step, i) => {
          const stepIndex = i;
          const currentIndex = screen === "upload" ? 0 : screen === "review" ? 1 : 2;
          const isActive = stepIndex === currentIndex;
          const isDone = stepIndex < currentIndex;
          return (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isDone ? "bg-purple-600 text-white" :
                isActive ? "bg-purple-100 text-purple-700 ring-2 ring-purple-300" :
                "bg-gray-100 text-gray-400"
              }`}>
                {isDone ? "✓" : stepIndex + 1}
              </div>
              <span className={`text-sm font-medium ${isActive ? "text-text-primary" : "text-text-secondary"}`}>
                {step}
              </span>
              {i < 2 && <div className="w-8 h-px bg-gray-200" />}
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700 font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* ════════ SCREEN 1: UPLOAD ════════ */}
      {screen === "upload" && (
        <div>
          {/* Mode selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-text-primary mb-2">What would you like to create?</label>
            <div className="flex gap-3">
              <button
                onClick={() => setMode("full_unit")}
                className={`flex-1 p-4 rounded-xl border-2 text-left transition ${
                  mode === "full_unit"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-semibold text-sm mb-1">Create new unit</div>
                <p className="text-xs text-text-secondary">Convert your entire plan into a new StudioLoom unit</p>
              </button>
              <button
                onClick={() => { setMode("single_lesson"); loadExistingUnits(); }}
                className={`flex-1 p-4 rounded-xl border-2 text-left transition ${
                  mode === "single_lesson"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-semibold text-sm mb-1">Add to existing unit</div>
                <p className="text-xs text-text-secondary">Import as a new lesson in an existing unit</p>
              </button>
            </div>
          </div>

          {/* Unit picker for single lesson mode */}
          {mode === "single_lesson" && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-text-primary mb-2">Select target unit</label>
              <select
                value={targetUnitId}
                onChange={(e) => setTargetUnitId(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm"
              >
                <option value="">Choose a unit...</option>
                {existingUnits.map((u) => (
                  <option key={u.id} value={u.id}>{u.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Supported formats note */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
            <strong>Supported formats:</strong> Any lesson plan layout — weekly tables, sequential lessons, narrative descriptions. We auto-detect your curriculum framework (IB MYP, VCAA, ACARA, GCSE, A-Level, IGCSE, PLTW).
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-purple-400 bg-purple-50"
                : uploading
                  ? "border-gray-300 bg-gray-50 pointer-events-none"
                  : "border-gray-300 hover:border-purple-300 hover:bg-purple-50/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.pptx"
              onChange={handleFileSelect}
              className="hidden"
            />

            {uploading ? (
              <div>
                <div className="w-10 h-10 mx-auto mb-3 rounded-full border-3 border-purple-200 border-t-purple-600 animate-spin" />
                <p className="text-sm font-medium text-text-primary">{uploadProgress}</p>
                <p className="text-xs text-text-secondary mt-1">This may take a moment — we&apos;re analysing your document structure...</p>
              </div>
            ) : (
              <div>
                <div className="text-4xl mb-3">📄</div>
                <p className="text-sm font-medium text-text-primary mb-1">
                  Drop your lesson plan here
                </p>
                <p className="text-xs text-text-secondary">
                  PDF, DOCX, or PPTX (max 20MB)
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════ SCREEN 2: REVIEW SKELETON ════════ */}
      {screen === "review" && editedSkeleton && result && (
        <div>
          {/* Detection Summary */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-text-primary">
                {editedSkeleton.lessons.length} lesson{editedSkeleton.lessons.length !== 1 ? "s" : ""} extracted
              </h3>
              <span className="text-xs text-text-secondary px-2 py-1 bg-white rounded-full border">
                {result.filename}
              </span>
            </div>
            <div className="flex gap-4 text-xs text-text-secondary flex-wrap">
              <span>Topic: <strong className="text-text-primary">{result.extraction.unitTopic}</strong></span>
              <span>Grade: <strong className="text-text-primary">{result.extraction.gradeLevel}</strong></span>
              <span>Subject: <strong className="text-text-primary">{result.extraction.subjectArea}</strong></span>
              {result.lessonDurationMinutes && (
                <span>Duration: <strong className="text-text-primary">{result.lessonDurationMinutes} min/lesson</strong></span>
              )}
              {result.totalDuration && (
                <span>Total: <strong className="text-text-primary">{result.totalDuration}</strong></span>
              )}
            </div>
          </div>

          {/* Framework Detection Badge */}
          {framework && framework.confidence !== "low" && (
            <div className={`mb-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${CONFIDENCE_COLORS[framework.confidence]}`}>
              <span className="font-bold">🎓 {framework.frameworkName}</span>
              <span className="opacity-70">({framework.confidence} confidence)</span>
              {framework.curriculumCodes.length > 0 && (
                <span className="ml-auto font-mono text-[10px] opacity-60">
                  {framework.curriculumCodes.slice(0, 3).join(", ")}
                  {framework.curriculumCodes.length > 3 && ` +${framework.curriculumCodes.length - 3} more`}
                </span>
              )}
            </div>
          )}

          {/* Layout Detection Info */}
          {layout && layout.type === "week-lesson-grid" && (
            <div className="mb-4 p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-700">
              📊 Detected table layout: {layout.weekCount} weeks × {layout.lessonsPerWeek} lessons/week
              {layout.mergedWeeks.length > 0 && ` (weeks ${layout.mergedWeeks.join(", ")} combined)`}
              {layout.hasDifferentiationColumn && " + differentiation column"}
            </div>
          )}

          {/* Resources summary */}
          {totalResourceCount > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowResources(!showResources)}
                className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 text-left flex items-center justify-between hover:bg-blue-100 transition"
              >
                <span>
                  🔗 {totalResourceCount} resource{totalResourceCount !== 1 ? "s" : ""} found
                  {videoCount > 0 && ` (${videoCount} video${videoCount !== 1 ? "s" : ""})`}
                  {" — these will be preserved in the generated unit"}
                </span>
                <span>{showResources ? "▲" : "▼"}</span>
              </button>
              {showResources && (
                <div className="mt-2 p-3 bg-white border border-gray-200 rounded-xl max-h-48 overflow-y-auto">
                  {resources.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
                      <span>{RESOURCE_ICONS[r.type] || "🔗"}</span>
                      <span className="font-medium text-text-primary truncate flex-1">{r.title}</span>
                      {r.lessonNumber > 0 && (
                        <span className="text-text-secondary px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">
                          L{r.lessonNumber}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Rubrics summary */}
          {rubrics.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => setShowRubrics(!showRubrics)}
                className="w-full p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 text-left flex items-center justify-between hover:bg-amber-100 transition"
              >
                <span>📋 {rubrics.length} rubric{rubrics.length !== 1 ? "s" : ""} extracted — will be attached to the unit</span>
                <span>{showRubrics ? "▲" : "▼"}</span>
              </button>
              {showRubrics && (
                <div className="mt-2 p-3 bg-white border border-gray-200 rounded-xl max-h-60 overflow-y-auto">
                  {rubrics.map((r, i) => (
                    <div key={i} className="mb-3 last:mb-0">
                      <div className="text-xs font-bold text-text-primary mb-1">{r.criterionName}</div>
                      <div className="flex flex-wrap gap-1">
                        {r.levels.map((level, j) => (
                          <span key={j} className="px-2 py-0.5 bg-gray-100 rounded text-[10px] text-text-secondary" title={level.description}>
                            {level.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Editable lesson list */}
          <div className="space-y-3 mb-6">
            {editedSkeleton.lessons.map((lesson, i) => {
              const extractionLesson = result.extraction.lessons[i];
              const lessonResources = resources.filter(r => r.lessonNumber === lesson.lessonNumber);
              return (
                <div key={lesson.lessonId} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    {/* Lesson number */}
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                      {lesson.lessonNumber}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={lesson.title}
                        onChange={(e) => updateLessonTitle(i, e.target.value)}
                        className="w-full text-sm font-semibold text-text-primary bg-transparent border-b border-transparent hover:border-gray-200 focus:border-purple-400 focus:outline-none pb-0.5 mb-1"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Timing */}
                        <div className="flex items-center gap-1 text-xs text-text-secondary">
                          <span>⏱</span>
                          <input
                            type="number"
                            value={lesson.estimatedMinutes}
                            onChange={(e) => updateLessonMinutes(i, parseInt(e.target.value) || 0)}
                            className="w-12 text-center bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-xs"
                          />
                          <span>min</span>
                        </div>
                        {/* Double period badge */}
                        {extractionLesson?.isDoublePeriod && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
                            DOUBLE
                          </span>
                        )}
                        {/* Week badge */}
                        {extractionLesson?.weekNumbers && extractionLesson.weekNumbers.length > 0 && (
                          <span className="text-[10px] text-text-secondary px-1.5 py-0.5 bg-gray-100 rounded">
                            Wk {extractionLesson.weekNumbers.join("+")}
                          </span>
                        )}
                        {/* Criterion tags */}
                        {lesson.criterionTags.map((tag) => (
                          <span key={tag} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${CRITERION_COLORS[tag] || "bg-gray-100 text-gray-600"}`}>
                            {tag}
                          </span>
                        ))}
                        {/* Phase */}
                        <span className="text-[10px] text-text-secondary px-1.5 py-0.5 bg-gray-100 rounded">
                          {lesson.phaseLabel}
                        </span>
                        {/* Resource count */}
                        {lessonResources.length > 0 && (
                          <span className="text-[10px] text-blue-600 px-1.5 py-0.5 bg-blue-50 rounded">
                            🔗 {lessonResources.length}
                          </span>
                        )}
                      </div>
                      {/* Activity hints */}
                      {lesson.activityHints.length > 0 && (
                        <div className="mt-2 text-xs text-text-secondary">
                          {lesson.activityHints.slice(0, 3).join(" → ")}
                        </div>
                      )}
                      {/* Differentiation */}
                      {extractionLesson?.differentiation && (
                        <div className="mt-1 text-[10px] text-purple-600 italic">
                          Differentiation: {extractionLesson.differentiation.length > 80
                            ? extractionLesson.differentiation.slice(0, 77) + "..."
                            : extractionLesson.differentiation}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        onClick={() => moveLessonUp(i)}
                        disabled={i === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveLessonDown(i)}
                        disabled={i === editedSkeleton.lessons.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        title="Move down"
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => removeLesson(i)}
                        className="p-1 text-red-300 hover:text-red-500"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setScreen("upload"); setResult(null); setEditedSkeleton(null); }}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition"
            >
              ← Back
            </button>
            <button
              onClick={handleGenerate}
              className="px-6 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition shadow-sm"
            >
              Generate Unit →
            </button>
          </div>
        </div>
      )}

      {/* ════════ SCREEN 3: GENERATING ════════ */}
      {screen === "generating" && (
        <div className="text-center py-16">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
          <h2 className="text-lg font-bold text-text-primary mb-2">Generating your unit</h2>
          <p className="text-sm text-text-secondary">{generationProgress}</p>
          <p className="text-xs text-text-secondary mt-2">
            Converting {editedSkeleton?.lessons.length || 0} lesson{(editedSkeleton?.lessons.length || 0) !== 1 ? "s" : ""} with Workshop Model timing...
          </p>
          {framework && (
            <p className="text-xs text-purple-500 mt-1">
              Framework: {framework.frameworkName}
            </p>
          )}
        </div>
      )}

      {/* ════════ SCREEN 4: COMPLETE ════════ */}
      {screen === "complete" && generatedUnit && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Unit Generated!</h2>
          <p className="text-sm text-text-secondary mb-2">
            Your {editedSkeleton?.lessons.length || 0} lesson{(editedSkeleton?.lessons.length || 0) !== 1 ? "s" : ""} {editedSkeleton?.lessons.length === 1 ? "has" : "have"} been converted with Workshop Model timing and scaffolding.
          </p>
          {totalResourceCount > 0 && (
            <p className="text-xs text-blue-600 mb-1">🔗 {totalResourceCount} resources preserved</p>
          )}
          {rubrics.length > 0 && (
            <p className="text-xs text-amber-600 mb-4">📋 {rubrics.length} rubrics attached</p>
          )}
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/teacher/units"
              className="px-5 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition shadow-sm"
            >
              View Units
            </Link>
            <button
              onClick={() => {
                setScreen("upload");
                setResult(null);
                setEditedSkeleton(null);
                setGeneratedUnit(null);
                setError(null);
                setShowResources(false);
                setShowRubrics(false);
              }}
              className="px-5 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50 transition"
            >
              Import Another
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/* ─── Tiny Components ─── */

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
