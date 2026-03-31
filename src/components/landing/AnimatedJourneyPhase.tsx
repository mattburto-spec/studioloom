"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

interface PhasePill {
  step: number;
  label: string;
  accent: string;       // hex colour e.g. "#a855f7"
  gradientFrom: string; // tailwind-safe gradient start
  gradientTo: string;   // tailwind-safe gradient end
}

export default function AnimatedJourneyPhase({
  tag,
  tagColor,
  pill,
  headline,
  headlineAccent,
  description,
  bullets,
  visual,
  reverse = false,
}: {
  tag: string;
  tagColor: string;
  pill?: PhasePill;
  headline: string;
  headlineAccent?: string;
  description: string;
  bullets: string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div
      ref={ref}
      className={`grid md:grid-cols-2 gap-12 lg:gap-16 items-center ${reverse ? "md:[direction:rtl]" : ""}`}
    >
      {/* Visual — slides in from the side */}
      <motion.div
        className={reverse ? "md:[direction:ltr]" : ""}
        initial={{ opacity: 0, x: reverse ? -30 : 30, scale: 0.96 }}
        animate={isInView ? { opacity: 1, x: 0, scale: 1 } : {}}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
      >
        {visual}
      </motion.div>

      {/* Copy — slides in from opposite side */}
      <motion.div
        className={reverse ? "md:[direction:ltr]" : ""}
        initial={{ opacity: 0, x: reverse ? 30 : -30 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Phase pill or plain tag */}
        {pill ? (
          <motion.div
            className="inline-flex items-center gap-2.5 mb-5 group cursor-default"
            whileHover={{ scale: 1.04, transition: { type: "spring", stiffness: 400, damping: 15 } }}
          >
            {/* Glowing pill */}
            <div
              className="relative inline-flex items-center gap-2 rounded-full px-4 py-2 border backdrop-blur-sm overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${pill.accent}18, ${pill.accent}08)`,
                borderColor: `${pill.accent}30`,
                boxShadow: `0 2px 16px -2px ${pill.accent}20, inset 0 1px 0 0 rgba(255,255,255,0.06)`,
              }}
            >
              {/* Top shine */}
              <div className="absolute inset-x-0 top-0 h-[1px]" style={{ background: `linear-gradient(to right, transparent, ${pill.accent}25, transparent)` }} />

              {/* Step number */}
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${pill.accent}, ${pill.accent}90)`,
                  boxShadow: `0 0 10px ${pill.accent}40`,
                }}
              >
                {pill.step}
              </div>

              {/* Label */}
              <span className="text-xs font-semibold tracking-wide" style={{ color: pill.accent }}>
                {pill.label}
              </span>
            </div>
          </motion.div>
        ) : (
          <span className={`text-[11px] font-semibold uppercase tracking-wider mb-3 block ${tagColor}`}>{tag}</span>
        )}

        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
          {headline}
          {headlineAccent && (
            <>
              {" "}
              <span className="text-purple-600">{headlineAccent}</span>
            </>
          )}
        </h2>
        <p className="text-gray-500 mb-6 leading-relaxed">{description}</p>
        <ul className="space-y-3">
          {bullets.map((b, i) => (
            <motion.li
              key={i}
              className="flex items-start gap-3 text-gray-600 text-sm"
              initial={{ opacity: 0, x: -12 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.25 + i * 0.08 }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0 mt-2" />
              <span>{b}</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
