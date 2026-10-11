import type { Container, SqlQuerySpec } from '@azure/cosmos';
import { ApiRequest } from './http';

// Test-only helpers. Nothing in the running app imports this file.

export const encodePrincipal = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64');

// The fakes implement only the calls the handlers make. This cast lets them stand in for a Container.
export function asContainer(fake: unknown): Container {
  return fake as Container;
}

export interface FakeRequestInit {
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  params?: Record<string, string>;
}

export function fakeRequest({ body, headers = {}, query = {}, params = {} }: FakeRequestInit = {}): ApiRequest {
  const lowerHeaders = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: { get: (name: string) => lowerHeaders[name.toLowerCase()] ?? null },
    query: { get: (name: string) => query[name] ?? null },
    params,
    json: async () => {
      if (body === undefined) throw new SyntaxError('No body');
      return body;
    },
  };
}

export function cosmosError(code: number): Error {
  return Object.assign(new Error(`cosmos ${code}`), { code });
}

// Keeps documents in memory with the same 404/409 behaviour as the Cosmos SDK for the calls the handlers make.
export class InMemoryContainer<T extends { id: string }> {
  readonly docs = new Map<string, T>();

  constructor(
    private readonly partitionKeyOf: (doc: T) => string,
    seed: T[] = [],
    // Decides which documents a query returns from those in the partition. Defaults to all of them.
    private readonly runQuery: (docs: T[], spec: SqlQuerySpec) => T[] = (docs) => docs,
  ) {
    for (const doc of seed) this.docs.set(this.key(this.partitionKeyOf(doc), doc.id), doc);
  }

  private key(partitionKey: string, id: string) {
    return `${partitionKey}\u0000${id}`;
  }

  private all(partitionKey?: string): T[] {
    const docs = [...this.docs.values()];
    return partitionKey === undefined ? docs : docs.filter((d) => this.partitionKeyOf(d) === partitionKey);
  }

  readonly items = {
    create: async (doc: T) => {
      const key = this.key(this.partitionKeyOf(doc), doc.id);
      if (this.docs.has(key)) throw cosmosError(409);
      this.docs.set(key, doc);
      return { resource: doc };
    },
    query: <R>(spec: SqlQuerySpec, options?: { partitionKey?: string }) => ({
      fetchAll: async () => ({
        resources: this.runQuery(this.all(options?.partitionKey), spec) as unknown as R[],
      }),
    }),
  };

  item(id: string, partitionKey: string) {
    const key = this.key(partitionKey, id);
    return {
      read: async <R>() => {
        const doc = this.docs.get(key);
        return { resource: doc as unknown as R | undefined, statusCode: doc ? 200 : 404 };
      },
      replace: async (doc: T) => {
        if (!this.docs.has(key)) throw cosmosError(404);
        this.docs.set(key, doc);
        return { resource: doc };
      },
      delete: async () => {
        if (!this.docs.delete(key)) throw cosmosError(404);
        return { statusCode: 204 };
      },
    };
  }
}
