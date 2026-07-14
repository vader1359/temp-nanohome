"use client";

import { useEffect } from "react";

export function useProductListScrollRestoration(storageKey: string) {
  useEffect(() => {
    const savedScrollY = window.sessionStorage.getItem(storageKey);
    const parsedScrollY = savedScrollY === null ? null : Number(savedScrollY);
    let frameId: number | undefined;

    if (parsedScrollY !== null && Number.isFinite(parsedScrollY)) {
      frameId = window.requestAnimationFrame(() => {
        window.scrollTo({ top: parsedScrollY, behavior: "auto" });
      });
    }

    const saveScrollPosition = () => {
      window.sessionStorage.setItem(storageKey, String(window.scrollY));
    };

    window.addEventListener("scroll", saveScrollPosition, { passive: true });
    window.addEventListener("pagehide", saveScrollPosition);

    return () => {
      if (frameId !== undefined) window.cancelAnimationFrame(frameId);
      saveScrollPosition();
      window.removeEventListener("scroll", saveScrollPosition);
      window.removeEventListener("pagehide", saveScrollPosition);
    };
  }, [storageKey]);
}
