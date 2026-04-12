"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BadgeIcon } from "@/components/safety/BadgeIcon";

interface Badge {
  badge_id: string;
  badge_name: string;
  badge_icon: string;
  badge_color: string;
}

interface TrophyShelfProps {
  badges: Badge[];
  themeStyles: Record<string, string>;
}

/**
 * TrophyShelf — a compact, animated badge showcase for the student dashboard.
 *
 * Collapsed: horizontal row of badge icons with a subtle shimmer/pulse.
 * Expanded: full grid reveal with staggered entrance + badge details.
 * Click any badge → links to /safety/[badgeId] for details.
 */
export function TrophyShelf({ badges, themeStyles }: TrophyShelfProps) {
  const [expanded, setExpanded] = useState(false);

  if (badges.length === 0) return null;

  const accent = themeStyles["--st-accent"] || "#7B2FF2";

  return (
    <motion.div
      layout
      className="rounded-2xl overflow-hidden"
      style={{
        background: themeStyles["--st-surface"],
        border: `1px solid ${themeStyles["--st-border"]}`,
      }}
    >
      {/* Collapsed: clickable header with badge orbs */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 cursor-pointer"
        style={{ background: `${accent}08` }}
      >
        {/* Trophy icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}18`, color: accent }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
        </div>

        {/* Badge count + label */}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-bold" style={{ color: themeStyles["--st-text"] }}>
            {badges.length} Badge{badges.length !== 1 ? "s" : ""} Earned
          </p>
        </div>

        {/* Stacked badge orbs (collapsed preview) */}
        <div className="flex -space-x-2">
          {badges.slice(0, 5).map((b, i) => (
            <motion.div
              key={b.badge_id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.08, type: "spring", stiffness: 400, damping: 20 }}
              className="w-8 h-8 rounded-full flex items-center justify-center ring-2 relative"
              style={{
                background: `${b.badge_color}25`,
                color: b.badge_color,
                zIndex: 5 - i,
                boxShadow: `0 0 0 2px ${themeStyles["--st-surface"]}`,
              } as any}
            >
              <BadgeIcon iconName={b.badge_icon} size={14} color={b.badge_color} />
            </motion.div>
          ))}
          {badges.length > 5 && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{
                background: `${accent}20`,
                color: accent,
                boxShadow: `0 0 0 2px ${themeStyles["--st-surface"]}`,
              }}
            >
              +{badges.length - 5}
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ color: themeStyles["--st-text-secondary"] }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.div>
      </button>

      {/* Expanded: full badge grid */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 pt-2 grid gap-3"
              style={{
                gridTemplateColumns: badges.length <= 3
                  ? `repeat(${badges.length}, 1fr)`
                  : "repeat(auto-fill, minmax(100px, 1fr))",
              }}
            >
              {badges.map((b, i) => (
                <motion.div
                  key={b.badge_id}
                  initial={{ y: 20, opacity: 0, scale: 0.8 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{
                    delay: i * 0.06,
                    type: "spring",
                    stiffness: 300,
                    damping: 22,
                  }}
                >
                  <Link
                    href={`/safety/${b.badge_id}`}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:scale-105"
                    style={{ background: `${b.badge_color}10` }}
                  >
                    {/* Badge circle with glow */}
                    <motion.div
                      className="w-12 h-12 rounded-full flex items-center justify-center relative"
                      style={{
                        background: `${b.badge_color}20`,
                        boxShadow: `0 0 16px ${b.badge_color}30`,
                      }}
                      whileHover={{
                        scale: 1.15,
                        boxShadow: `0 0 24px ${b.badge_color}50`,
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      <BadgeIcon iconName={b.badge_icon} size={22} color={b.badge_color} />
                    </motion.div>

                    {/* Badge name */}
                    <span
                      className="text-[11px] font-semibold text-center leading-tight"
                      style={{ color: themeStyles["--st-text"] }}
                    >
                      {b.badge_name}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
