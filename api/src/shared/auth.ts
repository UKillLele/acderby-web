import { GuardResult, RoleStore, requireRole } from './guard';
import { AppRole } from './principal';

// The header Static Web Apps sets on every request it forwards to a managed function.
export const CLIENT_PRINCIPAL_HEADER = 'x-ms-client-principal';

// Structural subset of HttpRequest so this file does not depend on the Functions runtime types.
export interface HeaderReader {
  headers: { get(name: string): string | null };
}

// Use this from every write endpoint. Roles are read from the app's users store only.
export function requireRequestRole(
  request: HeaderReader,
  allowed: AppRole[],
  store: RoleStore,
): Promise<GuardResult> {
  return requireRole(request.headers.get(CLIENT_PRINCIPAL_HEADER), allowed, store);
}
