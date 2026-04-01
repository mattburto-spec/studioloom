"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildPageDefinitions, type CriterionKey } from "@/lib/constants";
import { useWizardState } from "@/hooks/useWizardState";
import type { UnitPage, UnitContentDataV2, UnitContentDataV3, UnitContentDataV4, JourneyOutlineOption, TimelineOutlineOption, TimelinePhase, PageContent, TimelineActivity, TimelineLessonSkeleton, TimelineSkeleton } from "@/types";
import { useWizardSuggestions } from "@/hooks/useWizardSuggestions";
import { ConversationWizard } from "@/components/teacher/wizard/ConversationWizard";
import { ActivityBrowser } from "@/components/teacher/ActivityBrowser";
import { getActivityById, type ActivityTemplate } from "@/lib/activity-library";
// Note: onUnitCreated signal is called from the server-side generate-unit route, not here

export default function CreateUnitWizardPage() {
  const router = useRouter();
  const { state, dispatch } = useWizardState();
  const { suggestions, status: suggestionStatus } = useWizardSuggestions(state.input);

  async function generateOutlines() {
    dispatch({ type: "SET_OUTLINE_STATUS", status: "loading" });

    try {
      const res = await fetch("/api/teacher/generate-outlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizardInput: state.input }),
      });

      const data = await res.json();

      if (!res.ok) {
        dispatch({ type: "SET_OUTLINE_STATUS", status: "error", error: data.error || "Failed to generate outlines" });
        return;
      }

      dispatch({ type: "SET_OUTLINES", options: data.options || [] });
    } catch (err) {
      dispatch({
        type: "SET_OUTLINE_STATUS",
        status: "error",
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  async function generateCriterionStreaming(
    criterion: CriterionKey,
    outline: { approach: string; pages: Record<string, { title: string; summary: string }> } | null
  ): Promise<boolean> {
    dispatch({ type: "SET_CRITERION_STATUS", criterion, status: "generating" });
    dispatch({ type: "SET_STREAMING", text: "", criterion });

    try {
      const res = await fetch("/api/teacher/generate-unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wizardInput: state.input,
          criterion,
          selectedOutline: outline,
          stream: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        dispatch({ type: "SET_CRITERION_STATUS", criterion, status: "error" });
        dispatch({ type: "SET_ERROR", error: data.error || `Failed to generate Criterion ${criterion}` });
        return false;
      }

      const contentType = res.headers.get("content-type") || "";

      // SSE streaming path
      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let jsonAccumulator = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;

            try {
              const event = JSON.parse(payload);

              if (event.type === "delta") {
                jsonAccumulator += event.json;
                dispatch({ type: "SET_STREAMING", text: jsonAccumulator, criterion });
              } else if (event.type === "complete") {
                dispatch({ type: "MERGE_PAGES", pages: event.pages });
                if (event.warnings?.length) {
                  dispatch({ type: "ADD_WARNINGS", warnings: event.warnings });
                }
                if (event.ragChunkIds?.length) {
                  dispatch({ type: "ADD_RAG_CHUNK_IDS", ids: event.ragChunkIds });
                }
                if (event.pulseScores && Object.keys(event.pulseScores).length > 0) {
                  dispatch({ type: "MERGE_PULSE_SCORES", scores: event.pulseScores });
                }
                dispatch({ type: "SET_CRITERION_STATUS", criterion, status: "done" });
                dispatch({ type: "SET_STREAMING", text: "", criterion: null });
              } else if (event.type === "error") {
                dispatch({ type: "SET_CRITERION_STATUS", criterion, status: "error" });
                dispatch({ type: "SET_ERROR", error: event.error });
                dispatch({ type: "SET_STREAMING", text: "", criterion: null });
                return false;
              }
            } catch {
              // Ignore malformed SSE lines
            }
          }
        }
        return true;
      }

      // Non-streaming fallback (OpenAI-compatible providers)
      const data = await res.json();
      dispatch({ type: "MERGE_PAGES", pages: data.pages });
      if (data.warnings?.length) {
        dispatch({ type: "ADD_WARNINGS", warnings: data.warnings });
      }
      if (data.ragChunkIds?.length) {
        dispatch({ type: "ADD_RAG_CHUNK_IDS", ids: data.ragChunkIds });
      }
      if (data.pulseScores && Object.keys(data.pulseScores).length > 0) {
        dispatch({ type: "MERGE_PULSE_SCORES", scores: data.pulseScores });
      }
      dispatch({ type: "SET_CRITERION_STATUS", criterion, status: "done" });
      dispatch({ type: "SET_STREAMING", text: "", criterion: null });
      return true;
    } catch (err) {
      dispatch({ type: "SET_CRITERION_STATUS", criterion, status: "error" });
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Network error" });
      dispatch({ type: "SET_STREAMING", text: "", criterion: null });
      return false;
    }
  }

  async function generateAll() {
    dispatch({ type: "SET_ERROR", error: "" });
    const criteria = state.input.selectedCriteria;
    const outline =
      state.selectedOutline !== null ? state.outlineOptions[state.selectedOutline] : null;

    // Generate all criteria in parallel — each updates its own status independently
    const results = await Promise.allSettled(
      criteria.map((criterion) => generateCriterionStreaming(criterion, outline))
    );

    // Report first failure if any
    const firstFailure = results.find(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value)
    );
    if (firstFailure) {
      // Individual criterion errors already dispatched inside generateCriterionStreaming
      return;
    }
  }

  // --- Journey mode generation ---

  async function generateJourneyOutlines() {
    dispatch({ type: "SET_OUTLINE_STATUS", status: "loading" });
    try {
      const res = await fetch("/api/teacher/generate-journey-outlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyInput: state.journeyInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "SET_OUTLINE_STATUS", status: "error", error: data.error || "Failed to generate outlines" });
        return;
      }
      dispatch({ type: "SET_JOURNEY_OUTLINES", options: data.options || [] });
    } catch (err) {
      dispatch({ type: "SET_OUTLINE_STATUS", status: "error", error: err instanceof Error ? err.message : "Network error" });
    }
  }

  async function generateJourneyBatch(
    batchIndex: number,
    lessonIds: string[],
    outline: JourneyOutlineOption | null,
    previousSummary?: string
  ): Promise<boolean> {
    dispatch({ type: "SET_BATCH_STATUS", batchIndex, status: "generating" });

    try {
      const res = await fetch("/api/teacher/generate-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journeyInput: state.journeyInput,
          lessonIds,
          selectedOutline: outline,
          previousLessonSummary: previousSummary,
          stream: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        dispatch({ type: "SET_BATCH_STATUS", batchIndex, status: "error" });
        dispatch({ type: "SET_ERROR", error: data.error || `Failed to generate lessons ${lessonIds[0]}-${lessonIds[lessonIds.length - 1]}` });
        return false;
      }

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;

            try {
              const event = JSON.parse(payload);
              if (event.type === "delta") {
                dispatch({ type: "SET_STREAMING", text: (state.streamingText || "") + event.json, criterion: null });
              } else if (event.type === "complete") {
                dispatch({ type: "MERGE_PAGES", pages: event.pages });
                if (event.warnings?.length) {
                  dispatch({ type: "ADD_WARNINGS", warnings: event.warnings });
                }
                if (event.ragChunkIds?.length) {
                  dispatch({ type: "ADD_RAG_CHUNK_IDS", ids: event.ragChunkIds });
                }
                if (event.pulseScores && Object.keys(event.pulseScores).length > 0) {
                  dispatch({ type: "MERGE_PULSE_SCORES", scores: event.pulseScores });
                }
                dispatch({ type: "SET_BATCH_STATUS", batchIndex, status: "done" });
                dispatch({ type: "SET_STREAMING", text: "", criterion: null });
                // Stagger reveal lessons one-by-one for animation
                lessonIds.forEach((id, j) => {
                  setTimeout(() => dispatch({ type: "REVEAL_LESSON", lessonId: id }), j * 400);
                });
              } else if (event.type === "error") {
                dispatch({ type: "SET_BATCH_STATUS", batchIndex, status: "error" });
                dispatch({ type: "SET_ERROR", error: event.error });
                return false;
              }
            } catch {
              // Ignore malformed SSE
            }
          }
        }
        return true;
      }

      // Non-streaming fallback
      const data = await res.json();
      dispatch({ type: "MERGE_PAGES", pages: data.pages });
      if (data.pulseScores && Object.keys(data.pulseScores).length > 0) {
        dispatch({ type: "MERGE_PULSE_SCORES", scores: data.pulseScores });
      }
      dispatch({ type: "SET_BATCH_STATUS", batchIndex, status: "done" });
      // Stagger reveal
      lessonIds.forEach((id, j) => {
        setTimeout(() => dispatch({ type: "REVEAL_LESSON", lessonId: id }), j * 400);
      });
      return true;
    } catch (err) {
      dispatch({ type: "SET_BATCH_STATUS", batchIndex, status: "error" });
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Network error" });
      return false;
    }
  }

  async function generateAllJourney() {
    dispatch({ type: "SET_ERROR", error: "" });
    dispatch({ type: "INIT_JOURNEY_BATCHES" });

    // Re-read batches after init
    const total = state.totalLessons;
    const batchSize = 6;
    const batches: string[][] = [];
    for (let i = 0; i < total; i += batchSize) {
      const count = Math.min(batchSize, total - i);
      batches.push(Array.from({ length: count }, (_, j) => `L${String(i + j + 1).padStart(2, "0")}`));
    }

    const outline = state.selectedJourneyOutline !== null
      ? state.journeyOutlineOptions[state.selectedJourneyOutline]
      : null;

    let previousSummary: string | undefined;
    for (let i = 0; i < batches.length; i++) {
      const success = await generateJourneyBatch(i, batches[i], outline, previousSummary);
      if (!success) return;
      // Build summary of what was generated for the next batch
      previousSummary = batches[i].map((id) => {
        const page = state.generatedPages[id];
        return page ? `${id}: ${page.title} — ${page.learningGoal}` : `${id}: (generated)`;
      }).join("\n");
    }
  }

  // --- Timeline mode (v4) generation ---

  async function generateTimelineOutlines() {
    dispatch({ type: "SET_OUTLINE_STATUS", status: "loading" });
    // Clear any previous outlines so cards appear fresh
    dispatch({ type: "SET_TIMELINE_OUTLINES", options: [] });

    const angles = [
      "Design Thinking / Human-Centred Design — start with empathy and user research, iterate through prototyping",
      "Project-Based / Maker approach — learn by building, skills emerge from the making process",
      "Skills-First Progression — build foundational skills early, apply them in increasingly complex challenges",
    ];

    // Fire 3 requests in parallel — each appears as it resolves
    const promises = angles.map((angleHint, index) =>
      fetch("/api/teacher/generate-timeline-outline-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journeyInput: state.journeyInput,
          angleHint,
          avoidApproaches: angles.filter((_, i) => i !== index).map((a) => a.split(" — ")[0]),
          index,
        }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok && data.option) {
            dispatch({
              type: "APPEND_TIMELINE_OUTLINE",
              option: { ...data.option, phases: data.option.phases || [] },
              index: data.index ?? index,
            });
          }
          return { ok: res.ok, index, error: data.error };
        })
        .catch((err) => ({
          ok: false,
          index,
          error: err instanceof Error ? err.message : "Network error",
        }))
    );

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.ok).length;

    if (successCount === 0) {
      // All 3 failed — fall back to the original batch endpoint
      try {
        const res = await fetch("/api/teacher/generate-timeline-outlines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journeyInput: state.journeyInput }),
        });
        const data = await res.json();
        if (!res.ok) {
          dispatch({ type: "SET_OUTLINE_STATUS", status: "error", error: data.error || "Failed to generate outlines" });
          return;
        }
        dispatch({ type: "SET_TIMELINE_OUTLINES", options: data.options || [] });
      } catch (err) {
        dispatch({ type: "SET_OUTLINE_STATUS", status: "error", error: err instanceof Error ? err.message : "Network error" });
      }
    } else if (successCount < 3) {
      // Partial success — mark as done with what we have (avoid staying on "loading" forever)
      dispatch({ type: "SET_OUTLINE_STATUS", status: "done" });
    }
    // If all 3 succeeded, APPEND_TIMELINE_OUTLINE already set outlineStatus to "done"
  }

  /**
   * Generate a single additional approach (for "Suggest another" buttons).
   * Reads existing approaches to tell the AI what to avoid.
   */
  async function generateAdditionalApproach(angleHint: string) {
    const hasTimelineOutlines = state.timelineOutlineOptions.some(Boolean);
    const existingOptions = hasTimelineOutlines
      ? state.timelineOutlineOptions.filter(Boolean)
      : state.journeyOutlineOptions;
    const nextIndex = existingOptions.length;
    const avoidApproaches = existingOptions
      .map((opt) => opt?.approach)
      .filter(Boolean) as string[];

    if (hasTimelineOutlines) {
      // Timeline mode — use the single-outline endpoint
      try {
        const res = await fetch("/api/teacher/generate-timeline-outline-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            journeyInput: state.journeyInput,
            angleHint,
            avoidApproaches,
            index: nextIndex,
          }),
        });
        const data = await res.json();
        if (res.ok && data.option) {
          dispatch({
            type: "APPEND_TIMELINE_OUTLINE",
            option: { ...data.option, phases: data.option.phases || [] },
            index: nextIndex,
          });
        }
      } catch {
        // Silent fail — button just stops loading
      }
    } else {
      // Journey mode — use the journey endpoint in single mode
      try {
        const res = await fetch("/api/teacher/generate-journey-outlines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            journeyInput: state.journeyInput,
            angleHint,
            avoidApproaches,
            index: nextIndex,
          }),
        });
        const data = await res.json();
        if (res.ok && data.option) {
          dispatch({
            type: "APPEND_JOURNEY_OUTLINE",
            option: { ...data.option, lessonPlan: data.option.lessonPlan || [] },
            index: nextIndex,
          });
        }
      } catch {
        // Silent fail
      }
    }
  }

  async function generateTimelinePhase(
    phaseIndex: number,
    phase: TimelinePhase,
    outline: TimelineOutlineOption,
    previousSummary?: string,
    activitiesGeneratedSoFar?: number
  ): Promise<{ success: boolean; activities: import("@/types").TimelineActivity[] }> {
    dispatch({ type: "SET_TIMELINE_PHASE_STATUS", phaseId: phase.phaseId, status: "generating" });

    try {
      const estCount = Math.round(phase.estimatedLessons * 5);
      const res = await fetch("/api/teacher/generate-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journeyInput: state.journeyInput,
          selectedOutline: outline,
          phaseToGenerate: phase,
          previousActivitiesSummary: previousSummary,
          activitiesGeneratedSoFar,
          estimatedActivityCount: estCount,
          stream: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        dispatch({ type: "SET_TIMELINE_PHASE_STATUS", phaseId: phase.phaseId, status: "error" });
        dispatch({ type: "SET_ERROR", error: data.error || `Failed to generate phase "${phase.title}"` });
        return { success: false, activities: [] };
      }

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let newActivities: import("@/types").TimelineActivity[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;

            try {
              const event = JSON.parse(payload);
              if (event.type === "delta") {
                dispatch({ type: "SET_STREAMING", text: (state.streamingText || "") + event.json, criterion: null });
              } else if (event.type === "complete") {
                newActivities = event.activities || [];
                dispatch({ type: "MERGE_TIMELINE", activities: newActivities });
                if (event.warnings?.length) {
                  dispatch({ type: "ADD_WARNINGS", warnings: event.warnings });
                }
                if (event.ragChunkIds?.length) {
                  dispatch({ type: "ADD_RAG_CHUNK_IDS", ids: event.ragChunkIds });
                }
                dispatch({ type: "SET_TIMELINE_PHASE_STATUS", phaseId: phase.phaseId, status: "done" });
                dispatch({ type: "SET_STREAMING", text: "", criterion: null });
                // Stagger reveal activities
                newActivities.forEach((a, j) => {
                  setTimeout(() => dispatch({ type: "REVEAL_ACTIVITY", activityId: a.id }), j * 200);
                });
              } else if (event.type === "quality_report" && event.qualityReport) {
                dispatch({ type: "SET_QUALITY_REPORT", report: event.qualityReport });
              } else if (event.type === "error") {
                dispatch({ type: "SET_TIMELINE_PHASE_STATUS", phaseId: phase.phaseId, status: "error" });
                dispatch({ type: "SET_ERROR", error: event.error });
                return { success: false, activities: [] };
              }
            } catch {
              // Ignore malformed SSE
            }
          }
        }
        return { success: true, activities: newActivities };
      }

      // Non-streaming fallback
      const data = await res.json();
      const newActivities = data.activities || [];
      dispatch({ type: "MERGE_TIMELINE", activities: newActivities });
      if (data.qualityReport) {
        dispatch({ type: "SET_QUALITY_REPORT", report: data.qualityReport });
      }
      dispatch({ type: "SET_TIMELINE_PHASE_STATUS", phaseId: phase.phaseId, status: "done" });
      newActivities.forEach((a: import("@/types").TimelineActivity, j: number) => {
        setTimeout(() => dispatch({ type: "REVEAL_ACTIVITY", activityId: a.id }), j * 200);
      });
      return { success: true, activities: newActivities };
    } catch (err) {
      dispatch({ type: "SET_TIMELINE_PHASE_STATUS", phaseId: phase.phaseId, status: "error" });
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Network error" });
      return { success: false, activities: [] };
    }
  }

  async function generateAllTimeline() {
    dispatch({ type: "SET_ERROR", error: "" });
    dispatch({ type: "INIT_TIMELINE_PHASES" });

    const outline = state.selectedTimelineOutline !== null
      ? state.timelineOutlineOptions[state.selectedTimelineOutline]
      : null;

    if (!outline) {
      dispatch({ type: "SET_ERROR", error: "No outline selected" });
      return;
    }

    let previousSummary: string | undefined;
    let totalActivities = 0;

    for (let i = 0; i < outline.phases.length; i++) {
      const phase = outline.phases[i];
      const result = await generateTimelinePhase(i, phase, outline, previousSummary, totalActivities);
      if (!result.success) return;

      totalActivities += result.activities.length;
      // Build summary for next batch
      previousSummary = result.activities.map((a) =>
        `${a.id} (${a.role}): ${a.title} — ${a.durationMinutes}min [${a.criterionTags?.join(",") || ""}]`
      ).join("\n");
    }
  }

  // --- Two-stage skeleton → per-lesson generation ---

  async function generateSkeleton() {
    const outline = state.selectedTimelineOutline !== null
      ? state.timelineOutlineOptions[state.selectedTimelineOutline]
      : null;

    if (!outline) {
      dispatch({ type: "SET_ERROR", error: "No outline selected" });
      return;
    }

    dispatch({ type: "SET_SKELETON_STATUS", status: "loading" });
    dispatch({ type: "SET_ERROR", error: "" });
    // Transition to skeleton phase immediately so the loading spinner shows
    dispatch({ type: "SET_PHASE", phase: "skeleton" });

    try {
      const res = await fetch("/api/teacher/generate-timeline-skeleton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journeyInput: state.journeyInput,
          selectedOutline: outline,
          skipRag: true, // RAG was already done during approach generation
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        dispatch({ type: "SET_SKELETON_STATUS", status: "error" });
        dispatch({ type: "SET_ERROR", error: data.error || "Failed to generate skeleton" });
        return;
      }

      if (data.ragChunkIds?.length) {
        dispatch({ type: "ADD_RAG_CHUNK_IDS", ids: data.ragChunkIds });
      }
      dispatch({ type: "SET_SKELETON", skeleton: data.skeleton });
    } catch (err) {
      dispatch({ type: "SET_SKELETON_STATUS", status: "error" });
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Network error" });
    }
  }

  async function generateLessonActivities(
    lesson: TimelineLessonSkeleton,
    fullSkeleton: TimelineSkeleton
  ): Promise<{ success: boolean; activities: TimelineActivity[] }> {
    dispatch({ type: "SET_LESSON_GENERATION_STATUS", lessonId: lesson.lessonId, status: "generating" });

    try {
      const estCount = Math.max(3, Math.round(lesson.estimatedMinutes / 10));
      const res = await fetch("/api/teacher/generate-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journeyInput: state.journeyInput,
          lessonSkeleton: lesson,
          fullSkeleton,
          estimatedActivityCount: estCount,
          stream: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        dispatch({ type: "SET_LESSON_GENERATION_STATUS", lessonId: lesson.lessonId, status: "error" });
        dispatch({ type: "SET_ERROR", error: data.error || `Failed to generate lesson "${lesson.title}"` });
        return { success: false, activities: [] };
      }

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let newActivities: TimelineActivity[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;

            try {
              const event = JSON.parse(payload);
              if (event.type === "complete") {
                newActivities = event.activities || [];
                dispatch({ type: "MERGE_TIMELINE", activities: newActivities });
                if (event.warnings?.length) {
                  dispatch({ type: "ADD_WARNINGS", warnings: event.warnings });
                }
                if (event.ragChunkIds?.length) {
                  dispatch({ type: "ADD_RAG_CHUNK_IDS", ids: event.ragChunkIds });
                }
                dispatch({ type: "SET_LESSON_GENERATION_STATUS", lessonId: lesson.lessonId, status: "done" });
                // Stagger reveal activities
                newActivities.forEach((a, j) => {
                  setTimeout(() => dispatch({ type: "REVEAL_ACTIVITY", activityId: a.id }), j * 200);
                });
              } else if (event.type === "quality_report" && event.qualityReport) {
                dispatch({ type: "SET_QUALITY_REPORT", report: event.qualityReport });
              } else if (event.type === "error") {
                // If we already received activities via "complete", this is a non-fatal
                // post-generation error (e.g., quality evaluator timeout, stream abort).
                // Don't fail the lesson — the content is already merged into state.
                if (newActivities.length > 0) {
                  console.warn(`[generateLessonActivities] Non-fatal error after complete for "${lesson.title}": ${event.error}`);
                } else {
                  dispatch({ type: "SET_LESSON_GENERATION_STATUS", lessonId: lesson.lessonId, status: "error" });
                  dispatch({ type: "SET_ERROR", error: event.error });
                  return { success: false, activities: [] };
                }
              }
            } catch {
              // Ignore malformed SSE
            }
          }
        }
        // If we got activities from "complete" event, the lesson succeeded even if
        // a post-complete error occurred (stream terminated, quality eval timeout, etc.)
        if (newActivities.length > 0) {
          dispatch({ type: "SET_LESSON_GENERATION_STATUS", lessonId: lesson.lessonId, status: "done" });
          return { success: true, activities: newActivities };
        }
        return { success: true, activities: newActivities };
      }

      // Non-streaming fallback
      const data = await res.json();
      const newActivities: TimelineActivity[] = data.activities || [];
      dispatch({ type: "MERGE_TIMELINE", activities: newActivities });
      if (data.qualityReport) {
        dispatch({ type: "SET_QUALITY_REPORT", report: data.qualityReport });
      }
      if (data.ragChunkIds?.length) {
        dispatch({ type: "ADD_RAG_CHUNK_IDS", ids: data.ragChunkIds });
      }
      dispatch({ type: "SET_LESSON_GENERATION_STATUS", lessonId: lesson.lessonId, status: "done" });
      newActivities.forEach((a, j) => {
        setTimeout(() => dispatch({ type: "REVEAL_ACTIVITY", activityId: a.id }), j * 200);
      });
      return { success: true, activities: newActivities };
    } catch (err) {
      dispatch({ type: "SET_LESSON_GENERATION_STATUS", lessonId: lesson.lessonId, status: "error" });
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Network error" });
      return { success: false, activities: [] };
    }
  }

  async function generateAllTimelineFromSkeleton() {
    if (!state.timelineSkeleton) {
      dispatch({ type: "SET_ERROR", error: "No skeleton available" });
      return;
    }

    dispatch({ type: "SET_ERROR", error: "" });
    dispatch({ type: "SET_PHASE", phase: "generating" });
    dispatch({ type: "CLEAR_TIMELINE_GENERATION" });
    dispatch({ type: "INIT_LESSON_GENERATION" });

    const skeleton = state.timelineSkeleton;
    const concurrency = 4;
    const lessons = [...skeleton.lessons];
    let nextIndex = 0;

    // Process lessons with a concurrency pool of 2
    async function processNext(): Promise<void> {
      while (nextIndex < lessons.length) {
        const lesson = lessons[nextIndex];
        nextIndex++;
        const result = await generateLessonActivities(lesson, skeleton);
        if (!result.success) return; // Stop on error
      }
    }

    // Launch `concurrency` workers
    const workers = Array.from({ length: Math.min(concurrency, lessons.length) }, () => processNext());
    await Promise.all(workers);

    // Check if all lessons completed successfully
    const allDone = state.timelineSkeleton?.lessons.every((l) =>
      state.lessonGenerationStatuses.find((s) => s.lessonId === l.lessonId)?.status === "done"
    );

    // Transition to review if no errors were dispatched
    if (!state.error) {
      dispatch({ type: "REVEAL_ALL_ACTIVITIES" });
      dispatch({ type: "SET_PHASE", phase: "review" });
    }
  }

  async function saveUnit() {
    dispatch({ type: "SET_SAVING", saving: true });

    let contentData: UnitContentDataV2 | UnitContentDataV3 | UnitContentDataV4;
    let title: string;
    let description: string | null;
    let gradeLevel: string;
    let durationWeeks: number;
    let topic: string;
    let globalContext: string;
    let keyConcept: string;
    let tags: string[];

    // Timeline mode (v4): flat activity sequence
    const isTimelineMode = state.journeyMode && state.selectedTimelineOutline !== null;

    if (isTimelineMode) {
      contentData = {
        version: 4,
        generationModel: "timeline",
        timeline: state.timelineActivities,
        lessonLengthMinutes: state.journeyInput.lessonLengthMinutes,
        assessmentCriteria: state.journeyInput.assessmentCriteria,
      };

      title = state.journeyInput.title.trim() || state.journeyInput.endGoal.slice(0, 60);
      description = state.journeyInput.statementOfInquiry || state.journeyInput.endGoal || null;
      gradeLevel = state.journeyInput.gradeLevel;
      durationWeeks = state.journeyInput.durationWeeks;
      topic = state.journeyInput.topic;
      globalContext = state.journeyInput.globalContext;
      keyConcept = state.journeyInput.keyConcept;
      tags = [...state.journeyInput.specificSkills.slice(0, 5)];
    } else if (state.journeyMode) {
      // Journey mode: build v3 content data
      const unitPages: UnitPage[] = [];
      const outline = state.selectedJourneyOutline !== null
        ? state.journeyOutlineOptions[state.selectedJourneyOutline]
        : null;

      // Build lesson pages from generated content, ordered by lesson ID
      const lessonIds = Object.keys(state.generatedPages)
        .filter(id => id.startsWith("L"))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      for (const lessonId of lessonIds) {
        const content = state.generatedPages[lessonId] as PageContent;
        if (!content) continue;
        const outlineLesson = outline?.lessonPlan.find(l => l.lessonId === lessonId);
        unitPages.push({
          id: lessonId,
          type: "lesson",
          title: content.title || outlineLesson?.title || `Lesson ${lessonId.slice(1)}`,
          content,
        });
      }

      contentData = {
        version: 3,
        generationModel: "journey",
        pages: unitPages,
        lessonLengthMinutes: state.journeyInput.lessonLengthMinutes,
        assessmentCriteria: state.journeyInput.assessmentCriteria,
      };

      title = state.journeyInput.title.trim() || state.journeyInput.endGoal.slice(0, 60);
      description = state.journeyInput.statementOfInquiry || state.journeyInput.endGoal || null;
      gradeLevel = state.journeyInput.gradeLevel;
      durationWeeks = state.journeyInput.durationWeeks;
      topic = state.journeyInput.topic;
      globalContext = state.journeyInput.globalContext;
      keyConcept = state.journeyInput.keyConcept;
      tags = [...state.journeyInput.specificSkills.slice(0, 5)];
    } else {
      // Criterion mode: build v2 content data
      const pageDefs = buildPageDefinitions(state.input.selectedCriteria, state.input.criteriaFocus);
      const unitPages: UnitPage[] = [];
      for (const def of pageDefs) {
        const content = state.generatedPages[def.id];
        if (!content) continue;
        unitPages.push({
          id: def.id,
          type: "strand",
          criterion: def.criterion,
          strandIndex: def.strandIndex,
          title: content.title || def.title,
          content,
        });
      }

      contentData = { version: 2, pages: unitPages };
      title = state.input.title.trim();
      description = state.input.statementOfInquiry || null;
      gradeLevel = state.input.gradeLevel;
      durationWeeks = state.input.durationWeeks;
      topic = state.input.topic;
      globalContext = state.input.globalContext;
      keyConcept = state.input.keyConcept;
      tags = [...state.input.specificSkills.slice(0, 5)];
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Resolve unit type from wizard input (default: design)
    const unitType = state.input?.unitType || state.journeyInput?.unitType || "design";

    const insertPayload: Record<string, unknown> = {
      title,
      description,
      content_data: contentData,
      grade_level: gradeLevel,
      duration_weeks: durationWeeks,
      topic,
      global_context: globalContext,
      key_concept: keyConcept,
      tags,
      author_teacher_id: user?.id || null,
      teacher_id: user?.id || null,
      quality_report: state.qualityReport || null,
      unit_type: unitType,
    };

    let { data: newUnit, error } = await supabase
      .from("units")
      .insert(insertPayload)
      .select("id")
      .single();

    // Retry without unit_type if column doesn't exist yet (migration 051 not applied)
    if (error && (error.message.includes("unit_type") || error.code === "PGRST204")) {
      delete insertPayload.unit_type;
      const retry = await supabase
        .from("units")
        .insert(insertPayload)
        .select("id")
        .single();
      newUnit = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("[saveUnit] Insert failed:", error);
      dispatch({ type: "SET_ERROR", error: error.message });
      dispatch({ type: "SET_SAVING", saving: false });
      return;
    }

    // Note: teacher style profile signal (onUnitCreated) is handled server-side
    // in the generate-unit API route, not here in the client component

    // Auto-ingest into knowledge base (fire-and-forget)
    if (newUnit?.id) {
      fetch("/api/teacher/knowledge/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: newUnit.id }),
      }).catch(() => {});
    }

    // Record RAG chunk usage (fire-and-forget)
    if (state.ragChunkIds.length > 0) {
      fetch("/api/teacher/knowledge/record-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunkIds: state.ragChunkIds }),
      }).catch(() => {});
    }

    router.push("/teacher/units");
  }

  async function handleRegeneratePage(pageId: string) {
    const criterion = pageId.charAt(0) as CriterionKey;
    dispatch({ type: "SET_CRITERION_STATUS", criterion, status: "generating" });
    dispatch({ type: "SET_ERROR", error: "" });

    try {
      const outline =
        state.selectedOutline !== null ? state.outlineOptions[state.selectedOutline] : null;
      const res = await fetch("/api/teacher/generate-unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wizardInput: state.input,
          criterion,
          selectedOutline: outline,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        dispatch({ type: "SET_CRITERION_STATUS", criterion, status: "done" });
        dispatch({ type: "SET_ERROR", error: data.error || `Failed to regenerate page ${pageId}` });
        return;
      }

      // Only update the specific page that was requested
      if (data.pages?.[pageId]) {
        dispatch({ type: "UPDATE_PAGE", pageId, page: data.pages[pageId] });
      } else {
        // Fallback: merge all pages from this criterion
        dispatch({ type: "MERGE_PAGES", pages: data.pages });
      }
      dispatch({ type: "SET_CRITERION_STATUS", criterion, status: "done" });
    } catch (err) {
      dispatch({ type: "SET_CRITERION_STATUS", criterion, status: "done" });
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  function handleActivityInsert(activity: ActivityTemplate) {
    const pageId = state.activityBrowserPage;
    if (!pageId) return;
    const existing = state.generatedPages[pageId];
    if (!existing) return;

    dispatch({
      type: "UPDATE_PAGE",
      pageId,
      page: {
        ...existing,
        sections: [...existing.sections, ...activity.template.sections],
      },
    });
    dispatch({ type: "SET_ACTIVITY_BROWSER", open: false });
  }

  function handleActivityDrop(pageId: string, activityId: string) {
    const activity = getActivityById(activityId);
    if (!activity) return;
    const existing = state.generatedPages[pageId];
    if (!existing) return;

    dispatch({
      type: "UPDATE_PAGE",
      pageId,
      page: {
        ...existing,
        sections: [...existing.sections, ...activity.template.sections],
      },
    });
  }

  function handleRetryCriterion(criterion: CriterionKey) {
    dispatch({ type: "SET_ERROR", error: "" });
    const outline =
      state.selectedOutline !== null ? state.outlineOptions[state.selectedOutline] : null;
    generateCriterionStreaming(criterion, outline);
  }

  async function handleRegenerateActivity(activityId: string) {
    const activity = state.timelineActivities.find((a) => a.id === activityId);
    if (!activity) return;

    dispatch({ type: "SET_REGENERATING_ACTIVITY", activityId });
    dispatch({ type: "SET_ERROR", error: "" });

    const outline = state.selectedTimelineOutline !== null
      ? state.timelineOutlineOptions[state.selectedTimelineOutline]
      : null;

    // Get surrounding context for better regeneration
    const activityIdx = state.timelineActivities.findIndex((a) => a.id === activityId);
    const prevActivity = activityIdx > 0 ? state.timelineActivities[activityIdx - 1] : null;
    const nextActivity = activityIdx < state.timelineActivities.length - 1 ? state.timelineActivities[activityIdx + 1] : null;

    try {
      const res = await fetch("/api/teacher/generate-timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journeyInput: state.journeyInput,
          selectedOutline: outline,
          estimatedActivityCount: 1,
          previousActivitiesSummary: [
            prevActivity && `Previous: ${prevActivity.title} (${prevActivity.role}, ${prevActivity.durationMinutes}min)`,
            `Current (regenerate): ${activity.title} (${activity.role}, ${activity.durationMinutes}min, ${activity.responseType})`,
            nextActivity && `Next: ${nextActivity.title} (${nextActivity.role}, ${nextActivity.durationMinutes}min)`,
            `\nRegenerate ONLY the "Current" activity above. Keep the same role (${activity.role}), similar duration (~${activity.durationMinutes}min), and criterion tags [${activity.criterionTags?.join(", ") || ""}]. Create a fresh alternative with a different angle or approach.`,
          ].filter(Boolean).join("\n"),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        dispatch({ type: "SET_REGENERATING_ACTIVITY", activityId: null });
        dispatch({ type: "SET_ERROR", error: data.error || "Failed to regenerate activity" });
        return;
      }

      const data = await res.json();
      const newActivities = data.activities || [];

      if (newActivities.length > 0) {
        // Replace with first generated activity, preserving the original ID
        const replacement = { ...newActivities[0], id: activityId };
        dispatch({ type: "REPLACE_ACTIVITY", activityId, activity: replacement });
      } else {
        dispatch({ type: "SET_REGENERATING_ACTIVITY", activityId: null });
        dispatch({ type: "SET_ERROR", error: "No replacement activity was generated" });
      }
    } catch (err) {
      dispatch({ type: "SET_REGENERATING_ACTIVITY", activityId: null });
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Network error" });
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      {/* Back link */}
      <button
        onClick={() => router.push("/teacher/units")}
        className="text-xs text-text-secondary hover:text-text-primary transition mb-6 flex items-center gap-1"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Units
      </button>

      <ConversationWizard
        state={state}
        dispatch={dispatch}
        suggestions={suggestions}
        suggestionStatus={suggestionStatus}
        onGenerateOutlines={state.journeyMode ? generateTimelineOutlines : generateOutlines}
        onGenerate={
          state.selectedTimelineOutline !== null
            ? generateAllTimeline
            : state.journeyMode
              ? generateAllJourney
              : generateAll
        }
        onSave={saveUnit}
        onRetryCriterion={handleRetryCriterion}
        onActivityDrop={handleActivityDrop}
        onRegeneratePage={handleRegeneratePage}
        onRegenerateActivity={handleRegenerateActivity}
        onGenerateSkeleton={generateSkeleton}
        onBuildFromSkeleton={generateAllTimelineFromSkeleton}
        onGenerateAdditional={generateAdditionalApproach}
      />

      {/* Activity Browser panel */}
      <ActivityBrowser
        isOpen={state.activityBrowserOpen}
        onClose={() => dispatch({ type: "SET_ACTIVITY_BROWSER", open: false })}
        filterCriterion={
          state.activityBrowserPage
            ? (state.activityBrowserPage.charAt(0) as CriterionKey)
            : undefined
        }
        onInsert={handleActivityInsert}
      />
    </main>
  );
}
