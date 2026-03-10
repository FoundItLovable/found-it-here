import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/auth', () => ({
  getCurrentUser: vi.fn(),
  getCurrentUserWithProfile: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../../lib/database', () => ({
  getUserLostReports: vi.fn(),
  createLostItemReport: vi.fn(),
  updateLostItemReport: vi.fn(),
  getUserReportPotentialMatches: vi.fn().mockResolvedValue([]),
}));

import UserDashboard from './UserDashboard';
import { getCurrentUser, getCurrentUserWithProfile } from '../../lib/auth';
import { getUserLostReports } from '../../lib/database';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser = { id: 'user-1', email: 'test@example.com' };

function renderDashboard() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <UserDashboard />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserDashboard', () => {
  beforeEach(() => {
    vi.mocked(getUserLostReports).mockResolvedValue([]);
  });

  describe('guest (not signed in)', () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      vi.mocked(getCurrentUserWithProfile).mockResolvedValue(null);
    });

    it('shows Sign In link in header', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
      });
    });

    it('renders the hero section', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText(/lost something/i)).toBeInTheDocument();
      });
    });

    it('renders Report Item and My Reports tabs', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /report item/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /my reports/i })).toBeInTheDocument();
      });
    });

    it('shows "sign in to view reports" prompt on My Reports tab', async () => {
      renderDashboard();
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: /my reports/i })).toBeInTheDocument()
      );
      // Radix UI Tabs activates on mouseDown, not click
      fireEvent.mouseDown(screen.getByRole('tab', { name: /my reports/i }));
      await waitFor(() => {
        expect(screen.getByText(/sign in to view reports/i)).toBeInTheDocument();
      });
    });
  });

  describe('logged in', () => {
    beforeEach(() => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(getCurrentUserWithProfile).mockResolvedValue({ ...mockUser, profile: { role: 'user' } });
    });

    it('shows Sign Out button in header', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
      });
    });

    it('shows "No reports yet" on My Reports tab when user has no reports', async () => {
      renderDashboard();
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: /my reports/i })).toBeInTheDocument()
      );
      // Radix UI Tabs activates on mouseDown, not click
      fireEvent.mouseDown(screen.getByRole('tab', { name: /my reports/i }));
      await waitFor(() => {
        expect(screen.getByText('No reports yet')).toBeInTheDocument();
      });
    });

    it('shows report cards when user has existing reports', async () => {
      vi.mocked(getUserLostReports).mockResolvedValue([
        {
          id: 'report-1',
          student_id: 'user-1',
          item_name: 'Black Backpack',
          description: 'Nike backpack with laptop inside',
          category: 'bags',
          color: 'black',
          lost_date: '2024-01-10',
          lost_location: 'Library',
          status: 'active',
          created_at: new Date().toISOString(),
        },
      ]);

      renderDashboard();
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: /my reports/i })).toBeInTheDocument()
      );
      // Radix UI Tabs activates on mouseDown, not click
      fireEvent.mouseDown(screen.getByRole('tab', { name: /my reports/i }));
      await waitFor(() => {
        expect(screen.getByText('Black Backpack')).toBeInTheDocument();
      });
    });
  });
});
