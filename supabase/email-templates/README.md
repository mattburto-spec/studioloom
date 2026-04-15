# StudioLoom Supabase email templates

Branded replacements for the default Supabase auth emails. Each template is
pasted into **Supabase Dashboard → Authentication → Email Templates**.

Versioned here so brand + copy stay in sync with the app — Supabase doesn't
expose these via the API, so the repo is the source of truth.

## Templates

| File | Supabase template | Subject heading | Fires when |
|---|---|---|---|
| [`invite.html`](./invite.html) | **Invite user** | `You've been invited to StudioLoom` | Admin invites a teacher via `/api/admin/teachers/invite` (`supabase.auth.admin.inviteUserByEmail`) |
| [`confirm-signup.html`](./confirm-signup.html) | **Confirm signup** | `Confirm your StudioLoom account` | User self-signs-up and needs to verify email |
| [`magic-link.html`](./magic-link.html) | **Magic Link** | `Your StudioLoom sign-in link` | User requests a passwordless sign-in link |
| [`reset-password.html`](./reset-password.html) | **Reset Password** | `Reset your StudioLoom password` | User clicks "Forgot password?" |

## How to update

1. Edit the `.html` file in this folder.
2. Commit + push.
3. Open **Supabase Dashboard → Authentication → Email Templates**.
4. Pick the matching template from the dropdown.
5. Paste the full file contents into the message body (and update the subject if it changed).
6. **Save changes**.
7. Trigger a real flow (send yourself a test invite / request a magic link / etc.) to verify rendering — Supabase has no live preview for custom HTML.

## Shared design

All four templates share the same skeleton so the auth experience feels like one product:

- **Logo header** on white card (`https://studioloom.org/logo.svg`, 56×56)
- **Brand gradient hero** — `linear-gradient(135deg, #7B2FF2 0%, #5C16C5 50%, #4A0FB0 100%)` with solid `#5C16C5` fallback for Outlook
- **Body copy** in `#1A1A2E` at 16px/1.6
- **Coral CTA button** — `linear-gradient(135deg, #FF3366 0%, #FF6B6B 100%)` with pill radius + drop shadow
- **Fallback URL** below every CTA (clients that strip buttons)
- **Footer** with invitee email, `studioloom.org`, and `hello@studioloom.org`
- **600px max width**, table-based layout, inline styles only

Diverges per template:
- Invite includes a 4-step preview mirroring `/teacher/welcome`
- Reset password has a prominent red security notice above the footer ("Didn't request this?") because password reset emails are a phishing target

## Supabase template variables

Each template uses the Supabase Go-template variables:

| Variable | Available in | What it is |
|---|---|---|
| `{{ .ConfirmationURL }}` | all four | The magic link the user clicks |
| `{{ .Email }}` | all four | The invitee / user's email address |
| `{{ .Token }}` | all four | The raw OTP token (unused by our templates — link-based flow) |
| `{{ .SiteURL }}` | all four | `https://studioloom.org` |
| `{{ .Data.name }}` | invite only | Optional display name passed from `/api/admin/teachers/invite` |

We don't use `.Data.name` even in the invite template — the admin endpoint
doesn't always have a name, and a generic "Hi there," is safer than a
half-populated personalisation.

## Gotchas baked into every template

- **Inline styles only** — Gmail + Outlook strip `<style>` tags
- **Table layout** — flex/grid don't work in email
- **No JavaScript, no `<link>` tags, no web fonts** — systemfont stack via `font-family`
- **Absolute HTTPS image URLs** — no inline attachments, no relative paths
- **Gradient with solid fallback** — `background-color` behind `background-image`
so older Outlook shows solid purple instead of white
- **`role="presentation"` on layout tables** — keeps screen readers from announcing them as data tables
- **Hidden preheader `<div>`** — one-line inbox preview next to the subject
- **`mso-hide:all`** — Outlook-specific hide directive for the preheader
