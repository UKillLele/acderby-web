// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { CosmosRoleStore, UserDocument, UsersContainer, userDocumentId } from './roleStore';

// Fake of the Cosmos container surface the store uses. `docs` is keyed by item id.
function fakeUsers(docs: Record<string, Partial<UserDocument>> = {}) {
  const item = vi.fn((id: string, _partitionKey: string) => ({
    read: async <T>() => {
      const resource = docs[id];
      if (!resource) return { resource: undefined as T | undefined, statusCode: 404 };
      return { resource: resource as T, statusCode: 200 };
    },
  }));
  const container: UsersContainer = { item };
  return { container, item };
}

describe('CosmosRoleStore', () => {
  it('returns the stored role for a known user', async () => {
    const { container } = fakeUsers({
      'github:123': { id: 'github:123', identityProvider: 'github', userId: '123', role: 'editor' },
    });
    const store = new CosmosRoleStore(container);
    expect(await store.getRole('github', '123')).toBe('editor');
  });

  it('reads the item by id and partitions by identity provider', async () => {
    const { container, item } = fakeUsers();
    await new CosmosRoleStore(container).getRole('github', '123');
    expect(item).toHaveBeenCalledWith('github:123', 'github');
  });

  it('returns null when the user has no document', async () => {
    const store = new CosmosRoleStore(fakeUsers().container);
    expect(await store.getRole('github', 'nobody')).toBeNull();
  });

  it('returns null when the stored role is not a known app role', async () => {
    const { container } = fakeUsers({
      'github:123': { id: 'github:123', identityProvider: 'github', userId: '123', role: 'superuser' as never },
    });
    expect(await new CosmosRoleStore(container).getRole('github', '123')).toBeNull();
  });

  it('returns null without reading when an id contains a path character', async () => {
    const { container, item } = fakeUsers();
    const store = new CosmosRoleStore(container);
    expect(await store.getRole('github', '12/3')).toBeNull();
    expect(await store.getRole('git?hub', '123')).toBeNull();
    expect(item).not.toHaveBeenCalled();
  });

  it('returns null without reading when an id is empty', async () => {
    const { container, item } = fakeUsers();
    expect(await new CosmosRoleStore(container).getRole('github', '')).toBeNull();
    expect(item).not.toHaveBeenCalled();
  });

  it('builds the document id as provider and user id joined by a colon', () => {
    expect(userDocumentId('github', '123')).toBe('github:123');
  });
});
