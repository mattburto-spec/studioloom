"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  RATING_CATEGORIES,
  FRAMEWORKS,
  REPORTING_PERIODS,
  type FrameworkId,
  type ReportingPeriod,
  type StudentRow,
  type BulkResponse,
} from "@/lib/tools/report-writer-types";

// ─── Constants ───────────────────────────────────────────────────────────────

const SUBJECTS = [
  "Design & Technology",
  "Product Design",
  "Engineering Design",
  "Digital Technologies",
  "Visual Communication Design",
  "Textiles & Fashion",
  "Food Technology",
  "Architecture & Design",
];

const GRADE_LEVELS = [6, 7, 8, 9, 10, 11, 12, 13];

type Phase = "editing" | "generating" | "results";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 0;
function newId() {
  return `s_${Date.now()}_${++_idCounter}`;
}

function makeStudent(
  firstName = "",
  pronouns: "he" | "she" | "they" = "she"
): StudentRow {
  return { id: newId(), firstName, pronouns, ratings: {}, notes: "" };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReportWriterPage() {
  // Setup state
  const [email, setEmail] = useState("");
  const [framework, setFramework] = useState<FrameworkId>("general");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [gradeLevel, setGradeLevel] = useState("");
  const [tone, setTone] = useState<"formal" | "friendly">("formal");
  const [wordCount, setWordCount] = useState<50 | 100 | 150>(100);
  const [reportingPeriod, setReportingPeriod] = useState<ReportingPeriod | "">("");
  const [projects, setProjects] = useState<string[]>([]);
  const [projectInput, setProjectInput] = useState("");

  // Active categories (columns in the rating table, starts empty)
  const [activeCategories, setActiveCategories] = useState<string[]>([]);

  // Category picker dropdown
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showCategoryPicker) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCategoryPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCategoryPicker]);

  // Student data
  const [students, setStudents] = useState<StudentRow[]>([]);

  // Phase + progress
  const [phase, setPhase] = useState<Phase>("editing");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Results
  const [results, setResults] = useState<
    { firstName: string; report: string; error?: string }[]
  >([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // ─── Add category column ──────────────────────────────────────────────────

  function addCategory(cat: string) {
    if (activeCategories.includes(cat)) return;
    setActiveCategories((prev) => [...prev, cat]);
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        ratings: { ...s.ratings, [cat]: 3 },
      }))
    );
    setShowCategoryPicker(false);
  }

  function removeCategory(cat: string) {
    setActiveCategories((prev) => prev.filter((c) => c !== cat));
    setStudents((prev) =>
      prev.map((s) => {
        const { [cat]: _, ...rest } = s.ratings;
        return { ...s, ratings: rest };
      })
    );
  }

  function handleFrameworkChange(newFramework: FrameworkId) {
    setFramework(newFramework);
    // Clear active categories since they belong to the old framework
    // Keep project ratings intact
    setActiveCategories([]);
    setStudents((prev) =>
      prev.map((s) => {
        const projectRatings: Record<string, number> = {};
        for (const p of projects) {
          if (s.ratings[p] != null) projectRatings[p] = s.ratings[p];
        }
        return { ...s, ratings: projectRatings };
      })
    );
  }

  // ─── Project management ────────────────────────────────────────────────────

  function addProject(name: string) {
    const trimmed = name.trim();
    if (!trimmed || projects.includes(trimmed) || projects.length >= 4) return;
    setProjects((prev) => [...prev, trimmed]);
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        ratings: { ...s.ratings, [trimmed]: 3 },
      }))
    );
  }

  function removeProject(name: string) {
    setProjects((prev) => prev.filter((p) => p !== name));
    setStudents((prev) =>
      prev.map((s) => {
        const { [name]: _, ...rest } = s.ratings;
        return { ...s, ratings: rest };
      })
    );
  }

  const availableCategories = Object.entries(RATING_CATEGORIES[framework])
    .map(([group, cats]) => ({
      group,
      cats: cats.filter((c) => !activeCategories.includes(c)),
    }))
    .filter((g) => g.cats.length > 0);

  // ─── Excel upload ──────────────────────────────────────────────────────────

  async function handleFileUpload(file: File) {
    setError(null);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const sheet = wb.getWorksheet("Students") || wb.worksheets[0];
      if (!sheet) {
        setError("Could not find a worksheet in the uploaded file.");
        return;
      }

      const rows: StudentRow[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const name = String(row.getCell(1).value || "").trim();
        if (!name) return;
        const rawPronoun = String(row.getCell(2).value || "she")
          .trim()
          .toLowerCase();
        const pronouns = (["he", "she", "they"].includes(rawPronoun)
          ? rawPronoun
          : "she") as "he" | "she" | "they";
        const s = makeStudent(name, pronouns);
        // Apply existing active categories and projects
        for (const cat of activeCategories) s.ratings[cat] = 3;
        for (const proj of projects) s.ratings[proj] = 3;
        rows.push(s);
      });

      if (rows.length === 0) {
        setError("No student names found in the uploaded file.");
        return;
      }

      setStudents(rows);
    } catch {
      setError("Failed to read the Excel file. Please use the template.");
    }
  }

  // ─── Rating update ─────────────────────────────────────────────────────────

  const updateRating = useCallback(
    (studentId: string, category: string, value: number) => {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? { ...s, ratings: { ...s.ratings, [category]: value } }
            : s
        )
      );
    },
    []
  );

  const updateStudent = useCallback(
    (studentId: string, field: keyof StudentRow, value: string) => {
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, [field]: value } : s))
      );
    },
    []
  );

  const removeStudent = useCallback((studentId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
  }, []);

  // ─── Generate all ──────────────────────────────────────────────────────────

  async function handleGenerate() {
    const validStudents = students.filter((s) => s.firstName.trim());
    if (validStudents.length === 0) {
      setError("Add at least one student with a name.");
      return;
    }
    if (activeCategories.length === 0 && projects.length === 0) {
      setError("Add at least one rating category or project before generating.");
      return;
    }
    if (!email.trim()) {
      setError("Email address is required.");
      return;
    }
    if (!gradeLevel.trim()) {
      setError("Grade / year level is required.");
      return;
    }

    setPhase("generating");
    setError(null);
    setResults([]);
    setProgress({ done: 0, total: validStudents.length });

    const allResults: { firstName: string; report: string; error?: string }[] =
      [];
    let lastRemaining = 0;

    const chunks: StudentRow[][] = [];
    for (let i = 0; i < validStudents.length; i += 10) {
      chunks.push(validStudents.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      try {
        const res = await fetch("/api/tools/report-writer/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            subject,
            gradeLevel,
            reportingPeriod: reportingPeriod || undefined,
            projects: projects.length > 0 ? projects : undefined,
            tone,
            wordCount,
            categories: activeCategories,
            students: chunk.map((s) => ({
              firstName: s.firstName,
              pronouns: s.pronouns,
              ratings: s.ratings,
              notes: s.notes,
            })),
          }),
        });

        const data: BulkResponse = await res.json();

        if (!res.ok) {
          for (const s of chunk) {
            allResults.push({
              firstName: s.firstName,
              report: "",
              error:
                (data as unknown as { error: string }).error ||
                "Request failed",
            });
          }
        } else {
          for (const r of data.reports) {
            allResults.push({
              firstName: r.firstName,
              report: r.report || "",
              error: r.error,
            });
          }
          lastRemaining = data.remaining;
        }
      } catch {
        for (const s of chunk) {
          allResults.push({
            firstName: s.firstName,
            report: "",
            error: "Network error",
          });
        }
      }

      setProgress({ done: allResults.length, total: validStudents.length });
    }

    setResults(allResults);
    setRemaining(lastRemaining);
    setPhase("results");
  }

  // ─── Regenerate single ────────────────────────────────────────────────────

  async function handleRegenerate(idx: number) {
    const student = students[idx];
    if (!student) return;

    setResults((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, error: "Regenerating..." } : r))
    );

    try {
      const res = await fetch("/api/tools/report-writer/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          subject,
          gradeLevel,
          reportingPeriod: reportingPeriod || undefined,
          projects: projects.length > 0 ? projects : undefined,
          tone,
          wordCount,
          categories: activeCategories,
          students: [
            {
              firstName: student.firstName,
              pronouns: student.pronouns,
              ratings: student.ratings,
              notes: student.notes,
            },
          ],
        }),
      });

      const data: BulkResponse = await res.json();
      if (res.ok && data.reports[0]) {
        setResults((prev) =>
          prev.map((r, i) =>
            i === idx
              ? {
                  ...r,
                  report: data.reports[0].report || r.report,
                  error: data.reports[0].error,
                }
              : r
          )
        );
        setRemaining(data.remaining);
      }
    } catch {
      setResults((prev) =>
        prev.map((r, i) =>
          i === idx ? { ...r, error: "Regeneration failed" } : r
        )
      );
    }
  }

  // ─── Copy helpers ──────────────────────────────────────────────────────────

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  async function copyOne(idx: number) {
    await copyText(results[idx].report);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  async function copyAll() {
    const text = results
      .filter((r) => r.report)
      .map((r) => `${r.firstName}\n${r.report}`)
      .join("\n\n---\n\n");
    await copyText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  // ─── Word doc download ────────────────────────────────────────────────────

  async function downloadWord() {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } =
      await import("docx");

    const children: InstanceType<typeof Paragraph>[] = [];
    const successfulReports = results.filter((r) => r.report);

    successfulReports.forEach((r, i) => {
      children.push(
        new Paragraph({
          text: r.firstName,
          heading: HeadingLevel.HEADING_2,
        })
      );
      children.push(
        new Paragraph({
          children: [new TextRun({ text: r.report, size: 22 })],
          spacing: { after: 200 },
        })
      );
      if (i < successfulReports.length - 1) {
        children.push(
          new Paragraph({
            children: [new PageBreak()],
          })
        );
      }
    });

    const doc = new Document({
      sections: [{ properties: {}, children }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${subject.toLowerCase().replace(/\s+/g, "-")}-${gradeLevel.toLowerCase().replace(/\s+/g, "-")}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const validStudentCount = students.filter((s) => s.firstName.trim()).length;
  const showTable = students.length > 0 && phase === "editing";

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          Report Writer
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Generate personalised report comments for your whole class. Upload
          student names, rate each student, and download as a Word document.
        </p>
      </div>

      {/* ─── Settings (always visible in editing phase) ─────────────────────── */}
      {phase === "editing" && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
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
                className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2FF2] focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">
                20 free reports per month — each student counts as 1 use.
              </p>
            </div>

            {/* Framework + Subject + Grade */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="framework"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Framework
                </label>
                <select
                  id="framework"
                  value={framework}
                  onChange={(e) =>
                    handleFrameworkChange(e.target.value as FrameworkId)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2FF2] focus:border-transparent bg-white"
                >
                  {FRAMEWORKS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="subject"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Subject
                </label>
                <select
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2FF2] focus:border-transparent bg-white"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="gradeLevel"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Year / Grade level
                </label>
                <select
                  id="gradeLevel"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2FF2] focus:border-transparent bg-white"
                >
                  <option value="">Select</option>
                  {GRADE_LEVELS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tone + Length */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tone
                </label>
                <div className="flex gap-2">
                  {(["formal", "friendly"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTone(t)}
                      className={`flex-1 py-2 rounded-lg text-sm border transition capitalize ${
                        tone === t
                          ? "bg-[#7B2FF2] text-white border-[#7B2FF2]"
                          : "bg-white text-gray-600 border-gray-300 hover:border-[#7B2FF2]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Length
                </label>
                <div className="flex gap-2">
                  {([50, 100, 150] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWordCount(w)}
                      className={`flex-1 py-2 rounded-lg text-sm border transition ${
                        wordCount === w
                          ? "bg-[#7B2FF2] text-white border-[#7B2FF2]"
                          : "bg-white text-gray-600 border-gray-300 hover:border-[#7B2FF2]"
                      }`}
                    >
                      ~{w} words
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reporting period */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reporting period{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <select
                  value={reportingPeriod}
                  onChange={(e) =>
                    setReportingPeriod(e.target.value as ReportingPeriod | "")
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2FF2] focus:border-transparent"
                >
                  <option value="">Select period</option>
                  {REPORTING_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Projects / Units (optional, up to 4) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Projects / Units{" "}
                <span className="font-normal text-gray-400">
                  (optional, up to 4)
                </span>
              </label>
              {projects.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {projects.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                    >
                      {p}
                      <button
                        type="button"
                        onClick={() => removeProject(p)}
                        className="text-blue-400 hover:text-red-500 transition"
                      >
                        <XIcon size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {projects.length < 4 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addProject(projectInput);
                    setProjectInput("");
                  }}
                  className="flex gap-2 max-w-md"
                >
                  <input
                    type="text"
                    value={projectInput}
                    onChange={(e) => setProjectInput(e.target.value)}
                    placeholder='e.g. "Sustainable Chair", "Arcade Game"'
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2FF2] focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={!projectInput.trim()}
                    className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </form>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Each project becomes a rated column — the AI will comment on
                how each student performed on each project.
              </p>
            </div>

            {/* Add students */}
            <div className="border-t border-gray-100 pt-5">
              <p className="text-sm font-medium text-gray-700 mb-1">
                {students.length > 0
                  ? `${students.length} student${students.length !== 1 ? "s" : ""} loaded`
                  : "Add your students"}
              </p>
              <p className="text-xs text-gray-400 mb-3">
                Only first names are needed. No student data is stored — names
                are used only to generate your reports and are not saved.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="/api/tools/report-writer/template"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:border-[#7B2FF2] hover:text-[#7B2FF2] transition"
                >
                  <DownloadIcon /> Download Excel Template
                </a>
                <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer transition hover:opacity-90 bg-gradient-to-r from-[#7B2FF2] to-[#5C16C5]">
                  <UploadIcon /> Upload Student List
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {students.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const s = makeStudent();
                      for (const cat of activeCategories) s.ratings[cat] = 3;
                      for (const proj of projects) s.ratings[proj] = 3;
                      setStudents([s]);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:border-[#7B2FF2] hover:text-[#7B2FF2] transition"
                  >
                    + Add manually
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* ─── Student Rating Table (below settings) ──────────────────────── */}
          {showTable && (
            <div className="mt-6 space-y-4">
              {/* Scrollable table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-3 py-2 font-medium text-gray-700 sticky left-0 bg-gray-50 min-w-[120px]">
                        Name
                      </th>
                      <th className="text-center px-2 py-2 font-medium text-gray-700 min-w-[80px]">
                        Pronouns
                      </th>
                      {/* Project columns (blue) */}
                      {projects.map((proj) => (
                        <th
                          key={`proj-${proj}`}
                          className="text-center px-2 py-2 font-medium text-blue-700 bg-blue-50/50 min-w-[110px]"
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-xs">{proj}</span>
                            <button
                              type="button"
                              onClick={() => removeProject(proj)}
                              className="text-blue-300 hover:text-red-400 transition ml-0.5"
                              title={`Remove ${proj}`}
                            >
                              <XIcon size={10} />
                            </button>
                          </div>
                        </th>
                      ))}
                      {/* Skill category columns (gray) */}
                      {activeCategories.map((cat) => (
                        <th
                          key={cat}
                          className="text-center px-2 py-2 font-medium text-gray-600 min-w-[110px]"
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-xs">{cat}</span>
                            <button
                              type="button"
                              onClick={() => removeCategory(cat)}
                              className="text-gray-300 hover:text-red-400 transition ml-0.5"
                              title={`Remove ${cat}`}
                            >
                              <XIcon size={10} />
                            </button>
                          </div>
                        </th>
                      ))}
                      {/* Add column button */}
                      <th className="text-center px-2 py-2 min-w-[60px] relative">
                        <div className="relative" ref={pickerRef}>
                          <button
                            type="button"
                            onClick={() =>
                              setShowCategoryPicker(!showCategoryPicker)
                            }
                            className="w-8 h-8 rounded-lg border-2 border-dashed border-[#7B2FF2]/40 text-[#7B2FF2] hover:border-[#7B2FF2] hover:bg-[#7B2FF2]/5 transition flex items-center justify-center mx-auto text-lg font-light"
                            title="Add rating category"
                          >
                            +
                          </button>
                          {showCategoryPicker && (
                              <div className="absolute right-0 top-10 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-2 w-56 max-h-96 overflow-y-auto">
                                {availableCategories.map(({ group, cats }) => (
                                  <div key={group}>
                                    <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                      {group}
                                    </p>
                                    {cats.map((cat) => (
                                      <button
                                        key={cat}
                                        type="button"
                                        onClick={() => addCategory(cat)}
                                        className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-[#7B2FF2]/5 hover:text-[#7B2FF2] transition"
                                      >
                                        {cat}
                                      </button>
                                    ))}
                                  </div>
                                ))}
                                {availableCategories.length === 0 && (
                                  <p className="px-3 py-1 text-xs text-gray-400">
                                    All preset categories added
                                  </p>
                                )}
                                {/* Custom category input */}
                                <div className="border-t border-gray-100 mt-1 pt-1 px-2">
                                  <form
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      const val = customCategoryInput.trim();
                                      if (val && !activeCategories.includes(val)) {
                                        addCategory(val);
                                        setCustomCategoryInput("");
                                      }
                                    }}
                                  >
                                    <input
                                      type="text"
                                      value={customCategoryInput}
                                      onChange={(e) =>
                                        setCustomCategoryInput(e.target.value)
                                      }
                                      placeholder="Add custom..."
                                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#7B2FF2] focus:border-transparent"
                                      onMouseDown={(e) => e.stopPropagation()}
                                    />
                                  </form>
                                </div>
                              </div>
                            )}
                        </div>
                      </th>
                      <th className="text-left px-2 py-2 font-medium text-gray-700 min-w-[120px]">
                        Notes
                      </th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr
                        key={student.id}
                        className="border-b border-gray-100 hover:bg-gray-50/50"
                      >
                        <td className="px-3 py-2 sticky left-0 bg-white">
                          <input
                            type="text"
                            value={student.firstName}
                            onChange={(e) =>
                              updateStudent(
                                student.id,
                                "firstName",
                                e.target.value
                              )
                            }
                            placeholder="First name"
                            className="w-full border-0 bg-transparent text-sm focus:outline-none focus:ring-0 p-0"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <select
                            value={student.pronouns}
                            onChange={(e) =>
                              updateStudent(
                                student.id,
                                "pronouns",
                                e.target.value
                              )
                            }
                            className="border-0 bg-transparent text-xs text-center focus:outline-none focus:ring-0 p-0"
                          >
                            <option value="she">she</option>
                            <option value="he">he</option>
                            <option value="they">they</option>
                          </select>
                        </td>
                        {/* Project ratings (blue tint) */}
                        {projects.map((proj) => (
                          <td
                            key={`proj-${proj}`}
                            className="px-2 py-2 text-center bg-blue-50/30"
                          >
                            <RatingSlider
                              value={student.ratings[proj] ?? 3}
                              onChange={(v) =>
                                updateRating(student.id, proj, v)
                              }
                            />
                          </td>
                        ))}
                        {/* Skill category ratings */}
                        {activeCategories.map((cat) => (
                          <td key={cat} className="px-2 py-2 text-center">
                            <RatingSlider
                              value={student.ratings[cat] ?? 3}
                              onChange={(v) =>
                                updateRating(student.id, cat, v)
                              }
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2"></td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={student.notes}
                            onChange={(e) =>
                              updateStudent(student.id, "notes", e.target.value)
                            }
                            placeholder="Optional"
                            className="w-full border-0 bg-transparent text-xs focus:outline-none focus:ring-0 p-0"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeStudent(student.id)}
                            className="text-gray-300 hover:text-red-500 transition"
                            title="Remove student"
                          >
                            <XIcon />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {activeCategories.length === 0 && projects.length === 0 && (
                  <div className="px-4 py-6 text-center border-t border-gray-100">
                    <p className="text-sm text-gray-400">
                      Add projects above or click the{" "}
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded border-2 border-dashed border-[#7B2FF2]/40 text-[#7B2FF2] text-xs font-light align-middle mx-0.5">
                        +
                      </span>{" "}
                      button in the header to add rating categories as columns
                    </p>
                  </div>
                )}
              </div>

              {/* Add student + Generate */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      const s = makeStudent();
                      for (const cat of activeCategories) s.ratings[cat] = 3;
                      for (const proj of projects) s.ratings[proj] = 3;
                      setStudents((prev) => [...prev, s]);
                    }}
                    className="text-sm text-[#7B2FF2] hover:text-[#5C16C5] transition font-medium"
                  >
                    + Add student
                  </button>
                  <div className="flex items-center gap-4">
                    <p className="text-xs text-gray-400">
                      {validStudentCount} student
                      {validStudentCount !== 1 ? "s" : ""} ={" "}
                      {validStudentCount} use
                      {validStudentCount !== 1 ? "s" : ""}
                    </p>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={
                        validStudentCount === 0 ||
                        (activeCategories.length === 0 && projects.length === 0)
                      }
                      className="px-6 py-2.5 rounded-lg text-white font-semibold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                      style={{
                        background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                      }}
                    >
                      Generate All Reports
                    </button>
                  </div>
                </div>
                {error && (
                  <p className="text-xs text-red-500 text-right">{error}</p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Generating ─────────────────────────────────────────────────────── */}
      {phase === "generating" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <Spinner className="w-8 h-8 mx-auto mb-4 text-[#7B2FF2]" />
          <p className="text-lg font-medium text-gray-800 mb-2">
            Generating reports...
          </p>
          <p className="text-sm text-gray-500 mb-4">
            {progress.done} of {progress.total} complete
          </p>
          <div className="w-full max-w-md mx-auto bg-gray-100 rounded-full h-2">
            <div
              className="bg-[#7B2FF2] h-2 rounded-full transition-all duration-300"
              style={{
                width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ─── Results ────────────────────────────────────────────────────────── */}
      {phase === "results" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {results.filter((r) => r.report).length} reports generated
              {results.filter((r) => r.error && !r.report).length > 0 && (
                <span className="text-red-500 ml-2">
                  ({results.filter((r) => r.error && !r.report).length} failed)
                </span>
              )}
            </div>
            {remaining !== null && (
              <span className="text-xs text-gray-400">
                {remaining} of 20 free uses remaining
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={downloadWord}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
              }}
            >
              <DownloadIcon /> Download Word Document
            </button>
            <button
              onClick={copyAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:border-[#7B2FF2] hover:text-[#7B2FF2] transition"
            >
              {copiedAll ? (
                <>
                  <CheckIcon /> Copied!
                </>
              ) : (
                <>
                  <CopyIcon /> Copy All
                </>
              )}
            </button>
            <button
              onClick={() => {
                setPhase("editing");
                setResults([]);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:border-gray-400 transition"
            >
              &larr; Back to edit
            </button>
          </div>

          <div className="space-y-4">
            {results.map((r, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {r.firstName}
                  </h3>
                  <div className="flex items-center gap-3">
                    {r.report && (
                      <button
                        onClick={() => copyOne(idx)}
                        className="text-xs text-[#7B2FF2] hover:text-[#5C16C5] transition"
                      >
                        {copiedIdx === idx ? "Copied!" : "Copy"}
                      </button>
                    )}
                    <button
                      onClick={() => handleRegenerate(idx)}
                      className="text-xs text-gray-500 hover:text-[#7B2FF2] transition"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
                {r.error && !r.report ? (
                  <p className="text-sm text-red-500">{r.error}</p>
                ) : (
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {r.report}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mt-10 text-center bg-gradient-to-r from-[#7B2FF2]/5 to-[#5C16C5]/5 rounded-xl border border-[#7B2FF2]/20 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Want unlimited uses and more AI tools?
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Create a free Questerra account to unlock unlimited report generation,
          AI unit building, and student mentoring.
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


      {/* Slider thumb styles */}
      <style>{`
        .rating-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: currentColor;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .rating-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: currentColor;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}

// ─── Rating Slider ───────────────────────────────────────────────────────────

function RatingSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const color =
    value <= 2 ? "#f59e0b" : value === 3 ? "#9ca3af" : "#10b981";
  const pct = ((value - 1) / 4) * 100;

  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[90px]">
      <div className="relative w-full px-1">
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="rating-slider w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            color,
            background: `linear-gradient(to right, ${color} ${pct}%, #e5e7eb ${pct}%)`,
          }}
        />
      </div>
      <div className="flex justify-between w-full px-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`text-[10px] w-4 text-center transition-colors ${
              n === value ? "font-bold" : "text-gray-300"
            }`}
            style={n === value ? { color } : undefined}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
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

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
