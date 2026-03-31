"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

export default function AnimatedJourneyPhase({
  tag,
  tagColor,
  headline,
  headlineAccent,
  description,
  bullets,
  visual,
  reverse = false,
}: {
  tag: string;
  tagColor: string;
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
        <span className={`text-[11px] font-semibold uppercase tracking-wider mb-3 block ${tagColor}`}>{tag}</span>
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
