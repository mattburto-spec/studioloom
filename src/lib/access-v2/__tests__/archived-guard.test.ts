/**
 * Tests for enforceArchivedReadOnly + isSchoolReadOnly.
 *
 * Phase 4.0 scaffold per docs/projects/access-model-v2-phase-4-brief.md
 * §3.9 item 16. Threaded through every mutation route in §4.4–§4.7.
 */

import { describe, it, expect, vi } from "vitest";
import {
  enforceArchivedReadOnly,
  isSchoolReadOnly,
} from "../school/archived-guard";

const SCHOOL_ID = "11111111-1111-1111-1111-111111111111";

function mockDb(status: string | null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () =>
            status === null
              ? { data: null, error: null }
              : { data: { status }, error: null }
          ),
        })),
      })),
    })),
  } as unknown as Parameters<typeof enforceArchivedReadOnly>[1];
}

describe("enforceArchivedReadOnly", () => {
  it("returns readOnly:false for active schools", async () => {
    const result = await enforceArchivedReadOnly(SCHOOL_ID, mockDb("active"));
    expect(result).toEqual({ readOnly: false, status: "active" });
  });

  it("returns readOnly:false for dormant schools (writes still allowed)", async () => {
    const result = await enforceArchivedReadOnly(SCHOOL_ID, mockDb("dormant"));
    expect(result).toEqual({ readOnly: false, status: "dormant" });
  });

  it("returns readOnly:true with reason 'archived_school' for archived", async () => {
    const result = await enforceArchivedReadOnly(SCHOOL_ID, mockDb("archived"));
    expect(result).toEqual({
      readOnly: true,
      status: "archived",
      reason: "archived_school",
    });
  });

  it("returns readOnly:true with reason 'merged_school' for merged_into", async () => {
    const result = await enforceArchivedReadOnly(
      SCHOOL_ID,
      mockDb("merged_into")
    );
    expect(result).toEqual({
      readOnly: true,
      status: "merged_into",
      reason: "merged_school",
    });
  });

  it("returns readOnly:true with reason 'school_not_found' when missing", async () => {
    const result = await enforceArchivedReadOnly(SCHOOL_ID, mockDb(null));
    expect(result).toEqual({
      readOnly: true,
      status: null,
      reason: "school_not_found",
    });
  });
});

describe("isSchoolReadOnly", () => {
  it("returns false for active", async () => {
    expect(await isSchoolReadOnly(SCHOOL_ID, mockDb("active"))).toBe(false);
  });

  it("returns true for archived", async () => {
    expect(await isSchoolReadOnly(SCHOOL_ID, mockDb("archived"))).toBe(true);
  });

  it("returns true for missing schools (defensive default)", async () => {
    expect(await isSchoolReadOnly(SCHOOL_ID, mockDb(null))).toBe(true);
  });
});
