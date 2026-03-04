import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export function ReunitedTicker() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { count: reunited } = await supabase
          .from('found_items')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'returned');
        setCount(reunited ?? 0);
      } catch {
        setCount(0);
      }
    };
    void fetchCount();
  }, []);

  if (count === null) return null;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border/50 bg-muted/80 dark:bg-muted/60 py-3 px-4 shadow-sm">
      <div className="flex w-[300%] animate-marquee whitespace-nowrap">
        <span className="mx-8 text-sm text-muted-foreground">
          <span className="font-semibold text-primary">{count.toLocaleString()}</span>
          {' '}items reunited with their owners
        </span>
        <span className="mx-8 text-sm text-muted-foreground">
          <span className="font-semibold text-primary">{count.toLocaleString()}</span>
          {' '}items reunited with their owners
        </span>
        <span className="mx-8 text-sm text-muted-foreground">
          <span className="font-semibold text-primary">{count.toLocaleString()}</span>
          {' '}items reunited with their owners
        </span>
      </div>
    </div>
  );
}
