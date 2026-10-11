import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { teamsApi } from '../../api/client';
import type { Team } from '../../models/team';
import { TeamsAdminPage } from './TeamsAdminPage';

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    teamsApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
});

const team = (name: string, slug: string, wins: number, losses: number): Team => ({
  id: slug,
  slug,
  name,
  description: '',
  imageUrl: '',
  logoUrl: '',
  color: '#123456',
  seasonWins: wins,
  seasonLosses: losses,
  ranking: 1,
  defaultSkaterImage: '',
  type: 'Home',
});

describe('TeamsAdminPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('lists teams by name with the season record and an edit link', async () => {
    vi.mocked(teamsApi.list).mockResolvedValue([
      team('Hellcats', 'hellcats', 3, 1),
      team('Bombers', 'bombers', 0, 4),
    ]);
    render(
      <MemoryRouter>
        <TeamsAdminPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Hellcats')).toBeTruthy();
    expect(screen.getByText('3–1')).toBeTruthy();
    const edit = screen.getAllByRole('link', { name: 'Edit' });
    expect(edit.map((link) => link.getAttribute('href'))).toEqual(['/admin/teams/bombers', '/admin/teams/hellcats']);
  });
});
