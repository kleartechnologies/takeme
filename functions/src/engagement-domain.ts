import { createHash } from "node:crypto";

export type SearchCriteria = {
  query: string;
  category: string;
  condition: string;
  type: string;
  auction: string;
  price: number | null;
  location: string;
  sort: "newest" | "price_low" | "price_high";
};

const categories = new Set(["electronics", "fashion", "home-living", "games", "toys-hobbies", "sports", "automotive", "books", "collectibles", "tools", "baby-kids", "tv-home-appliances", "health-nutrition", "others"]);

/** Legacy records cannot invent a category through coercion or a default. */
export function listingCategoryId(value: unknown): string | null {
  return typeof value === "string" && categories.has(value) ? value : null;
}

export function newListingSearchCategories(listing: Record<string, unknown> | undefined): string[] {
  if (listing?.status !== "active") return [];
  const category = listingCategoryId(listing.categoryId);
  return category ? [category, "*"] : ["*"];
}

export function stableId(...parts: string[]) {
  return createHash("sha256").update(parts.join("|")) .digest("hex");
}

export function priceSen(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const sen = Math.round(value * 100);
  return Number.isSafeInteger(sen) && sen <= 1_000_000_000 && Math.abs(value * 100 - sen) < 0.000001 ? sen : null;
}

export function normalizeSearch(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ");
}

export function parseSearch(value: unknown): SearchCriteria {
  if (!value || typeof value !== "object") throw new Error("Search filters are required.");
  const data = value as Record<string, unknown>;
  const str = (field: string, max: number) => {
    const item = data[field] ?? "";
    if (typeof item !== "string" || item.trim().length > max) throw new Error(`${field} is invalid.`);
    return item.trim();
  };
  const query = str("query", 80);
  if (query && normalizeSearch(query).length < 2) throw new Error("Search text must contain at least two searchable characters.");
  const category = str("category", 60);
  if (category && !categories.has(category)) throw new Error("Category is invalid.");
  const condition = str("condition", 20);
  const type = str("type", 30);
  const auction = str("auction", 20);
  const location = str("location", 120);
  const sort = str("sort", 20) || "newest";
  if (condition && !["New", "Like new", "Good", "Fair"].includes(condition)) throw new Error("Condition is invalid.");
  if (type && !["buy_now", "auction"].includes(type)) throw new Error("Listing type is invalid.");
  if (auction && (!["active", "scheduled"].includes(auction) || type !== "auction")) throw new Error("Auction filter is invalid.");
  if (!["newest", "price_low", "price_high"].includes(sort)) throw new Error("Sort is invalid.");
  const price = data.price === "" || data.price == null ? null : Number(data.price);
  if (price !== null && (priceSen(price) === null || price > 10_000_000)) throw new Error("Maximum price is invalid.");
  if (![query, category, condition, type, auction, price, location].some(Boolean)) throw new Error("Choose a query or filter to save.");
  return { query, category, condition, type, auction, price, location, sort: sort as SearchCriteria["sort"] };
}

export function matchesSearch(criteria: SearchCriteria, listing: Record<string, unknown>) {
  if (listing.status !== "active") return false;
  if (criteria.category && listing.categoryId !== criteria.category) return false;
  if (criteria.condition && listing.condition !== criteria.condition) return false;
  if (criteria.type && listing.listingType !== criteria.type) return false;
  if (criteria.auction && listing.auctionStatus !== criteria.auction) return false;
  if (criteria.price !== null && (typeof listing.price !== "number" || listing.price > criteria.price)) return false;
  if (criteria.location && !normalizeSearch(String(listing.location ?? "")).includes(normalizeSearch(criteria.location))) return false;
  const token = normalizeSearch(criteria.query).slice(0, 40);
  return !criteria.query || token.length >= 2 && Array.isArray(listing.searchTokens) && listing.searchTokens.includes(token);
}
