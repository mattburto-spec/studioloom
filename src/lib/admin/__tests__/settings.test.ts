/**
 * Admin Settings — unit tests for loadAdminSettings + updateAdminSetting.
 * Tests verify exact default values (Lesson #38), fallback on table missing,
 * key validation, audit log writes, and sandbox guard.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadAdminSettings,
  updateAdminSetting,
  InvalidSettingKeyError,
  ADMIN_SETTINGS_DEFAULTS,
  shouldEnforceCostCeilings,
} from "../settings";
import { AdminSettingKey } from "@/types/admin";

// ─── Mock Supabase ───────────────────────────────────────────

function createMockSupabase(overrides?: {
  selectData?: any[];
  selectError?: Error | null;
  singleData?: any;
  updateError?: Error | null;
  insertError?: Error | null;
}) {
  const insertFn = vi.fn().mockResolvedValue({ error: overrides?.insertError ?? null });

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === "admin_audit_log") {
      return { insert: insertFn };
    }
    return {
      select: vi.fn().mockImplementation(() => {
        // Base select result (for loadAdminSettings — no chaining)
        const base = {
          data: overrides?.selectData ?? [],
          error: overrides?.selectError ?? null,
          // For updateAdminSetting — .select().eq().single() chain
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: overrides?.singleData ?? null,
              error: null,
            }),
          }),
        };
        return base;
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: overrides?.updateError ?? null }),
      }),
      insert: insertFn,
    };
  });

  return { from: fromFn, _mocks: { fromFn, insertFn } };
}

// ─── loadAdminSettings ───────────────────────────────────────

describe("loadAdminSettings", () => {
  it("returns typed map with all 5 keys from seed rows", async () => {
    const seedRows = [
      { key: AdminSettingKey.STAGE_ENABLED, value: { retrieve: true, assemble: true, gap_fill: true, polish: true, timing: true, score: true } },
      { key: AdminSettingKey.COST_CEILING_PER_RUN, value: 5.0 },
      { key: AdminSettingKey.COST_CEILING_PER_DAY, value: 50.0 },
      { key: AdminSettingKey.MODEL_OVERRIDE, value: {} },
      { key: AdminSettingKey.STARTER_PATTERNS_ENABLED, value: true },
    ];
    const supabase = createMockSupabase({ selectData: seedRows });

    const result = await loadAdminSettings(supabase);

    // Assert exact values per Lesson #38
    expect(result[AdminSettingKey.STAGE_ENABLED]).toEqual({
      retrieve: true, assemble: true, gap_fill: true, polish: true, timing: true, score: true,
    });
    expect(result[AdminSettingKey.COST_CEILING_PER_RUN]).toBe(5.0);
    expect(result[AdminSettingKey.COST_CEILING_PER_DAY]).toBe(50.0);
    expect(result[AdminSettingKey.MODEL_OVERRIDE]).toEqual({});
    expect(result[AdminSettingKey.STARTER_PATTERNS_ENABLED]).toBe(true);
  });

  it("returns hardcoded defaults and logs warning when table does not exist", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const supabase = createMockSupabase({
      selectError: new Error('relation "admin_settings" does not exist'),
    });

    const result = await loadAdminSettings(supabase);

    expect(result).toEqual(ADMIN_SETTINGS_DEFAULTS);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[admin-settings] Failed to load"),
      expect.stringContaining("does not exist")
    );
    warnSpy.mockRestore();
  });

  // NC: remove the catch block → test should fail because the error propagates
});

// ─── updateAdminSetting ──────────────────────────────────────

describe("updateAdminSetting", () => {
  it("throws InvalidSettingKeyError for invalid key", async () => {
    const supabase = createMockSupabase();
    await expect(
      updateAdminSetting(supabase, "invalid.key", true, null)
    ).rejects.toThrow(InvalidSettingKeyError);
  });

  // NC: remove the key-validation check in settings.ts → this test should pass
  // (because the key won't be rejected). Verifying the guard actually works.

  it("writes exactly one audit row with correct fields", async () => {
    const supabase = createMockSupabase({
      singleData: { value: 5.0 },
    });

    await updateAdminSetting(
      supabase,
      AdminSettingKey.COST_CEILING_PER_RUN,
      10.0,
      "actor-uuid-123"
    );

    // Verify audit log insert was called
    const insertCalls = supabase._mocks.insertFn.mock.calls;
    // Find the call that wrote to admin_audit_log
    const auditCall = insertCalls.find((call: any[]) =>
      call[0]?.action === "update_setting"
    );
    expect(auditCall).toBeDefined();
    expect(auditCall[0]).toEqual({
      actor_id: "actor-uuid-123",
      action: "update_setting",
      target_table: "admin_settings",
      target_key: AdminSettingKey.COST_CEILING_PER_RUN,
      old_value: 5.0,
      new_value: 10.0,
    });
  });
});

// ─── shouldEnforceCostCeilings ───────────────────────────────

describe("shouldEnforceCostCeilings", () => {
  it("returns false when sandboxMode is true", () => {
    expect(shouldEnforceCostCeilings({ sandboxMode: true })).toBe(false);
  });

  it("returns true when sandboxMode is false", () => {
    expect(shouldEnforceCostCeilings({ sandboxMode: false })).toBe(true);
  });

  it("returns true when sandboxMode is undefined", () => {
    expect(shouldEnforceCostCeilings({})).toBe(true);
  });
});

// ─── Source-static guards ────────────────────────────────────

describe("source-static: settings.ts", () => {
  it("exports shouldEnforceCostCeilings with sandboxMode check", () => {
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(
      path.join(__dirname, "..", "settings.ts"),
      "utf-8"
    );
    expect(src).toContain("shouldEnforceCostCeilings");
    expect(src).toContain("sandboxMode");
  });
});
