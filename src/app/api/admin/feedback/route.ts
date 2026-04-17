/**
 * Admin Feedback API — Approval Queue CRUD
 *
 * GET  — List pending proposals (+ optional status/type filters)
 * POST — Run batch efficacy + self-healing computation
 * PATCH — Approve/reject/modify a proposal
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { runEfficacyBatch, efficacyToProposals } from "@/lib/feedback/efficacy";
import { getBlockUsageStats } from "@/lib/feedback/signals";
import { analyzeSelfHealing, healingToProposals } from "@/lib/feedback/self-healing";
import { validateProposal } from "@/lib/feedback/guardrails";

// ─── GET: List proposals ───

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const user = { id: auth.teacherId, email: auth.email };

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";
  const type = url.searchParams.get("type"); // efficacy_adjustment | self_healing

  const admin = createAdminClient();

  try {
    let query = admin
      .from("feedback_proposals")
      .select("*, activity_blocks(title, time_weight, bloom_level, efficacy_score)")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(100);

    if (type) {
      query = query.eq("proposal_type", type);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[feedback API GET]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also fetch summary counts
    const { data: counts } = await admin
      .from("feedback_proposals")
      .select("status, proposal_type")
      .in("status", ["pending", "approved", "rejected"]);

    const summary = {
      pending: 0,
      approved: 0,
      rejected: 0,
      efficacyPending: 0,
      healingPending: 0,
    };

    for (const row of (counts ?? []) as Array<{ status: string; proposal_type: string }>) {
      if (row.status === "pending") {
        summary.pending++;
        if (row.proposal_type === "efficacy_adjustment") summary.efficacyPending++;
        if (row.proposal_type === "self_healing") summary.healingPending++;
      }
      if (row.status === "approved") summary.approved++;
      if (row.status === "rejected") summary.rejected++;
    }

    return NextResponse.json({ proposals: data ?? [], summary });
  } catch (e) {
    console.error("[feedback API GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: Run batch computation ───

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const user = { id: auth.teacherId, email: auth.email };

  const admin = createAdminClient();

  try {
    // Run efficacy batch
    const efficacyResults = await runEfficacyBatch(admin, user.id);
    const efficacyRows = efficacyToProposals(efficacyResults);

    // Run self-healing analysis
    const blocks = await getBlockUsageStats(admin, user.id);
    const healingProposals = analyzeSelfHealing(blocks);
    const healingRows = healingToProposals(healingProposals);

    // Insert proposals (skip if already pending for same block+field)
    const allRows = [...efficacyRows, ...healingRows];
    let inserted = 0;

    for (const row of allRows) {
      // Check for existing pending proposal
      const { data: existing } = await admin
        .from("feedback_proposals")
        .select("id")
        .eq("block_id", row.block_id)
        .eq("field", row.field)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) continue; // Skip duplicate

      // §5.4: Skip blocks with a rejected proposal within the last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentRejection } = await admin
        .from("feedback_proposals")
        .select("id")
        .eq("block_id", row.block_id)
        .eq("field", row.field)
        .eq("status", "rejected")
        .gte("updated_at", sevenDaysAgo)
        .maybeSingle();

      if (recentRejection) continue; // 7-day rejection suppression

      // §5.4: No auto-accept anywhere — all proposals start as pending
      await admin.from("feedback_proposals").insert(row);
      inserted++;
    }

    return NextResponse.json({
      efficacyResults: efficacyResults.length,
      healingProposals: healingProposals.length,
      proposalsInserted: inserted,
    });
  } catch (e) {
    console.error("[feedback API POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PATCH: Approve/reject/modify a proposal ───

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const user = { id: auth.teacherId, email: auth.email };

  const body = await request.json();
  const { proposalId, action, modifiedValue, note } = body as {
    proposalId: string;
    action: "approved" | "rejected" | "modified";
    modifiedValue?: unknown;
    note?: string;
  };

  if (!proposalId || !action) {
    return NextResponse.json({ error: "Missing proposalId or action" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    // Fetch the proposal
    const { data: proposal, error: fetchErr } = await admin
      .from("feedback_proposals")
      .select("*")
      .eq("id", proposalId)
      .single();

    if (fetchErr || !proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    if (proposal.status !== "pending") {
      return NextResponse.json({ error: "Proposal already resolved" }, { status: 400 });
    }

    const finalValue = action === "modified" ? modifiedValue : proposal.proposed_value;

    // Validate through guardrails
    const validation = validateProposal({
      field: proposal.field,
      currentValue: proposal.current_value,
      proposedValue: finalValue,
      evidenceCount: proposal.evidence_count,
    });

    if (action === "approved" || action === "modified") {
      if (!validation.valid && validation.flags.length > 0) {
        return NextResponse.json({
          error: "Guardrail violation",
          flags: validation.flags,
        }, { status: 422 });
      }
    }

    // Update proposal
    await admin
      .from("feedback_proposals")
      .update({
        status: action === "modified" ? "approved" : action,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolved_value: action === "rejected" ? null : finalValue,
        resolution_note: note || null,
      })
      .eq("id", proposalId);

    // Audit log
    await admin.from("feedback_audit_log").insert({
      proposal_id: proposalId,
      block_id: proposal.block_id,
      action,
      field: proposal.field,
      previous_value: proposal.current_value,
      new_value: action === "rejected" ? null : finalValue,
      evidence_count: proposal.evidence_count,
      resolved_by: user.id,
      note: note || null,
    });

    // Apply change if approved/modified (but NOT for scaffolding/quality_review proposals)
    if (
      (action === "approved" || action === "modified") &&
      proposal.field !== "scaffolding" &&
      proposal.field !== "quality_review"
    ) {
      await admin
        .from("activity_blocks")
        .update({ [proposal.field]: finalValue })
        .eq("id", proposal.block_id);
    }

    return NextResponse.json({ success: true, action, proposalId });
  } catch (e) {
    console.error("[feedback API PATCH]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
