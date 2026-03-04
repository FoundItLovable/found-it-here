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
// Threshold to appear in results: score / 1.2 >= 0.45  →  score >= 0.54

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

  it('filters out items below the 0.45 score threshold', async () => {
    // Category-only match: 0.4 / 1.2 = 0.33 — below threshold
    setFoundItems([makeFoundItem({ category: 'electronics' })]);
    const results = await findPotentialMatches({ category: 'electronics' });
    expect(results).toHaveLength(0);
  });

  it('includes items that meet the threshold (category + exact name match)', async () => {
    // category(0.4) + name exact(0.3) = 0.7 / 1.2 = 0.58 — above threshold
    setFoundItems([makeFoundItem({ category: 'electronics', item_name: 'MacBook' })]);
    const results = await findPotentialMatches({ category: 'electronics', item_name: 'MacBook' });
    expect(results).toHaveLength(1);
  });

  it('returns results sorted by score descending', async () => {
    setFoundItems([
      // Weaker: category + partial name (substring) → 0.4 + 0.8*0.3 = 0.64 / 1.2 = 0.53
      makeFoundItem({ id: 'partial', category: 'electronics', item_name: 'MacBook Pro 14' }),
      // Stronger: category + exact name → 0.4 + 0.3 = 0.7 / 1.2 = 0.58
      makeFoundItem({ id: 'exact', category: 'electronics', item_name: 'MacBook' }),
    ]);
    const results = await findPotentialMatches({ category: 'electronics', item_name: 'MacBook' });
    // exact match scores higher than partial match
    expect(results[0].id).toBe('exact');
    expect(results[1].id).toBe('partial');
  });

  it('returns at most 5 results', async () => {
    // 10 identical high-scoring items
    setFoundItems(
      Array.from({ length: 10 }, (_, i) =>
        makeFoundItem({ id: String(i), category: 'electronics', item_name: 'MacBook' })
      )
    );
    const results = await findPotentialMatches({ category: 'electronics', item_name: 'MacBook' });
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('matches category and item name case-insensitively', async () => {
    setFoundItems([makeFoundItem({ category: 'Electronics', item_name: 'MACBOOK' })]);
    const results = await findPotentialMatches({ category: 'electronics', item_name: 'macbook' });
    expect(results).toHaveLength(1);
  });

  it('scores color overlap correctly — shared color ranks higher', async () => {
    // Both items: category + exact name → baseline 0.58
    // Item with shared color also adds color score → higher rank
    setFoundItems([
      makeFoundItem({ id: 'no-color-match', category: 'electronics', item_name: 'laptop', color: 'red' }),
      makeFoundItem({ id: 'color-match',    category: 'electronics', item_name: 'laptop', color: 'silver, black' }),
    ]);
    const results = await findPotentialMatches({
      category: 'electronics',
      item_name: 'laptop',
      color: 'silver',
    });
    const colorMatchIdx    = results.findIndex((r: any) => r.id === 'color-match');
    const noColorMatchIdx  = results.findIndex((r: any) => r.id === 'no-color-match');
    expect(colorMatchIdx).toBeLessThan(noColorMatchIdx);
  });

  it('handles comma and slash separated color values', async () => {
    // lost color "blue" should match found color "red/blue"
    setFoundItems([makeFoundItem({ category: 'electronics', item_name: 'laptop', color: 'red/blue' })]);
    const results = await findPotentialMatches({
      category: 'electronics',
      item_name: 'laptop',
      color: 'blue',
    });
    expect(results).toHaveLength(1);
    expect(results[0].matchScore).toBeGreaterThan(
      // score without color bonus
      (0.4 + 0.3) / 1.2
    );
  });

  it('throws when supabase returns an error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: new Error('DB error') });
    await expect(findPotentialMatches({ category: 'electronics' })).rejects.toThrow('DB error');
  });
});
