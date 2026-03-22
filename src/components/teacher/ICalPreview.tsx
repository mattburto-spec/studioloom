"use client";

import { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────
// ICalPreview — Visual calendar showing imported holidays,
// matched class meetings, and unmatched events after iCal import
// ─────────────────────────────────────────────────────────────

interface HolidayDetail {
  date: string; // YYYY-MM-DD
  label: string;
}

interface ClassEventDate {
  date: string;
  summary: string;
}

interface UnmatchedEvent {
  summary: string;
  date: string;
}

interface Meeting {
  class_id: string;
  cycle_day: number;
  period_number?: number;
  room?: string;
}

export interface ICalImportData {
  totalEvents: number;
  meetings: Meeting[];
  excludedDates: string[];
  holidayDetails: HolidayDetail[];
  unmatchedEvents: string[];
  unmatchedWithDates: UnmatchedEvent[];
  classEventDates: ClassEventDate[];
}

interface ICalPreviewProps {
  data: ICalImportData;
  classNames?: Array<{ id: string; name: string }>;
  onClose?: () => void;
}

type ViewTab = "calendar" | "holidays" | "events";

export default function ICalPreview({ data, classNames = [], onClose }: ICalPreviewProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>("calendar");

  // Determine date range from all events
  const { months, holidayMap, classEventMap } = useMemo(() => {
    const allDates: string[] = [
      ...data.excludedDates,
      ...data.classEventDates.map((e) => e.date),
    ];
    if (allDates.length === 0) return { months: [], holidayMap: new Map(), classEventMap: new Map() };

    allDates.sort();
    const startDate = new Date(allDates[0]);
    const endDate = new Date(allDates[allDates.length - 1]);

    // Build month list
    const monthList: Array<{ year: number; month: number }> = [];
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (d <= endDate) {
      monthList.push({ year: d.getFullYear(), month: d.getMonth() });
      d.setMonth(d.getMonth() + 1);
    }

    // Build lookup maps
    const hMap = new Map<string, string>(); // date → label
    for (const h of data.holidayDetails) {
      if (!hMap.has(h.date)) hMap.set(h.date, h.label);
    }
    // Fallback: add excludedDates without details
    for (const d of data.excludedDates) {
      if (!hMap.has(d)) hMap.set(d, "Holiday");
    }

    const ceMap = new Map<string, string[]>(); // date → [summaries]
    for (const e of data.classEventDates) {
      const existing = ceMap.get(e.date) || [];
      existing.push(e.summary);
      ceMap.set(e.date, existing);
    }

    return { months: monthList, holidayMap: hMap, classEventMap: ceMap };
  }, [data]);

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

  const matchedClassNames = useMemo(() => {
    const ids = new Set(data.meetings.map((m) => m.class_id));
    return classNames.filter((c) => ids.has(c.id)).map((c) => c.name);
  }, [data.meetings, classNames]);

  return (
    <div className="mt-4 rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-text-primary">📅 Calendar Import Preview</span>
          <span className="text-xs text-text-tertiary">{data.totalEvents} events found</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-xs">✕</button>
        )}
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border bg-white">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block" />
          <span className="text-xs text-text-secondary">
            <span className="font-semibold text-red-700">{data.excludedDates.length}</span> holidays
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-300 inline-block" />
          <span className="text-xs text-text-secondary">
            <span className="font-semibold text-blue-700">{data.meetings.length}</span> class meetings
            {matchedClassNames.length > 0 && (
              <span className="text-text-tertiary"> ({matchedClassNames.join(", ")})</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block" />
          <span className="text-xs text-text-secondary">
            <span className="font-semibold text-amber-700">{data.unmatchedEvents.length}</span> unmatched
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border">
        {([
          { key: "calendar" as ViewTab, label: "Calendar" },
          { key: "holidays" as ViewTab, label: `Holidays (${data.excludedDates.length})` },
          { key: "events" as ViewTab, label: `Events (${data.classEventDates.length + data.unmatchedWithDates.length})` },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "text-brand-purple border-b-2 border-brand-purple bg-white"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === "calendar" && (
          <CalendarGrid
            months={months}
            holidayMap={holidayMap}
            classEventMap={classEventMap}
            dayHeaders={DAY_HEADERS}
            monthNames={MONTH_NAMES}
          />
        )}

        {activeTab === "holidays" && (
          <HolidayList holidays={data.holidayDetails} />
        )}

        {activeTab === "events" && (
          <EventList
            classEvents={data.classEventDates}
            unmatchedEvents={data.unmatchedWithDates}
          />
        )}
      </div>
    </div>
  );
}

// ── Calendar Grid ──────────────────────────────────────────

function CalendarGrid({
  months,
  holidayMap,
  classEventMap,
  dayHeaders,
  monthNames,
}: {
  months: Array<{ year: number; month: number }>;
  holidayMap: Map<string, string>;
  classEventMap: Map<string, string[]>;
  dayHeaders: string[];
  monthNames: string[];
}) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  if (months.length === 0) {
    return <p className="text-xs text-text-tertiary italic">No events found in calendar.</p>;
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto pr-1">
        {months.map(({ year, month }) => {
          const firstDay = new Date(year, month, 1);
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          // getDay(): 0=Sun. We want Mon=0. Shift: (getDay()+6)%7
          const startOffset = (firstDay.getDay() + 6) % 7;

          const cells: Array<{ day: number | null; dateStr: string }> = [];
          // Empty cells before first day
          for (let i = 0; i < startOffset; i++) {
            cells.push({ day: null, dateStr: "" });
          }
          for (let d = 1; d <= daysInMonth; d++) {
            const mm = String(month + 1).padStart(2, "0");
            const dd = String(d).padStart(2, "0");
            cells.push({ day: d, dateStr: `${year}-${mm}-${dd}` });
          }

          return (
            <div key={`${year}-${month}`} className="min-w-0">
              <div className="text-xs font-semibold text-text-primary mb-1.5">
                {monthNames[month]} {year}
              </div>
              <div className="grid grid-cols-7 gap-px">
                {dayHeaders.map((dh, i) => (
                  <div key={i} className="text-[9px] text-text-tertiary text-center font-medium pb-0.5">
                    {dh}
                  </div>
                ))}
                {cells.map((cell, idx) => {
                  if (cell.day === null) {
                    return <div key={`e-${idx}`} className="h-5" />;
                  }

                  const isHoliday = holidayMap.has(cell.dateStr);
                  const events = classEventMap.get(cell.dateStr);
                  const hasEvents = events && events.length > 0;
                  const holidayLabel = holidayMap.get(cell.dateStr);

                  // Weekend check (Sat/Sun are cols 5,6 in Mon-start grid)
                  const colIndex = idx % 7;
                  const isWeekend = colIndex >= 5;

                  let bgClass = "bg-white";
                  let textClass = "text-text-primary";
                  if (isHoliday) {
                    bgClass = "bg-red-100 border border-red-300";
                    textClass = "text-red-800 font-semibold";
                  } else if (hasEvents) {
                    bgClass = "bg-blue-50 border border-blue-200";
                    textClass = "text-blue-800";
                  } else if (isWeekend) {
                    textClass = "text-gray-300";
                  }

                  const tooltipText = isHoliday
                    ? `🔴 ${holidayLabel}`
                    : hasEvents
                    ? `🔵 ${events.slice(0, 3).join(", ")}${events.length > 3 ? ` +${events.length - 3} more` : ""}`
                    : "";

                  return (
                    <div
                      key={cell.dateStr}
                      className={`h-5 flex items-center justify-center rounded text-[10px] cursor-default transition-colors ${bgClass} ${textClass}`}
                      onMouseEnter={(e) => {
                        if (tooltipText) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ text: tooltipText, x: rect.left, y: rect.bottom + 4 });
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {cell.day}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2.5 py-1.5 bg-gray-900 text-white text-[10px] rounded-lg shadow-lg max-w-[220px] pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

// ── Holiday List ───────────────────────────────────────────

function HolidayList({ holidays }: { holidays: HolidayDetail[] }) {
  if (holidays.length === 0) {
    return <p className="text-xs text-text-tertiary italic">No holidays detected.</p>;
  }

  // Group by label (multi-day holidays)
  const grouped: Array<{ label: string; dates: string[] }> = [];
  const labelMap = new Map<string, string[]>();
  for (const h of holidays) {
    const existing = labelMap.get(h.label) || [];
    existing.push(h.date);
    labelMap.set(h.label, existing);
  }
  for (const [label, dates] of labelMap) {
    grouped.push({ label, dates: dates.sort() });
  }
  grouped.sort((a, b) => a.dates[0].localeCompare(b.dates[0]));

  return (
    <div className="max-h-[300px] overflow-y-auto space-y-1">
      {grouped.map((g, i) => {
        const startDate = formatDisplayDate(g.dates[0]);
        const endDate = g.dates.length > 1 ? formatDisplayDate(g.dates[g.dates.length - 1]) : null;
        return (
          <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-red-50 transition-colors">
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            <span className="text-xs font-medium text-text-primary">{g.label}</span>
            <span className="text-[10px] text-text-tertiary ml-auto whitespace-nowrap">
              {startDate}{endDate ? ` — ${endDate}` : ""}{g.dates.length > 1 ? ` (${g.dates.length} days)` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Event List ─────────────────────────────────────────────

function EventList({
  classEvents,
  unmatchedEvents,
}: {
  classEvents: ClassEventDate[];
  unmatchedEvents: UnmatchedEvent[];
}) {
  const [showType, setShowType] = useState<"all" | "matched" | "unmatched">("all");

  // Deduplicate by summary
  const uniqueMatched = useMemo(() => {
    const seen = new Set<string>();
    return classEvents.filter((e) => {
      if (seen.has(e.summary)) return false;
      seen.add(e.summary);
      return true;
    });
  }, [classEvents]);

  const uniqueUnmatched = useMemo(() => {
    const seen = new Set<string>();
    return unmatchedEvents.filter((e) => {
      if (seen.has(e.summary)) return false;
      seen.add(e.summary);
      return true;
    });
  }, [unmatchedEvents]);

  const items = showType === "matched" ? uniqueMatched.map((e) => ({ ...e, type: "matched" as const }))
    : showType === "unmatched" ? uniqueUnmatched.map((e) => ({ ...e, type: "unmatched" as const }))
    : [
        ...uniqueMatched.map((e) => ({ ...e, type: "matched" as const })),
        ...uniqueUnmatched.map((e) => ({ ...e, type: "unmatched" as const })),
      ];

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {(["all", "matched", "unmatched"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setShowType(t)}
            className={`px-2.5 py-1 text-[10px] rounded-full font-medium transition-colors ${
              showType === t
                ? t === "matched" ? "bg-blue-100 text-blue-700" : t === "unmatched" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-text-primary"
                : "text-text-tertiary hover:bg-gray-50"
            }`}
          >
            {t === "all" ? `All (${uniqueMatched.length + uniqueUnmatched.length})` : t === "matched" ? `Matched (${uniqueMatched.length})` : `Unmatched (${uniqueUnmatched.length})`}
          </button>
        ))}
      </div>
      <div className="max-h-[300px] overflow-y-auto space-y-0.5">
        {items.length === 0 && (
          <p className="text-xs text-text-tertiary italic py-2">No events in this category.</p>
        )}
        {items.map((item, i) => (
          <div key={i} className={`flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${item.type === "matched" ? "bg-blue-400" : "bg-amber-400"}`} />
            <span className="text-xs text-text-primary truncate">{item.summary}</span>
            <span className="text-[10px] text-text-tertiary ml-auto whitespace-nowrap">{formatDisplayDate(item.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00"); // Avoid timezone shift
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
