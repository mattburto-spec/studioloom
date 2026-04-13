import { describe, test, expect } from 'vitest';
import {
  detectLanguage,
  checkBlocklist,
  checkPII,
  checkClientSide,
  MODERATION_MESSAGES,
} from '../client-filter';

// --- Language detection ---
describe('detectLanguage', () => {
  test('English text → en', () => {
    expect(detectLanguage('Hello world, this is a test')).toBe('en');
  });

  test('Chinese text → zh', () => {
    expect(detectLanguage('你好世界')).toBe('zh');
  });

  test('Mixed text with CJK → zh', () => {
    expect(detectLanguage('Hello 你好 world')).toBe('zh');
  });
});

// --- Blocklist matching — English ---
describe('checkBlocklist — English', () => {
  test('known EN profanity → flagged, type profanity, severity warning', () => {
    const flags = checkBlocklist('that is shit', 'en');
    expect(flags.length).toBeGreaterThanOrEqual(1);
    const profanity = flags.find((f) => f.type === 'profanity');
    expect(profanity).toBeDefined();
    expect(profanity!.severity).toBe('warning');
  });

  test('clean EN sentence → no flags', () => {
    const flags = checkBlocklist('The quick brown fox jumps over the lazy dog', 'en');
    expect(flags).toHaveLength(0);
  });

  test('word boundary: "assistant" should NOT match', () => {
    const flags = checkBlocklist('My assistant helped me with the project', 'en');
    const profanity = flags.find((f) => f.type === 'profanity');
    expect(profanity).toBeUndefined();
  });

  test('case insensitive: uppercase matches', () => {
    const flags = checkBlocklist('SHIT happens', 'en');
    expect(flags.find((f) => f.type === 'profanity')).toBeDefined();
  });

  test('multiple profanity words still produce one profanity flag (break on first)', () => {
    const flags = checkBlocklist('shit and fuck', 'en');
    const profanityFlags = flags.filter((f) => f.type === 'profanity');
    expect(profanityFlags).toHaveLength(1);
  });

  test('"class" and "grass" should NOT match "ass"', () => {
    const flags = checkBlocklist('The class sat on the grass', 'en');
    const profanity = flags.find((f) => f.type === 'profanity');
    expect(profanity).toBeUndefined();
  });
});

// --- Blocklist matching — Chinese ---
describe('checkBlocklist — Chinese', () => {
  test('known ZH profanity term → flagged', () => {
    const flags = checkBlocklist('这是三级片内容', 'zh');
    expect(flags.find((f) => f.type === 'profanity')).toBeDefined();
  });

  test('clean ZH sentence → no flags', () => {
    const flags = checkBlocklist('今天天气很好', 'zh');
    expect(flags).toHaveLength(0);
  });

  test('substring matching works (no word boundaries in Chinese)', () => {
    // 下贱 embedded in a longer string
    const flags = checkBlocklist('这个人真下贱啊', 'zh');
    expect(flags.find((f) => f.type === 'profanity')).toBeDefined();
  });
});

// --- Self-harm detection ---
describe('self-harm detection', () => {
  test('self-harm phrase → severity critical', () => {
    const flags = checkBlocklist('i want to kill myself', 'en');
    const sh = flags.find((f) => f.type === 'self_harm_risk');
    expect(sh).toBeDefined();
    expect(sh!.severity).toBe('critical');
  });

  test('clinical/educational term not in curated list → NOT flagged', () => {
    const flags = checkBlocklist('The school counselor discussed mental health awareness', 'en');
    const sh = flags.find((f) => f.type === 'self_harm_risk');
    expect(sh).toBeUndefined();
  });
});

// --- PII detection ---
describe('checkPII', () => {
  test('US phone number → flagged, type pii', () => {
    const flags = checkPII('Call me at 555-123-4567');
    expect(flags.find((f) => f.type === 'pii')).toBeDefined();
  });

  test('CN mobile number → flagged, type pii', () => {
    const flags = checkPII('我的手机号是13812345678');
    expect(flags.find((f) => f.type === 'pii')).toBeDefined();
  });

  test('email address → flagged, type pii', () => {
    const flags = checkPII('Email me at student@school.edu');
    expect(flags.find((f) => f.type === 'pii')).toBeDefined();
  });

  test('normal number in text → NOT flagged', () => {
    const flags = checkPII('I need 5 pencils and 12 sheets of paper');
    expect(flags).toHaveLength(0);
  });
});

// --- Orchestrator: checkClientSide ---
describe('checkClientSide', () => {
  test('clean text → ok true, status clean, no flags', () => {
    const result = checkClientSide('The quick brown fox jumps over the lazy dog');
    expect(result.ok).toBe(true);
    expect(result.status).toBe('clean');
    expect(result.flags).toHaveLength(0);
    expect(result.layer).toBe('client_text');
  });

  test('profanity → ok false, status flagged', () => {
    const result = checkClientSide('this is shit');
    expect(result.ok).toBe(false);
    expect(result.status).toBe('flagged');
    expect(result.flags.length).toBeGreaterThanOrEqual(1);
  });

  test('self-harm → ok false, status blocked (critical overrides warning)', () => {
    const result = checkClientSide('i want to kill myself');
    expect(result.ok).toBe(false);
    expect(result.status).toBe('blocked');
  });

  test('PII → ok false, status flagged', () => {
    const result = checkClientSide('My email is test@example.com');
    expect(result.ok).toBe(false);
    expect(result.status).toBe('flagged');
  });

  test('multiple issues (profanity + PII) → both flags present', () => {
    const result = checkClientSide('shit my email is test@example.com');
    expect(result.ok).toBe(false);
    const types = result.flags.map((f) => f.type);
    expect(types).toContain('profanity');
    expect(types).toContain('pii');
  });
});

// --- Localized messages ---
describe('MODERATION_MESSAGES', () => {
  test('EN message is a non-empty string', () => {
    expect(typeof MODERATION_MESSAGES.en).toBe('string');
    expect(MODERATION_MESSAGES.en.length).toBeGreaterThan(0);
  });

  test('ZH message contains Chinese characters', () => {
    expect(/[\u4e00-\u9fff]/.test(MODERATION_MESSAGES.zh)).toBe(true);
  });
});
