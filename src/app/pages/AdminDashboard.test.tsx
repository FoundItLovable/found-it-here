import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../lib/auth', () => ({
  getCurrentUser: vi.fn(),
  getCurrentUserWithProfile: vi.fn(),
  subscribeToAuthChanges: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  isStaff: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../../lib/database', () => ({
  getOfficeFoundItems: vi.fn(),
  getOfficeClaims: vi.fn(),
  getAllLostReports: vi.fn(),
  updateFoundItem: vi.fn(),
  deleteFoundItem: vi.fn(),
  createFoundItem: vi.fn(),
}));

import AdminDashboard from './AdminDashboard';
import { getCurrentUser, getCurrentUserWithProfile, isStaff } from '../../lib/auth';
import { getOfficeFoundItems, getOfficeClaims, getAllLostReports } from '../../lib/database';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUserWithProfile = {
  id: 'staff-1',
  profile: {
    id: 'staff-1',
    office_id: 'office-1',
    full_name: 'Test Staff',
    office: {
      office_name: 'Main Office',
      building_name: 'Building A',
      office_address: '123 Main St',
    },
  },
};

function renderDashboard() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AdminDashboard />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'staff-1', email: 'staff@example.com' } as any);
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue(mockUserWithProfile);
    vi.mocked(isStaff).mockResolvedValue(true);
    vi.mocked(getOfficeFoundItems).mockResolvedValue([]);
    vi.mocked(getOfficeClaims).mockResolvedValue([]);
    vi.mocked(getAllLostReports).mockResolvedValue([]);
  });

  it('renders the Admin badge after load', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });
  });

  it('shows Inventory and Metrics tabs after load', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /inventory/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /metrics/i })).toBeInTheDocument();
    });
  });

  it('shows empty state when inventory has no items', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('No items found')).toBeInTheDocument();
    });
  });

  it('shows stats banner labels after load', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('Available')).toBeInTheDocument();
      expect(screen.getByText('Returned')).toBeInTheDocument();
    });
  });

  it('shows office name from profile in the header', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Main Office')).toBeInTheDocument();
    });
  });

  it('renders item name when inventory has items', async () => {
    const now = new Date().toISOString();
    vi.mocked(getOfficeFoundItems).mockResolvedValue([
      {
        id: 'item-1',
        item_name: 'Blue Umbrella',
        description: 'Found near the elevator',
        category: 'other',
        status: 'available',
        created_at: now,
        updated_at: now,
        image_urls: [],
      },
    ]);

    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Blue Umbrella')).toBeInTheDocument();
    });
  });

  it('shows Sign Out button in the header', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });
  });
});
