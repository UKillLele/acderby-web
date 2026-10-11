import { app, HttpResponseInit } from '@azure/functions';
import { CLIENT_PRINCIPAL_HEADER } from '../shared/auth';
import { getContainer } from '../shared/cosmos';
import { RoleStore } from '../shared/guard';
import { ApiRequest, errorResponse, json } from '../shared/http';
import { parseClientPrincipal } from '../shared/principal';
import { CosmosRoleStore } from '../shared/roleStore';

export interface MeDeps {
  roles: RoleStore;
}

// Returns the caller's own app role so the UI can show or hide admin screens.
// This is for display only. Every write is still checked by requireRequestRole.
export function meHandler(deps: () => MeDeps) {
  return async (request: ApiRequest): Promise<HttpResponseInit> => {
    const principal = parseClientPrincipal(request.headers.get(CLIENT_PRINCIPAL_HEADER));
    if (!principal) return errorResponse(401, 'Sign in required');

    const role = await deps().roles.getRole(principal.identityProvider, principal.userId);
    return json(200, {
      userDetails: principal.userDetails,
      identityProvider: principal.identityProvider,
      role,
    });
  };
}

const handler = meHandler(() => ({ roles: new CosmosRoleStore(getContainer('users')) }));

app.http('me', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me',
  handler,
});
