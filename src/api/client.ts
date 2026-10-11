import type { Person, PersonInput, TeamSummary } from '../models/person';

// Error from the API. `details` holds the validation messages when the request was refused with 400.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  error?: string;
  details?: string[];
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => ({}))) as ErrorBody & T;
  if (!response.ok) {
    throw new ApiError(response.status, body.error ?? `Request failed (${response.status})`, body.details ?? []);
  }
  return body;
}

const json = (value: unknown): RequestInit => ({ body: JSON.stringify(value) });

export const peopleApi = {
  list: (teamId?: string) =>
    request<Person[]>(teamId ? `/people?teamId=${encodeURIComponent(teamId)}` : '/people'),
  get: (id: string) => request<Person>(`/people/${encodeURIComponent(id)}`),
  create: (input: PersonInput) => request<Person>('/people', { method: 'POST', ...json(input) }),
  update: (id: string, input: PersonInput) =>
    request<Person>(`/people/${encodeURIComponent(id)}`, { method: 'PUT', ...json(input) }),
  remove: (id: string) => request<void>(`/people/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const teamsApi = {
  list: () => request<TeamSummary[]>('/teams'),
};
