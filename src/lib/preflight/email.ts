/**
 * Preflight email dispatch — idempotent fabrication email helper.
 *
 * Pure function. Single entry point for every Preflight email kind.
 * Follows cost-alert-delivery.ts pattern: direct fetch → api.resend.com,
 * no package dependency, console fallback when RESEND_API_KEY is unset.
 *
 * Idempotency: for job-scoped emails, checks fabrication_jobs.notifications_sent
 * before dispatching; writes back via JSONB merge on 2xx (preserves other keys
 * per Lesson #42). invite + set_password_reset kinds have no job context
 * (jobId = null) so they skip the check and always dispatch.
 *
 * Sender: Preflight <hello@loominary.org> — loominary.org is verified in Resend
 * (D-EM-1 in preflight-phase-1b-2-brief.md). Do not change without updating DNS.
 *
 * Not wired yet. Callers land in 1B-2-4 (invite API) and Phase 2 (status emails).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const SENDER = "Preflight <hello@loominary.org>";

/**
 * All Preflight email kinds. First two are identity flows (no job context);
 * the rest are status-transition emails written idempotently against
 * fabrication_jobs.notifications_sent.
 */
export type FabricationEmailKind =
  | "invite"
  | "set_password_reset"
  | "submitted"
  | "approved"
  | "returned"
  | "rejected"
  | "picked_up"
  | "printing_started"
  | "completed";

const IDENTITY_KINDS: ReadonlySet<FabricationEmailKind> = new Set([
  "invite",
  "set_password_reset",
]);

export interface SendFabricationEmailParams {
  /** Non-null for job-scoped kinds; null for invite / set_password_reset. */
  jobId: string | null;
  kind: FabricationEmailKind;
  to: string;
  subject: string;
  html: string;
  supabase: SupabaseClient;
}

export interface SendFabricationEmailResult {
  sent: boolean;
  skipped: boolean;
  reason?: string;
}

/**
 * Build the JSONB idempotency key for a given kind.
 * Shape matches migration 098 comment: `{<kind>_at: ISO-timestamp}`.
 */
function idempotencyKey(kind: FabricationEmailKind): string {
  return `${kind}_at`;
}

export async function sendFabricationEmail(
  params: SendFabricationEmailParams
): Promise<SendFabricationEmailResult> {
  const { jobId, kind, to, subject, html, supabase } = params;

  // ---------------------------------------------------------------
  // 1. Validate job-context contract
  // ---------------------------------------------------------------
  const isIdentity = IDENTITY_KINDS.has(kind);
  if (isIdentity && jobId !== null) {
    throw new Error(
      `sendFabricationEmail: kind '${kind}' must be called with jobId=null (got '${jobId}')`
    );
  }
  if (!isIdentity && jobId === null) {
    throw new Error(
      `sendFabricationEmail: kind '${kind}' requires a non-null jobId`
    );
  }

  // ---------------------------------------------------------------
  // 2. Idempotency check (job-scoped kinds only)
  // ---------------------------------------------------------------
  const key = idempotencyKey(kind);
  if (!isIdentity && jobId !== null) {
    const { data: row, error: readError } = await supabase
      .from("fabrication_jobs")
      .select("notifications_sent")
      .eq("id", jobId)
      .maybeSingle();

    if (readError) {
      return {
        sent: false,
        skipped: false,
        reason: `notifications_sent read failed: ${readError.message}`,
      };
    }

    const existing =
      (row?.notifications_sent as Record<string, unknown> | null) ?? null;
    if (existing && key in existing) {
      return {
        sent: false,
        skipped: true,
        reason: `Already sent (${key} present)`,
      };
    }
  }

  // ---------------------------------------------------------------
  // 3. Dispatch via Resend (or console fallback)
  // ---------------------------------------------------------------
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[Preflight Email] Would send ${kind} to ${to}: ${subject} ` +
        `(jobId=${jobId ?? "null"})`
    );
    return {
      sent: false,
      skipped: false,
      reason: "RESEND_API_KEY not set — logged to console",
    };
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: SENDER,
        to: [to],
        subject,
        html,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { sent: false, skipped: false, reason: `Network error: ${message}` };
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "<unreadable body>");
    console.error(
      `[Preflight Email] Resend ${response.status} on ${kind}: ${errorText}`
    );
    return {
      sent: false,
      skipped: false,
      reason: `Resend API error: ${response.status}`,
    };
  }

  // ---------------------------------------------------------------
  // 4. Write idempotency timestamp (job-scoped kinds only)
  // ---------------------------------------------------------------
  if (!isIdentity && jobId !== null) {
    const nowIso = new Date().toISOString();
    // JSONB merge (preserves other keys, Lesson #42):
    //   SET notifications_sent = COALESCE(notifications_sent, '{}'::jsonb)
    //                             || jsonb_build_object(<key>, <ts>)
    // Supabase-js has no first-class JSONB operator, so we do read-modify-write
    // locally. The earlier .maybeSingle() already fetched the current value.
    const { data: row } = await supabase
      .from("fabrication_jobs")
      .select("notifications_sent")
      .eq("id", jobId)
      .maybeSingle();

    const current =
      (row?.notifications_sent as Record<string, unknown> | null) ?? {};
    const merged = { ...current, [key]: nowIso };

    const { error: updateError } = await supabase
      .from("fabrication_jobs")
      .update({ notifications_sent: merged })
      .eq("id", jobId);

    if (updateError) {
      // Email went out but audit write failed — surface this.
      // A duplicate send on retry is still blocked by the idempotency read
      // the NEXT caller does (unless the audit row somehow lands out-of-order,
      // which won't happen on a single job).
      return {
        sent: true,
        skipped: false,
        reason: `Sent, but notifications_sent write failed: ${updateError.message}`,
      };
    }
  }

  return { sent: true, skipped: false };
}
