// Client-side text filter — Phase 5B
// Pure function, no DOM deps, no async. Works in both client and server contexts.
// Blocklists bundled at build time via JSON imports.

import type { ModerationResult, ModerationFlag, FlagType } from './types';

import enBlocklist from './blocklists/ldnoobw-en.json';
import zhBlocklist from './blocklists/ldnoobw-zh.json';
import enSelfHarm from './blocklists/self-harm-en.json';
import zhSelfHarm from './blocklists/self-harm-zh.json';

// Pre-compile EN blocklist into word-boundary regexes
const enBlocklistPatterns = (enBlocklist as string[]).map(
  (word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
);
const enSelfHarmPatterns = (enSelfHarm as string[]).map(
  (phrase) => new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
);

// ZH lists used as lowercase substrings (no word boundaries in Chinese)
const zhBlocklistTerms = (zhBlocklist as string[]).map((t) => t.toLowerCase());
const zhSelfHarmTerms = (zhSelfHarm as string[]).map((t) => t.toLowerCase());

// PII patterns
const PII_PATTERNS: { pattern: RegExp; detail: string }[] = [
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, detail: 'US phone number' },
  { pattern: /\+1\s?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/, detail: 'US phone (+1)' },
  { pattern: /\b1[3-9]\d{9}\b/, detail: 'CN mobile number' },
  { pattern: /\b\d{3,4}[-\s]?\d{7,8}\b/, detail: 'CN landline number' },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, detail: 'email address' },
];

export function detectLanguage(text: string): 'en' | 'zh' | 'other' {
  // CJK Unified Ideographs range
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  return 'en';
}

export function checkPII(text: string): ModerationFlag[] {
  const flags: ModerationFlag[] = [];
  for (const { pattern, detail } of PII_PATTERNS) {
    if (pattern.test(text)) {
      flags.push({ type: 'pii', severity: 'warning', confidence: 0.9, detail });
    }
  }
  return flags;
}

export function checkBlocklist(
  text: string,
  lang: 'en' | 'zh' | 'other'
): ModerationFlag[] {
  const flags: ModerationFlag[] = [];
  const lower = text.toLowerCase();

  const checkEn = lang === 'en' || lang === 'other';
  const checkZh = lang === 'zh' || lang === 'other';

  // EN profanity (word-boundary regex)
  if (checkEn) {
    for (const pattern of enBlocklistPatterns) {
      if (pattern.test(text)) {
        flags.push({
          type: 'profanity',
          severity: 'warning',
          confidence: 0.95,
          lang: 'en',
        });
        break; // one profanity flag is enough
      }
    }
  }

  // ZH profanity (substring)
  if (checkZh) {
    for (const term of zhBlocklistTerms) {
      if (lower.includes(term)) {
        flags.push({
          type: 'profanity',
          severity: 'warning',
          confidence: 0.95,
          lang: 'zh',
        });
        break;
      }
    }
  }

  // Self-harm — EN (substring/phrase match, not word-boundary — phrases may span words)
  if (checkEn) {
    for (const pattern of enSelfHarmPatterns) {
      if (pattern.test(text)) {
        flags.push({
          type: 'self_harm_risk',
          severity: 'critical',
          confidence: 0.9,
          lang: 'en',
        });
        break;
      }
    }
  }

  // Self-harm — ZH (substring)
  if (checkZh) {
    for (const term of zhSelfHarmTerms) {
      if (lower.includes(term)) {
        flags.push({
          type: 'self_harm_risk',
          severity: 'critical',
          confidence: 0.9,
          lang: 'zh',
        });
        break;
      }
    }
  }

  return flags;
}

export function checkClientSide(text: string): ModerationResult {
  const lang = detectLanguage(text);
  const blocklistFlags = checkBlocklist(text, lang);
  const piiFlags = checkPII(text);
  const flags = [...blocklistFlags, ...piiFlags];

  let status: ModerationResult['status'] = 'clean';
  if (flags.some((f) => f.severity === 'critical')) {
    status = 'blocked';
  } else if (flags.length > 0) {
    status = 'flagged';
  }

  return {
    ok: status === 'clean',
    status,
    flags,
    layer: 'client_text',
  };
}

export const MODERATION_MESSAGES = {
  en: "This content can't be submitted. If you think this is a mistake, talk to your teacher.",
  zh: "此内容无法提交。如有疑问请联系老师。",
} as const;
