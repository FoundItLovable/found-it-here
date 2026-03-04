import type { FoundItem, ItemCategory } from '../app/types';
import { categoryLabels } from '../app/types';
import type { ClaimRow, LostItemReportRow } from './database';

export function calcRecoveryRate(items: FoundItem[]): number {
  if (items.length === 0) return 0;
  const returned = items.filter((i) => i.status === 'returned').length;
  return Math.round((returned / items.length) * 100);
}

export function calcAvgTimeToClaim(claims: ClaimRow[]): number | null {
  const approved = claims.filter((c) => c.review_status === 'approved' && c.reviewed_at);
  if (approved.length === 0) return null;
  const totalDays = approved.reduce((sum, claim) => {
    const created = new Date(claim.created_at!).getTime();
    const reviewed = new Date(claim.reviewed_at!).getTime();
    return sum + (reviewed - created) / (1000 * 60 * 60 * 24);
  }, 0);
  return Math.round((totalDays / approved.length) * 10) / 10;
}

export function buildCategoryData(items: FoundItem[]): { category: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const cat = item.category || 'other';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([category, count]) => ({
      category: categoryLabels[category as ItemCategory] || category,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

// now is injectable so tests can pin the current time
export function calcUnclaimed(
  items: FoundItem[],
  now = Date.now()
): { count: number; avgAgeDays: number } {
  const available = items.filter((i) => i.status === 'available');
  if (available.length === 0) return { count: 0, avgAgeDays: 0 };
  const totalAge = available.reduce((sum, item) => {
    const created = new Date(item.createdAt).getTime();
    return sum + (now - created) / (1000 * 60 * 60 * 24);
  }, 0);
  return {
    count: available.length,
    avgAgeDays: Math.round(totalAge / available.length),
  };
}

export function calcMatchRate(claims: ClaimRow[], lostReports: LostItemReportRow[]): number {
  if (lostReports.length === 0) return 0;
  const approved = claims.filter((c) => c.review_status === 'approved').length;
  return Math.round((approved / lostReports.length) * 100);
}
