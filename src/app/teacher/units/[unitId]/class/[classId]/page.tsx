"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { NMConfigPanel, NMResultsPanel } from "@/components/nm";
import { CertManager } from "@/components/teacher/CertManager";
import type { NMUnitConfig } from "@/lib/nm/constants";
import { DEFAULT_NM_CONFIG } from "@/lib/nm/constants";
import { getPageList } from "@/lib/unit-adapter";
import type { Unit, UnitPage } from "@/types";

// ---------------------------------------------------------------------------
// Class-Unit Settings Page
// ---------------------------------------------------------------------------
// Per-class configuration for a unit template.
// Accessible from: Unit Detail → Assigned Classes → [click a class]
// URL: /teacher/units/[unitId]/class/[classId]
// ---------------------------------------------------------------------------

export default function ClassUnitSettingsPage({
  params,
}: {
  params: Promise<{ unitId: string; classId: string }>;
}) {
  const { unitId, classId } = use(params);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [nmConfig, setNmConfig] = useState<NMUnitConfig>(DEFAULT_NM_CONFIG);
  const [pages, setPages] = useState<Array<{ id: string; title: string }>>([]);
  const [students, setStudents] = useState<Array<{ student_id: string; display_name: string; username: string }>>([]);
  const [terms, setTerms] = useState<Array<{ id: string; academic_year: string; term_name: string; term_order: number }>>([]);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [savingTerm, setSavingTerm] = useState(false);
  const [termMessage, setTermMessage] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [unitRes, classRes, studentsRes, classUnitRes, termsRes] = await Promise.all([
        supabase.from("units").select("*").eq("id", unitId).single(),
        supabase.from("classes").select("name, code").eq("id", classId).single(),
        supabase.from("students").select("id, display_name, username").eq("class_id", classId),
        supabase.from("class_units").select("term_id").eq("class_id", classId).eq("unit_id", unitId).single(),
        fetch("/api/teacher/school-calendar").then((r) => (r.ok ? r.json() : Promise.resolve({ terms: [] }))),
      ]);

      setUnit(unitRes.data);
      setClassName(classRes.data?.name || "");
      setClassCode(classRes.data?.code || "");
      setStudentCount(studentsRes.data?.length || 0);
      setStudents(
        (studentsRes.data || []).map((s: { id: string; display_name?: string; username?: string }) => ({
          student_id: s.id,
          display_name: s.display_name || "",
          username: s.username || "",
        }))
      );

      if (unitRes.data) {
        const pageList = getPageList(unitRes.data.content_data);
        setPages(
          pageList.map((p: UnitPage, i: number) => ({
            id: p.id,
            title: p.title || p.content?.title || `Page ${i + 1}`,
          }))
        );
      }

      // Load class-unit term_id
      if (classUnitRes.data) {
        setSelectedTermId(classUnitRes.data.term_id || null);
      }

      // Load school calendar terms
      if (termsRes && termsRes.terms) {
        setTerms(termsRes.terms);
      }

      // Load class-specific NM config (with fallback to unit-level)
      try {
        const res = await fetch(
          `/api/teacher/nm-config?unitId=${unitId}&classId=${classId}`
        );
        if (res.ok) {
          const data = await res.json();
          setNmConfig(data.config || DEFAULT_NM_CONFIG);
        }
      } catch {
        // Fallback to unit-level
        if (unitRes.data?.nm_config) {
          setNmConfig(unitRes.data.nm_config as NMUnitConfig);
        }
      }

      setLoading(false);
    }
    load();
  }, [unitId, classId]);

  async function handleTermChange(termId: string | null) {
    setSelectedTermId(termId);
    setSavingTerm(true);
    setTermMessage("");

    try {
      const res = await fetch("/api/teacher/class-units", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          unitId,
          term_id: termId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setTermMessage(data.error || "Failed to save term");
        return;
      }

      setTermMessage("Term assigned!");
      setTimeout(() => setTermMessage(""), 3000);
    } catch {
      setTermMessage("Network error. Please try again.");
    } finally {
      setSavingTerm(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-48" />
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-32 bg-gray-50 rounded-xl" />
        </div>
      </main>
    );
  }

  if (!unit) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-text-secondary">Unit not found.</p>
        <Link
          href="/teacher/units"
          className="text-accent-blue text-sm mt-2 inline-block"
        >
          ← Back to units
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-4">
        <Link href="/teacher/units" className="hover:text-text-primary transition">
          Units
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <Link
          href={`/teacher/units/${unitId}`}
          className="hover:text-text-primary transition truncate max-w-[200px]"
        >
          {unit.title}
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-text-primary font-medium">{className}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 text-sm font-bold flex-shrink-0">
            {className.charAt(0).toUpperCase()}
          </div>
          {className}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Settings for <span className="font-medium">{unit.title}</span>
        </p>
        <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary">
          <span>{studentCount} student{studentCount !== 1 ? "s" : ""}</span>
          <span>Code: {classCode}</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Link
          href={`/teacher/classes/${classId}/progress/${unitId}`}
          className="px-4 py-2 rounded-xl border border-border text-text-primary font-medium text-sm hover:bg-surface-alt transition-colors flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          View Progress
        </Link>
        <Link
          href={`/teacher/teach/${unitId}?classId=${classId}`}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium text-sm hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Teach This Class
        </Link>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Term Assignment                                                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6 bg-surface-alt rounded-xl p-4 border border-border">
        <div className="mb-3">
          <label className="block text-xs font-semibold text-text-primary mb-2">
            Assign to Term
          </label>
          {terms.length === 0 ? (
            <div className="text-sm text-text-secondary">
              <p className="mb-2">No school calendar set up yet.</p>
              <Link
                href="/teacher/settings?tab=school"
                className="text-accent-blue text-xs font-medium hover:underline"
              >
                Set up your school calendar →
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={selectedTermId || ""}
                onChange={(e) => handleTermChange(e.target.value || null)}
                disabled={savingTerm}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-white text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              >
                <option value="">— No term assigned —</option>
                {Array.from(new Map(terms.map((t) => [t.academic_year, t])).keys()).map((year) => (
                  <optgroup key={year} label={year}>
                    {terms
                      .filter((t) => t.academic_year === year)
                      .sort((a, b) => a.term_order - b.term_order)
                      .map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.term_name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}
          {termMessage && (
            <p
              className={`mt-2 text-xs font-medium ${
                termMessage.includes("saved") || termMessage.includes("assigned")
                  ? "text-accent-green"
                  : "text-amber-600"
              }`}
            >
              {termMessage}
            </p>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* NM Config                                                          */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6">
        <NMConfigPanel
          unitId={unitId}
          classId={classId}
          pages={pages}
          currentConfig={nmConfig}
          onSave={async (config) => {
            const res = await fetch("/api/teacher/nm-config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ unitId, classId, config }),
            });
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              console.error("Failed to save NM config:", errData);
              throw new Error(errData.error || "Save failed");
            }
            setNmConfig(config);
          }}
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* NM Results                                                         */}
      {/* ----------------------------------------------------------------- */}
      {nmConfig.enabled && (
        <div className="mb-6">
          <NMResultsPanel unitId={unitId} classId={classId} />
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Workshop Certifications                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="mb-6">
        <CertManager classId={classId} students={students} />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Future: Open Studio, Timing Overrides, etc.                        */}
      {/* ----------------------------------------------------------------- */}
    </main>
  );
}
