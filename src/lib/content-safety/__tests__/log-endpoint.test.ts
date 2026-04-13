import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock createAdminClient before importing the route
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

// Dynamic import after mock setup
const { POST } = await import('@/app/api/safety/log-client-block/route');

describe('POST /api/safety/log-client-block', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  test('successful log writes to student_content_moderation_log', async () => {
    const req = new Request('http://localhost/api/safety/log-client-block', {
      method: 'POST',
      body: JSON.stringify({
        flagType: 'profanity',
        severity: 'warning',
        source: 'student_progress',
        lang: 'en',
        classId: '123e4567-e89b-12d3-a456-426614174000',
        studentId: '223e4567-e89b-12d3-a456-426614174000',
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.logged).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('student_content_moderation_log');
    // Verify no content field in the insert payload
    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg).not.toHaveProperty('content');
    expect(insertArg).not.toHaveProperty('text');
    expect(insertArg).not.toHaveProperty('snippet');
  });

  test('DB error returns logged: false (never blocks student workflow)', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'DB error' } });

    const req = new Request('http://localhost/api/safety/log-client-block', {
      method: 'POST',
      body: JSON.stringify({
        flagType: 'pii',
        severity: 'warning',
        source: 'gallery_post',
        lang: 'en',
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.logged).toBe(false);
  });

  test('missing required fields returns logged: false', async () => {
    const req = new Request('http://localhost/api/safety/log-client-block', {
      method: 'POST',
      body: JSON.stringify({ lang: 'en' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.logged).toBe(false);
    // Should not attempt DB insert with missing fields
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
