import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/auth', () => ({
  getCurrentUser: vi.fn(),
  subscribeToAuthChanges: vi.fn(),
}));

import { getCurrentUser, subscribeToAuthChanges } from '../../lib/auth';
import { useAuthState } from './useAuthState';

describe('useAuthState', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(subscribeToAuthChanges).mockReset();
  });

  it('loads initial user and clears loading', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as any);
    vi.mocked(subscribeToAuthChanges).mockReturnValue({ unsubscribe: vi.fn() });

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.user?.id).toBe('u1');
    });
  });

  it('updates user when auth state callback fires and unsubscribes on cleanup', async () => {
    const unsubscribe = vi.fn();
    let authCallback: ((event: string, session: any) => void) | null = null;

    vi.mocked(getCurrentUser).mockResolvedValue(null as any);
    vi.mocked(subscribeToAuthChanges).mockImplementation((cb: any) => {
      authCallback = cb;
      return { unsubscribe };
    });

    const { result, unmount } = renderHook(() => useAuthState());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      authCallback?.('SIGNED_IN', { user: { id: 'u2' } });
    });

    await waitFor(() => expect(result.current.user?.id).toBe('u2'));

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
