/**
 * Shared max_tokens stop_reason guard for all Anthropic call sites in the
 * Dimensions3 v2 pipeline stages.
 *
 * Lesson #39: every Anthropic call site must inspect response.stop_reason
 * immediately after the await and throw a loud, site-specific error if it
 * equals "max_tokens". For text-response sites (not tool_use) the failure
 * mode is loud-but-cryptic: the model truncates mid-JSON and the next line
 * (JSON.parse) dies with "Unexpected end of JSON input" with no indication
 * that the real cause was the max_tokens cap. Fix the cause, not the symptom.
 *
 * See docs/lessons-learned.md Lesson #39 and
 * docs/projects/dimensions3-phase-2-brief.md §5 row 5.2.5 for the audit scope.
 */

export class MaxTokensError extends Error {
  public readonly siteName: string;
  public readonly maxTokens: number;

  constructor(siteName: string, maxTokens: number) {
    super(
      `${siteName} hit max_tokens=${maxTokens} cap — response truncated mid-generation. See Lesson #39 + dimensions3-phase-2-brief §5 row 5.2.5. Raise the cap or shorten the prompt.`
    );
    this.name = "MaxTokensError";
    this.siteName = siteName;
    this.maxTokens = maxTokens;
  }
}

/**
 * Throws MaxTokensError if `response.stop_reason === "max_tokens"`, else
 * returns void. Call this immediately after every Anthropic messages.create
 * await in the pipeline stages.
 */
export function assertNotMaxTokens(
  response: { stop_reason?: string | null },
  siteName: string,
  maxTokens: number
): void {
  if (response.stop_reason === "max_tokens") {
    throw new MaxTokensError(siteName, maxTokens);
  }
}
