"use client";

import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

// Root-level error boundary. Wraps the root layout's children (not the root
// layout itself — global-error.tsx handles that). Keep styling to shadcn +
// Tailwind utilities only; no error tracking integration per plan T236.
export default function Error({ error, unstable_retry }: ErrorProps) {
  console.error("app-error:", error);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground">
        Please try again. If the error persists, reload the page.
      </p>
      <Button onClick={() => unstable_retry()} variant="default">
        Try again
      </Button>
    </main>
  );
}