"use client";

import { useState } from "react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ClassMeetingEntry {
  class_id: string;
  cycle_day: number;
  period_number?: number | "";
  room?: string;
}

interface TimetableGridProps {
  cycleLength: number;
  meetings: ClassMeetingEntry[];
  classes: Array<{ id: string; name: string }>;
  onMeetingsChange: (meetings: ClassMeetingEntry[]) => void;
  /** Max periods to show in grid rows (default 8) */
  maxPeriods?: number;
}

// ─────────────────────────────────────────────────────────────
// Class color palette — consistent per class via index
// ─────────────────────────────────────────────────────────────

const CLASS_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300", fill: "#3B82F6" },
  { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", fill: "#10B981" },
  { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", fill: "#F59E0B" },
  { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300", fill: "#8B5CF6" },
  { bg: "bg-pink-100", text: "text-pink-800", border: "border-pink-300", fill: "#EC4899" },
  { bg: "bg-cyan-100", text: "text-cyan-800", border: "border-cyan-300", fill: "#06B6D4" },
  { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300", fill: "#F97316" },
  { bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-300", fill: "#6366F1" },
];

function getClassColor(classId: string, classes: Array<{ id: string }>) {
  const idx = classes.findIndex((c) => c.id === classId);
  return CLASS_COLORS[idx % CLASS_COLORS.length];
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function TimetableGrid({
  cycleLength,
  meetings,
  classes,
  onMeetingsChange,
  maxPeriods = 8,
}: TimetableGridProps) {
  const [addingCell, setAddingCell] = useState<{
    cycleDay: number;
    period: number;
  } | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");

  const cycleDays = Array.from({ length: cycleLength }, (_, i) => i + 1);

  // Detect which periods are actually used
  const usedPeriods = meetings
    .map((m) => (typeof m.period_number === "number" ? m.period_number : 0))
    .filter((p) => p > 0);
  const maxUsedPeriod = Math.max(...usedPeriods, 0);
  const periodsToShow = Math.max(maxUsedPeriod + 1, Math.min(maxPeriods, 6));
  const periods = Array.from({ length: periodsToShow }, (_, i) => i + 1);

  // Build a lookup: `${cycleDay}-${period}` → meeting
  const cellMap = new Map<string, ClassMeetingEntry>();
  // Also track meetings without periods (shown in a "flex" row)
  const unperiodedMeetings: ClassMeetingEntry[] = [];

  for (const m of meetings) {
    if (typeof m.period_number === "number" && m.period_number > 0) {
      cellMap.set(`${m.cycle_day}-${m.period_number}`, m);
    } else {
      unperiodedMeetings.push(m);
    }
  }

  function handleCellClick(cycleDay: number, period: number) {
    const key = `${cycleDay}-${period}`;
    const existing = cellMap.get(key);

    if (existing) {
      // Remove meeting
      onMeetingsChange(
        meetings.filter(
          (m) =>
            !(m.cycle_day === cycleDay && m.period_number === period)
        )
      );
    } else {
      // Open add dialog
      setAddingCell({ cycleDay, period });
      setSelectedClassId(classes[0]?.id || "");
      setSelectedRoom("");
    }
  }

  function confirmAdd() {
    if (!addingCell || !selectedClassId) return;
    const newMeeting: ClassMeetingEntry = {
      class_id: selectedClassId,
      cycle_day: addingCell.cycleDay,
      period_number: addingCell.period,
      room: selectedRoom || undefined,
    };
    onMeetingsChange([...meetings, newMeeting]);
    setAddingCell(null);
  }

  function removeMeeting(idx: number) {
    onMeetingsChange(meetings.filter((_, i) => i !== idx));
  }

  // Quick add: single row form for adding without clicking grid
  const [quickClassId, setQuickClassId] = useState("");
  const [quickCycleDay, setQuickCycleDay] = useState(1);
  const [quickPeriod, setQuickPeriod] = useState<number | "">(1);
  const [quickRoom, setQuickRoom] = useState("");

  function handleQuickAdd() {
    if (!quickClassId) return;
    const newMeeting: ClassMeetingEntry = {
      class_id: quickClassId,
      cycle_day: quickCycleDay,
      period_number: quickPeriod || undefined,
      room: quickRoom || undefined,
    };
    onMeetingsChange([...meetings, newMeeting]);
    setQuickRoom("");
  }

  return (
    <div className="space-y-4">
      {/* Visual grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="p-2 text-left text-text-tertiary font-medium w-12">
                Period
              </th>
              {cycleDays.map((d) => (
                <th
                  key={d}
                  className="p-2 text-center font-semibold text-text-primary min-w-[80px]"
                >
                  Day {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period}>
                <td className="p-2 text-text-tertiary font-medium text-center border-t border-border">
                  P{period}
                </td>
                {cycleDays.map((day) => {
                  const key = `${day}-${period}`;
                  const meeting = cellMap.get(key);
                  const cls = meeting
                    ? classes.find((c) => c.id === meeting.class_id)
                    : null;
                  const color = meeting
                    ? getClassColor(meeting.class_id, classes)
                    : null;
                  const isAdding =
                    addingCell?.cycleDay === day &&
                    addingCell?.period === period;

                  return (
                    <td
                      key={key}
                      className="p-1 border-t border-border"
                    >
                      {isAdding ? (
                        <div className="rounded-lg border-2 border-purple-400 bg-purple-50 p-2 space-y-2">
                          <select
                            value={selectedClassId}
                            onChange={(e) =>
                              setSelectedClassId(e.target.value)
                            }
                            className="w-full px-2 py-1 rounded border border-border text-xs"
                            autoFocus
                          >
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={selectedRoom}
                            onChange={(e) =>
                              setSelectedRoom(e.target.value)
                            }
                            placeholder="Room"
                            className="w-full px-2 py-1 rounded border border-border text-xs"
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={confirmAdd}
                              className="flex-1 px-2 py-1 rounded bg-purple-600 text-white text-[10px] font-medium hover:bg-purple-700"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => setAddingCell(null)}
                              className="px-2 py-1 rounded text-text-tertiary text-[10px] hover:bg-gray-100"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : meeting && cls && color ? (
                        <button
                          onClick={() => handleCellClick(day, period)}
                          className={`w-full rounded-lg ${color.bg} ${color.text} border ${color.border} px-2 py-2 text-left group relative`}
                          title={`Click to remove: ${cls.name}`}
                        >
                          <div className="font-semibold truncate">
                            {cls.name}
                          </div>
                          {meeting.room && (
                            <div className="text-[10px] opacity-70 mt-0.5">
                              {meeting.room}
                            </div>
                          )}
                          <span className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition text-red-500">
                            ✕
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCellClick(day, period)}
                          className="w-full h-10 rounded-lg border border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors group"
                        >
                          <span className="text-gray-300 group-hover:text-purple-400 text-lg">
                            +
                          </span>
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Unperioded meetings (if any from import that didn't have period info) */}
      {unperiodedMeetings.length > 0 && (
        <div className="text-xs text-text-secondary">
          <p className="font-medium mb-1">
            Meetings without period info (from import):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unperiodedMeetings.map((m, i) => {
              const cls = classes.find((c) => c.id === m.class_id);
              const color = getClassColor(m.class_id, classes);
              const globalIdx = meetings.indexOf(m);
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${color.bg} ${color.text} ${color.border} border text-xs font-medium`}
                >
                  {cls?.name || "?"} — Day {m.cycle_day}
                  {m.room && ` (${m.room})`}
                  <button
                    onClick={() => removeMeeting(globalIdx)}
                    className="hover:text-red-600 ml-0.5"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick add row */}
      {classes.length > 0 && (
        <div className="flex items-end gap-2 flex-wrap pt-2 border-t border-border">
          <div>
            <label className="block text-[10px] text-text-tertiary mb-0.5">
              Class
            </label>
            <select
              value={quickClassId}
              onChange={(e) => setQuickClassId(e.target.value)}
              className="px-2 py-1.5 border border-border rounded-lg text-xs"
            >
              <option value="">Select...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-text-tertiary mb-0.5">
              Day
            </label>
            <select
              value={quickCycleDay}
              onChange={(e) => setQuickCycleDay(Number(e.target.value))}
              className="px-2 py-1.5 border border-border rounded-lg text-xs"
            >
              {cycleDays.map((d) => (
                <option key={d} value={d}>
                  Day {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-text-tertiary mb-0.5">
              Period
            </label>
            <input
              type="number"
              value={quickPeriod}
              onChange={(e) =>
                setQuickPeriod(
                  e.target.value ? Number(e.target.value) : ""
                )
              }
              min={1}
              max={12}
              placeholder="—"
              className="w-14 px-2 py-1.5 border border-border rounded-lg text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-tertiary mb-0.5">
              Room
            </label>
            <input
              type="text"
              value={quickRoom}
              onChange={(e) => setQuickRoom(e.target.value)}
              placeholder="D201"
              className="w-20 px-2 py-1.5 border border-border rounded-lg text-xs"
            />
          </div>
          <button
            onClick={handleQuickAdd}
            disabled={!quickClassId}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      )}

      {/* Legend */}
      {classes.length > 0 && meetings.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {classes
            .filter((c) => meetings.some((m) => m.class_id === c.id))
            .map((c) => {
              const color = getClassColor(c.id, classes);
              return (
                <span
                  key={c.id}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${color.bg} ${color.text} text-[10px] font-medium`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: color.fill }}
                  />
                  {c.name}
                  <span className="opacity-60">
                    (
                    {meetings.filter((m) => m.class_id === c.id).length}×
                    per cycle)
                  </span>
                </span>
              );
            })}
        </div>
      )}
    </div>
  );
}
