import { describe, it, expect, vi, beforeEach } from 'vitest';

const clerkUser = {
  primaryEmailAddressId: 'e1',
  emailAddresses: [{ id: 'e1', emailAddress: 'user@example.com' }],
  firstName: 'Ali',
  lastName: 'Valiev',
  imageUrl: 'https://img.example/a.png',
  primaryPhoneNumberId: null as string | null,
  phoneNumbers: [] as { id: string; phoneNumber: string }[],
};
vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: async () => ({ users: { getUser: async () => clerkUser } }),
}));

let existing: Record<string, unknown> | null = null;
const updateMock = vi.fn();
const upsertMock = vi.fn();
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
      update: (patch: unknown) => {
        updateMock(patch);
        return { eq: async () => ({ error: null }) };
      },
      upsert: async (row: unknown) => {
        upsertMock(row);
        return { error: null };
      },
    }),
  },
}));

describe('syncProfileFromClerk', () => {
  beforeEach(() => {
    updateMock.mockReset();
    upsertMock.mockReset();
  });

  it('fills only empty fields and never overwrites saved values', async () => {
    existing = { id: 'u1', email: '', first_name: 'Custom', last_name: null, avatar_url: 'mine.png', phone: '901234567' };
    const { syncProfileFromClerk } = await import('@/lib/services/profile-sync');
    const res = await syncProfileFromClerk('u1');
    expect(res).toEqual({ created: false, filled: ['email', 'last_name'] });
    const patch = updateMock.mock.calls[0][0];
    expect(patch).toMatchObject({ email: 'user@example.com', last_name: 'Valiev' });
    expect(patch).not.toHaveProperty('first_name');
    expect(patch).not.toHaveProperty('avatar_url');
    expect(patch).not.toHaveProperty('phone');
  });

  it('creates a missing profile from Clerk', async () => {
    existing = null;
    const { syncProfileFromClerk } = await import('@/lib/services/profile-sync');
    const res = await syncProfileFromClerk('u2');
    expect(res.created).toBe(true);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({ id: 'u2', email: 'user@example.com', first_name: 'Ali' });
  });

  it('writes nothing when the profile is already complete', async () => {
    existing = { id: 'u3', email: 'x@y.z', first_name: 'A', last_name: 'B', avatar_url: 'a', phone: '1' };
    const { syncProfileFromClerk } = await import('@/lib/services/profile-sync');
    const res = await syncProfileFromClerk('u3');
    expect(res.filled).toEqual([]);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
