import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
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

export type ListingSort = "newest" | "price_low" | "price_high";

export interface ListingQuery {
  search?: string;
  categoryId?: string;
  condition?: string;
  listingType?: string;
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

function fromDocument(snapshot: QueryDocumentSnapshot<DocumentData> | { id: string; data(): DocumentData }): Listing {
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

  if (search.length >= 2) {
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

  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize + 1));
  const snapshot = await getDocs(query(collection(database, "listings"), ...constraints));
  const documents = snapshot.docs;
  const hasMore = documents.length > pageSize;
  const visible = documents.slice(0, pageSize);
  return { listings: visible.map(fromDocument), cursor: visible.at(-1) ?? null, hasMore };
}

export async function getListing(id: string) {
  const snapshot = await getDoc(doc(requireDatabase(), "listings", id));
  return snapshot.exists() ? fromDocument(snapshot) : null;
}

export async function getListingsBySeller(sellerId: string, includeRemoved = false) {
  const constraints: QueryConstraint[] = [where("sellerId", "==", sellerId)];
  if (!includeRemoved) constraints.push(where("status", "==", "active"));
  constraints.push(orderBy("createdAt", "desc"), limit(50));
  const snapshot = await getDocs(query(collection(requireDatabase(), "listings"), ...constraints));
  return snapshot.docs.map(fromDocument);
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
  for (const file of files) {
    const processed = await resizeImage(file);
    const filename = `${crypto.randomUUID()}.${processed.extension}`;
    const objectRef = ref(services.storage, `users/${uid}/listings/${listingId}/${filename}`);
    await uploadBytes(objectRef, processed.blob, { contentType: processed.contentType, cacheControl: "public,max-age=31536000,immutable" });
    try {
      uploaded.push({ url: await getDownloadURL(objectRef), fullPath: objectRef.fullPath });
    } catch (error) {
      await deleteObject(objectRef).catch(() => undefined);
      throw error;
    }
  }
  return uploaded;
}

function prepareListing(input: ListingInput) {
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
  const listingRef = doc(collection(services.db, "listings"));
  const data = prepareListing(input);
  const uploaded: { url: string; fullPath: string }[] = [];

  try {
    await setDoc(listingRef, { id: listingRef.id, sellerId: services.user.uid, ...data, imageUrls: [], status: "draft", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    uploaded.push(...await uploadListingImages(services.user.uid, listingRef.id, files));
    await updateDoc(listingRef, { imageUrls: uploaded.map((item) => item.url), status: "active", updatedAt: serverTimestamp() });
    return listingRef.id;
  } catch (error) {
    await Promise.allSettled(uploaded.map((item) => deleteObject(ref(services.storage, item.fullPath))));
    try { await deleteDoc(listingRef); } catch { await updateDoc(listingRef, { status: "removed", updatedAt: serverTimestamp() }).catch(() => undefined); }
    throw error;
  }
}

export async function updateListing(id: string, input: ListingInput, retainedImageUrls: string[], newFiles: File[]) {
  const services = requireServices();
  const current = await getListing(id);
  if (!current) throw new Error("Listing not found.");
  if (current.sellerId !== services.user.uid) throw new Error("You are not allowed to edit this listing.");
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
    await updateDoc(doc(services.db, "listings", id), { ...prepareListing(input), imageUrls: [...retainedImageUrls, ...uploaded.map((item) => item.url)], updatedAt: serverTimestamp() });
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
  await updateDoc(doc(services.db, "listings", id), { status: "removed", updatedAt: serverTimestamp() });
}
