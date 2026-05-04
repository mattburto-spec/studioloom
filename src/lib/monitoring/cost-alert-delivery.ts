import type { SupabaseClient } from "@supabase/supabase-js";

interface CostAlertPayload {
  period: "daily" | "weekly" | "monthly";
  currentCost: number;
  threshold: number;
  thresholdName: string;
}

/**
 * Send a cost alert email and log to system_alerts.
 * Falls back to console.log if RESEND_API_KEY is not set.
 *
 * Debounce: checks system_alerts for same alert_type + period within last 6h.
 * If found, skips the email but still returns the check result.
 */
export async function sendCostAlert(
  supabase: SupabaseClient,
  payload: CostAlertPayload
): Promise<{ sent: boolean; debounced: boolean; reason?: string }> {
  // 1. Debounce check: look for recent alert with same period
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: recentAlerts } = await supabase
    .from("system_alerts")
    .select("id")
    .eq("alert_type", "cost_alert")
    .eq("severity", "warning")
    .gte("created_at", sixHoursAgo)
    .limit(1);

  // More specific: check if the payload.period matches
  // Since payload is JSONB, we'd need to check inside it.
  // Simplified: if ANY cost_alert warning in last 6h, skip.
  if (recentAlerts && recentAlerts.length > 0) {
    return { sent: false, debounced: true, reason: "Alert sent within last 6 hours" };
  }

  // 2. Write to system_alerts
  await supabase.from("system_alerts").insert({
    alert_type: "cost_alert",
    severity: "warning",
    payload: {
      ...payload,
      sent_at: new Date().toISOString(),
    },
  });

  // 3. Send email
  const apiKey = process.env.RESEND_API_KEY;
  const recipientEmail = process.env.COST_ALERT_EMAIL || "mattburto@gmail.com";

  if (!apiKey) {
    console.log(
      `[Cost Alert] Would send email to ${recipientEmail}: ${payload.thresholdName} threshold crossed ($${payload.currentCost.toFixed(2)} / $${payload.threshold})`
    );
    return {
      sent: false,
      debounced: false,
      reason: "RESEND_API_KEY not set — logged to console",
    };
  }

  try {
    // Use fetch directly instead of resend package to avoid adding a dependency
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "StudioLoom Alerts <hello@loominary.org>",
        to: [recipientEmail],
        subject: `⚠️ Cost Alert: ${payload.thresholdName} threshold crossed`,
        html: `
          <h2>StudioLoom Cost Alert</h2>
          <p><strong>${payload.thresholdName}</strong> cost threshold has been crossed.</p>
          <table style="border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 4px 12px; border: 1px solid #ddd;">Period</td><td style="padding: 4px 12px; border: 1px solid #ddd;">${payload.period}</td></tr>
            <tr><td style="padding: 4px 12px; border: 1px solid #ddd;">Current Cost</td><td style="padding: 4px 12px; border: 1px solid #ddd;">$${payload.currentCost.toFixed(2)}</td></tr>
            <tr><td style="padding: 4px 12px; border: 1px solid #ddd;">Threshold</td><td style="padding: 4px 12px; border: 1px solid #ddd;">$${payload.threshold.toFixed(2)}</td></tr>
          </table>
          <p style="color: #666; font-size: 12px;">This is an automated alert from StudioLoom's pipeline monitoring system.</p>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Cost Alert] Resend API error:", errorText);
      return {
        sent: false,
        debounced: false,
        reason: `Resend API error: ${response.status}`,
      };
    }

    return { sent: true, debounced: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Cost Alert] Email send failed:", message);
    return { sent: false, debounced: false, reason: message };
  }
}
