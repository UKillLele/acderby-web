// Client-side identity lookup for UI only (show/hide admin links).
// Every write is enforced on the server by api/src/shared/guard.ts.
export interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
}

export async function fetchPrincipal(): Promise<ClientPrincipal | null> {
  try {
    const response = await fetch('/.auth/me');
    if (!response.ok) return null;
    const body = (await response.json()) as { clientPrincipal: ClientPrincipal | null };
    return body.clientPrincipal;
  } catch {
    return null;
  }
}
