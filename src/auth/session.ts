// Who the signed-in user is and what app role they hold, for UI only.
// Every write is enforced on the server by requireRequestRole in the API.
export type AppRole = 'admin' | 'editor';

export interface CurrentUser {
  userDetails: string;
  identityProvider: string;
  role: AppRole | null;
}

// Resolves to null when nobody is signed in or the lookup fails.
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) return null;
    return (await response.json()) as CurrentUser;
  } catch {
    return null;
  }
}
