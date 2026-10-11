// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CLIENT_PRINCIPAL_HEADER, HeaderReader, requireRequestRole } from './auth';
import { RoleStore } from './guard';
import { AppRole } from './principal';

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64');

const github = {
  identityProvider: 'github',
  userId: 'user-123',
  userDetails: 'some-editor',
  userRoles: ['anonymous', 'authenticated'],
};

const requestWith = (headers: Record<string, string>): HeaderReader => ({
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
});

const storeReturning = (role: AppRole | null): RoleStore => ({
  getRole: vi.fn(async () => role),
});

describe('requireRequestRole', () => {
  it('reads the principal from the client principal header', async () => {
    const store = storeReturning('admin');
    const result = await requireRequestRole(
      requestWith({ [CLIENT_PRINCIPAL_HEADER]: encode(github) }),
      ['admin'],
      store,
    );
    expect(result.ok).toBe(true);
    expect(store.getRole).toHaveBeenCalledWith('github', 'user-123');
  });

  it('returns 401 when the request has no principal header', async () => {
    const store = storeReturning('admin');
    const result = await requireRequestRole(requestWith({}), ['admin'], store);
    expect(result).toEqual({ ok: false, status: 401 });
    expect(store.getRole).not.toHaveBeenCalled();
  });

  it('returns 403 for an editor on an admin-only action', async () => {
    const result = await requireRequestRole(
      requestWith({ [CLIENT_PRINCIPAL_HEADER]: encode(github) }),
      ['admin'],
      storeReturning('editor'),
    );
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it('returns 403 for a signed-in user with no app role', async () => {
    const result = await requireRequestRole(
      requestWith({ [CLIENT_PRINCIPAL_HEADER]: encode(github) }),
      ['admin', 'editor'],
      storeReturning(null),
    );
    expect(result).toEqual({ ok: false, status: 403 });
  });
});
