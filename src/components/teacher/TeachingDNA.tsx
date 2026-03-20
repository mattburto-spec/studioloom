'use client';

import { useMemo } from 'react';
import { TeacherStyleProfile } from '@/types/teacher-style';

interface TeachingDNAProps {
  profile: TeacherStyleProfile;
  className?: string;
}

interface RadarDimensions {
  practical: number;
  scaffolding: number;
  critique: number;
  autonomy: number;
  digital: number;
  making: number;
}

interface Archetype {
  name: string;
  description: string;
  emoji: string;
}

/**
 * Compute the 6 radar dimensions from teacher style profile data.
 */
function computeRadarDimensions(profile: TeacherStyleProfile): RadarDimensions {
  // 1. PRACTICAL: inverted theory:practical ratio
  // If practical is 70% of lessons, this is high practical
  const practicalRatio = 1 - profile.lessonPatterns.averageTheoryPracticalRatio;
  const practical = Math.round(practicalRatio * 100);

  // 2. SCAFFOLDING: inferred from what they DELETE
  // More deletions of scaffolding = lower scaffolding preference
  const deletedScaffolding = profile.editPatterns.frequentlyDeletedSections.filter(
    (s) => s.toLowerCase().includes('scaffold') ||
           s.toLowerCase().includes('support') ||
           s.toLowerCase().includes('starter') ||
           s.toLowerCase().includes('guided')
  ).length;
  const scaffolding = Math.max(0, 100 - (deletedScaffolding * 15));

  // 3. CRITIQUE: frequency of critique-related activities
  const critiqueActivities = ['critique', 'gallery walk', 'peer review', 'feedback', 'presentation'];
  const critiqueCount = profile.lessonPatterns.preferredActivityTypes.reduce((sum, a) => {
    if (critiqueActivities.some(c => a.type.toLowerCase().includes(c))) {
      return sum + a.frequency;
    }
    return sum;
  }, 0);
  const totalActivities = profile.lessonPatterns.preferredActivityTypes.reduce((sum, a) => sum + a.frequency, 0);
  const critique = totalActivities > 0 ? Math.round((critiqueCount / totalActivities) * 100) : 30;

  // 4. AUTONOMY: inferred from deletions of scaffolding
  // If they delete a lot of scaffolding, they prefer student autonomy
  const autonomy = Math.min(100, deletedScaffolding * 20 + (profile.editPatterns.frequentlyDeletedSections.length > 0 ? 20 : 0));

  // 5. DIGITAL: frequency of digital/CAD/research activities
  const digitalActivities = ['cad', 'research', 'digital', 'technology', 'coding', 'prototype'];
  const digitalCount = profile.lessonPatterns.preferredActivityTypes.reduce((sum, a) => {
    if (digitalActivities.some(d => a.type.toLowerCase().includes(d))) {
      return sum + a.frequency;
    }
    return sum;
  }, 0);
  const digital = totalActivities > 0 ? Math.round((digitalCount / totalActivities) * 100) : 25;

  // 6. MAKING: frequency of hands-on/making/workshop activities
  const makingActivities = ['making', 'workshop', 'hands-on', 'build', 'construction', 'prototype'];
  const makingCount = profile.lessonPatterns.preferredActivityTypes.reduce((sum, a) => {
    if (makingActivities.some(m => a.type.toLowerCase().includes(m))) {
      return sum + a.frequency;
    }
    return sum;
  }, 0);
  const making = totalActivities > 0 ? Math.round((makingCount / totalActivities) * 100) : 35;

  return {
    practical: Math.min(100, Math.max(0, practical)),
    scaffolding: Math.min(100, Math.max(0, scaffolding)),
    critique: Math.min(100, Math.max(0, critique)),
    autonomy: Math.min(100, Math.max(0, autonomy)),
    digital: Math.min(100, Math.max(0, digital)),
    making: Math.min(100, Math.max(0, making)),
  };
}

/**
 * Determine teaching archetype based on radar dimensions.
 */
function getArchetype(dims: RadarDimensions): Archetype {
  const { practical, scaffolding, critique, autonomy, digital, making } = dims;

  if (making > 70 && practical > 60) {
    return {
      name: 'Workshop Mentor',
      description: 'You lead with making. Short demos, long workshops, heavy critique culture.',
      emoji: '🔨',
    };
  }

  if (critique > 70 && autonomy > 60) {
    return {
      name: 'Studio Director',
      description: 'You run a critique-heavy studio. Students drive their own learning with constant feedback.',
      emoji: '🎨',
    };
  }

  if (scaffolding > 70 && practical < 40) {
    return {
      name: 'Structured Guide',
      description: 'You build careful scaffolding. Step-by-step instruction with rich support.',
      emoji: '📋',
    };
  }

  if (digital > 70) {
    return {
      name: 'Digital Pioneer',
      description: 'You favour digital tools and CAD. Research and documentation feature heavily.',
      emoji: '💻',
    };
  }

  if (autonomy > 70 && scaffolding < 30) {
    return {
      name: 'Discovery Facilitator',
      description: 'You step back and let students figure it out. Minimal scaffolding, maximum agency.',
      emoji: '🔍',
    };
  }

  return {
    name: 'Balanced Designer',
    description: 'You blend theory and hands-on work with a balanced, flexible teaching approach.',
    emoji: '⚖️',
  };
}

/**
 * Compute confidence percentage (0-100) and next milestone.
 */
function getConfidenceMetrics(profile: TeacherStyleProfile): {
  percentage: number;
  level: string;
  nextMilestone: string;
  dataPoints: number;
} {
  const dataPoints =
    profile.lessonPatterns.uploadCount +
    profile.editPatterns.editCount +
    profile.totalUnitsCreated +
    profile.gradingStyle.gradingSessionCount;

  if (dataPoints < 5) {
    return {
      percentage: Math.round((dataPoints / 5) * 60),
      level: 'Cold Start',
      nextMilestone: `Upload ${5 - dataPoints} more lessons to reach Learning`,
      dataPoints,
    };
  }

  if (dataPoints < 20) {
    return {
      percentage: 20 + Math.round(((dataPoints - 5) / 15) * 40),
      level: 'Learning',
      nextMilestone: `Add ${20 - dataPoints} more data points to reach Established`,
      dataPoints,
    };
  }

  return {
    percentage: 100,
    level: 'Established',
    nextMilestone: 'Your teaching DNA is fully formed. Keep going!',
    dataPoints,
  };
}

/**
 * SVG Radar Chart Component
 */
function RadarChart({ dimensions }: { dimensions: RadarDimensions }) {
  const size = 280;
  const center = size / 2;
  const maxValue = 100;
  const radius = (size / 2) * 0.75;

  const axes = [
    { label: 'Making', value: dimensions.making },
    { label: 'Practical', value: dimensions.practical },
    { label: 'Digital', value: dimensions.digital },
    { label: 'Critique', value: dimensions.critique },
    { label: 'Autonomy', value: dimensions.autonomy },
    { label: 'Scaffolding', value: dimensions.scaffolding },
  ];

  const angleSlice = (Math.PI * 2) / axes.length;

  // Convert polar to cartesian
  const getCoordinates = (value: number, index: number) => {
    const angle = angleSlice * index - Math.PI / 2;
    const r = (value / maxValue) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Generate grid hexagons
  const gridLevels = [25, 50, 75];
  const gridHexagons = gridLevels.map((level) => {
    const points = axes.map((_, i) => {
      const coords = getCoordinates(level, i);
      return `${coords.x},${coords.y}`;
    });
    return points.join(' ');
  });

  // Main data polygon
  const dataPoints = axes.map((axis, i) => {
    const coords = getCoordinates(axis.value, i);
    return `${coords.x},${coords.y}`;
  });

  // Axis labels (positioned at 100 radius)
  const labels = axes.map((axis, i) => {
    const labelRadius = radius + 35;
    const angle = angleSlice * i - Math.PI / 2;
    return {
      label: axis.label,
      x: center + labelRadius * Math.cos(angle),
      y: center + labelRadius * Math.sin(angle),
    };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
      {/* Grid background */}
      <defs>
        <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(123, 47, 242, 0.15)" />
          <stop offset="100%" stopColor="rgba(123, 47, 242, 0)" />
        </radialGradient>
      </defs>

      {/* Grid hexagons */}
      {gridHexagons.map((points, i) => (
        <polygon
          key={`grid-${i}`}
          points={points}
          fill="none"
          stroke="rgba(200, 200, 200, 0.3)"
          strokeWidth="0.5"
        />
      ))}

      {/* Outer hexagon border */}
      <polygon
        points={axes.map((_, i) => {
          const coords = getCoordinates(100, i);
          return `${coords.x},${coords.y}`;
        }).join(' ')}
        fill="none"
        stroke="rgba(150, 150, 150, 0.4)"
        strokeWidth="1"
      />

      {/* Data polygon fill */}
      <polygon
        points={dataPoints.join(' ')}
        fill="url(#radarGradient)"
        fillOpacity="0.3"
        stroke="#7B2FF2"
        strokeWidth="2.5"
      />

      {/* Data dots */}
      {dataPoints.map((point, i) => {
        const [x, y] = point.split(',').map(Number);
        return (
          <circle
            key={`dot-${i}`}
            cx={x}
            cy={y}
            r="3.5"
            fill="#7B2FF2"
            stroke="white"
            strokeWidth="1.5"
          />
        );
      })}

      {/* Radial lines */}
      {axes.map((_, i) => {
        const coords = getCoordinates(100, i);
        return (
          <line
            key={`line-${i}`}
            x1={center}
            y1={center}
            x2={coords.x}
            y2={coords.y}
            stroke="rgba(180, 180, 180, 0.2)"
            strokeWidth="0.5"
          />
        );
      })}

      {/* Axis labels */}
      {labels.map((label, i) => (
        <text
          key={`label-${i}`}
          x={label.x}
          y={label.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs font-semibold"
          fill="#666"
          fontSize="11"
        >
          {label.label}
        </text>
      ))}
    </svg>
  );
}

/**
 * Confidence Meter Component
 */
function ConfidenceMeter({ confidence, level, nextMilestone }: {
  confidence: number;
  level: string;
  nextMilestone: string;
}) {
  let color = 'bg-red-200';
  let barColor = 'bg-red-500';
  if (level === 'Learning') {
    color = 'bg-amber-100';
    barColor = 'bg-amber-500';
  } else if (level === 'Established') {
    color = 'bg-green-100';
    barColor = 'bg-green-500';
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Confidence</span>
        <span className="text-xs font-mono text-gray-600">{confidence}%</span>
      </div>
      <div className={`h-2.5 rounded-full ${color} overflow-hidden`}>
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{nextMilestone}</p>
    </div>
  );
}

/**
 * Main TeachingDNA Component
 */
export function TeachingDNA({ profile, className = '' }: TeachingDNAProps) {
  const { dimensions, archetype, confidence } = useMemo(() => {
    const dims = computeRadarDimensions(profile);
    return {
      dimensions: dims,
      archetype: getArchetype(dims),
      confidence: getConfidenceMetrics(profile),
    };
  }, [profile]);

  const isColdStart = profile.lessonPatterns.uploadCount === 0 &&
    profile.editPatterns.editCount === 0 &&
    profile.totalUnitsCreated === 0;

  if (isColdStart) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white p-8 shadow-sm ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">Your Teaching DNA</h2>
          <div className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            🌱 Starting
          </div>
        </div>

        <div className="space-y-4 text-center py-12">
          <div className="text-5xl">🧬</div>
          <h3 className="text-xl font-semibold text-gray-900">Keep teaching — your DNA will emerge</h3>
          <p className="text-sm text-gray-600 max-w-sm mx-auto">
            Upload lesson plans, create units, and edit content. After a few interactions, your unique teaching style will come into focus.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Your Teaching DNA</h2>
          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
            confidence.level === 'Established'
              ? 'bg-green-100 text-green-700'
              : confidence.level === 'Learning'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {confidence.level === 'Established' && '🟢'}
            {confidence.level === 'Learning' && '🟡'}
            {confidence.level === 'Cold Start' && '🔵'}
            {' '}{confidence.level}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Radar + Archetype Row */}
        <div className="grid grid-cols-2 gap-6">
          {/* Radar Chart */}
          <div className="flex justify-center">
            <RadarChart dimensions={dimensions} />
          </div>

          {/* Archetype Card */}
          <div className="flex flex-col justify-center">
            <div className="text-4xl mb-3">{archetype.emoji}</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{archetype.name}</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{archetype.description}</p>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Stats */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600">Lessons Uploaded</p>
              <p className="text-lg font-bold text-gray-900">{profile.lessonPatterns.uploadCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Units Created</p>
              <p className="text-lg font-bold text-gray-900">{profile.totalUnitsCreated}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Avg Lesson Length</p>
              <p className="text-lg font-bold text-gray-900">{profile.lessonPatterns.averageLessonLength} min</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Theory:Practical</p>
              <p className="text-lg font-bold text-gray-900">
                {Math.round(profile.lessonPatterns.averageTheoryPracticalRatio * 100)}:
                {Math.round((1 - profile.lessonPatterns.averageTheoryPracticalRatio) * 100)}
              </p>
            </div>
          </div>
        </div>

        {/* Patterns */}
        {(profile.lessonPatterns.preferredActivityTypes.length > 0 ||
          profile.editPatterns.frequentlyDeletedSections.length > 0 ||
          profile.editPatterns.frequentlyAddedElements.length > 0 ||
          profile.editPatterns.averageTimingAdjustment !== 0) && (
          <>
            <hr className="border-gray-100" />
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Your Patterns</h3>

              {profile.lessonPatterns.preferredActivityTypes.length > 0 && (
                <div>
                  <p className="text-xs text-gray-600 mb-2">Most common activities</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.lessonPatterns.preferredActivityTypes.slice(0, 3).map((activity, i) => (
                      <span
                        key={i}
                        className="inline-block rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-900"
                      >
                        {activity.type}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.editPatterns.averageTimingAdjustment !== 0 && (
                <p className="text-xs text-gray-700">
                  {profile.editPatterns.averageTimingAdjustment < -2
                    ? `⏱ You typically shorten lessons by ~${Math.abs(Math.round(profile.editPatterns.averageTimingAdjustment))} min`
                    : profile.editPatterns.averageTimingAdjustment > 2
                    ? `⏱ You typically extend lessons by ~${Math.round(profile.editPatterns.averageTimingAdjustment)} min`
                    : '⏱ You keep timing close to AI suggestions'}
                </p>
              )}

              {profile.editPatterns.frequentlyDeletedSections.length > 0 && (
                <p className="text-xs text-gray-700">
                  🗑 You often remove: {profile.editPatterns.frequentlyDeletedSections.slice(0, 2).join(', ')}
                </p>
              )}

              {profile.editPatterns.frequentlyAddedElements.length > 0 && (
                <p className="text-xs text-gray-700">
                  ✨ You often add: {profile.editPatterns.frequentlyAddedElements.slice(0, 2).join(', ')}
                </p>
              )}
            </div>
          </>
        )}

        <hr className="border-gray-100" />

        {/* Confidence Meter */}
        <ConfidenceMeter
          confidence={confidence.percentage}
          level={confidence.level}
          nextMilestone={confidence.nextMilestone}
        />
      </div>
    </div>
  );
}
