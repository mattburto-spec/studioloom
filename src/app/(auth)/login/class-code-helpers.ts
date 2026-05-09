// Normalises a class code received from a URL path segment so the value
// matches what the form would have produced via keystroke + the server
// would accept on submit (`.toUpperCase().trim()` in
// student-classcode-login/route.ts:186). Slicing to 6 keeps the form
// invariant — the input has `maxLength={6}` and overlong pre-fills would
// otherwise bypass it.
export function normalizeClassCodeFromUrl(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 6);
}
