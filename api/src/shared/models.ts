// Shapes of the documents in the `players` and `teams` containers.
// Field names and the numeric positionType match the existing data written by the legacy site.

export enum PositionType {
  member = 0,
  coCaptain = 1,
  captain = 2,
  benchCoach = 3,
  headCoach = 4,
}

export interface Position {
  id: string;
  positionType: PositionType;
}

// Players are partitioned by id.
export interface Person {
  id: string;
  name: string;
  number: string;
  imageUrl: string;
  teams: Position[];
}

// Teams are partitioned by slug.
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

// Image fields are optional on input. Omitted means "keep the stored value" on update; an empty string clears it.
export type PersonInput = Omit<Person, 'id' | 'imageUrl'> & { imageUrl?: string };
export type TeamInput = Omit<Team, 'id' | 'slug' | 'imageUrl' | 'logoUrl' | 'defaultSkaterImage'> & {
  imageUrl?: string;
  logoUrl?: string;
  defaultSkaterImage?: string;
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const MAX_POSITIONS = 20;
const MAX_COUNT = 10000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Reads an optional string field, trimmed, with a length limit. Empty values come back as ''.
function readString(body: Record<string, unknown>, field: string, max: number, errors: string[]): string {
  const raw = body[field];
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') {
    errors.push(`${field} must be a string`);
    return '';
  }
  const value = raw.trim();
  if (value.length > max) errors.push(`${field} must be ${max} characters or fewer`);
  return value;
}

function readRequiredString(body: Record<string, unknown>, field: string, max: number, errors: string[]): string {
  const value = readString(body, field, max, errors);
  if (!value) errors.push(`${field} is required`);
  return value;
}

// Images and logos are only ever served over https, so anything else is rejected.
// Returns undefined when the field is left out, so the caller can keep the stored value.
function readHttpsUrl(body: Record<string, unknown>, field: string, errors: string[]): string | undefined {
  if (body[field] === undefined || body[field] === null) return undefined;
  const value = readString(body, field, 500, errors);
  if (value && !value.startsWith('https://')) errors.push(`${field} must be an https URL`);
  return value;
}

function readCount(body: Record<string, unknown>, field: string, errors: string[]): number {
  const raw = body[field];
  if (raw === undefined || raw === null) return 0;
  if (!Number.isInteger(raw) || (raw as number) < 0 || (raw as number) > MAX_COUNT) {
    errors.push(`${field} must be a whole number from 0 to ${MAX_COUNT}`);
    return 0;
  }
  return raw as number;
}

function readPositions(body: Record<string, unknown>, errors: string[]): Position[] {
  const raw = body.teams;
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_POSITIONS) {
    errors.push(`teams must be an array of at most ${MAX_POSITIONS} entries`);
    return [];
  }
  const positions: Position[] = [];
  raw.forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim()) {
      errors.push(`teams[${index}].id must be a non-empty string`);
      return;
    }
    const type = entry.positionType;
    if (!Number.isInteger(type) || (type as number) < PositionType.member || (type as number) > PositionType.headCoach) {
      errors.push(`teams[${index}].positionType must be a valid position`);
      return;
    }
    positions.push({ id: entry.id.trim(), positionType: type as PositionType });
  });
  return positions;
}

export function parsePersonInput(body: unknown): ParseResult<PersonInput> {
  if (!isRecord(body)) return { ok: false, errors: ['Body must be a JSON object'] };
  const errors: string[] = [];
  const value: PersonInput = {
    name: readRequiredString(body, 'name', 100, errors),
    number: readString(body, 'number', 10, errors),
    imageUrl: readHttpsUrl(body, 'imageUrl', errors),
    teams: readPositions(body, errors),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function parseTeamInput(body: unknown): ParseResult<TeamInput> {
  if (!isRecord(body)) return { ok: false, errors: ['Body must be a JSON object'] };
  const errors: string[] = [];
  const color = readString(body, 'color', 7, errors);
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) errors.push('color must be a hex value such as #1a2b3c');
  const value: TeamInput = {
    name: readRequiredString(body, 'name', 100, errors),
    description: readString(body, 'description', 2000, errors),
    imageUrl: readHttpsUrl(body, 'imageUrl', errors),
    logoUrl: readHttpsUrl(body, 'logoUrl', errors),
    defaultSkaterImage: readHttpsUrl(body, 'defaultSkaterImage', errors),
    color,
    seasonWins: readCount(body, 'seasonWins', errors),
    seasonLosses: readCount(body, 'seasonLosses', errors),
    ranking: readCount(body, 'ranking', errors),
    type: readString(body, 'type', 50, errors),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

// Team slugs are the partition key and the URL segment. They come from the name once and are not changed later.
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
