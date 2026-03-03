import { Skeleton } from "@/components/ui/skeleton";

export function MatchCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-card">
      <div className="flex flex-col sm:flex-row">
        <Skeleton className="sm:w-36 h-36 flex-shrink-0 rounded-none" />
        <div className="flex-1 p-4 space-y-3">
          <div>
            <Skeleton className="h-5 w-2/3 mb-2" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-9 flex-1 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
