import { httpsCallable } from "firebase/functions";
import { functions as firebaseFunctions } from "@/lib/firebase/client";
import { chunkSellerIds } from "@/lib/public-seller-presentation";
import type { PublicSellerSummary } from "@/types/marketplace";

type Pending = { resolve: (value: PublicSellerSummary | null) => void };
type CacheEntry = { value: PublicSellerSummary | null; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Pending[]>();
let scheduled = false;
const CACHE_MS = 5 * 60_000;

async function flush() {
  scheduled = false;
  const entries = [...pending.entries()];
  pending.clear();
  for (const sellerIds of chunkSellerIds(entries.map(([sellerId]) => sellerId))) {
    let values = new Map<string, PublicSellerSummary>();
    try {
      if (!firebaseFunctions) throw new Error("Seller summary service is not configured.");
      const result = await httpsCallable<{ sellerIds: string[] }, { sellers: PublicSellerSummary[] }>(firebaseFunctions, "getPublicSellerSummaries")({ sellerIds });
      values = new Map(result.data.sellers.map((seller) => [seller.uid, seller]));
    } catch {
      // Discovery remains usable when optional seller trust is unavailable.
    }
    for (const sellerId of sellerIds) {
      const value = values.get(sellerId) ?? null;
      cache.set(sellerId, { value, expiresAt: Date.now() + CACHE_MS });
      for (const request of entries.find(([entryId]) => entryId === sellerId)?.[1] ?? []) request.resolve(value);
    }
  }
}

export function getPublicSellerSummary(sellerId: string): Promise<PublicSellerSummary | null> {
  const cached = cache.get(sellerId);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  return new Promise((resolve) => {
    pending.set(sellerId, [...(pending.get(sellerId) ?? []), { resolve }]);
    if (!scheduled) { scheduled = true; queueMicrotask(() => void flush()); }
  });
}

export function clearPublicSellerSummaryCache() {
  cache.clear();
}
