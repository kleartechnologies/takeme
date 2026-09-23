import type { PublicSellerSummary } from "../types/marketplace.ts";

export function chunkSellerIds(ids: string[], limit = 40) {
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += limit) chunks.push(unique.slice(index, index + limit));
  return chunks;
}

export function sellerRatingLabel(summary: PublicSellerSummary) {
  return summary.sellerReviewCount > 0 && summary.sellerRating !== null
    ? `${summary.sellerRating.toFixed(1)} ★ (${summary.sellerReviewCount})`
    : "New seller";
}

export function completedSalesLabel(count: number) {
  return `${count >= 100 ? "100+" : Math.max(0, count)} ${count === 1 ? "sale" : "sales"}`;
}
