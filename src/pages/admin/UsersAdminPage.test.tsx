import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { usersApi } from '../../api/client';
import { fetchCurrentUser } from '../../auth/session';
import { UsersAdminPage } from './UsersAdminPage';

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    usersApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  };
});

vi.mock('../../auth/session', () => ({
  fetchCurrentUser: vi.fn(),
}));

const me = { userDetails: 'Anna', identityProvider: 'github', userId: '29181325', role: 'admin' as const };
const anna = { identityProvider: 'github', userId: '29181325', role: 'admin' as const, displayName: 'Anna' };
const ed = { identityProvider: 'github', userId: '111', role: 'editor' as const, displayName: 'Ed' };

function renderPage() {
  return render(
    <MemoryRouter>
      <UsersAdminPage />
    </MemoryRouter>,
  );
}

describe('UsersAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.list).mockResolvedValue([anna, ed]);
    vi.mocked(fetchCurrentUser).mockResolvedValue(me);
  });

  afterEach(() => {
    cleanup();
  });

  it('lists users and marks the signed-in user without a remove button', async () => {
    renderPage();
    expect(await screen.findByText('Ed')).toBeTruthy();
    expect(screen.getByText('you')).toBeTruthy();
    // Anna's own Remove button is disabled; only Ed's can be pressed.
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' }) as HTMLButtonElement[];
    expect(removeButtons.filter((button) => !button.disabled)).toHaveLength(1);
    expect(screen.queryByLabelText(`Role for ${anna.userId}`)).toBeNull();
  });

  it('adds a GitHub user with the chosen role', async () => {
    vi.mocked(usersApi.create).mockResolvedValue({
      identityProvider: 'github',
      userId: '555',
      role: 'admin',
      displayName: 'New Admin',
    });
    renderPage();
    await screen.findByText('Ed');

    fireEvent.change(screen.getByLabelText('GitHub user id'), { target: { value: '555' } });
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'New Admin' } });
    fireEvent.change(screen.getByLabelText('Role for new user'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));

    await waitFor(() => expect(usersApi.create).toHaveBeenCalledTimes(1));
    expect(vi.mocked(usersApi.create).mock.calls[0][0]).toEqual({
      identityProvider: 'github',
      userId: '555',
      role: 'admin',
      displayName: 'New Admin',
    });
    expect(await screen.findByText('New Admin')).toBeTruthy();
  });

  it('changes another user’s role and keeps their name', async () => {
    vi.mocked(usersApi.update).mockResolvedValue({ ...ed, role: 'admin' });
    renderPage();
    await screen.findByText('Ed');

    fireEvent.change(screen.getByLabelText('Role for 111'), { target: { value: 'admin' } });

    await waitFor(() => expect(usersApi.update).toHaveBeenCalledWith('github', '111', { role: 'admin', displayName: 'Ed' }));
  });

  it('shows the API’s refusal when a change is not allowed', async () => {
    const { ApiError } = await import('../../api/client');
    vi.mocked(usersApi.update).mockRejectedValue(new ApiError(409, 'At least one admin must remain'));
    renderPage();
    await screen.findByText('Ed');

    fireEvent.change(screen.getByLabelText('Role for 111'), { target: { value: 'admin' } });

    expect(await screen.findByText('At least one admin must remain')).toBeTruthy();
  });
});
