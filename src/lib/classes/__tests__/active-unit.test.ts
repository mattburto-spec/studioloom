/**
 * Unit tests for src/lib/classes/active-unit.ts.
 *
 * Wrapper around supabase.rpc("set_active_unit", ...). The Postgres function
 * itself is shape-tested in migration-set-active-unit-function.test.ts;
 * here we only verify the TS-side discriminated-union return shape and that
 * the RPC is called with the exact argument names the function expects
 * (class_uuid, target_unit_uuid — not class_id/unit_id).
 */

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { setActiveUnit } from "../active-unit";

function makeSupabase(rpcResult: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  rpc: ReturnType<typeof vi.fn>;
} {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const client = { rpc } as unknown as SupabaseClient;
  return { client, rpc };
}

const CLASS_ID = "11111111-1111-1111-1111-111111111111";
const UNIT_ID = "22222222-2222-2222-2222-222222222222";

describe("setActiveUnit", () => {
  describe("happy path", () => {
    it("returns { ok: true } when the RPC succeeds", async () => {
      const { client } = makeSupabase({ data: null, error: null });
      const result = await setActiveUnit(client, CLASS_ID, UNIT_ID);
      expect(result).toEqual({ ok: true });
    });

    it("calls supabase.rpc('set_active_unit', { class_uuid, target_unit_uuid }) with exact param names", async () => {
      const { client, rpc } = makeSupabase({ data: null, error: null });
      await setActiveUnit(client, CLASS_ID, UNIT_ID);
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith("set_active_unit", {
        class_uuid: CLASS_ID,
        target_unit_uuid: UNIT_ID,
      });
    });
  });

  describe("error paths", () => {
    it("surfaces a 42501 auth error with both message and code (Block B1 auth gate)", async () => {
      const { client } = makeSupabase({
        data: null,
        error: {
          message: "set_active_unit: not teacher of class …",
          code: "42501",
        },
      });
      const result = await setActiveUnit(client, CLASS_ID, UNIT_ID);
      expect(result).toEqual({
        ok: false,
        error: "set_active_unit: not teacher of class …",
        code: "42501",
      });
    });

    it("surfaces a generic error with code: undefined when SQLSTATE is missing", async () => {
      const { client } = makeSupabase({
        data: null,
        error: { message: "boom" },
      });
      const result = await setActiveUnit(client, CLASS_ID, UNIT_ID);
      expect(result).toEqual({
        ok: false,
        error: "boom",
        code: undefined,
      });
    });

    it("surfaces the 42501 unit-ownership-gate error from migration 20260516052310 (Block C)", async () => {
      // Block C added a SECOND auth gate to set_active_unit: caller must
      // own the target unit OR the unit must be is_published=true. Both
      // gates raise 42501; the discriminated-union surfaces the gate-2
      // message verbatim so callers can branch on message text if they
      // need to differentiate (the existing toggleUnit toast doesn't —
      // toastForRpcCode("42501") is generic across both gates).
      const gate2Message =
        "set_active_unit: cannot attach unit 85008520-b92c-4a5c-aeb7-77e65611c48b (caller does not own it and it is not published)";
      const { client } = makeSupabase({
        data: null,
        error: { message: gate2Message, code: "42501" },
      });
      const result = await setActiveUnit(client, CLASS_ID, UNIT_ID);
      expect(result).toEqual({
        ok: false,
        error: gate2Message,
        code: "42501",
      });
      // Same SQLSTATE as gate 1 — wrapper doesn't differentiate, by design.
      // Callers can branch on message text if they need to.
      if (!result.ok) {
        expect(result.error).toContain("cannot attach unit");
      }
    });
  });

  describe("discriminated-union shape (matches src/lib/ai/call.ts convention)", () => {
    it("ok: true variant has no error field — callers can narrow without optional-chaining", async () => {
      const { client } = makeSupabase({ data: null, error: null });
      const result = await setActiveUnit(client, CLASS_ID, UNIT_ID);
      if (result.ok) {
        // Type-level: result is narrowed to { ok: true }; no error/code keys.
        // We assert at runtime that the keys we expect to exist do, and that
        // the keys we expect to NOT exist don't.
        expect(Object.keys(result).sort()).toEqual(["ok"]);
      } else {
        throw new Error("expected ok: true branch");
      }
    });

    it("ok: false variant always carries error string; code is optional", async () => {
      const { client } = makeSupabase({
        data: null,
        error: { message: "denied", code: "42501" },
      });
      const result = await setActiveUnit(client, CLASS_ID, UNIT_ID);
      if (!result.ok) {
        expect(typeof result.error).toBe("string");
        expect(result.code).toBe("42501");
      } else {
        throw new Error("expected ok: false branch");
      }
    });
  });
});
