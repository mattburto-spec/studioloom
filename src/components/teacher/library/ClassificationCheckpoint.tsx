"use client";

import { useState } from "react";

// =========================================================================
// Types
// =========================================================================

interface ClassificationCheckpointProps {
  classification: {
    documentType: string;
    confidences: {
      documentType: number;
      subject?: number;
      strand?: number;
      level?: number;
    };
    topic: string;
    detectedSubject?: string;
    detectedStrand?: string;
    detectedLevel?: string;
  };
  sectionCount: number;
  sectionHeadings: string[];
  documentTitle: string;
  correctionsUsed: number;
  onConfirm: (corrections?: {
    correctedDocumentType?: string;
    correctedSubject?: string;
    correctedGradeLevel?: string;
    correctedSectionCount?: number;
    correctionNote?: string;
  }) => void;
  onReject: () => void;
}

// =========================================================================
// Constants
// =========================================================================

const DOCUMENT_TYPE_OPTIONS = [
  { value: "lesson_plan", label: "Lesson Plan" },
  { value: "scheme_of_work", label: "Scheme of Work" },
  { value: "rubric", label: "Rubric" },
  { value: "resource", label: "Resource" },
  { value: "textbook_extract", label: "Textbook Extract" },
  { value: "worksheet", label: "Worksheet" },
  { value: "unknown", label: "Unknown" },
];

const COLLAPSED_SECTION_LIMIT = 6;

// =========================================================================
// Helpers
// =========================================================================

function formatDocumentType(type: string): string {
  const match = DOCUMENT_TYPE_OPTIONS.find((opt) => opt.value === type);
  return match ? match.label : type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function getConfidenceColor(value: number): string {
  if (value >= 0.8) return "text-emerald-600";
  if (value >= 0.5) return "text-amber-600";
  return "text-red-500";
}

// =========================================================================
// Sub-components
// =========================================================================

function InfoIcon() {
  return (
    <svg
      className="w-4 h-4 text-blue-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function FactRow({
  label,
  value,
  confidence,
}: {
  label: string;
  value: string | undefined;
  confidence?: number;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{value}</span>
        {confidence !== undefined && (
          <span
            className={`text-[11px] font-medium ${getConfidenceColor(confidence)}`}
          >
            {formatConfidence(confidence)}
          </span>
        )}
      </span>
    </div>
  );
}

// =========================================================================
// Component
// =========================================================================

export default function ClassificationCheckpoint({
  classification,
  sectionCount,
  sectionHeadings,
  documentTitle,
  correctionsUsed,
  onConfirm,
  onReject,
}: ClassificationCheckpointProps) {
  const [showCorrections, setShowCorrections] = useState(false);
  const [showAllSections, setShowAllSections] = useState(false);

  // Correction form state
  const [correctedDocType, setCorrectedDocType] = useState(classification.documentType);
  const [correctedSubject, setCorrectedSubject] = useState(classification.detectedSubject ?? "");
  const [correctedGradeLevel, setCorrectedGradeLevel] = useState(classification.detectedLevel ?? "");
  const [correctedSectionCount, setCorrectedSectionCount] = useState(sectionCount);
  const [correctionNote, setCorrectionNote] = useState("");

  const needsCollapse = sectionHeadings.length > COLLAPSED_SECTION_LIMIT;
  const visibleSections =
    showAllSections || !needsCollapse
      ? sectionHeadings
      : sectionHeadings.slice(0, COLLAPSED_SECTION_LIMIT);

  function handleConfirmCorrections() {
    onConfirm({
      correctedDocumentType:
        correctedDocType !== classification.documentType ? correctedDocType : undefined,
      correctedSubject:
        correctedSubject !== (classification.detectedSubject ?? "")
          ? correctedSubject
          : undefined,
      correctedGradeLevel:
        correctedGradeLevel !== (classification.detectedLevel ?? "")
          ? correctedGradeLevel
          : undefined,
      correctedSectionCount:
        correctedSectionCount !== sectionCount ? correctedSectionCount : undefined,
      correctionNote: correctionNote.trim() || undefined,
    });
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 shadow-sm overflow-hidden">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="px-5 py-3.5 border-b border-blue-100 flex items-center gap-2">
        <InfoIcon />
        <h3 className="text-sm font-semibold text-gray-900">
          Classification Checkpoint
        </h3>
        {correctionsUsed > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
            Learning from {correctionsUsed} previous correction{correctionsUsed > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-4">
        {/* Document title */}
        <p className="text-sm text-gray-600">
          Analysed{" "}
          <span className="font-semibold text-gray-900">{documentTitle}</span>
        </p>

        {/* Key facts grid */}
        <div className="bg-white rounded-lg border border-blue-100 px-4 py-2 divide-y divide-gray-100">
          <FactRow
            label="Document Type"
            value={formatDocumentType(classification.documentType)}
            confidence={classification.confidences.documentType}
          />
          <FactRow
            label="Subject"
            value={classification.detectedSubject}
            confidence={classification.confidences.subject}
          />
          <FactRow
            label="Grade Level"
            value={classification.detectedLevel}
            confidence={classification.confidences.level}
          />
          <FactRow
            label="Sections / Lessons"
            value={String(sectionCount)}
          />
        </div>

        {/* Section headings (collapsible) */}
        {sectionHeadings.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">
              Detected Sections
            </p>
            <ul className="space-y-1">
              {visibleSections.map((heading, i) => (
                <li
                  key={i}
                  className="text-xs text-gray-700 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-purple-300"
                >
                  {heading}
                </li>
              ))}
            </ul>
            {needsCollapse && (
              <button
                onClick={() => setShowAllSections(!showAllSections)}
                className="text-xs font-medium text-purple-600 hover:text-purple-700 mt-1.5"
              >
                {showAllSections
                  ? "Show fewer"
                  : `Show all ${sectionHeadings.length} sections`}
              </button>
            )}
          </div>
        )}

        {/* ── Action buttons ──────────────────────────────── */}
        {!showCorrections && (
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => onConfirm()}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Looks Right
            </button>
            <button
              onClick={() => setShowCorrections(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Something&apos;s Wrong
            </button>
          </div>
        )}

        {/* ── Correction form ─────────────────────────────── */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            showCorrections ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-700 mb-1">
              Correct the classification
            </p>

            {/* Document type dropdown */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Document Type
              </label>
              <select
                value={correctedDocType}
                onChange={(e) => setCorrectedDocType(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={correctedSubject}
                onChange={(e) => setCorrectedSubject(e.target.value)}
                placeholder="e.g. Design & Technology"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Grade level */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Grade Level
              </label>
              <input
                type="text"
                value={correctedGradeLevel}
                onChange={(e) => setCorrectedGradeLevel(e.target.value)}
                placeholder="e.g. Year 9, Grade 10, MYP 4"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Expected lesson count */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Expected Lesson Count
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={correctedSectionCount}
                onChange={(e) => setCorrectedSectionCount(Number(e.target.value))}
                className="w-24 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Note (optional)
              </label>
              <textarea
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                rows={2}
                placeholder="e.g., This teacher always has 3 lessons per week"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Correction actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleConfirmCorrections}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors shadow-sm"
              >
                Continue with Corrections
              </button>
              <button
                onClick={() => setShowCorrections(false)}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* ── Reject (cancel import) ──────────────────────── */}
        <div className="text-right">
          <button
            onClick={onReject}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Cancel import
          </button>
        </div>
      </div>
    </div>
  );
}
