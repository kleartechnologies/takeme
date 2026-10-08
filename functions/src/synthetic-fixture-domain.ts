/** Reviewed operation identity, not a keyword-based or client-extensible allowlist. */
export const SYNTHETIC_FIXTURE = Object.freeze({
  projectId: "takeme-52b80",
  bucket: "takeme-52b80.firebasestorage.app",
  listingId: "6dV9mQnbYPa51UKXOTOu",
  ownerUid: "0sUaiRO39dMeeANdhZ2aMc9IB4L2",
  title: "TAKEME Stage 7 Test Green Mug",
  description: "Synthetic test fixture for TAKEME Stage 7 public listing verification. Generic green ceramic mug mockup; not a real item for sale. Please do not purchase or contact the seller.",
  createdAt: "2026-09-30T07:59:22.229Z",
  objectPath: "users/0sUaiRO39dMeeANdhZ2aMc9IB4L2/listings/6dV9mQnbYPa51UKXOTOu/da3a082b-8c87-436c-84b5-1f7cea3eba90.webp",
  objectGeneration: "1790755164545017",
  objectSize: "26900",
  contentType: "image/webp",
  reason: "confirmed TAKEME synthetic production fixture cleanup",
});

export const SYNTHETIC_AUDIT_ID = `synthetic-fixture-cleanup-${SYNTHETIC_FIXTURE.listingId}`;
export const SYNTHETIC_MEDIA_PREFIX = `users/${SYNTHETIC_FIXTURE.ownerUid}/listings/${SYNTHETIC_FIXTURE.listingId}/`;

export function approvedFixtureRequest(input: unknown): boolean {
  return !!input && typeof input === "object" && !Array.isArray(input)
    && Object.keys(input).length === 1
    && (input as Record<string, unknown>).listingId === SYNTHETIC_FIXTURE.listingId;
}

function approvedImage(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "firebasestorage.googleapis.com"
      && !url.username && !url.password && !url.port && !url.hash
      && decodeURIComponent(url.pathname) === `/v0/b/${SYNTHETIC_FIXTURE.bucket}/o/${SYNTHETIC_FIXTURE.objectPath}`;
  } catch { return false; }
}

export function fixtureMatches(data: Record<string, unknown> | undefined): boolean {
  const date = data?.createdAt as { toDate?: () => Date } | undefined;
  return !!data && data.sellerId === SYNTHETIC_FIXTURE.ownerUid
    && data.title === SYNTHETIC_FIXTURE.title && data.description === SYNTHETIC_FIXTURE.description
    && data.listingType === "buy_now" && ["active", "removed"].includes(String(data.status))
    && typeof date?.toDate === "function" && date.toDate().toISOString() === SYNTHETIC_FIXTURE.createdAt
    && Array.isArray(data.imageUrls) && data.imageUrls.length === 1 && approvedImage(data.imageUrls[0]);
}

export function fixtureRuntimeMatches(env: NodeJS.ProcessEnv, projectId?: string, bucket?: string): boolean {
  return env.TAKEME_RELEASE_TARGET === "production" && env.TAKEME_FIREBASE_PROJECT_ID === SYNTHETIC_FIXTURE.projectId
    && env.GCLOUD_PROJECT === SYNTHETIC_FIXTURE.projectId && projectId === SYNTHETIC_FIXTURE.projectId
    && env.TAKEME_STORAGE_BUCKETS === SYNTHETIC_FIXTURE.bucket && bucket === SYNTHETIC_FIXTURE.bucket
    && !Object.keys(env).some(key => /EMULATOR/.test(key) && !(key === "NEXT_PUBLIC_USE_FIREBASE_EMULATORS" && env[key] === "false"));
}

export function approvedMediaMetadata(metadata: { name?: string; generation?: string | number; size?: string | number; contentType?: string }): boolean {
  return metadata.name === SYNTHETIC_FIXTURE.objectPath && String(metadata.generation) === SYNTHETIC_FIXTURE.objectGeneration
    && String(metadata.size) === SYNTHETIC_FIXTURE.objectSize && metadata.contentType === SYNTHETIC_FIXTURE.contentType;
}
