// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CLIENT_PRINCIPAL_HEADER } from '../shared/auth';
import { RoleStore } from '../shared/guard';
import { AppRole, ClientPrincipal } from '../shared/principal';
import { UserDocument } from '../shared/roleStore';
import { asContainer, encodePrincipal, fakeRequest, InMemoryContainer } from '../shared/testDoubles';
import { usersHandlers } from './users';

const CALLER_ID = '29181325';
const signedInAs = (userId: string): Record<string, string> => {
  const principal: ClientPrincipal = {
    identityProvider: 'github',
    userId,
    userDetails: `user-${userId}`,
    userRoles: ['authenticated'],
  };
  return { [CLIENT_PRINCIPAL_HEADER]: encodePrincipal(principal) };
};

const doc = (userId: string, role: AppRole, displayName = ''): UserDocument => ({
  id: userId,
  identityProvider: 'github',
  userId,
  role,
  displayName,
});

// Mirrors the role filter the real SQL query does for the admin count.
const filterByRole = (docs: UserDocument[], spec: { parameters?: { name: string; value: unknown }[] }) => {
  const role = spec.parameters?.find((p) => p.name === '@role')?.value;
  return role ? docs.filter((d) => d.role === role) : docs;
};

// The caller is an admin by default, and the other users are seeded below.
function setup(callerRole: AppRole | null = 'admin', seed: UserDocument[] = [doc(CALLER_ID, 'admin', 'Anna'), doc('111', 'editor')]) {
  const users = new InMemoryContainer<UserDocument>((d) => d.identityProvider, seed, filterByRole);
  const roles: RoleStore = {
    getRole: vi.fn(async (_provider: string, userId: string) => (userId === CALLER_ID ? callerRole : 'editor')),
  };
  const handlers = usersHandlers(() => ({ roles, users: asContainer(users) }));
  return { handlers, users, roles };
}

const adminHeaders = signedInAs(CALLER_ID);

describe('users access', () => {
  it('returns 401 for every action without a sign-in', async () => {
    const { handlers } = setup();
    expect((await handlers.list(fakeRequest())).status).toBe(401);
    expect((await handlers.create(fakeRequest({ body: {} }))).status).toBe(401);
    expect((await handlers.update(fakeRequest({ body: {}, params: { identityProvider: 'github', userId: '111' } }))).status).toBe(401);
    expect((await handlers.remove(fakeRequest({ params: { identityProvider: 'github', userId: '111' } }))).status).toBe(401);
  });

  it('returns 403 to an editor for every action and changes nothing', async () => {
    const { handlers, users } = setup('editor');
    const headers = signedInAs('111');
    const params = { identityProvider: 'github', userId: '111' };
    expect((await handlers.list(fakeRequest({ headers }))).status).toBe(403);
    expect((await handlers.create(fakeRequest({ headers, body: { identityProvider: 'github', userId: '5', role: 'editor' } }))).status).toBe(403);
    expect((await handlers.update(fakeRequest({ headers, params, body: { role: 'admin' } }))).status).toBe(403);
    expect((await handlers.remove(fakeRequest({ headers, params }))).status).toBe(403);
    expect(users.docs.get('github\u0000111')?.role).toBe('editor');
    expect(users.docs.has('github\u0000' + '5')).toBe(false);
  });

  it('returns 403 to a signed-in user with no app role', async () => {
    const { handlers } = setup(null);
    expect((await handlers.list(fakeRequest({ headers: adminHeaders }))).status).toBe(403);
  });
});

describe('GET /api/users', () => {
  it('lists users for an admin with only the fields the screen needs', async () => {
    const { handlers, users } = setup();
    users.docs.set('github\u0000111', { ...doc('111', 'editor', 'Ed'), _rid: 'r', _etag: 'e' } as UserDocument);
    const res = await handlers.list(fakeRequest({ headers: adminHeaders }));
    expect(res.jsonBody).toEqual([
      { identityProvider: 'github', userId: '111', role: 'editor', displayName: 'Ed' },
      { identityProvider: 'github', userId: CALLER_ID, role: 'admin', displayName: 'Anna' },
    ]);
  });
});

describe('POST /api/users', () => {
  it('adds a GitHub user with the chosen role', async () => {
    const { handlers, users } = setup();
    const res = await handlers.create(
      fakeRequest({ headers: adminHeaders, body: { identityProvider: 'github', userId: '555', role: 'editor', displayName: 'New Ed' } }),
    );
    expect(res.status).toBe(201);
    expect(users.docs.get('github\u0000555')).toEqual(doc('555', 'editor', 'New Ed'));
  });

  it('refuses a user who already has access with 409', async () => {
    const { handlers } = setup();
    const res = await handlers.create(
      fakeRequest({ headers: adminHeaders, body: { identityProvider: 'github', userId: '111', role: 'admin' } }),
    );
    expect(res.status).toBe(409);
  });

  it('refuses a provider other than GitHub', async () => {
    const { handlers, users } = setup();
    const res = await handlers.create(
      fakeRequest({ headers: adminHeaders, body: { identityProvider: 'aad', userId: '555', role: 'editor' } }),
    );
    expect(res.status).toBe(400);
    expect(users.docs.has('aad\u0000555')).toBe(false);
  });

  it('refuses a user id that is not numeric', async () => {
    const { handlers } = setup();
    const res = await handlers.create(
      fakeRequest({ headers: adminHeaders, body: { identityProvider: 'github', userId: 'someone', role: 'editor' } }),
    );
    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ details: ['userId must be a numeric GitHub id'] });
  });

  it('refuses a role that is not admin or editor', async () => {
    const { handlers } = setup();
    const res = await handlers.create(
      fakeRequest({ headers: adminHeaders, body: { identityProvider: 'github', userId: '555', role: 'owner' } }),
    );
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/users/{identityProvider}/{userId}', () => {
  const params = { identityProvider: 'github', userId: '111' };

  it('changes an editor to admin', async () => {
    const { handlers, users } = setup();
    const res = await handlers.update(fakeRequest({ headers: adminHeaders, params, body: { role: 'admin', displayName: 'Ed' } }));
    expect(res.status).toBe(200);
    expect(users.docs.get('github\u0000111')?.role).toBe('admin');
  });

  it('refuses to change the caller’s own role', async () => {
    const { handlers, users } = setup();
    const res = await handlers.update(
      fakeRequest({ headers: adminHeaders, params: { identityProvider: 'github', userId: CALLER_ID }, body: { role: 'editor' } }),
    );
    expect(res.status).toBe(400);
    expect(users.docs.get(`github\u0000${CALLER_ID}`)?.role).toBe('admin');
  });

  it('refuses to demote the last admin in the users container', async () => {
    // The caller is an admin in the role store but has no users row, as happens when two admins act at once.
    // Demoting the only admin row must still be refused.
    const { handlers, users } = setup('admin', [doc('222', 'admin')]);
    const res = await handlers.update(
      fakeRequest({ headers: adminHeaders, params: { identityProvider: 'github', userId: '222' }, body: { role: 'editor' } }),
    );
    expect(res.status).toBe(409);
    expect(users.docs.get('github\u0000222')?.role).toBe('admin');
  });

  it('allows demoting an admin when another admin remains', async () => {
    const { handlers, users } = setup('admin', [doc(CALLER_ID, 'admin'), doc('222', 'admin')]);
    const res = await handlers.update(
      fakeRequest({ headers: adminHeaders, params: { identityProvider: 'github', userId: '222' }, body: { role: 'editor' } }),
    );
    expect(res.status).toBe(200);
    expect(users.docs.get('github\u0000222')?.role).toBe('editor');
  });

  it('returns 404 for a user with no access', async () => {
    const { handlers } = setup();
    const res = await handlers.update(
      fakeRequest({ headers: adminHeaders, params: { identityProvider: 'github', userId: '999' }, body: { role: 'editor' } }),
    );
    expect(res.status).toBe(404);
  });

  it('refuses an invalid role', async () => {
    const { handlers, users } = setup();
    const res = await handlers.update(fakeRequest({ headers: adminHeaders, params, body: { role: 'owner' } }));
    expect(res.status).toBe(400);
    expect(users.docs.get('github\u0000111')?.role).toBe('editor');
  });
});

describe('DELETE /api/users/{identityProvider}/{userId}', () => {
  it('removes an editor’s access', async () => {
    const { handlers, users } = setup();
    const res = await handlers.remove(fakeRequest({ headers: adminHeaders, params: { identityProvider: 'github', userId: '111' } }));
    expect(res.status).toBe(204);
    expect(users.docs.has('github\u0000111')).toBe(false);
  });

  it('refuses to remove the caller’s own access', async () => {
    const { handlers, users } = setup();
    const res = await handlers.remove(
      fakeRequest({ headers: adminHeaders, params: { identityProvider: 'github', userId: CALLER_ID } }),
    );
    expect(res.status).toBe(400);
    expect(users.docs.has(`github\u0000${CALLER_ID}`)).toBe(true);
  });

  it('refuses to remove the last admin in the users container', async () => {
    // Same race as above: the caller is an admin in the role store with no users row.
    const { handlers, users } = setup('admin', [doc('222', 'admin')]);
    const res = await handlers.remove(fakeRequest({ headers: adminHeaders, params: { identityProvider: 'github', userId: '222' } }));
    expect(res.status).toBe(409);
    expect(users.docs.has('github\u0000222')).toBe(true);
  });

  it('removes an admin when another admin row remains', async () => {
    const { handlers, users } = setup('admin', [doc(CALLER_ID, 'admin'), doc('222', 'admin')]);
    const res = await handlers.remove(fakeRequest({ headers: adminHeaders, params: { identityProvider: 'github', userId: '222' } }));
    expect(res.status).toBe(204);
    expect(users.docs.has('github\u0000222')).toBe(false);
  });

  it('returns 404 for a user with no access', async () => {
    const { handlers } = setup();
    const res = await handlers.remove(fakeRequest({ headers: adminHeaders, params: { identityProvider: 'github', userId: '999' } }));
    expect(res.status).toBe(404);
  });
});
