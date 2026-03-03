import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'foundit-watched-matches';

function getStoredIds(userId: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const key = userId ?? 'anon';
    return new Set(parsed[key] ?? []);
  } catch {
    return new Set();
  }
}

function saveIds(userId: string | null, ids: Set<string>) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: Record<string, string[]> = raw ? JSON.parse(raw) : {};
    const key = userId ?? 'anon';
    parsed[key] = Array.from(ids);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

export function useWatchedMatches(userId: string | null) {
  const [watchedIds, setWatchedIds] = useState<Set<string>>(() => getStoredIds(userId));

  useEffect(() => {
    setWatchedIds(getStoredIds(userId));
  }, [userId]);

  const isWatched = useCallback(
    (matchId: string) => watchedIds.has(matchId),
    [watchedIds]
  );

  const toggleWatch = useCallback(
    (matchId: string) => {
      setWatchedIds((prev) => {
        const next = new Set(prev);
        if (next.has(matchId)) {
          next.delete(matchId);
        } else {
          next.add(matchId);
        }
        saveIds(userId, next);
        return next;
      });
    },
    [userId]
  );

  return { isWatched, toggleWatch };
}
