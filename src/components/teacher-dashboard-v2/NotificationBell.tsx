"use client";

/**
 * NotificationBell — TopNav bell icon with unread-count indicator.
 *
 * Phase 3C of Notifications. Polls /api/teacher/notifications for the
 * unread count every 60s and shows an orange dot when count > 0.
 * Clicking navigates to /teacher/notifications.
 *
 * Pre-Phase-3C this was a static button with a hardcoded orange dot
 * (TopNav.tsx lines 224-230). Replacing with this client component
 * preserves the visual + adds live count.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface NotificationsListResponse {
  unread_count?: number;
}

const I = ({ name, size }: { name: "bell"; size: number }) => (
  // Inline SVG matching the existing icons.tsx Bell glyph.
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        // unread=true&limit=1 minimises bandwidth; the response includes unread_count regardless of filter
        const res = await fetch("/api/teacher/notifications?unread=true&limit=1");
        if (!res.ok) return;
        const data = (await res.json()) as NotificationsListResponse;
        if (!cancelled) {
          setUnreadCount(data.unread_count ?? 0);
        }
      } catch {
        // best-effort; bell stays at last known count
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const showDot = unreadCount > 0;

  return (
    <Link
      href="/teacher/notifications"
      className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--ink-2)] relative shrink-0"
      aria-label={
        unreadCount > 0
          ? `Notifications — ${unreadCount} unread`
          : "Notifications"
      }
      title={
        unreadCount > 0 ? `${unreadCount} unread notification(s)` : "Notifications"
      }
    >
      <I name="bell" size={16} />
      {showDot && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E86F2C] border-2 border-[var(--bg)]" />
      )}
    </Link>
  );
}
