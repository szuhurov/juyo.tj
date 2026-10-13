import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Admin-only route that writes a person's name and phone with the service
// role: a non-admin must get 404 before anything is read or written, and no
// photo may be attached that is not in our own bucket.

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }));
vi.mock('@/lib/admin-auth', () => ({ isAdminUser: (id: string | null) => id === 'admin_1' }));

const inserts: { table: string; rows: unknown }[] = [];
const fromMock = vi.fn((table: string) => ({
  select: () => ({ like: () => ({ eq: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }),
  insert: (rows: unknown) => {
    inserts.push({ table, rows });
    const done = Promise.resolve({ data: null, error: null });
    return Object.assign(done, { select: () => ({ single: () => Promise.resolve({ data: { id: 'item_1' }, error: null }) }) });
  },
  delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
}));
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: (t: string) => fromMock(t) } }));

const valid = {
  first_name: 'Алишер',
  last_name: 'Раҳимов',
  phone: '901234567',
  type: 'lost',
  category: 'Keys',
  title: 'Калид',
  description: 'Калиди мошин гум шуд',
  city: 'dushanbe',
  date: '2026-10-10',
  images: [{ url: 'https://example.supabase.co/storage/v1/object/public/items/a.jpg', thumb: null }],
};

const post = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/post-instagram', { method: 'POST', body: JSON.stringify(body) });

describe('POST /api/admin/post-instagram', () => {
  beforeEach(() => {
    inserts.length = 0;
    fromMock.mockClear();
  });

  it('answers 404 to a signed-out visitor and to a non-admin, without touching the database', async () => {
    const { POST } = await import('@/app/api/admin/post-instagram/route');
    for (const userId of [null, 'user_2']) {
      authMock.mockResolvedValue({ userId });
      expect((await POST(post(valid))).status).toBe(404);
    }
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('publishes an approved listing owned by the admin, carrying the person’s name as the Instagram line', async () => {
    authMock.mockResolvedValue({ userId: 'admin_1' });
    const { POST } = await import('@/app/api/admin/post-instagram/route');
    const res = await POST(post(valid));
    expect(res.status).toBe(200);

    // No account is created for the person.
    expect(inserts.find((i) => i.table === 'profiles')).toBeUndefined();

    const item = inserts.find((i) => i.table === 'items')!.rows as Record<string, unknown>;
    expect(item).toMatchObject({ user_id: 'admin_1', moderation_status: 'approved', phone_number: '901234567' });
    expect(String(item.description).split(String.fromCharCode(10))[0]).toBe('Instagram: Алишер Раҳимов');
  });

  it('refuses a photo that is not in the items bucket', async () => {
    authMock.mockResolvedValue({ userId: 'admin_1' });
    const { POST } = await import('@/app/api/admin/post-instagram/route');
    const res = await POST(post({ ...valid, images: [{ url: 'https://evil.example/x.jpg' }] }));
    expect(res.status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it('never attaches a photo to a Documents listing — only the placeholder', async () => {
    authMock.mockResolvedValue({ userId: 'admin_1' });
    const { POST } = await import('@/app/api/admin/post-instagram/route');
    const res = await POST(post({ ...valid, category: 'Documents' }));
    expect(res.status).toBe(200);
    const images = inserts.find((i) => i.table === 'item_images')!.rows as { image_url: string }[];
    expect(images).toHaveLength(1);
    expect(images[0].image_url).toBe('https://juyo.tj/placeholders/document.png');
  });
});
