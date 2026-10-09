/** Bounded sweep, called only by the IAM-authenticated scheduled processor route. No TTL. */
export async function cleanupMedia(adapter, now = Date.now()) {
  const candidates = await adapter.candidates(now - 86400000, 100);
  if (candidates.length > 100) throw new Error("cleanup-bound-exceeded");
  let removed = 0;
  for (const op of candidates) {
    // claim rereads the operation AND its linked listing transactionally. A live
    // retained image or an unexpired processor lease can never be claimed.
    if (!await adapter.claimCleanup(op.imageId, now)) continue;
    await adapter.removeOwned(op);
    await adapter.finishCleanup(op.imageId);
    removed++;
  }
  return removed;
}
