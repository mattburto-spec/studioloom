import { describe, it, expect } from "vitest";
import {
  renderInviteEmail,
  renderResetPasswordEmail,
  renderSubmittedEmail,
  renderApprovedEmail,
  renderReturnedEmail,
  renderRejectedEmail,
  renderPickedUpEmail,
  renderPrintingStartedEmail,
  renderCompletedEmail,
} from "../email-templates";

describe("renderInviteEmail", () => {
  it("outputs HTML containing setPasswordUrl, displayName, teacher name, and 24h expiry copy", () => {
    const html = renderInviteEmail({
      setPasswordUrl: "https://studioloom.org/fab/set-password?token=abc",
      displayName: "Cynthia Chen",
      teacherDisplayName: "Matt Burton",
    });

    expect(html).toContain("https://studioloom.org/fab/set-password?token=abc");
    expect(html).toContain("Cynthia Chen");
    expect(html).toContain("Matt Burton");
    expect(html).toContain("24 hours");
    expect(html).toContain("Preflight <hello@loominary.org>".split(" ")[0]);
  });
});

describe("renderResetPasswordEmail", () => {
  it("outputs HTML containing setPasswordUrl and displayName", () => {
    const html = renderResetPasswordEmail({
      setPasswordUrl: "https://studioloom.org/fab/set-password?token=xyz",
      displayName: "Cynthia Chen",
    });

    expect(html).toContain("https://studioloom.org/fab/set-password?token=xyz");
    expect(html).toContain("Cynthia Chen");
    expect(html).toContain("Reset password");
  });
});

describe("Phase 2 stub templates", () => {
  it("7 status-transition stubs each return the TODO marker", () => {
    const todo = "<p>TODO Phase 2</p>";
    expect(renderSubmittedEmail()).toBe(todo);
    expect(renderApprovedEmail()).toBe(todo);
    expect(renderReturnedEmail()).toBe(todo);
    expect(renderRejectedEmail()).toBe(todo);
    expect(renderPickedUpEmail()).toBe(todo);
    expect(renderPrintingStartedEmail()).toBe(todo);
    expect(renderCompletedEmail()).toBe(todo);
  });
});
