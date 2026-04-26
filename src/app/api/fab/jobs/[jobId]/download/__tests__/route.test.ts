import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Route test for GET /api/fab/jobs/[jobId]/download (Phase 7-2).
 * Exercises the 3-step flow: detail → pickup → stream bytes.
 */

let mockFabricatorId: string | null = "fab-1";
let detailSpy: ReturnType<typeof vi.fn>;
let pickupSpy: ReturnType<typeof vi.fn>;
let storageDownloadSpy: ReturnType<typeof vi.fn>;

vi.mock("@/lib/fab/auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireFabricatorAuth: async () => {
      if (!mockFabricatorId) {
        return {
          error: NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
          ),
        };
      }
      return {
        fabricator: {
          id: mockFabricatorId,
          display_name: "Test",
          email: "fab@test",
          is_active: true,
        },
        session: { id: "sess-1" },
      };
    },
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        download: (...args: unknown[]) => storageDownloadSpy(...args),
      }),
    },
  }),
}));

vi.mock("@/lib/fabrication/fab-orchestration", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/fabrication/fab-orchestration")
  >("@/lib/fabrication/fab-orchestration");
  return {
    ...actual,
    getFabJobDetail: (...args: unknown[]) => detailSpy(...args),
    pickupJob: (...args: unknown[]) => pickupSpy(...args),
  };
});

import { GET } from "../route";
import { NextRequest } from "next/server";

function makeRequest(jobId: string) {
  return {
    req: new NextRequest(
      `http://localhost/api/fab/jobs/${jobId}/download`,
      { method: "GET" }
    ),
    context: { params: Promise.resolve({ jobId }) },
  };
}

function validDetail(overrides: Record<string, unknown> = {}) {
  return {
    job: {
      id: "job-1",
      status: "approved",
      originalFilename: "original-upload.stl",
      fileType: "stl" as const,
      // Phase 8.1d-19: createdAt now flows into the download
      // filename via submittedAt → date+time discriminator.
      // Pinned UTC moment so tests are deterministic.
      createdAt: "2026-04-26T14:30:12Z",
      ...(overrides.job ?? {}),
    },
    student: { id: "s1", name: "Matt Burton" },
    classInfo: { id: "c1", name: "10 Design" },
    unit: { id: "u1", title: "Cardboard Furniture" },
    machine: { id: "m1", name: "Bambu X1", category: "3d_printer" as const },
    currentRevisionData: null,
    ...overrides,
  };
}

describe("GET /api/fab/jobs/[jobId]/download", () => {
  beforeEach(() => {
    mockFabricatorId = "fab-1";
    detailSpy = vi.fn();
    pickupSpy = vi.fn();
    storageDownloadSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockFabricatorId = null;
    const { req, context } = makeRequest("job-1");
    const res = await GET(req, context);
    expect(res.status).toBe(401);
  });

  it("returns 404 when detail lookup fails (not assigned / not owner)", async () => {
    detailSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Job not found" },
    });
    const { req, context } = makeRequest("job-1");
    const res = await GET(req, context);
    expect(res.status).toBe(404);
    // pickup shouldn't be called if detail fails.
    expect(pickupSpy).not.toHaveBeenCalled();
  });

  it("returns 409 when pickup loses a race", async () => {
    detailSpy.mockResolvedValueOnce(validDetail());
    pickupSpy.mockResolvedValueOnce({
      error: {
        status: 409,
        message: "Another lab tech picked up this job first.",
      },
    });
    const { req, context } = makeRequest("job-1");
    const res = await GET(req, context);
    expect(res.status).toBe(409);
    expect(storageDownloadSpy).not.toHaveBeenCalled();
  });

  it("returns 500 when storage download fails", async () => {
    detailSpy.mockResolvedValueOnce(validDetail());
    pickupSpy.mockResolvedValueOnce({
      jobId: "job-1",
      storagePath: "s1/job-1/v1.stl",
      pickedUpAt: "2026-04-24T01:00:00Z",
    });
    storageDownloadSpy.mockResolvedValueOnce({
      data: null,
      error: { message: "file not found in bucket" },
    });
    const { req, context } = makeRequest("job-1");
    const res = await GET(req, context);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("file not found");
  });

  it("streams bytes with Content-Disposition filename from helper on success", async () => {
    detailSpy.mockResolvedValueOnce(validDetail());
    pickupSpy.mockResolvedValueOnce({
      jobId: "job-1",
      storagePath: "s1/job-1/v1.stl",
      pickedUpAt: "2026-04-24T01:00:00Z",
    });
    const fakeBytes = new Uint8Array([1, 2, 3, 4, 5]);
    storageDownloadSpy.mockResolvedValueOnce({
      data: {
        arrayBuffer: async () => fakeBytes.buffer,
      },
      error: null,
    });

    const { req, context } = makeRequest("job-1");
    const res = await GET(req, context);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("model/stl");
    expect(res.headers.get("Content-Length")).toBe("5");
    const disposition = res.headers.get("Content-Disposition");
    // Phase 8.1d-19: filename now includes originalBase + date+time
    // so two jobs from the same student / class / unit can't
    // overwrite each other in the lab tech's downloads folder.
    // Format: student-grade-unit-originalBase-YYYY-MM-DD-HHMM.ext
    expect(disposition).toContain("attachment");
    expect(disposition).toContain(
      "matt-burton-10-design-cardboard-furniture-original-upload-2026-04-26-1430.stl"
    );
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("uses image/svg+xml content-type for SVG jobs", async () => {
    detailSpy.mockResolvedValueOnce(
      validDetail({
        job: {
          id: "job-1",
          status: "approved",
          originalFilename: "coaster.svg",
          fileType: "svg",
        },
      })
    );
    pickupSpy.mockResolvedValueOnce({
      jobId: "job-1",
      storagePath: "s1/job-1/v1.svg",
      pickedUpAt: "2026-04-24T01:00:00Z",
    });
    storageDownloadSpy.mockResolvedValueOnce({
      data: {
        arrayBuffer: async () => new Uint8Array([0, 0, 0]).buffer,
      },
      error: null,
    });

    const { req, context } = makeRequest("job-1");
    const res = await GET(req, context);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
  });
});
