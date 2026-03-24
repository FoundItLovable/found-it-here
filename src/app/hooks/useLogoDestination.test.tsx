import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/auth', () => ({
  getCurrentUserWithProfile: vi.fn(),
}));

import { getCurrentUserWithProfile } from '../../lib/auth';
import { useLogoDestination } from './useLogoDestination';

describe('useLogoDestination', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUserWithProfile).mockReset();
  });

  it('returns landing path for guest users', async () => {
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue(null as any);

    const { result } = renderHook(() => useLogoDestination());
    await waitFor(() => expect(result.current).toBe('/'));
  });

  it('returns admin path for staff-like roles', async () => {
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue({
      profile: { role: 'admin' },
    } as any);

    const { result } = renderHook(() => useLogoDestination());
    await waitFor(() => expect(result.current).toBe('/admin'));
  });

  it('returns dashboard path for student users', async () => {
    vi.mocked(getCurrentUserWithProfile).mockResolvedValue({
      profile: { role: 'student' },
    } as any);

    const { result } = renderHook(() => useLogoDestination());
    await waitFor(() => expect(result.current).toBe('/dashboard'));
  });
});
