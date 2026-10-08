import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { VISUAL_MODEL } from '@/lib/visual-model';

// Search by photo is public: only a device-computed vector of a known model
// may reach search_visual. App builds made before the SigLIP 2 switch still
// send DINOv2 vectors — those must keep working, compared only with their
// own model's vectors.

const rpcMock = vi.fn();

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcMock(fn, args);
      return Promise.resolve({ data: [], error: null });
    },
  },
}));

const unit = (dim: number) => Array.from({ length: dim }, (_, i) => (i === 0 ? 1 : 0));

function post(body: unknown) {
  return new NextRequest('http://localhost/api/search/image', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/search/image', () => {
  beforeEach(() => rpcMock.mockReset());

  it('searches with the current model', async () => {
    const { POST } = await import('@/app/api/search/image/route');
    const res = await POST(post({ model: VISUAL_MODEL.id, vector: unit(VISUAL_MODEL.dim), phash: '0123456789abcdef' }));
    expect(res.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('search_visual', expect.objectContaining({ p_model: VISUAL_MODEL.id }));
  });

  it('still accepts the DINOv2 vectors of older app builds', async () => {
    const { POST } = await import('@/app/api/search/image/route');
    const res = await POST(post({ model: 'dinov2-s14-q4.r280-area-v1', vector: unit(384) }));
    expect(res.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('search_visual', expect.objectContaining({ p_model: 'dinov2-s14-q4.r280-area-v1' }));
  });

  it('rejects an unknown model, a wrong dimension and non-numbers without querying', async () => {
    const { POST } = await import('@/app/api/search/image/route');
    for (const body of [
      { model: 'some-other-model', vector: unit(VISUAL_MODEL.dim) },
      { model: VISUAL_MODEL.id, vector: unit(384) },
      { model: 'dinov2-s14-q4.r280-area-v1', vector: unit(VISUAL_MODEL.dim) },
      { model: VISUAL_MODEL.id, vector: [...unit(VISUAL_MODEL.dim - 1), 'x'] },
      { model: '__proto__', vector: unit(VISUAL_MODEL.dim) },
    ]) {
      const res = await POST(post(body));
      expect(res.status).toBe(400);
    }
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
