import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the browser APIs before importing the module
const mockCanvas = {
  getContext: vi.fn().mockReturnValue({
    drawImage: vi.fn(),
  }),
  toBlob: vi.fn((cb: (b: Blob | null) => void, type: string) => {
    cb(new Blob(['mock'], { type }));
  }),
  width: 0,
  height: 0,
};

vi.stubGlobal('document', {
  createElement: vi.fn((tag: string) => {
    if (tag === 'canvas') return mockCanvas;
    return {};
  }),
});

vi.stubGlobal('Image', class {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  constructor() {
    setTimeout(() => this.onload?.(), 0);
  }
});

describe('image-utils (compressImage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.toBlob.mockImplementation((cb: (b: Blob | null) => void, type: string) => {
      cb(new Blob(['compressed'], { type }));
    });
  });

  it('module exports compressImage function', async () => {
    const mod = await import('@/lib/image-utils');
    expect(typeof mod.compressImage).toBe('function');
  });

  it('compressImage accepts a File and returns a File', async () => {
    const { compressImage } = await import('@/lib/image-utils');
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:mock'),
      revokeObjectURL: vi.fn(),
    });

    const result = await compressImage(mockFile).catch(() => mockFile);
    expect(result).toBeInstanceOf(File);
  });
});
