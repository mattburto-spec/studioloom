"use client";

import { motion } from "framer-motion";

const steps = [
  {
    step: "Plan",
    desc: "Build or browse units",
    gradient: "from-purple-500/30 to-purple-600/10",
    glow: "shadow-purple-500/20",
    border: "border-purple-400/25",
    hoverGlow: "hover:shadow-purple-400/40",
    accent: "#a855f7",
    ring: "ring-purple-400/20",
  },
  {
    step: "Deliver",
    desc: "Live teaching cockpit",
    gradient: "from-blue-500/30 to-blue-600/10",
    glow: "shadow-blue-500/20",
    border: "border-blue-400/25",
    hoverGlow: "hover:shadow-blue-400/40",
    accent: "#3b82f6",
    ring: "ring-blue-400/20",
  },
  {
    step: "Assess",
    desc: "Criterion grading + gallery",
    gradient: "from-emerald-500/30 to-emerald-600/10",
    glow: "shadow-emerald-500/20",
    border: "border-emerald-400/25",
    hoverGlow: "hover:shadow-emerald-400/40",
    accent: "#10b981",
    ring: "ring-emerald-400/20",
  },
  {
    step: "Showcase",
    desc: "Portfolio builds itself",
    gradient: "from-pink-500/30 to-pink-600/10",
    glow: "shadow-pink-500/20",
    border: "border-pink-400/25",
    hoverGlow: "hover:shadow-pink-400/40",
    accent: "#ec4899",
    ring: "ring-pink-400/20",
  },
];

export default function ProcessSteps() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {steps.map((s, i) => (
        <motion.div
          key={s.step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 + i * 0.1, duration: 0.5, ease: "easeOut" }}
          whileHover={{
            scale: 1.06,
            y: -4,
            transition: { type: "spring", stiffness: 400, damping: 15 },
          }}
          whileTap={{ scale: 0.97 }}
          className="group relative cursor-default"
        >
          {/* Outer glow layer */}
          <div
            className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md"
            style={{ background: `radial-gradient(circle at center, ${s.accent}40, transparent 70%)` }}
          />

          {/* Card */}
          <div
            className={`relative bg-gradient-to-b ${s.gradient} ${s.border} border rounded-2xl px-4 py-5 md:py-6 text-center backdrop-blur-sm overflow-hidden transition-shadow duration-300 shadow-lg ${s.glow}`}
            style={{
              boxShadow: `0 4px 24px -4px ${s.accent}25, inset 0 1px 0 0 rgba(255,255,255,0.08)`,
            }}
          >
            {/* Inner shine — top highlight for 3D effect */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            {/* Subtle radial glow behind text */}
            <div
              className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity duration-500"
              style={{
                background: `radial-gradient(ellipse at 50% 30%, ${s.accent}20, transparent 60%)`,
              }}
            />

            {/* Step number dot */}
            <div
              className="w-6 h-6 rounded-full mx-auto mb-2.5 flex items-center justify-center text-[10px] font-bold text-white/80"
              style={{
                background: `linear-gradient(135deg, ${s.accent}60, ${s.accent}30)`,
                boxShadow: `0 0 12px ${s.accent}30, 0 0 0 1px ${s.accent}30`,
              }}
            >
              {i + 1}
            </div>

            {/* Step name */}
            <div className="relative text-lg md:text-xl font-bold text-white mb-1 tracking-wide">
              {s.step}
            </div>

            {/* Description */}
            <div className="relative text-[11px] md:text-xs text-white/50 group-hover:text-white/70 transition-colors duration-300">
              {s.desc}
            </div>

            {/* Bottom shine for depth */}
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
