"use client";

import { useState, useRef } from "react";
import Link from "next/link";

const FRAMEWORKS = [
  { value: "IB_MYP", label: "IB MYP Design" },
  { value: "GCSE_DT", label: "AQA/OCR GCSE Design & Technology" },
  { value: "ACARA_DT", label: "Australian Curriculum: Design & Technologies" },
  { value: "PLTW", label: "Project Lead The Way (US)" },
  { value: "A_LEVEL_DT", label: "A-Level Design & Technology" },
  { value: "IGCSE_DT", label: "Cambridge IGCSE Design & Technology" },
] as const;

// Mirrors criteriaNames from src/lib/ai/framework-vocabulary.ts
const FRAMEWORK_CRITERIA: Record<string, { label: string; name: string }[]> = {
  IB_MYP: [
    { label: "A", name: "Inquiring and Analysing" },
    { label: "B", name: "Developing Ideas" },
    { label: "C", name: "Creating the Solution" },
    { label: "D", name: "Evaluating" },
  ],
  GCSE_DT: [
    { label: "AO1", name: "Identify, investigate and outline design possibilities" },
    { label: "AO2", name: "Design and make prototypes that are fit for purpose" },
    { label: "AO3", name: "Analyse and evaluate design decisions and outcomes" },
    { label: "AO4", name: "Demonstrate and apply knowledge and understanding" },
    { label: "AO5", name: "Core technical principles (written exam)" },
  ],
  ACARA_DT: [
    { label: "KU", name: "Knowledge and Understanding" },
    { label: "P&P", name: "Processes and Production Skills" },
  ],
  PLTW: [
    { label: "IED", name: "Introduction to Engineering Design" },
    { label: "POE", name: "Principles of Engineering" },
    { label: "CEA", name: "Civil Engineering and Architecture" },
    { label: "DE", name: "Digital Electronics" },
  ],
  A_LEVEL_DT: [
    { label: "C1", name: "Technical Principles (written exam)" },
    { label: "C2", name: "Designing and Making Principles (written exam)" },
    { label: "C3", name: "Design and Make Task (NEA coursework)" },
  ],
  IGCSE_DT: [
    { label: "AO1", name: "Recall and understanding" },
    { label: "AO2", name: "Handling information and problem solving" },
    { label: "AO3", name: "Design and making skills" },
  ],
};

const FOCUS_LEVELS = [
  { value: "", label: "All Levels" },
  { value: "below", label: "Below" },
  { value: "approaching", label: "Approaching" },
  { value: "meeting", label: "Meeting" },
  { value: "exceeding", label: "Exceeding" },
] as const;

const LEVEL_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  below: { label: "Below Standard", color: "#DC2626", bg: "#FEF2F2" },
  approaching: {
    label: "Approaching Standard",
    color: "#EA580C",
    bg: "#FFF7ED",
  },
  meeting: { label: "Meeting Standard", color: "#16A34A", bg: "#F0FDF4" },
  exceeding: { label: "Exceeding Standard", color: "#2563EB", bg: "#EFF6FF" },
};

type Comments = Record<string, string>;

export default function MarkingCommentCreatorPage() {
  const [email, setEmail] = useState("");
  const [framework, setFramework] = useState("IB_MYP");
  const [criterionMode, setCriterionMode] = useState<"preset" | "custom">(
    "preset"
  );
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>([]);
  const [criterion, setCriterion] = useState("");
  const [studentWork, setStudentWork] = useState("");
  const [focusLevel, setFocusLevel] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{
    comments: Comments;
    remaining: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFrameworkChange(value: string) {
    setFramework(value);
    setSelectedCriteria([]);
  }

  function toggleCriterion(label: string) {
    setSelectedCriteria((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    );
  }

  function buildCriterionString(): string {
    if (criterionMode === "custom") return criterion;
    const frameworkCriteria = FRAMEWORK_CRITERIA[framework] || [];
    const vocab = FRAMEWORKS.find((f) => f.value === framework);
    return selectedCriteria
      .map((label) => {
        const c = frameworkCriteria.find((x) => x.label === label);
        if (!c) return label;
        const termPrefix =
          framework === "IB_MYP" ? "Criterion" : "Assessment Objective";
        return `${termPrefix} ${c.label}: ${c.name} (${vocab?.label || framework})`;
      })
      .join("\n");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setError(null);
    setUploadedFileName(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/tools/extract-rubric", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to extract text from file.");
        return;
      }

      setCriterion(data.text);
      setCriterionMode("custom");
      setUploadedFileName(file.name);
    } catch {
      setError("Failed to upload file. Please try again.");
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const criterionText = buildCriterionString();
    if (!criterionText.trim()) {
      setError(
        criterionMode === "preset"
          ? "Please select at least one criterion."
          : "Please enter a criterion description."
      );
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/tools/marking-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          framework,
          criterion: criterionText,
          studentWork,
          ...(focusLevel ? { focusLevel } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      setResult(data);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyToClipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    }
  }

  function copyAll() {
    if (!result) return;
    const allText = Object.entries(result.comments)
      .map(
        ([level, comment]) =>
          `${LEVEL_CONFIG[level]?.label || level}\n${comment}`
      )
      .join("\n\n");
    copyToClipboard(allText, "all");
  }

  const criteria = FRAMEWORK_CRITERIA[framework] || [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          Marking Comment Creator
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Generate rubric-aligned marking comments at every achievement level.
          Framework-aware for IB MYP, GCSE DT, ACARA, and more.
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleGenerate}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5"
      >
        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email address
          </label>
          <input
            type="email"
            id="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2FF2] focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">
            Required for 20 free uses per month.
          </p>
        </div>

        {/* Framework */}
        <div>
          <label
            htmlFor="framework"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Curriculum framework
          </label>
          <select
            id="framework"
            value={framework}
            onChange={(e) => handleFrameworkChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2FF2] focus:border-transparent bg-white"
          >
            {FRAMEWORKS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Criterion — mode toggle + content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Criterion / rubric description
          </label>

          {/* Mode tabs */}
          <div className="flex gap-1 mb-3 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setCriterionMode("preset")}
              className={`flex-1 text-sm py-1.5 rounded-md transition ${
                criterionMode === "preset"
                  ? "bg-white text-gray-900 shadow-sm font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Select Criterion
            </button>
            <button
              type="button"
              onClick={() => setCriterionMode("custom")}
              className={`flex-1 text-sm py-1.5 rounded-md transition ${
                criterionMode === "custom"
                  ? "bg-white text-gray-900 shadow-sm font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Custom Description
            </button>
          </div>

          {/* Preset mode — checkboxes */}
          {criterionMode === "preset" && (
            <div className="space-y-2">
              {criteria.map((c) => (
                <label
                  key={c.label}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    selectedCriteria.includes(c.label)
                      ? "border-[#7B2FF2] bg-[#7B2FF2]/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCriteria.includes(c.label)}
                    onChange={() => toggleCriterion(c.label)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#7B2FF2] focus:ring-[#7B2FF2]"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {c.label}
                    </span>
                    <span className="text-sm text-gray-500">
                      {" "}
                      — {c.name}
                    </span>
                  </div>
                </label>
              ))}
              {selectedCriteria.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Select one or more criteria to generate comments for.
                </p>
              )}
            </div>
          )}

          {/* Custom mode — textarea + file upload */}
          {criterionMode === "custom" && (
            <div className="space-y-3">
              {/* File upload */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.pptx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isExtracting}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:border-[#7B2FF2] hover:text-[#7B2FF2] transition disabled:opacity-50"
                >
                  {isExtracting ? (
                    <>
                      <Spinner /> Extracting text...
                    </>
                  ) : (
                    <>
                      <UploadIcon /> Upload rubric (PDF, DOCX, PPTX)
                    </>
                  )}
                </button>
                {uploadedFileName && (
                  <span className="ml-2 text-xs text-gray-400">
                    {uploadedFileName}
                  </span>
                )}
              </div>

              {/* Textarea */}
              <textarea
                id="criterion"
                value={criterion}
                onChange={(e) => setCriterion(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Paste or describe the rubric criterion / assessment objective. E.g., 'Criterion B: Developing Ideas — students should generate multiple feasible designs...'"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2FF2] focus:border-transparent resize-y"
              />
              <p className="text-xs text-gray-400 text-right">
                {criterion.length}/2000
              </p>
            </div>
          )}
        </div>

        {/* Student work */}
        <div>
          <label
            htmlFor="studentWork"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Student work description
          </label>
          <textarea
            id="studentWork"
            required
            value={studentWork}
            onChange={(e) => setStudentWork(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Briefly describe what the student did. E.g., 'Student created two design concepts with annotations but did not use user feedback to refine them.'"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2FF2] focus:border-transparent resize-y"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">
            {studentWork.length}/2000
          </p>
        </div>

        {/* Focus level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Achievement level focus{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {FOCUS_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => setFocusLevel(level.value)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  focusLevel === level.value
                    ? "bg-[#7B2FF2] text-white border-[#7B2FF2]"
                    : "bg-white text-gray-600 border-gray-300 hover:border-[#7B2FF2]"
                }`}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-lg text-white font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: isLoading
              ? "#A78BFA"
              : "linear-gradient(135deg, #7B2FF2, #5C16C5)",
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner />
              Generating comments...
            </span>
          ) : (
            "Generate Marking Comments"
          )}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Generated Comments
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                {result.remaining} of 20 free uses remaining
              </span>
              <button
                onClick={copyAll}
                className="text-sm font-medium text-[#7B2FF2] hover:underline flex items-center gap-1"
              >
                {copied === "all" ? (
                  <>
                    <CheckIcon /> Copied!
                  </>
                ) : (
                  "Copy all"
                )}
              </button>
            </div>
          </div>

          {Object.entries(result.comments).map(([level, comment]) => {
            const config = LEVEL_CONFIG[level];
            if (!config) return null;
            return (
              <div
                key={level}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                <div className="flex items-start">
                  <div
                    className="w-1.5 self-stretch flex-shrink-0"
                    style={{ backgroundColor: config.color }}
                  />
                  <div className="flex-1 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: config.color,
                          backgroundColor: config.bg,
                        }}
                      >
                        {config.label}
                      </span>
                      <button
                        onClick={() => copyToClipboard(comment, level)}
                        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition"
                      >
                        {copied === level ? (
                          <>
                            <CheckIcon /> Copied!
                          </>
                        ) : (
                          <>
                            <CopyIcon /> Copy
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {comment}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CTA */}
      <div className="mt-10 text-center bg-gradient-to-r from-[#7B2FF2]/5 to-[#5C16C5]/5 rounded-xl border border-[#7B2FF2]/20 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Want unlimited uses and more AI tools?
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Create a free Questerra account to unlock unlimited comment
          generation, AI unit building, and student mentoring.
        </p>
        <Link
          href="/teacher/login"
          className="inline-block px-6 py-2.5 rounded-lg text-white font-semibold text-sm transition hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
          }}
        >
          Create free account
        </Link>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
