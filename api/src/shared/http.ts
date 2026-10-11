import { HttpResponseInit } from '@azure/functions';
import { HeaderReader } from './auth';
import { AppRole } from './principal';

// Everything a handler needs from a request. HttpRequest satisfies this, and tests can build a plain object.
export interface ApiRequest extends HeaderReader {
  query: { get(name: string): string | null };
  params: Record<string, string | undefined>;
  json(): Promise<unknown>;
}

// Roles allowed to change content. Only admins manage users, so they are included here too.
export const WRITE_ROLES: AppRole[] = ['admin', 'editor'];

export function json(status: number, body?: unknown): HttpResponseInit {
  return body === undefined ? { status } : { status, jsonBody: body };
}

export function errorResponse(status: number, error: string, details?: string[]): HttpResponseInit {
  return json(status, details ? { error, details } : { error });
}

// Returns undefined for a missing or malformed body so callers can answer 400.
export async function readJsonBody(request: ApiRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

// The Cosmos SDK reports the HTTP status on `code`, e.g. 404 for a missing item or 409 for a duplicate id.
export function isCosmosError(err: unknown, code: number): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === code;
}
