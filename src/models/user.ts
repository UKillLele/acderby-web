// Mirrors api/src/shared/roleStore.ts and api/src/functions/users.ts. Keep the two in step.
export type AppRole = 'admin' | 'editor';

export interface AppUser {
  identityProvider: string;
  userId: string;
  role: AppRole;
  displayName: string;
}

export interface NewUser {
  identityProvider: 'github';
  userId: string;
  role: AppRole;
  displayName: string;
}

export interface RoleChange {
  role: AppRole;
  displayName: string;
}
