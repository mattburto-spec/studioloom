"use client";

interface ExtractedBlock {
  tempId: string;
  title: string;
  description: string;
  bloom_level: string;
  time_weight: string;
  activity_category: string;
  phase: string;
}

interface Lesson {
  title: string;
  learningGoal: string;
  blocks: ExtractedBlock[];
  matchPercentage: number;
  originalIndex: number;
}

interface MatchReportProps {
  lessons: Lesson[];
  overallMatchPercentage: number;
  totalBlocks: number;
  unmatchedBlocks: ExtractedBlock[];
  metadata: {
    detectedLessonCount: number;
    sequenceConfidence: number;
    assessmentPoints: number[];
  };
  onAccept: () => void;
  onReject: () => void;
}

function getMatchColor(pct: number): string {
  if (pct >= 80) return "text-emerald-600 bg-emerald-50";
  if (pct >= 50) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

export default function MatchReport({ lessons, overallMatchPercentage, totalBlocks, unmatchedBlocks, metadata, onAccept, onReject }: MatchReportProps) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Reconstruction Report</h3>
          <span className={`text-lg font-bold px-3 py-1 rounded-lg ${getMatchColor(overallMatchPercentage)}`}>
            {overallMatchPercentage}% match
          </span>
        </div>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{metadata.detectedLessonCount}</div>
            <div className="text-xs text-gray-500">Lessons</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalBlocks}</div>
            <div className="text-xs text-gray-500">Activities</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{(metadata.sequenceConfidence * 100).toFixed(0)}%</div>
            <div className="text-xs text-gray-500">Sequence Confidence</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{metadata.assessmentPoints.length}</div>
            <div className="text-xs text-gray-500">Assessment Points</div>
          </div>
        </div>
      </div>

      {/* Per-lesson breakdown */}
      <div className="space-y-3">
        {lessons.map((lesson, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400">L{i + 1}</span>
                <h4 className="text-sm font-semibold text-gray-900">{lesson.title}</h4>
                {metadata.assessmentPoints.includes(i) && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Assessment</span>
                )}
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getMatchColor(lesson.matchPercentage)}`}>
                {lesson.matchPercentage}%
              </span>
            </div>
            {lesson.learningGoal && (
              <p className="text-xs text-gray-500 mb-2 italic">{lesson.learningGoal}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {lesson.blocks.map((block) => (
                <div key={block.tempId} className="text-xs bg-gray-50 rounded px-2 py-1 border border-gray-100">
                  <span className="font-medium text-gray-700">{block.title}</span>
                  <span className="text-gray-400 ml-1">{block.bloom_level}</span>
                  <span className="text-gray-400 ml-1">{block.time_weight}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Unmatched blocks */}
      {unmatchedBlocks.length > 0 && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <h4 className="text-sm font-semibold text-amber-700 mb-2">
            {unmatchedBlocks.length} Unmatched Blocks
          </h4>
          <div className="flex gap-2 flex-wrap">
            {unmatchedBlocks.map((block) => (
              <span key={block.tempId} className="text-xs bg-white rounded px-2 py-1 border border-amber-200 text-amber-700">
                {block.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onAccept}
          className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
        >
          Accept & Create Unit
        </button>
        <button
          onClick={onReject}
          className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
