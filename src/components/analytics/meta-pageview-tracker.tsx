"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

function PageViewTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const skippedInitialRender = useRef(false);

  useEffect(() => {
    if (!skippedInitialRender.current) {
      skippedInitialRender.current = true;
      return;
    }
    if (typeof window.fbq !== "function") return;
    const url = searchParams.toString() ? `${pathname}?${searchParams}` : pathname;
    window.fbq("track", "PageView", { url });
  }, [pathname, searchParams]);

  return null;
}

export function MetaPageViewTracker() {
  return <Suspense fallback={null}><PageViewTrackerInner /></Suspense>;
}
