import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock server-moderation before import
vi.doMock('../server-moderation', () => ({
  moderateContent: vi.fn(),
}));

// Mock supabase admin
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
vi.doMock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'student_content_moderation_log') return { insert: mockInsert };
      if (table === 'student_progress') return { update: mockUpdate };
      return { insert: mockInsert };
    },
  }),
}));

describe('moderateAndLog', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns allow:true for clean content', async () => {
    const { moderateContent } = await import('../server-moderation');
    (moderateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      moderation: { ok: true, status: 'clean', flags: [], layer: 'server_haiku' },
      cost: { inputTokens: 10, outputTokens: 5, modelId: 'test', estimatedCostUSD: 0, timeMs: 50 },
    });
    const { moderateAndLog } = await import('../moderate-and-log');
    const result = await moderateAndLog('hello', {
      classId: 'c1', studentId: 's1', source: 'student_progress',
    });
    expect(result.allow).toBe(true);
    expect(mockInsert).not.toHaveBeenCalled(); // clean = no log
  });

  it('returns allow:true for flagged content (non-gate mode)', async () => {
    const { moderateContent } = await import('../server-moderation');
    (moderateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      moderation: { ok: false, status: 'flagged', flags: [{ type: 'profanity', severity: 'warning', confidence: 0.9 }], layer: 'server_haiku' },
      cost: { inputTokens: 10, outputTokens: 5, modelId: 'test', estimatedCostUSD: 0, timeMs: 50 },
    });
    const { moderateAndLog } = await import('../moderate-and-log');
    const result = await moderateAndLog('bad word', {
      classId: 'c1', studentId: 's1', source: 'tool_session',
    });
    expect(result.allow).toBe(true); // non-gate: allow even flagged
    expect(mockInsert).toHaveBeenCalledTimes(1); // but still logged
  });

  it('returns allow:false for blocked content in gate mode', async () => {
    const { moderateContent } = await import('../server-moderation');
    (moderateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      moderation: { ok: false, status: 'blocked', flags: [{ type: 'violence', severity: 'critical', confidence: 0.95 }], layer: 'server_haiku' },
      cost: { inputTokens: 10, outputTokens: 5, modelId: 'test', estimatedCostUSD: 0, timeMs: 50 },
    });
    const { moderateAndLog } = await import('../moderate-and-log');
    const result = await moderateAndLog('violent content', {
      classId: 'c1', studentId: 's1', source: 'gallery_post',
    }, { gate: true });
    expect(result.allow).toBe(false);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('returns allow:true for blocked content WITHOUT gate mode', async () => {
    const { moderateContent } = await import('../server-moderation');
    (moderateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      moderation: { ok: false, status: 'blocked', flags: [{ type: 'violence', severity: 'critical', confidence: 0.95 }], layer: 'server_haiku' },
      cost: { inputTokens: 10, outputTokens: 5, modelId: 'test', estimatedCostUSD: 0, timeMs: 50 },
    });
    const { moderateAndLog } = await import('../moderate-and-log');
    const result = await moderateAndLog('violent content', {
      classId: 'c1', studentId: 's1', source: 'student_progress',
    }); // no gate option
    expect(result.allow).toBe(true); // fire-and-forget allows through
  });

  it('still allows when logging fails', async () => {
    const { moderateContent } = await import('../server-moderation');
    (moderateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      moderation: { ok: false, status: 'flagged', flags: [{ type: 'pii', severity: 'warning', confidence: 0.8 }], layer: 'server_haiku' },
      cost: { inputTokens: 10, outputTokens: 5, modelId: 'test', estimatedCostUSD: 0, timeMs: 50 },
    });
    mockInsert.mockRejectedValueOnce(new Error('DB down'));
    const { moderateAndLog } = await import('../moderate-and-log');
    const result = await moderateAndLog('pii content', {
      classId: 'c1', studentId: 's1', source: 'student_progress',
    });
    expect(result.allow).toBe(true); // logging failure doesn't block
  });

  it('passes mimeType through for image moderation', async () => {
    const { moderateContent } = await import('../server-moderation');
    (moderateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      moderation: { ok: true, status: 'clean', flags: [], layer: 'server_haiku' },
      cost: { inputTokens: 100, outputTokens: 10, modelId: 'test', estimatedCostUSD: 0, timeMs: 200 },
    });
    const { moderateAndLog } = await import('../moderate-and-log');
    const buf = Buffer.from('fake-image');
    await moderateAndLog(buf, {
      classId: 'c1', studentId: 's1', source: 'upload_image',
    }, { mimeType: 'image/png' });
    expect(moderateContent).toHaveBeenCalledWith(buf, expect.any(Object), 'test-key', 'image/png');
  });

  it('logs pending status as flagged (migration constraint)', async () => {
    const { moderateContent } = await import('../server-moderation');
    (moderateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
      moderation: { ok: false, status: 'pending', flags: [{ type: 'other', severity: 'info', confidence: 0, detail: 'Haiku failed' }], layer: 'server_haiku' },
      cost: { inputTokens: 0, outputTokens: 0, modelId: 'test (failed)', estimatedCostUSD: 0, timeMs: 10 },
    });
    const { moderateAndLog } = await import('../moderate-and-log');
    await moderateAndLog('text', {
      classId: 'c1', studentId: 's1', source: 'student_progress',
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.overall_result).toBe('flagged'); // pending → flagged for DB CHECK constraint
  });
});
