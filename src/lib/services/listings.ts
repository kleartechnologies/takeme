import {
  Timestamp,
  doc,
  getDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { deleteObject, getDownloadURL, getMetadata, ref, uploadBytes } from "firebase/storage";
import { auth, db, functions, storage } from "@/lib/firebase/client";
import {
  MAX_LISTING_IMAGES,
  validateImageFiles,
  validateListingInput,
} from "@/lib/listing-validation";
import type { Listing, ListingInput } from "@/types/marketplace";
import { formatPublicLocation, parsePublicLocation } from "@/lib/general-location";
import { runListingSubmission, type ListingSubmissionCheckpoint } from "@/lib/listing-submission";
import { prepareListingImage, uploadListingImagesWith } from "@/lib/listing-image-upload";
import { cancelAuctionListing, createAuctionDraft, publishAuction, saveAuction } from "@/lib/services/auctions";
import { createFixedDraft, publishFixed, removeFixed, updateFixed } from "@/lib/services/fixed-listings";
import { withEligibilityHandling } from "@/lib/services/marketplace-call";
import { photoUploadMetadata } from "@/lib/services/upload-permits";

export type ListingSort = "newest" | "price_low" | "price_high";

export interface ListingQuery {
  search?: string;
  categoryId?: string;
  condition?: string;
  listingType?: string;
  auctionStatus?: "scheduled" | "active";
  location?: string;
  maxPrice?: number;
  sort?: ListingSort;
  pageSize?: number;
  sellerId?: string;
}

export interface ListingPage {
  listings: PublicListing[];
  cursor: string | null;
  hasMore: boolean;
}

export type PublicListing = Omit<Listing, "currentBidderId" | "winnerId">;
export interface PublicAuctionBid { amount: number; createdAt: string; isOwnBid: boolean }
export interface PublicListingDetail { listing: PublicListing; bids: PublicAuctionBid[] }

function requireServices() {
  if (!auth?.currentUser || !db || !storage) throw new Error("Sign in and configure Firebase before managing listings.");
  return { user: auth.currentUser, db, storage };
}

function requireDatabase() {
  if (!db) throw new Error("Firebase is not configured. Add the required environment variables first.");
  return db;
}

function toIso(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function toOptionalIso(value: unknown) {
  if (value == null) return null;
  return toIso(value);
}

export function fromDocument(snapshot: QueryDocumentSnapshot<DocumentData> | { id: string; data(): DocumentData }): Listing {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    sellerId: data.sellerId,
    title: data.title,
    description: data.description,
    categoryId: data.categoryId,
    condition: data.condition,
    price: Number(data.price),
    listingType: data.listingType,
    location: parsePublicLocation(data.publicLocation) ? formatPublicLocation(parsePublicLocation(data.publicLocation)!) : "",
    publicLocation: parsePublicLocation(data.publicLocation) ?? undefined,
    meetupLocationId: typeof data.meetupLocationId === "string" ? data.meetupLocationId : null,
    meetupLocation: data.meetupLocation ?? null,
    imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
    status: data.status,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    auctionStartAt: data.auctionStartAt ? toIso(data.auctionStartAt) : undefined,
    auctionEndAt: data.auctionEndAt ? toIso(data.auctionEndAt) : undefined,
    startingBid: Number.isSafeInteger(data.startingBid) ? data.startingBid : undefined,
    currentBid: Number.isSafeInteger(data.currentBid) ? data.currentBid : undefined,
    currentBidderId: typeof data.currentBidderId === "string" ? data.currentBidderId : data.currentBidderId === null ? null : undefined,
    bidCount: Number.isSafeInteger(data.bidCount) ? data.bidCount : undefined,
    minimumBidIncrement: Number.isSafeInteger(data.minimumBidIncrement) ? data.minimumBidIncrement : undefined,
    auctionStatus: data.auctionStatus,
    winnerId: typeof data.winnerId === "string" ? data.winnerId : data.winnerId === null ? null : undefined,
    finalBid: Number.isSafeInteger(data.finalBid) ? data.finalBid : data.finalBid === null ? null : undefined,
    endedAt: toOptionalIso(data.endedAt),
    searchTokens: data.searchTokens,
    facetKeys: data.facetKeys,
    locationKey: data.locationKey,
  };
}

export async function getActiveListings(filters: ListingQuery = {}, cursor?: string | null): Promise<ListingPage> {
  if (!functions) throw new Error("Firebase Functions is not configured. Add the required environment variables first.");
  // Public callers never query original listing documents as a collection.
  // The callable validates each source document and returns public fields only.
  const definedFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== null));
  const result = await httpsCallable<{ filters: ListingQuery; cursor: string | null }, ListingPage>(functions, "getPublicListingPage")({ filters: definedFilters, cursor: cursor ?? null });
  return result.data;
}

export async function getListing(id: string) {
  if (auth?.currentUser) {
    try {
      const snapshot = await getDoc(doc(requireDatabase(), "listings", id));
      if (snapshot.exists()) return fromDocument(snapshot);
    } catch (error) {
      if (!(typeof error === "object" && error && "code" in error && String(error.code).includes("permission-denied"))) throw error;
    }
  }
  try { return (await getPublicListingDetail(id)).listing as Listing; }
  catch (error) {
    if (typeof error === "object" && error && "code" in error && String(error.code).includes("not-found")) return null;
    throw error;
  }
}

export async function getPublicListingDetail(id: string): Promise<PublicListingDetail> {
  if (!functions) throw new Error("Firebase Functions is not configured.");
  const result = await httpsCallable<{ listingId: string }, PublicListingDetail>(functions, "getPublicListingDetail")({ listingId: id });
  return result.data;
}

export function subscribeToListing(id: string, onChange: (listing: Listing | null, bids: PublicAuctionBid[]) => void, onError: (error: Error) => void) {
  let active = true;
  let pending = false;
  async function refresh() {
    if (!active || pending) return;
    pending = true;
    try {
      const result = await getPublicListingDetail(id);
      if (active) onChange(result.listing as Listing, result.bids);
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && String(error.code).includes("not-found") && auth?.currentUser) {
        try { const listing = await getListing(id); if (active) onChange(listing, []); }
        catch (nextError) { if (active) onError(nextError as Error); }
      } else if (typeof error === "object" && error && "code" in error && String(error.code).includes("not-found")) {
        if (active) onChange(null, []);
      } else if (active) onError(error as Error);
    } finally { pending = false; }
  }
  void refresh();
  const timer = setInterval(() => void refresh(), 10_000);
  return () => { active = false; clearInterval(timer); };
}

export async function getListingsBySeller(sellerId: string, includeRemoved = false) {
  if (!includeRemoved) return (await getActiveListings({ sellerId, pageSize: 50 })).listings;
  if (!auth?.currentUser || auth.currentUser.uid !== sellerId || !functions) throw new Error("Sign in to view your listing history.");
  const result = await httpsCallable<Record<string, never>, { listings: PublicListing[] }>(functions, "getMyListingHistory")({});
  return result.data.listings;
}

async function uploadListingImages(uid: string, listingId: string, files: File[], checkpoint?: ListingSubmissionCheckpoint, onCheckpoint?: () => void) {
  const services = requireServices();
  return uploadListingImagesWith(uid, listingId, files, {
    prepare: prepareListingImage,
    reference: (path) => ref(services.storage, path),
    upload: async (objectRef, blob, contentType) => {
      const metadata = await photoUploadMetadata(objectRef.fullPath, contentType, blob.size);
      return withEligibilityHandling(() => uploadBytes(objectRef, blob, { ...metadata, cacheControl: "public,max-age=31536000,immutable" }));
    },
    downloadUrl: getDownloadURL,
    remove: deleteObject,
    uniqueId: () => crypto.randomUUID(),
    exists: async (objectRef, blob) => {
      try {
        const metadata = await getMetadata(objectRef);
        if (metadata.fullPath !== objectRef.fullPath || metadata.size !== blob.size || metadata.contentType !== "image/webp") throw new Error("The retained upload does not match this photo.");
        return true;
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "storage/object-not-found") return false;
        throw error;
      }
    },
  }, checkpoint, onCheckpoint);
}

/** Sell V1.1 retries retain known drafts and immutable uploads, without changing server contracts. */
export async function submitListingWithRecovery(input: ListingInput, files: File[], checkpoint: ListingSubmissionCheckpoint, saveDraft: boolean, onCheckpoint: () => void) {
  const services = requireServices();
  const errors = [...validateListingInput(input), ...validateImageFiles(files)];
  if (errors.length) throw new Error(errors[0]);
  if (checkpoint.type !== input.listingType) throw new Error("Resume the existing draft's listing type in My Listings.");
  if (saveDraft && input.listingType === "auction" && Date.parse(input.auctionStartAt) <= Date.now()) throw new Error("Schedule for later to save a resumable auction draft.");
  return runListingSubmission(checkpoint, {
    create: () => input.listingType === "auction" ? createAuctionDraft(input) : createFixedDraft(input),
    read: async id => {
      const current = await getListing(id);
      if (!current || current.sellerId !== services.user.uid || current.listingType !== input.listingType) return "unavailable";
      return current.status === "draft" ? "draft" : current.status === "active" ? "published" : "unavailable";
    },
    upload: async id => (await uploadListingImages(services.user.uid, id, files, checkpoint, onCheckpoint)).map(image => image.url),
    save: (id, urls) => input.listingType === "auction" ? saveAuction(id, input, urls) : updateFixed(id, input, urls),
    publish: (id, urls) => input.listingType === "auction" ? publishAuction(id, urls) : publishFixed(id, urls),
    checkpoint: onCheckpoint,
  }, saveDraft);
}

export async function createListing(input: ListingInput, files: File[]) {
  const services = requireServices();
  const errors = [...validateListingInput(input), ...validateImageFiles(files)];
  if (errors.length) throw new Error(errors[0]);
  const uploaded: { url: string; fullPath: string }[] = [];
  let listingId = "";

  try {
    if (input.listingType === "auction") {
      listingId = await createAuctionDraft(input);
    } else {
      listingId = await createFixedDraft(input);
    }
    uploaded.push(...await uploadListingImages(services.user.uid, listingId, files));
    const imageUrls = uploaded.map((item) => item.url);
    if (input.listingType === "auction") await publishAuction(listingId, imageUrls);
    else await publishFixed(listingId, imageUrls);
    return listingId;
  } catch (error) {
    await Promise.allSettled(uploaded.map((item) => deleteObject(ref(services.storage, item.fullPath))));
    if (listingId) {
      if (input.listingType === "auction") {
        await cancelAuctionListing(listingId).catch(() => undefined);
      } else {
        await removeFixed(listingId).catch(() => undefined);
      }
    }
    throw error;
  }
}

export async function updateListing(id: string, input: ListingInput, orderedPhotos: { url: string; existing: boolean; file?: File }[]) {
  const services = requireServices();
  const current = await getListing(id);
  if (!current) throw new Error("Listing not found.");
  if (current.sellerId !== services.user.uid) throw new Error("You are not allowed to edit this listing.");
  const retainedImageUrls = orderedPhotos.filter((photo) => photo.existing).map((photo) => photo.url);
  const newFiles = orderedPhotos.flatMap((photo) => photo.file ? [photo.file] : []);
  if (retainedImageUrls.some((url) => !current.imageUrls.includes(url))) throw new Error("Existing listing images are invalid.");
  const finalCount = retainedImageUrls.length + newFiles.length;
  const errors = validateListingInput(input);
  if (finalCount < 1 || finalCount > MAX_LISTING_IMAGES) errors.push(`Keep between 1 and ${MAX_LISTING_IMAGES} images.`);
  if (newFiles.length) {
    const fileErrors = validateImageFiles(newFiles);
    if (fileErrors[0] === "Add at least one image.") fileErrors.shift();
    errors.push(...fileErrors);
  }
  if (errors.length) throw new Error(errors[0]);

  const uploaded = await uploadListingImages(services.user.uid, id, newFiles);
  let imageUrls: string[] = [];
  try {
    let newIndex = 0;
    imageUrls = orderedPhotos.map((photo) => photo.existing ? photo.url : uploaded[newIndex++]?.url ?? "");
    if (input.listingType === "auction") await saveAuction(id, input, imageUrls);
    else await updateFixed(id, input, imageUrls);
  } catch (error) {
    await Promise.allSettled(uploaded.map((item) => deleteObject(ref(services.storage, item.fullPath))));
    throw error;
  }

  const removed = current.imageUrls.filter((url) => !retainedImageUrls.includes(url));
  await Promise.allSettled(removed.map(async (url) => {
    const objectRef = ref(services.storage, url);
    if (objectRef.fullPath.startsWith(`users/${services.user.uid}/listings/${id}/`)) await deleteObject(objectRef);
  }));
  return imageUrls;
}

export async function publishExistingAuctionDraft(id: string, input: ListingInput, orderedPhotos: { url: string; existing: boolean; file?: File }[]) {
  const services = requireServices();
  const listing = await getListing(id);
  if (!listing || listing.sellerId !== services.user.uid) throw new Error("You are not allowed to publish this auction.");
  if (listing.listingType !== "auction" || listing.status !== "draft" || (listing.bidCount ?? 0) !== 0) throw new Error("This auction draft cannot be published.");
  const imageUrls = await updateListing(id, input, orderedPhotos);
  await publishAuction(id, imageUrls);
  return id;
}

/** Uses the existing draft/update callables; no public write occurs here. */
export async function saveListingDraft(input: ListingInput, files: File[]) {
  const services = requireServices();
  const errors = [...validateListingInput(input), ...validateImageFiles(files)];
  if (errors.length) throw new Error(errors[0]);
  if (input.listingType === "auction" && Date.parse(input.auctionStartAt) <= Date.now()) throw new Error("Schedule for later to save a resumable auction draft.");
  const id = input.listingType === "auction" ? await createAuctionDraft(input) : await createFixedDraft(input);
  const uploaded: { url: string; fullPath: string }[] = [];
  try {
    uploaded.push(...await uploadListingImages(services.user.uid, id, files));
    const imageUrls = uploaded.map(image => image.url);
    if (input.listingType === "auction") await saveAuction(id, input, imageUrls);
    else await updateFixed(id, input, imageUrls);
  } catch (error) {
    await Promise.allSettled(uploaded.map(image => deleteObject(ref(services.storage, image.fullPath))));
    if (input.listingType === "auction") await cancelAuctionListing(id).catch(() => undefined);
    else await removeFixed(id).catch(() => undefined);
    throw error;
  }
  return id;
}

export async function publishExistingFixedDraft(id: string, input: ListingInput, orderedPhotos: { url: string; existing: boolean; file?: File }[]) {
  const services = requireServices();
  const listing = await getListing(id);
  if (!listing || listing.sellerId !== services.user.uid || listing.listingType !== "buy_now" || listing.status !== "draft" || input.listingType !== "buy_now") throw new Error("You are not allowed to publish this draft.");
  const imageUrls = await updateListing(id, input, orderedPhotos);
  await publishFixed(id, imageUrls);
  return id;
}

export async function deleteListing(id: string) {
  const services = requireServices();
  const current = await getListing(id);
  if (!current) throw new Error("Listing not found.");
  if (current.sellerId !== services.user.uid) throw new Error("You are not allowed to remove this listing.");
  if (current.listingType === "auction" || current.listingType === "buy_now_and_auction") await cancelAuctionListing(id);
  else await removeFixed(id);
}
