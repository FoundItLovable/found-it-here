import { describe, it, expect } from 'vitest';
import {
  calcRecoveryRate,
  calcAvgTimeToClaim,
  buildCategoryData,
  calcUnclaimed,
  calcMatchRate,
} from './metrics';
import type { FoundItem } from '../app/types';
import type { ClaimRow, LostItemReportRow } from './database';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeItem = (overrides: Partial<FoundItem> = {}): FoundItem => ({
  id: 'item-1',
  name: 'Test Item',
  description: '',
  category: 'electronics',
  dateFound: '2024-01-01',
  status: 'available',
  officeId: 'office-1',
  officeName: 'Main Office',
  officeLocation: 'Building A',
  checkedInBy: 'staff-1',
  createdAt: new Date('2024-01-01').toISOString(),
  ...overrides,
});

const makeClaim = (overrides: Partial<ClaimRow> = {}): ClaimRow => ({
  id: 'claim-1',
  found_item_id: 'item-1',
  claimant_id: 'user-1',
  review_status: 'pending',
  created_at: new Date('2024-01-01').toISOString(),
  reviewed_at: null,
  ...overrides,
});

const makeLostReport = (overrides: Partial<LostItemReportRow> = {}): LostItemReportRow => ({
  id: 'report-1',
  student_id: 'user-1',
  ...overrides,
});

// ---------------------------------------------------------------------------
// calcRecoveryRate
// ---------------------------------------------------------------------------

describe('calcRecoveryRate', () => {
  it('returns 0 for empty list', () => {
    expect(calcRecoveryRate([])).toBe(0);
  });

  it('returns 0 when no items are returned', () => {
    const items = [makeItem({ status: 'available' }), makeItem({ status: 'claimed' })];
    expect(calcRecoveryRate(items)).toBe(0);
  });

  it('returns 100 when all items are returned', () => {
    const items = [makeItem({ status: 'returned' }), makeItem({ status: 'returned' })];
    expect(calcRecoveryRate(items)).toBe(100);
  });

  it('calculates correct percentage and rounds', () => {
    // 1 of 3 returned = 33.33% → rounds to 33
    const items = [
      makeItem({ status: 'returned' }),
      makeItem({ status: 'available' }),
      makeItem({ status: 'available' }),
    ];
    expect(calcRecoveryRate(items)).toBe(33);
  });
});

// ---------------------------------------------------------------------------
// calcAvgTimeToClaim
// ---------------------------------------------------------------------------

describe('calcAvgTimeToClaim', () => {
  it('returns null when there are no claims', () => {
    expect(calcAvgTimeToClaim([])).toBeNull();
  });

  it('returns null when no claims are approved', () => {
    const claims = [makeClaim({ review_status: 'pending' }), makeClaim({ review_status: 'rejected' })];
    expect(calcAvgTimeToClaim(claims)).toBeNull();
  });

  it('returns null when approved claims have no reviewed_at', () => {
    const claims = [makeClaim({ review_status: 'approved', reviewed_at: null })];
    expect(calcAvgTimeToClaim(claims)).toBeNull();
  });

  it('calculates days between created_at and reviewed_at', () => {
    const created = new Date('2024-01-01T00:00:00Z').toISOString();
    const reviewed = new Date('2024-01-04T00:00:00Z').toISOString(); // 3 days later
    const claims = [makeClaim({ review_status: 'approved', created_at: created, reviewed_at: reviewed })];
    expect(calcAvgTimeToClaim(claims)).toBe(3);
  });

  it('averages across multiple approved claims', () => {
    const base = new Date('2024-01-01T00:00:00Z');
    const after1day = new Date(base.getTime() + 1 * 86400000).toISOString();
    const after3days = new Date(base.getTime() + 3 * 86400000).toISOString();
    const claims = [
      makeClaim({ review_status: 'approved', created_at: base.toISOString(), reviewed_at: after1day }),
      makeClaim({ review_status: 'approved', created_at: base.toISOString(), reviewed_at: after3days }),
    ];
    // avg = (1 + 3) / 2 = 2.0
    expect(calcAvgTimeToClaim(claims)).toBe(2);
  });

  it('ignores non-approved claims', () => {
    const created = new Date('2024-01-01T00:00:00Z').toISOString();
    const reviewed = new Date('2024-01-03T00:00:00Z').toISOString();
    const claims = [
      makeClaim({ review_status: 'approved', created_at: created, reviewed_at: reviewed }),
      makeClaim({ review_status: 'pending' }),
      makeClaim({ review_status: 'rejected' }),
    ];
    expect(calcAvgTimeToClaim(claims)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// buildCategoryData
// ---------------------------------------------------------------------------

describe('buildCategoryData', () => {
  it('returns empty array for no items', () => {
    expect(buildCategoryData([])).toEqual([]);
  });

  it('maps raw category keys to human-readable labels', () => {
    const items = [makeItem({ category: 'electronics' })];
    const result = buildCategoryData(items);
    expect(result[0].category).toBe('Electronics');
  });

  it('counts correctly per category', () => {
    const items = [
      makeItem({ category: 'electronics' }),
      makeItem({ category: 'electronics' }),
      makeItem({ category: 'clothing' }),
    ];
    const result = buildCategoryData(items);
    const elec = result.find((r) => r.category === 'Electronics');
    const cloth = result.find((r) => r.category === 'Clothing');
    expect(elec?.count).toBe(2);
    expect(cloth?.count).toBe(1);
  });

  it('sorts by count descending', () => {
    const items = [
      makeItem({ category: 'clothing' }),
      makeItem({ category: 'electronics' }),
      makeItem({ category: 'electronics' }),
    ];
    const result = buildCategoryData(items);
    expect(result[0].category).toBe('Electronics');
    expect(result[1].category).toBe('Clothing');
  });

  it('falls back to "other" for unknown category', () => {
    const items = [makeItem({ category: 'other' })];
    const result = buildCategoryData(items);
    expect(result[0].category).toBe('Other');
  });
});

// ---------------------------------------------------------------------------
// calcUnclaimed
// ---------------------------------------------------------------------------

describe('calcUnclaimed', () => {
  it('returns zero count when no items', () => {
    expect(calcUnclaimed([])).toEqual({ count: 0, avgAgeDays: 0 });
  });

  it('returns zero count when no available items', () => {
    const items = [makeItem({ status: 'returned' }), makeItem({ status: 'claimed' })];
    expect(calcUnclaimed(items)).toEqual({ count: 0, avgAgeDays: 0 });
  });

  it('counts only available items', () => {
    const now = new Date('2024-01-11T00:00:00Z').getTime();
    const items = [
      makeItem({ status: 'available', createdAt: '2024-01-01T00:00:00Z' }),
      makeItem({ status: 'returned', createdAt: '2024-01-01T00:00:00Z' }),
    ];
    const result = calcUnclaimed(items, now);
    expect(result.count).toBe(1);
  });

  it('calculates average age in days correctly', () => {
    // Pin "now" so the result is deterministic
    const now = new Date('2024-01-11T00:00:00Z').getTime();
    const items = [
      makeItem({ status: 'available', createdAt: '2024-01-01T00:00:00Z' }), // 10 days ago
      makeItem({ status: 'available', createdAt: '2024-01-06T00:00:00Z' }), // 5 days ago
    ];
    // avg = (10 + 5) / 2 = 7.5 → rounds to 8
    const result = calcUnclaimed(items, now);
    expect(result.avgAgeDays).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// calcMatchRate
// ---------------------------------------------------------------------------

describe('calcMatchRate', () => {
  it('returns 0 when there are no lost reports', () => {
    const claims = [makeClaim({ review_status: 'approved' })];
    expect(calcMatchRate(claims, [])).toBe(0);
  });

  it('returns 0 when no claims are approved', () => {
    const claims = [makeClaim({ review_status: 'pending' })];
    const reports = [makeLostReport()];
    expect(calcMatchRate(claims, reports)).toBe(0);
  });

  it('returns 100 when approved claims equal lost reports', () => {
    const claims = [makeClaim({ review_status: 'approved' })];
    const reports = [makeLostReport()];
    expect(calcMatchRate(claims, reports)).toBe(100);
  });

  it('calculates correct percentage', () => {
    const claims = [
      makeClaim({ review_status: 'approved' }),
      makeClaim({ review_status: 'pending' }),
    ];
    const reports = [makeLostReport(), makeLostReport(), makeLostReport(), makeLostReport()];
    // 1 approved / 4 reports = 25%
    expect(calcMatchRate(claims, reports)).toBe(25);
  });
});
