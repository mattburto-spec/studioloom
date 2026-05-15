"use client";

/**
 * Class DJ — rotating "thinking" phrase shown during the ~5-15s window
 * between round close and suggestion arrival. School-appropriate playful
 * copy that cycles every 2.5s so the wait feels alive instead of stuck.
 *
 * Used by both the student (ClassDjBlock) and the teacher cockpit
 * (ClassDjTeacherControls) so the two views stay in sync. Originally
 * inlined in ClassDjBlock only — extracted 15 May 2026 after Matt's
 * smoke caught the teacher side stuck on a static phrase.
 */

import { useEffect, useMemo, useState } from "react";

const PHRASES: readonly string[] = [
  "Digging through the crates…",
  "Negotiating with the algorithm…",
  "Spinning the wheels of fate…",
  "Asking three Yes-or-No questions…",
  "Mixing your vibes into 3 tracks…",
  "Consulting the room's BPM…",
  "Auditioning artists in the back room…",
] as const;

interface Props {
  /** Tailwind text-size class for the phrase. Defaults to text-sm. */
  className?: string;
  /** Milliseconds between phrase rotations. Defaults to 2500. */
  intervalMs?: number;
}

export default function ClassDjThinkingPhrase({
  className = "text-sm text-violet-700",
  intervalMs = 2500,
}: Props) {
  const phrases = useMemo(() => PHRASES, []);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setIdx((i) => (i + 1) % phrases.length),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [phrases.length, intervalMs]);
  return <span className={className}>{phrases[idx]}</span>;
}
