import { parseHomepage } from "../../../functions/src/homepage-projection.ts";
import { cache } from "react";
import { publicListingEndpoint } from "./public-listing-server.ts";
import { parsePublicCatalogueListing, parsePublicCataloguePage, parseAnonymousBids } from "../public-catalogue.ts";
import { isStagingMediaUrl } from "./staging-isolation.ts";
import { stagingEnvironment } from "../../../functions/src/staging-environment.ts";

async function readPublic(name: "getPublicListingPage" | "getPublicListingDetail", data: object): Promise<unknown> {
  if (process.env.TAKEME_OFFLINE_QUALIFICATION === "true") return null;
  const detailEndpoint = publicListingEndpoint();
  if (!detailEndpoint) return null;
  const endpoint = detailEndpoint.replace(/getPublicListingDetail$/, name);
  try {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }),
      cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { result?: unknown };
    return payload.result ?? null;
  } catch { return null; }
}
function safeImages(listing: { imageUrls: string[] }) {
  return listing.imageUrls.every(value => {
    if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === stagingEnvironment.projectId) return isStagingMediaUrl(value);
    try {
      const url = new URL(value);
      const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      return url.origin === "https://firebasestorage.googleapis.com" && url.pathname.startsWith(`/v0/b/${bucket}/o/`)
        || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" && url.origin === "http://127.0.0.1:9199";
    } catch { return false; }
  });
}

/** Fixed anonymous public query: no arbitrary query, bearer token or cookie forwarding. */
export async function getPublicHomePage() {
  const result = await readPublic("getPublicListingPage", { filters: { sort: "newest", pageSize: 8 }, cursor: null, includeHomepage: true }) as { homepage?: unknown } | null;
  const page = parsePublicCataloguePage(result);
  const parsed = parseHomepage(result?.homepage);
  const images = parsed?.sections.flatMap(section => [...section.products.map(v => v.imageUrl), ...section.banners.map(v => v.url)]).filter(Boolean) ?? [];
  const avatars = parsed?.sections.flatMap(section => section.sellers.flatMap(v => v.photoURL ? [v.photoURL] : [])) ?? [];
  const safeAvatars = avatars.every(value => safeImages({imageUrls:[value]}) || (()=>{try {const url=new URL(value); return url.origin==="https://lh3.googleusercontent.com" && !url.username && !url.password;} catch{return false;}})());
  const homepage = parsed && safeImages({ imageUrls: images }) && safeAvatars ? parsed : null;
  return page && page.listings.every(safeImages) ? { ...page, homepage } : null;
}

/** React cache is request-scoped, including metadata/page reuse; no cross-user or auction cache. */
export const getPublicProductSnapshot = cache(async (id: string) => {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  const result = await readPublic("getPublicListingDetail", { listingId: id }) as { listing?: unknown; bids?: unknown } | null;
  const listing = parsePublicCatalogueListing(result?.listing);
  return listing && listing.id === id && safeImages(listing) ? { listing, bids: parseAnonymousBids(result?.bids) } : null;
});
