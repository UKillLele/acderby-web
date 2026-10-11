// Mirrors api/src/shared/models.ts (Team and TeamInput). Keep the two in step.
export interface Team {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  logoUrl: string;
  color: string;
  seasonWins: number;
  seasonLosses: number;
  ranking: number;
  defaultSkaterImage: string;
  type: string;
}

// Slug and id are set by the server, so they are not sent on create or update.
export type TeamInput = Omit<Team, 'id' | 'slug'>;
