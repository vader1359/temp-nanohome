"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

function PageViewTrackerInner() {
  const pathname = usePathname();
  const skippedInitialRender = useRef(false);

  useEffect(() => {
    if (!skippedInitialRender.current) {
      skippedInitialRender.current = true;
      return;
    }
    if (typeof window.fbq !== "function") return;
    window.fbq("track", "PageView", { path: pathname });
  }, [pathname]);

  return null;
}

export function MetaPageViewTracker() {
  return <Suspense fallback={null}><PageViewTrackerInner /></Suspense>;
}
