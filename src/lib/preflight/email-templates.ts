/**
 * Preflight email HTML templates.
 *
 * 1B-2 ships the two identity-flow templates (invite + reset).
 * The 7 status-transition templates are stubs that return a TODO marker —
 * this prevents Phase 2 callers from importing a function that doesn't exist,
 * while keeping the actual copy decision out of this phase.
 *
 * Style: inline only (email-client constraints), table layout, 600px max,
 * brand gradient header, coral CTA button, fallback text link, 24h expiry
 * notice where relevant. Mirrors supabase/email-templates/invite.html.
 */

interface InviteEmailParams {
  setPasswordUrl: string;
  displayName: string;
  teacherDisplayName: string;
}

interface ResetPasswordEmailParams {
  setPasswordUrl: string;
  displayName: string;
}

function layout(headerTitle: string, headerSubtitle: string, bodyHtml: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${headerTitle}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F5F3FF; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1A1A2E;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F3FF; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(91, 33, 182, 0.08);">
            <tr>
              <td align="center" style="padding:32px 32px 24px 32px; background-color:#FFFFFF;">
                <div style="font-size:20px; font-weight:700; letter-spacing:-0.01em; color:#1A1A2E;">Preflight · StudioLoom</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#5C16C5; background-image:linear-gradient(135deg, #7B2FF2 0%, #5C16C5 50%, #4A0FB0 100%);">
                  <tr>
                    <td align="center" style="padding:40px 32px 40px 32px;">
                      <h1 style="margin:0 0 12px 0; font-size:28px; line-height:1.2; font-weight:700; color:#FFFFFF; letter-spacing:-0.02em;">${headerTitle}</h1>
                      <p style="margin:0; font-size:16px; line-height:1.5; color:#E9D5FF;">${headerSubtitle}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">${bodyHtml}</td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 32px; background-color:#FAFAFA; color:#6B7280; font-size:12px; line-height:1.5;">
                This is an automated message from StudioLoom Preflight. Questions? Reply to hello@loominary.org.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function ctaButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td align="center" style="border-radius:8px; background-color:#F97066;">
      <a href="${url}" style="display:inline-block; padding:14px 28px; font-size:16px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:8px;">${label}</a>
    </td>
  </tr>
</table>
<p style="margin:0 0 8px 0; font-size:13px; color:#6B7280;">Button not working? Paste this link:</p>
<p style="margin:0; font-size:13px; color:#5C16C5; word-break:break-all;"><a href="${url}" style="color:#5C16C5;">${url}</a></p>`;
}

export function renderInviteEmail(params: InviteEmailParams): string {
  const { setPasswordUrl, displayName, teacherDisplayName } = params;
  const body = `<p style="margin:0 0 16px 0; font-size:16px; line-height:1.6; color:#1A1A2E;">Hi ${displayName},</p>
<p style="margin:0 0 16px 0; font-size:16px; line-height:1.6; color:#1A1A2E;">${teacherDisplayName} has invited you to be a <strong>Fabricator</strong> in StudioLoom — you'll handle fabrication jobs (3D prints, laser cuts) that students submit through Preflight.</p>
<p style="margin:0 0 16px 0; font-size:16px; line-height:1.6; color:#1A1A2E;">Click below to set your password and get started:</p>
${ctaButton(setPasswordUrl, "Set password")}
<p style="margin:16px 0 0 0; font-size:13px; color:#6B7280;">This invite link expires in 24 hours. If it does, ask ${teacherDisplayName} to re-invite you.</p>`;
  return layout(
    "You've been invited as a Fabricator",
    `${teacherDisplayName} is adding you to their lab in StudioLoom.`,
    body
  );
}

export function renderResetPasswordEmail(params: ResetPasswordEmailParams): string {
  const { setPasswordUrl, displayName } = params;
  const body = `<p style="margin:0 0 16px 0; font-size:16px; line-height:1.6; color:#1A1A2E;">Hi ${displayName},</p>
<p style="margin:0 0 16px 0; font-size:16px; line-height:1.6; color:#1A1A2E;">A teacher requested a password reset for your Fabricator account. Click below to set a new password:</p>
${ctaButton(setPasswordUrl, "Reset password")}
<p style="margin:16px 0 0 0; font-size:13px; color:#6B7280;">This reset link expires in 24 hours. If you didn't request this, ignore this email — your existing password still works.</p>`;
  return layout(
    "Reset your Preflight password",
    "A teacher triggered a password reset on your account.",
    body
  );
}

// ---------------------------------------------------------------
// Phase 2 stubs — present so imports don't fail; real copy lands
// when the scanner worker and teacher approval UI ship.
// ---------------------------------------------------------------

const TODO_PHASE_2 = "<p>TODO Phase 2</p>";

export function renderSubmittedEmail(): string {
  return TODO_PHASE_2;
}
export function renderApprovedEmail(): string {
  return TODO_PHASE_2;
}
export function renderReturnedEmail(): string {
  return TODO_PHASE_2;
}
export function renderRejectedEmail(): string {
  return TODO_PHASE_2;
}
export function renderPickedUpEmail(): string {
  return TODO_PHASE_2;
}
export function renderPrintingStartedEmail(): string {
  return TODO_PHASE_2;
}
export function renderCompletedEmail(): string {
  return TODO_PHASE_2;
}
