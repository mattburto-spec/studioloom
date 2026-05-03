// audit-skip: ephemeral admin sandbox/test surface, no audit value
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
import { requireAdmin } from "@/lib/auth/require-admin";
import { embedText } from "@/lib/ai/embeddings";
import { computeContentFingerprint } from "@/lib/ingestion/fingerprint";
import { MODELS } from "@/lib/ai/models";

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
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  let body: {
    contentItemId?: string;
    teacherId?: string;
    copyrightFlag?: string;
    candidates?: AcceptedCandidate[];
    /**
     * Phase 1.5 item 8 — dryRun mode. When true, the route builds every
     * payload and runs the embedding call (so the caller sees what
     * Voyage tokens would have been spent), but skips ALL DB writes:
     * no activity_blocks insert, no moderation_log insert, no
     * content_items status update. The response includes the would-be
     * payloads under `wouldInsert` so the curator can preview.
     */
    dryRun?: boolean;
    /**
     * Phase 1.5 item 10 — force overwrite on fingerprint conflict.
     * Default false: a duplicate content_fingerprint causes the row
     * to be SKIPPED (and reported under `skipped`). When true, the
     * existing row is updated in place via upsert. Use sparingly —
     * the default-skip behaviour is what stops accidental re-imports
     * from polluting the corpus.
     */
    force?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Resolve teacher ID: (1) body field, (2) authenticated admin, (3) env var.
  // Admin is already verified above so auth.teacherId is trusted.
  const teacherId: string = body.teacherId || auth.teacherId || process.env.SYSTEM_TEACHER_ID || "";
  if (!teacherId) {
    return NextResponse.json(
      { error: "Could not resolve teacher ID for ingestion." },
      { status: 500 }
    );
  }

  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  if (candidates.length === 0) {
    return NextResponse.json({ error: "candidates array is required and non-empty" }, { status: 400 });
  }

  const dryRun = body.dryRun === true;
  const force = body.force === true;
  const sb = supabase();
  const inserted: Array<{ id: string; title: string }> = [];
  const failed: Array<{ title: string; error: string }> = [];
  // Phase 1.5 item 10 — rows skipped because their content_fingerprint
  // already exists in activity_blocks AND `force` was not set.
  const skipped: Array<{ title: string; fingerprint: string; existingId: string }> = [];
  // dryRun preview rows — only populated when dryRun=true. We strip the
  // embedding from the preview because it's a 1024-element vector that
  // would dominate the response and isn't useful for human review.
  const wouldInsert: Array<Record<string, unknown>> = [];

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

      // Phase 1.5 item 10 — deterministic fingerprint over title + prompt
      // + source_type. Mirrors the SQL backfill in migration 068.
      const contentFingerprint = computeContentFingerprint({
        title: c.title,
        prompt: c.prompt,
        sourceType: "extracted",
      });

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
        content_fingerprint: contentFingerprint,
        embedding: toPgVector(vec),
      };

      if (dryRun) {
        // Strip the embedding for the preview — vector is huge and not
        // human-readable. Everything else mirrors the would-be row.
        const { embedding: _embedding, ...preview } = payload;
        void _embedding;
        wouldInsert.push(preview);
        continue;
      }

      // Phase 1.5 item 10 — pre-check for an existing row with the same
      // fingerprint. We do this with an explicit SELECT first (rather
      // than relying on ON CONFLICT) so we can distinguish "skipped"
      // from "failed" cleanly in the response, and so we can keep the
      // existing block's id around for the response.
      const { data: existing } = await sb
        .from("activity_blocks")
        .select("id")
        .eq("content_fingerprint", contentFingerprint)
        .limit(1)
        .maybeSingle();

      if (existing && !force) {
        skipped.push({ title: c.title, fingerprint: contentFingerprint, existingId: existing.id });
        continue;
      }

      let data: { id: string; title: string };
      if (existing && force) {
        // Update in place — the row already exists at this fingerprint,
        // and the caller asked us to overwrite. We don't touch teacher_id
        // or efficacy_score (those are owned by other systems); we
        // refresh the content fields + embedding + moderation_status.
        const { id: _id, source_type: _src, teacher_id: _tid, efficacy_score: _eff, times_used: _tu, ...updateFields } = payload;
        void _id; void _src; void _tid; void _eff; void _tu;
        const { data: updated, error: updateErr } = await sb
          .from("activity_blocks")
          .update(updateFields)
          .eq("id", existing.id)
          .select("id, title")
          .single();
        if (updateErr) throw updateErr;
        data = updated;
      } else {
        const { data: insertedRow, error: insertErr } = await sb
          .from("activity_blocks")
          .insert(payload)
          .select("id, title")
          .single();
        if (insertErr) throw insertErr;
        data = insertedRow;
      }
      inserted.push({ id: data.id, title: data.title });

      // Write a content_moderation_log row so the decision is auditable. Best
      // effort — if the log insert fails, the block still persisted above.
      try {
        await sb.from("content_moderation_log").insert({
          block_id: data.id,
          status: moderationStatus,
          reason: c.moderationFlags && c.moderationFlags[0]?.reason ? c.moderationFlags[0].reason : null,
          model_id: c.moderationStatus ? MODELS.HAIKU : null,
          flags: c.moderationFlags && c.moderationFlags.length > 0 ? c.moderationFlags : [],
        });
      } catch (logErr) {
        console.warn("[sandbox/commit] moderation log insert failed:", logErr);
      }
    } catch (e) {
      failed.push({ title: c.title, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Mark content_items row completed + record block count.
  // Skipped under dryRun — the row stays in whatever processing_status it
  // was in, since nothing was actually written.
  if (body.contentItemId && !dryRun) {
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

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      wouldInsert,
      failed,
      summary: {
        accepted: candidates.length,
        wouldInsertCount: wouldInsert.length,
        failedCount: failed.length,
      },
    });
  }

  return NextResponse.json({
    inserted,
    skipped,
    failed,
    summary: {
      accepted: candidates.length,
      insertedCount: inserted.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
    },
  });
}
