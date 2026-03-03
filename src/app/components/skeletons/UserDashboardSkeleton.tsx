import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/Logo";

export function UserDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-white/20 bg-background/40 backdrop-blur-2xl shadow-lg shadow-black/5">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </header>

      <section className="relative py-16 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto space-y-4">
            <Skeleton className="h-6 w-32 mx-auto" />
            <Skeleton className="h-12 w-full max-w-md mx-auto" />
            <Skeleton className="h-6 w-3/4 mx-auto" />
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-center mb-8">
          <Skeleton className="h-14 w-80 rounded-xl" />
        </div>
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </main>
    </div>
  );
}
