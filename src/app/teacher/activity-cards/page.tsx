"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import type {
  ActivityCard,
  ActivityCardCategory,
  ThinkingType,
  GroupSize,
  ModifierAxis,
  CardAIHints,
} from "@/types/activity-cards";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: { value: ActivityCardCategory; label: string }[] = [
  { value: "design-thinking", label: "Design Thinking" },
  { value: "visible-thinking", label: "Visible Thinking" },
  { value: "evaluation", label: "Evaluation" },
  { value: "brainstorming", label: "Brainstorming" },
  { value: "analysis", label: "Analysis" },
  { value: "skills", label: "Skills" },
];

const THINKING_TYPES: { value: ThinkingType; label: string }[] = [
  { value: "creative", label: "Creative" },
  { value: "critical", label: "Critical" },
  { value: "analytical", label: "Analytical" },
  { value: "metacognitive", label: "Metacognitive" },
];

const GROUP_SIZES: { value: GroupSize; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "pairs", label: "Pairs" },
  { value: "small-group", label: "Small Group" },
  { value: "whole-class", label: "Whole Class" },
  { value: "flexible", label: "Flexible" },
];

const CRITERIA_OPTIONS = [
  { value: "A", label: "A — Inquiring & Analysing" },
  { value: "B", label: "B — Developing Ideas" },
  { value: "C", label: "C — Creating the Solution" },
  { value: "D", label: "D — Evaluating" },
];

const CATEGORY_COLORS: Record<ActivityCardCategory, string> = {
  "design-thinking": "#E86F2C",
  "visible-thinking": "#7B2FF2",
  evaluation: "#2DA05E",
  brainstorming: "#2E86AB",
  analysis: "#D63384",
  skills: "#6C757D",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActivityCardsPage() {
  const [cards, setCards] = useState<ActivityCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCard, setEditingCard] = useState<ActivityCard | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      const res = await fetch(`/api/teacher/activity-cards?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      }
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleDelete = async (card: ActivityCard) => {
    if (!confirm(`Delete "${card.name}"? This cannot be undone.`)) return;

    const res = await fetch("/api/teacher/activity-cards/manage", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: card.id }),
    });

    if (res.ok) {
      loadCards();
    } else {
      const err = await res.json();
      alert(err.error || "Failed to delete card");
    }
  };

  const systemCards = cards.filter((c) => c.source === "system");
  const teacherCards = cards.filter((c) => c.source !== "system");

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/teacher/dashboard"
              className="text-text-secondary hover:text-text-primary transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-text-primary">
              Activity Cards
            </h1>
          </div>
          <p className="text-text-secondary text-sm ml-8">
            Browse, create, and manage activity cards for your units. Cards can be dragged into the unit builder.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCard(null);
            setShowCreateForm(true);
          }}
          className="px-4 py-2.5 gradient-cta text-white rounded-full text-sm font-medium shadow-md shadow-brand-pink/20 hover:opacity-90 transition flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Card
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-2xl font-bold text-brand-purple">{cards.length}</div>
          <div className="text-xs text-text-secondary mt-1">Total cards</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-2xl font-bold text-accent-blue">{systemCards.length}</div>
          <div className="text-xs text-text-secondary mt-1">System cards</div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <div className="text-2xl font-bold text-accent-green">{teacherCards.length}</div>
          <div className="text-xs text-text-secondary mt-1">Your custom cards</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-text-secondary">Filter:</span>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-white text-text-primary"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Create / Edit form */}
      {showCreateForm && (
        <CardForm
          card={editingCard}
          onSave={() => {
            setShowCreateForm(false);
            setEditingCard(null);
            loadCards();
          }}
          onCancel={() => {
            setShowCreateForm(false);
            setEditingCard(null);
          }}
        />
      )}

      {/* Card list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-border p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <p className="text-text-secondary">
            No activity cards found. Create your first custom card or check your database seed.
          </p>
        </div>
      ) : (
        <>
          {/* Teacher cards first */}
          {teacherCards.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Your Cards</h2>
              <div className="space-y-3">
                {teacherCards.map((card) => (
                  <CardRow
                    key={card.id}
                    card={card}
                    isExpanded={expandedCard === card.id}
                    onToggle={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
                    onEdit={() => {
                      setEditingCard(card);
                      setShowCreateForm(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    onDelete={() => handleDelete(card)}
                    canEdit
                  />
                ))}
              </div>
            </div>
          )}

          {/* System cards */}
          {systemCards.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-text-primary mb-4">
                System Cards
                <span className="text-sm font-normal text-text-secondary ml-2">
                  (built-in, read-only)
                </span>
              </h2>
              <div className="space-y-3">
                {systemCards.map((card) => (
                  <CardRow
                    key={card.id}
                    card={card}
                    isExpanded={expandedCard === card.id}
                    onToggle={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    canEdit={false}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Card Row (list item)
// ---------------------------------------------------------------------------

function CardRow({
  card,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  canEdit,
}: {
  card: ActivityCard;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  const hints = card.ai_hints as CardAIHints;
  const modifierCount = hints?.modifierAxes?.length || 0;
  const categoryColor = CATEGORY_COLORS[card.category] || "#6C757D";

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden group">
      {/* Main row */}
      <div
        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50/50 transition"
        onClick={onToggle}
      >
        {/* Category color dot */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: categoryColor }}
          title={card.category}
        />

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{card.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-text-secondary">
              {card.slug}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">
            {card.description}
          </p>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {card.duration_minutes && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-text-secondary">
              {card.duration_minutes}min
            </span>
          )}
          {card.group_size && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-text-secondary">
              {card.group_size}
            </span>
          )}
          {modifierCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-brand-purple">
              {modifierCount} modifier{modifierCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-accent-blue">
            Used {card.times_used}x
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {canEdit && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="w-7 h-7 rounded-full hover:bg-blue-50 flex items-center justify-center text-text-secondary/40 hover:text-accent-blue opacity-0 group-hover:opacity-100 transition"
                title="Edit"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center text-text-secondary/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                title="Delete"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
              </button>
            </>
          )}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-text-secondary/30 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-border px-4 py-4 bg-gray-50/50">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-medium text-text-primary">Category:</span>{" "}
              <span className="text-text-secondary">{card.category}</span>
            </div>
            <div>
              <span className="font-medium text-text-primary">Thinking type:</span>{" "}
              <span className="text-text-secondary">{card.thinking_type || "—"}</span>
            </div>
            <div>
              <span className="font-medium text-text-primary">Design phases:</span>{" "}
              <span className="text-text-secondary">
                {card.phases?.length ? card.phases.join(", ") : "—"}
              </span>
            </div>
            {card.curriculum_frameworks?.length > 0 && card.criteria?.length > 0 && (
              <div>
                <span className="font-medium text-text-primary">
                  {card.curriculum_frameworks.includes("IB_MYP") ? "MYP Criteria" : "Curriculum tags"}:
                </span>{" "}
                <span className="text-text-secondary">
                  {card.criteria.join(", ")}
                </span>
              </div>
            )}
            {card.materials?.length > 0 && (
              <div className="col-span-2">
                <span className="font-medium text-text-primary">Materials:</span>{" "}
                <span className="text-text-secondary">{card.materials.join(", ")}</span>
              </div>
            )}
            {card.tools?.length > 0 && (
              <div className="col-span-2">
                <span className="font-medium text-text-primary">Tools:</span>{" "}
                <span className="text-text-secondary">{card.tools.join(", ")}</span>
              </div>
            )}
            {card.resources_needed && (
              <div className="col-span-2">
                <span className="font-medium text-text-primary">Resources needed:</span>{" "}
                <span className="text-text-secondary">{card.resources_needed}</span>
              </div>
            )}
            {card.teacher_notes && (
              <div className="col-span-2">
                <span className="font-medium text-text-primary">Teacher notes:</span>{" "}
                <span className="text-text-secondary">{card.teacher_notes}</span>
              </div>
            )}
          </div>

          {/* Modifier axes */}
          {modifierCount > 0 && (
            <div className="mt-4">
              <span className="text-xs font-medium text-text-primary">AI Modifiers:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {hints.modifierAxes.map((axis: ModifierAxis) => (
                  <div
                    key={axis.id}
                    className="bg-white border border-purple-100 rounded-lg px-3 py-2"
                  >
                    <div className="text-[10px] font-semibold text-brand-purple">{axis.label}</div>
                    <div className="text-[10px] text-text-secondary mt-0.5">
                      {axis.options?.map((o) => o.label).join(" · ") || (axis.type === "toggle" ? "On / Off" : "")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Template section count */}
          {card.template?.sections && (
            <div className="mt-3 text-[10px] text-text-secondary">
              Template has {card.template.sections.length} section{card.template.sections.length !== 1 ? "s" : ""}
              {card.template.vocabTerms?.length ? ` · ${card.template.vocabTerms.length} vocab terms` : ""}
              {card.template.reflection ? " · has reflection" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card Form (create / edit)
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  description: string;
  category: ActivityCardCategory;
  criteria: string[];
  phases: string;
  thinkingType: ThinkingType | "";
  durationMinutes: string;
  groupSize: GroupSize | "";
  materials: string;
  tools: string;
  resourcesNeeded: string;
  teacherNotes: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  description: "",
  category: "design-thinking",
  criteria: [],
  phases: "",
  thinkingType: "",
  durationMinutes: "",
  groupSize: "",
  materials: "",
  tools: "",
  resourcesNeeded: "",
  teacherNotes: "",
};

function CardForm({
  card,
  onSave,
  onCancel,
}: {
  card: ActivityCard | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isEditing = !!card;
  const [form, setForm] = useState<FormState>(() => {
    if (card) {
      return {
        name: card.name,
        description: card.description,
        category: card.category,
        criteria: card.criteria || [],
        phases: card.phases?.join(", ") || "",
        thinkingType: card.thinking_type || "",
        durationMinutes: card.duration_minutes?.toString() || "",
        groupSize: card.group_size || "",
        materials: card.materials?.join(", ") || "",
        tools: card.tools?.join(", ") || "",
        resourcesNeeded: card.resources_needed || "",
        teacherNotes: card.teacher_notes || "",
      };
    }
    return INITIAL_FORM;
  });
  const [saving, setSaving] = useState(false);
  const [generatingModifiers, setGeneratingModifiers] = useState(false);
  const [error, setError] = useState("");
  const generatedModifiersRef = useRef<ModifierAxis[] | null>(null);

  const handleChange = (field: keyof FormState, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCriterion = (val: string) => {
    setForm((prev) => ({
      ...prev,
      criteria: prev.criteria.includes(val)
        ? prev.criteria.filter((c) => c !== val)
        : [...prev.criteria, val],
    }));
  };

  const handleGenerateModifiers = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      setError("Name and description are required to generate modifiers");
      return;
    }
    setGeneratingModifiers(true);
    setError("");

    try {
      const res = await fetch("/api/teacher/activity-cards/generate-modifiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          template: { sections: [] },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(
          `Generated ${data.modifierAxes?.length || 0} modifier axes! They will be saved with the card.`
        );
        // Store modifiers in ref — we'll include them on save
        generatedModifiersRef.current = data.modifierAxes;
      } else {
        const err = await res.json();
        setError(err.error || "Failed to generate modifiers");
      }
    } catch {
      setError("Network error generating modifiers");
    } finally {
      setGeneratingModifiers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const splitCsv = (s: string) =>
      s.split(",").map((x) => x.trim()).filter(Boolean);

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      criteria: form.criteria,
      phases: splitCsv(form.phases),
      thinkingType: form.thinkingType || null,
      durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes, 10) : null,
      groupSize: form.groupSize || null,
      materials: splitCsv(form.materials),
      tools: splitCsv(form.tools),
      resourcesNeeded: form.resourcesNeeded.trim() || null,
      teacherNotes: form.teacherNotes.trim() || null,
    };

    // Include generated modifiers if available
    if (generatedModifiersRef.current) {
      body.aiHints = {
        whenToUse: "",
        topicAdaptation: "",
        modifierAxes: generatedModifiersRef.current,
      };
      generatedModifiersRef.current = null;
    }

    if (isEditing) {
      body.id = card!.id;
    }

    try {
      const res = await fetch("/api/teacher/activity-cards/manage", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSave();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to save card");
      }
    } catch {
      setError("Network error saving card");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-text-primary">
          {isEditing ? `Edit: ${card!.name}` : "Create New Activity Card"}
        </h2>
        <button
          onClick={onCancel}
          className="text-text-secondary hover:text-text-primary transition"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Name */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-text-primary mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g. SCAMPER Brainstorm"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
              required
            />
          </div>

          {/* Description */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-text-primary mb-1">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="What does this activity help students do?"
              rows={3}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Category <span className="text-red-400">*</span>
            </label>
            <select
              value={form.category}
              onChange={(e) => handleChange("category", e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Thinking type */}
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Thinking Type
            </label>
            <select
              value={form.thinkingType}
              onChange={(e) => handleChange("thinkingType", e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
            >
              <option value="">— Select —</option>
              {THINKING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={form.durationMinutes}
              onChange={(e) => handleChange("durationMinutes", e.target.value)}
              placeholder="e.g. 20"
              min="1"
              max="120"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
            />
          </div>

          {/* Group size */}
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Group Size
            </label>
            <select
              value={form.groupSize}
              onChange={(e) => handleChange("groupSize", e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
            >
              <option value="">— Select —</option>
              {GROUP_SIZES.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          {/* Design phases — universal, primary tag */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-text-primary mb-1">
              Design Phases <span className="text-text-secondary font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={form.phases}
              onChange={(e) => handleChange("phases", e.target.value)}
              placeholder="e.g. research, empathy, ideation, prototyping, testing, evaluation"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
            />
          </div>

          {/* Curriculum mapping — optional, framework-specific */}
          <div className="col-span-2">
            <details className="group">
              <summary className="text-xs font-medium text-text-secondary cursor-pointer hover:text-text-primary transition list-none flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Curriculum mapping
                <span className="font-normal text-text-secondary/60 ml-1">(optional — IB MYP, GCSE, etc.)</span>
              </summary>
              <div className="mt-2 flex gap-3">
                {CRITERIA_OPTIONS.map((c) => (
                  <label
                    key={c.value}
                    className={`flex items-center gap-1.5 text-xs cursor-pointer px-3 py-1.5 rounded-lg border transition ${
                      form.criteria.includes(c.value)
                        ? "border-brand-purple bg-brand-purple/5 text-brand-purple"
                        : "border-border text-text-secondary hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.criteria.includes(c.value)}
                      onChange={() => toggleCriterion(c.value)}
                      className="hidden"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-text-secondary/50 mt-1.5">
                Map this activity to curriculum-specific assessment criteria. Leave empty for framework-agnostic cards.
              </p>
            </details>
          </div>

          {/* Materials */}
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Materials <span className="text-text-secondary font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={form.materials}
              onChange={(e) => handleChange("materials", e.target.value)}
              placeholder="e.g. paper, markers, sticky notes"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
            />
          </div>

          {/* Tools */}
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Tools <span className="text-text-secondary font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={form.tools}
              onChange={(e) => handleChange("tools", e.target.value)}
              placeholder="e.g. TinkerCAD, Canva, Google Slides"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
            />
          </div>

          {/* Resources needed */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-text-primary mb-1">
              Resources / Preparation Notes
            </label>
            <textarea
              value={form.resourcesNeeded}
              onChange={(e) => handleChange("resourcesNeeded", e.target.value)}
              placeholder="Any prep the teacher needs to do before running this activity"
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none"
            />
          </div>

          {/* Teacher notes */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-text-primary mb-1">
              Teacher Notes
            </label>
            <textarea
              value={form.teacherNotes}
              onChange={(e) => handleChange("teacherNotes", e.target.value)}
              placeholder="Tips for running this activity effectively"
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 resize-none"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <button
            type="button"
            onClick={handleGenerateModifiers}
            disabled={generatingModifiers || !form.name.trim() || !form.description.trim()}
            className="px-4 py-2 text-sm border border-brand-purple/30 text-brand-purple rounded-lg hover:bg-brand-purple/5 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generatingModifiers ? (
              <>
                <div className="w-3 h-3 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                Generate AI Modifiers
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 gradient-cta text-white rounded-lg text-sm font-medium shadow-md shadow-brand-pink/20 hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : isEditing ? "Update Card" : "Create Card"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
