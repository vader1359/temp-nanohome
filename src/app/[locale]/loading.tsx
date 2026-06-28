import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-white" aria-busy="true" aria-label="Loading">
      <div className="h-16 border-b" />
      <Skeleton className="h-[60vh] w-full rounded-none" />
      <div className="px-4 py-10">
        <Skeleton className="mx-auto mb-8 h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
