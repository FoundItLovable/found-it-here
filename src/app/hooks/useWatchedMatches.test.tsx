import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWatchedMatches } from './useWatchedMatches';

describe('useWatchedMatches', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('falls back to empty set when localStorage JSON is invalid', () => {
    localStorage.setItem('foundit-watched-matches', '{not-json');

    const { result } = renderHook(() => useWatchedMatches('user-1'));
    expect(result.current.isWatched('m1')).toBe(false);
  });

  it('keeps anon and user storage keys isolated', () => {
    const { result, rerender } = renderHook(({ userId }) => useWatchedMatches(userId), {
      initialProps: { userId: null as string | null },
    });

    act(() => {
      result.current.toggleWatch('match-anon');
    });
    expect(result.current.isWatched('match-anon')).toBe(true);

    rerender({ userId: 'user-1' });
    expect(result.current.isWatched('match-anon')).toBe(false);

    act(() => {
      result.current.toggleWatch('match-user');
    });
    expect(result.current.isWatched('match-user')).toBe(true);

    rerender({ userId: null });
    expect(result.current.isWatched('match-anon')).toBe(true);
    expect(result.current.isWatched('match-user')).toBe(false);
  });

  it('persists toggled values in localStorage', () => {
    const { result } = renderHook(() => useWatchedMatches('user-1'));

    act(() => {
      result.current.toggleWatch('m1');
    });

    const raw = localStorage.getItem('foundit-watched-matches');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toEqual(
      expect.objectContaining({ 'user-1': ['m1'] })
    );

    act(() => {
      result.current.toggleWatch('m1');
    });

    expect(result.current.isWatched('m1')).toBe(false);
  });
});
