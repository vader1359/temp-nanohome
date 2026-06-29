import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-white" aria-busy="true" aria-label="Loading products">
      <div className="h-16 border-b" />
      <div className="site-shell py-8">
        <Skeleton className="mb-6 h-8 w-40" />
        <div className="flex gap-6">
          <Skeleton className="hidden h-96 w-64 md:block" />
          <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
