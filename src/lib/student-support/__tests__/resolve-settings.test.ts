import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Phase 2.5 resolver unit tests.
 *
 * Per project convention (no React testing-library, pure helpers + mocked I/O).
 * Mocks createAdminClient with a tiny in-memory store; tests assert the
 * precedence chain end-to-end.
 */

let studentRow: { support_settings: unknown; learning_profile: unknown } | null = null;
let csRow: { support_settings: unknown } | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "students") {
        return {
          select: (_cols: string) => {
            const chain = {
              eq: (_col: string, _val: unknown) => chain,
              maybeSingle: async () => ({ data: studentRow, error: null }),
            };
            return chain;
          },
        };
      }
      if (table === "class_students") {
        return {
          select: (_cols: string) => {
            const chain = {
              eq: (_col: string, _val: unknown) => chain,
              maybeSingle: async () => ({ data: csRow, error: null }),
            };
            return chain;
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { resolveStudentSettings } from "../resolve-settings";
import { parseSupportSettings, mergeSupportSettingsForWrite } from "../types";

describe("parseSupportSettings", () => {
  it("returns empty object for null/undefined/non-object input", () => {
    expect(parseSupportSettings(null)).toEqual({});
    expect(parseSupportSettings(undefined)).toEqual({});
    expect(parseSupportSettings("string")).toEqual({});
    expect(parseSupportSettings(42)).toEqual({});
    expect(parseSupportSettings([])).toEqual({});
  });

  it("preserves valid l1_target_override values", () => {
    expect(parseSupportSettings({ l1_target_override: "zh" })).toEqual({
      l1_target_override: "zh",
    });
    expect(parseSupportSettings({ l1_target_override: "en" })).toEqual({
      l1_target_override: "en",
    });
  });

  it("drops unsupported l1_target_override codes", () => {
    expect(parseSupportSettings({ l1_target_override: "klingon" })).toEqual({});
    expect(parseSupportSettings({ l1_target_override: 42 })).toEqual({});
  });

  it("preserves tap_a_word_enabled booleans", () => {
    expect(parseSupportSettings({ tap_a_word_enabled: true })).toEqual({
      tap_a_word_enabled: true,
    });
    expect(parseSupportSettings({ tap_a_word_enabled: false })).toEqual({
      tap_a_word_enabled: false,
    });
  });

  it("explicit null values are preserved (means 'reset override')", () => {
    expect(parseSupportSettings({ l1_target_override: null })).toEqual({
      l1_target_override: null,
    });
    expect(parseSupportSettings({ tap_a_word_enabled: null })).toEqual({
      tap_a_word_enabled: null,
    });
  });

  it("drops unknown keys", () => {
    expect(
      parseSupportSettings({ random_key: "x", l1_target_override: "ko" })
    ).toEqual({ l1_target_override: "ko" });
  });
});

describe("mergeSupportSettingsForWrite", () => {
  it("returns existing as-is when incoming is empty", () => {
    expect(
      mergeSupportSettingsForWrite({ l1_target_override: "zh" }, {})
    ).toEqual({ l1_target_override: "zh" });
  });

  it("overlays incoming values onto existing (basic merge)", () => {
    expect(
      mergeSupportSettingsForWrite(
        { l1_target_override: "zh", tap_a_word_enabled: true },
        { l1_target_override: "ko" }
      )
    ).toEqual({ l1_target_override: "ko", tap_a_word_enabled: true });
  });

  it("explicit null DELETES the key (Bug 3 — not persisted as null)", () => {
    const out = mergeSupportSettingsForWrite(
      { l1_target_override: "zh", tap_a_word_enabled: true },
      { l1_target_override: null }
    );
    expect(out).toEqual({ tap_a_word_enabled: true });
    expect("l1_target_override" in out).toBe(false);
  });

  it("null on a key that doesn't exist is a no-op (deletion is idempotent)", () => {
    expect(
      mergeSupportSettingsForWrite(
        { tap_a_word_enabled: true },
        { l1_target_override: null }
      )
    ).toEqual({ tap_a_word_enabled: true });
  });

  it("simultaneous reset of both keys clears the JSONB to {}", () => {
    expect(
      mergeSupportSettingsForWrite(
        { l1_target_override: "zh", tap_a_word_enabled: false },
        { l1_target_override: null, tap_a_word_enabled: null }
      )
    ).toEqual({});
  });

  it("strips junk from existing on round-trip (defensive)", () => {
    expect(
      mergeSupportSettingsForWrite(
        { l1_target_override: "zh", random_key: "junk", another: 42 },
        { tap_a_word_enabled: true }
      )
    ).toEqual({ l1_target_override: "zh", tap_a_word_enabled: true });
  });

  it("handles null/undefined existing", () => {
    expect(mergeSupportSettingsForWrite(null, { l1_target_override: "ja" })).toEqual({
      l1_target_override: "ja",
    });
    expect(mergeSupportSettingsForWrite(undefined, { tap_a_word_enabled: false })).toEqual({
      tap_a_word_enabled: false,
    });
  });
});

describe("resolveStudentSettings", () => {
  beforeEach(() => {
    studentRow = null;
    csRow = null;
  });

  it("returns defaults when no student row exists (defensive)", async () => {
    studentRow = null;
    const result = await resolveStudentSettings("missing-student");
    expect(result).toEqual({
      l1Target: "en",
      tapAWordEnabled: true,
      l1Source: "default",
      tapASource: "default",
    });
  });

  it("derives l1 from intake when no overrides set (English student)", async () => {
    studentRow = {
      support_settings: {},
      learning_profile: { languages_at_home: ["English"] },
    };
    const result = await resolveStudentSettings("student-1");
    expect(result.l1Target).toBe("en");
    expect(result.l1Source).toBe("intake");
    expect(result.tapAWordEnabled).toBe(true);
    expect(result.tapASource).toBe("default");
  });

  it("derives l1 from intake when no overrides set (Mandarin student)", async () => {
    studentRow = {
      support_settings: {},
      learning_profile: { languages_at_home: ["Mandarin", "English"] },
    };
    const result = await resolveStudentSettings("student-1");
    expect(result.l1Target).toBe("zh");
    expect(result.l1Source).toBe("intake");
  });

  it("student-level override wins over intake", async () => {
    studentRow = {
      support_settings: { l1_target_override: "ko" },
      learning_profile: { languages_at_home: ["Mandarin"] }, // would otherwise resolve to zh
    };
    const result = await resolveStudentSettings("student-1");
    expect(result.l1Target).toBe("ko");
    expect(result.l1Source).toBe("student-override");
  });

  it("class-level override wins over student-level override", async () => {
    studentRow = {
      support_settings: { l1_target_override: "ko" },
      learning_profile: { languages_at_home: ["Mandarin"] },
    };
    csRow = { support_settings: { l1_target_override: "ja" } };
    const result = await resolveStudentSettings("student-1", "class-1");
    expect(result.l1Target).toBe("ja");
    expect(result.l1Source).toBe("class-override");
  });

  it("class-level override only applies when classId is provided", async () => {
    studentRow = {
      support_settings: { l1_target_override: "ko" },
      learning_profile: { languages_at_home: ["Mandarin"] },
    };
    csRow = { support_settings: { l1_target_override: "ja" } };
    const result = await resolveStudentSettings("student-1"); // no classId
    expect(result.l1Target).toBe("ko"); // student-level wins, class never queried
    expect(result.l1Source).toBe("student-override");
  });

  it("tap_a_word_enabled defaults to true when no overrides set", async () => {
    studentRow = {
      support_settings: {},
      learning_profile: { languages_at_home: ["English"] },
    };
    const result = await resolveStudentSettings("student-1");
    expect(result.tapAWordEnabled).toBe(true);
    expect(result.tapASource).toBe("default");
  });

  it("student-level tap_a_word_enabled = false disables for that student", async () => {
    studentRow = {
      support_settings: { tap_a_word_enabled: false },
      learning_profile: { languages_at_home: ["English"] },
    };
    const result = await resolveStudentSettings("student-1");
    expect(result.tapAWordEnabled).toBe(false);
    expect(result.tapASource).toBe("student-override");
  });

  it("class-level tap_a_word_enabled overrides student-level", async () => {
    studentRow = {
      support_settings: { tap_a_word_enabled: false },
      learning_profile: { languages_at_home: ["English"] },
    };
    csRow = { support_settings: { tap_a_word_enabled: true } };
    const result = await resolveStudentSettings("student-1", "class-1");
    expect(result.tapAWordEnabled).toBe(true);
    expect(result.tapASource).toBe("class-override");
  });

  it("explicit null overrides fall through to next level", async () => {
    studentRow = {
      support_settings: { l1_target_override: "ko", tap_a_word_enabled: false },
      learning_profile: { languages_at_home: ["Mandarin"] },
    };
    csRow = { support_settings: { l1_target_override: null, tap_a_word_enabled: null } };
    const result = await resolveStudentSettings("student-1", "class-1");
    // class override is null → fall through to student level
    expect(result.l1Target).toBe("ko");
    expect(result.l1Source).toBe("student-override");
    expect(result.tapAWordEnabled).toBe(false);
    expect(result.tapASource).toBe("student-override");
  });

  it("invalid override values in DB are ignored (defensive parse)", async () => {
    studentRow = {
      support_settings: { l1_target_override: "klingon", tap_a_word_enabled: "yes" },
      learning_profile: { languages_at_home: ["Mandarin"] },
    };
    const result = await resolveStudentSettings("student-1");
    // Garbage values stripped → falls back to intake / default
    expect(result.l1Target).toBe("zh");
    expect(result.l1Source).toBe("intake");
    expect(result.tapAWordEnabled).toBe(true);
    expect(result.tapASource).toBe("default");
  });

  it("unmapped intake language falls back to en with l1Source='default'", async () => {
    studentRow = {
      support_settings: {},
      learning_profile: { languages_at_home: ["Tagalog"] }, // unmapped
    };
    const result = await resolveStudentSettings("student-1");
    expect(result.l1Target).toBe("en");
    expect(result.l1Source).toBe("default"); // not 'intake', because intake was unmappable
  });
});
