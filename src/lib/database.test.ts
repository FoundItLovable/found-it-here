import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFrom,
  mockAuthGetUser,
  mockAuthGetSession,
  mockStorageFrom,
  mockStorageRemove,
  mockChannel,
  mockRemoveChannel,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockAuthGetUser: vi.fn(),
  mockAuthGetSession: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockStorageRemove: vi.fn(),
  mockChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: mockAuthGetUser,
      getSession: mockAuthGetSession,
    },
    storage: {
      from: mockStorageFrom,
    },
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

import {
  createFoundItem,
  deleteImage,
  deleteLostItemReport,
  getOfficeFoundItems,
  getPublicCatalogImageUrls,
  getPublicCatalogItems,
  getUserReportPotentialMatches,
  requestUserPotentialMatchUpdate,
  subscribeToMatchChanges,
} from './database';

type QueryResult = { data?: any; error?: any; count?: number | null };

function createThenableQuery(result: QueryResult = {}) {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    or: vi.fn(() => query),
    ilike: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => query),
    limit: vi.fn(() => query),
    in: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    single: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
    then: (resolve: any, reject: any) =>
      Promise.resolve({ data: result.data ?? null, error: result.error ?? null, count: result.count ?? null }).then(
        resolve,
        reject
      ),
  };
  return query;
}

describe('database contracts', () => {
  const tableQueries = new Map<string, any>();

  beforeEach(() => {
    tableQueries.clear();
    mockFrom.mockReset();
    mockAuthGetUser.mockReset();
    mockAuthGetSession.mockReset();
    mockStorageFrom.mockReset();
    mockStorageRemove.mockReset();
    mockChannel.mockReset();
    mockRemoveChannel.mockReset();

    vi.stubGlobal('fetch', vi.fn());

    mockFrom.mockImplementation((table: string) => {
      const query = tableQueries.get(table);
      if (!query) throw new Error(`No table query registered for ${table}`);
      return query;
    });

    mockStorageFrom.mockImplementation(() => ({
      remove: mockStorageRemove,
    }));

    const channelObj = {
      on: vi.fn((_event: any, _filter: any, cb: any) => {
        (channelObj as any).__callback = cb;
        return channelObj;
      }),
      subscribe: vi.fn(() => ({ id: 'channel-1' })),
      __callback: null as any,
    };
    mockChannel.mockReturnValue(channelObj as any);
    mockRemoveChannel.mockResolvedValue(undefined);

    mockAuthGetSession.mockResolvedValue({ data: { session: { access_token: 'token-1' } } });
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'staff-1' } } });
  });

  it('getOfficeFoundItems validates required officeId', async () => {
    await expect(getOfficeFoundItems('')).rejects.toThrow('officeId is required');
  });

  it('getPublicCatalogItems applies filters and computes hasMore', async () => {
    const foundItems = createThenableQuery({ data: Array.from({ length: 24 }, (_, i) => ({ id: `item-${i}` })) });
    tableQueries.set('found_items', foundItems);

    const res = await getPublicCatalogItems(
      {
        search: 'phone',
        category: 'electronics',
        officeId: 'office-1',
        brand: 'apple',
        color: 'black',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      },
      0
    );

    expect(foundItems.or).toHaveBeenCalled();
    expect(foundItems.eq).toHaveBeenCalledWith('category', 'electronics');
    expect(foundItems.eq).toHaveBeenCalledWith('office_id', 'office-1');
    expect(foundItems.ilike).toHaveBeenCalledWith('brand', '%apple%');
    expect(foundItems.ilike).toHaveBeenCalledWith('color', '%black%');
    expect(foundItems.gte).toHaveBeenCalledWith('found_date', '2026-01-01');
    expect(foundItems.lte).toHaveBeenCalledWith('found_date', '2026-01-31');
    expect(res.items).toHaveLength(24);
    expect(res.hasMore).toBe(true);
  });

  it('getPublicCatalogImageUrls trims, filters, and de-duplicates image URLs', async () => {
    tableQueries.set(
      'found_items',
      createThenableQuery({
        data: [
          { image_urls: [' https://x/a.jpg ', 'https://x/b.jpg'] },
          { image_urls: ['https://x/a.jpg', '', '   '] },
          { image_urls: null },
        ],
      })
    );

    const urls = await getPublicCatalogImageUrls(10);
    expect(urls).toEqual(['https://x/a.jpg', 'https://x/b.jpg']);
  });

  it('createFoundItem rejects when user is unauthenticated', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });
    await expect(createFoundItem({ item_name: 'Laptop' })).rejects.toThrow('Not authenticated');
  });

  it('createFoundItem rejects when staff profile has no office_id', async () => {
    const profiles = createThenableQuery({ data: { office_id: '' } });
    tableQueries.set('profiles', profiles);

    await expect(createFoundItem({ item_name: 'Laptop' })).rejects.toThrow('Current staff profile is missing office_id');
  });

  it('createFoundItem normalizes current_location and tolerates match update failures', async () => {
    tableQueries.set('profiles', createThenableQuery({ data: { office_id: 'office-1' } }));

    const inserted = {
      id: 'item-1',
      office_id: 'office-1',
      current_location: null,
    };
    const foundItems = createThenableQuery({ data: inserted });
    tableQueries.set('found_items', foundItems);

    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const created = await createFoundItem({
      item_name: 'Laptop',
      current_location: '   ',
    });

    expect(created.id).toBe('item-1');
    expect(foundItems.insert).toHaveBeenCalledWith([
      expect.objectContaining({ office_id: 'office-1', current_location: null }),
    ]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('requestUserPotentialMatchUpdate validates report id and token', async () => {
    await expect(requestUserPotentialMatchUpdate('')).rejects.toThrow('reportId is required');

    mockAuthGetSession.mockResolvedValue({ data: { session: null } });
    await expect(requestUserPotentialMatchUpdate('report-1')).rejects.toThrow('No active access token');
  });

  it('requestUserPotentialMatchUpdate surfaces API error payload', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad request' }),
    });

    await expect(requestUserPotentialMatchUpdate('report-1')).rejects.toThrow(
      'Server user match update failed (400): bad request'
    );
  });

  it('deleteLostItemReport deletes matches first and propagates each failure path', async () => {
    const potentialMatches = createThenableQuery({ data: null, error: new Error('match delete failed') });
    const reports = createThenableQuery({ data: null, error: null });
    tableQueries.set('potential_matches', potentialMatches);
    tableQueries.set('lost_item_reports', reports);

    await expect(deleteLostItemReport('report-1')).rejects.toThrow('match delete failed');

    potentialMatches.then = (resolve: any, reject: any) =>
      Promise.resolve({ data: null, error: null }).then(resolve, reject);
    reports.then = (resolve: any, reject: any) =>
      Promise.resolve({ data: null, error: new Error('report delete failed') }).then(resolve, reject);

    await expect(deleteLostItemReport('report-1')).rejects.toThrow('report delete failed');
  });

  it('deleteImage no-ops on empty URL, throws invalid bucket, and removes decoded path', async () => {
    await expect(deleteImage('')).resolves.toBeUndefined();
    await expect(deleteImage('https://example.com/other-bucket/file.jpg')).rejects.toThrow(
      'Invalid image URL for item-images bucket'
    );

    mockStorageRemove.mockResolvedValue({ error: null });
    await deleteImage(
      'https://project.supabase.co/storage/v1/object/public/item-images/staff-1/My%20Image.jpg'
    );
    expect(mockStorageRemove).toHaveBeenCalledWith(['staff-1/My Image.jpg']);
  });

  it('getUserReportPotentialMatches returns empty when report is missing or no linked rows', async () => {
    tableQueries.set('lost_item_reports', createThenableQuery({ data: null, error: null }));
    tableQueries.set('potential_matches', createThenableQuery({ data: [] }));

    await expect(getUserReportPotentialMatches('report-1')).resolves.toEqual([]);

    tableQueries.set('lost_item_reports', createThenableQuery({ data: { id: 'report-1' }, error: null }));
    tableQueries.set('potential_matches', createThenableQuery({ data: [] }));

    await expect(getUserReportPotentialMatches('report-1')).resolves.toEqual([]);
  });

  it('getUserReportPotentialMatches hydrates office and staff metadata', async () => {
    tableQueries.set('lost_item_reports', createThenableQuery({ data: { id: 'report-1' } }));
    tableQueries.set(
      'potential_matches',
      createThenableQuery({
        data: [
          {
            match_id: 'm1',
            report_id: 'report-1',
            lost_item_id: 'item-1',
            score: 0.72,
          },
        ],
      })
    );
    tableQueries.set(
      'found_items',
      createThenableQuery({
        data: [
          {
            id: 'item-1',
            item_name: 'Phone',
            office_id: 'office-1',
            staff_id: 'staff-1',
            status: 'available',
          },
        ],
      })
    );

    let officeCallCount = 0;
    const officesQuery = createThenableQuery({ data: [{ office_id: 'office-1', office_name: 'Main Office' }] });
    const profilesQuery = createThenableQuery({
      data: [{ id: 'staff-1', full_name: 'Staff User', office_id: 'office-1' }],
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'offices') {
        officeCallCount += 1;
        return officesQuery;
      }
      if (table === 'profiles') return profilesQuery;
      const query = tableQueries.get(table);
      if (!query) throw new Error(`No table query registered for ${table}`);
      return query;
    });

    const rows = await getUserReportPotentialMatches('report-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].foundItem.office?.office_name).toBe('Main Office');
    expect(rows[0].foundItem.staff?.full_name).toBe('Staff User');
    expect(officeCallCount).toBeGreaterThan(0);
  });

  it('subscribeToMatchChanges filters report ids and unsubscribes channel', async () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToMatchChanges(['r1'], callback);

    const channelObj = mockChannel.mock.results[0]?.value as any;
    channelObj.__callback({ eventType: 'INSERT', new: { report_id: 'r1' } });
    channelObj.__callback({ eventType: 'UPDATE', new: { report_id: 'r2' } });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('r1', 'INSERT');

    unsubscribe();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
