/**
 * POST /api/admin/ingestion-sandbox/commit
 *
 * Phase 1.4 (Dimensions3 Completion Spec §3.4). Writes the user-approved
 * candidate blocks from the sandbox UI to `activity_blocks`, generates
 * Voyage embeddings, and marks the `content_items` row completed.
 *
 * Request:
 *   {
 *     contentItemId?: string,
 *     teacherId?: string,       // defaults to SYSTEM_TEACHER_ID
 *     copyrightFlag?: string,
 *     candidates: AcceptedCandidate[]
 *   }
 *
 *   interface AcceptedCandidate {
 *     title: string;
 *     description?: string;
 *     prompt: string;
 *     bloom_level?: string;
 *     time_weight?: string;
 *     grouping?: string;
 *     phase?: string;
 *     activity_category?: string;
 *     materials?: string[];
 *     scaffolding_notes?: string;
 *     udl_hints?: string[];
 *     teaching_approach?: string;
 *     piiFlags?: unknown[];
 *   }
 *
 * Notes:
 *   - Uses `source_type='extracted'` (closest match to the spec's
 *     "curated" concept — the live DB enum is extracted/generated/manual/
 *     community from migration 060).
 *   - Each candidate gets one Voyage embed call. Failures are reported
 *     per-row rather than aborting the whole batch.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/ai/embeddings";

export const maxDuration = 300;

interface AcceptedCandidate {
  title: string;
  description?: string;
  prompt: string;
  bloom_level?: string;
  time_weight?: string;
  grouping?: string;
  phase?: string;
  activity_category?: string;
  materials?: string[];
  scaffolding_notes?: string;
  udl_hints?: string[];
  teaching_approach?: string;
  piiFlags?: unknown[];
  /** Set by Stage I-5 moderation. Unmoderated candidates default to 'pending'. */
  moderationStatus?: "approved" | "flagged" | "rejected" | "pending";
  moderationFlags?: Array<{ category: string; severity: string; reason?: string }>;
}

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function toPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

export async function POST(request: NextRequest) {
  let body: {
    contentItemId?: string;
    teacherId?: string;
    copyrightFlag?: string;
    candidates?: AcceptedCandidate[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const teacherId = body.teacherId || process.env.SYSTEM_TEACHER_ID;
  if (!teacherId) {
    return NextResponse.json(
      { error: "No teacherId provided and SYSTEM_TEACHER_ID env var unset" },
      { status: 400 }
    );
  }

  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  if (candidates.length === 0) {
    return NextResponse.json({ error: "candidates array is required and non-empty" }, { status: 400 });
  }

  const sb = supabase();
  const inserted: Array<{ id: string; title: string }> = [];
  const failed: Array<{ title: string; error: string }> = [];

  for (const c of candidates) {
    if (!c.title || !c.prompt) {
      failed.push({ title: c.title || "(untitled)", error: "missing title or prompt" });
      continue;
    }
    try {
      const embedSource = `${c.title}\n\n${c.prompt}\n\n${c.description || ""}`.trim();
      const vec = await embedText(embedSource);

      // Default to 'pending' if the caller didn't pipe a moderation result
      // through — never auto-approve on the commit path.
      const moderationStatus = c.moderationStatus || "pending";

      const payload: Record<string, unknown> = {
        title: c.title.slice(0, 200),
        prompt: c.prompt,
        description: c.description || null,
        source_type: "extracted",
        source_upload_id: body.contentItemId || null,
        teacher_id: teacherId,
        is_public: false,
        efficacy_score: 50,
        times_used: 0,
        bloom_level: c.bloom_level || null,
        grouping: c.grouping || "flexible",
        time_weight: c.time_weight || "moderate",
        activity_category: c.activity_category || null,
        phase: c.phase || null,
        materials_needed: c.materials || [],
        tags: ["sandbox-ingested"],
        module: "studioloom",
        copyright_flag: body.copyrightFlag || "unknown",
        pii_scanned: true,
        pii_flags: c.piiFlags && c.piiFlags.length > 0 ? c.piiFlags : null,
        scaffolding: c.scaffolding_notes ? { notes: c.scaffolding_notes } : null,
        moderation_status: moderationStatus,
        embedding: toPgVector(vec),
      };

      const { data, error } = await sb
        .from("activity_blocks")
        .insert(payload)
        .select("id, title")
        .single();
      if (error) throw error;
      inserted.push({ id: data.id, title: data.title });

      // Write a content_moderation_log row so the decision is auditable. Best
      // effort — if the log insert fails, the block still persisted above.
      try {
        await sb.from("content_moderation_log").insert({
          block_id: data.id,
          status: moderationStatus,
          reason: c.moderationFlags && c.moderationFlags[0]?.reason ? c.moderationFlags[0].reason : null,
          model_id: c.moderationStatus ? "claude-haiku-4-5-20251001" : null,
          flags: c.moderationFlags && c.moderationFlags.length > 0 ? c.moderationFlags : [],
        });
      } catch (logErr) {
        console.warn("[sandbox/commit] moderation log insert failed:", logErr);
      }
    } catch (e) {
      failed.push({ title: c.title, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Mark content_items row completed + record block count
  if (body.contentItemId) {
    try {
      await sb
        .from("content_items")
        .update({
          processing_status: inserted.length > 0 ? "completed" : "failed",
          blocks_extracted: inserted.length,
        })
        .eq("id", body.contentItemId);
    } catch (e) {
      console.warn("[sandbox/commit] content_items update failed:", e);
    }
  }

  return NextResponse.json({
    inserted,
    failed,
    summary: {
      accepted: candidates.length,
      insertedCount: inserted.length,
      failedCount: failed.length,
    },
  });
}
