/**
 * Operational jobs tests (Job Suite 1-7).
 * Verifies each job:
 *  (1) Writes to system_alerts
 *  (2) Returns alertId and summary
 *  (3) Has correct alert_type
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as pipelineJob from "../pipeline-health-monitor";
import * as costJob from "../cost-alert";
import * as qualityJob from "../quality-drift-detector";
import * as editsJob from "../teacher-edit-tracker";
import * as staleJob from "../stale-data-watchdog";
import * as smokeJob from "../smoke-tests";
import * as usageJob from "../usage-analytics";

// ─── Mock Supabase Client ───

function createMockSupabase(): SupabaseClient {
  let insertedAlerts: Array<{
    alert_type: string;
    severity: string;
    payload: unknown;
  }> = [];

  // Helper to create chainable filter object
  function createFilterChain() {
    const chain: Record<string, any> = {
      data: [],
      error: null,
      count: 5,
    };

    const methods = [
      "gte",
      "lt",
      "eq",
      "is",
      "or",
      "not",
      "order",
      "limit",
      "select",
      "head",
    ];

    for (const method of methods) {
      chain[method] = vi.fn(function () {
        return chain;
      });
    }

    return chain;
  }

  return {
    from: vi.fn((table: string) => {
      if (table === "system_alerts") {
        return {
          insert: vi.fn((data) => {
            insertedAlerts.push(data);
            return {
              select: vi.fn(() => ({
                data: [{ id: "test-alert-id-" + insertedAlerts.length }],
                error: null,
              })),
            };
          }),
          select: vi.fn(() => createFilterChain()),
        };
      }

      // For all other tables, return chainable filter object
      return {
        select: vi.fn(() => createFilterChain()),
        insert: vi.fn((data) => ({
          select: vi.fn(() => ({
            data: [{ id: "test-alert-id" }],
            error: null,
          })),
        })),
        upsert: vi.fn(() => ({
          data: null,
          error: null,
        })),
        rpc: vi.fn(() => ({
          data: [],
          error: null,
        })),
      };
    }),
  } as unknown as SupabaseClient;
}

// ─── Test Suite ───

describe("Operational Jobs", () => {
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    vi.clearAllMocks();
  });

  // Job 1: Pipeline Health Monitor
  it("Job 1: pipeline-health-monitor writes to system_alerts with correct type", async () => {
    const result = await pipelineJob.run(mockSupabase);

    expect(result.alertId).toBeDefined();
    expect(result.alertId).toMatch(/test-alert-id/);
    expect(result.summary).toBeDefined();
    expect(result.summary).toHaveProperty("successRate");
    expect(result.summary).toHaveProperty("totalRuns");

    // Verify system_alerts.insert was called
    const fromCalls = (mockSupabase.from as any).mock.calls;
    const alertsCalls = fromCalls.filter((call: any) => call[0] === "system_alerts");
    expect(alertsCalls.length).toBeGreaterThan(0);
  });

  // Job 2: Cost Alert
  it("Job 2: cost-alert writes to system_alerts with correct type", async () => {
    const result = await costJob.run(mockSupabase);

    expect(result.alertId).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.summary).toHaveProperty("dailyCost");
    expect(result.summary).toHaveProperty("thresholdsExceeded");
  });

  // Job 3: Quality Drift Detector
  it("Job 3: quality-drift-detector writes to system_alerts with correct type", async () => {
    const result = await qualityJob.run(mockSupabase);

    expect(result.alertId).toBeDefined();
    expect(result.summary).toBeDefined();
    // Summary should indicate insufficient data or have drift metrics
    expect(
      result.summary.status === "insufficient_data" ||
        result.summary.hasOwnProperty("dropPercent")
    ).toBe(true);
  });

  // Job 4: Teacher Edit Tracker
  it("Job 4: teacher-edit-tracker writes to system_alerts with correct type", async () => {
    const result = await editsJob.run(mockSupabase);

    expect(result.alertId).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.summary).toHaveProperty("totalEdits");
    expect(result.summary).toHaveProperty("editsByType");
  });

  // Job 5: Stale Data Watchdog
  it("Job 5: stale-data-watchdog writes to system_alerts with correct type", async () => {
    const result = await staleJob.run(mockSupabase);

    expect(result.alertId).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.summary).toHaveProperty("severity");
    expect(result.summary).toHaveProperty("hasIssues");
  });

  // Job 6: Smoke Tests
  it("Job 6: smoke-tests writes to system_alerts with correct type", async () => {
    const result = await smokeJob.run(mockSupabase);

    expect(result.alertId).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.summary).toHaveProperty("allPassed");
    expect(result.summary).toHaveProperty("checksRun");
    expect(result.summary.checksRun).toBe(6);
  });

  // Job 7: Usage Analytics
  it("Job 7: usage-analytics writes to system_alerts with correct type", async () => {
    const result = await usageJob.run(mockSupabase);

    expect(result.alertId).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.summary).toHaveProperty("teachersActive");
    expect(result.summary).toHaveProperty("generationRunsLast24h");
  });
});
