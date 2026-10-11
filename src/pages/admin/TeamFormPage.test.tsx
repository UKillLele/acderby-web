import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { teamsApi } from '../../api/client';
import type { Team } from '../../models/team';
import { TeamFormPage } from './TeamFormPage';

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    teamsApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
});

const hellcats: Team = {
  id: 'team-1',
  slug: 'hellcats',
  name: 'Hellcats',
  description: 'Home team',
  imageUrl: '',
  logoUrl: 'https://acrdphotos.blob.core.windows.net/photos/hellcats.png',
  color: '#ff0000',
  seasonWins: 3,
  seasonLosses: 1,
  ranking: 2,
  defaultSkaterImage: '',
  type: 'Home',
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/teams/new" element={<TeamFormPage />} />
        <Route path="/admin/teams/:slug" element={<TeamFormPage />} />
        <Route path="/admin/teams" element={<p>Teams list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TeamFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('requires a name and does not save', async () => {
    renderAt('/admin/teams/new');
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required.')).toBeTruthy();
    expect(teamsApi.create).not.toHaveBeenCalled();
  });

  it('creates a team with numbers and colour as typed', async () => {
    vi.mocked(teamsApi.create).mockResolvedValue({ ...hellcats, slug: 'bay-area', name: 'Bay Area' });
    renderAt('/admin/teams/new');

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Bay Area' } });
    fireEvent.change(screen.getByLabelText('Colour'), { target: { value: '#00aaff' } });
    fireEvent.change(screen.getByLabelText('Season wins'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Ranking'), { target: { value: '-3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(teamsApi.create).toHaveBeenCalledTimes(1));
    expect(vi.mocked(teamsApi.create).mock.calls[0][0]).toMatchObject({
      name: 'Bay Area',
      color: '#00aaff',
      seasonWins: 4,
      seasonLosses: 0,
      ranking: 0,
    });
    expect(await screen.findByText('Teams list')).toBeTruthy();
  });

  it('loads a team by slug and saves the update to that slug', async () => {
    vi.mocked(teamsApi.get).mockResolvedValue(hellcats);
    vi.mocked(teamsApi.update).mockResolvedValue({ ...hellcats, name: 'Hellcats Renamed' });
    renderAt('/admin/teams/hellcats');

    const name = await screen.findByLabelText('Name');
    expect((name as HTMLInputElement).value).toBe('Hellcats');
    expect(screen.getByText(/Slug: hellcats/)).toBeTruthy();

    fireEvent.change(name, { target: { value: 'Hellcats Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(teamsApi.update).toHaveBeenCalledTimes(1));
    expect(teamsApi.update).toHaveBeenCalledWith('hellcats', expect.objectContaining({ name: 'Hellcats Renamed', ranking: 2 }));
    expect(await screen.findByText('Teams list')).toBeTruthy();
  });
});
