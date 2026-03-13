import crypto from "crypto";

/**
 * LTI 1.1 signature verification.
 * LTI 1.1 uses OAuth 1.0a HMAC-SHA1 signing.
 * This is a universal standard — works with ManageBac, Canvas, Schoology, Moodle, Toddle, etc.
 *
 * Reference: https://www.imsglobal.org/specs/ltiv1p1
 */

/**
 * Percent-encode a string per RFC 3986.
 * OAuth 1.0a requires this specific encoding (not just encodeURIComponent).
 */
function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

/**
 * Build the OAuth 1.0a base string for signature verification.
 * Format: HTTP_METHOD&URL&SORTED_PARAMS
 */
function buildBaseString(
  method: string,
  url: string,
  params: Record<string, string>
): string {
  // Exclude oauth_signature from the params when building base string
  const filteredParams = Object.entries(params)
    .filter(([key]) => key !== "oauth_signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join("&");

  return `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(filteredParams)}`;
}

/**
 * Verify an LTI 1.1 launch request signature.
 *
 * @param params - All POST parameters from the LTI launch (including oauth_signature)
 * @param url - The full URL the request was sent to (launch URL)
 * @param consumerSecret - The shared secret for this consumer key
 * @returns true if the signature is valid
 */
export function verifyLtiSignature(
  params: Record<string, string>,
  url: string,
  consumerSecret: string
): boolean {
  const signature = params.oauth_signature;
  if (!signature) return false;

  // LTI 1.1 uses HMAC-SHA1
  if (params.oauth_signature_method !== "HMAC-SHA1") return false;

  // Check timestamp is within 5 minutes (300 seconds) to prevent replay attacks
  const timestamp = parseInt(params.oauth_timestamp || "0", 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) return false;

  const baseString = buildBaseString("POST", url, params);

  // OAuth 1.0a signing key: consumer_secret&token_secret
  // LTI 1.1 has no token secret, so it's just consumer_secret&
  const signingKey = `${percentEncode(consumerSecret)}&`;

  const expectedSignature = crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "base64"),
      Buffer.from(expectedSignature, "base64")
    );
  } catch {
    return false;
  }
}

/**
 * Extract student identity from LTI launch parameters.
 * These parameter names are standardized across all LMS platforms.
 */
export function extractLtiStudentInfo(params: Record<string, string>): {
  externalId: string;
  displayName: string;
  username: string;
  email?: string;
} {
  const externalId = params.user_id || "";
  const fullName = params.lis_person_name_full || "";
  const givenName = params.lis_person_name_given || "";
  const familyName = params.lis_person_name_family || "";
  const email = params.lis_person_contact_email_primary;

  // Build display name from available fields
  const displayName = fullName || `${givenName} ${familyName}`.trim() || "Student";

  // Generate username: prefer email prefix, fall back to first name
  let username = "";
  if (email) {
    username = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
  } else if (givenName) {
    username = givenName.toLowerCase().replace(/[^a-z0-9]/g, "");
  } else {
    username = `student_${externalId}`;
  }

  return { externalId, displayName, username, email };
}
