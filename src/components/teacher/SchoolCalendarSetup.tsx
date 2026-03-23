"use client";

import { useState, useEffect } from "react";

interface Term {
  id?: string;
  term_name: string;
  term_order: number;
  start_date?: string;
  end_date?: string;
}

interface CalendarData {
  academic_year: string;
  terms: Term[];
}

type CalendarType = "4-terms" | "2-semesters" | "3-trimesters" | "custom";

const CALENDAR_TEMPLATES: Record<CalendarType, Term[]> = {
  "4-terms": [
    { term_name: "Term 1", term_order: 1 },
    { term_name: "Term 2", term_order: 2 },
    { term_name: "Term 3", term_order: 3 },
    { term_name: "Term 4", term_order: 4 },
  ],
  "2-semesters": [
    { term_name: "Semester 1", term_order: 1 },
    { term_name: "Semester 2", term_order: 2 },
  ],
  "3-trimesters": [
    { term_name: "Trimester 1", term_order: 1 },
    { term_name: "Trimester 2", term_order: 2 },
    { term_name: "Trimester 3", term_order: 3 },
  ],
  custom: [],
};

function generateAcademicYears(): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  // If we're past July, the current academic year starts this year
  const startYear = now.getMonth() >= 6 ? currentYear : currentYear - 1;
  return [
    `${startYear - 1}-${startYear}`,
    `${startYear}-${startYear + 1}`,
    `${startYear + 1}-${startYear + 2}`,
  ];
}

export function SchoolCalendarSetup() {
  const [loading, setLoading] = useState(true);
  // Store all years' data
  const [allYearsData, setAllYearsData] = useState<Record<string, Term[]>>({});
  const [activeYear, setActiveYear] = useState(() => {
    const years = generateAcademicYears();
    return years[1]; // Current academic year
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const academicYears = generateAcademicYears();

  useEffect(() => {
    loadCalendar();
  }, []);

  async function loadCalendar() {
    try {
      const res = await fetch("/api/teacher/school-calendar");
      if (res.ok) {
        const data = await res.json();
        if (data.terms && data.terms.length > 0) {
          const grouped = data.terms.reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (acc: Record<string, Term[]>, t: any) => {
              if (!acc[t.academic_year]) acc[t.academic_year] = [];
              acc[t.academic_year].push({
                term_name: t.term_name,
                term_order: t.term_order,
                start_date: t.start_date,
                end_date: t.end_date,
              });
              return acc;
            },
            {} as Record<string, Term[]>
          );

          // Sort terms within each year
          for (const year of Object.keys(grouped)) {
            grouped[year].sort((a: Term, b: Term) => a.term_order - b.term_order);
          }
          setAllYearsData(grouped);

          // Set active year to the latest one that has data
          const latestWithData = Object.keys(grouped).sort().reverse()[0];
          if (latestWithData) setActiveYear(latestWithData);
        }
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  const terms = allYearsData[activeYear] || [];

  function setTerms(newTerms: Term[]) {
    setAllYearsData((prev) => ({ ...prev, [activeYear]: newTerms }));
  }

  function handleTemplateSelect(type: CalendarType) {
    setTerms(CALENDAR_TEMPLATES[type].map((t) => ({ ...t })));
  }

  function updateTerm(index: number, field: keyof Term, value: string | number) {
    const updated = [...terms];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[index] as any)[field] = value;
    setTerms(updated);
  }

  function removeTerm(index: number) {
    setTerms(terms.filter((_, i) => i !== index));
  }

  function addTerm() {
    const maxOrder = Math.max(...terms.map((t) => t.term_order), 0);
    setTerms([...terms, { term_name: `Term ${maxOrder + 1}`, term_order: maxOrder + 1 }]);
  }

  // Copy structure from one year to another
  function copyFromYear(sourceYear: string) {
    const sourceTerms = allYearsData[sourceYear];
    if (!sourceTerms) return;
    // Copy structure but clear dates
    setTerms(sourceTerms.map((t) => ({ ...t, start_date: undefined, end_date: undefined, id: undefined })));
  }

  async function handleSave() {
    if (terms.length === 0) {
      setMessage("Add at least one term.");
      return;
    }
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/teacher/school-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academic_year: activeYear,
          terms: terms.map((t) => ({
            term_name: t.term_name,
            term_order: t.term_order,
            start_date: t.start_date || undefined,
            end_date: t.end_date || undefined,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || "Failed to save");
        return;
      }

      setMessage("Saved!");
      setTimeout(() => setMessage(""), 2000);
    } catch {
      setMessage("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 border border-border animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="mt-3 h-3 bg-gray-100 rounded w-2/3" />
      </div>
    );
  }

  const hasDataForYear = (yr: string) => (allYearsData[yr] || []).length > 0;
  // Find a year with data that can be copied
  const copyableYear = academicYears.find((yr) => yr !== activeYear && hasDataForYear(yr));

  return (
    <div className="bg-white rounded-xl p-5 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">School Calendar</h3>
        {message && (
          <span className={`text-xs font-medium ${message === "Saved!" ? "text-green-600" : "text-amber-600"}`}>{message}</span>
        )}
      </div>

      {/* Year tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {academicYears.map((yr) => (
          <button
            key={yr}
            onClick={() => setActiveYear(yr)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition -mb-px ${
              activeYear === yr
                ? "border-brand-purple text-brand-purple"
                : hasDataForYear(yr)
                  ? "border-transparent text-text-primary hover:text-brand-purple"
                  : "border-transparent text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {yr}
            {hasDataForYear(yr) && activeYear !== yr && (
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            )}
          </button>
        ))}
      </div>

      {/* Terms content */}
      {terms.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-text-secondary mb-3">No terms set for {activeYear}</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {(Object.keys(CALENDAR_TEMPLATES) as CalendarType[])
              .filter((k) => k !== "custom")
              .map((type) => (
                <button
                  key={type}
                  onClick={() => handleTemplateSelect(type)}
                  className="px-3 py-1.5 rounded-lg bg-gray-50 border border-border text-xs font-medium text-text-primary hover:bg-gray-100 transition"
                >
                  {type === "4-terms" ? "4 Terms" : type === "2-semesters" ? "2 Semesters" : "3 Trimesters"}
                </button>
              ))}
            {copyableYear && (
              <button
                onClick={() => copyFromYear(copyableYear)}
                className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
              >
                Copy from {copyableYear}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Compact term rows */}
          <div className="space-y-1.5 mb-3">
            {terms.map((term, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <input
                  type="text"
                  value={term.term_name}
                  onChange={(e) => updateTerm(i, "term_name", e.target.value)}
                  className="w-28 px-2 py-1.5 rounded border border-border text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
                <input
                  type="date"
                  value={term.start_date || ""}
                  onChange={(e) => updateTerm(i, "start_date", e.target.value)}
                  className="px-2 py-1.5 rounded border border-border text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
                <span className="text-xs text-text-tertiary">→</span>
                <input
                  type="date"
                  value={term.end_date || ""}
                  onChange={(e) => updateTerm(i, "end_date", e.target.value)}
                  className="px-2 py-1.5 rounded border border-border text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
                <button
                  onClick={() => removeTerm(i)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition p-0.5"
                  title="Remove"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            ))}
          </div>

          {/* Bottom actions row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={addTerm}
                className="text-xs text-text-secondary hover:text-brand-purple transition"
              >
                + Add term
              </button>
              <span className="text-text-tertiary">·</span>
              {(Object.keys(CALENDAR_TEMPLATES) as CalendarType[])
                .filter((k) => k !== "custom")
                .map((type) => (
                  <button
                    key={type}
                    onClick={() => handleTemplateSelect(type)}
                    className="text-[10px] text-text-tertiary hover:text-text-secondary transition"
                  >
                    {type === "4-terms" ? "4T" : type === "2-semesters" ? "2S" : "3T"}
                  </button>
                ))}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-white transition disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
