import type { ListingCondition, ListingInput } from "@/types/marketplace";

export const MAX_LISTING_IMAGES = 8;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const LISTING_CONDITIONS: ListingCondition[] = ["New", "Like new", "Good", "Fair"];

export function normalizeSearch(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ");
}

export function createSearchTokens(title: string) {
  const normalized = normalizeSearch(title);
  const words = normalized.split(" ").filter(Boolean);
  const tokens = new Set<string>();
  for (const word of words) {
    for (let length = 2; length <= Math.min(word.length, 20); length += 1) tokens.add(word.slice(0, length));
  }
  for (let length = 2; length <= Math.min(normalized.length, 40); length += 1) tokens.add(normalized.slice(0, length));
  return Array.from(tokens).slice(0, 100);
}

export interface ListingFacetInput {
  categoryId?: string;
  condition?: string;
  listingType?: string;
  location?: string;
}

export function createFacetKey(filters: ListingFacetInput) {
  return [filters.categoryId || "*", filters.condition || "*", filters.listingType || "*", normalizeSearch(filters.location || "") || "*"].join("|");
}

export function createFacetKeys(input: Required<ListingFacetInput>) {
  const values = [input.categoryId, input.condition, input.listingType, normalizeSearch(input.location)];
  const keys = new Set<string>();
  for (let mask = 0; mask < 16; mask += 1) keys.add(values.map((value, index) => mask & (1 << index) ? value : "*").join("|"));
  return Array.from(keys);
}

export function validateListingInput(input: ListingInput) {
  const errors: string[] = [];
  if (input.title.trim().length < 6 || input.title.trim().length > 80) errors.push("Title must be between 6 and 80 characters.");
  if (input.description.trim().length < 20 || input.description.trim().length > 1200) errors.push("Description must be between 20 and 1,200 characters.");
  if (!input.categoryId.trim()) errors.push("Category is required.");
  if (!LISTING_CONDITIONS.includes(input.condition)) errors.push("Condition is invalid.");
  if (!Number.isFinite(input.price) || input.price <= 0 || input.price > 10_000_000) errors.push("Price must be a positive amount.");
  if (input.listingType !== "buy_now") errors.push("Auctions are not available in Phase 2.");
  if (input.location.trim().length < 2 || input.location.trim().length > 120) errors.push("Location must be between 2 and 120 characters.");
  return errors;
}

export function validateImageFiles(files: File[]) {
  if (files.length < 1) return ["Add at least one image."];
  if (files.length > MAX_LISTING_IMAGES) return [`Add no more than ${MAX_LISTING_IMAGES} images.`];
  const errors: string[] = [];
  for (const file of files) {
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) errors.push(`${file.name} is not a JPEG, PNG, or WebP image.`);
    if (file.size > MAX_IMAGE_BYTES) errors.push(`${file.name} is larger than 8 MB.`);
  }
  return errors;
}
