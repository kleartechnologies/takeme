"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Keep optional discovery reads off the initial path; begin before they enter view. */
export function DeferredMarketplace({ children }: { children: ReactNode }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!anchor.current) return;
    if (typeof IntersectionObserver !== "function") {
      const timer = window.setTimeout(() => setReady(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setReady(true); observer.disconnect(); }
    }, { rootMargin: "400px" });
    observer.observe(anchor.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={anchor}>{ready ? children : <div className="min-h-40" aria-hidden="true" />}</div>;
}
