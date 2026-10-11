import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { RequireEditor } from './RequireEditor';

const fetchMock = vi.fn();

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireEditor />}>
          <Route path="/admin/people" element={<p>Admin content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireEditor', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the admin content to an editor', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ userDetails: 'ed', identityProvider: 'github', role: 'editor' })),
    );
    renderAt('/admin/people');
    expect(await screen.findByText('Admin content')).toBeTruthy();
  });

  it('refuses a signed-in user with no app role', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ userDetails: 'x', identityProvider: 'github', role: null })),
    );
    renderAt('/admin/people');
    expect(await screen.findByText(/do not have access/)).toBeTruthy();
    expect(screen.queryByText('Admin content')).toBeNull();
  });

  it('asks an anonymous visitor to sign in', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    renderAt('/admin/people');
    expect(await screen.findByText(/Please/)).toBeTruthy();
    expect(screen.queryByText('Admin content')).toBeNull();
  });
});
