import { describe, it, expect } from "vitest";
import {
  getArchetypeAwareContent,
  getArchetypeAwareContentByChain,
} from "../archetype-aware";
import type { ActivitySection } from "@/types";

// Minimal ActivitySection factory — `prompt` is required by the type
// but unused by the helper. Other fields default to undefined.
function block(partial: Partial<ActivitySection>): ActivitySection {
  return {
    prompt: "base prompt",
    framing: "base framing",
    task: "base task",
    success_signal: "base success_signal",
    ...partial,
  } as ActivitySection;
}

describe("getArchetypeAwareContent", () => {
  it("returns base content when archetypeId is null", () => {
    const b = block({
      archetype_overrides: {
        "toy-design": { task: "override task" },
      },
    });
    const c = getArchetypeAwareContent(b, null);
    expect(c.framing).toBe("base framing");
    expect(c.task).toBe("base task");
    expect(c.success_signal).toBe("base success_signal");
    expect(c.examples).toEqual([]);
    expect(c.prompts).toEqual([]);
    expect(c.extras).toEqual({});
  });

  it("returns base content when block has no overrides", () => {
    const b = block({});
    const c = getArchetypeAwareContent(b, "toy-design");
    expect(c.framing).toBe("base framing");
    expect(c.task).toBe("base task");
    expect(c.success_signal).toBe("base success_signal");
  });

  it("returns base content when archetype is set but no matching override", () => {
    const b = block({
      archetype_overrides: {
        "toy-design": { task: "toy task" },
      },
    });
    const c = getArchetypeAwareContent(b, "architecture-interior");
    expect(c.task).toBe("base task");
    expect(c.framing).toBe("base framing");
  });

  it("returns override content when archetype matches", () => {
    const b = block({
      archetype_overrides: {
        "toy-design": {
          framing: "toy framing",
          task: "toy task",
          success_signal: "toy success",
          examples: ["a toy example"],
          prompts: ["a toy prompt"],
        },
      },
    });
    const c = getArchetypeAwareContent(b, "toy-design");
    expect(c.framing).toBe("toy framing");
    expect(c.task).toBe("toy task");
    expect(c.success_signal).toBe("toy success");
    expect(c.examples).toEqual(["a toy example"]);
    expect(c.prompts).toEqual(["a toy prompt"]);
  });

  it("merges partial overrides — override-defined fields win, undefined fields fall back to base", () => {
    const b = block({
      framing: "base framing",
      task: "base task",
      success_signal: "base success",
      archetype_overrides: {
        "toy-design": { task: "toy task only" },
      },
    });
    const c = getArchetypeAwareContent(b, "toy-design");
    expect(c.task).toBe("toy task only");
    expect(c.framing).toBe("base framing");
    expect(c.success_signal).toBe("base success");
  });

  it("captures non-canonical override keys into extras", () => {
    const b = block({
      archetype_overrides: {
        "toy-design": {
          task: "toy task",
          synthesis_placeholder: "something a stranger could spot",
          custom_chip_set: ["a", "b"],
        },
      },
    });
    const c = getArchetypeAwareContent(b, "toy-design");
    expect(c.task).toBe("toy task");
    expect(c.extras.synthesis_placeholder).toBe("something a stranger could spot");
    expect(c.extras.custom_chip_set).toEqual(["a", "b"]);
    // Canonical keys must NOT bleed into extras.
    expect(c.extras.task).toBeUndefined();
    expect(c.extras.framing).toBeUndefined();
  });

  it("ignores override fields with the wrong type (defensive fallback)", () => {
    const b = block({
      framing: "base framing",
      archetype_overrides: {
        "toy-design": {
          // Wrong types — should not poison the canonical output.
          framing: 42 as unknown as string,
          examples: "not an array" as unknown as string[],
        },
      },
    });
    const c = getArchetypeAwareContent(b, "toy-design");
    expect(c.framing).toBe("base framing");
    expect(c.examples).toEqual([]);
  });

  // Negative-control sanity check: if precedence were inverted (base
  // winning over a present override), this test catches it.
  it("[negative control] picks override over base when override is set", () => {
    const b = block({
      task: "base task — this should LOSE to the override",
      archetype_overrides: {
        "toy-design": { task: "override wins" },
      },
    });
    expect(getArchetypeAwareContent(b, "toy-design").task).toBe("override wins");
    // Flipping null → "toy-design" must change the output. If both
    // paths returned the same string, the helper would be broken.
    expect(getArchetypeAwareContent(b, "toy-design").task).not.toBe(
      getArchetypeAwareContent(b, null).task,
    );
  });
});

describe("getArchetypeAwareContentByChain", () => {
  it("prefers the first ID with a matching override", () => {
    const b = block({
      archetype_overrides: {
        "toy-design": { task: "archetype-level toy task" },
        "g8-brief-board-game": { task: "card-specific board-game task" },
      },
    });
    // Card slug first — more specific wins.
    const c = getArchetypeAwareContentByChain(b, [
      "g8-brief-board-game",
      "toy-design",
    ]);
    expect(c.task).toBe("card-specific board-game task");
  });

  it("falls through to the next ID when the first has no override", () => {
    const b = block({
      archetype_overrides: {
        "toy-design": { task: "archetype-level toy task" },
      },
    });
    const c = getArchetypeAwareContentByChain(b, [
      "g8-brief-board-game", // no entry
      "toy-design", // hit
    ]);
    expect(c.task).toBe("archetype-level toy task");
  });

  it("returns base when no candidate ID matches and skips nulls", () => {
    const b = block({
      task: "base task",
      archetype_overrides: { "toy-design": { task: "toy task" } },
    });
    const c = getArchetypeAwareContentByChain(b, [
      null,
      "architecture-interior",
    ]);
    expect(c.task).toBe("base task");
  });
});
