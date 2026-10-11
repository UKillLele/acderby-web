// Identity from the Static Web Apps GitHub provider, passed on every /api request
// in the x-ms-client-principal header (base64-encoded JSON).
export interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
}

export type AppRole = 'admin' | 'editor';

export function parseClientPrincipal(header: string | null | undefined): ClientPrincipal | null {
  if (!header) return null;
  try {
    const parsed = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as Partial<ClientPrincipal>;
    if (
      typeof parsed.identityProvider !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.userDetails !== 'string'
    ) {
      return null;
    }
    return {
      identityProvider: parsed.identityProvider,
      userId: parsed.userId,
      userDetails: parsed.userDetails,
      userRoles: Array.isArray(parsed.userRoles)
        ? parsed.userRoles.filter((role): role is string => typeof role === 'string')
        : [],
    };
  } catch {
    return null;
  }
}
