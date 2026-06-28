import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex flex-col" aria-busy="true" aria-label="Loading product">
      <div className="flex flex-col gap-8 px-4 py-10 md:flex-row">
        <Skeleton className="h-96 w-full md:w-1/2" />
        <div className="flex flex-col gap-4 md:w-1/2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <Skeleton className="mx-4 my-10 h-px w-[calc(100%-2rem)]" />
      <Skeleton className="mx-4 h-40 w-[calc(100%-2rem)]" />
    </main>
  );
}
