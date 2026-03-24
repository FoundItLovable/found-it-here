import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
import { getCurrentUser, getCurrentUserWithProfile, isStaff, signOut } from '../../lib/auth';
import { getOfficeFoundItems, getOfficeClaims, getAllLostReports, updateFoundItem } from '../../lib/database';

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
    mockNavigate.mockReset();
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

  it('redirects to login when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    renderDashboard();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/Login');
    });
  });

  it('signs out and redirects when user is not staff', async () => {
    vi.mocked(isStaff).mockResolvedValue(false);
    renderDashboard();

    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/Login');
    });
  });

  it('filters inventory with search input', async () => {
    const now = new Date().toISOString();
    vi.mocked(getOfficeFoundItems).mockResolvedValue([
      {
        id: 'item-1',
        item_name: 'Blue Umbrella',
        description: 'Found near elevator',
        category: 'other',
        status: 'available',
        show_in_public_catalog: true,
        created_at: now,
        updated_at: now,
        image_urls: [],
      },
      {
        id: 'item-2',
        item_name: 'Silver Laptop',
        description: 'Found in library',
        category: 'electronics',
        status: 'available',
        show_in_public_catalog: true,
        created_at: now,
        updated_at: now,
        image_urls: [],
      },
    ] as any);

    renderDashboard();
    await waitFor(() => expect(screen.getByText('Blue Umbrella')).toBeInTheDocument());

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'laptop' },
    });

    await waitFor(() => {
      expect(screen.getByText('Silver Laptop')).toBeInTheDocument();
      expect(screen.queryByText('Blue Umbrella')).not.toBeInTheDocument();
    });
  });

  it('toggles catalog visibility from item card switch', async () => {
    const now = new Date().toISOString();
    vi.mocked(getOfficeFoundItems).mockResolvedValue([
      {
        id: 'item-1',
        item_name: 'Blue Umbrella',
        description: 'Found near elevator',
        category: 'other',
        status: 'available',
        show_in_public_catalog: true,
        created_at: now,
        updated_at: now,
        image_urls: [],
      },
    ] as any);

    renderDashboard();
    await waitFor(() => expect(screen.getByText('Blue Umbrella')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(updateFoundItem).toHaveBeenCalledWith('item-1', { show_in_public_catalog: false });
    });
  });

  it('opens and closes Add Item modal from toolbar button', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    await waitFor(() => expect(screen.getByText('Add Found Item')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByText('Add Found Item')).not.toBeInTheDocument());
  });
});
