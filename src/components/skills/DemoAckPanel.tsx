"use client";

/**
 * DemoAckPanel — teacher-facing widget for acknowledging that a student
 * has demonstrated a skill. Writes / revokes `skill.demonstrated` events
 * via the /cards/[id]/demonstrations API.
 *
 * Lives on the teacher skill card pages (view + edit). Each class is a
 * collapsible section; students within a class show a tick-chip with the
 * ack date if demonstrated, or a "Mark demonstrated" button if not.
 *
 * Dedupe: the API rejects a second ack within 24h, so rapid double-clicks
 * are safe. A revoke button appears inline on already-demonstrated chips;
 * revoke is only available for acks the current teacher wrote (server
 * enforces this too).
 */

import { useCallback, useEffect, useState } from "react";

interface StudentRow {
  id: string;
  display_name: string;
  username: string;
  demonstrated_at: string | null;
  event_id: string | null;
  ack_by_teacher_id: string | null;
}

interface ClassRow {
  id: string;
  name: string;
  students: StudentRow[];
}

interface Props {
  cardId: string;
  /** Current teacher's user id, used to decide whether revoke is allowed
   *  on a given ack (only the teacher who acked can revoke). Optional —
   *  if not provided, the server enforces on revoke attempt. */
  teacherId?: string;
}

function formatAckDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function DemoAckPanel({ cardId, teacherId }: Props) {
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/teacher/skills/cards/${cardId}/demonstrations`,
        { credentials: "include" }
      );
      if (!res.ok) {
        setLoadError("Failed to load student list.");
        setClasses([]);
        return;
      }
      const json = await res.json();
      setClasses(json.classes ?? []);
      setLoadError(null);
    } catch {
      setLoadError("Network error.");
      setClasses([]);
    }
  }, [cardId]);

  useEffect(() => {
    load();
  }, [load]);

  async function ack(studentId: string) {
    setBusyStudentId(studentId);
    try {
      const res = await fetch(
        `/api/teacher/skills/cards/${cardId}/demonstrations`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: studentId }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Failed to mark demonstrated.");
        return;
      }
      await load();
    } finally {
      setBusyStudentId(null);
    }
  }

  async function revoke(studentId: string) {
    if (!confirm("Revoke this demonstration? The student loses the 'demonstrated' state for this skill.")) {
      return;
    }
    setBusyStudentId(studentId);
    try {
      const res = await fetch(
        `/api/teacher/skills/cards/${cardId}/demonstrations`,
        {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: studentId }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Failed to revoke demonstration.");
        return;
      }
      await load();
    } finally {
      setBusyStudentId(null);
    }
  }

  if (classes === null) {
    return (
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Mark demonstrations
        </h2>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-100 rounded w-1/3" />
          <div className="h-8 bg-gray-100 rounded" />
          <div className="h-8 bg-gray-100 rounded" />
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Mark demonstrations
        </h2>
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
          {loadError}
        </div>
      </section>
    );
  }

  if (classes.length === 0) {
    return (
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Mark demonstrations
        </h2>
        <p className="text-sm text-gray-500">
          You don&apos;t own any classes yet — so there are no students to ack.
          Once you add a class, students will appear here and you can mark who
          has demonstrated this skill.
        </p>
      </section>
    );
  }

  const totalStudents = classes.reduce((n, c) => n + c.students.length, 0);
  const totalDemonstrated = classes.reduce(
    (n, c) => n + c.students.filter((s) => s.demonstrated_at).length,
    0
  );

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6">
      <header className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Mark demonstrations
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Tap a student&apos;s button when they&apos;ve shown you the
            demo-of-competency live. Writes a <code>skill.demonstrated</code>{" "}
            event.
          </p>
        </div>
        <div className="text-sm text-gray-500 text-right flex-shrink-0">
          <div className="font-semibold text-gray-900">
            {totalDemonstrated} / {totalStudents}
          </div>
          <div className="text-xs">demonstrated</div>
        </div>
      </header>

      <div className="space-y-3 mt-4">
        {classes.map((cls) => {
          const isCollapsed = collapsed[cls.id] ?? false;
          const classDemonstrated = cls.students.filter(
            (s) => s.demonstrated_at
          ).length;
          return (
            <div key={cls.id} className="border border-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() =>
                  setCollapsed((c) => ({ ...c, [cls.id]: !isCollapsed }))
                }
                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {cls.name}
                  </span>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {classDemonstrated} / {cls.students.length}
                  </span>
                </div>
                <span
                  className="text-gray-400 flex-shrink-0"
                  style={{
                    transform: isCollapsed ? "rotate(-90deg)" : "rotate(0)",
                    transition: "transform 150ms ease",
                  }}
                  aria-hidden
                >
                  ▾
                </span>
              </button>
              {!isCollapsed && cls.students.length > 0 && (
                <ul className="border-t border-gray-100 divide-y divide-gray-100">
                  {cls.students.map((s) => {
                    const isBusy = busyStudentId === s.id;
                    const canRevoke =
                      s.demonstrated_at != null &&
                      (!teacherId ||
                        !s.ack_by_teacher_id ||
                        s.ack_by_teacher_id === teacherId);
                    const revokeLockedForOtherTeacher =
                      s.demonstrated_at != null &&
                      !!teacherId &&
                      !!s.ack_by_teacher_id &&
                      s.ack_by_teacher_id !== teacherId;
                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {s.display_name}
                          </div>
                          <div className="text-xs text-gray-400 truncate">
                            {s.username}
                          </div>
                        </div>
                        {s.demonstrated_at ? (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium"
                              title={
                                revokeLockedForOtherTeacher
                                  ? "Acked by another teacher — only they can revoke"
                                  : `Demonstrated ${formatAckDate(
                                      s.demonstrated_at
                                    )}`
                              }
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              {formatAckDate(s.demonstrated_at)}
                            </span>
                            {canRevoke ? (
                              <button
                                type="button"
                                onClick={() => revoke(s.id)}
                                disabled={isBusy}
                                className="text-xs text-rose-600 hover:text-rose-700 px-2 py-1 rounded disabled:opacity-40"
                              >
                                {isBusy ? "…" : "Revoke"}
                              </button>
                            ) : (
                              <span
                                className="text-xs text-gray-400 px-2"
                                title="Only the acking teacher can revoke"
                              >
                                Locked
                              </span>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => ack(s.id)}
                            disabled={isBusy}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 flex-shrink-0"
                          >
                            {isBusy ? "…" : "Mark demonstrated"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {!isCollapsed && cls.students.length === 0 && (
                <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-400 italic">
                  No students in this class yet.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
