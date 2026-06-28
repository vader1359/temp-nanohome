import { Skeleton } from "@/components/ui/skeleton";

// PDP (product detail page) route-specific Suspense fallback.
export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col gap-6 p-8">
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
    </main>
  );
}