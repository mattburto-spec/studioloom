"use client";

/**
 * Class DJ — ARMED state view (student-side).
 *
 * Shows before the teacher launches the round. Phase 4 ships student-
 * visible only; teacher sees the "Start round" button via Teaching Mode
 * cockpit which lands in Phase 6.
 */

export default function ClassDjArmedView() {
  return (
    <div className="my-3 rounded-xl border border-violet-200 bg-violet-50/60 p-5 text-center">
      <div className="text-3xl mb-2">🎵</div>
      <h3 className="text-base font-bold text-violet-900 mb-1">Class DJ</h3>
      <p className="text-sm text-violet-700">
        Teacher will start this soon.
      </p>
      <p className="text-[11px] text-violet-500 mt-2">
        When it goes live you&apos;ll have ~60 seconds to drop your mood.
      </p>
    </div>
  );
}
