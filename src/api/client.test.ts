import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { peopleApi } from './client';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('peopleApi', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws an ApiError carrying the validation details from the server', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Invalid person', details: ['name is required'] }, 400));

    await expect(peopleApi.create({ name: '', number: '', imageUrl: '', portfolioUrl: '', roles: ['player'], teams: [] }))
      .rejects.toMatchObject({ status: 400, message: 'Invalid person', details: ['name is required'] });
  });

  it('sends a PUT with a JSON body to the person route', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'p1' }));

    await peopleApi.update('p1', { name: 'Alex', number: '1', imageUrl: '', portfolioUrl: '', roles: ['player'], teams: [] });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/people/p1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toMatchObject({ name: 'Alex', roles: ['player'] });
  });

  it('resolves with nothing for a 204 delete', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(peopleApi.remove('p1')).resolves.toBeUndefined();
  });

  it('encodes the team filter in the list request', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await peopleApi.list('team 1');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/people?teamId=team%201');
  });
});
