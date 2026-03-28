"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DiscoveryProfile, DesignArchetype, WorkingStyleVector } from "@/lib/discovery/types";

/**
 * StudentDiscoveryProfile — Teacher-facing view of a student's Discovery Engine profile.
 *
 * Shows archetype scores, working style, interests, irritations, fear areas, and
 * project statement when a student has completed the Identity module (S0-S3) or beyond.
 *
 * Mount on:
 * - /teacher/students/[studentId] (per-student dashboard)
 * - Teaching Mode student cards (future)
 * - Class progress page (future)
 */

const ARCHETYPE_COLORS: Record<DesignArchetype, string> = {
  Maker: "#f97316",
  Researcher: "#3b82f6",
  Leader: "#ef4444",
  Communicator: "#8b5cf6",
  Creative: "#ec4899",
  Systems: "#10b981",
};

const ARCHETYPE_ICONS: Record<DesignArchetype, string> = {
  Maker: "🔨",
  Researcher: "🔬",
  Leader: "📋",
  Communicator: "📣",
  Creative: "🎨",
  Systems: "⚙️",
};

const STYLE_LABELS: Record<keyof WorkingStyleVector, { label: string; options: [string, string] }> = {
  planning: { label: "Planning", options: ["Planner", "Improviser"] },
  social: { label: "Social", options: ["Collaborative", "Independent"] },
  structure: { label: "Structure", options: ["Structured", "Flexible"] },
  energy: { label: "Energy", options: ["Deep Focus", "Burst"] },
  decision: { label: "Decisions", options: ["Gut Feeling", "Analytical"] },
  risk: { label: "Risk", options: ["Risk Taker", "Reliable"] },
  pace: { label: "Pace", options: ["Slow Build", "Fast Start"] },
  feedback: { label: "Feedback", options: ["Specific", "Big Picture"] },
  scope: { label: "Scope", options: ["Depth", "Breadth"] },
  expression: { label: "Expression", options: ["Visual", "Verbal"] },
  learning_intake: { label: "Learning", options: ["Study", "Experiment"] },
  learning_source: { label: "Source", options: ["Example", "Concept"] },
  autonomy: { label: "Autonomy", options: ["Guided", "Independent"] },
  stress_response: { label: "Stress", options: ["Calm", "Energized"] },
};

interface Props {
  studentId: string;
  /** When true, profile renders fully expanded (used on Discovery tab) */
  defaultExpanded?: boolean;
}

export function StudentDiscoveryProfile({ studentId, defaultExpanded = false }: Props) {
  const [profile, setProfile] = useState<DiscoveryProfile | null>(null);
  const [sessionMeta, setSessionMeta] = useState<{ unit_title: string; completed_at: string | null; mode: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Get the most recent completed (or most progressed) discovery session for this student
      const { data: sessions } = await supabase
        .from("discovery_sessions")
        .select("id, unit_id, profile, completed_at, mode, state")
        .eq("student_id", studentId)
        .order("started_at", { ascending: false })
        .limit(5);

      if (!sessions || sessions.length === 0) {
        setLoading(false);
        return;
      }

      // Prefer completed session, otherwise most recent
      const completed = sessions.find((s: any) => s.completed_at);
      const best = completed || sessions[0];
      const prof = best.profile as DiscoveryProfile | null;

      if (!prof || prof.lastStationCompleted < 2) {
        // Need at least through S2 (archetype scenarios) to show meaningful data
        setLoading(false);
        return;
      }

      // Get unit title for context
      const { data: unitData } = await supabase
        .from("units")
        .select("title")
        .eq("id", best.unit_id)
        .single();

      setProfile(prof);
      setSessionMeta({
        unit_title: unitData?.title || "Unknown unit",
        completed_at: best.completed_at,
        mode: best.mode || "mode_2",
      });
      setLoading(false);
    }

    load();
  }, [studentId]);

  if (loading) return null; // Silent loading — don't show skeleton for optional data
  if (!profile) return null; // No discovery data — don't show section at all

  const sortedArchetypes = Object.entries(profile.archetypeScores)
    .sort(([, a], [, b]) => b - a) as [DesignArchetype, number][];

  const primary = sortedArchetypes[0];
  const secondary = sortedArchetypes[1];
  const stationsCompleted = profile.lastStationCompleted + 1;

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl hover:border-purple-300 transition group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-lg">
            🧑‍🎨
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">Discovery Profile</span>
              {sessionMeta?.completed_at && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 rounded-full">
                  Complete
                </span>
              )}
              {!sessionMeta?.completed_at && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 rounded-full">
                  {stationsCompleted}/8 stations
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {primary[0]} {ARCHETYPE_ICONS[primary[0]]} · {secondary[0]} {ARCHETYPE_ICONS[secondary[0]]}
              {sessionMeta && <span className="ml-2 text-gray-400">via {sessionMeta.unit_title}</span>}
            </p>
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2 bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* Archetype Scores */}
          <div className="p-5 border-b border-gray-100">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
              Design Archetype
            </h4>
            <div className="space-y-2.5">
              {sortedArchetypes.map(([archetype, score], idx) => (
                <div key={archetype} className="flex items-center gap-3">
                  <span className="text-base w-6 text-center">{ARCHETYPE_ICONS[archetype]}</span>
                  <span className="text-xs font-medium text-gray-700 w-24">{archetype}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${score}%`,
                        backgroundColor: ARCHETYPE_COLORS[archetype],
                        opacity: idx === 0 ? 1 : idx === 1 ? 0.8 : 0.5,
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-500 w-8 text-right">{Math.round(score)}</span>
                </div>
              ))}
            </div>

            {/* Primary / Secondary labels */}
            <div className="flex gap-3 mt-3">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: ARCHETYPE_COLORS[primary[0]] }}
              >
                {ARCHETYPE_ICONS[primary[0]]} Primary: {primary[0]}
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                style={{ borderColor: ARCHETYPE_COLORS[secondary[0]], color: ARCHETYPE_COLORS[secondary[0]] }}
              >
                {ARCHETYPE_ICONS[secondary[0]]} Secondary: {secondary[0]}
              </span>
            </div>
          </div>

          {/* Working Style */}
          {profile.workingStyle && (
            <div className="p-5 border-b border-gray-100">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
                Working Style
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(profile.workingStyle).map(([key, value]) => {
                  const meta = STYLE_LABELS[key as keyof WorkingStyleVector];
                  if (!meta) return null;
                  const isFirst = meta.options[0].toLowerCase().replace(/\s+/g, '_') === value;
                  const displayLabel = isFirst ? meta.options[0] : meta.options[1];
                  return (
                    <span key={key} className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-200">
                      {displayLabel}
                    </span>
                  );
                })}
              </div>
              {profile.dominantStyle && (
                <p className="text-xs text-gray-500 mt-2">
                  Dominant style: <span className="font-semibold text-gray-700 capitalize">{profile.dominantStyle}</span>
                </p>
              )}
            </div>
          )}

          {/* Interests & Irritations (from S3) */}
          {profile.lastStationCompleted >= 3 && (
            <div className="p-5 border-b border-gray-100">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
                Interests & Motivations
              </h4>
              {profile.station3?.interests && profile.station3.interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {profile.station3.interests.map((interest: string) => (
                    <span key={interest} className="inline-flex px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200 capitalize">
                      {interest.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
              {profile.station3?.irritationFreeText && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">What bothers them</div>
                  <p className="text-xs text-gray-700 italic">&ldquo;{profile.station3.irritationFreeText}&rdquo;</p>
                </div>
              )}
              {profile.station3?.valuesRanking?.core && profile.station3.valuesRanking.core.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Core Values</div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.station3.valuesRanking.core.map((val: string) => (
                      <span key={val} className="inline-flex px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium border border-purple-200 capitalize">
                        {val.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Self-Efficacy (from S5) */}
          {profile.lastStationCompleted >= 5 && profile.station5?.selfEfficacy && (
            <div className="p-5 border-b border-gray-100">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
                Self-Efficacy
              </h4>
              <div className="space-y-2">
                {Object.entries(profile.station5.selfEfficacy).map(([skill, rating]) => (
                  <div key={skill} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-40 capitalize">{skill.replace(/_/g, ' ')}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5, 6, 7].map((level) => (
                        <div
                          key={level}
                          className="w-5 h-3 rounded-sm"
                          style={{
                            backgroundColor: level <= (rating as number) ? '#7c3aed' : '#f1f5f9',
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-gray-500">{rating as number}/7</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fear Areas & Project (from S6-S7) */}
          {profile.lastStationCompleted >= 6 && (
            <div className="p-5">
              {profile.station6?.fearCards && profile.station6.fearCards.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Growth Areas (Fears)
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.station6.fearCards.map((fear: string) => (
                      <span key={fear} className="inline-flex px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-xs font-medium border border-red-200">
                        {fear}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.station7?.projectStatement && (
                <div className="p-3 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-1">Project Statement</div>
                  <p className="text-sm text-gray-800">{profile.station7.projectStatement}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
