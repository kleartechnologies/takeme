import { isolatedNormalize } from "./process.mjs";

/** Storage adapter separates retryable infrastructure failures from invalid image failures. */
export async function processFinalized(event, adapter, decode = isolatedNormalize) {
  const match = /^users\/([A-Za-z0-9_-]{1,128})\/listing-media-staging\/([A-Za-z0-9_-]{1,128})\/source$/.exec(event.name ?? "");
  if (!match) return "ignored";
  const [, uid, imageId] = match;
  if (event.bucket !== adapter.bucket || !/^[0-9]+$/.test(String(event.generation))) throw new Error("resource-mismatch");
  const claim = await adapter.claim(uid, imageId, event);
  if (claim.status === "READY") { await adapter.removeRaw(event); return "duplicate"; }
  if (claim.status === "FAILED") { await adapter.removeRaw(event); return "failed"; }
  if (claim.status !== "CLAIMED") throw new Error("processing-deferred");
  const bytes = await adapter.download(event, claim.sizeBytes);
  let result;
  try { result = await decode(bytes, claim.digest, claim.contentType); }
  catch { await adapter.fail(imageId, claim.lease); await adapter.removeRaw(event); return "failed"; }
  const paths = {};
  for (const [name, variant] of Object.entries(result.variants)) {
    paths[name] = `users/${uid}/listing-media/${imageId}/v1-${claim.digest}/${name}.webp`;
    await adapter.putImmutable(paths[name], variant);
  }
  await adapter.commit(uid, imageId, claim.lease, { imageId, status: "READY", width: result.width, height: result.height, mime: "image/webp", thumbnailPath: paths.thumbnail, cardPath: paths.card, detailPath: paths.detail });
  // A retry after READY re-enters the deletion above; never discard the source before commit.
  await adapter.removeRaw(event);
  return "ready";
}
