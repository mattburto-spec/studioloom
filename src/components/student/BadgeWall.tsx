"use client";

import React from "react";

export interface SkillCert {
  id: string;
  name: string;
  icon: string;
  earned: boolean;
  grantedAt: string | null;
}

interface SkillsCertsProps {
  certs: SkillCert[];
}

/**
 * Compact horizontal strip showing teacher-granted workshop skill certifications.
 * Only shows earned certs — no wall of greyed-out badges.
 * If nothing earned yet, shows a single-line empty state.
 */
export function SkillsCerts({ certs }: SkillsCertsProps) {
  const earned = certs.filter((c) => c.earned);

  if (earned.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl border border-gray-200/60">
        <span className="text-sm text-gray-400">🛡️</span>
        <span className="text-xs text-gray-400">
          No workshop certifications yet — your teacher will grant these as you demonstrate skills
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {earned.map((cert) => (
        <div
          key={cert.id}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-green-200 shadow-sm"
          title={`Certified: ${cert.name}`}
        >
          <span className="text-sm">{cert.icon}</span>
          <span className="text-xs font-medium text-gray-700">{cert.name}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#10B981">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        </div>
      ))}
    </div>
  );
}
