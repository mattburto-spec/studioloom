"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Icons (inline SVGs — no lucide-react in project) ────────────────────────
const ShieldIcon = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const CheckIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const PlusIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const ChevronIcon = ({ open, size = 16 }: { open: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const GiftIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface Badge {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  tier: number;
  pass_threshold: number;
  question_pool: unknown[];
  learning_cards: unknown[];
}

interface Requirement {
  id: string;
  badge_id: string;
  badge_name: string;
  badge_slug: string;
  is_required: boolean;
}

interface StudentResult {
  student_id: string;
  student_name: string;
  score: number;
  attempt_number: number;
  status: string;
  awarded_at: string;
  granted_by: string | null;
}

interface Student {
  id: string;
  display_name: string;
  username: string;
}

interface BadgesTabProps {
  unitId: string;
  classId: string;
  students: Student[];
}

export function BadgesTab({ unitId, classId, students }: BadgesTabProps) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [expandedBadge, setExpandedBadge] = useState<string | null>(null);
  const [badgeResults, setBadgeResults] = useState<Record<string, StudentResult[]>>({});
  const [loading, setLoading] = useState(true);
  const [addingReq, setAddingReq] = useState(false);
  const [grantingBadge, setGrantingBadge] = useState<string | null>(null);
  const [grantStudentId, setGrantStudentId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Load all badges + requirements for this unit
  const loadData = useCallback(async () => {
    try {
      const [badgesRes, reqRes] = await Promise.all([
        fetch("/api/teacher/badges"),
        fetch(`/api/teacher/badges/unit-requirements?unitId=${unitId}`),
      ]);
      if (badgesRes.ok) {
        const data = await badgesRes.json();
        setBadges(data.badges || []);
      }
      if (reqRes.ok) {
        const data = await reqRes.json();
        setRequirements(data.requirements || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load results for a specific badge when expanded
  const loadResults = useCallback(async (badgeId: string) => {
    if (badgeResults[badgeId]) return; // already loaded
    try {
      const res = await fetch(`/api/teacher/badges/${badgeId}/results?classId=${classId}`);
      if (res.ok) {
        const data = await res.json();
        setBadgeResults((prev) => ({ ...prev, [badgeId]: data.results || [] }));
      }
    } catch {
      // silent
    }
  }, [classId, badgeResults]);

  const toggleExpand = (badgeId: string) => {
    if (expandedBadge === badgeId) {
      setExpandedBadge(null);
    } else {
      setExpandedBadge(badgeId);
      loadResults(badgeId);
    }
  };

  // Add badge requirement for this unit
  const addRequirement = async (badgeId: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/teacher/badges/unit-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, badgeId, isRequired: true }),
      });
      if (res.ok) {
        await loadData();
        setAddingReq(false);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  // Remove badge requirement
  const removeRequirement = async (requirementId: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/teacher/badges/unit-requirements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementId }),
      });
      if (res.ok) {
        setRequirements((prev) => prev.filter((r) => r.id !== requirementId));
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  // Grant badge directly to a student
  const grantBadge = async (badgeId: string, studentId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/teacher/badges/${badgeId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "grant", targetStudentIds: [studentId], classId }),
      });
      if (res.ok) {
        // Refresh results for this badge
        setBadgeResults((prev) => ({ ...prev, [badgeId]: undefined as unknown as StudentResult[] }));
        loadResults(badgeId);
        setGrantingBadge(null);
        setGrantStudentId("");
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const requiredBadgeIds = new Set(requirements.map((r) => r.badge_id));
  const unrequiredBadges = badges.filter((b) => !requiredBadgeIds.has(b.id));

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-48 mb-3" />
            <div className="h-4 bg-gray-100 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* ═══ Required Badges Section ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
            <ShieldIcon size={18} color="#D97706" />
            Required for This Unit
          </h3>
          {unrequiredBadges.length > 0 && (
            <button
              onClick={() => setAddingReq(!addingReq)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition"
            >
              <PlusIcon size={14} />
              Require Badge
            </button>
          )}
        </div>

        {/* Add requirement dropdown */}
        {addingReq && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
            <p className="text-xs text-amber-700 font-medium mb-2">
              Students must pass this badge before accessing this unit:
            </p>
            <div className="flex flex-wrap gap-2">
              {unrequiredBadges.map((badge) => (
                <button
                  key={badge.id}
                  onClick={() => addRequirement(badge.id)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-sm text-amber-800 font-medium hover:bg-amber-100 transition disabled:opacity-50"
                >
                  <ShieldIcon size={14} color="#D97706" />
                  {badge.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {requirements.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center text-gray-400 text-sm">
            No badges required for this unit. Students can access lessons immediately.
          </div>
        ) : (
          <div className="space-y-2">
            {requirements.map((req) => (
              <RequiredBadgeRow
                key={req.id}
                requirement={req}
                students={students}
                results={badgeResults[req.badge_id]}
                expanded={expandedBadge === req.badge_id}
                onToggle={() => toggleExpand(req.badge_id)}
                onRemove={() => removeRequirement(req.id)}
                onGrant={(studentId) => grantBadge(req.badge_id, studentId)}
                grantingBadge={grantingBadge}
                setGrantingBadge={setGrantingBadge}
                grantStudentId={grantStudentId}
                setGrantStudentId={setGrantStudentId}
                saving={saving}
              />
            ))}
          </div>
        )}
      </div>

      {/* ═══ All Badges List ═══ */}
      <div>
        <h3 className="font-bold text-base text-gray-900 mb-3 flex items-center gap-2">
          <ShieldIcon size={18} color="#7C3AED" />
          All Badges
        </h3>
        {badges.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
            <p className="text-gray-500 text-sm mb-3">No safety badges created yet.</p>
            <a
              href="/teacher/safety/create"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition"
            >
              <PlusIcon size={14} />
              Create Your First Badge
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {badges.map((badge) => (
              <BadgeRow
                key={badge.id}
                badge={badge}
                isRequired={requiredBadgeIds.has(badge.id)}
                students={students}
                results={badgeResults[badge.id]}
                expanded={expandedBadge === badge.id}
                onToggle={() => toggleExpand(badge.id)}
                onGrant={(studentId) => grantBadge(badge.id, studentId)}
                grantingBadge={grantingBadge}
                setGrantingBadge={setGrantingBadge}
                grantStudentId={grantStudentId}
                setGrantStudentId={setGrantStudentId}
                saving={saving}
              />
            ))}
          </div>
        )}

        <div className="mt-4 text-center">
          <a
            href="/teacher/safety/create"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition"
          >
            <PlusIcon size={14} />
            Create New Badge
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Required Badge Row ──────────────────────────────────────────────────────
function RequiredBadgeRow({
  requirement,
  students,
  results,
  expanded,
  onToggle,
  onRemove,
  onGrant,
  grantingBadge,
  setGrantingBadge,
  grantStudentId,
  setGrantStudentId,
  saving,
}: {
  requirement: Requirement;
  students: Student[];
  results: StudentResult[] | undefined;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onGrant: (studentId: string) => void;
  grantingBadge: string | null;
  setGrantingBadge: (id: string | null) => void;
  grantStudentId: string;
  setGrantStudentId: (id: string) => void;
  saving: boolean;
}) {
  const passedStudents = results?.filter((r) => r.status === "active") || [];
  const passCount = passedStudents.length;
  const totalStudents = students.length;

  return (
    <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50/50 transition text-left"
      >
        <ChevronIcon open={expanded} />
        <ShieldIcon size={18} color="#D97706" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900">{requirement.badge_name}</div>
          <div className="text-xs text-gray-500">
            Required — {passCount}/{totalStudents} students passed
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            passCount === totalStudents && totalStudents > 0
              ? "bg-green-100 text-green-700"
              : passCount > 0
                ? "bg-amber-100 text-amber-700"
                : "bg-gray-100 text-gray-500"
          }`}>
            {totalStudents > 0 ? Math.round((passCount / totalStudents) * 100) : 0}%
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-amber-100 px-4 py-3 bg-amber-50/30">
          <StudentResultsList
            students={students}
            results={results}
            badgeId={requirement.badge_id}
            onGrant={onGrant}
            grantingBadge={grantingBadge}
            setGrantingBadge={setGrantingBadge}
            grantStudentId={grantStudentId}
            setGrantStudentId={setGrantStudentId}
            saving={saving}
          />
          <div className="mt-3 pt-3 border-t border-amber-200 flex justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              disabled={saving}
              className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
            >
              Remove requirement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── All Badges Row ──────────────────────────────────────────────────────────
function BadgeRow({
  badge,
  isRequired,
  students,
  results,
  expanded,
  onToggle,
  onGrant,
  grantingBadge,
  setGrantingBadge,
  grantStudentId,
  setGrantStudentId,
  saving,
}: {
  badge: Badge;
  isRequired: boolean;
  students: Student[];
  results: StudentResult[] | undefined;
  expanded: boolean;
  onToggle: () => void;
  onGrant: (studentId: string) => void;
  grantingBadge: string | null;
  setGrantingBadge: (id: string | null) => void;
  grantStudentId: string;
  setGrantStudentId: (id: string) => void;
  saving: boolean;
}) {
  const passedStudents = results?.filter((r) => r.status === "active") || [];
  const questionsCount = badge.question_pool?.length || 0;

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${isRequired ? "border-amber-200" : "border-gray-200"}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
      >
        <ChevronIcon open={expanded} />
        <ShieldIcon size={18} color={isRequired ? "#D97706" : "#7C3AED"} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 flex items-center gap-2">
            {badge.name}
            {isRequired && (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase">
                Required
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {questionsCount} question{questionsCount !== 1 ? "s" : ""} · {badge.pass_threshold}% to pass
            {results && ` · ${passedStudents.length}/${students.length} passed`}
          </div>
        </div>
        {badge.description && (
          <span className="text-xs text-gray-400 hidden sm:block max-w-[200px] truncate">
            {badge.description}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/30">
          <StudentResultsList
            students={students}
            results={results}
            badgeId={badge.id}
            onGrant={onGrant}
            grantingBadge={grantingBadge}
            setGrantingBadge={setGrantingBadge}
            grantStudentId={grantStudentId}
            setGrantStudentId={setGrantStudentId}
            saving={saving}
          />
          <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
            <a
              href={`/teacher/safety/${badge.id}`}
              className="text-xs text-purple-600 hover:text-purple-800 font-medium"
            >
              Edit badge questions →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Student Results List (shared) ───────────────────────────────────────────
function StudentResultsList({
  students,
  results,
  badgeId,
  onGrant,
  grantingBadge,
  setGrantingBadge,
  grantStudentId,
  setGrantStudentId,
  saving,
}: {
  students: Student[];
  results: StudentResult[] | undefined;
  badgeId: string;
  onGrant: (studentId: string) => void;
  grantingBadge: string | null;
  setGrantingBadge: (id: string | null) => void;
  grantStudentId: string;
  setGrantStudentId: (id: string) => void;
  saving: boolean;
}) {
  if (!results) {
    return <div className="text-xs text-gray-400 py-2 animate-pulse">Loading results...</div>;
  }

  // Build lookup: studentId → result
  const resultMap = new Map<string, StudentResult>();
  for (const r of results) {
    // Keep the best result per student (highest score)
    const existing = resultMap.get(r.student_id);
    if (!existing || r.score > existing.score) {
      resultMap.set(r.student_id, r);
    }
  }

  if (students.length === 0) {
    return <div className="text-xs text-gray-400 py-2">No students in this class.</div>;
  }

  return (
    <div className="space-y-1">
      {students.map((student) => {
        const result = resultMap.get(student.id);
        const passed = result?.status === "active";
        const granted = result?.granted_by != null;
        const failed = result && !passed;
        const notAttempted = !result;

        return (
          <div
            key={student.id}
            className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-white/60 transition"
          >
            {/* Status indicator */}
            <div className="w-5 flex justify-center">
              {passed ? (
                <CheckIcon size={16} />
              ) : failed ? (
                <XIcon size={14} />
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
              )}
            </div>

            {/* Student name */}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-800">
                {student.display_name || student.username}
              </span>
            </div>

            {/* Status + score */}
            <div className="flex items-center gap-2">
              {passed && (
                <span className="text-xs font-semibold text-green-600">
                  {granted ? "Granted" : `${result.score}%`}
                </span>
              )}
              {failed && (
                <span className="text-xs font-semibold text-red-500">
                  Failed ({result.score}%)
                </span>
              )}
              {notAttempted && (
                <span className="text-xs text-gray-400">Not attempted</span>
              )}

              {/* Grant button for students who haven't passed */}
              {!passed && (
                <>
                  {grantingBadge === `${badgeId}:${student.id}` ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onGrant(student.id)}
                        disabled={saving}
                        className="px-2 py-1 bg-purple-600 text-white text-xs font-semibold rounded-md hover:bg-purple-700 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => { setGrantingBadge(null); setGrantStudentId(""); }}
                        className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setGrantingBadge(`${badgeId}:${student.id}`); setGrantStudentId(student.id); }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 rounded-md transition"
                      title="Grant badge directly"
                    >
                      <GiftIcon size={12} />
                      Grant
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
