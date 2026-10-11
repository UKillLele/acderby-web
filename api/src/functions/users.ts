import { app, HttpResponseInit } from '@azure/functions';
import type { Container, SqlQuerySpec } from '@azure/cosmos';
import { requireRequestRole } from '../shared/auth';
import { getContainer } from '../shared/cosmos';
import { RoleStore } from '../shared/guard';
import { ApiRequest, errorResponse, isCosmosError, json, readJsonBody, stripSystemFields } from '../shared/http';
import { AppRole } from '../shared/principal';
import { CosmosRoleStore, UserDocument } from '../shared/roleStore';
import { checkUserPath, parseNewUser, parseRoleUpdate } from '../shared/userValidation';

export interface UsersDeps {
  roles: RoleStore;
  users: Container;
}

// Managing app access is admin only. Editors cannot list, add, change or remove anyone.
const ADMIN_ONLY: AppRole[] = ['admin'];

// Only the fields the admin screen needs. Cosmos internals and anything unexpected are left out.
function toUser(doc: UserDocument) {
  return {
    identityProvider: doc.identityProvider,
    userId: doc.userId,
    role: doc.role,
    displayName: doc.displayName ?? '',
  };
}

async function countAdmins(users: Container): Promise<number> {
  const spec: SqlQuerySpec = {
    query: 'SELECT c.id FROM c WHERE c.role = @role',
    parameters: [{ name: '@role', value: 'admin' }],
  };
  const { resources } = await users.items.query<UserDocument>(spec).fetchAll();
  return resources.length;
}

export function usersHandlers(deps: () => UsersDeps) {
  // Returns the caller when they are an admin, or the response to send back when they are not.
  async function requireAdmin(
    request: ApiRequest,
  ): Promise<{ ok: true; caller: { identityProvider: string; userId: string } } | { ok: false; response: HttpResponseInit }> {
    const result = await requireRequestRole(request, ADMIN_ONLY, deps().roles);
    if (!result.ok) {
      const response = result.status === 401 ? errorResponse(401, 'Sign in required') : errorResponse(403, 'Forbidden');
      return { ok: false, response };
    }
    const { identityProvider, userId } = result.principal;
    return { ok: true, caller: { identityProvider, userId } };
  }

  return {
    list: async (request: ApiRequest): Promise<HttpResponseInit> => {
      const gate = await requireAdmin(request);
      if (!gate.ok) return gate.response;

      const { resources } = await deps().users.items.query<UserDocument>({ query: 'SELECT * FROM c' }).fetchAll();
      const users = resources.map((doc) => toUser(stripSystemFields(doc))).sort((a, b) => a.userId.localeCompare(b.userId));
      return json(200, users);
    },

    create: async (request: ApiRequest): Promise<HttpResponseInit> => {
      const gate = await requireAdmin(request);
      if (!gate.ok) return gate.response;

      const parsed = parseNewUser(await readJsonBody(request));
      if (!parsed.ok) return errorResponse(400, 'Invalid user', parsed.errors);

      const { identityProvider, userId, role, displayName } = parsed.value;
      const doc: UserDocument = { id: userId, identityProvider, userId, role, displayName };
      try {
        // Cosmos refuses a second item with the same id in the same partition, so an existing user gets 409.
        await deps().users.items.create(doc);
      } catch (err) {
        if (isCosmosError(err, 409)) return errorResponse(409, 'That user already has access');
        throw err;
      }
      return json(201, toUser(doc));
    },

    update: async (request: ApiRequest): Promise<HttpResponseInit> => {
      const gate = await requireAdmin(request);
      if (!gate.ok) return gate.response;

      const identityProvider = request.params.identityProvider ?? '';
      const userId = request.params.userId ?? '';
      const pathErrors = checkUserPath(identityProvider, userId);
      if (pathErrors.length) return errorResponse(400, 'Invalid user', pathErrors);

      // Changing your own role could lock you out, so it is refused. Another admin has to do it.
      if (gate.caller.identityProvider === identityProvider && gate.caller.userId === userId) {
        return errorResponse(400, 'You cannot change your own role');
      }

      const parsed = parseRoleUpdate(await readJsonBody(request));
      if (!parsed.ok) return errorResponse(400, 'Invalid user', parsed.errors);

      const { resource } = await deps().users.item(userId, identityProvider).read<UserDocument>();
      if (!resource) return errorResponse(404, 'User not found');

      if (resource.role === 'admin' && parsed.value.role !== 'admin' && (await countAdmins(deps().users)) <= 1) {
        return errorResponse(409, 'At least one admin must remain');
      }

      const doc: UserDocument = {
        ...stripSystemFields(resource),
        role: parsed.value.role,
        displayName: parsed.value.displayName,
      };
      await deps().users.item(userId, identityProvider).replace(doc);
      return json(200, toUser(doc));
    },

    remove: async (request: ApiRequest): Promise<HttpResponseInit> => {
      const gate = await requireAdmin(request);
      if (!gate.ok) return gate.response;

      const identityProvider = request.params.identityProvider ?? '';
      const userId = request.params.userId ?? '';
      const pathErrors = checkUserPath(identityProvider, userId);
      if (pathErrors.length) return errorResponse(400, 'Invalid user', pathErrors);

      if (gate.caller.identityProvider === identityProvider && gate.caller.userId === userId) {
        return errorResponse(400, 'You cannot remove your own access');
      }

      const { resource } = await deps().users.item(userId, identityProvider).read<UserDocument>();
      if (!resource) return errorResponse(404, 'User not found');

      if (resource.role === 'admin' && (await countAdmins(deps().users)) <= 1) {
        return errorResponse(409, 'At least one admin must remain');
      }

      try {
        await deps().users.item(userId, identityProvider).delete();
      } catch (err) {
        if (isCosmosError(err, 404)) return errorResponse(404, 'User not found');
        throw err;
      }
      return json(204);
    },
  };
}

// The live dependencies. Read per request so importing this module does not need Cosmos configured.
const handlers = usersHandlers(() => {
  const users = getContainer('users');
  return { roles: new CosmosRoleStore(users), users };
});

app.http('listUsers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users',
  handler: handlers.list,
});

app.http('createUser', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'users',
  handler: handlers.create,
});

app.http('updateUser', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'users/{identityProvider}/{userId}',
  handler: handlers.update,
});

app.http('deleteUser', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'users/{identityProvider}/{userId}',
  handler: handlers.remove,
});
