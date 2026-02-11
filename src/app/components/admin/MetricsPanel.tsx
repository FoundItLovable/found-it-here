import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, Clock, Package, AlertTriangle, Target } from 'lucide-react';
import type { FoundItem, ItemCategory } from '@/types';
import { categoryLabels } from '@/types';
import type { ClaimRow, LostItemReportRow } from '../../../lib/database';

interface MetricsPanelProps {
  items: FoundItem[];
  claims: ClaimRow[];
  lostReports: LostItemReportRow[];
}

export function MetricsPanel({ items, claims, lostReports }: MetricsPanelProps) {
  const recoveryRate = useMemo(() => {
    if (items.length === 0) return 0;
    const returned = items.filter((i) => i.status === 'returned').length;
    return Math.round((returned / items.length) * 100);
  }, [items]);

  const avgTimeToClaim = useMemo(() => {
    const approvedClaims = claims.filter((c) => c.review_status === 'approved' && c.reviewed_at);
    if (approvedClaims.length === 0) return null;

    const totalDays = approvedClaims.reduce((sum, claim) => {
      const created = new Date(claim.created_at!).getTime();
      const reviewed = new Date(claim.reviewed_at!).getTime();
      return sum + (reviewed - created) / (1000 * 60 * 60 * 24);
    }, 0);

    return Math.round((totalDays / approvedClaims.length) * 10) / 10;
  }, [claims]);

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
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const unclaimed = useMemo(() => {
    const available = items.filter((i) => i.status === 'available');
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
  }, [items]);

  const matchRate = useMemo(() => {
    if (lostReports.length === 0) return 0;
    const approved = claims.filter((c) => c.review_status === 'approved').length;
    return Math.round((approved / lostReports.length) * 100);
  }, [claims, lostReports]);

  const chartConfig = {
    count: {
      label: 'Items',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <div className="space-y-6">
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

        {/* Avg Time to Claim */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/15">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {avgTimeToClaim !== null ? `${avgTimeToClaim}d` : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">Avg Time to Claim</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Average days from claim to approval
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
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Package className="w-4 h-4" />
            Items by Category
          </CardTitle>
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
