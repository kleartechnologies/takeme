import {
  CATEGORY_IDS,
  destination,
  type Banner,
} from "@contracts/editorial-domain";
export const CATEGORY_LABELS: Record<string, string> = {
  electronics: "Electronics",
  fashion: "Fashion",
  "home-living": "Home & Living",
  games: "Games & Consoles",
  "toys-hobbies": "Toys & Hobbies",
  sports: "Sports & Outdoors",
  automotive: "Automotive",
  books: "Books",
  collectibles: "Collectibles",
  tools: "Tools",
  "baby-kids": "Baby & Kids",
  "tv-home-appliances": "TV & Home Appliances",
  "health-nutrition": "Health & Nutrition",
  others: "Others",
};
export const DESTINATIONS = [
  "Category",
  "Product",
  "Seller",
  "Collection",
  "Explore",
  "Custom link",
] as const;
export type DestinationType = (typeof DESTINATIONS)[number];
export function destinationType(value: string): DestinationType {
  if (value.startsWith("/explore?category=")) return "Category";
  if (/^\/listings\/[^/?]+$/.test(value)) return "Product";
  if (/^\/sellers\/[^/?]+$/.test(value)) return "Seller";
  // Collections use the existing public Home's curated products; no invented public route.
  if (value.startsWith("/#collection_")) return "Collection";
  return value === "/explore" ? "Explore" : "Custom link";
}
export function destinationLabel(value: string): string {
  if (destinationType(value) === "Category")
    return (
      CATEGORY_LABELS[
        new URL(value, "https://takeme.my").searchParams.get("category") ?? ""
      ] ?? "Category"
    );
  return destinationType(value) === "Custom link"
    ? value
    : destinationType(value);
}
export function categoryDestination(id: string): string {
  if (!CATEGORY_IDS.includes(id as (typeof CATEGORY_IDS)[number]))
    throw new Error("Choose a category.");
  return `/explore?category=${id}`;
}
export function customDestination(value: string): string {
  const v = value.trim();
  const path = v.startsWith("https://takeme.my/")
    ? v.slice("https://takeme.my".length)
    : v;
  const result = destination(path);
  if (
    !result ||
    !/^\/(?:$|explore(?:[?#]|$)|listings\/|sellers\/|categories(?:[?#]|$)|help(?:[/?#]|$)|contact(?:[?#]|$))/.test(
      result,
    )
  )
    throw new Error(
      "Use a TAKEME marketplace link, such as /explore. External links are not supported.",
    );
  return result;
}
export function readyBanner(b: Banner, paired: boolean) {
  if (!b.title.trim()) throw new Error("Give this banner a name.");
  if (!b.assetId || (paired && !b.mobileAssetId))
    throw new Error("Upload both desktop and mobile artwork.");
  if (!b.destination) throw new Error("Choose a destination.");
  return {
    ...b,
    alt: b.alt || b.title.trim(),
    ctaLabel: b.ctaLabel || "Explore",
  };
}
export function scheduleLabel(
  start: string | null | undefined,
  end: string | null | undefined,
) {
  const format = (value: string) =>
    new Intl.DateTimeFormat("en-MY", {
      timeZone: "Asia/Kuala_Lumpur",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  return start
    ? `${format(start)}${end ? " → " + format(end) : ""}`
    : "Publish now";
}
