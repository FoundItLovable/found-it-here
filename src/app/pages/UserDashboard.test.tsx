import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../../lib/auth', () => ({
  getCurrentUser: vi.fn(),
  getCurrentUserWithProfile: vi.fn(),
  subscribeToAuthChanges: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  signOut: vi.fn(),
}));

vi.mock('../../lib/database', () => ({
  getUserLostReports: vi.fn(),
  createLostItemReport: vi.fn(),
  updateLostItemReport: vi.fn(),
  deleteLostItemReport: vi.fn().mockResolvedValue(undefined),
  getUserReportPotentialMatches: vi.fn().mockResolvedValue([]),
  requestUserPotentialMatchUpdate: vi.fn().mockResolvedValue(undefined),
  subscribeToMatchChanges: vi.fn().mockReturnValue(() => {}),
  removeUserPotentialMatch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/usePotentialMatches', () => ({
  usePotentialMatches: vi.fn(),
}));

import UserDashboard from './UserDashboard';
import { getCurrentUser, getCurrentUserWithProfile } from '../../lib/auth';
import { getUserLostReports, removeUserPotentialMatch, updateLostItemReport } from '../../lib/database';
import { usePotentialMatches } from '@/hooks/usePotentialMatches';

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
  const mockRemoveMatch = vi.fn();

  beforeEach(() => {
    vi.mocked(getUserLostReports).mockResolvedValue([]);
    vi.mocked(usePotentialMatches).mockReturnValue({
      matches: new Map(),
      loadingMatches: false,
      removeMatch: mockRemoveMatch,
    });
    mockRemoveMatch.mockReset();
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

    it('filters reports by search and clears filter', async () => {
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
        {
          id: 'report-2',
          student_id: 'user-1',
          item_name: 'Red Umbrella',
          description: 'Small umbrella',
          category: 'other',
          color: 'red',
          lost_date: '2024-01-11',
          lost_location: 'Cafeteria',
          status: 'active',
          created_at: new Date().toISOString(),
        },
      ] as any);

      renderDashboard();
      await waitFor(() => expect(screen.getByRole('tab', { name: /my reports/i })).toBeInTheDocument());
      fireEvent.mouseDown(screen.getByRole('tab', { name: /my reports/i }));

      await waitFor(() => expect(screen.getByText('Black Backpack')).toBeInTheDocument());

      const searchInput = screen.getByRole('searchbox');
      fireEvent.change(searchInput, { target: { value: 'zzz' } });

      await waitFor(() => {
        expect(screen.getByText(/no reports match/i)).toBeInTheDocument();
        expect(screen.queryByText('Black Backpack')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /clear search/i }));
      await waitFor(() => {
        expect(screen.getByText('Black Backpack')).toBeInTheDocument();
        expect(screen.getByText('Red Umbrella')).toBeInTheDocument();
      });
    });

    it('does not update report when mark-recovered confirmation is canceled', async () => {
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
      ] as any);

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderDashboard();
      await waitFor(() => expect(screen.getByRole('tab', { name: /my reports/i })).toBeInTheDocument());
      fireEvent.mouseDown(screen.getByRole('tab', { name: /my reports/i }));

      await waitFor(() => expect(screen.getByText('Black Backpack')).toBeInTheDocument());
      fireEvent.click(screen.getByTitle(/i got my item back/i));

      expect(confirmSpy).toHaveBeenCalled();
      expect(updateLostItemReport).not.toHaveBeenCalled();
    });

    it('removes match when clicking Not Mine', async () => {
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
      ] as any);

      vi.mocked(usePotentialMatches).mockReturnValue({
        matches: new Map([
          [
            'report-1',
            [
              {
                id: 'match-1',
                lostItemId: 'report-1',
                foundItemId: 'found-1',
                confidence: 88,
                foundItem: {
                  id: 'found-1',
                  name: 'Black Backpack',
                  description: 'Nike backpack',
                  category: 'bags',
                  status: 'available',
                  imageUrl: '',
                  dateFound: '2024-01-11',
                  officeId: 'office-1',
                  officeName: 'Main Office',
                  officeLocation: 'Building A',
                  checkedInBy: 'Staff',
                  createdAt: new Date().toISOString(),
                },
              },
            ],
          ],
        ]),
        loadingMatches: false,
        removeMatch: mockRemoveMatch,
      } as any);

      renderDashboard();
      await waitFor(() => expect(screen.getByRole('tab', { name: /my reports/i })).toBeInTheDocument());
      fireEvent.mouseDown(screen.getByRole('tab', { name: /my reports/i }));

      await waitFor(() => expect(screen.getByText('Black Backpack')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Black Backpack'));

      await waitFor(() => expect(screen.getByRole('button', { name: /not mine/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /not mine/i }));

      await waitFor(() => {
        expect(removeUserPotentialMatch).toHaveBeenCalledWith('report-1', 'found-1');
        expect(mockRemoveMatch).toHaveBeenCalledWith('report-1', 'found-1');
      });
    });
  });
});
