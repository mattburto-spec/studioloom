"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatDate, getDaysUntil, timeAgo } from "@/lib/utils";
import { BadgeIcon } from "@/components/safety/BadgeIcon";

// ── Item types ──────────────────────────────────────────

interface SafetyItem {
  type: "safety";
  id: string;
  title: string;
  subtitle: string; // "8q · 80% to pass"
  href: string;
  disabled: boolean;
  disabledReason?: string; // "Cooldown" / "Retake in 2h"
  badgeIcon: string;
  badgeColor: string;
  status: "not_started" | "cooldown" | "expired";
  sortDate: Date; // blockers sort first (epoch 0)
}

interface GalleryItem {
  type: "gallery";
  id: string;
  title: string;
  unitTitle: string;
  href: string;
  hasSubmitted: boolean;
  reviewsCompleted: number;
  minReviews: number;
  deadline?: string;
  sortDate: Date;
}

interface DueItem {
  type: "due";
  id: string;
  title: string;
  unitTitle: string;
  href: string;
  dueDate: string;
  isOverdue: boolean;
  isComplete: boolean;
  sortDate: Date;
}

type ComingUpItem = SafetyItem | GalleryItem | DueItem;

// ── Props ───────────────────────────────────────────────

interface PendingBadge {
  badge_id: string;
  badge_name: string;
  badge_slug: string;
  badge_description: string;
  badge_icon: string;
  badge_color: string;
  pass_threshold: number;
  question_count: number;
  unit_title: string;
  student_status: "not_started" | "cooldown" | "expired";
  cooldown_until?: string;
}

interface GalleryRound {
  id: string;
  title: string;
  unitTitle?: string;
  unitId?: string;
  reviewFormat?: string;
  deadline?: string;
  hasSubmitted: boolean;
  reviewsCompleted: number;
  minReviews: number;
  totalSubmissions?: number;
}

interface DuePageItem {
  unitId: string;
  unitTitle: string;
  pageId: string;
  pageTitle: string;
  dueDate: string;
  isOverdue: boolean;
  isComplete: boolean;
}

interface ComingUpCardProps {
  pendingBadges: PendingBadge[];
  galleryRounds: GalleryRound[];
  dueItems: DuePageItem[];
}

// ── Icons (inline SVGs — no lucide-react in project) ───

const ShieldIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const GalleryIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CalendarIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ChevronRightIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

// ── Category config ─────────────────────────────────────

const CATEGORY_CONFIG = {
  safety: {
    label: "Safety Test",
    borderColor: "border-l-amber-400",
    pillBg: "bg-amber-100",
    pillText: "text-amber-700",
    iconColor: "#D97706",
  },
  gallery: {
    label: "Gallery",
    borderColor: "border-l-purple-400",
    pillBg: "bg-purple-100",
    pillText: "text-purple-700",
    iconColor: "#7C3AED",
  },
  due: {
    label: "Lesson Due",
    borderColor: "border-l-blue-400",
    pillBg: "bg-blue-100",
    pillText: "text-blue-700",
    iconColor: "#2563EB",
  },
} as const;

// ── Component ───────────────────────────────────────────

export function ComingUpCard({ pendingBadges, galleryRounds, dueItems }: ComingUpCardProps) {
  const items = useMemo(() => {
    const all: ComingUpItem[] = [];

    // Safety tests — blockers sort earliest (epoch 0 so they always come first)
    for (const badge of pendingBadges) {
      const isCooldown = badge.student_status === "cooldown";
      all.push({
        type: "safety",
        id: `safety-${badge.badge_id}`,
        title: badge.badge_name,
        subtitle: `${badge.question_count}q · ${badge.pass_threshold}% to pass`,
        href: isCooldown ? "#" : `/safety/${badge.badge_id}`,
        disabled: isCooldown,
        disabledReason: isCooldown && badge.cooldown_until
          ? `Retake ${timeAgo(badge.cooldown_until)}`
          : badge.student_status === "expired"
            ? "Expired — retake required"
            : undefined,
        badgeIcon: badge.badge_icon,
        badgeColor: badge.badge_color,
        status: badge.student_status,
        sortDate: new Date(0), // blockers always first
      });
    }

    // Gallery rounds
    for (const round of galleryRounds) {
      const deadline = round.deadline ? new Date(round.deadline) : null;
      all.push({
        type: "gallery",
        id: `gallery-${round.id}`,
        title: round.title,
        unitTitle: round.unitTitle || "",
        href: `/gallery/${round.id}`,
        hasSubmitted: round.hasSubmitted,
        reviewsCompleted: round.reviewsCompleted,
        minReviews: round.minReviews,
        deadline: round.deadline,
        sortDate: deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // no deadline → sort to end
      });
    }

    // Due pages (only incomplete ones)
    for (const item of dueItems) {
      if (item.isComplete) continue;
      all.push({
        type: "due",
        id: `due-${item.unitId}-${item.pageId}`,
        title: item.pageTitle,
        unitTitle: item.unitTitle,
        href: `/unit/${item.unitId}/${item.pageId}`,
        dueDate: item.dueDate,
        isOverdue: item.isOverdue,
        isComplete: false,
        sortDate: new Date(item.dueDate),
      });
    }

    // Sort: blockers (epoch 0) first, then overdue, then by date ascending
    all.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

    return all;
  }, [pendingBadges, galleryRounds, dueItems]);

  if (items.length === 0) return null;

  // Determine header accent based on what's most urgent
  const hasSafety = pendingBadges.length > 0;
  const headerGradient = hasSafety
    ? "from-amber-50 to-orange-50"
    : "from-purple-50 to-indigo-50";
  const headerIconColor = hasSafety ? "#D97706" : "#7C3AED";
  const headerBorder = hasSafety ? "border-amber-200" : "border-purple-200";

  return (
    <div className="rounded-2xl border border-gray-200/60 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className={`px-4 py-2.5 bg-gradient-to-r ${headerGradient} border-b ${headerBorder} flex items-center gap-2`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={headerIconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <h2 className="text-sm font-bold text-gray-800">Coming Up</h2>
        <span className="ml-auto text-[10px] font-semibold text-gray-500 bg-white/80 px-1.5 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-100">
        {items.map((item) => (
          <ComingUpRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

// ── Row renderer ────────────────────────────────────────

function ComingUpRow({ item }: { item: ComingUpItem }) {
  const config = CATEGORY_CONFIG[item.type];

  const inner = (
    <div className={`group flex items-center gap-3 px-4 py-3 border-l-[3px] ${config.borderColor} transition-colors ${
      item.type === "safety" && (item as SafetyItem).disabled
        ? "opacity-60 cursor-not-allowed"
        : "hover:bg-gray-50 cursor-pointer"
    }`}>
      {/* Icon */}
      <div className="flex-shrink-0">
        {item.type === "safety" ? (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: (item as SafetyItem).badgeColor + "20",
              border: `2px solid ${(item as SafetyItem).badgeColor}`,
            }}
          >
            <BadgeIcon iconName={(item as SafetyItem).badgeIcon} size={18} color={(item as SafetyItem).badgeColor} />
          </div>
        ) : item.type === "gallery" ? (
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
            <GalleryIcon size={16} color={config.iconColor} />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-100 to-sky-100 flex items-center justify-center">
            <CalendarIcon size={16} color={config.iconColor} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-900 truncate group-hover:text-gray-700">
            {item.title}
          </span>
          <span className={`flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${config.pillBg} ${config.pillText}`}>
            {config.label}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
          {/* Type-specific secondary info */}
          {item.type === "safety" && (
            <>
              <span>{(item as SafetyItem).subtitle}</span>
              {(item as SafetyItem).disabledReason && (
                <span className="text-amber-600 font-medium">{(item as SafetyItem).disabledReason}</span>
              )}
            </>
          )}

          {item.type === "gallery" && (
            <>
              {(item as GalleryItem).unitTitle && (
                <span className="truncate">{(item as GalleryItem).unitTitle}</span>
              )}
              {!(item as GalleryItem).hasSubmitted ? (
                <span className="text-amber-600 font-medium">Not submitted</span>
              ) : (
                <span className="text-green-600 font-medium">Shared</span>
              )}
              <span>Reviews {(item as GalleryItem).reviewsCompleted}/{(item as GalleryItem).minReviews}</span>
              {renderDeadline((item as GalleryItem).deadline)}
            </>
          )}

          {item.type === "due" && (
            <>
              <span className="truncate">{(item as DueItem).unitTitle}</span>
              {(item as DueItem).isOverdue ? (
                <span className="text-red-600 font-medium">Overdue</span>
              ) : (
                <span>{renderDueDate((item as DueItem).dueDate)}</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Action hint / CTA */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {item.type === "safety" && !(item as SafetyItem).disabled && (
          <span className="text-[11px] font-semibold text-white bg-amber-500 px-2.5 py-1 rounded-lg">
            {(item as SafetyItem).status === "expired" ? "Retake" : "Take Test"}
          </span>
        )}
        {item.type === "safety" && (item as SafetyItem).disabled && (
          <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">
            Cooldown
          </span>
        )}
        <span className="text-gray-300 group-hover:text-gray-500 transition-colors">
          <ChevronRightIcon size={16} />
        </span>
      </div>
    </div>
  );

  // Safety items in cooldown shouldn't be clickable links
  if (item.type === "safety" && (item as SafetyItem).disabled) {
    return <div>{inner}</div>;
  }

  const href = item.type === "safety"
    ? (item as SafetyItem).href
    : item.type === "gallery"
      ? (item as GalleryItem).href
      : (item as DueItem).href;

  return <Link href={href}>{inner}</Link>;
}

// ── Helpers ─────────────────────────────────────────────

function renderDeadline(deadline?: string) {
  if (!deadline) return null;
  const days = getDaysUntil(deadline);
  if (days <= 0) return <span className="text-red-600 font-medium">Ended</span>;
  if (days <= 3) return <span className="text-amber-600 font-medium">Due soon</span>;
  return <span>Due {formatDate(deadline)}</span>;
}

function renderDueDate(dueDate: string) {
  const days = getDaysUntil(dueDate);
  if (days <= 0) return <span className="text-red-600 font-medium">Overdue</span>;
  if (days === 1) return <span className="text-amber-600 font-medium">Due tomorrow</span>;
  if (days <= 3) return <span className="text-amber-600 font-medium">Due in {days} days</span>;
  return <span>Due {formatDate(dueDate)}</span>;
}
