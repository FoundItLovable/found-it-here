import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { LostItem, Match, FoundItem, ItemCategory } from '@/types';
import {
  getUserReportPotentialMatches,
  subscribeToMatchChanges,
} from '../../lib/database';

function dbFoundItemToFoundItem(row: any): FoundItem {
  const office = row.office ?? row.staff?.office;
  const normalizedImageUrl = Array.isArray(row?.image_urls)
    ? row.image_urls[0]
    : typeof row?.image_urls === 'string'
      ? row.image_urls
      : row?.image_url;
  const normalizedStatus = String(row?.status ?? '').toLowerCase();

  return {
    id: row.id,
    name: row.item_name ?? 'Unnamed item',
    description: row.description ?? '',
    category: (row.category as ItemCategory) ?? 'other',
    dateFound: row.found_date ? String(row.found_date).slice(0, 10) : row.created_at?.slice(0, 10) ?? '',
    imageUrl: normalizedImageUrl ?? undefined,
    status: normalizedStatus === 'returned' ? 'returned' : normalizedStatus === 'claimed' ? 'claimed' : 'available',
    officeId: office?.office_id ?? '',
    officeName: office?.office_name ?? 'Unknown Office',
    officeLocation: [office?.building_name, office?.office_address].filter(Boolean).join(' • ') || 'Unknown Location',
    checkedInBy: row.staff?.full_name ?? '',
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function formatPotentialMatches(reportId: string, potentialMatches: any[]): Match[] {
  return potentialMatches
    .filter((row: any) => String(row?.foundItem?.status ?? '').toLowerCase() === 'available')
    .map((row: any) => ({
      id: String(row.matchId ?? `match-${reportId}-${row.foundItemId}`),
      lostItemId: String(row.reportId ?? reportId),
      foundItemId: String(row.foundItemId),
      confidence: Number.isFinite(Number(row.confidence))
        ? Number(row.confidence)
        : Number.isFinite(Number(row.score))
          ? Math.round(Number(row.score) * 100)
          : 50,
      foundItem: dbFoundItemToFoundItem(row.foundItem),
    }));
}

export function usePotentialMatches(
  lostItems: LostItem[],
  user: User | null
): { matches: Map<string, Match[]>; loadingMatches: boolean; removeMatch: (reportId: string, foundItemId: string) => void } {
  const [matches, setMatches] = useState<Map<string, Match[]>>(new Map());
  const [loadingMatches, setLoadingMatches] = useState(false);
  // Track which reportIds we've already loaded so re-renders don't re-fetch
  const loadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || lostItems.length === 0) return;

    const allReportIds = lostItems.map((item) => item.id);
    const reportIdsToLoad = allReportIds.filter((id) => !loadedRef.current.has(id));
    if (reportIdsToLoad.length === 0) return;

    const activeReportIds = lostItems
      .filter((item) => item.status === 'searching')
      .map((item) => item.id)
      .filter((id) => reportIdsToLoad.includes(id));

    let cancelled = false;

    async function load() {
      setLoadingMatches(true);
      try {
        const initial = await Promise.all(
          reportIdsToLoad.map(async (reportId) => {
            const rows = await getUserReportPotentialMatches(reportId);
            return [reportId, formatPotentialMatches(reportId, rows)] as const;
          })
        );
        if (cancelled) return;

        setMatches((prev) => {
          const next = new Map(prev);
          for (const [id, m] of initial) next.set(id, m);
          return next;
        });
        for (const id of reportIdsToLoad) loadedRef.current.add(id);
      } catch (err) {
        if (!cancelled) console.error('[usePotentialMatches] load failed', err);
      } finally {
        if (!cancelled) setLoadingMatches(false);
      }
    }

    void load();

    // Subscribe for live updates on active reports
    const unsubscribe = subscribeToMatchChanges(
      activeReportIds,
      async (reportId, event) => {
        if (cancelled) return;
        if (event === 'DELETE') {
          setMatches((prev) => {
            const next = new Map(prev);
            next.delete(reportId);
            return next;
          });
          return;
        }
        // INSERT or UPDATE — re-fetch that report's matches
        try {
          const rows = await getUserReportPotentialMatches(reportId);
          if (cancelled) return;
          setMatches((prev) => {
            const next = new Map(prev);
            next.set(reportId, formatPotentialMatches(reportId, rows));
            return next;
          });
        } catch (err) {
          console.error('[usePotentialMatches] realtime refresh failed', err);
        }
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user, lostItems]);

  const removeMatch = (reportId: string, foundItemId: string) => {
    setMatches((prev) => {
      const next = new Map(prev);
      const current = next.get(reportId) ?? [];
      next.set(reportId, current.filter((m) => m.foundItemId !== foundItemId));
      return next;
    });
  };

  return { matches, loadingMatches, removeMatch };
}
