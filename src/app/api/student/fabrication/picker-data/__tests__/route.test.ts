import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Route-level test for GET /api/student/fabrication/picker-data.
 *
 * Mocks requireStudentAuth + a fake Supabase client that returns preset
 * rows for class_students and machine_profiles.
 */

let mockStudentId: string | null = "student-1";
let classStudentsData: unknown = null;
let classStudentsError: string | null = null;
let machineProfilesData: unknown = null;
let machineProfilesError: string | null = null;

vi.mock("@/lib/auth/student", () => ({
  requireStudentAuth: async () => {
    if (!mockStudentId) {
      return {
        error: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      };
    }
    return { studentId: mockStudentId };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = (_cols: string) => chain;
      chain.eq = (_col: string, _val: unknown) => chain;
      chain.order = (_col: string, _opts: unknown) => chain;

      // Resolve the result at await-time. PostgREST queries are thenable
      // (await-able) — implement that here.
      (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => {
        if (table === "class_students") {
          if (classStudentsError) {
            return resolve({ data: null, error: { message: classStudentsError } });
          }
          return resolve({ data: classStudentsData, error: null });
        }
        if (table === "machine_profiles") {
          if (machineProfilesError) {
            return resolve({ data: null, error: { message: machineProfilesError } });
          }
          return resolve({ data: machineProfilesData, error: null });
        }
        return resolve({ data: null, error: null });
      };
      return chain;
    },
  }),
}));

import { GET } from "../route";
import { NextRequest } from "next/server";

function makeRequest(): NextRequest {
  return new NextRequest(
    "http://localhost/api/student/fabrication/picker-data",
    { method: "GET" }
  );
}

describe("GET /api/student/fabrication/picker-data", () => {
  beforeEach(() => {
    mockStudentId = "student-1";
    classStudentsData = [];
    classStudentsError = null;
    machineProfilesData = [];
    machineProfilesError = null;
  });

  it("returns 401 when student is not authenticated", async () => {
    mockStudentId = null;
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns empty arrays when student has no enrolments and no profiles exist", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ classes: [], machineProfiles: [] });
  });

  it("unwraps PostgREST single-object classes embedding into a flat list", async () => {
    classStudentsData = [
      { classes: { id: "c1", name: "Period 3 Design", code: "PD3" } },
      { classes: { id: "c2", name: "Advanced Maker", code: "ADVM" } },
    ];
    const res = await GET(makeRequest());
    const body = await res.json();
    // Sorted alphabetically by name.
    expect(body.classes).toEqual([
      { id: "c2", name: "Advanced Maker", code: "ADVM" },
      { id: "c1", name: "Period 3 Design", code: "PD3" },
    ]);
  });

  it("also handles array-shaped classes embedding (PostgREST variant)", async () => {
    classStudentsData = [
      { classes: [{ id: "c1", name: "Only Class", code: "OC" }] },
    ];
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.classes).toEqual([{ id: "c1", name: "Only Class", code: "OC" }]);
  });

  it("skips null classes embeddings silently (no orphan rows)", async () => {
    classStudentsData = [
      { classes: null },
      { classes: { id: "c1", name: "Real Class", code: "RC" } },
    ];
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.classes).toEqual([{ id: "c1", name: "Real Class", code: "RC" }]);
  });

  it("passes through machine profile shape with all expected columns", async () => {
    // Phase 8.1d-5: route now flattens the nested fabrication_labs join
    // into a `lab_name` field. lab_id is shipped too. System templates
    // pass through with both as null.
    machineProfilesData = [
      {
        id: "m1",
        name: "Bambu X1C",
        machine_category: "3d_printer",
        bed_size_x_mm: 256,
        bed_size_y_mm: 256,
        nozzle_diameter_mm: 0.4,
        kerf_mm: null,
        is_system_template: true,
        lab_id: null,
        fabrication_labs: null,
      },
      {
        id: "m2",
        name: "Glowforge Plus",
        machine_category: "laser_cutter",
        bed_size_x_mm: 495,
        bed_size_y_mm: 279,
        nozzle_diameter_mm: null,
        kerf_mm: 0.2,
        is_system_template: true,
        lab_id: null,
        fabrication_labs: null,
      },
    ];
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.machineProfiles).toHaveLength(2);
    // Flattened shape — fabrication_labs nested object replaced by lab_name.
    expect(body.machineProfiles[0]).toEqual({
      id: "m1",
      name: "Bambu X1C",
      machine_category: "3d_printer",
      bed_size_x_mm: 256,
      bed_size_y_mm: 256,
      nozzle_diameter_mm: 0.4,
      kerf_mm: null,
      is_system_template: true,
      lab_id: null,
      lab_name: null,
    });
  });

  it("flattens nested fabrication_labs join into lab_name (Phase 8.1d-5)", async () => {
    machineProfilesData = [
      {
        id: "m-owned",
        name: "Teacher's Bambu",
        machine_category: "3d_printer",
        bed_size_x_mm: 256,
        bed_size_y_mm: 256,
        nozzle_diameter_mm: 0.4,
        kerf_mm: null,
        is_system_template: false,
        lab_id: "lab-1",
        // PostgREST commonly returns the embedded table as an object
        // (not array) when the FK is singular. Test that path.
        fabrication_labs: { name: "2nd Floor Design Lab" },
      },
    ];
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.machineProfiles[0].lab_name).toBe("2nd Floor Design Lab");
    expect(body.machineProfiles[0].lab_id).toBe("lab-1");
    // fabrication_labs nested object should NOT pass through to client.
    expect(body.machineProfiles[0]).not.toHaveProperty("fabrication_labs");
  });

  it("handles array-shape fabrication_labs join (PostgREST quirk)", async () => {
    machineProfilesData = [
      {
        id: "m-owned",
        name: "Teacher's Bambu",
        machine_category: "3d_printer",
        bed_size_x_mm: 256,
        bed_size_y_mm: 256,
        nozzle_diameter_mm: 0.4,
        kerf_mm: null,
        is_system_template: false,
        lab_id: "lab-1",
        // Some PostgREST versions / select shapes return as array.
        fabrication_labs: [{ name: "Default lab" }],
      },
    ];
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.machineProfiles[0].lab_name).toBe("Default lab");
  });

  it("returns 500 on enrolment lookup error with the underlying message", async () => {
    classStudentsError = "connection timeout";
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Enrolment lookup failed.*connection timeout/);
  });

  it("returns 500 on machine profile lookup error", async () => {
    machineProfilesError = "rls denied";
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Machine profile lookup failed.*rls denied/);
  });

  it("sets Cache-Control: private, no-store on all responses", async () => {
    const res = await GET(makeRequest());
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });
});
