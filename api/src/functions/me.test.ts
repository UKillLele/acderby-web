// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CLIENT_PRINCIPAL_HEADER } from '../shared/auth';
import { RoleStore } from '../shared/guard';
import { AppRole } from '../shared/principal';
import { encodePrincipal, fakeRequest } from '../shared/testDoubles';
import { meHandler } from './me';

const github = { identityProvider: 'github', userId: '29181325', userDetails: 'admin', userRoles: [] };

function setup(role: AppRole | null) {
  const roles: RoleStore = { getRole: vi.fn(async () => role) };
  return { handler: meHandler(() => ({ roles })), roles };
}

describe('GET /api/me', () => {
  it('returns 401 when there is no sign-in', async () => {
    const { handler, roles } = setup('admin');
    const res = await handler(fakeRequest());
    expect(res.status).toBe(401);
    expect(roles.getRole).not.toHaveBeenCalled();
  });

  it('returns the stored role for the signed-in user', async () => {
    const { handler, roles } = setup('admin');
    const res = await handler(fakeRequest({ headers: { [CLIENT_PRINCIPAL_HEADER]: encodePrincipal(github) } }));
    expect(res.jsonBody).toEqual({ userDetails: 'admin', identityProvider: 'github', userId: '29181325', role: 'admin' });
    expect(roles.getRole).toHaveBeenCalledWith('github', '29181325');
  });

  it('returns a null role for a signed-in user with no app role', async () => {
    const { handler } = setup(null);
    const res = await handler(fakeRequest({ headers: { [CLIENT_PRINCIPAL_HEADER]: encodePrincipal(github) } }));
    expect(res.jsonBody).toMatchObject({ role: null });
  });

  it('ignores roles the client claims in its own identity', async () => {
    const { handler } = setup(null);
    const claiming = { ...github, userRoles: ['admin', 'editor'] };
    const res = await handler(fakeRequest({ headers: { [CLIENT_PRINCIPAL_HEADER]: encodePrincipal(claiming) } }));
    expect(res.jsonBody).toMatchObject({ role: null });
  });
});
