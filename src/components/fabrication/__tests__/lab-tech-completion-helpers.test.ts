import { describe, it, expect } from "vitest";
import {
  shouldShowCompletionCard,
  shouldHideScanViewerForCompletion,
  completionVariantFor,
} from "../lab-tech-completion-helpers";

/** Phase 7-4 student-side completion helpers. Pure logic. */

describe("shouldShowCompletionCard", () => {
  it("shows only when job is completed (printed / cut / failed live under this one status)", () => {
    expect(shouldShowCompletionCard("completed")).toBe(true);
  });
  it("doesn't show for pre-completion statuses", () => {
    expect(shouldShowCompletionCard("approved")).toBe(false);
    expect(shouldShowCompletionCard("picked_up")).toBe(false);
    expect(shouldShowCompletionCard("pending_approval")).toBe(false);
    expect(shouldShowCompletionCard("needs_revision")).toBe(false);
  });
  it("doesn't show for rejected / cancelled (those have their own cards)", () => {
    expect(shouldShowCompletionCard("rejected")).toBe(false);
    expect(shouldShowCompletionCard("cancelled")).toBe(false);
  });
});

describe("shouldHideScanViewerForCompletion", () => {
  it("hides the scan viewer when completed (parallel to rejected)", () => {
    expect(shouldHideScanViewerForCompletion("completed")).toBe(true);
  });
  it("doesn't hide for other statuses (those are handled elsewhere)", () => {
    expect(shouldHideScanViewerForCompletion("approved")).toBe(false);
    expect(shouldHideScanViewerForCompletion("picked_up")).toBe(false);
    expect(shouldHideScanViewerForCompletion("rejected")).toBe(false);
  });
});

describe("completionVariantFor", () => {
  it("maps 'printed' + 'cut' to success", () => {
    expect(completionVariantFor("printed")).toBe("success");
    expect(completionVariantFor("cut")).toBe("success");
  });
  it("maps 'failed' to failure", () => {
    expect(completionVariantFor("failed")).toBe("failure");
  });
  it("maps null / undefined / unknown to 'unknown' (defensive fallback)", () => {
    expect(completionVariantFor(null)).toBe("unknown");
    expect(completionVariantFor(undefined)).toBe("unknown");
    expect(completionVariantFor("weird-new-status")).toBe("unknown");
  });
});
