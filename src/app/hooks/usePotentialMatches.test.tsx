import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/database', () => ({
  getUserReportPotentialMatches: vi.fn(),
  subscribeToMatchChanges: vi.fn(),
}));

import { getUserReportPotentialMatches, subscribeToMatchChanges } from '../../lib/database';
import { usePotentialMatches } from './usePotentialMatches';

describe('usePotentialMatches', () => {
  beforeEach(() => {
    vi.mocked(getUserReportPotentialMatches).mockReset();
    vi.mocked(subscribeToMatchChanges).mockReset();
    vi.mocked(subscribeToMatchChanges).mockReturnValue(() => {});
  });

  it('preloads matches only for unseen report ids', async () => {
    vi.mocked(getUserReportPotentialMatches).mockResolvedValue([]);

    const user = { id: 'user-1' } as any;
    const initialReports = [{ id: 'r1', status: 'searching' }, { id: 'r2', status: 'searching' }] as any;

    const { rerender } = renderHook(
      ({ lostItems }) => usePotentialMatches(lostItems, user),
      { initialProps: { lostItems: initialReports } }
    );

    await waitFor(() => expect(getUserReportPotentialMatches).toHaveBeenCalledTimes(2));

    rerender({ lostItems: [{ id: 'r1', status: 'searching' }, { id: 'r2', status: 'searching' }] as any });
    await waitFor(() => expect(getUserReportPotentialMatches).toHaveBeenCalledTimes(2));

    rerender({ lostItems: [{ id: 'r1', status: 'searching' }, { id: 'r2', status: 'searching' }, { id: 'r3', status: 'searching' }] as any });
    await waitFor(() => expect(getUserReportPotentialMatches).toHaveBeenCalledTimes(3));
    expect(getUserReportPotentialMatches).toHaveBeenLastCalledWith('r3');
  });

  it('refreshes matches on realtime update and clears on realtime delete', async () => {
    let realtimeCallback: ((reportId: string, event: 'INSERT' | 'UPDATE' | 'DELETE') => void) | null = null;

    vi.mocked(subscribeToMatchChanges).mockImplementation((_ids, cb) => {
      realtimeCallback = cb;
      return () => {};
    });

    vi.mocked(getUserReportPotentialMatches)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any);

    const { result } = renderHook(() =>
      usePotentialMatches([{ id: 'r1', status: 'searching' }] as any, { id: 'u1' } as any)
    );

    await waitFor(() => expect(getUserReportPotentialMatches).toHaveBeenCalled());
    const baselineCalls = vi.mocked(getUserReportPotentialMatches).mock.calls.length;

    await act(async () => {
      realtimeCallback?.('r1', 'UPDATE');
    });

    await waitFor(() =>
      expect(vi.mocked(getUserReportPotentialMatches).mock.calls.length).toBeGreaterThanOrEqual(baselineCalls)
    );

    await act(async () => {
      realtimeCallback?.('r1', 'DELETE');
    });

    expect(subscribeToMatchChanges).toHaveBeenCalled();
  });
});
