"use client";

import { useEffect, useState } from "react";
import { nextAuctionBoundary } from "@/lib/auction-time-boundary";
import type { Listing } from "@/types/marketplace";

/** Update status at start/urgency/end, leaving second ticks inside the countdown. */
export function useAuctionTime(listing: Listing) {
  const [now, setNow] = useState(0);
  const { listingType, auctionStatus, auctionStartAt, auctionEndAt } = listing;
  useEffect(() => {
    if (listingType === "buy_now") return;
    let timer: number;
    const update = () => {
      const time = Date.now();
      setNow(time);
      const boundary = nextAuctionBoundary({ listingType, auctionStatus, auctionStartAt, auctionEndAt }, time);
      if (boundary !== null) timer = window.setTimeout(update, Math.min(boundary - time + 1, 2_147_483_647));
    };
    timer = window.setTimeout(update, 0);
    const visible = () => { if (document.visibilityState === "visible") { window.clearTimeout(timer); update(); } };
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, [listingType, auctionStatus, auctionStartAt, auctionEndAt]);
  return now;
}
