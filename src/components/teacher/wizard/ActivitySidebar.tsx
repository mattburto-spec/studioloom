"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { PageContent } from "@/types";
import {
  SIDEBAR_CATEGORIES,
  getActivitiesForSidebarCategory,
  detectUsedActivities,
  type ActivityTemplate,
} from "@/lib/activity-library";
import { ActivityCategoryPanel } from "./ActivityCategoryPanel";
import type { ActivityCard, CardAIHints } from "@/types/activity-cards";
import type { CriterionKey } from "@/lib/constants";

interface Props {
  generatedPages: Partial<Record<string, PageContent>>;
}

// Duration map for converting DB cards to template format
const MINUTES_TO_DURATION: Record<number, ActivityTemplate["tags"]["duration"]> = {
  5: "5min",
  10: "10min",
  15: "15min",
  20: "20min",
  30: "30min+",
};

// SVG icons for each sidebar category
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  design: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  ),
  thinking: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14" />
    </svg>
  ),
  knowledge: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  ),
  skills: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  ),
};

/** Convert a DB ActivityCard to the ActivityTemplate shape for the panel */
function cardToTemplate(card: ActivityCard): ActivityTemplate {
  const hints = card.ai_hints as CardAIHints;
  return {
    id: card.slug,
    name: card.name,
    description: card.description,
    category: card.category as ActivityTemplate["category"],
    tags: {
      criteria: card.criteria as CriterionKey[],
      phases: card.phases,
      thinkingType: card.thinking_type as ActivityTemplate["tags"]["thinkingType"],
      duration: MINUTES_TO_DURATION[card.duration_minutes] || "15min",
      groupSize: card.group_size as ActivityTemplate["tags"]["groupSize"],
    },
    template: {
      sections: card.template?.sections || [],
      vocabTerms: card.template?.vocabTerms,
      reflection: card.template?.reflection,
    },
    aiHints: {
      whenToUse: hints?.whenToUse || "",
      topicAdaptation: hints?.topicAdaptation || "",
    },
  };
}

export function ActivitySidebar({ generatedPages }: Props) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [dbCards, setDbCards] = useState<ActivityCard[] | null>(null);

  // Fetch cards from DB on mount (once)
  useEffect(() => {
    fetch("/api/teacher/activity-cards")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.cards?.length > 0) {
          setDbCards(data.cards);
        }
      })
      .catch(() => {
        // Fallback to hardcoded — dbCards stays null
      });
  }, []);

  const usedActivityIds = useMemo(
    () => detectUsedActivities(generatedPages),
    [generatedPages]
  );

  // Get activities for a sidebar category — from DB or fallback
  const getActivities = useCallback(
    (categoryId: string): ActivityTemplate[] => {
      if (dbCards && dbCards.length > 0) {
        const cat = SIDEBAR_CATEGORIES.find((c) => c.id === categoryId);
        if (!cat) return [];
        return dbCards
          .filter((card) =>
            cat.activityCategories.includes(
              card.category as ActivityTemplate["category"]
            )
          )
          .map(cardToTemplate);
      }
      return getActivitiesForSidebarCategory(categoryId);
    },
    [dbCards]
  );

  const handleToggle = (categoryId: string) => {
    setOpenCategory((prev) => (prev === categoryId ? null : categoryId));
  };

  const openCat = SIDEBAR_CATEGORIES.find((c) => c.id === openCategory);
  const openActivities = openCategory ? getActivities(openCategory) : [];

  return (
    <div className="fixed right-4 bottom-[80px] z-30 flex items-end gap-2">
      {/* Expanded panel (slides out to the left of the buttons) */}
      {openCat && (
        <ActivityCategoryPanel
          label={openCat.label}
          color={openCat.color}
          activities={openActivities}
          usedActivityIds={usedActivityIds}
          onClose={() => setOpenCategory(null)}
        />
      )}

      {/* Floating category buttons */}
      <div className="flex flex-col gap-2">
        {SIDEBAR_CATEGORIES.map((cat) => {
          const isOpen = openCategory === cat.id;
          const activities = getActivities(cat.id);
          const activityCount = activities.length;
          const usedCount = activities.filter((a) =>
            usedActivityIds.has(a.id)
          ).length;

          return (
            <button
              key={cat.id}
              onClick={() => handleToggle(cat.id)}
              className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-md hover:shadow-lg ${
                isOpen ? "scale-105" : "hover:scale-105"
              }`}
              style={{
                backgroundColor: isOpen ? cat.color : "white",
                color: isOpen ? "white" : cat.color,
                outline: isOpen ? `2px solid ${cat.color}` : undefined,
                outlineOffset: isOpen ? "2px" : undefined,
              }}
              title={`${cat.label} (${activityCount} activities)`}
            >
              {CATEGORY_ICONS[cat.id]}

              {/* Usage indicator badge */}
              {activityCount > 0 && usedCount > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent-green flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold">
                    {usedCount}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
