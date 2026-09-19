"use client";

import { useEffect, useState } from "react";

export function useCurrentTime(intervalMs = 1_000) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, intervalMs);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [intervalMs]);
  return now;
}
