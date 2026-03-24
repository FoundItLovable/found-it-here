import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures mockOrder is available inside the vi.mock factory,
// which is hoisted to the top of the file by Vitest's transformer.
const { mockOrder } = vi.hoisted(() => ({ mockOrder: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: mockOrder,
        }),
      }),
    }),
  },
}));

import { findPotentialMatches } from './database';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Weights: category=0.4, name=0.3, color=0.15, brand=0.15, location=0.1, desc=0.1
// totalWeights always = 1.2 regardless of which fields are present.
// Threshold to appear in results: score / 1.2 >= 0.65  -> score >= 0.78

const makeFoundItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'found-1',
  item_name: null,
  category: null,
  color: null,
  brand: null,
  found_location: null,
  description: null,
  status: 'available',
  created_at: new Date().toISOString(),
  ...overrides,
});

const setFoundItems = (items: ReturnType<typeof makeFoundItem>[]) => {
  mockOrder.mockResolvedValue({ data: items, error: null });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('findPotentialMatches', () => {
  beforeEach(() => {
    mockOrder.mockReset();
  });

  it('returns empty array when no found items exist', async () => {
    setFoundItems([]);
    const results = await findPotentialMatches({ category: 'electronics' });
    expect(results).toHaveLength(0);
  });

  it('filters out items below the 0.65 score threshold', async () => {
    // Category-only match: 0.4 / 1.2 = 0.33 — below threshold
    setFoundItems([makeFoundItem({ category: 'electronics' })]);
    const results = await findPotentialMatches({ category: 'electronics' });
    expect(results).toHaveLength(0);
  });

  it('includes items that meet the threshold', async () => {
    // category(0.4) + name(0.3) + brand(0.15) + color overlap(0.15) = 1.0 / 1.2 = 0.833
    setFoundItems([makeFoundItem({ category: 'electronics', item_name: 'MacBook', brand: 'Apple', color: 'silver' })]);
    const results = await findPotentialMatches({ category: 'electronics', item_name: 'MacBook', brand: 'Apple', color: 'silver' });
    expect(results).toHaveLength(1);
  });

  it('returns results sorted by score descending', async () => {
    setFoundItems([
      // Weaker but above threshold: category + name + brand = 0.85 / 1.2 = 0.708
      makeFoundItem({ id: 'weaker', category: 'electronics', item_name: 'MacBook', brand: 'Apple', color: 'black' }),
      // Stronger: adds color overlap bonus = 1.0 / 1.2 = 0.833
      makeFoundItem({ id: 'stronger', category: 'electronics', item_name: 'MacBook', brand: 'Apple', color: 'silver' }),
    ]);
    const results = await findPotentialMatches({ category: 'electronics', item_name: 'MacBook', brand: 'Apple', color: 'silver' });
    expect(results[0].id).toBe('stronger');
    expect(results[1].id).toBe('weaker');
  });

  it('returns at most 5 results', async () => {
    // 10 identical high-scoring items
    setFoundItems(
      Array.from({ length: 10 }, (_, i) =>
        makeFoundItem({ id: String(i), category: 'electronics', item_name: 'MacBook', brand: 'Apple', color: 'silver' })
      )
    );
    const results = await findPotentialMatches({ category: 'electronics', item_name: 'MacBook', brand: 'Apple', color: 'silver' });
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('matches category and item name case-insensitively', async () => {
    setFoundItems([makeFoundItem({ category: 'Electronics', item_name: 'MACBOOK', brand: 'APPLE', color: 'SILVER' })]);
    const results = await findPotentialMatches({ category: 'electronics', item_name: 'macbook', brand: 'apple', color: 'silver' });
    expect(results).toHaveLength(1);
  });

  it('scores color overlap correctly — shared color ranks higher', async () => {
    // Both items: category + exact name + exact brand -> baseline 0.708
    // Item with shared color also adds color score -> higher rank
    setFoundItems([
      makeFoundItem({ id: 'no-color-match', category: 'electronics', item_name: 'laptop', brand: 'dell', color: 'red' }),
      makeFoundItem({ id: 'color-match',    category: 'electronics', item_name: 'laptop', brand: 'dell', color: 'silver, black' }),
    ]);
    const results = await findPotentialMatches({
      category: 'electronics',
      item_name: 'laptop',
      brand: 'dell',
      color: 'silver',
    });
    const colorMatchIdx    = results.findIndex((r: any) => r.id === 'color-match');
    const noColorMatchIdx  = results.findIndex((r: any) => r.id === 'no-color-match');
    expect(colorMatchIdx).toBeLessThan(noColorMatchIdx);
  });

  it('handles comma and slash separated color values', async () => {
    // lost color "blue" should match found color "red/blue"
    setFoundItems([makeFoundItem({ category: 'electronics', item_name: 'laptop', brand: 'dell', color: 'red/blue' })]);
    const results = await findPotentialMatches({
      category: 'electronics',
      item_name: 'laptop',
      brand: 'dell',
      color: 'blue',
    });
    expect(results).toHaveLength(1);
    expect(results[0].matchScore).toBeGreaterThan(
      // score without color bonus
      (0.4 + 0.3 + 0.15) / 1.2
    );
  });

  it('throws when supabase returns an error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: new Error('DB error') });
    await expect(findPotentialMatches({ category: 'electronics' })).rejects.toThrow('DB error');
  });
});
