import { AppRole, ClientPrincipal, parseClientPrincipal } from './principal';

// App roles live in the app's own users store (Cosmos DB), not in Azure.
// The roles a client claims in its own token are never trusted.
export interface RoleStore {
  getRole(identityProvider: string, userId: string): Promise<AppRole | null>;
}

export type GuardResult =
  | { ok: true; principal: ClientPrincipal; role: AppRole }
  | { ok: false; status: 401 | 403 };

export async function requireRole(
  headerValue: string | null | undefined,
  allowed: AppRole[],
  store: RoleStore,
): Promise<GuardResult> {
  const principal = parseClientPrincipal(headerValue);
  if (!principal) return { ok: false, status: 401 };

  const role = await store.getRole(principal.identityProvider, principal.userId);
  if (!role || !allowed.includes(role)) return { ok: false, status: 403 };

  return { ok: true, principal, role };
}
