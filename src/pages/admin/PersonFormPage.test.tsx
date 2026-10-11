import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { peopleApi, teamsApi } from '../../api/client';
import { PersonFormPage } from './PersonFormPage';

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    peopleApi: { ...actual.peopleApi, create: vi.fn(), update: vi.fn(), get: vi.fn(), list: vi.fn(), remove: vi.fn() },
    teamsApi: { list: vi.fn() },
  };
});

const photographers = { id: 'team-photo', slug: 'photographers', name: 'Photographers' };

function renderNewPerson() {
  return render(
    <MemoryRouter initialEntries={['/admin/people/new']}>
      <Routes>
        <Route path="/admin/people/new" element={<PersonFormPage />} />
        <Route path="/admin/people" element={<p>People list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PersonFormPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(teamsApi.list).mockResolvedValue([photographers]);
  });

  it('requires a name and does not save', async () => {
    renderNewPerson();
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required.')).toBeTruthy();
    expect(peopleApi.create).not.toHaveBeenCalled();
  });

  it('saves a photographer as a member of the Photographers team, with a portfolio link', async () => {
    vi.mocked(peopleApi.create).mockResolvedValue({
      id: 'new',
      name: 'Riley',
      number: '',
      imageUrl: '',
      portfolioUrl: 'https://example.com/riley',
      teams: [{ id: 'team-photo', positionType: 0 }],
    });
    renderNewPerson();

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Riley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add team position' }));
    fireEvent.change(screen.getByLabelText('Team'), { target: { value: 'team-photo' } });
    fireEvent.change(screen.getByLabelText('Portfolio link'), { target: { value: 'https://example.com/riley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(peopleApi.create).toHaveBeenCalledTimes(1));
    expect(vi.mocked(peopleApi.create).mock.calls[0][0]).toMatchObject({
      name: 'Riley',
      portfolioUrl: 'https://example.com/riley',
      teams: [{ id: 'team-photo', positionType: 0 }],
    });
    expect(await screen.findByText('People list')).toBeTruthy();
  });
});
