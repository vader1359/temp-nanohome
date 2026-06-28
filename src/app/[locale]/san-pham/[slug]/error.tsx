"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-xl font-semibold">Couldn&apos;t load this product</h2>
      <p className="text-sm text-muted-foreground">
        {error.digest ? `Error code: ${error.digest}` : "Please try again."}
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
