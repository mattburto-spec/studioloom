/**
 * useCollapsible — height-animate a container's open/closed state.
 *
 * Designer spec (TFL.2 Pass A): cubic-bezier(.4, 0, .2, 1), 320ms,
 * height-only animation. The measure→set→'auto' pattern avoids the
 * common pitfall where setting `height: auto` directly skips the
 * transition entirely:
 *
 *   1. open=false → height: 0
 *   2. open=true  → measure scrollHeight, set height: <px>, await
 *      transition end, set height: 'auto' (so subsequent content
 *      changes don't fight the fixed pixel value).
 *
 * Honours `prefers-reduced-motion` — when reduced motion is requested
 * the hook just toggles between height: 0 and height: 'auto' instantly.
 *
 * Pulled out as a shared hook because Pass B's marking-page composer
 * + the multi-question stepper will reuse the same animation shape.
 * Single source of truth on the easing curve + duration.
 */

"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 320;

/** Returns refs + height to apply directly to the collapsible element.
 *  Apply as `<div ref={ref} style={{ height, overflow: "hidden",
 *  transition: ... }}>`. The hook owns the height value lifecycle. */
export function useCollapsible(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto" | 0>(open ? "auto" : 0);

  // Detect reduced motion at hook level so the consumer doesn't have to.
  const reducedMotionRef = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (reducedMotionRef.current) {
      setHeight(open ? "auto" : 0);
      return;
    }

    if (open) {
      // From height:0 OR height:auto → measure scrollHeight, set px,
      // then transition runs to that px. After it completes, switch to
      // 'auto' so dynamic content can grow without re-measuring.
      const target = el.scrollHeight;
      // If we were at 'auto', first reset to current rendered height
      // so the transition has a starting point.
      if (height === "auto") {
        setHeight(el.getBoundingClientRect().height);
        // Schedule the px-target on the next frame to give the DOM
        // a chance to lock in the starting value.
        requestAnimationFrame(() => setHeight(target));
      } else {
        setHeight(target);
      }
      const t = setTimeout(() => setHeight("auto"), DURATION_MS + 20);
      return () => clearTimeout(t);
    } else {
      // From 'auto' or px → first lock in the current rendered height
      // (so the transition has a non-auto starting point), then drop
      // to 0 on the next frame.
      if (height === "auto") {
        setHeight(el.getBoundingClientRect().height);
        requestAnimationFrame(() => setHeight(0));
      } else {
        setHeight(0);
      }
    }
    // We intentionally only respond to `open` flips. Including `height`
    // here would cause feedback loops when the hook itself sets the
    // height.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return {
    ref,
    height,
    transitionStyle:
      `height ${DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)` as const,
  };
}
