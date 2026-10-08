import { consumeActionCadence } from "./action-cadence";
import { marketplaceMutationCall, runGuardedTransaction } from "./account-lifecycle";
import { assertAuctionCreationAvailable } from "./auction-creation-runtime.ts";
import { getApp, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore, type DocumentData, type Transaction } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  effectiveAuctionStatus,
  minimumNextBid,
  validateAuctionSettings,
  validateBidAmount,
  type AuctionSettings,
} from "./auction-domain";
import { ringgitToSen } from "./transaction-domain";
import { displayPublicLocation, publishableLocation, validatePublicLocation } from "./general-location";
import { deleteListingMedia, listingMediaPrefix } from "./listing-media-cleanup";

initializeApp();
setGlobalOptions({ region: "asia-southeast1", maxInstances: 20 });

const db = getFirestore();
const LISTINGS = "listings";
const ALLOWED_CONDITIONS = new Set(["New", "Like new", "Good", "Fair"]);
const ALLOWED_CATEGORIES = new Set(["electronics", "fashion", "home-living", "games", "toys-hobbies", "sports", "automotive", "books", "collectibles", "tools", "baby-kids", "tv-home-appliances", "health-nutrition", "others"]);

function requireUser(request: CallableRequest<unknown>) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in before managing a listing.");
  return request.auth.uid;
}

function requireString(value: unknown, field: string, minimum: number, maximum: number) {
  if (typeof value !== "string") throw new HttpsError("invalid-argument", `${field} is required.`);
  const trimmed = value.trim();
  if (trimmed.length < minimum || trimmed.length > maximum) {
    throw new HttpsError("invalid-argument", `${field} must be between ${minimum} and ${maximum} characters.`);
  }
  return trimmed;
}

function requireId(value: unknown, field: string) {
  const id = requireString(value, field, 1, 128);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new HttpsError("invalid-argument", `${field} is invalid.`);
  return id;
}

function requirePublicLocation(value: unknown) {
  const location = validatePublicLocation(value);
  if (!location) throw new HttpsError("invalid-argument", "Please add your general location before publishing.");
  return location;
}

async function selectedMeetup(uid: string, value: unknown) {
  if (value === undefined || value === null || value === "") return { meetupLocationId: null, meetupLocation: null };
  const meetupLocationId = requireId(value, "Meet-up location ID");
  const snapshot = await db.doc(`users/${uid}/meetupLocations/${meetupLocationId}`).get();
  const data = snapshot.data();
  if (!data || data.ownerId !== uid) throw new HttpsError("permission-denied", "Choose one of your own meet-up locations.");
  const location = validatePublicLocation({ districtOrCity: data.area, state: data.state, country: data.country });
  if (!location || typeof data.name !== "string" || data.name.trim().length < 2 || data.name.trim().length > 80) throw new HttpsError("invalid-argument", "The selected meet-up location is invalid.");
  return { meetupLocationId, meetupLocation: { name: data.name.trim(), area: location.districtOrCity, state: location.state, country: location.country } };
}

const legacyPreciseFields = { latitude: FieldValue.delete(), longitude: FieldValue.delete(), coordinates: FieldValue.delete(), gps: FieldValue.delete(), geohash: FieldValue.delete(), address: FieldValue.delete(), addressLine1: FieldValue.delete(), addressLine2: FieldValue.delete(), fullAddress: FieldValue.delete(), street: FieldValue.delete(), streetAddress: FieldValue.delete(), unitNumber: FieldValue.delete(), houseNumber: FieldValue.delete(), postcode: FieldValue.delete(), postalCode: FieldValue.delete(), privateAddress: FieldValue.delete(), exactAddress: FieldValue.delete(), preciseLocation: FieldValue.delete() };

function normalizeSearch(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ");
}

function createSearchTokens(title: string) {
  const normalized = normalizeSearch(title);
  const words = normalized.split(" ").filter(Boolean);
  const tokens = new Set<string>();
  for (const word of words) {
    for (let length = 2; length <= Math.min(word.length, 20); length += 1) tokens.add(word.slice(0, length));
  }
  for (let length = 2; length <= Math.min(normalized.length, 40); length += 1) tokens.add(normalized.slice(0, length));
  return Array.from(tokens).slice(0, 100);
}

function createFacetKeys(categoryId: string, condition: string, listingType: string, location: string) {
  const values = [categoryId, condition, listingType, normalizeSearch(location)];
  const keys = new Set<string>();
  for (let mask = 0; mask < 16; mask += 1) {
    keys.add(values.map((value, index) => mask & (1 << index) ? value : "*").join("|"));
  }
  return Array.from(keys);
}

function parseListingPayload(value: unknown, now = new Date()) {
  if (!value || typeof value !== "object") throw new HttpsError("invalid-argument", "Auction details are required.");
  const input = value as Record<string, unknown>;
  const title = requireString(input.title, "Title", 6, 80);
  const description = requireString(input.description, "Description", 20, 1200);
  const categoryId = requireString(input.categoryId, "Category", 1, 60);
  if (!ALLOWED_CATEGORIES.has(categoryId)) throw new HttpsError("invalid-argument", "Category is invalid.");
  const condition = requireString(input.condition, "Condition", 1, 20);
  if (!ALLOWED_CONDITIONS.has(condition)) throw new HttpsError("invalid-argument", "Condition is invalid.");
  const allowed = new Set(["title", "description", "categoryId", "condition", "listingType", "startingBid", "minimumBidIncrement", "auctionStartAt", "auctionEndAt", "publicLocation", "meetupLocationId", "listingId", "imageUrls"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new HttpsError("invalid-argument", "Invalid auction listing fields.");
  if (input.listingType !== "auction") throw new HttpsError("invalid-argument", "Listing type is invalid.");
  const publicLocation = requirePublicLocation(input.publicLocation);
  const settings: AuctionSettings = {
    startingBid: input.startingBid as number,
    minimumBidIncrement: input.minimumBidIncrement as number,
    auctionStartAt: new Date(String(input.auctionStartAt ?? "")),
    auctionEndAt: new Date(String(input.auctionEndAt ?? "")),
  };
  const errors = validateAuctionSettings(settings, now);
  if (errors.length) throw new HttpsError("invalid-argument", errors[0] ?? "Auction details are invalid.");
  return {
    title,
    description,
    categoryId,
    condition,
    publicLocation,
    meetupLocationId: input.meetupLocationId,
    ...settings,
  };
}

function parseFixedPayload(value: unknown, updating = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpsError("invalid-argument", "Listing details are required.");
  const input = value as Record<string, unknown>;
  const allowed = new Set(["title", "description", "categoryId", "condition", "price", "listingType", "publicLocation", "meetupLocationId", ...(updating ? ["listingId", "imageUrls"] : [])]);
  if (Object.keys(input).some((key) => !allowed.has(key)) || input.listingType !== "buy_now") throw new HttpsError("invalid-argument", "Invalid fixed-price listing fields.");
  const title = requireString(input.title, "Title", 6, 80);
  const description = requireString(input.description, "Description", 20, 1200);
  const categoryId = requireString(input.categoryId, "Category", 1, 60);
  if (!ALLOWED_CATEGORIES.has(categoryId)) throw new HttpsError("invalid-argument", "Category is invalid.");
  const condition = requireString(input.condition, "Condition", 1, 20);
  if (!ALLOWED_CONDITIONS.has(condition)) throw new HttpsError("invalid-argument", "Condition is invalid.");
  const publicLocation = requirePublicLocation(input.publicLocation);
  const location = displayPublicLocation(publicLocation);
  const priceSen = ringgitToSen(input.price);
  if (priceSen === null) throw new HttpsError("invalid-argument", "Price must be positive MYR with no more than two decimal places.");
  return { title, description, categoryId, condition, publicLocation, location, privacyVersion: 2, meetupLocationId: input.meetupLocationId,
    price: priceSen / 100,
    locationKey: normalizeSearch(location), searchTokens: createSearchTokens(title), facetKeys: createFacetKeys(categoryId, condition, "buy_now", location), listingType: "buy_now" as const };
}

async function verifyListingImages(uid: string, listingId: string, value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8 || value.some((url) => typeof url !== "string" || url.length > 2048)) {
    throw new HttpsError("invalid-argument", "Provide between 1 and 8 valid listing images.");
  }
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || getApp().options.projectId;
  if (!projectId) throw new HttpsError("internal", "Firebase project configuration is missing.");
  const allowedBuckets = new Set([`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`]);
  const paths = new Set<string>();
  for (const rawUrl of value as string[]) {
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new HttpsError("invalid-argument", "A listing image URL is invalid."); }
    const emulatorUrl = Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST)
      && url.protocol === "http:"
      && ["127.0.0.1", "localhost"].includes(url.hostname);
    if (!(emulatorUrl || (url.protocol === "https:" && url.hostname === "firebasestorage.googleapis.com")) || !url.searchParams.get("token") || url.searchParams.get("alt") !== "media") {
      throw new HttpsError("invalid-argument", "Listing images must be uploaded to Firebase Storage.");
    }
    const match = /^\/v0\/b\/([^/]+)\/o\/([^/]+)$/.exec(url.pathname);
    let objectPath = "";
    try { objectPath = match ? decodeURIComponent(match[2]!) : ""; }
    catch { throw new HttpsError("invalid-argument", "A listing image URL is invalid."); }
    if (!match || !allowedBuckets.has(match[1]!) || !objectPath.startsWith(listingMediaPrefix(uid, listingId)) || paths.has(objectPath)) {
      throw new HttpsError("invalid-argument", "Listing images must belong to this listing.");
    }
    const bucket = getStorage().bucket(match[1]!);
    const [metadata] = await bucket.file(objectPath).getMetadata().catch(() => {
      throw new HttpsError("invalid-argument", "A listing image is missing from Storage.");
    });
    const downloadTokens = String(metadata.metadata?.firebaseStorageDownloadTokens ?? "").split(",");
    if (!downloadTokens.includes(url.searchParams.get("token")!)) {
      throw new HttpsError("invalid-argument", "A listing image download token is invalid.");
    }
    if (!/^image\/(jpeg|png|webp)$/.test(String(metadata.contentType)) || Number(metadata.size) > 8 * 1024 * 1024) {
      throw new HttpsError("invalid-argument", "A listing image has an invalid type or size.");
    }
    paths.add(objectPath);
  }
  return value as string[];
}

export const createFixedListingDraft = marketplaceMutationCall(async (request) => {
  const uid = requireUser(request);
  const content = parseFixedPayload(request.data);
  const meetup = await selectedMeetup(uid, content.meetupLocationId);
  const ref = db.collection(LISTINGS).doc();
  const now = Timestamp.now();
  await runGuardedTransaction(db, async (tx) => { await consumeActionCadence(tx, uid, "listing", now); tx.create(ref, { id: ref.id, sellerId: uid, ...content, ...meetup, imageUrls: [], status: "draft", createdAt: now, updatedAt: now }); });
  return { listingId: ref.id };
});

async function requireFixedOwner(uid: string, listingId: string) {
  const snapshot = await db.collection(LISTINGS).doc(listingId).get();
  if (!snapshot.exists || snapshot.data()?.sellerId !== uid) throw new HttpsError("permission-denied", "This listing is not yours.");
  if (snapshot.data()?.listingType !== "buy_now") throw new HttpsError("failed-precondition", "This listing is not fixed-price.");
}

export const publishFixedListing = marketplaceMutationCall(async (request) => {
  const uid = requireUser(request);
  const listingId = requireId(request.data?.listingId, "Listing ID");
  await requireFixedOwner(uid, listingId);
  const imageUrls = await verifyListingImages(uid, listingId, request.data?.imageUrls);
  const ref = db.collection(LISTINGS).doc(listingId);
  await runGuardedTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (!data || data.sellerId !== uid) throw new HttpsError("permission-denied", "This listing is not yours.");
    if (data.listingType !== "buy_now" || data.status !== "draft") throw new HttpsError("failed-precondition", "This listing cannot be published.");
    if (!publishableLocation(data) || data.privacyVersion !== 2) throw new HttpsError("failed-precondition", "Please add your general location before publishing.");
    tx.update(ref, { imageUrls, status: "active", updatedAt: Timestamp.now() });
  });
  return { listingId };
});

export const updateFixedListing = marketplaceMutationCall(async (request) => {
  const uid = requireUser(request);
  const listingId = requireId(request.data?.listingId, "Listing ID");
  const content = parseFixedPayload(request.data, true);
  const meetup = await selectedMeetup(uid, content.meetupLocationId);
  await requireFixedOwner(uid, listingId);
  const imageUrls = await verifyListingImages(uid, listingId, request.data?.imageUrls);
  const ref = db.collection(LISTINGS).doc(listingId);
  await runGuardedTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (!data || data.sellerId !== uid) throw new HttpsError("permission-denied", "This listing is not yours.");
    if (data.listingType !== "buy_now" || !["draft", "active"].includes(data.status)) throw new HttpsError("failed-precondition", "This listing cannot be edited.");
    tx.update(ref, { ...content, ...meetup, ...legacyPreciseFields, imageUrls, updatedAt: Timestamp.now() });
  });
  return { listingId };
});

// Cloud Run's browser preflight invoker binding is repaired separately by
// scripts/repair-remove-fixed-listing-invoker.sh; callable auth remains required.
export const removeFixedListing = marketplaceMutationCall(async (request) => {
  const uid = requireUser(request);
  const listingId = requireId(request.data?.listingId, "Listing ID");
  const ref = db.collection(LISTINGS).doc(listingId);
  const imageUrls = await runGuardedTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (!data || data.sellerId !== uid) throw new HttpsError("permission-denied", "This listing is not yours.");
    if (data.listingType !== "buy_now" || !["draft", "active", "removed"].includes(data.status)) throw new HttpsError("failed-precondition", "This listing cannot be removed.");
    if (data.status !== "removed") tx.update(ref, { status: "removed", updatedAt: Timestamp.now() });
    return data.imageUrls;
  });
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || getApp().options.projectId;
  if (!projectId) throw new HttpsError("internal", "Firebase project configuration is missing.");
  const bucketNames = [`${projectId}.firebasestorage.app`];
  if (Array.isArray(imageUrls) && imageUrls.some((value) => typeof value === "string" && value.includes(`/b/${projectId}.appspot.com/o/`))) {
    bucketNames.push(`${projectId}.appspot.com`);
  }
  try {
    for (const bucketName of bucketNames) await deleteListingMedia(getStorage().bucket(bucketName), uid, listingId);
  } catch {
    // A repeated owner call can complete cleanup after a transient Storage failure.
    throw new HttpsError("internal", "The listing was removed, but its images could not be cleaned up. Please retry removal.");
  }
  return { listingId, status: "removed" };
});

function listingContent(input: ReturnType<typeof parseListingPayload>) {
  return {
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    condition: input.condition,
    publicLocation: input.publicLocation,
    location: displayPublicLocation(input.publicLocation),
    privacyVersion: 2,
    price: input.startingBid / 100,
    listingType: "auction",
    locationKey: normalizeSearch(displayPublicLocation(input.publicLocation)),
    searchTokens: createSearchTokens(input.title),
    facetKeys: createFacetKeys(input.categoryId, input.condition, "auction", displayPublicLocation(input.publicLocation)),
    startingBid: input.startingBid,
    minimumBidIncrement: input.minimumBidIncrement,
    auctionStartAt: Timestamp.fromDate(input.auctionStartAt),
    auctionEndAt: Timestamp.fromDate(input.auctionEndAt),
  };
}

function requireAuctionOwner(data: DocumentData | undefined, uid: string) {
  if (!data) throw new HttpsError("not-found", "Auction listing not found.");
  if (data.sellerId !== uid) throw new HttpsError("permission-denied", "Only the seller can manage this auction.");
  if (data.listingType !== "auction" && data.listingType !== "buy_now_and_auction") {
    throw new HttpsError("failed-precondition", "This listing is not an auction.");
  }
}

function serializeAuction(data: DocumentData) {
  const date = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() : null;
  return {
    currentBid: Number(data.currentBid ?? 0),
    bidCount: Number(data.bidCount ?? 0),
    auctionStatus: data.auctionStatus,
    auctionStartAt: date(data.auctionStartAt),
    auctionEndAt: date(data.auctionEndAt),
    finalBid: Number.isSafeInteger(data.finalBid) ? data.finalBid : null,
    endedAt: date(data.endedAt),
  };
}

export const createAuctionListing = marketplaceMutationCall(async (request) => {
  const uid = requireUser(request);
  await assertAuctionCreationAvailable();
  const now = new Date();
  const input = parseListingPayload(request.data, now);
  const meetup = await selectedMeetup(uid, input.meetupLocationId);
  const listingRef = db.collection(LISTINGS).doc();
  const timestamp = Timestamp.fromDate(now);
  const auctionStatus = input.auctionStartAt.getTime() <= now.getTime() ? "active" : "scheduled";
  await runGuardedTransaction(db, async (tx) => { await assertAuctionCreationAvailable(tx); await consumeActionCadence(tx, uid, "listing", timestamp); tx.create(listingRef, {
    id: listingRef.id,
    sellerId: uid,
    ...listingContent(input),
    ...meetup,
    imageUrls: [],
    status: "draft",
    currentBid: 0,
    currentBidderId: null,
    bidCount: 0,
    auctionStatus,
    winnerId: null,
    finalBid: null,
    endedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  });
  return { listingId: listingRef.id };
});

export const publishAuctionListing = marketplaceMutationCall(async (request) => {
  const uid = requireUser(request);
  await assertAuctionCreationAvailable();
  const input = request.data as { listingId?: unknown; imageUrls?: unknown };
  const listingId = requireId(input?.listingId, "Listing ID");
  const imageUrls = await verifyListingImages(uid, listingId, input?.imageUrls);
  const listingRef = db.collection(LISTINGS).doc(listingId);
  const result = await runGuardedTransaction(db, async (transaction) => {
    await assertAuctionCreationAvailable(transaction);
    const snapshot = await transaction.get(listingRef);
    const data = snapshot.data();
    requireAuctionOwner(data, uid);
    if (data?.status !== "draft" || data.bidCount !== 0) throw new HttpsError("failed-precondition", "This auction cannot be published.");
    if (!publishableLocation(data) || data.privacyVersion !== 2) throw new HttpsError("failed-precondition", "Please add your general location before publishing.");
    const now = Timestamp.now();
    if (!(data.auctionEndAt instanceof Timestamp) || now.toMillis() >= data.auctionEndAt.toMillis()) {
      throw new HttpsError("failed-precondition", "This auction has already expired.");
    }
    const auctionStatus = now.toMillis() >= data.auctionStartAt.toMillis() ? "active" : "scheduled";
    transaction.update(listingRef, { imageUrls, status: "active", auctionStatus, updatedAt: now });
    return { ...data, imageUrls, status: "active", auctionStatus, updatedAt: now };
  });
  return serializeAuction(result);
});

export const updateAuctionListing = marketplaceMutationCall(async (request) => {
  const uid = requireUser(request);
  const payload = request.data as Record<string, unknown>;
  const listingId = requireId(payload?.listingId, "Listing ID");
  const input = parseListingPayload(payload, new Date());
  const meetup = await selectedMeetup(uid, input.meetupLocationId);
  const imageUrls = await verifyListingImages(uid, listingId, payload.imageUrls);
  const listingRef = db.collection(LISTINGS).doc(listingId);
  await runGuardedTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(listingRef);
    const data = snapshot.data();
    requireAuctionOwner(data, uid);
    const now = Timestamp.now();
    const resumableDraft = data?.status === "draft" && data.auctionStatus === "scheduled" && data.bidCount === 0;
    const editablePublishedAuction = data?.status === "active" && data.auctionStatus === "scheduled" && data.bidCount === 0
      && data.auctionStartAt instanceof Timestamp && now.toMillis() < data.auctionStartAt.toMillis();
    if (!resumableDraft && !editablePublishedAuction) {
      throw new HttpsError("failed-precondition", "Auction settings are locked after the auction starts.");
    }
    transaction.update(listingRef, { ...listingContent(input), ...meetup, ...legacyPreciseFields, imageUrls, auctionStatus: "scheduled", updatedAt: now });
  });
  return { listingId };
});

export const placeBid = marketplaceMutationCall(async (request) => {
  const uid = requireUser(request);
  const input = request.data as { listingId?: unknown; amount?: unknown };
  const listingId = requireId(input?.listingId, "Listing ID");
  const listingRef = db.collection(LISTINGS).doc(listingId);
  const bidRef = listingRef.collection("bids").doc();

  const result = await runGuardedTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(listingRef);
    const data = snapshot.data();
    if (!data) throw new HttpsError("not-found", "Auction listing not found.");
    if (data.listingType !== "auction" && data.listingType !== "buy_now_and_auction") throw new HttpsError("failed-precondition", "This listing is not an auction.");
    if (data.auctionStatus === "cancelled") throw new HttpsError("failed-precondition", "This auction was cancelled.");
    if (data.auctionStatus === "ended") throw new HttpsError("failed-precondition", "This auction has ended.");
    if (data.status !== "active") throw new HttpsError("failed-precondition", "This auction is unavailable.");
    if (data.sellerId === uid) throw new HttpsError("permission-denied", "Sellers cannot bid on their own auction.");
    if (!(data.auctionStartAt instanceof Timestamp) || !(data.auctionEndAt instanceof Timestamp)) throw new HttpsError("failed-precondition", "Auction timing is invalid.");
    const now = Timestamp.now();
    const computedStatus = effectiveAuctionStatus(data.auctionStatus, data.auctionStartAt.toDate(), data.auctionEndAt.toDate(), now.toDate());
    if (computedStatus === "scheduled") throw new HttpsError("failed-precondition", "This auction has not started yet.");
    if (computedStatus === "ended") throw new HttpsError("failed-precondition", "This auction has ended.");
    if (computedStatus === "cancelled") throw new HttpsError("failed-precondition", "This auction was cancelled.");
    const bidCount = Number(data.bidCount ?? 0);
    const currentBid = Number(data.currentBid ?? 0);
    const minimum = minimumNextBid(Number(data.startingBid), currentBid, bidCount, Number(data.minimumBidIncrement));
    const amountError = validateBidAmount(input.amount, minimum);
    if (amountError) throw new HttpsError("invalid-argument", amountError);
    const amount = Number(input.amount);
    await consumeActionCadence(transaction, uid, "bid", now);
    transaction.create(bidRef, { bidderId: uid, amount, outbidUserId: typeof data.currentBidderId === "string" && data.currentBidderId !== uid ? data.currentBidderId : null, createdAt: now });
    transaction.update(listingRef, {
      currentBid: amount,
      // `price` is the indexed discovery amount for mixed fixed-price/auction sorting.
      // Starting bid remains immutable in `startingBid`; the displayed current bid is indexed here.
      price: amount / 100,
      currentBidderId: uid,
      bidCount: bidCount + 1,
      auctionStatus: "active",
      updatedAt: now,
    });
    return { ...data, currentBid: amount, currentBidderId: uid, bidCount: bidCount + 1, auctionStatus: "active", updatedAt: now };
  });
  return serializeAuction(result);
});

export const cancelAuction = marketplaceMutationCall(async (request) => {
  const uid = requireUser(request);
  const input = request.data as { listingId?: unknown };
  const listingId = requireId(input?.listingId, "Listing ID");
  const listingRef = db.collection(LISTINGS).doc(listingId);
  const result = await runGuardedTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(listingRef);
    const data = snapshot.data();
    requireAuctionOwner(data, uid);
    if (data?.auctionStatus === "ended" || data?.auctionStatus === "cancelled") throw new HttpsError("failed-precondition", "This auction can no longer be cancelled.");
    if (Number(data?.bidCount ?? 0) > 0) throw new HttpsError("failed-precondition", "An auction with bids cannot be cancelled.");
    const now = Timestamp.now();
    if (data?.status !== "draft" && data?.auctionEndAt instanceof Timestamp && now.toMillis() >= data.auctionEndAt.toMillis()) throw new HttpsError("failed-precondition", "This auction has already ended.");
    const status = data?.status === "draft" ? "removed" : "ended";
    transaction.update(listingRef, { auctionStatus: "cancelled", status, winnerId: null, finalBid: null, endedAt: now, updatedAt: now });
    return { ...data, auctionStatus: "cancelled", status, winnerId: null, finalBid: null, endedAt: now, updatedAt: now };
  });
  return serializeAuction(result);
});

async function advanceListing(transaction: Transaction, listingRef: FirebaseFirestore.DocumentReference, data: DocumentData, now: Timestamp) {
  if (data.status !== "active") return;
  if (!(data.auctionStartAt instanceof Timestamp) || !(data.auctionEndAt instanceof Timestamp)) return;
  if (data.auctionStatus === "scheduled" && now.toMillis() >= data.auctionStartAt.toMillis() && now.toMillis() < data.auctionEndAt.toMillis()) {
    transaction.update(listingRef, { auctionStatus: "active", updatedAt: now });
    return;
  }
  if ((data.auctionStatus === "scheduled" || data.auctionStatus === "active") && now.toMillis() >= data.auctionEndAt.toMillis()) {
    const hasWinner = Number(data.bidCount ?? 0) > 0 && typeof data.currentBidderId === "string";
    transaction.update(listingRef, {
      auctionStatus: "ended",
      status: "ended",
      winnerId: hasWinner ? data.currentBidderId : null,
      finalBid: hasWinner ? Number(data.currentBid) : null,
      endedAt: now,
      updatedAt: now,
    });
  }
}

async function advanceDueAuctions(now: Timestamp) {
  const [starting, ending] = await Promise.all([
    db.collection(LISTINGS).where("status", "==", "active").where("auctionStatus", "==", "scheduled").where("auctionStartAt", "<=", now).limit(200).get(),
    db.collection(LISTINGS).where("status", "==", "active").where("auctionStatus", "==", "active").where("auctionEndAt", "<=", now).limit(200).get(),
  ]);
  const references = new Map<string, FirebaseFirestore.DocumentReference>();
  for (const snapshot of [...starting.docs, ...ending.docs]) references.set(snapshot.ref.path, snapshot.ref);
  await Promise.all(Array.from(references.values()).map((listingRef) => runGuardedTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(listingRef);
    if (snapshot.exists) await advanceListing(transaction, listingRef, snapshot.data()!, now);
  })));
}

export const advanceAuctionLifecycle = onSchedule({ schedule: "every 1 minutes", timeZone: "UTC", timeoutSeconds: 120 }, async () => {
  await advanceDueAuctions(Timestamp.now());
});

export const _test = { parseListingPayload, createSearchTokens, createFacetKeys, advanceListing, advanceDueAuctions };

export {
  trackMarketplaceEvent,
  getMarketplaceRecommendations,
  onSavedListingCreated,
  onSavedListingDeleted,
  onAuctionBidCreated,
  onConversationStarted,
  onConversationMessageCreated,
  onCompletedTransactionInterest,
} from "./intelligence";

export { getMarketplaceDiscovery, getMarketplaceSimilar } from "./discovery";

export {
  getPromotionPackages,
  createPromotionRequest,
  cancelPromotionRequest,
  getMyPromotionRequests,
  getPromotionPlacements,
  getFeaturedPromotions,
  trackPromotionEngagement,
  expirePromotions,
  onPromotedListingUpdated,
} from "./promotions";

export {
  getReputationPolicy,
  submitOffer,
  respondToOffer,
  expireOffers,
  onAuctionWonCreateTransaction,
  confirmTransactionCompletion,
  requestTransactionCancellation,
  declineTransactionCancellation,
  disputeTransaction,
  getListingDealState,
  getMyTransactions,
  getTransactionDetail,
  submitTransactionReview,
  releaseExpiredReviews,
  getPublicReviews,
  reportPublicReview,
} from "./transactions";

export { getAdminMetrics, getAdminPage, getAdminRecord, updateAdminReport, loadAdminReportContext } from "./admin";

export {
  getUnreadCount, getNotifications, markNotificationRead, openNotification, markAllNotificationsRead,
  getNotificationPreferences, setNotificationPreference, getFollowState,
  setSellerFollow, getFollowing, saveSearch, deleteSavedSearch, getSavedSearches,
  onSavedWatchChanged, onListingEngagementChanged, onBidEngagementCreated,
  onOfferEngagementCreated, onOfferEngagementUpdated,
  onTransactionEngagementCreated, onTransactionEngagementUpdated,
  onMessageEngagementCreated,
  processEngagementJobs, queueEndingAuctionAlerts,
} from "./engagement";

export { getPublicSellerSummaries } from "./public-sellers";
export { getPublicListingDetail, getAuctionViewerState, getMyListingHistory } from "./public-listings";
export { getPublicListingPage } from "./public-listings";
export { submitMarketplaceReport } from "./reports";
export { openListingConversation, openTransactionConversation, getConversation, getConversations, getConversationMessages, sendConversationMessage, markConversationSeen, onTransactionConversationCreated } from "./messaging";

export {
  getProtectedPaymentPolicy,
  getSellerPaymentOnboarding,
  createProtectedPayment,
  respondToProtectedDispute,
  addProtectedDisputeEvidence,
} from "./protected-transactions";

export { getAccountDeletionAvailability, getAccountDeletionStatus, requestAccountDeletion, retryAccountDeletion, processAccountDeletions } from "./account-deletion";
export { getAccountSetupStatus, acceptWebPolicies, completeFirstTimeProfile, finishAccountWelcome } from "./auth-onboarding";

export { requestUploadPermits } from "./upload-permits";
export { getProtectedWriteStatus } from "./protected-write-maintenance-runtime.ts";

export { getAdminSession, getAdminEditorialPage, getAdminEditorialRecord, mutateAdminEditorial, previewAdminHomepage, publishAdminHomepage, getPublicHomepage, requestAdminAssetPermit, finalizeAdminAsset, getAdminControlOverview, invalidateEditorialListing, invalidateEditorialSeller, invalidateEditorialLifecycle } from "./editorial";
