"use client";

import { useState } from "react";
import type { WizardState, WizardDispatch } from "@/hooks/useWizardState";
import type { UnitType } from "@/lib/ai/unit-types";
import {
  getCriteriaForType,
  getCriterionKeys,
  MYP_GRADE_LEVELS,
  MYP_GLOBAL_CONTEXTS,
  MYP_KEY_CONCEPTS,
  MYP_RELATED_CONCEPTS_DESIGN,
  MYP_ATL_SKILL_CATEGORIES,
  SERVICE_COMMUNITY_CONTEXTS,
  SERVICE_SDG_OPTIONS,
  SERVICE_OUTCOMES,
  SERVICE_PARTNER_TYPES,
  PP_GOAL_TYPES,
  PP_PRESENTATION_FORMATS,
  INQUIRY_THEMES,
} from "@/lib/constants";

interface Props {
  state: WizardState;
  dispatch: WizardDispatch;
  onGenerate: () => void;
}

/* ── Curriculum Context dropdown options per unit type ── */
const ARCHITECT_CURRICULUM_OPTIONS: Record<UnitType, { label: string; value: string }[]> = {
  design: [
    { label: "IB MYP Design", value: "IB MYP Design" },
    { label: "GCSE Design & Technology", value: "GCSE Design & Technology" },
    { label: "A-Level Design & Technology", value: "A-Level Design & Technology" },
    { label: "IGCSE Design & Technology", value: "IGCSE Design & Technology" },
    { label: "Australian D&T (ACARA)", value: "ACARA Design & Technologies" },
    { label: "PLTW (Project Lead The Way)", value: "PLTW" },
  ],
  service: [
    { label: "IB MYP Community Project", value: "IB MYP Community Project" },
    { label: "IB MYP Service as Action", value: "IB MYP Service as Action" },
    { label: "IB DP CAS (Creativity, Activity, Service)", value: "IB DP CAS" },
    { label: "Duke of Edinburgh Award", value: "Duke of Edinburgh Award" },
    { label: "National Community Service (General)", value: "National Community Service" },
  ],
  personal_project: [
    { label: "IB MYP Personal Project", value: "IB MYP Personal Project" },
    { label: "PYP Exhibition (Grade 5/6)", value: "PYP Exhibition" },
    { label: "IB DP Extended Essay", value: "IB DP Extended Essay" },
    { label: "Independent Study / Capstone", value: "Independent Study" },
  ],
  inquiry: [
    { label: "IB MYP Interdisciplinary Unit", value: "IB MYP Interdisciplinary Unit" },
    { label: "PYP Unit of Inquiry", value: "PYP Unit of Inquiry" },
    { label: "Project-Based Learning (PBL)", value: "Project-Based Learning" },
    { label: "STEM / STEAM Inquiry", value: "STEM Inquiry" },
  ],
};

function ArchitectCurriculumPicker({
  unitType,
  value,
  onChange,
}: {
  unitType: UnitType;
  value: string;
  onChange: (v: string) => void;
}) {
  const options = ARCHITECT_CURRICULUM_OPTIONS[unitType] || [];
  const isCustom = value !== "" && !options.some((o) => o.value === value);
  const [showCustom, setShowCustom] = useState(isCustom);

  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={showCustom ? "__custom__" : value}
        onChange={(e) => {
          if (e.target.value === "__custom__") {
            setShowCustom(true);
            onChange("");
          } else {
            setShowCustom(false);
            onChange(e.target.value);
          }
        }}
        className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 appearance-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
      >
        <option value="">Select curriculum (optional)</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        <option value="__custom__">Other (type your own)...</option>
      </select>
      {showCustom && (
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your curriculum context..."
          className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
        />
      )}
    </div>
  );
}

const UNIT_TYPE_OPTIONS: Array<{
  type: UnitType;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = [
  {
    type: "design",
    label: "Design Project",
    shortLabel: "Design",
    icon: "✏️",
    description: "MYP Design Cycle — create a product or solution",
    color: "text-teal-700",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-300",
  },
  {
    type: "service",
    label: "Service Learning",
    shortLabel: "Service",
    icon: "🤝",
    description: "Community-focused — investigate, plan, act, reflect",
    color: "text-pink-700",
    bgColor: "bg-pink-50",
    borderColor: "border-pink-300",
  },
  {
    type: "personal_project",
    label: "Personal Project",
    shortLabel: "PP",
    icon: "🎯",
    description: "Extended self-directed project with process journal",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
  },
  {
    type: "inquiry",
    label: "Inquiry Unit",
    shortLabel: "Inquiry",
    icon: "🔍",
    description: "Question-driven — research, analyse, communicate",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-300",
  },
];

const ATL_SKILLS = ["Communication", "Social", "Self-management", "Research", "Thinking"];

export function ArchitectForm({ state, dispatch, onGenerate }: Props) {
  const unitType = state.input.unitType || "design";
  const criteria = getCriteriaForType(unitType);
  const criterionKeys = getCriterionKeys(unitType);

  const handleInputChange = (field: string, value: unknown) => {
    dispatch({ type: "SET_INPUT", key: field as keyof typeof state.input, value });
  };

  const handleJourneyInputChange = (field: string, value: unknown) => {
    dispatch({ type: "SET_JOURNEY_INPUT", key: field as keyof typeof state.journeyInput, value });
  };

  const handleCriteriaEmphasisChange = (criterion: string, value: number) => {
    dispatch({ type: "SET_EMPHASIS", criterion: criterion as any, value });
  };

  return (
    <div className="animate-slide-up w-full max-w-3xl mx-auto px-4">
      <div className="space-y-6">
        {/* Section 1: Unit Identity */}
        <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wide">Unit Identity</h3>

          {/* Unit Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wide">
              Unit Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {UNIT_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  onClick={() => handleInputChange("unitType", option.type)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    state.input.unitType === option.type
                      ? `${option.bgColor} border-${option.color} ring-2 ring-brand-purple/20`
                      : "bg-gray-50 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="text-2xl mb-1">{option.icon}</div>
                  <div className="text-xs font-bold">{option.shortLabel}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Topic/Goal */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
              Topic or Goal *
            </label>
            <textarea
              value={state.input.topic}
              onChange={(e) => handleInputChange("topic", e.target.value)}
              placeholder="e.g. Design a water bottle for outdoor enthusiasts"
              className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 resize-none"
              rows={3}
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
              Unit Title *
            </label>
            <input
              type="text"
              value={state.input.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="e.g. Sustainable Design Challenge"
              className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
            />
          </div>

          {/* Curriculum Context */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
              Curriculum Context (optional)
            </label>
            <ArchitectCurriculumPicker
              unitType={(state.input.unitType || "design") as UnitType}
              value={state.input.curriculumContext || ""}
              onChange={(v) => handleInputChange("curriculumContext", v)}
            />
          </div>
        </div>

        {/* Section 2: MYP Framework Fields */}
        <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wide">MYP Framework</h3>

          {/* Global Context */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
              Global Context
            </label>
            <select
              value={state.input.globalContext || ""}
              onChange={(e) => handleInputChange("globalContext", e.target.value)}
              className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
            >
              <option value="">Select a context...</option>
              {MYP_GLOBAL_CONTEXTS.map((context) => (
                <option key={context.value} value={context.value}>
                  {context.label}
                </option>
              ))}
            </select>
          </div>

          {/* Key Concept */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
              Key Concept
            </label>
            <select
              value={state.input.keyConcept || ""}
              onChange={(e) => handleInputChange("keyConcept", e.target.value)}
              className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
            >
              <option value="">Select a concept...</option>
              {MYP_KEY_CONCEPTS.map((concept) => (
                <option key={concept} value={concept}>
                  {concept}
                </option>
              ))}
            </select>
          </div>

          {/* Related Concepts */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
              Related Concepts (comma-separated)
            </label>
            <input
              type="text"
              value={(state.input.relatedConcepts || []).join(", ")}
              onChange={(e) =>
                handleInputChange(
                  "relatedConcepts",
                  e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                )
              }
              placeholder="e.g. Function, Innovation, Sustainability"
              className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
            />
          </div>

          {/* Statement of Inquiry */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
              Statement of Inquiry
            </label>
            <textarea
              value={state.input.statementOfInquiry || ""}
              onChange={(e) => handleInputChange("statementOfInquiry", e.target.value)}
              placeholder="e.g. How can we innovate solutions that are both functional and sustainable?"
              className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 resize-none"
              rows={3}
            />
          </div>

          {/* ATL Skills */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wide">
              ATL Skill Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {ATL_SKILLS.map((skill) => (
                <button
                  key={skill}
                  onClick={() => {
                    const current = state.input.atlSkills || [];
                    const updated = current.includes(skill)
                      ? current.filter((s) => s !== skill)
                      : [...current, skill];
                    handleInputChange("atlSkills", updated);
                  }}
                  className={`px-3 py-2 rounded-full text-xs font-semibold transition-all ${
                    (state.input.atlSkills || []).includes(skill)
                      ? "bg-brand-purple text-white"
                      : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 3: Type-Specific Fields */}
        {unitType === "service" && (
          <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wide">Service Learning Details</h3>

            {/* Community Context */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Community Context
              </label>
              <select
                value={state.journeyInput.communityContext || ""}
                onChange={(e) => handleJourneyInputChange("communityContext", e.target.value)}
                className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
              >
                <option value="">Select a context...</option>
                {SERVICE_COMMUNITY_CONTEXTS.map((context) => (
                  <option key={context} value={context}>
                    {context}
                  </option>
                ))}
              </select>
            </div>

            {/* SDG Connection */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Sustainable Development Goal
              </label>
              <select
                value={state.journeyInput.sdgConnection || ""}
                onChange={(e) => handleJourneyInputChange("sdgConnection", e.target.value)}
                className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
              >
                <option value="">Select an SDG...</option>
                {SERVICE_SDG_OPTIONS.map((sdg) => (
                  <option key={sdg} value={sdg}>
                    {sdg}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Outcomes */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Service Outcome
              </label>
              <select
                value={state.journeyInput.serviceOutcomes || ""}
                onChange={(e) => handleJourneyInputChange("serviceOutcomes", e.target.value)}
                className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
              >
                <option value="">Select an outcome...</option>
                {SERVICE_OUTCOMES.map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {outcome}
                  </option>
                ))}
              </select>
            </div>

            {/* Partner Type */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Partner Type
              </label>
              <select
                value={state.journeyInput.partnerType || ""}
                onChange={(e) => handleJourneyInputChange("partnerType", e.target.value)}
                className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
              >
                <option value="">Select a partner type...</option>
                {SERVICE_PARTNER_TYPES.map((partner) => (
                  <option key={partner} value={partner}>
                    {partner}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {unitType === "personal_project" && (
          <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wide">Personal Project Details</h3>

            {/* Personal Interest */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Personal Interest
              </label>
              <input
                type="text"
                value={state.journeyInput.personalInterest || ""}
                onChange={(e) => handleJourneyInputChange("personalInterest", e.target.value)}
                placeholder="What are you passionate about?"
                className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
              />
            </div>

            {/* Goal Type */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Goal Type
              </label>
              <select
                value={state.journeyInput.goalType || ""}
                onChange={(e) => handleJourneyInputChange("goalType", e.target.value)}
                className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
              >
                <option value="">Select a goal type...</option>
                {PP_GOAL_TYPES.map((goal) => (
                  <option key={goal} value={goal}>
                    {goal}
                  </option>
                ))}
              </select>
            </div>

            {/* Presentation Format */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Presentation Format
              </label>
              <select
                value={state.journeyInput.presentationFormat || ""}
                onChange={(e) => handleJourneyInputChange("presentationFormat", e.target.value)}
                className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
              >
                <option value="">Select a format...</option>
                {PP_PRESENTATION_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {unitType === "inquiry" && (
          <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wide">Inquiry Unit Details</h3>

            {/* Central Idea */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Central Idea
              </label>
              <textarea
                value={state.journeyInput.centralIdea || ""}
                onChange={(e) => handleJourneyInputChange("centralIdea", e.target.value)}
                placeholder="What is the overarching idea students will explore?"
                className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 resize-none"
                rows={2}
              />
            </div>

            {/* Transdisciplinary Theme */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Transdisciplinary Theme
              </label>
              <select
                value={state.journeyInput.transdisciplinaryTheme || ""}
                onChange={(e) => handleJourneyInputChange("transdisciplinaryTheme", e.target.value)}
                className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
              >
                <option value="">Select a theme...</option>
                {INQUIRY_THEMES.map((theme) => (
                  <option key={theme} value={theme}>
                    {theme}
                  </option>
                ))}
              </select>
            </div>

            {/* Lines of Inquiry */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Lines of Inquiry (comma-separated)
              </label>
              <textarea
                value={(state.journeyInput.linesOfInquiry || []).join("\n")}
                onChange={(e) =>
                  handleJourneyInputChange(
                    "linesOfInquiry",
                    e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)
                  )
                }
                placeholder="One line per row"
                className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 resize-none"
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Section 4: Duration & Grade */}
        <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wide">Duration & Grade Level</h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Grade Level */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Grade Level
              </label>
              <select
                value={state.input.gradeLevel || ""}
                onChange={(e) => handleInputChange("gradeLevel", e.target.value)}
                className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
              >
                <option value="">Select grade...</option>
                {Array.from({ length: 13 }, (_, i) => i + 1).map((grade) => (
                  <option key={grade} value={grade}>
                    Grade {grade}
                  </option>
                ))}
              </select>
            </div>

            {/* Duration Weeks */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Duration (weeks)
              </label>
              <input
                type="number"
                min="1"
                max="52"
                value={state.journeyInput.durationWeeks || ""}
                onChange={(e) => handleJourneyInputChange("durationWeeks", parseInt(e.target.value) || 0)}
                placeholder="e.g. 8"
                className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
              />
            </div>

            {/* Lessons per Week */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Lessons per week
              </label>
              <input
                type="number"
                min="1"
                max="7"
                value={state.journeyInput.lessonsPerWeek || ""}
                onChange={(e) => handleJourneyInputChange("lessonsPerWeek", parseInt(e.target.value) || 0)}
                placeholder="e.g. 2"
                className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
              />
            </div>

            {/* Lesson Length */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Lesson length (minutes)
              </label>
              <input
                type="number"
                min="15"
                max="240"
                step="5"
                value={state.journeyInput.lessonLengthMinutes || ""}
                onChange={(e) => handleJourneyInputChange("lessonLengthMinutes", parseInt(e.target.value) || 0)}
                placeholder="e.g. 60"
                className="w-full p-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Criteria Emphasis */}
        <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wide">Criteria Emphasis</h3>

          <div className="space-y-4">
            {criterionKeys.map((key) => {
              const criterion = criteria[key];
              const value = state.criteriaEmphasis[key] || 50;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-text-primary">
                      {criterion.name}
                    </label>
                    <span className="text-xs font-bold text-text-secondary">{value}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={value}
                    onChange={(e) => handleCriteriaEmphasisChange(key, parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-purple"
                  />
                  <div className="flex justify-between text-xs text-text-secondary mt-1">
                    <span>Light</span>
                    <span>Standard</span>
                    <span>Emphasis</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onGenerate}
            className="flex-1 px-6 py-3 rounded-2xl bg-brand-purple text-white font-bold hover:bg-brand-violet transition-all duration-200 shadow-lg shadow-brand-purple/20 hover:shadow-xl hover:shadow-brand-purple/30 hover:scale-[1.02]"
          >
            Generate Unit
          </button>
        </div>
      </div>
    </div>
  );
}
