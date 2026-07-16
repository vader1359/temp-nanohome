"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { InstagramPost } from "@/lib/instagram-post";

import { InstagramGalleryPlaceholder } from "./instagram-placeholder";

const InstagramGallery = dynamic(
  () => import("./instagram").then((module) => module.InstagramGallery),
  { loading: InstagramGalleryPlaceholder, ssr: false },
);

type DeferredInstagramGalleryProps = {
  readonly posts: readonly InstagramPost[];
};

export function DeferredInstagramGallery({ posts }: DeferredInstagramGalleryProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (sentinel === null || hasEnteredViewport) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined || !entry.isIntersecting) {
        return;
      }

      setHasEnteredViewport(true);
      observer.disconnect();
    }, { rootMargin: "200px 0px" });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasEnteredViewport]);

  return hasEnteredViewport
    ? <InstagramGallery posts={posts} />
    : <div ref={sentinelRef} data-instagram-sentinel><InstagramGalleryPlaceholder /></div>;
}
