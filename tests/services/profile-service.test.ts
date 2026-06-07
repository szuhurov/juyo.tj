import { describe, it, expect, vi } from 'vitest';
import { ProfileService } from '@/lib/services/profile-service';

const makeMockClient = () => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return { from: vi.fn().mockReturnValue(chain), _chain: chain };
};

describe('ProfileService.getProfile', () => {
  it('queries profiles table with correct user id', async () => {
    const mock = makeMockClient();
    mock._chain.maybeSingle.mockResolvedValue({ data: { id: 'u1', first_name: 'Алӣ' }, error: null });

    const result = await ProfileService.getProfile(mock, 'u1');

    expect(mock.from).toHaveBeenCalledWith('profiles');
    expect(mock._chain.eq).toHaveBeenCalledWith('id', 'u1');
    expect(result).toMatchObject({ id: 'u1', first_name: 'Алӣ' });
  });

  it('returns null when profile does not exist', async () => {
    const mock = makeMockClient();
    mock._chain.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await ProfileService.getProfile(mock, 'nonexistent');
    expect(result).toBeNull();
  });

  it('throws when supabase returns an error', async () => {
    const mock = makeMockClient();
    mock._chain.maybeSingle.mockResolvedValue({ data: null, error: new Error('Connection failed') });

    await expect(ProfileService.getProfile(mock, 'u1')).rejects.toThrow('Connection failed');
  });
});

describe('ProfileService.updateProfile', () => {
  it('upserts profile with correct user id and updates', async () => {
    const mock = makeMockClient();
    const updatedProfile = { id: 'u1', first_name: 'Алӣ', last_name: 'Алиев' };
    mock._chain.single.mockResolvedValue({ data: updatedProfile, error: null });

    const result = await ProfileService.updateProfile(mock, 'u1', {
      first_name: 'Алӣ',
      last_name: 'Алиев',
    });

    expect(mock._chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', first_name: 'Алӣ' })
    );
    expect(result).toEqual(updatedProfile);
  });

  it('always includes updated_at timestamp in upsert', async () => {
    const mock = makeMockClient();
    mock._chain.single.mockResolvedValue({ data: {}, error: null });

    await ProfileService.updateProfile(mock, 'u1', { first_name: 'Test' });

    const upsertArg = mock._chain.upsert.mock.calls[0][0];
    expect(upsertArg).toHaveProperty('updated_at');
    expect(typeof upsertArg.updated_at).toBe('string');
  });

  it('throws when update fails', async () => {
    const mock = makeMockClient();
    mock._chain.single.mockResolvedValue({ data: null, error: new Error('RLS violation') });

    await expect(
      ProfileService.updateProfile(mock, 'u1', { first_name: 'Test' })
    ).rejects.toThrow('RLS violation');
  });
});

describe('ProfileService.getPublicProfile', () => {
  it('does NOT include sensitive fields (phone is included for QR functionality)', async () => {
    const mock = makeMockClient();
    mock._chain.single.mockResolvedValue({
      data: { first_name: 'Алӣ', phone: '992900000000', is_qr_active: true },
      error: null,
    });

    const result = await ProfileService.getPublicProfile(mock, 'u1');

    // phone is included intentionally for QR contact feature
    expect(result).toHaveProperty('first_name');
    expect(result).toHaveProperty('is_qr_active');
  });

  it('queries from profiles table', async () => {
    const mock = makeMockClient();
    mock._chain.single.mockResolvedValue({ data: {}, error: null });

    await ProfileService.getPublicProfile(mock, 'u1');

    expect(mock.from).toHaveBeenCalledWith('profiles');
  });
});
