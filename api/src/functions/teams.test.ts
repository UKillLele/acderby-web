// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CLIENT_PRINCIPAL_HEADER } from '../shared/auth';
import { RoleStore } from '../shared/guard';
import { AppRole, ClientPrincipal } from '../shared/principal';
import { Team } from '../shared/models';
import { asContainer, encodePrincipal, fakeRequest, InMemoryContainer } from '../shared/testDoubles';
import { teamsHandlers } from './teams';

const github: ClientPrincipal = {
  identityProvider: 'github',
  userId: 'user-123',
  userDetails: 'someone',
  userRoles: ['authenticated'],
};
const signedIn = { [CLIENT_PRINCIPAL_HEADER]: encodePrincipal(github) };

const home: Team = {
  id: 'team-1',
  slug: 'hellcats',
  name: 'Hellcats',
  description: 'Home team',
  imageUrl: '',
  logoUrl: '',
  color: '#ff0000',
  seasonWins: 3,
  seasonLosses: 1,
  ranking: 2,
  defaultSkaterImage: '',
  type: 'Home',
};

// Mirrors the slug lookup the real SQL query does.
const filterBySlug = (docs: Team[], spec: { parameters?: { name: string; value: unknown }[] }) => {
  const slug = spec.parameters?.find((p) => p.name === '@slug')?.value;
  return slug ? docs.filter((d) => d.slug === slug) : docs;
};

// Teams are stored under their slug as partition key and their GUID as id.
const homeKey = 'hellcats\u0000team-1';

function setup(role: AppRole | null = 'editor') {
  const teams = new InMemoryContainer<Team>((t) => t.slug, [home], filterBySlug);
  const roles: RoleStore = { getRole: vi.fn(async () => role) };
  const handlers = teamsHandlers(() => ({ roles, teams: asContainer(teams) }));
  return { handlers, teams, roles };
}

const newTeamBody = { name: 'Bay Area Bombers', description: 'Travel team', color: '#00aaff' };

describe('teams read endpoints', () => {
  it('lists teams without checking roles', async () => {
    const { handlers, roles } = setup();
    const res = await handlers.list();
    expect(res.jsonBody).toEqual([home]);
    expect(roles.getRole).not.toHaveBeenCalled();
  });

  it('returns one team by slug, or 404 when missing', async () => {
    const { handlers } = setup();
    expect((await handlers.get(fakeRequest({ params: { slug: 'hellcats' } }))).jsonBody).toEqual(home);
    expect((await handlers.get(fakeRequest({ params: { slug: 'nope' } }))).status).toBe(404);
  });
});

describe('teams write endpoints', () => {
  it('create returns 401 when there is no sign-in', async () => {
    const { handlers, teams } = setup();
    const res = await handlers.create(fakeRequest({ body: newTeamBody }));
    expect(res.status).toBe(401);
    expect(teams.docs.size).toBe(1);
  });

  it('create returns 403 for a signed-in user with no app role', async () => {
    const { handlers, teams } = setup(null);
    const res = await handlers.create(fakeRequest({ body: newTeamBody, headers: signedIn }));
    expect(res.status).toBe(403);
    expect(teams.docs.size).toBe(1);
  });

  it('create derives the slug from the full name and sets the default type', async () => {
    const { handlers } = setup('editor');
    const res = await handlers.create(fakeRequest({ body: newTeamBody, headers: signedIn }));
    expect(res.status).toBe(201);
    expect(res.jsonBody).toMatchObject({ slug: 'bay-area-bombers', type: 'Misc', seasonWins: 0 });
  });

  it('create refuses a second team that would get the same slug', async () => {
    const { handlers, teams } = setup('editor');
    const res = await handlers.create(
      fakeRequest({ body: { ...newTeamBody, name: 'hellcats!' }, headers: signedIn }),
    );
    expect(res.status).toBe(409);
    expect(teams.docs.get(homeKey)).toEqual(home);
    expect(teams.docs.size).toBe(1);
  });

  it('create rejects a name with no letters or numbers', async () => {
    const { handlers } = setup('editor');
    const res = await handlers.create(fakeRequest({ body: { name: '***' }, headers: signedIn }));
    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Invalid team', details: ['name must contain letters or numbers'] });
  });

  it('update returns 403 for a non-writer and leaves the team unchanged', async () => {
    const { handlers, teams } = setup(null);
    const res = await handlers.update(
      fakeRequest({ body: { ...newTeamBody, name: 'Hellcats' }, headers: signedIn, params: { slug: 'hellcats' } }),
    );
    expect(res.status).toBe(403);
    expect(teams.docs.get(homeKey)).toEqual(home);
  });

  it('update keeps the id, slug and type when the body leaves them out', async () => {
    const { handlers, teams } = setup('editor');
    const res = await handlers.update(
      fakeRequest({
        body: { name: 'Hellcats Renamed', description: 'Updated', color: '#ff0000' },
        headers: signedIn,
        params: { slug: 'hellcats' },
      }),
    );
    expect(res.status).toBe(200);
    expect(teams.docs.get(homeKey)).toMatchObject({
      id: 'team-1',
      slug: 'hellcats',
      name: 'Hellcats Renamed',
      type: 'Home',
    });
  });

  it('update keeps the stored logo and photo when the body leaves them out', async () => {
    const logo = 'https://acrdphotos.blob.core.windows.net/photos/hellcats.png';
    const { handlers, teams } = setup('editor');
    teams.docs.set(homeKey, { ...home, logoUrl: logo });

    const res = await handlers.update(
      fakeRequest({ body: { name: 'Hellcats', color: '#ff0000' }, headers: signedIn, params: { slug: 'hellcats' } }),
    );

    expect(res.status).toBe(200);
    expect(teams.docs.get(homeKey)).toMatchObject({ logoUrl: logo, imageUrl: '', defaultSkaterImage: '' });
  });

  it('update returns 404 for a missing team', async () => {
    const { handlers } = setup('editor');
    const res = await handlers.update(
      fakeRequest({ body: newTeamBody, headers: signedIn, params: { slug: 'nope' } }),
    );
    expect(res.status).toBe(404);
  });
});
