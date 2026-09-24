import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase/client";
import {
  MAX_LISTING_IMAGES,
  createFacetKey,
  createFacetKeys,
  createSearchTokens,
  normalizeSearch,
  validateImageFiles,
  validateListingInput,
} from "@/lib/listing-validation";
import type { Listing, ListingInput } from "@/types/marketplace";
import { cancelAuctionListing, createAuctionDraft, publishAuction, saveAuction } from "@/lib/services/auctions";
import { isActiveInventoryListing } from "@/lib/active-inventory";

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
}

export interface ListingPage {
  listings: Listing[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

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
    location: data.location,
    latitude: data.latitude,
    longitude: data.longitude,
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

export async function getActiveListings(filters: ListingQuery = {}, cursor?: QueryDocumentSnapshot<DocumentData> | null): Promise<ListingPage> {
  const database = requireDatabase();
  const pageSize = Math.min(Math.max(filters.pageSize ?? 12, 1), 24);
  const constraints: QueryConstraint[] = [where("status", "==", "active")];
  const search = normalizeSearch(filters.search ?? "");

  const searching = search.length >= 2;
  if (searching) {
    constraints.push(where("searchTokens", "array-contains", search.slice(0, 40)));
  } else {
    constraints.push(where("facetKeys", "array-contains", createFacetKey({ categoryId: filters.categoryId, condition: filters.condition, listingType: filters.listingType, location: filters.location })));
  }

  if (filters.maxPrice && filters.maxPrice > 0) {
    constraints.push(where("price", "<=", filters.maxPrice));
    constraints.push(orderBy("price", filters.sort === "price_high" ? "desc" : "asc"));
  } else if (filters.sort === "price_low") {
    constraints.push(orderBy("price", "asc"));
  } else if (filters.sort === "price_high") {
    constraints.push(orderBy("price", "desc"));
  } else {
    constraints.push(orderBy("createdAt", "desc"));
  }

  // Firestore permits only one array-contains filter here. Narrow title matches
  // and auction status locally, advancing even when a batch has no matches.
  const matches: Listing[] = [];
  let lastRead = cursor ?? null;
  let hasMore = false;
  for (let batch = 0; batch < 4 && matches.length < pageSize; batch += 1) {
    const pageConstraints = [...constraints, ...(lastRead ? [startAfter(lastRead)] : []), limit(pageSize + 1)];
    // Discovery must not mistake an offline, empty cache for an empty marketplace.
    const snapshot = await getDocsFromServer(query(collection(database, "listings"), ...pageConstraints));
    const source = snapshot.docs.slice(0, pageSize);
    hasMore = snapshot.size > pageSize;
    for (const document of source) {
      lastRead = document;
      const listing = fromDocument(document);
      if (!isActiveInventoryListing(listing)) continue;
      if (filters.categoryId && listing.categoryId !== filters.categoryId) continue;
      if (filters.condition && listing.condition !== filters.condition) continue;
      if (filters.listingType && listing.listingType !== filters.listingType) continue;
      if (filters.auctionStatus && listing.auctionStatus !== filters.auctionStatus) continue;
      if (filters.location && !normalizeSearch(listing.location).includes(normalizeSearch(filters.location))) continue;
      if (filters.maxPrice && listing.listingType !== "buy_now" && ((listing.bidCount ?? 0) > 0 ? (listing.currentBid ?? 0) / 100 : (listing.startingBid ?? 0) / 100) > filters.maxPrice) continue;
      matches.push(listing);
      if (matches.length === pageSize) break;
    }
    if (!hasMore) break;
  }
  return { listings: matches, cursor: lastRead, hasMore };
}

export async function getListing(id: string) {
  const snapshot = await getDoc(doc(requireDatabase(), "listings", id));
  return snapshot.exists() ? fromDocument(snapshot) : null;
}

export function subscribeToListing(id: string, onChange: (listing: Listing | null) => void, onError: (error: Error) => void) {
  return onSnapshot(doc(requireDatabase(), "listings", id), (snapshot) => onChange(snapshot.exists() ? fromDocument(snapshot) : null), (error) => onError(new Error(error.message)));
}

export async function getListingsBySeller(sellerId: string, includeRemoved = false) {
  const constraints: QueryConstraint[] = [where("sellerId", "==", sellerId)];
  if (!includeRemoved) constraints.push(where("status", "==", "active"));
  constraints.push(orderBy("createdAt", "desc"), limit(50));
  const snapshot = await getDocs(query(collection(requireDatabase(), "listings"), ...constraints));
  const listings = snapshot.docs.map(fromDocument);
  return includeRemoved ? listings : listings.filter((listing) => isActiveInventoryListing(listing));
}

async function resizeImage(file: File) {
  if (typeof createImageBitmap !== "function") return { blob: file as Blob, contentType: file.type, extension: file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg" };
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return { blob: file as Blob, contentType: file.type, extension: "jpg" };
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  return blob ? { blob, contentType: "image/webp", extension: "webp" } : { blob: file as Blob, contentType: file.type, extension: "jpg" };
}

async function uploadListingImages(uid: string, listingId: string, files: File[]) {
  const services = requireServices();
  const uploaded: { url: string; fullPath: string }[] = [];
  try {
    for (const file of files) {
      const processed = await resizeImage(file);
      const filename = `${crypto.randomUUID()}.${processed.extension}`;
      const objectRef = ref(services.storage, `users/${uid}/listings/${listingId}/${filename}`);
      await uploadBytes(objectRef, processed.blob, { contentType: processed.contentType, cacheControl: "public,max-age=31536000,immutable" });
      const entry = { url: "", fullPath: objectRef.fullPath };
      uploaded.push(entry);
      entry.url = await getDownloadURL(objectRef);
    }
  } catch (error) {
    await Promise.allSettled(uploaded.map((item) => deleteObject(ref(services.storage, item.fullPath))));
    throw error;
  }
  return uploaded;
}

function prepareBuyNowListing(input: Extract<ListingInput, { listingType: "buy_now" }>) {
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    categoryId: input.categoryId,
    condition: input.condition,
    price: input.price,
    listingType: "buy_now" as const,
    location: input.location.trim(),
    ...(typeof input.latitude === "number" ? { latitude: input.latitude } : {}),
    ...(typeof input.longitude === "number" ? { longitude: input.longitude } : {}),
    locationKey: normalizeSearch(input.location),
    searchTokens: createSearchTokens(input.title),
    facetKeys: createFacetKeys({ categoryId: input.categoryId, condition: input.condition, listingType: "buy_now", location: input.location }),
  };
}

export async function createListing(input: ListingInput, files: File[]) {
  const services = requireServices();
  const errors = [...validateListingInput(input), ...validateImageFiles(files)];
  if (errors.length) throw new Error(errors[0]);
  const listingRef = input.listingType === "auction" ? null : doc(collection(services.db, "listings"));
  const uploaded: { url: string; fullPath: string }[] = [];
  let listingId = "";

  try {
    if (input.listingType === "auction") {
      listingId = await createAuctionDraft(input);
    } else {
      listingId = listingRef!.id;
      await setDoc(listingRef!, { id: listingId, sellerId: services.user.uid, ...prepareBuyNowListing(input), imageUrls: [], status: "draft", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    uploaded.push(...await uploadListingImages(services.user.uid, listingId, files));
    const imageUrls = uploaded.map((item) => item.url);
    if (input.listingType === "auction") await publishAuction(listingId, imageUrls);
    else await updateDoc(listingRef!, { imageUrls, status: "active", updatedAt: serverTimestamp() });
    return listingId;
  } catch (error) {
    await Promise.allSettled(uploaded.map((item) => deleteObject(ref(services.storage, item.fullPath))));
    if (listingId) {
      if (input.listingType === "auction") {
        await cancelAuctionListing(listingId).catch(() => undefined);
      } else {
        const failedRef = doc(services.db, "listings", listingId);
        try { await deleteDoc(failedRef); } catch { await updateDoc(failedRef, { status: "removed", updatedAt: serverTimestamp() }).catch(() => undefined); }
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
  try {
    let newIndex = 0;
    const imageUrls = orderedPhotos.map((photo) => photo.existing ? photo.url : uploaded[newIndex++]?.url ?? "");
    if (input.listingType === "auction") await saveAuction(id, input, imageUrls);
    else await updateDoc(doc(services.db, "listings", id), { ...prepareBuyNowListing(input), imageUrls, updatedAt: serverTimestamp() });
  } catch (error) {
    await Promise.allSettled(uploaded.map((item) => deleteObject(ref(services.storage, item.fullPath))));
    throw error;
  }

  const removed = current.imageUrls.filter((url) => !retainedImageUrls.includes(url));
  await Promise.allSettled(removed.map(async (url) => {
    const objectRef = ref(services.storage, url);
    if (objectRef.fullPath.startsWith(`users/${services.user.uid}/listings/${id}/`)) await deleteObject(objectRef);
  }));
}

export async function deleteListing(id: string) {
  const services = requireServices();
  const current = await getListing(id);
  if (!current) throw new Error("Listing not found.");
  if (current.sellerId !== services.user.uid) throw new Error("You are not allowed to remove this listing.");
  if (current.listingType === "auction" || current.listingType === "buy_now_and_auction") await cancelAuctionListing(id);
  else await updateDoc(doc(services.db, "listings", id), { status: "removed", updatedAt: serverTimestamp() });
}
