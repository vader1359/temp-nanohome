"use client";

import { useEffect } from "react";

function getMetaPixelId(): string | null {
  const value = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  return value && /^\d+$/.test(value) ? value : null;
}

export function MetaPixel() {
  useEffect(() => {
    const pixelId = getMetaPixelId();
    if (!pixelId || typeof window.fbq === "function") return;

    const previousFbq = window.fbq;
    const script = document.createElement("script");
    script.id = "meta-pixel-init";
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.async = true;
    script.dataset.nanohomeTracker = "meta";
    document.head.append(script);

    const queue: unknown[][] = [];
    const fbq = (...args: unknown[]) => {
      queue.push(args);
    };
    window.fbq = fbq;
    window.fbq("init", pixelId);
    window.fbq("track", "PageView");

    return () => {
      script.remove();
      if (previousFbq) window.fbq = previousFbq;
      else delete window.fbq;
    };
  }, []);

  return null;
}
