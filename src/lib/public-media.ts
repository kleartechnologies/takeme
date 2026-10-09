import { listingMediaBucket, storageMediaUrl, PRODUCTION_MEDIA_BUCKET, STAGING_MEDIA_BUCKET } from "../../functions/src/listing-media-domain.ts";
import { productionEnvironment } from "../../functions/src/production-environment.ts";
import { stagingEnvironment } from "../../functions/src/staging-environment.ts";

export type PublicMediaEnvironment = { projectId?: string; storageBucket?: string; useEmulators?: boolean };
type Surface = "listing" | "avatar" | "editorial";
const identity = "[A-Za-z0-9_-]{1,128}";
const file = "[A-Za-z0-9_-][A-Za-z0-9_.-]{0,199}\\.(?:jpe?g|png|webp|avif)";

/** Format validation is not publication authorization: callers must use a public
 * listing projection; Storage rules still enforce READY/link/visibility. */
export function isListingDerivativeUrl(value: string, bucket: string) {
  if (bucket !== PRODUCTION_MEDIA_BUCKET && bucket !== STAGING_MEDIA_BUCKET) return false;
  try {
    const path = /^\/v0\/b\/([^/]+)\/o\/([^/]+)$/.exec(new URL(value).pathname);
    if (!path || path[1] !== bucket) return false;
    const object = decodeURIComponent(path[2]);
    return new RegExp(`^users/${identity}/listing-media/${identity}/v1-[a-f0-9]{64}/(?:thumbnail|card|detail)\\.webp$`).test(object)
      && value === storageMediaUrl(bucket, object);
  } catch { return false; }
}

/** Exact project-owned buckets and separate public namespaces, never a host-wide
 * whitelist. The default app bucket remains the legacy bucket. */
export function isPublicMediaUrl(value: string, env: PublicMediaEnvironment, surface: Surface = "listing") {
  const pinned = env.projectId === productionEnvironment.projectId ? productionEnvironment
    : env.projectId === stagingEnvironment.projectId ? stagingEnvironment : null;
  const demo = env.useEmulators === true && env.projectId === "demo-takeme" && env.storageBucket === "demo-takeme.firebasestorage.app";
  if ((!pinned || env.storageBucket !== pinned.storageBucket || env.useEmulators === true) && !demo) return false;
  try {
    const url = new URL(value);
    const origin = demo ? "http://127.0.0.1:9199" : "https://firebasestorage.googleapis.com";
    if (url.origin !== origin || url.username || url.password || url.hash) return false;
    const path = /^\/v0\/b\/([^/]+)\/o\/([^/]+)$/.exec(url.pathname);
    if (!path) return false;
    if (surface === "listing" && !demo && path[1] === listingMediaBucket(env.projectId!)) {
      return isListingDerivativeUrl(value, path[1]);
    }
    if (path[1] !== env.storageBucket) return false;
    const object = decodeURIComponent(path[2]);
    if (url.pathname !== `/v0/b/${env.storageBucket}/o/${encodeURIComponent(object)}`) return false;
    if (url.searchParams.getAll("alt").length !== 1 || url.searchParams.get("alt") !== "media"
      || [...url.searchParams.keys()].some(key => key !== "alt" && key !== "token")
      || url.searchParams.getAll("token").length > 1 || url.searchParams.has("token") && !url.searchParams.get("token")) return false;
    if (surface === "editorial") return !url.searchParams.has("token")
      && /^admin-assets\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/image\.png$/.test(object);
    return new RegExp(surface === "avatar" ? `^users/${identity}/profile/(?:${file}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$`
      : `^users/${identity}/listings/${identity}/${file}$`).test(object);
  } catch { return false; }
}
