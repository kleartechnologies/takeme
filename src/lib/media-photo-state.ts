/** Presentation only. Server permits and immutable operation IDs remain authoritative. */
export function mediaPhotoProgress(photos: readonly { preparing?: boolean; failed?: boolean }[], missing = 0) {
  const total = photos.length + missing;
  const ready = photos.filter(photo => !photo.preparing && !photo.failed).length;
  const pending = photos.filter(photo => photo.preparing).length;
  const failed = photos.filter(photo => !photo.preparing && photo.failed).length + missing;
  return { total, ready, pending, failed, label: `${ready} of ${total} photos ready` };
}

/** Unknown/security/invalid-input failures never offer an automatic or blind retry. */
export function mediaPhotoFailure(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code
    : error instanceof Error && error.cause && typeof error.cause === "object" && "code" in error.cause ? error.cause.code : undefined;
  const retryable = ["media/network", "media/timeout", "media/unavailable", "functions/unavailable", "functions/resource-exhausted", "firestore/unavailable", "storage/retry-limit-exceeded", "storage/unknown"].includes(String(code));
  return { retryable, message: retryable
    ? "This photo hasn’t finished. Check your connection, then retry. Your other photos are kept."
    : "We couldn’t prepare this photo. Try selecting it again or choose another photo." };
}
