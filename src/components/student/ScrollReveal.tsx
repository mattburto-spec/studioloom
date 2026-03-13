"use client";

import { useScrollReveal } from "@/hooks/useScrollReveal";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  /** Delay in ms before the animation starts */
  delay?: number;
  /** Animation direction: fade up, fade left, or just fade */
  direction?: "up" | "left" | "none";
}

export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: ScrollRevealProps) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>(0.1);

  const baseTransform = direction === "up"
    ? "translateY(24px)"
    : direction === "left"
      ? "translateX(-24px)"
      : "none";

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : baseTransform,
        transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
