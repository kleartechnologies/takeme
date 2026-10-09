import { listingMediaBucket, readyMedia, storageMediaUrl, type ReadyMedia } from "../../functions/src/listing-media-domain.ts";
export type ListingMedia = ReadyMedia & { coverOrder: number };
/** Resolve a retained owner image without accepting arbitrary URL/path inputs. */
export function retainedListingMedia(listing: { sellerId: string; imageUrls: string[]; mediaImages?: ListingMedia[] }, url: string, projectId: string) {
  if (!listing.imageUrls.includes(url)) return null;
  try {
    const bucket = listingMediaBucket(projectId);
    for (const item of listing.mediaImages ?? []) {
      const media = readyMedia(item, listing.sellerId);
      if (media && url === storageMediaUrl(bucket, media.detailPath)) return media;
    }
  } catch { /* Unpinned projects never resolve private media. */ }
  return null;
}
export function parseListingMedia(value: unknown, uid: string): ListingMedia[] {
  if (!Array.isArray(value) || value.length > 8) return [];
  const items = value.flatMap(item => {
    const parsed = readyMedia(item, uid);
    return parsed && Number.isInteger(item.coverOrder) && item.coverOrder >= 0 && item.coverOrder < 8 ? [{ ...parsed, coverOrder: item.coverOrder as number }] : [];
  });
  return new Set(items.map(i => i.imageId)).size === items.length ? items.sort((a,b) => a.coverOrder-b.coverOrder) : [];
}
/** Legacy URLs continue to work. New references must match the exact listing/owner path. */
export function listingImage(listing: { imageUrls: string[]; mediaImages?: ListingMedia[] }, size: "thumbnail" | "card" | "detail" = "card", index = 0) {
  const legacy = listing.imageUrls[index];
  const media = listing.mediaImages?.find(m => m.coverOrder === index);
  if (!media || !legacy) return legacy;
  try {
    const url = new URL(legacy), bucket = /^\/v0\/b\/([^/]+)\/o\//.exec(url.pathname)?.[1];
    if (!bucket || url.origin !== "https://firebasestorage.googleapis.com" || decodeURIComponent(url.pathname.split("/o/")[1]) !== media.detailPath) return legacy;
    const canonical = storageMediaUrl(bucket, media[`${size}Path`]);
    // Only an explicitly pinned demo project can resolve canonical references
    // through the local emulator. Production/staging URLs remain canonical.
    const demoProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" && demoProject?.startsWith("demo-") && bucket === `${demoProject}.firebasestorage.app`
      ? canonical.replace("https://firebasestorage.googleapis.com", "http://127.0.0.1:9199") : canonical;
  } catch { return legacy; }
}
