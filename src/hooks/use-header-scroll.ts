"use client";

import { useState, useEffect, useRef } from "react";

export function useHeaderScroll() {
  const [isCompact, setIsCompact] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const isCompactRef = useRef(false);
  const scrollAccRef = useRef(0);
  const lastScrollRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastStateChangeRef = useRef<number>(0);

  useEffect(() => {
    // Check initial desktop state
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkIsDesktop();
    
    // Add resize listener to update desktop state
    let resizeTimer: number;
    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(checkIsDesktop, 100);
    };
    window.addEventListener("resize", handleResize);

    // Initialize
    lastScrollRef.current = window.scrollY;

    const setCompactState = (val: boolean) => {
      if (isCompactRef.current !== val) {
        setIsCompact(val);
        isCompactRef.current = val;
        lastStateChangeRef.current = Date.now();
      }
    };

    const handleScroll = () => {
      const currentScroll = window.scrollY;
      const diff = currentScroll - lastScrollRef.current;
      
      // Update last scroll immediately for next frame
      lastScrollRef.current = currentScroll;
      
      const now = Date.now();
      if (now - lastStateChangeRef.current < 400) {
        scrollAccRef.current = 0;
        rafRef.current = null;
        return;
      }
      
      if (currentScroll <= 50) {
        setCompactState(false);
        scrollAccRef.current = 0;
      } else {
        if (diff > 0) {
          // Scrolling down: accumulate until threshold of 100px
          if (scrollAccRef.current < 0) {
            scrollAccRef.current = 0;
          }
          scrollAccRef.current += diff;
          if (scrollAccRef.current > 100) {
            setCompactState(true);
            scrollAccRef.current = 0;
          }
        } else if (diff < 0) {
          // Scrolling up (reverse scroll): immediately appear
          setCompactState(false);
          scrollAccRef.current = 0;
        }
      }
      
      rafRef.current = null;
    };

    const onScroll = () => {
      if (!rafRef.current) {
        rafRef.current = window.requestAnimationFrame(handleScroll);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", handleResize);
      window.clearTimeout(resizeTimer);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Only apply compact mode on desktop (lg breakpoint = 1024px)
  return { isCompact: isCompact && isDesktop, isDesktop };
}
