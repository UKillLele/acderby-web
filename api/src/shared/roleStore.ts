import { AppRole } from './principal';
import { RoleStore } from './guard';

// One document per app user in the Cosmos `users` container.
// id is `<identityProvider>:<userId>` and the partition key is `/identityProvider`,
// so a role lookup is a single point read.
export interface UserDocument {
  id: string;
  identityProvider: string;
  userId: string;
  role: AppRole;
  displayName?: string;
}

// The slice of a Cosmos container this store needs. Structural, so tests can pass a fake.
export interface UsersContainer {
  item(
    id: string,
    partitionKey: string,
  ): {
    read<T>(): Promise<{ resource?: T; statusCode: number }>;
  };
}

const APP_ROLES: readonly AppRole[] = ['admin', 'editor'];

// Ids are used as Cosmos item ids and path segments, so characters that would
// change the request URL are rejected before any read is made.
const UNSAFE_ID_CHARS = /[/\\?#]/;

export function userDocumentId(identityProvider: string, userId: string): string {
  return `${identityProvider}:${userId}`;
}

export class CosmosRoleStore implements RoleStore {
  constructor(private readonly users: UsersContainer) {}

  async getRole(identityProvider: string, userId: string): Promise<AppRole | null> {
    if (!identityProvider || !userId || UNSAFE_ID_CHARS.test(identityProvider) || UNSAFE_ID_CHARS.test(userId)) {
      return null;
    }

    const { resource } = await this.users
      .item(userDocumentId(identityProvider, userId), identityProvider)
      .read<UserDocument>();

    // Anything other than a known role fails closed.
    if (!resource || !APP_ROLES.includes(resource.role)) return null;
    return resource.role;
  }
}
