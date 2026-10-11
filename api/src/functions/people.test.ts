// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CLIENT_PRINCIPAL_HEADER } from '../shared/auth';
import { RoleStore } from '../shared/guard';
import { AppRole, ClientPrincipal } from '../shared/principal';
import { Person, PositionType } from '../shared/models';
import { asContainer, encodePrincipal, fakeRequest, InMemoryContainer } from '../shared/testDoubles';
import { peopleHandlers } from './people';

const github: ClientPrincipal = {
  identityProvider: 'github',
  userId: 'user-123',
  userDetails: 'someone',
  userRoles: ['authenticated'],
};
const signedIn = { [CLIENT_PRINCIPAL_HEADER]: encodePrincipal(github) };

const TEAM_ID = 'team-1';
const alex: Person = {
  id: 'p1',
  name: 'Alex',
  number: '12',
  imageUrl: '',
  portfolioUrl: '',
  teams: [{ id: TEAM_ID, positionType: PositionType.member }],
};
const sam: Person = { id: 'p2', name: 'Sam', number: '7', imageUrl: '', portfolioUrl: '', teams: [] };

// Mirrors the team filter the real SQL query does.
const filterByTeam = (docs: Person[], spec: { parameters?: { name: string; value: unknown }[] }) => {
  const teamId = spec.parameters?.find((p) => p.name === '@teamId')?.value;
  return teamId ? docs.filter((d) => d.teams.some((t) => t.id === teamId)) : docs;
};

function setup(role: AppRole | null = 'editor') {
  const players = new InMemoryContainer<Person>((p) => p.id, [alex, sam], filterByTeam);
  const roles: RoleStore = { getRole: vi.fn(async () => role) };
  const handlers = peopleHandlers(() => ({ roles, players: asContainer(players) }));
  return { handlers, players, roles };
}

const validBody = { name: 'Jordan', number: '3', imageUrl: '', teams: [{ id: TEAM_ID, positionType: 2 }] };

describe('players read endpoints', () => {
  it('removes Cosmos system fields from list and get responses', async () => {
    const { handlers, players } = setup();
    players.docs.set('p1\u0000p1', { ...alex, _rid: 'r', _self: 's', _etag: 'e', _ts: 1 } as Person);
    const list = await handlers.list(fakeRequest());
    const one = await handlers.get(fakeRequest({ params: { id: 'p1' } }));
    expect(list.jsonBody).toEqual(expect.arrayContaining([alex]));
    expect(one.jsonBody).toEqual(alex);
    expect(JSON.stringify(list.jsonBody)).not.toContain('_rid');
  });

  it('lists every player without checking roles', async () => {
    const { handlers, roles } = setup();
    const res = await handlers.list(fakeRequest());
    expect(res.status).toBe(200);
    expect(res.jsonBody).toHaveLength(2);
    expect(roles.getRole).not.toHaveBeenCalled();
  });

  it('filters the list to one team when teamId is given', async () => {
    const { handlers } = setup();
    const res = await handlers.list(fakeRequest({ query: { teamId: TEAM_ID } }));
    expect(res.jsonBody).toEqual([alex]);
  });

  it('rejects an empty teamId', async () => {
    const { handlers } = setup();
    const res = await handlers.list(fakeRequest({ query: { teamId: '' } }));
    expect(res.status).toBe(400);
  });

  it('returns one player by id, or 404 when missing', async () => {
    const { handlers } = setup();
    expect((await handlers.get(fakeRequest({ params: { id: 'p1' } }))).jsonBody).toEqual(alex);
    expect((await handlers.get(fakeRequest({ params: { id: 'nope' } }))).status).toBe(404);
  });
});

describe('players write endpoints', () => {
  it('create returns 401 when there is no sign-in', async () => {
    const { handlers, players } = setup();
    const res = await handlers.create(fakeRequest({ body: validBody }));
    expect(res.status).toBe(401);
    expect(players.docs.size).toBe(2);
  });

  it('create returns 403 for a signed-in user with no app role', async () => {
    const { handlers, players } = setup(null);
    const res = await handlers.create(fakeRequest({ body: validBody, headers: signedIn }));
    expect(res.status).toBe(403);
    expect(players.docs.size).toBe(2);
  });

  it('create lets an editor add a player with a generated id', async () => {
    const { handlers, players } = setup('editor');
    const res = await handlers.create(fakeRequest({ body: validBody, headers: signedIn }));
    expect(res.status).toBe(201);
    const created = res.jsonBody as Person;
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.name).toBe('Jordan');
    expect(players.docs.get(`${created.id}\u0000${created.id}`)).toEqual(created);
  });

  it('create rejects an invalid body with 400 and the reasons', async () => {
    const { handlers, players } = setup('editor');
    const res = await handlers.create(
      fakeRequest({ body: { name: '', teams: [{ id: TEAM_ID, positionType: 9 }] }, headers: signedIn }),
    );
    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({
      error: 'Invalid person',
      details: ['name is required', 'teams[0].positionType must be a valid position'],
    });
    expect(players.docs.size).toBe(2);
  });

  it('update returns 403 for a non-writer and leaves the player unchanged', async () => {
    const { handlers, players } = setup(null);
    const res = await handlers.update(
      fakeRequest({ body: { ...validBody, name: 'Changed' }, headers: signedIn, params: { id: 'p1' } }),
    );
    expect(res.status).toBe(403);
    expect(players.docs.get('p1\u0000p1')).toEqual(alex);
  });

  it('update replaces the player and ignores an id in the body', async () => {
    const { handlers, players } = setup('admin');
    const res = await handlers.update(
      fakeRequest({ body: { ...validBody, id: 'other' }, headers: signedIn, params: { id: 'p1' } }),
    );
    expect(res.status).toBe(200);
    expect(players.docs.get('p1\u0000p1')).toEqual({ id: 'p1', portfolioUrl: '', ...validBody });
    expect(players.docs.has('other\u0000other')).toBe(false);
  });

  it('update keeps the stored photo when the body leaves imageUrl out', async () => {
    const photo = 'https://acrdphotos.blob.core.windows.net/photos/Alex.png';
    const { handlers, players } = setup('editor');
    players.docs.set('p1\u0000p1', { ...alex, imageUrl: photo });
    const withoutPhoto = { name: validBody.name, number: validBody.number, teams: validBody.teams };

    const res = await handlers.update(fakeRequest({ body: withoutPhoto, headers: signedIn, params: { id: 'p1' } }));

    expect(res.status).toBe(200);
    expect(players.docs.get('p1\u0000p1')?.imageUrl).toBe(photo);
  });

  it('update keeps a stored portfolio link when the body leaves portfolioUrl out', async () => {
    const portfolio = 'https://example.com/jordan';
    const { handlers, players } = setup('editor');
    players.docs.set('p1\u0000p1', { ...alex, portfolioUrl: portfolio });
    const withoutPortfolio = { name: validBody.name, number: validBody.number, teams: validBody.teams };

    await handlers.update(fakeRequest({ body: withoutPortfolio, headers: signedIn, params: { id: 'p1' } }));

    expect(players.docs.get('p1\u0000p1')?.portfolioUrl).toBe(portfolio);
  });

  it('update clears the photo when the body sends an empty imageUrl', async () => {
    const photo = 'https://acrdphotos.blob.core.windows.net/photos/Alex.png';
    const { handlers, players } = setup('editor');
    players.docs.set('p1\u0000p1', { ...alex, imageUrl: photo });

    await handlers.update(fakeRequest({ body: { ...validBody, imageUrl: '' }, headers: signedIn, params: { id: 'p1' } }));

    expect(players.docs.get('p1\u0000p1')?.imageUrl).toBe('');
  });

  it('update returns 404 for a missing player', async () => {
    const { handlers } = setup('editor');
    const res = await handlers.update(fakeRequest({ body: validBody, headers: signedIn, params: { id: 'nope' } }));
    expect(res.status).toBe(404);
  });

  it('delete returns 403 for a non-writer and keeps the player', async () => {
    const { handlers, players } = setup(null);
    const res = await handlers.remove(fakeRequest({ headers: signedIn, params: { id: 'p1' } }));
    expect(res.status).toBe(403);
    expect(players.docs.has('p1\u0000p1')).toBe(true);
  });

  it('delete removes the player for an editor', async () => {
    const { handlers, players } = setup('editor');
    const res = await handlers.remove(fakeRequest({ headers: signedIn, params: { id: 'p1' } }));
    expect(res.status).toBe(204);
    expect(players.docs.has('p1\u0000p1')).toBe(false);
  });

  it('delete returns 404 for a missing player', async () => {
    const { handlers } = setup('editor');
    const res = await handlers.remove(fakeRequest({ headers: signedIn, params: { id: 'nope' } }));
    expect(res.status).toBe(404);
  });
});
