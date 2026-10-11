// Mirrors api/src/shared/models.ts. Keep the two in step.
export enum PositionType {
  member = 0,
  coCaptain = 1,
  captain = 2,
  benchCoach = 3,
  headCoach = 4,
}

export const POSITION_LABELS: Record<PositionType, string> = {
  [PositionType.member]: 'Member',
  [PositionType.coCaptain]: 'Co-Captain',
  [PositionType.captain]: 'Captain',
  [PositionType.benchCoach]: 'Bench Coach',
  [PositionType.headCoach]: 'Head Coach',
};

export interface Position {
  id: string;
  positionType: PositionType;
}

export interface Person {
  id: string;
  name: string;
  number: string;
  imageUrl: string;
  portfolioUrl: string;
  teams: Position[];
}

export type PersonInput = Omit<Person, 'id'>;

export interface TeamSummary {
  id: string;
  slug: string;
  name: string;
}
