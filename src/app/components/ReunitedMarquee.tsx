import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";

import { supabase } from "../../lib/supabase";
import { getRecentReunitedActivity, type RecentReunitedActivity } from "../../lib/database";

import { InfiniteSlider } from "@/components/ui/infinite-slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, MapPin, Sparkles } from "lucide-react";

type MetricChip = {
  kind: "metric";
  title: string;
  value: string;
  icon: React.ReactNode;
};

type ActivityChip = {
  kind: "activity";
  id: string;
  item: string;
  office: string;
  ago: string;
};

type Chip = MetricChip | ActivityChip;

export function ReunitedMarquee({ className }: { className?: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [activity, setActivity] = useState<RecentReunitedActivity[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [{ data: reunitedCount }, recent] = await Promise.all([
          supabase.rpc("count_reunited_items"),
          getRecentReunitedActivity(10),
        ]);

        if (!mounted) return;

        setCount(Number(reunitedCount) || 0);
        setActivity(recent);
      } catch {
        if (!mounted) return;
        setCount(0);
        setActivity([]);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const chips: Chip[] = useMemo(() => {
    const total = count ?? 0;
    const metricChips: MetricChip[] = [
      {
        kind: "metric",
        title: "Total reunited",
        value: total.toLocaleString(),
        icon: <CheckCircle2 className="h-4 w-4 text-primary" />,
      },
      {
        kind: "metric",
        title: "Matches powered by AI",
        value: "Smart matching",
        icon: <Sparkles className="h-4 w-4 text-sky-500" />,
      },
    ];

    const activityChips: ActivityChip[] = activity
      .filter((a) => a.updated_at)
      .slice(0, 10)
      .map((a) => {
        const officeName = a.office?.office_name ?? a.office?.building_name ?? "Office";
        return {
          kind: "activity",
          id: a.id,
          item: a.item_name ?? "Item",
          office: officeName,
          ago: formatDistanceToNowStrict(new Date(String(a.updated_at)), { addSuffix: true }),
        };
      });

    // Mix: metric, activity, metric, activity...
    const mixed: Chip[] = [];
    const max = Math.max(metricChips.length, activityChips.length);
    for (let i = 0; i < max; i++) {
      if (metricChips[i]) mixed.push(metricChips[i]);
      if (activityChips[i]) mixed.push(activityChips[i]);
    }
    return mixed.length ? mixed : metricChips;
  }, [count, activity]);

  if (count === null) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-background/35 backdrop-blur-xl shadow-lg shadow-black/10",
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-sky-500/10" />
      <div className="relative px-3 py-3">
        <InfiniteSlider gap={12} speed={70} speedOnHover={18} className="[mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          {chips.map((chip, idx) =>
            chip.kind === "metric" ? (
              <div
                key={`m-${chip.title}-${idx}`}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-card/55 px-3 py-2 backdrop-blur-md"
              >
                {chip.icon}
                <span className="text-sm font-semibold text-foreground">{chip.value}</span>
                <span className="text-xs text-muted-foreground">{chip.title}</span>
              </div>
            ) : (
              <div
                key={`a-${chip.id}-${idx}`}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-card/35 px-3 py-2 backdrop-blur-md"
              >
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">
                  <span className="font-semibold">{chip.item}</span>
                  <span className="text-muted-foreground"> · {chip.office}</span>
                </span>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                  {chip.ago}
                </Badge>
              </div>
            ),
          )}
        </InfiniteSlider>
      </div>
    </div>
  );
}

