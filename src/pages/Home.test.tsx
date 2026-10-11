import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Home } from './Home';

describe('Home', () => {
  it('renders the league name as the main heading', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: 'ACDerby' })).toBeTruthy();
  });
});
