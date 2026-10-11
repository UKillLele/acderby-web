import { app, HttpResponseInit } from '@azure/functions';
import type { Container, SqlQuerySpec } from '@azure/cosmos';
import { randomUUID } from 'node:crypto';
import { requireRequestRole } from '../shared/auth';
import { getContainer } from '../shared/cosmos';
import { RoleStore } from '../shared/guard';
import { ApiRequest, errorResponse, json, readJsonBody, WRITE_ROLES } from '../shared/http';
import { parseTeamInput, slugify, Team } from '../shared/models';
import { CosmosRoleStore } from '../shared/roleStore';

export interface TeamsDeps {
  roles: RoleStore;
  teams: Container;
}

// Teams are partitioned by slug, so a lookup by slug is a query inside one partition.
// The stored item id is the team's GUID, which players reference, so it is not used for lookups.
async function findBySlug(teams: Container, slug: string): Promise<Team | undefined> {
  const spec: SqlQuerySpec = {
    query: 'SELECT * FROM c WHERE c.slug = @slug',
    parameters: [{ name: '@slug', value: slug }],
  };
  const { resources } = await teams.items.query<Team>(spec, { partitionKey: slug }).fetchAll();
  return resources[0];
}

export function teamsHandlers(deps: () => TeamsDeps) {
  async function denyUnlessWriter(request: ApiRequest): Promise<HttpResponseInit | null> {
    const result = await requireRequestRole(request, WRITE_ROLES, deps().roles);
    if (result.ok) return null;
    return result.status === 401 ? errorResponse(401, 'Sign in required') : errorResponse(403, 'Forbidden');
  }

  return {
    list: async (): Promise<HttpResponseInit> => {
      const { resources } = await deps().teams.items.query<Team>({ query: 'SELECT * FROM c' }).fetchAll();
      return json(200, resources);
    },

    get: async (request: ApiRequest): Promise<HttpResponseInit> => {
      const team = await findBySlug(deps().teams, request.params.slug ?? '');
      return team ? json(200, team) : errorResponse(404, 'Team not found');
    },

    create: async (request: ApiRequest): Promise<HttpResponseInit> => {
      const denied = await denyUnlessWriter(request);
      if (denied) return denied;

      const parsed = parseTeamInput(await readJsonBody(request));
      if (!parsed.ok) return errorResponse(400, 'Invalid team', parsed.errors);

      const slug = slugify(parsed.value.name);
      if (!slug) return errorResponse(400, 'Invalid team', ['name must contain letters or numbers']);

      // Cosmos only enforces unique ids within a partition, and team ids are GUIDs, so a duplicate slug
      // has to be checked for here. Two creates arriving at the same moment could still both pass this check.
      if (await findBySlug(deps().teams, slug)) {
        return errorResponse(409, 'A team with this name already exists');
      }

      const doc: Team = { id: randomUUID(), slug, ...parsed.value, type: parsed.value.type || 'Misc' };
      await deps().teams.items.create(doc);
      return json(201, doc);
    },

    update: async (request: ApiRequest): Promise<HttpResponseInit> => {
      const denied = await denyUnlessWriter(request);
      if (denied) return denied;

      const slug = request.params.slug ?? '';
      const parsed = parseTeamInput(await readJsonBody(request));
      if (!parsed.ok) return errorResponse(400, 'Invalid team', parsed.errors);

      // Keep the id and slug from the stored document, and the type when the body leaves it out.
      const existing = await findBySlug(deps().teams, slug);
      if (!existing) return errorResponse(404, 'Team not found');

      const doc: Team = { ...existing, ...parsed.value, type: parsed.value.type || existing.type };
      await deps().teams.item(existing.id, slug).replace(doc);
      return json(200, doc);
    },
  };
}

// The live dependencies. Read per request so importing this module does not need Cosmos configured.
const handlers = teamsHandlers(() => ({
  roles: new CosmosRoleStore(getContainer('users')),
  teams: getContainer('teams'),
}));

app.http('listTeams', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'teams',
  handler: handlers.list,
});

app.http('getTeam', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'teams/{slug}',
  handler: handlers.get,
});

app.http('createTeam', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'teams',
  handler: handlers.create,
});

app.http('updateTeam', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'teams/{slug}',
  handler: handlers.update,
});
