import { app, HttpResponseInit } from '@azure/functions';
import type { Container, SqlQuerySpec } from '@azure/cosmos';
import { randomUUID } from 'node:crypto';
import { requireRequestRole } from '../shared/auth';
import { getContainer } from '../shared/cosmos';
import { RoleStore } from '../shared/guard';
import { ApiRequest, errorResponse, isCosmosError, json, readJsonBody, stripSystemFields, WRITE_ROLES } from '../shared/http';
import { parsePersonInput, Person } from '../shared/models';
import { CosmosRoleStore } from '../shared/roleStore';

export interface PlayersDeps {
  roles: RoleStore;
  players: Container;
}

const MAX_TEAM_ID_LENGTH = 64;

// Players are partitioned by id, so the id is passed as both the item id and the partition key.
export function playersHandlers(deps: () => PlayersDeps) {
  // Returns a response to send when the caller may not write, or null when they may.
  async function denyUnlessWriter(request: ApiRequest): Promise<HttpResponseInit | null> {
    const result = await requireRequestRole(request, WRITE_ROLES, deps().roles);
    if (result.ok) return null;
    return result.status === 401 ? errorResponse(401, 'Sign in required') : errorResponse(403, 'Forbidden');
  }

  return {
    list: async (request: ApiRequest): Promise<HttpResponseInit> => {
      const teamId = request.query.get('teamId');
      if (teamId !== null && (teamId.length === 0 || teamId.length > MAX_TEAM_ID_LENGTH)) {
        return errorResponse(400, 'teamId is not valid');
      }
      const spec: SqlQuerySpec = teamId
        ? {
            query: 'SELECT * FROM c WHERE EXISTS(SELECT VALUE t FROM t IN c.teams WHERE t.id = @teamId)',
            parameters: [{ name: '@teamId', value: teamId }],
          }
        : { query: 'SELECT * FROM c' };
      const { resources } = await deps().players.items.query<Person>(spec).fetchAll();
      return json(200, resources.map(stripSystemFields));
    },

    get: async (request: ApiRequest): Promise<HttpResponseInit> => {
      const id = request.params.id ?? '';
      const { resource } = await deps().players.item(id, id).read<Person>();
      return resource ? json(200, stripSystemFields(resource)) : errorResponse(404, 'Player not found');
    },

    create: async (request: ApiRequest): Promise<HttpResponseInit> => {
      const denied = await denyUnlessWriter(request);
      if (denied) return denied;

      const parsed = parsePersonInput(await readJsonBody(request));
      if (!parsed.ok) return errorResponse(400, 'Invalid player', parsed.errors);

      const doc: Person = { id: randomUUID(), ...parsed.value, imageUrl: parsed.value.imageUrl ?? '' };
      await deps().players.items.create(doc);
      return json(201, doc);
    },

    update: async (request: ApiRequest): Promise<HttpResponseInit> => {
      const denied = await denyUnlessWriter(request);
      if (denied) return denied;

      const id = request.params.id ?? '';
      const parsed = parsePersonInput(await readJsonBody(request));
      if (!parsed.ok) return errorResponse(400, 'Invalid player', parsed.errors);

      // The id comes from the route only. A different id in the body is ignored.
      // An omitted imageUrl keeps the stored photo; an empty string clears it.
      const { resource } = await deps().players.item(id, id).read<Person>();
      if (!resource) return errorResponse(404, 'Player not found');
      const existing = stripSystemFields(resource);

      const doc: Person = { id, ...parsed.value, imageUrl: parsed.value.imageUrl ?? existing.imageUrl };
      try {
        await deps().players.item(id, id).replace(doc);
      } catch (err) {
        if (isCosmosError(err, 404)) return errorResponse(404, 'Player not found');
        throw err;
      }
      return json(200, doc);
    },

    remove: async (request: ApiRequest): Promise<HttpResponseInit> => {
      const denied = await denyUnlessWriter(request);
      if (denied) return denied;

      const id = request.params.id ?? '';
      try {
        await deps().players.item(id, id).delete();
      } catch (err) {
        if (isCosmosError(err, 404)) return errorResponse(404, 'Player not found');
        throw err;
      }
      return json(204);
    },
  };
}

// The live dependencies. Read per request so importing this module does not need Cosmos configured.
const handlers = playersHandlers(() => ({
  roles: new CosmosRoleStore(getContainer('users')),
  players: getContainer('players'),
}));

app.http('listPlayers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'players',
  handler: handlers.list,
});

app.http('getPlayer', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'players/{id}',
  handler: handlers.get,
});

app.http('createPlayer', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'players',
  handler: handlers.create,
});

app.http('updatePlayer', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'players/{id}',
  handler: handlers.update,
});

app.http('deletePlayer', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'players/{id}',
  handler: handlers.remove,
});
