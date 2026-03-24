"use client";

import InlineEdit from "./InlineEdit";
import type { PageContent } from "@/types";

interface LessonHeaderProps {
  page: { id: string; type: string; title: string; content: PageContent };
  onUpdate: (partial: Partial<PageContent>) => void;
}

/**
 * LessonHeader — Top section of editor for lesson title and learning goal
 *
 * Shows:
 * - Title (h2, inline editable)
 * - Learning Goal (p, inline editable)
 * - Page type badge
 */
export default function LessonHeader({
  page,
  onUpdate,
}: LessonHeaderProps) {
  const { content } = page;

  // Page type label
  const typeLabels: Record<string, string> = {
    strand: "Strand",
    context: "Context",
    skill: "Skill",
    reflection: "Reflection",
    custom: "Custom",
    lesson: "Lesson",
  };

  const typeLabel = typeLabels[page.type] || "Page";

  return (
    <div className="border-b border-gray-200 pb-4 mb-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <InlineEdit
            value={content.title}
            onChange={(newTitle) => onUpdate({ title: newTitle })}
            placeholder="Lesson title"
            as="h2"
            className="text-2xl font-bold text-gray-900"
          />
        </div>
        <span className="inline-block px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
          {typeLabel}
        </span>
      </div>

      <InlineEdit
        value={content.learningGoal}
        onChange={(newGoal) => onUpdate({ learningGoal: newGoal })}
        placeholder="Learning goal for this lesson..."
        as="p"
        className="text-gray-600"
      />
    </div>
  );
}
