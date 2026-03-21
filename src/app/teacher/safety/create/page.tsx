"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { QuestionPoolItem, LearningCard } from "@/types";

// ============================================================================
// SVG Icons (inline, no lucide-react)
// ============================================================================

const BackArrowIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

// ============================================================================
// Types
// ============================================================================

interface FormData {
  name: string;
  description: string;
  category: "safety" | "skill" | "software";
  tier: 1 | 2 | 3 | 4;
  icon_name: string;
  color: string;
  pass_threshold: number;
  expiry_months: number;
  retake_cooldown_minutes: number;
  topics: string[];
  learn_content: LearningCard[];
  question_pool: QuestionPoolItem[];
}

interface LearnCardForm {
  id: string;
  title: string;
  content: string;
  icon: string;
}

interface QuestionForm {
  id: string;
  type: "multiple_choice" | "true_false" | "scenario" | "sequence" | "match";
  topic: string;
  prompt: string;
  difficulty: "easy" | "medium" | "hard";
  options: string[];
  correct_answer: string | number;
  explanation: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ============================================================================
// Components
// ============================================================================

function LearnCardSection({ cards, onAdd, onRemove, onChange }: {
  cards: LearnCardForm[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, field: string, value: string) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Learn Content</h3>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium rounded-lg transition-colors"
        >
          <PlusIcon />
          <span>Add Card</span>
        </button>
      </div>

      {cards.length === 0 ? (
        <p className="text-gray-500 text-sm">No learn cards yet. Click "Add Card" to create one.</p>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => (
            <div key={card.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-semibold text-gray-900">{card.title || "Untitled Card"}</h4>
                <button
                  type="button"
                  onClick={() => onRemove(card.id)}
                  className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                >
                  <TrashIcon />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={card.title}
                    onChange={(e) => onChange(card.id, "title", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Safety Equipment"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji)</label>
                  <input
                    type="text"
                    value={card.icon}
                    onChange={(e) => onChange(card.id, "icon", e.target.value)}
                    maxLength={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="🛡️"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={card.content}
                  onChange={(e) => onChange(card.id, "content", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Educational content for this card..."
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionSection({ questions, onAdd, onRemove, onChange }: {
  questions: QuestionForm[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, field: string, value: unknown) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Questions ({questions.length})</h3>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium rounded-lg transition-colors"
        >
          <PlusIcon />
          <span>Add Question</span>
        </button>
      </div>

      {questions.length === 0 ? (
        <p className="text-gray-500 text-sm">No questions yet. Click "Add Question" to create one.</p>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div key={q.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-semibold text-gray-900">Question {idx + 1}</h4>
                <button
                  type="button"
                  onClick={() => onRemove(q.id)}
                  className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                >
                  <TrashIcon />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={q.type}
                    onChange={(e) => onChange(q.id, "type", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="true_false">True / False</option>
                    <option value="scenario">Scenario</option>
                    <option value="sequence">Sequence</option>
                    <option value="match">Match</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select
                    value={q.difficulty}
                    onChange={(e) => onChange(q.id, "difficulty", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                  <input
                    type="text"
                    value={q.topic}
                    onChange={(e) => onChange(q.id, "topic", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Safety Equipment"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
                <textarea
                  value={q.prompt}
                  onChange={(e) => onChange(q.id, "prompt", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={2}
                  placeholder="Question text..."
                />
              </div>

              {(q.type === "multiple_choice" || q.type === "scenario") && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Options (one per line)</label>
                  <textarea
                    value={q.options.join("\n")}
                    onChange={(e) => onChange(q.id, "options", e.target.value.split("\n").filter(o => o.trim()))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                  />
                </div>
              )}

              {q.type === "true_false" && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
                  <select
                    value={q.correct_answer}
                    onChange={(e) => onChange(q.id, "correct_answer", e.target.value === "true" ? 1 : 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </div>
              )}

              {(q.type === "multiple_choice" || q.type === "scenario") && q.options.length > 0 && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer (index)</label>
                  <select
                    value={q.correct_answer}
                    onChange={(e) => onChange(q.id, "correct_answer", parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {q.options.map((opt, i) => (
                      <option key={i} value={i}>{i + 1}. {opt}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Explanation</label>
                <textarea
                  value={q.explanation}
                  onChange={(e) => onChange(q.id, "explanation", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={2}
                  placeholder="Why is this the correct answer?"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function CreateBadgePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    name: "",
    description: "",
    category: "safety",
    tier: 1,
    icon_name: "🛡️",
    color: "#10b981",
    pass_threshold: 80,
    expiry_months: 12,
    retake_cooldown_minutes: 60,
    topics: [],
    learn_content: [],
    question_pool: [],
  });

  const [learnCards, setLearnCards] = useState<LearnCardForm[]>([]);
  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [topicInput, setTopicInput] = useState("");

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleFormChange = (field: keyof FormData, value: unknown) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddTopic = () => {
    if (topicInput.trim() && !form.topics.includes(topicInput.trim())) {
      setForm((prev) => ({
        ...prev,
        topics: [...prev.topics, topicInput.trim()],
      }));
      setTopicInput("");
    }
  };

  const handleRemoveTopic = (topic: string) => {
    setForm((prev) => ({
      ...prev,
      topics: prev.topics.filter((t) => t !== topic),
    }));
  };

  const handleAddLearnCard = () => {
    const newCard: LearnCardForm = {
      id: Date.now().toString(),
      title: "",
      content: "",
      icon: "📖",
    };
    setLearnCards((prev) => [...prev, newCard]);
  };

  const handleRemoveLearnCard = (id: string) => {
    setLearnCards((prev) => prev.filter((c) => c.id !== id));
  };

  const handleChangeLearnCard = (id: string, field: string, value: string) => {
    setLearnCards((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  };

  const handleAddQuestion = () => {
    const newQuestion: QuestionForm = {
      id: Date.now().toString(),
      type: "multiple_choice",
      topic: "",
      prompt: "",
      difficulty: "medium",
      options: ["", "", ""],
      correct_answer: 0,
      explanation: "",
    };
    setQuestions((prev) => [...prev, newQuestion]);
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleChangeQuestion = (id: string, field: string, value: unknown) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id ? { ...q, [field]: value } : q
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!form.name.trim()) {
      setError("Badge name is required");
      return;
    }

    if (learnCards.some((c) => !c.title.trim() || !c.content.trim())) {
      setError("All learn cards must have a title and content");
      return;
    }

    if (questions.some((q) => !q.prompt.trim() || !q.explanation.trim())) {
      setError("All questions must have a prompt and explanation");
      return;
    }

    // Convert form data
    const slug = slugify(form.name);
    const formattedLearnContent: LearningCard[] = learnCards.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.content,
      icon: c.icon,
      tips: [],
      examples: [],
    }));

    const formattedQuestions: QuestionPoolItem[] = questions.map((q) => ({
      id: q.id,
      text: q.prompt,
      type: q.type as any,
      options: q.type === "true_false" ? ["True", "False"] : q.options,
      correct_answer: q.correct_answer,
      image_description: undefined,
    }));

    try {
      setIsLoading(true);

      const response = await fetch("/api/teacher/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug,
          description: form.description,
          category: form.category,
          tier: form.tier,
          icon_name: form.icon_name,
          color: form.color,
          pass_threshold: form.pass_threshold,
          expiry_months: form.expiry_months,
          retake_cooldown_minutes: form.retake_cooldown_minutes,
          topics: form.topics,
          learn_content: formattedLearnContent,
          question_pool: formattedQuestions,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create badge");
      }

      // Redirect to safety page
      router.push("/teacher/safety");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const COLOR_PALETTE = [
    { value: "#10b981", label: "Emerald" },
    { value: "#3b82f6", label: "Blue" },
    { value: "#8b5cf6", label: "Violet" },
    { value: "#f59e0b", label: "Amber" },
    { value: "#ef4444", label: "Red" },
    { value: "#06b6d4", label: "Cyan" },
  ];

  const TIER_LABELS = {
    1: "Fundamentals",
    2: "Specialty",
    3: "Advanced",
    4: "Expert",
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/teacher/safety"
            className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium mb-4"
          >
            <BackArrowIcon />
            <span>Back to Safety</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Badge</h1>
          <p className="text-gray-600">Design a new safety, skill, or software badge with questions and learning content.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-medium">Error: {error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic Info Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Basic Information</h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Badge Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Workshop Safety Fundamentals"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => handleFormChange("category", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="safety">Safety</option>
                  <option value="skill">Skill</option>
                  <option value="software">Software</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => handleFormChange("description", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={3}
                placeholder="Describe what students will learn..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tier *</label>
                <select
                  value={form.tier}
                  onChange={(e) => handleFormChange("tier", parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {Object.entries(TIER_LABELS).map(([num, label]) => (
                    <option key={num} value={num}>{num}. {label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji)</label>
                <input
                  type="text"
                  value={form.icon_name}
                  onChange={(e) => handleFormChange("icon_name", e.target.value)}
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="🛡️"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => handleFormChange("color", e.target.value)}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <select
                    value={form.color}
                    onChange={(e) => handleFormChange("color", e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Custom</option>
                    {COLOR_PALETTE.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Badge Settings</h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pass Threshold (%)</label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={form.pass_threshold}
                  onChange={(e) => handleFormChange("pass_threshold", parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry (months, 0 = never)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={form.expiry_months}
                  onChange={(e) => handleFormChange("expiry_months", parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Retake Cooldown (minutes)</label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={form.retake_cooldown_minutes}
                  onChange={(e) => handleFormChange("retake_cooldown_minutes", parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Topics Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Topics</h2>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTopic();
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Type a topic and press Enter..."
              />
              <button
                type="button"
                onClick={handleAddTopic}
                className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium rounded-lg transition-colors"
              >
                Add
              </button>
            </div>

            {form.topics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.topics.map((topic) => (
                  <div
                    key={topic}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                  >
                    {topic}
                    <button
                      type="button"
                      onClick={() => handleRemoveTopic(topic)}
                      className="hover:text-purple-900 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Learn Content Section */}
          <LearnCardSection
            cards={learnCards}
            onAdd={handleAddLearnCard}
            onRemove={handleRemoveLearnCard}
            onChange={handleChangeLearnCard}
          />

          {/* Questions Section */}
          <QuestionSection
            questions={questions}
            onAdd={handleAddQuestion}
            onRemove={handleRemoveQuestion}
            onChange={handleChangeQuestion}
          />

          {/* Submit Buttons */}
          <div className="flex gap-3 mt-8">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 text-white font-bold rounded-lg transition-all"
            >
              {isLoading ? "Creating..." : "Create Badge"}
            </button>
            <Link
              href="/teacher/safety"
              className="px-6 py-3 border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-lg transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
