/**
 * POST /api/admin/ingestion-sandbox/run-stage
 *
 * Phase 1.4 (Dimensions3 Completion Spec §3.4). Runs a single ingestion
 * pipeline stage and returns its output + cost. The client holds the
 * inter-stage state and chains outputs by posting the previous stage's
 * result as `input`. This matches the spec's per-panel rerun requirement
 * without coupling state to the server.
 *
 * Request:
 *   {
 *     stage: "dedup" | "parse" | "passA" | "passB" | "extract",
 *     input: unknown,          // stage-specific input
 *     teacherId?: string,      // defaults to SYSTEM_TEACHER_ID
 *     modelOverride?: string,  // optional Pass A/B model override
 *     copyrightFlag?: CopyrightFlag, // for extract stage
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dedupCheck } from "@/lib/ingestion/dedup";
import { parseDocument } from "@/lib/ingestion/parse";
import { passA } from "@/lib/ingestion/pass-a";
import { passB } from "@/lib/ingestion/pass-b";
import { extractBlocks } from "@/lib/ingestion/extract";
import type {
  PassConfig,
  ParseResult,
  IngestionClassification,
  IngestionAnalysis,
  CopyrightFlag,
} from "@/lib/ingestion/types";

export const maxDuration = 300;

type Stage = "dedup" | "parse" | "passA" | "passB" | "extract";
const VALID_STAGES: Stage[] = ["dedup", "parse", "passA", "passB", "extract"];

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  let body: {
    stage?: string;
    input?: unknown;
    teacherId?: string;
    modelOverride?: string;
    copyrightFlag?: CopyrightFlag;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const stage = body.stage as Stage;
  if (!VALID_STAGES.includes(stage)) {
    return NextResponse.json(
      { error: `Invalid stage. Expected one of: ${VALID_STAGES.join(", ")}` },
      { status: 400 }
    );
  }

  const teacherId = body.teacherId || process.env.SYSTEM_TEACHER_ID;
  if (!teacherId) {
    return NextResponse.json(
      { error: "No teacherId provided and SYSTEM_TEACHER_ID env var unset" },
      { status: 400 }
    );
  }

  const config: PassConfig = {
    supabaseClient: supabase(),
    teacherId,
    apiKey: process.env.ANTHROPIC_API_KEY,
    modelOverride: body.modelOverride,
  };

  const t0 = Date.now();
  try {
    let output: unknown;
    switch (stage) {
      case "dedup": {
        const rawText = body.input as string;
        if (typeof rawText !== "string") {
          return NextResponse.json(
            { error: "dedup stage expects input to be rawText string" },
            { status: 400 }
          );
        }
        output = await dedupCheck(rawText, config);
        break;
      }
      case "parse": {
        const rawText = body.input as string;
        if (typeof rawText !== "string") {
          return NextResponse.json(
            { error: "parse stage expects input to be rawText string" },
            { status: 400 }
          );
        }
        output = parseDocument(rawText);
        break;
      }
      case "passA": {
        const parseResult = body.input as ParseResult;
        if (!parseResult?.sections) {
          return NextResponse.json(
            { error: "passA stage expects input to be a ParseResult" },
            { status: 400 }
          );
        }
        output = await passA.run(parseResult, config);
        break;
      }
      case "passB": {
        const classification = body.input as IngestionClassification;
        if (!classification?.sections) {
          return NextResponse.json(
            { error: "passB stage expects input to be an IngestionClassification" },
            { status: 400 }
          );
        }
        output = await passB.run(classification, config);
        break;
      }
      case "extract": {
        const analysis = body.input as IngestionAnalysis;
        if (!analysis?.enrichedSections) {
          return NextResponse.json(
            { error: "extract stage expects input to be an IngestionAnalysis" },
            { status: 400 }
          );
        }
        output = extractBlocks(analysis, body.copyrightFlag || "unknown");
        break;
      }
    }

    return NextResponse.json({
      stage,
      output,
      durationMs: Date.now() - t0,
    });
  } catch (e) {
    console.error(`[sandbox/run-stage] ${stage} failed:`, e);
    return NextResponse.json(
      {
        stage,
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - t0,
      },
      { status: 500 }
    );
  }
}
