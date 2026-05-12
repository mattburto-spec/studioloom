/**
 * Scale Workshop Model phase durations to fit a target period length.
 *
 * Units are generated with a `lessonLengthMinutes` baked into each
 * lesson's `workshopPhases.{opening,miniLesson,workTime,debrief}.durationMinutes`.
 * If the teacher's actual school period differs (e.g. unit was generated
 * for a 45-min period but the school runs 60-min classes), we scale the
 * phases proportionally at render time rather than touching the stored
 * content_data.
 *
 * Rounding always lands an integer per phase. Any rounding remainder is
 * absorbed by workTime (the most flexible phase). If the baked total is
 * 0 or the target equals the baked total, returns the input unchanged.
 *
 * Preserves all non-duration fields (hook, focus, protocol, etc.).
 */

import type { WorkshopPhases } from "@/types";

export function scaleWorkshopPhases(
  baked: WorkshopPhases,
  targetMinutes: number,
): WorkshopPhases {
  const baseTotal =
    baked.opening.durationMinutes +
    baked.miniLesson.durationMinutes +
    baked.workTime.durationMinutes +
    baked.debrief.durationMinutes;

  // Guard: nothing to scale to, or already at target.
  if (
    baseTotal <= 0 ||
    targetMinutes <= 0 ||
    targetMinutes === baseTotal
  ) {
    return baked;
  }

  const scale = targetMinutes / baseTotal;

  // Scale each non-workTime phase first with rounding; absorb the remainder
  // into workTime so the totals sum exactly to targetMinutes.
  const opening = Math.max(1, Math.round(baked.opening.durationMinutes * scale));
  const miniLesson = Math.max(1, Math.round(baked.miniLesson.durationMinutes * scale));
  const debrief = Math.max(1, Math.round(baked.debrief.durationMinutes * scale));
  const workTime = Math.max(1, targetMinutes - opening - miniLesson - debrief);

  return {
    opening: { ...baked.opening, durationMinutes: opening },
    miniLesson: { ...baked.miniLesson, durationMinutes: miniLesson },
    workTime: { ...baked.workTime, durationMinutes: workTime },
    debrief: { ...baked.debrief, durationMinutes: debrief },
  };
}
