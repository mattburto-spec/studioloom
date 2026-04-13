import { describe, test, expect } from 'vitest';
import {
  SEVERITY_ACTIONS,
  ALL_MODERATION_STATUSES,
  ALL_FLAG_TYPES,
  ALL_SEVERITIES,
  ALL_CONTENT_SOURCES,
  ALL_MODERATION_LAYERS,
} from '../types';
import type {
  ModerationStatus,
  FlagType,
  Severity,
  ContentSource,
  ModerationLayer,
  ModerationFlag,
  ModerationResult,
  ModerationContext,
} from '../types';

describe('Content Safety Types', () => {
  // --- SEVERITY_ACTIONS mapping ---
  test('SEVERITY_ACTIONS has entries for all three severity levels', () => {
    expect(Object.keys(SEVERITY_ACTIONS).sort()).toEqual(['critical', 'info', 'warning']);
  });

  test('critical → blocked status', () => {
    expect(SEVERITY_ACTIONS.critical.status).toBe('blocked');
  });

  test('warning → flagged status', () => {
    expect(SEVERITY_ACTIONS.warning.status).toBe('flagged');
  });

  test('info → clean status', () => {
    expect(SEVERITY_ACTIONS.info.status).toBe('clean');
  });

  test('every severity level includes log action', () => {
    for (const severity of ALL_SEVERITIES) {
      expect(SEVERITY_ACTIONS[severity].actions).toContain('log');
    }
  });

  test('critical and warning include notify_teacher', () => {
    expect(SEVERITY_ACTIONS.critical.actions).toContain('notify_teacher');
    expect(SEVERITY_ACTIONS.warning.actions).toContain('notify_teacher');
  });

  test('info does NOT include notify_teacher', () => {
    expect(SEVERITY_ACTIONS.info.actions).not.toContain('notify_teacher');
  });

  // --- Const array completeness ---
  test('ALL_MODERATION_STATUSES has exactly 4 values', () => {
    expect(ALL_MODERATION_STATUSES).toHaveLength(4);
    expect(ALL_MODERATION_STATUSES).toContain('clean');
    expect(ALL_MODERATION_STATUSES).toContain('pending');
    expect(ALL_MODERATION_STATUSES).toContain('flagged');
    expect(ALL_MODERATION_STATUSES).toContain('blocked');
  });

  test('ALL_FLAG_TYPES has exactly 7 values', () => {
    expect(ALL_FLAG_TYPES).toHaveLength(7);
    expect(ALL_FLAG_TYPES).toContain('self_harm_risk');
    expect(ALL_FLAG_TYPES).toContain('pii');
  });

  test('ALL_CONTENT_SOURCES has exactly 8 values', () => {
    expect(ALL_CONTENT_SOURCES).toHaveLength(8);
  });

  test('ALL_MODERATION_LAYERS has exactly 3 values', () => {
    expect(ALL_MODERATION_LAYERS).toHaveLength(3);
  });

  // --- Interface shape validation (Lesson #38: assert expected values) ---
  test('ModerationFlag satisfies interface with all fields', () => {
    const flag: ModerationFlag = {
      type: 'profanity',
      severity: 'warning',
      confidence: 0.95,
      lang: 'en',
      detail: 'matched blocklist term',
    };
    expect(flag.type).toBe('profanity');
    expect(flag.severity).toBe('warning');
    expect(flag.confidence).toBeGreaterThanOrEqual(0);
    expect(flag.confidence).toBeLessThanOrEqual(1);
  });

  test('ModerationResult satisfies interface', () => {
    const result: ModerationResult = {
      ok: false,
      status: 'flagged',
      flags: [{ type: 'bullying', severity: 'warning', confidence: 0.8 }],
      layer: 'server_haiku',
    };
    expect(result.ok).toBe(false);
    expect(result.status).toBe('flagged');
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].type).toBe('bullying');
    expect(result.layer).toBe('server_haiku');
  });

  test('ModerationContext satisfies interface', () => {
    const ctx: ModerationContext = {
      classId: '123e4567-e89b-12d3-a456-426614174000',
      studentId: '223e4567-e89b-12d3-a456-426614174000',
      source: 'gallery_post',
      lang: 'zh',
    };
    expect(ctx.source).toBe('gallery_post');
    expect(ctx.lang).toBe('zh');
  });
});
