import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, Clock, Package, AlertTriangle, Target, ArrowUpDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { FoundItem, ItemCategory } from '@/types';
import { categoryLabels } from '@/types';
import type { ClaimRow, LostItemReportRow } from '../../../lib/database';

interface MetricsPanelProps {
  items: FoundItem[];
  claims: ClaimRow[];
  lostReports: LostItemReportRow[];
}

/** Format a duration in milliseconds with smart units:
 *  < 48 hours → "Xh"  |  >= 48 hours → "X.Xd"
 */
function formatDuration(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 48) {
    return `${Math.round(hours)}h`;
  }
  const days = hours / 24;
  return `${Math.round(days * 10) / 10}d`;
}

export function MetricsPanel({ items, claims, lostReports }: MetricsPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [chartSortDir, setChartSortDir] = useState<'desc' | 'asc'>('desc');

  // All unique categories present in the inventory
  const availableCategories = useMemo(() => {
    const cats = new Set(items.map((i) => i.category || 'other'));
    return Array.from(cats).sort();
  }, [items]);

  // Items scoped to the selected category
  const filteredItems = useMemo(
    () =>
      selectedCategory === 'all'
        ? items
        : items.filter((i) => (i.category || 'other') === selectedCategory),
    [items, selectedCategory],
  );

  // Claims matching filtered items
  const filteredItemIds = useMemo(
    () => new Set(filteredItems.map((i) => i.id)),
    [filteredItems],
  );

  const filteredClaims = useMemo(
    () =>
      selectedCategory === 'all'
        ? claims
        : claims.filter((c) => filteredItemIds.has(c.found_item_id)),
    [claims, selectedCategory, filteredItemIds],
  );

  // ── Metric 1: Recovery Rate ──────────────────────────────────────────────
  const recoveryRate = useMemo(() => {
    if (filteredItems.length === 0) return 0;
    const returned = filteredItems.filter((i) => i.status === 'returned').length;
    return Math.round((returned / filteredItems.length) * 100);
  }, [filteredItems]);

  // ── Metric 2: Avg Time to Return (item logged → item marked returned) ────
  const avgTimeToReturn = useMemo(() => {
    const returnedItems = filteredItems.filter(
      (i) => i.status === 'returned' && i.updatedAt,
    );
    if (returnedItems.length === 0) return null;

    const totalMs = returnedItems.reduce((sum, item) => {
      const created = new Date(item.createdAt).getTime();
      const returned = new Date(item.updatedAt!).getTime();
      return sum + Math.max(0, returned - created);
    }, 0);

    return totalMs / returnedItems.length;
  }, [filteredItems]);

  // ── Metric 3: Unclaimed items ────────────────────────────────────────────
  const unclaimed = useMemo(() => {
    const available = filteredItems.filter((i) => i.status === 'available');
    if (available.length === 0) return { count: 0, avgAgeDays: 0 };

    const now = Date.now();
    const totalAge = available.reduce((sum, item) => {
      const created = new Date(item.createdAt).getTime();
      return sum + (now - created) / (1000 * 60 * 60 * 24);
    }, 0);

    return {
      count: available.length,
      avgAgeDays: Math.round(totalAge / available.length),
    };
  }, [filteredItems]);

  // ── Metric 4: Match Rate ─────────────────────────────────────────────────
  const matchRate = useMemo(() => {
    const scopedReports =
      selectedCategory === 'all'
        ? lostReports
        : lostReports.filter((r) => (r.category || 'other') === selectedCategory);
    if (scopedReports.length === 0) return 0;
    const approved = filteredClaims.filter((c) => c.review_status === 'approved').length;
    return Math.round((approved / scopedReports.length) * 100);
  }, [filteredClaims, lostReports, selectedCategory]);

  // ── Category chart data ──────────────────────────────────────────────────
  const categoryData = useMemo(() => {
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
      .sort((a, b) =>
        chartSortDir === 'desc' ? b.count - a.count : a.count - b.count,
      );
  }, [items, chartSortDir]);

  const chartConfig = {
    count: {
      label: 'Items',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <div className="space-y-6">
      {/* Category filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
          Filter by category:
        </span>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {availableCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {categoryLabels[cat as ItemCategory] || cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCategory !== 'all' && (
          <span className="text-xs text-muted-foreground italic">
            Metrics scoped to{' '}
            <strong>{categoryLabels[selectedCategory as ItemCategory] || selectedCategory}</strong>
          </span>
        )}
      </div>

      {/* Top row: 4 metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Recovery Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/15">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recoveryRate}%</p>
                <p className="text-xs text-muted-foreground">Recovery Rate</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Items successfully returned to owners
            </p>
          </CardContent>
        </Card>

        {/* Avg Time to Return */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/15">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {avgTimeToReturn !== null ? formatDuration(avgTimeToReturn) : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">Avg Time to Return</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Average time from item logged to returned
            </p>
          </CardContent>
        </Card>

        {/* Unclaimed Items */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/15">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unclaimed.count}</p>
                <p className="text-xs text-muted-foreground">Unclaimed Items</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {unclaimed.count > 0
                ? `Avg age: ${unclaimed.avgAgeDays} days`
                : 'No unclaimed items'}
            </p>
          </CardContent>
        </Card>

        {/* Match Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/15">
                <Target className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{matchRate}%</p>
                <p className="text-xs text-muted-foreground">Match Rate</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Lost reports matched to found items
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Package className="w-4 h-4" />
              Items by Category
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setChartSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            >
              <ArrowUpDown className="w-3 h-3" />
              {chartSortDir === 'desc' ? 'Most first' : 'Least first'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {categoryData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={categoryData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="category" width={100} tick={{ fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
              No items to display
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
