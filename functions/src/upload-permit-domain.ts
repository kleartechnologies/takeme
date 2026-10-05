export const UPLOAD_PERMIT_TTL_MS = 2 * 60_000;
export const MAX_UPLOAD_PERMIT_BATCH = 8;
export const MAX_ACTIVE_UPLOAD_PERMITS = 128;
export type UploadRequest = { path: string; contentType: string; sizeBytes: number; listingId: string | null };

export function parseUploadRequests(uid: string, input: unknown): UploadRequest[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_UPLOAD_PERMIT_BATCH) throw new Error("Choose between one and eight photos.");
  const seen = new Set<string>();
  return input.map((item) => {
    if (!item || typeof item !== "object" || Object.keys(item).some((key) => !["path", "contentType", "sizeBytes"].includes(key))) throw new Error("Invalid photo upload request.");
    const { path, contentType, sizeBytes } = item as Record<string, unknown>;
    if (typeof path !== "string" || path.length > 400 || typeof contentType !== "string" || !["image/jpeg", "image/png", "image/webp"].includes(contentType)
      || typeof sizeBytes !== "number" || !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 8 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WebP photo under 8 MB.");
    const parts = path.split("/");
    if (parts[0] !== "users" || parts[1] !== uid || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(parts[parts.length - 1] ?? "")
      || parts[parts.length - 1]?.includes("..") || seen.has(path)) throw new Error("Invalid photo upload path.");
    const listingId = parts.length === 5 && parts[2] === "listings" && /^[A-Za-z0-9_-]{1,128}$/.test(parts[3] ?? "") ? parts[3]! : null;
    if (!(parts.length === 4 && parts[2] === "profile") && !listingId) throw new Error("Invalid photo upload path.");
    seen.add(path);
    return { path, contentType, sizeBytes, listingId };
  });
}

export function mayUploadListing(data: Record<string, unknown> | undefined, uid: string, now: number) {
  if (!data || data.sellerId !== uid) return false;
  if (data.listingType === "buy_now") return ["draft", "active"].includes(String(data.status));
  if (!["auction", "buy_now_and_auction"].includes(String(data.listingType)) || data.bidCount !== 0) return false;
  return data.status === "draft" || (data.auctionStatus === "scheduled" && typeof data.auctionStartAt === "number" && now < data.auctionStartAt);
}
