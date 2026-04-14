/**
 * Tests for persistModeratedBlocks — maps ModeratedBlock[] to activity_blocks
 * rows and inserts them in batches of 50 with optional embeddings.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { persistModeratedBlocks } from "../persist-blocks";
import type { ModeratedBlock } from "../types";

// ── Helpers ──

function makeBlock(overrides: Partial<ModeratedBlock> = {}): ModeratedBlock {
  return {
    tempId: "tmp-1",
    title: "Build a prototype",
    description: "Students build a cardboard prototype",
    prompt: "Create a scale model of your packaging design",
    bloom_level: "apply",
    time_weight: "extended",
    grouping: "individual",
    phase: "develop",
    activity_category: "making",
    materials: ["cardboard", "tape"],
    scaffolding_notes: undefined,
    udl_hints: undefined,
    source_section_index: 2,
    piiFlags: [],
    copyrightFlag: "own",
    moderationStatus: "approved",
    moderationFlags: [],
    ...overrides,
  };
}

function makeMockClient() {
  const selectMock = vi.fn();
  const insertMock = vi.fn().mockReturnValue({ select: selectMock });
  const fromMock = vi.fn().mockReturnValue({ insert: insertMock });

  return { fromMock, insertMock, selectMock, client: { from: fromMock } };
}

// ── Mock embeddings ──

vi.mock("@/lib/ai/embeddings", () => ({
  embedAll: vi.fn(),
}));

let mockEmbedAll: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  const mod = await import("@/lib/ai/embeddings");
  mockEmbedAll = mod.embedAll as ReturnType<typeof vi.fn>;
  mockEmbedAll.mockReset();
});

// ── Tests ──

describe("persistModeratedBlocks", () => {
  it("returns { insertedCount: 0 } for empty blocks", async () => {
    const { client, fromMock } = makeMockClient();
    const result = await persistModeratedBlocks(client, "teacher-1", "ci-1", []);
    expect(result).toEqual({ insertedCount: 0, errors: [] });
    expect(fromMock).not.toHaveBeenCalled();
    expect(mockEmbedAll).not.toHaveBeenCalled();
  });

  it("maps ModeratedBlock to correct activity_blocks row shape", async () => {
    const fakeEmbed = Array.from({ length: 1024 }, (_, i) => i * 0.001);
    mockEmbedAll.mockResolvedValue([fakeEmbed]);

    const { client, insertMock, selectMock } = makeMockClient();
    selectMock.mockResolvedValue({ data: [{ id: "uuid-1" }], error: null });

    const block = makeBlock({
      piiFlags: [{ type: "email", value: "a@b.com", position: 10, aiVerified: false }],
      copyrightFlag: "copyrighted",
      moderationStatus: "flagged",
    });

    await persistModeratedBlocks(client, "teacher-1", "ci-99", [block]);

    const insertedRows = insertMock.mock.calls[0][0];
    expect(insertedRows).toHaveLength(1);
    const row = insertedRows[0];

    expect(row.teacher_id).toBe("teacher-1");
    expect(row.title).toBe("Build a prototype");
    expect(row.description).toBe("Students build a cardboard prototype");
    expect(row.prompt).toBe("Create a scale model of your packaging design");
    expect(row.source_type).toBe("extracted");
    expect(row.source_upload_id).toBe("ci-99");
    expect(row.bloom_level).toBe("apply");
    expect(row.time_weight).toBe("extended");
    expect(row.grouping).toBe("individual");
    expect(row.phase).toBe("develop");
    expect(row.activity_category).toBe("making");
    expect(row.materials_needed).toEqual(["cardboard", "tape"]);
    expect(row.pii_scanned).toBe(true);
    // pii_flags is JSONB — passed as array, NOT stringified
    expect(row.pii_flags).toEqual([{ type: "email", value: "a@b.com", position: 10, aiVerified: false }]);
    expect(row.copyright_flag).toBe("copyrighted");
    expect(row.moderation_status).toBe("flagged");
    expect(row.teacher_verified).toBe(false);
    expect(row.is_public).toBe(false);
    expect(row.is_archived).toBe(false);
    // content_fingerprint is a SHA-256 hex digest over normalised(title + prompt + source_type)
    expect(typeof row.content_fingerprint).toBe("string");
    expect(row.content_fingerprint).toHaveLength(64); // SHA-256 hex = 64 chars
    // embedding is JSON-stringified for pgvector
    expect(typeof row.embedding).toBe("string");
    expect(JSON.parse(row.embedding)).toHaveLength(1024);
  });

  it("batches inserts at 50 per batch", async () => {
    mockEmbedAll.mockResolvedValue(Array.from({ length: 75 }, () => [0.1]));

    const { client, insertMock, selectMock } = makeMockClient();
    selectMock.mockResolvedValue({ data: Array.from({ length: 50 }, (_, i) => ({ id: `id-${i}` })), error: null });

    const blocks = Array.from({ length: 75 }, (_, i) =>
      makeBlock({ tempId: `tmp-${i}` })
    );

    const result = await persistModeratedBlocks(client, "t-1", "ci-1", blocks);

    // 2 insert calls: batch of 50 + batch of 25
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock.mock.calls[0][0]).toHaveLength(50);
    expect(insertMock.mock.calls[1][0]).toHaveLength(25);
    expect(result.insertedCount).toBe(100); // 50 + 50 from mock
  });

  it("proceeds with null embeddings when embedAll throws", async () => {
    mockEmbedAll.mockRejectedValue(new Error("Voyage API down"));

    const { client, insertMock, selectMock } = makeMockClient();
    selectMock.mockResolvedValue({ data: [{ id: "uuid-1" }], error: null });

    const result = await persistModeratedBlocks(client, "t-1", "ci-1", [makeBlock()]);

    expect(result.insertedCount).toBe(1);
    expect(result.errors).toHaveLength(0);
    // Row was inserted with null embedding
    const row = insertMock.mock.calls[0][0][0];
    expect(row.embedding).toBeNull();
  });

  it("does not throw on Supabase insert error", async () => {
    mockEmbedAll.mockResolvedValue([[0.1]]);

    const { client, selectMock } = makeMockClient();
    selectMock.mockResolvedValue({ data: null, error: { message: "constraint violation" } });

    const result = await persistModeratedBlocks(client, "t-1", "ci-1", [makeBlock()]);

    expect(result.insertedCount).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBe("constraint violation");
  });
});
