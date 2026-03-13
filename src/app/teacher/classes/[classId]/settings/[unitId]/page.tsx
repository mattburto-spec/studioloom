"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CRITERIA, type CriterionKey, DEFAULT_PAGE_SETTINGS, getPageColor } from "@/lib/constants";
import { getPageList } from "@/lib/unit-adapter";
import type { PageSettings, PageSettingsMap, PageDueDatesMap, UnitPage } from "@/types";

export default function UnitSettingsPage({
  params,
}: {
  params: Promise<{ classId: string; unitId: string }>;
}) {
  const { classId, unitId } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [className, setClassName] = useState("");
  const [unitTitle, setUnitTitle] = useState("");
  const [unitPages, setUnitPages] = useState<UnitPage[]>([]);

  // Due dates
  const [finalDueDate, setFinalDueDate] = useState("");
  const [pageDueDates, setPageDueDates] = useState<Record<string, string>>({});

  // Page settings (keyed by page number as string)
  const [pageSettings, setPageSettings] = useState<
    Record<string, PageSettings>
  >({});

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, unitId]);

  async function loadSettings() {
    const supabase = createClient();

    const [classRes, unitRes, cuRes] = await Promise.all([
      supabase.from("classes").select("name").eq("id", classId).single(),
      supabase.from("units").select("title, content_data").eq("id", unitId).single(),
      supabase
        .from("class_units")
        .select("final_due_date, page_due_dates, page_settings")
        .eq("class_id", classId)
        .eq("unit_id", unitId)
        .single(),
    ]);

    setClassName(classRes.data?.name || "");
    setUnitTitle(unitRes.data?.title || "");

    // Get pages from unit content data
    const pages = unitRes.data?.content_data
      ? getPageList(unitRes.data.content_data)
      : [];
    setUnitPages(pages);

    if (cuRes.data) {
      setFinalDueDate(cuRes.data.final_due_date || "");

      // Load per-page due dates
      const savedDueDates = (cuRes.data.page_due_dates as PageDueDatesMap) || {};
      const dueDates: Record<string, string> = {};
      for (const [key, val] of Object.entries(savedDueDates)) {
        if (val) dueDates[key] = val;
      }
      setPageDueDates(dueDates);

      // Merge saved settings with defaults for all unit pages
      const saved = (cuRes.data.page_settings as PageSettingsMap) || {};
      const merged: Record<string, PageSettings> = {};
      for (const page of pages) {
        merged[page.id] = { ...DEFAULT_PAGE_SETTINGS, ...saved[page.id] };
      }
      setPageSettings(merged);
    } else {
      const defaults: Record<string, PageSettings> = {};
      for (const page of pages) {
        defaults[page.id] = { ...DEFAULT_PAGE_SETTINGS };
      }
      setPageSettings(defaults);
    }

    setLoading(false);
  }

  function updatePageSetting(
    pageId: string,
    field: keyof PageSettings,
    value: unknown
  ) {
    setPageSettings((prev) => ({
      ...prev,
      [pageId]: {
        ...prev[pageId],
        [field]: value,
      },
    }));
    setSaved(false);
  }

  function updatePageDueDate(pageId: string, date: string) {
    setPageDueDates((prev) => {
      if (!date) {
        const updated = { ...prev };
        delete updated[pageId];
        return updated;
      }
      return { ...prev, [pageId]: date };
    });
    setSaved(false);
  }

  function applyToAll(field: keyof PageSettings, value: unknown) {
    setPageSettings((prev) => {
      const updated = { ...prev };
      for (const page of unitPages) {
        updated[page.id] = { ...updated[page.id], [field]: value };
      }
      return updated;
    });
    setSaved(false);
  }

  async function saveSettings() {
    setSaving(true);
    setError("");

    const supabase = createClient();

    // Only save settings that differ from defaults (compact JSON)
    const compactSettings: PageSettingsMap = {};
    for (const page of unitPages) {
      const s = pageSettings[page.id];
      if (!s) continue;
      const d = DEFAULT_PAGE_SETTINGS;
      if (
        s.enabled !== d.enabled ||
        s.assessment_type !== d.assessment_type ||
        s.export_pdf !== d.export_pdf
      ) {
        compactSettings[page.id] = s;
      }
    }

    // Only save non-empty due dates
    const compactDueDates: PageDueDatesMap = {};
    for (const [key, val] of Object.entries(pageDueDates)) {
      if (val) compactDueDates[key] = val;
    }

    const { error: dbError } = await supabase
      .from("class_units")
      .update({
        final_due_date: finalDueDate || null,
        page_due_dates: compactDueDates,
        page_settings: compactSettings,
      })
      .eq("class_id", classId)
      .eq("unit_id", unitId);

    if (dbError) {
      setError(dbError.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-2">
        <Link
          href={`/teacher/classes/${classId}`}
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          &larr; Back to {className}
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-text-primary mb-1">
        Unit Settings
      </h1>
      <p className="text-text-secondary mb-8">{unitTitle}</p>

      {/* ========== FINAL DUE DATE ========== */}
      <section className="bg-white rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Unit Due Date
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-text-secondary">
            Final Due Date (entire unit):
          </label>
          <input
            type="date"
            value={finalDueDate}
            onChange={(e) => { setFinalDueDate(e.target.value); setSaved(false); }}
            className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent text-sm"
          />
          {finalDueDate && (
            <button
              onClick={() => { setFinalDueDate(""); setSaved(false); }}
              className="text-xs text-text-secondary hover:text-red-500 transition"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {/* ========== PAGE SETTINGS ========== */}
      <section className="bg-white rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Page Settings & Due Dates
          </h2>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => applyToAll("enabled", true)}
              className="px-2 py-1 text-xs bg-accent-green/10 text-accent-green rounded hover:bg-accent-green/20 transition"
            >
              Enable All
            </button>
            <button
              onClick={() => applyToAll("assessment_type", "formative")}
              className="px-2 py-1 text-xs bg-gray-100 text-text-secondary rounded hover:bg-gray-200 transition"
            >
              All Formative
            </button>
            <button
              onClick={() => applyToAll("assessment_type", "summative")}
              className="px-2 py-1 text-xs bg-red-50 text-red-500 rounded hover:bg-red-100 transition"
            >
              All Summative
            </button>
            <button
              onClick={() => applyToAll("export_pdf", true)}
              className="px-2 py-1 text-xs bg-accent-blue/10 text-accent-blue rounded hover:bg-accent-blue/20 transition"
            >
              Enable All PDF
            </button>
          </div>
        </div>

        {/* Pages grouped by criterion */}
        {(() => {
          // Group pages by criterion (strand pages) + "Other" group
          const groups = new Map<string, { label: string; color: string; pages: UnitPage[] }>();
          const otherPages: UnitPage[] = [];

          for (const page of unitPages) {
            if (page.type === "strand" && page.criterion && page.criterion in CRITERIA) {
              const key = page.criterion as CriterionKey;
              if (!groups.has(key)) {
                groups.set(key, {
                  label: `Criterion ${key}: ${CRITERIA[key].name}`,
                  color: CRITERIA[key].color,
                  pages: [],
                });
              }
              groups.get(key)!.pages.push(page);
            } else {
              otherPages.push(page);
            }
          }

          const sections = [...groups.entries()];
          if (otherPages.length > 0) {
            sections.push(["other", { label: "Other Pages", color: "#6B7280", pages: otherPages }]);
          }

          return sections.map(([key, group]) => (
            <div key={key} className="mb-6 last:mb-0">
              <h3
                className="text-sm font-semibold mb-3 flex items-center gap-2"
                style={{ color: group.color }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                {group.label}
              </h3>

              <div className="space-y-2">
                {group.pages.map((page) => {
                  const settings = pageSettings[page.id];
                  if (!settings) return null;
                  const pageClr = getPageColor(page);

                  return (
                    <div
                      key={page.id}
                      className={`border rounded-lg p-4 transition ${
                        settings.enabled
                          ? "border-border bg-white"
                          : "border-gray-200 bg-gray-50 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* ON/OFF Toggle (left side) */}
                        <button
                          onClick={() => updatePageSetting(page.id, "enabled", !settings.enabled)}
                          className={`relative w-11 h-6 rounded-full transition flex-shrink-0 mt-0.5 ${
                            settings.enabled ? "bg-accent-green" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                              settings.enabled ? "translate-x-5" : ""
                            }`}
                          />
                        </button>

                        {/* Page title and ID */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="text-xs font-bold px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: pageClr + "15",
                                color: pageClr,
                              }}
                            >
                              {page.id}
                            </span>
                            <span className="text-sm text-text-primary truncate">
                              {page.title}
                            </span>
                          </div>

                          {/* Controls row */}
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Due date picker */}
                            <div className="flex items-center gap-1.5">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-secondary flex-shrink-0">
                                <rect x="3" y="4" width="18" height="18" rx="2" />
                                <path d="M16 2v4M8 2v4M3 10h18" />
                              </svg>
                              <input
                                type="date"
                                value={pageDueDates[page.id] || ""}
                                onChange={(e) => updatePageDueDate(page.id, e.target.value)}
                                className="px-2 py-0.5 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent-blue focus:border-transparent"
                              />
                              {pageDueDates[page.id] && (
                                <button
                                  onClick={() => updatePageDueDate(page.id, "")}
                                  className="text-text-secondary hover:text-red-500 transition"
                                  title="Clear date"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>

                            <div className="w-px h-4 bg-border" />

                            {/* Formative / Summative */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  updatePageSetting(page.id, "assessment_type", "formative")
                                }
                                className={`px-2 py-0.5 text-xs rounded transition ${
                                  settings.assessment_type === "formative"
                                    ? "bg-gray-700 text-white"
                                    : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                                }`}
                              >
                                Formative
                              </button>
                              <button
                                onClick={() =>
                                  updatePageSetting(page.id, "assessment_type", "summative")
                                }
                                className={`px-2 py-0.5 text-xs rounded transition ${
                                  settings.assessment_type === "summative"
                                    ? "bg-red-500 text-white"
                                    : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                                }`}
                              >
                                Summative
                              </button>
                            </div>

                            <div className="w-px h-4 bg-border" />

                            {/* AI Modify — links to unit editor */}
                            <Link
                              href={`/teacher/units/${unitId}/edit`}
                              className="px-2 py-0.5 text-xs rounded bg-brand-purple/10 text-brand-purple hover:bg-brand-purple/20 transition flex items-center gap-1"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 3v3m6.36.64l-2.12 2.12M21 12h-3m-.64 6.36l-2.12-2.12M12 21v-3m-6.36-.64l2.12-2.12M3 12h3m.64-6.36l2.12 2.12" />
                              </svg>
                              Modify
                            </Link>

                            <div className="w-px h-4 bg-border" />

                            {/* Export PDF */}
                            <button
                              onClick={() => updatePageSetting(page.id, "export_pdf", !settings.export_pdf)}
                              className={`px-2 py-0.5 text-xs rounded transition ${
                                settings.export_pdf
                                  ? "bg-accent-blue text-white"
                                  : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                              }`}
                            >
                              PDF Export
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </section>

      {/* Save bar */}
      <div className="sticky bottom-0 bg-white border-t border-border py-4 px-6 -mx-4 flex items-center justify-between">
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-accent-green font-medium">
              Saved!
            </span>
          )}
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-6 py-2.5 bg-dark-blue text-white rounded-lg text-sm font-medium hover:bg-dark-blue/90 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </main>
  );
}
