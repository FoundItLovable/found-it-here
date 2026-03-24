import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTypewriterPlaceholder } from './useTypewriterPlaceholder';

describe('useTypewriterPlaceholder', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns fallback when phrase list is empty', () => {
    const { result } = renderHook(() => useTypewriterPlaceholder([]));
    expect(result.current).toBe('Search items...');
  });

  it('cycles through phrases over time', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useTypewriterPlaceholder(['AirPods', 'Keys']));
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current).not.toBe(initial);
    expect(result.current.length).toBeGreaterThan(0);
  });
});
