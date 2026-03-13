"use client";

import { useRef, useEffect } from "react";

export function useScrollCardScale(
  sectionCount: number | undefined,
  pageId: string,
  ready: boolean
) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!ready) return;

    let ticking = false;

    function updateScales() {
      const viewportCenter = window.innerHeight / 2;
      cardRefs.current.forEach((ref) => {
        if (!ref) return;
        const rect = ref.getBoundingClientRect();
        const cardCenter = rect.top + rect.height / 2;
        const distance = Math.abs(cardCenter - viewportCenter);
        const maxDistance = window.innerHeight * 0.6;
        const t = Math.min(distance / maxDistance, 1);
        const scale = 1 - t * 0.035;
        ref.style.transform = `scale(${scale})`;
        ref.style.opacity = String(Math.max(1 - t * 0.2, 0.7));
      });
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(updateScales);
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    const timer = setTimeout(updateScales, 100);
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [ready, pageId]);

  return { cardRefs };
}
