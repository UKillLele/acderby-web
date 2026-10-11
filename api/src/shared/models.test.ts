// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePersonInput, parseTeamInput, slugify } from './models';

describe('parsePersonInput', () => {
  it('accepts a player with no positions and trims the name', () => {
    expect(parsePersonInput({ name: '  Alex ' })).toEqual({
      ok: true,
      value: { name: 'Alex', number: '', imageUrl: '', teams: [] },
    });
  });

  it('refuses an image that is not https', () => {
    const result = parsePersonInput({ name: 'Alex', imageUrl: 'javascript:alert(1)' });
    expect(result).toEqual({ ok: false, errors: ['imageUrl must be an https URL'] });
  });

  it('refuses a position type outside the known range', () => {
    const result = parsePersonInput({ name: 'Alex', teams: [{ id: 't', positionType: 5 }] });
    expect(result.ok).toBe(false);
  });

  it('refuses a body that is not an object', () => {
    expect(parsePersonInput(['Alex']).ok).toBe(false);
  });
});

describe('parseTeamInput', () => {
  it('defaults the season numbers to zero', () => {
    const result = parseTeamInput({ name: 'Hellcats' });
    expect(result.ok && result.value).toMatchObject({ seasonWins: 0, seasonLosses: 0, ranking: 0, type: '' });
  });

  it('refuses a colour that is not a six-digit hex value', () => {
    const result = parseTeamInput({ name: 'Hellcats', color: 'red' });
    expect(result).toEqual({ ok: false, errors: ['color must be a hex value such as #1a2b3c'] });
  });

  it('refuses a negative or fractional season count', () => {
    const result = parseTeamInput({ name: 'Hellcats', seasonWins: -1, ranking: 1.5 });
    expect(result.ok).toBe(false);
  });
});

describe('slugify', () => {
  it('uses the whole name, lower-cased with dashes', () => {
    expect(slugify('Bay Area Bombers')).toBe('bay-area-bombers');
  });

  it('removes accents and punctuation', () => {
    expect(slugify('  Crème Brûlée!! ')).toBe('creme-brulee');
  });

  it('returns an empty string when nothing usable is left', () => {
    expect(slugify('***')).toBe('');
  });
});
