"use client";

import { useEffect } from "react";

export function ClarityTracker() {
  useEffect(() => {
    const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID?.trim();
    if (!clarityId || clarityId === "clarity_id_placeholder") return;

    const script = document.createElement("script");
    script.id = "microsoft-clarity";
    script.src = `https://www.clarity.ms/tag/${clarityId}`;
    script.async = true;
    script.dataset.nanohomeTracker = "clarity";
    document.head.append(script);

    return () => script.remove();
  }, []);

  return null;
}
