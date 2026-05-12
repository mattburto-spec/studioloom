import { describe, it, expect } from "vitest";
import { scaleWorkshopPhases } from "../scale-phases";

const BAKED_45 = {
  opening: { durationMinutes: 5, hook: "hook" },
  miniLesson: { durationMinutes: 10, focus: "focus" },
  workTime: { durationMinutes: 25, focus: "work", checkpoints: ["c1"] },
  debrief: { durationMinutes: 5, protocol: "proto" },
};

describe("scaleWorkshopPhases", () => {
  it("returns input unchanged when target equals baked total", () => {
    const out = scaleWorkshopPhases(BAKED_45, 45);
    expect(out).toEqual(BAKED_45);
  });

  it("scales 45 → 60 to 7/13/35/5 with workTime absorbing remainder", () => {
    const out = scaleWorkshopPhases(BAKED_45, 60);
    expect(out.opening.durationMinutes).toBe(7); // 5 * 60/45 = 6.67 → 7
    expect(out.miniLesson.durationMinutes).toBe(13); // 10 * 60/45 = 13.33 → 13
    expect(out.debrief.durationMinutes).toBe(7); // 5 * 60/45 = 6.67 → 7
    expect(out.workTime.durationMinutes).toBe(60 - 7 - 13 - 7); // 33
    const total =
      out.opening.durationMinutes +
      out.miniLesson.durationMinutes +
      out.workTime.durationMinutes +
      out.debrief.durationMinutes;
    expect(total).toBe(60);
  });

  it("scales 45 → 30 down to 3/7/17/3 with totals matching exactly", () => {
    const out = scaleWorkshopPhases(BAKED_45, 30);
    expect(out.opening.durationMinutes).toBe(3); // 5 * 30/45 = 3.33 → 3
    expect(out.miniLesson.durationMinutes).toBe(7); // 10 * 30/45 = 6.67 → 7
    expect(out.debrief.durationMinutes).toBe(3); // 5 * 30/45 = 3.33 → 3
    expect(out.workTime.durationMinutes).toBe(30 - 3 - 7 - 3); // 17
  });

  it("preserves hook/focus/protocol/checkpoints (non-duration fields)", () => {
    const out = scaleWorkshopPhases(BAKED_45, 60);
    expect(out.opening.hook).toBe("hook");
    expect(out.miniLesson.focus).toBe("focus");
    expect(out.workTime.focus).toBe("work");
    expect(out.workTime.checkpoints).toEqual(["c1"]);
    expect(out.debrief.protocol).toBe("proto");
  });

  it("enforces minimum 1 minute per phase when scaling very small", () => {
    const out = scaleWorkshopPhases(BAKED_45, 5);
    expect(out.opening.durationMinutes).toBeGreaterThanOrEqual(1);
    expect(out.miniLesson.durationMinutes).toBeGreaterThanOrEqual(1);
    expect(out.workTime.durationMinutes).toBeGreaterThanOrEqual(1);
    expect(out.debrief.durationMinutes).toBeGreaterThanOrEqual(1);
  });

  it("returns input unchanged when baked total is 0", () => {
    const empty = {
      opening: { durationMinutes: 0 },
      miniLesson: { durationMinutes: 0 },
      workTime: { durationMinutes: 0 },
      debrief: { durationMinutes: 0 },
    };
    expect(scaleWorkshopPhases(empty, 60)).toEqual(empty);
  });

  it("returns input unchanged when target is 0 or negative", () => {
    expect(scaleWorkshopPhases(BAKED_45, 0)).toEqual(BAKED_45);
    expect(scaleWorkshopPhases(BAKED_45, -10)).toEqual(BAKED_45);
  });
});
