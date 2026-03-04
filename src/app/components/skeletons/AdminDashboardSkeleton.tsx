import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/Logo";

export function AdminDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-white/20 bg-background/40 backdrop-blur-2xl shadow-lg shadow-black/5">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Logo size="sm" />
            <Skeleton className="h-5 w-12 rounded" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </header>

      <section className="border-b border-border/50 bg-muted/20">
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-7 w-10" />
                  <Skeleton className="h-3 w-14" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-[140px] rounded-lg" />
            <Skeleton className="h-10 w-[120px] rounded-lg" />
            <Skeleton className="h-10 w-[110px] rounded-lg" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-lg border border-border/50 overflow-hidden">
              <div className="flex gap-3 p-3">
                <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-5 w-16 rounded" />
                    <Skeleton className="h-5 w-20 rounded" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
