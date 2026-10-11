import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { RequireRole } from './RequireRole';

const fetchMock = vi.fn();

function renderAt(path: string, allowed: Parameters<typeof RequireRole>[0]['allowed']) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireRole allowed={allowed} />}>
          <Route path="/admin/users" element={<p>Admin content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const asUser = (role: 'admin' | 'editor' | null) =>
  new Response(JSON.stringify({ userDetails: 'x', identityProvider: 'github', userId: '1', role }));

describe('RequireRole', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the screen to a role that is allowed', async () => {
    fetchMock.mockResolvedValue(asUser('admin'));
    renderAt('/admin/users', ['admin']);
    expect(await screen.findByText('Admin content')).toBeTruthy();
  });

  it('refuses an editor on an admin-only screen', async () => {
    fetchMock.mockResolvedValue(asUser('editor'));
    renderAt('/admin/users', ['admin']);
    expect(await screen.findByText(/do not have access/)).toBeTruthy();
    expect(screen.queryByText('Admin content')).toBeNull();
  });

  it('refuses a signed-in user with no app role', async () => {
    fetchMock.mockResolvedValue(asUser(null));
    renderAt('/admin/users', ['admin', 'editor']);
    expect(await screen.findByText(/do not have access/)).toBeTruthy();
  });

  it('asks an anonymous visitor to sign in', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    renderAt('/admin/users', ['admin']);
    expect(await screen.findByText(/Please/)).toBeTruthy();
    expect(screen.queryByText('Admin content')).toBeNull();
  });
});
