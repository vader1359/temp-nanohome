import { Skeleton } from "@/components/ui/skeleton";

// Locale-level Suspense fallback. Other routes (news/search/catalogs/static)
// rely on this parent fallback — do NOT add per-route loading.tsx for them
// per plan T235.
export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-4 w-72" />
      <div className="mt-8 grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    </main>
  );
}