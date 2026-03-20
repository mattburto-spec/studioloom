'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
// Inline SVG icons (no lucide-react dependency)
const ChevronDown = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
);
const ChevronUp = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
);
const RotateCcw = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
);
const Save = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>
);

/**
 * Camera-inspired AI Control Panel
 *
 * Features circular dials for macro controls, preset selection, and collapsible advanced settings.
 * All interactions are smooth and visually delightful.
 */

// Types
export interface MacroValues {
  teachingStyle: number; // 0-100 (teacher-led to student-led)
  theoryPracticalBalance: number; // 0-100 (theory to practical)
  scaffoldingLevel: number; // 0-100 (max support to minimal)
  lessonPace: number; // 0-100 (deep dive to fast)
  critiqueIntensity: number; // 0-100 (light to heavy)
  assessmentFocus: string[]; // ["A", "B", "C", "D"]
}

export interface SchoolProfile {
  periodMinutes: number;
  hasDoublePeriods: boolean;
  hasWorkshopAccess: boolean;
}

interface AIControlPanelProps {
  initialMacro?: MacroValues;
  initialSchool?: SchoolProfile;
  onMacroChange?: (macro: MacroValues) => void;
  onSchoolChange?: (school: SchoolProfile) => void;
  onSave?: (macro: MacroValues, school: SchoolProfile) => void;
}

// Preset definitions
const PRESETS = [
  {
    id: 'workshop-heavy',
    name: 'Workshop Heavy',
    icon: '🔨',
    description: 'Making-focused, minimal theory',
    values: {
      teachingStyle: 40,
      theoryPracticalBalance: 80,
      scaffoldingLevel: 40,
      lessonPace: 40,
      critiqueIntensity: 60,
      assessmentFocus: ['A', 'B', 'C', 'D'],
    },
  },
  {
    id: 'theory-balanced',
    name: 'Theory Balanced',
    icon: '⚖️',
    description: 'Equal theory and practical',
    values: {
      teachingStyle: 50,
      theoryPracticalBalance: 50,
      scaffoldingLevel: 50,
      lessonPace: 50,
      critiqueIntensity: 50,
      assessmentFocus: ['A', 'B', 'C', 'D'],
    },
  },
  {
    id: 'student-led',
    name: 'Student-Led',
    icon: '🎯',
    description: 'High autonomy, teacher as facilitator',
    values: {
      teachingStyle: 85,
      theoryPracticalBalance: 65,
      scaffoldingLevel: 70,
      lessonPace: 40,
      critiqueIntensity: 80,
      assessmentFocus: ['A', 'B', 'C', 'D'],
    },
  },
  {
    id: 'exam-prep',
    name: 'Exam Prep',
    icon: '📝',
    description: 'Assessment-focused, criterion-aligned',
    values: {
      teachingStyle: 30,
      theoryPracticalBalance: 40,
      scaffoldingLevel: 30,
      lessonPace: 60,
      critiqueIntensity: 40,
      assessmentFocus: ['A', 'B', 'C', 'D'],
    },
  },
  {
    id: 'first-unit',
    name: 'First Unit',
    icon: '🌱',
    description: 'Maximum scaffolding for new students',
    values: {
      teachingStyle: 25,
      theoryPracticalBalance: 45,
      scaffoldingLevel: 15,
      lessonPace: 35,
      critiqueIntensity: 30,
      assessmentFocus: ['A', 'B'],
    },
  },
  {
    id: 'advanced-independent',
    name: 'Advanced',
    icon: '🚀',
    description: 'Minimal scaffolding, deep work',
    values: {
      teachingStyle: 80,
      theoryPracticalBalance: 60,
      scaffoldingLevel: 85,
      lessonPace: 30,
      critiqueIntensity: 70,
      assessmentFocus: ['A', 'B', 'C', 'D'],
    },
  },
];

const DEFAULT_MACRO: MacroValues = {
  teachingStyle: 50,
  theoryPracticalBalance: 50,
  scaffoldingLevel: 50,
  lessonPace: 50,
  critiqueIntensity: 50,
  assessmentFocus: ['A', 'B', 'C', 'D'],
};

const DEFAULT_SCHOOL: SchoolProfile = {
  periodMinutes: 50,
  hasDoublePeriods: true,
  hasWorkshopAccess: true,
};

// Dial color mapping
const DIAL_COLORS: Record<string, { light: string; dark: string; rgb: string }> = {
  teachingStyle: { light: '#E0D5FF', dark: '#7B2FF2', rgb: '123, 47, 242' },
  theoryPracticalBalance: { light: '#D1F4E8', dark: '#10B981', rgb: '16, 185, 129' },
  scaffoldingLevel: { light: '#FEF08A', dark: '#D97706', rgb: '217, 119, 6' },
  lessonPace: { light: '#FBCFE8', dark: '#EC4899', rgb: '236, 72, 153' },
  critiqueIntensity: { light: '#E9D5FF', dark: '#A855F7', rgb: '168, 85, 247' },
};

// SVG Dial Component
interface DialProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  color: { light: string; dark: string; rgb: string };
  label: string;
  lowLabel: string;
  highLabel: string;
  unit?: string;
}

function Dial({
  value,
  onChange,
  min = 0,
  max = 100,
  color,
  label,
  lowLabel,
  highLabel,
  unit = '%',
}: DialProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Convert mouse position to dial value using angle from center
  const getValueFromMouse = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return value;
      const rect = svgRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // Angle from center (0 = right, increases clockwise)
      let angle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);

      // Our arc goes from 135° (bottom-left) to -135° (= 225° bottom-right) clockwise
      // Remap: 135° = 0%, going clockwise through 180°, -90° (top), 0° (right), to -135° = 100%
      // Normalize angle to 0-360
      if (angle < 0) angle += 360;

      // Arc starts at 135° and sweeps 270° clockwise
      // So: 135° = 0%, 225° = 33%, 315° = 67%, 45° (405°-360°) = 100%
      let normalized = angle - 135;
      if (normalized < 0) normalized += 360;

      // The dead zone is from 45° to 135° (the bottom gap)
      // normalized > 270 means we're in the dead zone
      if (normalized > 270) {
        // Clamp to nearest end
        return normalized > 315 ? min : max;
      }

      const pct = Math.max(0, Math.min(100, (normalized / 270) * 100));
      return Math.round(min + (pct / 100) * (max - min));
    },
    [value, min, max]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      setIsDragging(true);
      const newVal = getValueFromMouse(e.clientX, e.clientY);
      onChange(newVal);
    },
    [getValueFromMouse, onChange]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newVal = getValueFromMouse(e.clientX, e.clientY);
      onChange(newVal);
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, getValueFromMouse, onChange]);

  // Touch support
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      e.preventDefault();
      setIsDragging(true);
      const touch = e.touches[0];
      onChange(getValueFromMouse(touch.clientX, touch.clientY));
    },
    [getValueFromMouse, onChange]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) onChange(getValueFromMouse(touch.clientX, touch.clientY));
    };

    const handleTouchEnd = () => setIsDragging(false);

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, getValueFromMouse, onChange]);

  // SVG dimensions
  const size = 140;
  const trackRadius = 52;
  const cx = size / 2;
  const cy = size / 2;

  // Arc geometry: 270° sweep, starting at 135° (bottom-left), ending at 45° (bottom-right)
  // 0% = 135°, 100% = 405° (= 45°)
  const ARC_START_DEG = 135;
  const ARC_SWEEP_DEG = 270;
  const circumference = 2 * Math.PI * trackRadius; // full circle
  const arcLength = (ARC_SWEEP_DEG / 360) * circumference; // 270° portion
  const gapLength = circumference - arcLength; // 90° gap

  // Value as fraction 0-1
  const frac = (value - min) / (max - min);

  // Thumb position: angle in degrees from value fraction
  const thumbDeg = ARC_START_DEG + frac * ARC_SWEEP_DEG;
  const thumbRad = (thumbDeg * Math.PI) / 180;
  const thumbX = cx + trackRadius * Math.cos(thumbRad);
  const thumbY = cy + trackRadius * Math.sin(thumbRad);

  // SVG stroke-dasharray: the arc starts at 3 o'clock (0°) by default
  // We need to rotate it so it starts at 135°
  // stroke-dashoffset rotates the start point backwards along the path
  // To start at 135° (from the default 0°), offset by -(135/360)*circumference
  const startOffset = -(ARC_START_DEG / 360) * circumference;
  const valueDashLength = frac * arcLength;

  // Tick marks
  const ticks = Array.from({ length: 21 }, (_, i) => {
    const tickDeg = ARC_START_DEG + (i / 20) * ARC_SWEEP_DEG;
    const tickRad = (tickDeg * Math.PI) / 180;
    const isMajor = i % 5 === 0;
    const innerR = trackRadius - (isMajor ? 6 : 4);
    return (
      <line
        key={i}
        x1={cx + innerR * Math.cos(tickRad)}
        y1={cy + innerR * Math.sin(tickRad)}
        x2={cx + trackRadius * Math.cos(tickRad)}
        y2={cy + trackRadius * Math.sin(tickRad)}
        stroke={color.dark}
        strokeWidth={isMajor ? "2" : "1"}
        opacity={isMajor ? "0.4" : "0.2"}
      />
    );
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{
          touchAction: 'none',
          filter: isDragging
            ? `drop-shadow(0 0 20px rgba(${color.rgb}, 0.5))`
            : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
          transform: isDragging ? 'scale(1.06)' : 'scale(1)',
          transition: 'transform 0.15s ease, filter 0.15s ease',
        }}
      >
        {/* Background track (270° arc) */}
        <circle
          cx={cx}
          cy={cy}
          r={trackRadius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${gapLength}`}
          strokeDashoffset={startOffset}
        />

        {/* Value arc */}
        <circle
          cx={cx}
          cy={cy}
          r={trackRadius}
          fill="none"
          stroke={color.dark}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${valueDashLength} ${circumference - valueDashLength}`}
          strokeDashoffset={startOffset}
          style={{ filter: `drop-shadow(0 0 6px rgba(${color.rgb}, 0.3))` }}
          opacity="0.9"
        />

        {/* Tick marks */}
        {ticks}

        {/* Thumb indicator at current value position */}
        <circle
          cx={thumbX}
          cy={thumbY}
          r={isDragging ? 8 : 6}
          fill="#fff"
          stroke={color.dark}
          strokeWidth="3"
          style={{
            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.25))',
            cursor: 'grab',
          }}
        />

        {/* Center value display */}
        <circle
          cx={cx}
          cy={cy}
          r="22"
          fill={color.light}
          opacity="0.25"
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-bold select-none"
          fontSize="22"
          fill={color.dark}
        >
          {Math.round(frac * 100)}
        </text>
      </svg>

      {/* Label */}
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
      </div>

      {/* Range labels */}
      <div className="w-full flex justify-between text-xs text-gray-500 px-2">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

// Assessment Focus Pills
interface AssessmentFocusProps {
  value: string[];
  onChange: (value: string[]) => void;
}

function AssessmentFocus({ value, onChange }: AssessmentFocusProps) {
  const criteria = ['A', 'B', 'C', 'D'];

  const toggleCriteria = (criterion: string) => {
    if (value.includes(criterion)) {
      onChange(value.filter((c) => c !== criterion));
    } else {
      onChange([...value, criterion]);
    }
  };

  return (
    <div className="flex gap-2">
      {criteria.map((criterion) => (
        <button
          key={criterion}
          onClick={() => toggleCriteria(criterion)}
          className={`w-10 h-10 rounded-lg font-semibold transition-all ${
            value.includes(criterion)
              ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500'
              : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:border-gray-300'
          }`}
        >
          {criterion}
        </button>
      ))}
    </div>
  );
}

// School Profile Section
interface SchoolProfileProps {
  value: SchoolProfile;
  onChange: (value: SchoolProfile) => void;
}

function SchoolProfileSection({ value, onChange }: SchoolProfileProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">School Profile</h3>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Period Length</label>
          <select
            value={value.periodMinutes}
            onChange={(e) => onChange({ ...value, periodMinutes: parseInt(e.target.value) })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value={40}>40 min</option>
            <option value={50}>50 min</option>
            <option value={60}>60 min</option>
            <option value={80}>80 min</option>
            <option value={90}>90 min</option>
            <option value={100}>100 min</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Double Periods</label>
          <select
            value={value.hasDoublePeriods ? 'yes' : 'no'}
            onChange={(e) => onChange({ ...value, hasDoublePeriods: e.target.value === 'yes' })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Workshop Access</label>
          <select
            value={value.hasWorkshopAccess ? 'yes' : 'no'}
            onChange={(e) => onChange({ ...value, hasWorkshopAccess: e.target.value === 'yes' })}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// Main Component
export function AIControlPanel({
  initialMacro = DEFAULT_MACRO,
  initialSchool = DEFAULT_SCHOOL,
  onMacroChange,
  onSchoolChange,
  onSave,
}: AIControlPanelProps) {
  const [macro, setMacro] = useState<MacroValues>(initialMacro);
  const [school, setSchool] = useState<SchoolProfile>(initialSchool);
  const [expandedAdvanced, setExpandedAdvanced] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Determine active preset
  useEffect(() => {
    const matchedPreset = PRESETS.find(
      (p) =>
        p.values.teachingStyle === macro.teachingStyle &&
        p.values.theoryPracticalBalance === macro.theoryPracticalBalance &&
        p.values.scaffoldingLevel === macro.scaffoldingLevel &&
        p.values.lessonPace === macro.lessonPace &&
        p.values.critiqueIntensity === macro.critiqueIntensity &&
        JSON.stringify(p.values.assessmentFocus.sort()) === JSON.stringify(macro.assessmentFocus.sort())
    );
    setActivePreset(matchedPreset?.id || null);
  }, [macro]);

  const handleMacroChange = useCallback(
    (key: keyof MacroValues, value: any) => {
      const updated = { ...macro, [key]: value };
      setMacro(updated);
      onMacroChange?.(updated);
    },
    [macro, onMacroChange]
  );

  const handleSchoolChange = useCallback(
    (updated: SchoolProfile) => {
      setSchool(updated);
      onSchoolChange?.(updated);
    },
    [onSchoolChange]
  );

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setMacro(preset.values);
      onMacroChange?.(preset.values);
    }
  };

  const resetToDefault = () => {
    setMacro(DEFAULT_MACRO);
    onMacroChange?.(DEFAULT_MACRO);
  };

  const handleSave = () => {
    onSave?.(macro, school);
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      {/* Header */}
      <h2 className="text-2xl font-bold text-gray-900 mb-8">AI Configuration</h2>

      {/* Preset Bar */}
      <div className="mb-8 pb-8 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Presets</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:flex lg:flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activePreset === preset.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
              title={preset.description}
            >
              <span className="mr-2">{preset.icon}</span>
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Macro Controls - Dials */}
      <div className="mb-8 pb-8 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-6">Macro Controls</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
          <Dial
            value={macro.teachingStyle}
            onChange={(v) => handleMacroChange('teachingStyle', v)}
            color={DIAL_COLORS.teachingStyle}
            label="Teaching Style"
            lowLabel="Teacher-Led"
            highLabel="Student-Led"
          />
          <Dial
            value={macro.theoryPracticalBalance}
            onChange={(v) => handleMacroChange('theoryPracticalBalance', v)}
            color={DIAL_COLORS.theoryPracticalBalance}
            label="Theory:Practical"
            lowLabel="All Theory"
            highLabel="All Practical"
          />
          <Dial
            value={macro.scaffoldingLevel}
            onChange={(v) => handleMacroChange('scaffoldingLevel', v)}
            color={DIAL_COLORS.scaffoldingLevel}
            label="Scaffolding"
            lowLabel="Maximum"
            highLabel="Minimal"
          />
          <Dial
            value={macro.lessonPace}
            onChange={(v) => handleMacroChange('lessonPace', v)}
            color={DIAL_COLORS.lessonPace}
            label="Lesson Pace"
            lowLabel="Deep Dive"
            highLabel="Fast Pace"
          />
          <Dial
            value={macro.critiqueIntensity}
            onChange={(v) => handleMacroChange('critiqueIntensity', v)}
            color={DIAL_COLORS.critiqueIntensity}
            label="Critique"
            lowLabel="Light"
            highLabel="Heavy"
          />
        </div>

        {/* Assessment Focus */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-sm font-semibold text-gray-700 mb-3">Assessment Focus</p>
          <AssessmentFocus
            value={macro.assessmentFocus}
            onChange={(v) => handleMacroChange('assessmentFocus', v)}
          />
        </div>
      </div>

      {/* School profile note — settings live in Teacher Settings > School & Teaching */}
      <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        School profile (period length, workshop access) is set in <a href="/teacher/settings?tab=school" className="text-brand-purple hover:underline font-medium ml-0.5">Teacher Settings</a>
      </div>

      {/* Advanced Settings */}
      <div className="mt-8">
        <button
          onClick={() => setExpandedAdvanced(!expandedAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 py-3"
        >
          {expandedAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          Advanced Settings
        </button>
        {expandedAdvanced && (
          <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              50+ micro sliders — coming soon. These will let you fine-tune individual generation parameters.
            </p>
          </div>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="mt-8 pt-6 border-t border-gray-200 flex gap-3 justify-between">
        <button
          onClick={resetToDefault}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <RotateCcw size={16} />
          Reset to Default
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Save size={16} />
          Save Configuration
        </button>
      </div>
    </div>
  );
}
