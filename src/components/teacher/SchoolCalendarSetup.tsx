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

export function SchoolCalendarSetup() {
  const [loading, setLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState("2025-2026");
  const [terms, setTerms] = useState<Term[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [hasExisting, setHasExisting] = useState(false);

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
            {}
          );

          const latest = Object.keys(grouped).sort().reverse()[0];
          if (latest) {
            setAcademicYear(latest);
            setTerms(grouped[latest].sort((a, b) => a.term_order - b.term_order));
            setHasExisting(true);
          }
        }
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }

  function handleTemplateSelect(type: CalendarType) {
    const newTerms = CALENDAR_TEMPLATES[type];
    setTerms(newTerms.map((t) => ({ ...t })));
    setHasExisting(false);
  }

  function updateTerm(
    index: number,
    field: keyof Term,
    value: string | number
  ) {
    const updated = [...terms];
    (updated[index] as any)[field] = value;
    setTerms(updated);
  }

  function removeTerm(index: number) {
    setTerms(terms.filter((_, i) => i !== index));
  }

  function addTerm() {
    const maxOrder = Math.max(...terms.map((t) => t.term_order), 0);
    setTerms([
      ...terms,
      {
        term_name: `Term ${maxOrder + 1}`,
        term_order: maxOrder + 1,
      },
    ]);
  }

  async function handleSave() {
    if (!academicYear.trim() || terms.length === 0) {
      setMessage("Academic year and at least one term are required.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/teacher/school-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academic_year: academicYear,
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
        setMessage(data.error || "Failed to save calendar");
        return;
      }

      setMessage("Calendar saved!");
      setHasExisting(true);
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-surface-alt rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-gray-300 rounded w-1/3" />
        <div className="mt-4 space-y-3">
          <div className="h-3 bg-gray-200 rounded" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-alt rounded-xl p-6 border border-border">
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-text-primary mb-2">
          School Calendar
        </h3>
        <p className="text-xs text-text-secondary">
          Define your school&apos;s term structure. This is used when assigning
          units to classes.
        </p>
      </div>

      {/* Academic Year Input */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-text-primary mb-2">
          Academic Year
        </label>
        <input
          type="text"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          placeholder="e.g. 2025-2026"
          className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Quick Templates */}
      {!hasExisting && (
        <div className="mb-6">
          <label className="block text-xs font-medium text-text-primary mb-3">
            Quick Setup
          </label>
          <div className="flex flex-wrap gap-2">
            {(
              Object.keys(CALENDAR_TEMPLATES) as Array<keyof typeof CALENDAR_TEMPLATES>
            )
              .filter((k) => k !== "custom")
              .map((type) => (
                <button
                  key={type}
                  onClick={() => handleTemplateSelect(type)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-border text-xs font-medium text-text-primary hover:bg-surface-alt transition-colors"
                >
                  {type === "4-terms"
                    ? "4 Terms"
                    : type === "2-semesters"
                      ? "2 Semesters"
                      : "3 Trimesters"}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Terms List */}
      <div className="mb-6 space-y-3">
        <label className="block text-xs font-medium text-text-primary">
          Terms
        </label>
        {terms.length === 0 ? (
          <p className="text-xs text-text-secondary italic">
            No terms yet. Click a template above or add one below.
          </p>
        ) : (
          terms.map((term, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-3 bg-white rounded-lg border border-border"
            >
              <input
                type="text"
                value={term.term_name}
                onChange={(e) => updateTerm(i, "term_name", e.target.value)}
                className="flex-1 px-2 py-1 rounded border border-border text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Term name"
              />
              <input
                type="number"
                value={term.term_order}
                onChange={(e) =>
                  updateTerm(i, "term_order", parseInt(e.target.value, 10))
                }
                min="1"
                max="12"
                className="w-12 px-2 py-1 rounded border border-border text-xs text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="date"
                value={term.start_date || ""}
                onChange={(e) => updateTerm(i, "start_date", e.target.value)}
                className="w-28 px-2 py-1 rounded border border-border text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="date"
                value={term.end_date || ""}
                onChange={(e) => updateTerm(i, "end_date", e.target.value)}
                className="w-28 px-2 py-1 rounded border border-border text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={() => removeTerm(i)}
                className="px-2 py-1 rounded bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Term Button */}
      <div className="mb-6 flex justify-center">
        <button
          onClick={addTerm}
          className="px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-medium text-text-primary hover:bg-surface-alt transition-colors"
        >
          + Add Term
        </button>
      </div>

      {/* Feedback Messages */}
      {message && (
        <div
          className={`mb-4 text-xs font-medium p-3 rounded-lg ${
            message.includes("saved")
              ? "bg-green-50 text-green-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || terms.length === 0}
          className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving..." : "Save Calendar"}
        </button>
      </div>
    </div>
  );
}
