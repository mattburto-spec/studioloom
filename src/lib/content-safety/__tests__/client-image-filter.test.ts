import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mock nsfwjs BEFORE importing the module under test ---
const mockClassify = vi.fn();
const mockLoad = vi.fn();

vi.mock('nsfwjs', () => ({
  load: mockLoad,
}));

// Mock Image constructor for fileToImage
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  _src = '';
  get src() { return this._src; }
  set src(v: string) {
    this._src = v;
    // Simulate successful load
    setTimeout(() => this.onload?.(), 0);
  }
}

// Mock URL.createObjectURL / revokeObjectURL
const originalURL = globalThis.URL;

beforeEach(() => {
  vi.stubGlobal('Image', MockImage);
  vi.stubGlobal('URL', {
    ...originalURL,
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Import AFTER mocks are set up
import { checkClientImage, _resetModelCache, IMAGE_MODERATION_MESSAGES } from '../client-image-filter';

function makePredictions(porn: number, hentai: number, sexy: number, neutral: number, drawing: number) {
  return [
    { className: 'Porn', probability: porn },
    { className: 'Hentai', probability: hentai },
    { className: 'Sexy', probability: sexy },
    { className: 'Neutral', probability: neutral },
    { className: 'Drawing', probability: drawing },
  ];
}

describe('client-image-filter', () => {
  beforeEach(() => {
    _resetModelCache();
    mockLoad.mockReset();
    mockClassify.mockReset();
    mockLoad.mockResolvedValue({ classify: mockClassify });
  });

  it('passes non-image files without loading model', async () => {
    const file = new File(['hello'], 'doc.pdf', { type: 'application/pdf' });
    const result = await checkClientImage(file);
    expect(result.ok).toBe(true);
    expect(result.status).toBe('clean');
    expect(result.layer).toBe('client_image');
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('passes clean image with high neutral score', async () => {
    mockClassify.mockResolvedValue(makePredictions(0.01, 0.02, 0.05, 0.88, 0.04));
    const file = new File(['pixels'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await checkClientImage(file);
    expect(result.ok).toBe(true);
    expect(result.status).toBe('clean');
    expect(result.flags).toHaveLength(0);
    expect(result.layer).toBe('client_image');
  });

  it('blocks image when combined score exceeds threshold', async () => {
    mockClassify.mockResolvedValue(makePredictions(0.4, 0.15, 0.1, 0.3, 0.05));
    const file = new File(['pixels'], 'bad.png', { type: 'image/png' });
    const result = await checkClientImage(file);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('blocked');
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0].type).toBe('sexual');
    expect(result.flags[0].severity).toBe('critical');
    expect(result.flags[0].confidence).toBeGreaterThan(0.6);
    expect(result.layer).toBe('client_image');
  });

  it('passes image at exactly the threshold (> not >=)', async () => {
    // porn(0.3) + hentai(0.2) + sexy(0.1) = 0.6 exactly → should pass
    mockClassify.mockResolvedValue(makePredictions(0.3, 0.2, 0.1, 0.35, 0.05));
    const file = new File(['pixels'], 'edge.jpg', { type: 'image/jpeg' });
    const result = await checkClientImage(file);
    expect(result.ok).toBe(true);
    expect(result.status).toBe('clean');
  });

  it('blocks image just above threshold', async () => {
    // 0.3 + 0.2 + 0.101 = 0.601 > 0.6
    mockClassify.mockResolvedValue(makePredictions(0.3, 0.2, 0.101, 0.349, 0.05));
    const file = new File(['pixels'], 'just-over.jpg', { type: 'image/jpeg' });
    const result = await checkClientImage(file);
    expect(result.ok).toBe(false);
    expect(result.status).toBe('blocked');
  });

  it('passes image when model fails to load (defence in depth)', async () => {
    mockLoad.mockRejectedValue(new Error('WebGL not available'));
    const file = new File(['pixels'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await checkClientImage(file);
    expect(result.ok).toBe(true);
    expect(result.status).toBe('clean');
    expect(result.layer).toBe('client_image');
  });

  it('passes image when classify throws (defence in depth)', async () => {
    mockClassify.mockRejectedValue(new Error('classify failed'));
    const file = new File(['pixels'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await checkClientImage(file);
    expect(result.ok).toBe(true);
    expect(result.status).toBe('clean');
  });

  it('loads model only once across multiple calls (singleton)', async () => {
    mockClassify.mockResolvedValue(makePredictions(0.01, 0.02, 0.05, 0.88, 0.04));
    const file = new File(['pixels'], 'photo.jpg', { type: 'image/jpeg' });
    await checkClientImage(file);
    await checkClientImage(file);
    await checkClientImage(file);
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it('result conforms to ModerationResult shape', async () => {
    mockClassify.mockResolvedValue(makePredictions(0.01, 0.02, 0.05, 0.88, 0.04));
    const file = new File(['pixels'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await checkClientImage(file);
    expect(result).toHaveProperty('ok');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('flags');
    expect(result).toHaveProperty('layer');
    expect(typeof result.ok).toBe('boolean');
    expect(['clean', 'pending', 'flagged', 'blocked']).toContain(result.status);
    expect(Array.isArray(result.flags)).toBe(true);
    expect(result.layer).toBe('client_image');
  });

  it('blocked result includes NSFW scores in detail', async () => {
    mockClassify.mockResolvedValue(makePredictions(0.7, 0.1, 0.05, 0.1, 0.05));
    const file = new File(['pixels'], 'explicit.jpg', { type: 'image/jpeg' });
    const result = await checkClientImage(file);
    expect(result.ok).toBe(false);
    expect(result.flags[0].detail).toContain('porn=0.700');
    expect(result.flags[0].detail).toContain('hentai=0.100');
    expect(result.flags[0].detail).toContain('sexy=0.050');
  });

  it('exports IMAGE_MODERATION_MESSAGES with en and zh', () => {
    expect(IMAGE_MODERATION_MESSAGES.en).toContain("can't be uploaded");
    expect(IMAGE_MODERATION_MESSAGES.zh).toContain('无法上传');
  });
});
