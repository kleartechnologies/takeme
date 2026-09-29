export function listingMediaPrefix(uid: string, listingId: string) {
  return `users/${uid}/listings/${listingId}/`;
}

type ListingMediaFile = {
  name: string;
  delete(options: { ignoreNotFound: boolean }): Promise<unknown>;
};

type ListingMediaBucket = {
  getFiles(options: { prefix: string }): Promise<[ListingMediaFile[], ...unknown[]]>;
};

export async function deleteListingMedia(bucket: ListingMediaBucket, uid: string, listingId: string) {
  const prefix = listingMediaPrefix(uid, listingId);
  const [files] = await bucket.getFiles({ prefix });
  for (const file of files) {
    if (!file.name.startsWith(prefix)) throw new Error("Storage returned a file outside the listing media path.");
    await file.delete({ ignoreNotFound: true });
  }
}
