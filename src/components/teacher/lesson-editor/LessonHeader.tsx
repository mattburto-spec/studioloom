"use client";

import InlineEdit from "./InlineEdit";
import type { PageContent } from "@/types";

interface LessonHeaderProps {
  page: { id: string; type: string; title: string; content: PageContent };
  onUpdate: (partial: Partial<PageContent>) => void;
}

/**
 * LessonHeader — Editorial display of lesson title + learning goal.
 *
 * Warm-paper aesthetic: small all-caps eyebrow with the page-type label,
 * extrabold display title, soft-ink summary paragraph beneath.
 */
export default function LessonHeader({
  page,
  onUpdate,
}: LessonHeaderProps) {
  const { content } = page;

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
    <div className="pb-4 mb-4 border-b border-[var(--le-hair)]">
      <div className="le-cap text-[var(--le-ink-3)] mb-1">{typeLabel}</div>
      <InlineEdit
        value={content.title}
        onChange={(newTitle) => onUpdate({ title: newTitle })}
        placeholder="Lesson title"
        as="h2"
        className="le-display text-[26px] leading-[1.1] text-[var(--le-ink)]"
      />
      <div className="mt-2 max-w-[640px]">
        <InlineEdit
          value={content.learningGoal}
          onChange={(newGoal) => onUpdate({ learningGoal: newGoal })}
          placeholder="Learning goal for this lesson..."
          as="p"
          className="text-[12.5px] leading-relaxed text-[var(--le-ink-2)]"
        />
      </div>
    </div>
  );
}
