// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { requireRole, RoleStore } from './guard';
import { AppRole } from './principal';

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64');

const github = {
  identityProvider: 'github',
  userId: 'user-123',
  userDetails: 'some-editor',
  userRoles: ['anonymous', 'authenticated'],
};

const storeReturning = (role: AppRole | null): RoleStore => ({
  getRole: vi.fn(async () => role),
});

describe('requireRole', () => {
  it('returns 401 when the identity header is missing', async () => {
    const result = await requireRole(null, ['admin'], storeReturning('admin'));
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it('returns 401 when the identity header is not valid', async () => {
    const result = await requireRole('not-a-principal', ['admin'], storeReturning('admin'));
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it('returns 403 when the user has no app role', async () => {
    const result = await requireRole(encode(github), ['admin', 'editor'], storeReturning(null));
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it('returns 403 when the user role is not allowed for this action', async () => {
    const result = await requireRole(encode(github), ['admin'], storeReturning('editor'));
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it('ignores roles the client claims in its own identity', async () => {
    const claimingAdmin = { ...github, userRoles: ['admin', 'editor'] };
    const result = await requireRole(encode(claimingAdmin), ['admin'], storeReturning(null));
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it('allows a user whose stored role is permitted', async () => {
    const result = await requireRole(encode(github), ['admin', 'editor'], storeReturning('editor'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.role).toBe('editor');
  });

  it('looks up the role by identity provider and user id', async () => {
    const store = storeReturning('admin');
    await requireRole(encode(github), ['admin'], store);
    expect(store.getRole).toHaveBeenCalledWith('github', 'user-123');
  });
});
