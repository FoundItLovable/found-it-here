import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetSession,
  mockGetUser,
  mockSignUp,
  mockSignOut,
  mockOnAuthStateChange,
  mockFrom,
  mockSelect,
  mockEq,
  mockSingle,
  mockUpdate,
  mockUpdateEq,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockGetUser: vi.fn(),
  mockSignUp: vi.fn(),
  mockSignOut: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockSingle: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateEq: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
      signUp: mockSignUp,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange,
    },
    from: mockFrom,
  },
}));

import {
  getSession,
  getCurrentUser,
  getCurrentUserWithProfile,
  isStaff,
  signUp,
} from './auth';

describe('auth contracts', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetUser.mockReset();
    mockSignUp.mockReset();
    mockSignOut.mockReset();
    mockOnAuthStateChange.mockReset();
    mockFrom.mockReset();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockSingle.mockReset();
    mockUpdate.mockReset();
    mockUpdateEq.mockReset();

    mockEq.mockReturnValue({ single: mockSingle });
    mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it('getSession returns session when present', async () => {
    const session = { user: { id: 'u1' } } as any;
    mockGetSession.mockResolvedValue({ data: { session }, error: null });
    await expect(getSession()).resolves.toEqual(session);
  });

  it('getSession throws on auth error', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: new Error('session error') });
    await expect(getSession()).rejects.toThrow('session error');
  });

  it('getCurrentUser returns null when user is absent', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('getCurrentUser throws on auth error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('user error') });
    await expect(getCurrentUser()).rejects.toThrow('user error');
  });

  it('getCurrentUserWithProfile returns null when no active session user', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(getCurrentUserWithProfile()).resolves.toBeNull();
  });

  it('getCurrentUserWithProfile hydrates role and office', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'a@b.com' } } },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        role: 'staff',
        office_id: 'office-1',
        office: { office_id: 'office-1', office_name: 'Main Office' },
      },
      error: null,
    });

    const user = await getCurrentUserWithProfile();
    expect(user?.profile.role).toBe('staff');
    expect(user?.profile.office_id).toBe('office-1');
    expect(user?.profile.office?.office_name).toBe('Main Office');
  });

  it('isStaff returns false for anonymous users', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(isStaff()).resolves.toBe(false);
  });

  it('isStaff returns true only when profile role is staff', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockSingle.mockResolvedValue({ data: { role: 'staff' }, error: null });
    await expect(isStaff()).resolves.toBe(true);

    mockSingle.mockResolvedValue({ data: { role: 'student' }, error: null });
    await expect(isStaff()).resolves.toBe(false);
  });

  it('signUp throws when auth signup fails', async () => {
    mockSignUp.mockResolvedValue({ data: null, error: { message: 'signup failed' } });
    await expect(
      signUp({
        email: 'a@b.com',
        password: 'Password123!',
        fullName: 'Test User',
        organizationId: 'org-1',
      })
    ).rejects.toThrow('signup failed');
  });

  it('signUp throws when signup returns no user', async () => {
    mockSignUp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    await expect(
      signUp({
        email: 'a@b.com',
        password: 'Password123!',
        fullName: 'Test User',
        organizationId: 'org-1',
      })
    ).rejects.toThrow('Failed to create user');
  });

  it('signUp throws when existing user is detected by empty identities', async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', identities: [] },
        session: null,
      },
      error: null,
    });

    await expect(
      signUp({
        email: 'exists@b.com',
        password: 'Password123!',
        fullName: 'Existing User',
        organizationId: 'org-1',
      })
    ).rejects.toThrow('An account with this email already exists');
  });

  it('signUp throws when profile organization update fails', async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', identities: [{ id: 'identity-1' }] },
        session: { user: { id: 'user-1' } },
      },
      error: null,
    });

    mockUpdateEq.mockResolvedValue({ error: { message: 'update failed' } });

    await expect(
      signUp({
        email: 'a@b.com',
        password: 'Password123!',
        fullName: 'Test User',
        organizationId: 'org-1',
      })
    ).rejects.toThrow('Account created but organization could not be set: update failed');
  });

  it('signUp returns auth data for successful flow', async () => {
    const authData = {
      user: { id: 'user-1', identities: [{ id: 'identity-1' }] },
      session: { user: { id: 'user-1' } },
    } as any;

    mockSignUp.mockResolvedValue({ data: authData, error: null });
    mockUpdateEq.mockResolvedValue({ error: null });

    await expect(
      signUp({
        email: 'ok@b.com',
        password: 'Password123!',
        fullName: 'OK User',
        organizationId: 'org-1',
      })
    ).resolves.toEqual(authData);
  });
});
