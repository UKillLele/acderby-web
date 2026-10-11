import { AppRole } from './principal';
import { ParseResult } from './models';

// Only GitHub accounts can be added for now. SWA's GitHub user ids are numeric.
export const MANAGED_PROVIDER = 'github';
const APP_ROLES: readonly AppRole[] = ['admin', 'editor'];
const GITHUB_USER_ID = /^\d{1,20}$/;

export interface NewUserInput {
  identityProvider: string;
  userId: string;
  role: AppRole;
  displayName: string;
}

export interface RoleUpdateInput {
  role: AppRole;
  displayName: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRole(body: Record<string, unknown>, errors: string[]): AppRole | undefined {
  const role = body.role;
  if (typeof role === 'string' && (APP_ROLES as readonly string[]).includes(role)) return role as AppRole;
  errors.push('role must be admin or editor');
  return undefined;
}

function readDisplayName(body: Record<string, unknown>, errors: string[]): string {
  const raw = body.displayName;
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') {
    errors.push('displayName must be a string');
    return '';
  }
  const value = raw.trim();
  if (value.length > 100) errors.push('displayName must be 100 characters or fewer');
  return value;
}

// Checks the provider and user id from the route. Returns the reasons when they are not usable.
export function checkUserPath(identityProvider: string, userId: string): string[] {
  const errors: string[] = [];
  if (identityProvider !== MANAGED_PROVIDER) errors.push(`identityProvider must be ${MANAGED_PROVIDER}`);
  if (!GITHUB_USER_ID.test(userId)) errors.push('userId must be a numeric GitHub id');
  return errors;
}

export function parseNewUser(body: unknown): ParseResult<NewUserInput> {
  if (!isRecord(body)) return { ok: false, errors: ['Body must be a JSON object'] };
  const errors: string[] = [];
  const identityProvider = typeof body.identityProvider === 'string' ? body.identityProvider : '';
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  errors.push(...checkUserPath(identityProvider, userId));
  const role = readRole(body, errors);
  const displayName = readDisplayName(body, errors);
  if (errors.length || !role) return { ok: false, errors };
  return { ok: true, value: { identityProvider, userId, role, displayName } };
}

export function parseRoleUpdate(body: unknown): ParseResult<RoleUpdateInput> {
  if (!isRecord(body)) return { ok: false, errors: ['Body must be a JSON object'] };
  const errors: string[] = [];
  const role = readRole(body, errors);
  const displayName = readDisplayName(body, errors);
  if (errors.length || !role) return { ok: false, errors };
  return { ok: true, value: { role, displayName } };
}
