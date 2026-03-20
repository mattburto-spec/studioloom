"use client";

import { useState } from "react";

// =========================================================================
// Constants
// =========================================================================

export const LESSON_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  research: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  ideation: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "skills-demo": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  making: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  testing: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  critique: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

export const LESSON_TYPE_ICONS: Record<string, string> = {
  research: "🔍",
  ideation: "💡",
  "skills-demo": "🛠",
  making: "🏗",
  testing: "🧪",
  critique: "📋",
};

// Phase/criterion colors matching student UI
export const PHASE_COLORS: Record<string, string> = {
  research: "#3B82F6", ideation: "#8B5CF6", planning: "#6366F1",
  "skills-demo": "#F59E0B", making: "#22C55E", testing: "#F97316",
  iteration: "#14B8A6", evaluation: "#F43F5E", critique: "#EC4899",
};

export const CRITERION_COLORS: Record<string, string> = {
  A: "#6366F1", B: "#10B981", C: "#F59E0B", D: "#8B5CF6",
};

const RESPONSE_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  text: { label: "Written Response", icon: "✏️" },
  upload: { label: "File Upload", icon: "📎" },
  voice: { label: "Voice Recording", icon: "🎤" },
  link: { label: "Link Submission", icon: "🔗" },
  multi: { label: "Multiple Choice", icon: "☑️" },
  "decision-matrix": { label: "Decision Matrix", icon: "📊" },
  pmi: { label: "PMI Framework", icon: "➕" },
  pairwise: { label: "Pairwise Comparison", icon: "⚖️" },
  "trade-off-sliders": { label: "Trade-off Sliders", icon: "🎚️" },
};

export type ResultTab = "admin" | "student" | "thinking" | "json";

// =========================================================================
// Main Dispatcher
// =========================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TestResultsView({ result, elapsed }: { result: any; elapsed: number }) {
  const isLessonMode = result?._mode === "lesson";

  if (isLessonMode) {
    return <LessonResultsView result={result} elapsed={elapsed} />;
  }
  return <SkeletonResultsView result={result} elapsed={elapsed} />;
}

// =========================================================================
// Skeleton Results View
// =========================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SkeletonResultsView({ result, elapsed }: { result: any; elapsed: number }) {
  const [activeTab, setActiveTab] = useState<ResultTab>("admin");
  const [selectedLesson, setSelectedLesson] = useState(0);
  const skeleton = result?.skeleton;
  const unit = skeleton?.unit || (skeleton?.lessons ? skeleton : null);
  const lessons = skeleton?.lessons || skeleton?.unit?.lessons;
  const tokens = result?.tokensUsed;
  const thinking = result?.thinking;

  // Compute summary stats
  const totalMinutes = lessons?.reduce((sum: number, l: { estimatedMinutes?: number }) => sum + (l.estimatedMinutes || 0), 0) || 0;
  const typeCounts: Record<string, number> = {};
  const criteriaCovered = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lessons?.forEach((l: any) => {
    if (l.lessonType) typeCounts[l.lessonType] = (typeCounts[l.lessonType] || 0) + 1;
    const criteria = Array.isArray(l.criteriaEmphasis) ? l.criteriaEmphasis : [];
    criteria.forEach((c: string) => criteriaCovered.add(c));
  });

  const tabs: { key: ResultTab; label: string; icon: string; show: boolean }[] = [
    { key: "admin", label: "Admin", icon: "⚙️", show: true },
    { key: "student", label: "Student Preview", icon: "👤", show: !!lessons?.length },
    { key: "thinking", label: "AI Thinking", icon: "💡", show: !!thinking },
    { key: "json", label: "Raw JSON", icon: "{}", show: true },
  ];

  return (
    <div className="mt-4">
      {/* Stats Bar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full text-xs font-medium">
          ⏱ {(elapsed / 1000).toFixed(1)}s
        </span>
        <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
          🔤 {tokens ? `${tokens.input_tokens + tokens.output_tokens} tokens` : "—"}
        </span>
        {lessons?.length > 0 && (
          <>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
              📚 {lessons.length} lessons
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
              ⏱ {totalMinutes}min total
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
              📊 Criteria: {Array.from(criteriaCovered).sort().join(", ") || "—"}
            </span>
          </>
        )}
      </div>

      {/* Lesson Type Distribution */}
      {Object.keys(typeCounts).length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {Object.entries(typeCounts).map(([type, count]) => {
            const tc = LESSON_TYPE_COLORS[type] || { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
            const icon = LESSON_TYPE_ICONS[type] || "📄";
            return (
              <span key={type} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${tc.bg} ${tc.text} border ${tc.border}`}>
                {icon} {type} x{count}
              </span>
            );
          })}
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-0">
        {tabs.filter(t => t.show).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === t.key
                ? "bg-white text-purple-700 border border-gray-200 border-b-white -mb-px"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="border border-t-0 border-gray-200 rounded-b-xl bg-white">

        {/* ── ADMIN VIEW ── */}
        {activeTab === "admin" && lessons?.length && (
          <div className="p-4 space-y-3">
            {/* Unit Card */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-xl p-5 text-white">
              <h4 className="font-bold text-lg mb-1">
                {(unit?.title || "Test Skeleton")?.replace("Test: ", "")}
              </h4>
              <p className="text-purple-200 text-sm mb-3">{unit?.endGoal || ""}</p>
              <div className="flex gap-4 text-xs text-purple-200">
                <span>{lessons.length} lessons</span>
                <span>•</span>
                <span>{totalMinutes}min total</span>
              </div>
              {unit?.narrativeArc && (
                <p className="mt-3 text-xs text-purple-100 leading-relaxed border-t border-purple-500 pt-3">
                  <span className="font-semibold text-purple-200">Narrative Arc: </span>
                  {unit.narrativeArc}
                </p>
              )}
            </div>

            {/* Lesson Cards */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {lessons.map((lesson: any, i: number) => {
              const tc = LESSON_TYPE_COLORS[lesson.lessonType] || { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
              const icon = LESSON_TYPE_ICONS[lesson.lessonType] || "📄";
              return (
                <div key={i} className={`border ${tc.border} rounded-lg overflow-hidden`}>
                  <div className={`${tc.bg} px-4 py-3`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">{lesson.lessonNumber}. {lesson.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tc.bg} ${tc.text} border ${tc.border}`}>
                        {icon} {lesson.lessonType}
                      </span>
                      <span className="text-xs text-gray-500">{lesson.estimatedMinutes}min</span>
                      {lesson.phase && <span className="text-xs text-gray-400">• {lesson.phase}</span>}
                      {(Array.isArray(lesson.criteriaEmphasis) ? lesson.criteriaEmphasis : typeof lesson.criteriaEmphasis === "string" ? [lesson.criteriaEmphasis] : []).map((c: string) => (
                        <span key={c} className="inline-flex items-center justify-center w-5 h-5 rounded bg-white border border-gray-200 text-xs font-bold text-purple-600">{c}</span>
                      ))}
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-2.5 bg-white">
                    {(lesson.drivingQuestion || lesson.keyDrivingQuestion) && (
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Driving Question</span>
                        <p className="text-sm text-gray-700 italic mt-0.5">{lesson.drivingQuestion || lesson.keyDrivingQuestion}</p>
                      </div>
                    )}
                    {lesson.learningIntention && (
                      <div className="bg-purple-50 rounded-lg px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          <span className="text-purple-500 mt-0.5 text-sm">🎯</span>
                          <div className="flex-1">
                            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Learning Intention</span>
                            <p className="text-sm text-purple-900 mt-0.5">{lesson.learningIntention}</p>
                          </div>
                        </div>
                        {lesson.successCriteria?.length > 0 && (
                          <div className="mt-2 ml-6 space-y-1">
                            <span className="text-xs font-semibold text-purple-600">Success Criteria:</span>
                            {lesson.successCriteria.map((sc: string, j: number) => (
                              <div key={j} className="flex items-start gap-1.5 text-xs text-purple-800">
                                <span className="text-purple-400 mt-0.5">✓</span><span>{sc}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex gap-4 flex-wrap">
                      {lesson.cumulativeVocab?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-gray-500">Vocab:</span>
                          {lesson.cumulativeVocab.map((v: string) => (
                            <span key={v} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{v}</span>
                          ))}
                        </div>
                      )}
                      {lesson.cumulativeSkills?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-gray-500">Skills:</span>
                          {lesson.cumulativeSkills.map((s: string) => (
                            <span key={s} className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-xs">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {lesson.activityHints?.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Activities</span>
                        <div className="mt-1.5 space-y-1.5">
                          {lesson.activityHints.map((hint: string, j: number) => (
                            <div key={j} className="flex items-start gap-2">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center mt-0.5">{j + 1}</span>
                              <span className="text-sm text-gray-700">{hint}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── STUDENT PREVIEW ── */}
        {activeTab === "student" && lessons?.length && (
          <div className="flex">
            {/* Mini Sidebar */}
            <div className="w-48 min-h-[400px] bg-gradient-to-b from-[#7B2FF2] to-[#4A0FB0] p-3 flex-shrink-0">
              <div className="mb-4">
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Unit</p>
                <p className="text-xs font-bold text-white leading-tight">
                  {(unit?.title || "Test Skeleton")?.replace("Test: ", "")}
                </p>
                {/* Progress bar */}
                <div className="mt-2 h-1 bg-white/10 rounded-full">
                  <div className="h-1 bg-emerald-400 rounded-full" style={{ width: "0%" }} />
                </div>
              </div>
              <div className="space-y-0.5">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {lessons.map((lesson: any, i: number) => {
                  const isActive = i === selectedLesson;
                  const phaseColor = PHASE_COLORS[lesson.lessonType] || "#9CA3AF";
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedLesson(i)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                        isActive ? "bg-white/15" : "hover:bg-white/5"
                      }`}
                      style={isActive ? { borderLeft: `3px solid ${phaseColor}` } : { borderLeft: "3px solid transparent" }}
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isActive ? "border-white bg-white/20" : "border-white/30"
                      }`}>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span className={`truncate ${isActive ? "text-white font-medium" : "text-white/60"}`}>
                        {lesson.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lesson Content Preview */}
            {(() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const lesson: any = lessons[selectedLesson];
              if (!lesson) return null;
              const criteria = Array.isArray(lesson.criteriaEmphasis) ? lesson.criteriaEmphasis : typeof lesson.criteriaEmphasis === "string" ? [lesson.criteriaEmphasis] : [];
              const pageColor = CRITERION_COLORS[criteria[0]] || PHASE_COLORS[lesson.lessonType] || "#7B2FF2";
              return (
                <div className="flex-1 min-w-0">
                  {/* Hero Header */}
                  <div className="px-8 pt-8 pb-6" style={{ background: `linear-gradient(135deg, ${pageColor}, ${pageColor}dd)` }}>
                    <p className="text-xs font-medium text-white/60 mb-1">Lesson {lesson.lessonNumber} of {lessons.length}</p>
                    <h2 className="text-2xl font-extrabold text-white mb-3">{lesson.title}</h2>
                    <div className="flex gap-2 flex-wrap">
                      {criteria.map((c: string) => (
                        <span key={c} className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-white/20">
                          Criterion {c}
                        </span>
                      ))}
                      {lesson.lessonType && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-white/20">
                          {LESSON_TYPE_ICONS[lesson.lessonType]} {lesson.lessonType}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Learning Objectives Block */}
                  <div className="px-8 py-4" style={{ backgroundColor: `${pageColor}15` }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: `${pageColor}99` }}>
                      Learning Objectives
                    </p>
                    <p className="text-base font-medium leading-relaxed" style={{ color: pageColor }}>
                      {lesson.learningIntention || "Students will explore and develop their understanding..."}
                    </p>
                  </div>

                  {/* Main Content Area */}
                  <div className="px-8 py-6 space-y-6 max-w-2xl">
                    {/* Driving Question */}
                    {(lesson.drivingQuestion || lesson.keyDrivingQuestion) && (
                      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                        <p className="text-sm font-semibold text-blue-900 mb-1">Driving Question</p>
                        <p className="text-sm text-blue-800 italic">{lesson.drivingQuestion || lesson.keyDrivingQuestion}</p>
                      </div>
                    )}

                    {/* Success Criteria */}
                    {lesson.successCriteria?.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Success Criteria</p>
                        <div className="space-y-2">
                          {lesson.successCriteria.map((sc: string, j: number) => (
                            <div key={j} className="flex items-start gap-2.5">
                              <span className="w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0 mt-0.5" />
                              <span className="text-sm text-gray-700">{sc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Vocab Warmup */}
                    {lesson.cumulativeVocab?.length > 0 && (
                      <div className="border border-gray-200 rounded-2xl p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">📖 Vocabulary</p>
                        <div className="flex gap-2 flex-wrap">
                          {lesson.cumulativeVocab.map((v: string) => (
                            <span key={v} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium border border-purple-100">
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Activity Hints as Simulated Activities */}
                    {lesson.activityHints?.length > 0 && (
                      <div className="space-y-4">
                        {lesson.activityHints.map((hint: string, j: number) => (
                          <div key={j}>
                            {/* Section Divider */}
                            <div className="flex items-center justify-center my-4">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: pageColor }}>
                                {j + 1}
                              </div>
                            </div>
                            {/* Activity Card */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                              <p className="text-base font-semibold text-gray-900 mb-2">{hint}</p>
                              <div className="h-1 w-16 rounded-full mb-4" style={{ backgroundColor: pageColor }} />
                              {/* Simulated response area */}
                              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                                <p className="text-xs text-gray-400">Student response area</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Complete Button */}
                    <div className="pt-4 pb-2">
                      <button
                        className="w-full py-3 rounded-xl text-sm font-semibold text-white shadow-lg"
                        style={{ backgroundColor: pageColor }}
                        disabled
                      >
                        Complete & Continue →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── AI THINKING ── */}
        {activeTab === "thinking" && thinking && (
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-500 text-lg">💡</span>
              <span className="text-sm font-semibold text-gray-900">AI Reasoning Process</span>
              <span className="text-xs text-gray-400 ml-auto">
                {thinking.length > 1000 ? `${(thinking.length / 1000).toFixed(1)}k chars` : `${thinking.length} chars`}
              </span>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
              <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{thinking}</p>
            </div>
          </div>
        )}

        {/* ── RAW JSON ── */}
        {activeTab === "json" && (
          <pre className="p-4 text-xs text-gray-700 font-mono whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        {/* Fallback if no lessons parsed */}
        {activeTab === "admin" && !lessons?.length && (
          <div className="p-4">
            <p className="text-sm text-gray-500 mb-2">Could not parse lesson structure. Showing raw output:</p>
            <pre className="bg-gray-50 text-gray-700 text-xs p-4 rounded-lg font-mono whitespace-pre-wrap">
              {JSON.stringify(result?.skeleton || result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// Lesson Results View
// =========================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LessonResultsView({ result, elapsed }: { result: any; elapsed: number }) {
  const [activeTab, setActiveTab] = useState<ResultTab>("admin");
  const lesson = result?.lesson;
  const tokens = result?.tokensUsed;
  const thinking = result?.thinking;

  const sections = lesson?.sections || [];
  const sectionCount = sections.length;
  const responseTypes = sections.map((s: { responseType?: string }) => s.responseType).filter(Boolean);
  const hasScaffolding = sections.some((s: { scaffolding?: unknown }) => s.scaffolding);
  const portfolioCount = sections.filter((s: { portfolioCapture?: boolean }) => s.portfolioCapture).length;

  const tabs: { key: ResultTab; label: string; icon: string; show: boolean }[] = [
    { key: "admin", label: "Content Review", icon: "⚙️", show: true },
    { key: "student", label: "Student Preview", icon: "👤", show: !!lesson },
    { key: "thinking", label: "AI Thinking", icon: "💡", show: !!thinking },
    { key: "json", label: "Raw JSON", icon: "{}", show: true },
  ];

  return (
    <div className="mt-4">
      {/* Stats Bar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full text-xs font-medium">
          ⏱ {(elapsed / 1000).toFixed(1)}s
        </span>
        <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
          🔤 {tokens ? `${tokens.input_tokens + tokens.output_tokens} tokens` : "—"}
        </span>
        {lesson && (
          <>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
              📝 {sectionCount} sections
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
              🎒 {hasScaffolding ? "ELL scaffolding" : "No scaffolding"}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
              📸 {portfolioCount} portfolio captures
            </span>
          </>
        )}
      </div>

      {/* Response Type Distribution */}
      {responseTypes.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {responseTypes.map((rt: string, i: number) => {
            const info = RESPONSE_TYPE_LABELS[rt] || { label: rt, icon: "📄" };
            return (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {info.icon} {info.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-0">
        {tabs.filter(t => t.show).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === t.key
                ? "bg-white text-purple-700 border border-gray-200 border-b-white -mb-px"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="border border-t-0 border-gray-200 rounded-b-xl bg-white">

        {/* ── CONTENT REVIEW (Admin) ── */}
        {activeTab === "admin" && lesson && (
          <div className="p-4 space-y-4">
            {/* Lesson Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-xl p-5 text-white">
              <h4 className="font-bold text-lg mb-1">{lesson.title}</h4>
              <p className="text-purple-200 text-sm">{lesson.learningGoal}</p>
            </div>

            {/* Vocab Warmup */}
            {lesson.vocabWarmup?.terms?.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">📖 Vocabulary Warmup</h5>
                <div className="space-y-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {lesson.vocabWarmup.terms.map((t: any, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-sm font-semibold border border-purple-100 flex-shrink-0">
                        {t.term}
                      </span>
                      <div className="text-sm text-gray-600">
                        <span>{t.definition}</span>
                        {t.example && <span className="text-gray-400 ml-1">— e.g. {t.example}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {lesson.vocabWarmup.activity && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500">Activity: </span>
                    <span className="text-xs font-medium text-purple-600">{lesson.vocabWarmup.activity.type}</span>
                  </div>
                )}
              </div>
            )}

            {/* Introduction */}
            {lesson.introduction?.text && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Introduction</h5>
                <p className="text-sm text-gray-700 leading-relaxed">{lesson.introduction.text}</p>
              </div>
            )}

            {/* Sections — the main content */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {sections.map((section: any, i: number) => {
              const rtInfo = RESPONSE_TYPE_LABELS[section.responseType] || { label: section.responseType, icon: "📄" };
              const criterionTags = section.criterionTags || [];
              return (
                <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Section Header */}
                  <div className="bg-gray-50 px-4 py-3 flex items-center gap-2 flex-wrap">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <span className="text-sm font-semibold text-gray-900 flex-1">Section {i + 1}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {rtInfo.icon} {rtInfo.label}
                    </span>
                    {section.durationMinutes && (
                      <span className="text-xs text-gray-500">{section.durationMinutes}min</span>
                    )}
                    {section.portfolioCapture && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        📸 Portfolio
                      </span>
                    )}
                    {criterionTags.map((c: string) => (
                      <span key={c} className="inline-flex items-center justify-center w-5 h-5 rounded bg-white border border-gray-200 text-xs font-bold text-purple-600">{c}</span>
                    ))}
                  </div>

                  {/* Section Content */}
                  <div className="px-4 py-3 space-y-3">
                    {/* Prompt */}
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Student Prompt</span>
                      <p className="text-sm text-gray-800 mt-1 leading-relaxed whitespace-pre-wrap">{section.prompt}</p>
                    </div>

                    {/* Example Response */}
                    {section.exampleResponse && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Example Response</span>
                        <p className="text-sm text-emerald-800 mt-1 leading-relaxed">{section.exampleResponse}</p>
                      </div>
                    )}

                    {/* ELL Scaffolding */}
                    {section.scaffolding && (
                      <div className="grid grid-cols-3 gap-3">
                        {section.scaffolding.ell1 && (
                          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">ELL 1 — Support</span>
                            {section.scaffolding.ell1.sentenceStarters?.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                {section.scaffolding.ell1.sentenceStarters.map((s: string, j: number) => (
                                  <p key={j} className="text-xs text-blue-800 italic">{s}</p>
                                ))}
                              </div>
                            )}
                            {section.scaffolding.ell1.hints?.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                {section.scaffolding.ell1.hints.map((h: string, j: number) => (
                                  <p key={j} className="text-xs text-blue-700">💡 {h}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {section.scaffolding.ell2 && (
                          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">ELL 2 — Guided</span>
                            {section.scaffolding.ell2.sentenceStarters?.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                {section.scaffolding.ell2.sentenceStarters.map((s: string, j: number) => (
                                  <p key={j} className="text-xs text-amber-800 italic">{s}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {section.scaffolding.ell3 && (
                          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">ELL 3 — Extension</span>
                            {section.scaffolding.ell3.extensionPrompts?.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                {section.scaffolding.ell3.extensionPrompts.map((p: string, j: number) => (
                                  <p key={j} className="text-xs text-emerald-800">🚀 {p}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Reflection */}
            {lesson.reflection && (
              <div className="border border-gray-200 rounded-lg p-4 bg-indigo-50">
                <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">
                  Reflection ({lesson.reflection.type || "short-response"})
                </h5>
                {lesson.reflection.items?.length > 0 && (
                  <div className="space-y-1.5">
                    {lesson.reflection.items.map((item: string, i: number) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-indigo-400 mt-0.5 text-sm">💭</span>
                        <span className="text-sm text-indigo-800">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STUDENT PREVIEW ── */}
        {activeTab === "student" && lesson && (
          <div className="max-w-2xl mx-auto">
            {/* Hero Header */}
            <div className="px-8 pt-8 pb-6 bg-gradient-to-br from-[#7B2FF2] to-[#5B1FD2]">
              <h2 className="text-2xl font-extrabold text-white mb-2">{lesson.title}</h2>
              <p className="text-sm text-purple-200">{lesson.learningGoal}</p>
            </div>

            <div className="px-8 py-6 space-y-6">
              {/* Vocab Warmup */}
              {lesson.vocabWarmup?.terms?.length > 0 && (
                <div className="border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">📖 Vocabulary</p>
                  <div className="flex gap-2 flex-wrap">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {lesson.vocabWarmup.terms.map((t: any) => (
                      <span key={t.term} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium border border-purple-100">
                        {t.term}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Introduction */}
              {lesson.introduction?.text && (
                <p className="text-sm text-gray-700 leading-relaxed">{lesson.introduction.text}</p>
              )}

              {/* Sections */}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {sections.map((section: any, i: number) => {
                const rtInfo = RESPONSE_TYPE_LABELS[section.responseType] || { label: section.responseType, icon: "📄" };
                return (
                  <div key={i}>
                    <div className="flex items-center justify-center my-4">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold bg-[#7B2FF2]">
                        {i + 1}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                      <p className="text-base font-semibold text-gray-900 mb-2 whitespace-pre-wrap">{section.prompt}</p>
                      <div className="h-1 w-16 rounded-full mb-3 bg-[#7B2FF2]" />

                      {/* Scaffolding toggle hint */}
                      {section.scaffolding && (
                        <p className="text-xs text-purple-500 mb-3">💡 Scaffolding available (ELL 1/2/3)</p>
                      )}

                      {/* Response area */}
                      <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                        <p className="text-xs text-gray-400">{rtInfo.icon} {rtInfo.label}</p>
                        {section.durationMinutes && (
                          <p className="text-[10px] text-gray-300 mt-1">~{section.durationMinutes} minutes</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Reflection */}
              {lesson.reflection?.items?.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3">💭 Reflection</p>
                  <div className="space-y-3">
                    {lesson.reflection.items.map((item: string, i: number) => (
                      <div key={i}>
                        <p className="text-sm text-indigo-800 mb-2">{item}</p>
                        <div className="border-2 border-dashed border-indigo-200 rounded-lg p-4 text-center">
                          <p className="text-xs text-indigo-300">Your reflection</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Complete Button */}
              <div className="pt-4 pb-2">
                <button className="w-full py-3 rounded-xl text-sm font-semibold text-white shadow-lg bg-[#7B2FF2]" disabled>
                  Complete & Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── AI THINKING ── */}
        {activeTab === "thinking" && thinking && (
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-500 text-lg">💡</span>
              <span className="text-sm font-semibold text-gray-900">AI Reasoning Process</span>
              <span className="text-xs text-gray-400 ml-auto">
                {thinking.length > 1000 ? `${(thinking.length / 1000).toFixed(1)}k chars` : `${thinking.length} chars`}
              </span>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
              <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{thinking}</p>
            </div>
          </div>
        )}

        {/* ── RAW JSON ── */}
        {activeTab === "json" && (
          <pre className="p-4 text-xs text-gray-700 font-mono whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        {/* Fallback */}
        {activeTab === "admin" && !lesson && (
          <div className="p-4">
            <p className="text-sm text-gray-500 mb-2">Could not parse lesson content. Showing raw output:</p>
            <pre className="bg-gray-50 text-gray-700 text-xs p-4 rounded-lg font-mono whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
