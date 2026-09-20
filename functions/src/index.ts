import { getApp, initializeApp } from "firebase-admin/app";
import { Timestamp, getFirestore, type DocumentData, type Transaction } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  effectiveAuctionStatus,
  minimumNextBid,
  validateAuctionSettings,
  validateBidAmount,
  type AuctionSettings,
} from "./auction-domain";

initializeApp();
setGlobalOptions({ region: "asia-southeast1", maxInstances: 20 });

const db = getFirestore();
const LISTINGS = "listings";
const ALLOWED_CONDITIONS = new Set(["New", "Like new", "Good", "Fair"]);

function requireUser(request: CallableRequest<unknown>) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in before managing an auction.");
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

function optionalCoordinate(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new HttpsError("invalid-argument", `${field} is invalid.`);
  return value;
}

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
  const condition = requireString(input.condition, "Condition", 1, 20);
  if (!ALLOWED_CONDITIONS.has(condition)) throw new HttpsError("invalid-argument", "Condition is invalid.");
  const location = requireString(input.location, "Location", 2, 120);
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
    location,
    latitude: optionalCoordinate(input.latitude, "Latitude"),
    longitude: optionalCoordinate(input.longitude, "Longitude"),
    ...settings,
  };
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
    const objectPath = match ? decodeURIComponent(match[2]!) : "";
    if (!match || !allowedBuckets.has(match[1]!) || !objectPath.startsWith(`users/${uid}/listings/${listingId}/`) || paths.has(objectPath)) {
      throw new HttpsError("invalid-argument", "Listing images must belong to this auction.");
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

function listingContent(input: ReturnType<typeof parseListingPayload>) {
  return {
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    condition: input.condition,
    location: input.location,
    ...(input.latitude === undefined ? {} : { latitude: input.latitude }),
    ...(input.longitude === undefined ? {} : { longitude: input.longitude }),
    price: input.startingBid / 100,
    listingType: "auction",
    locationKey: normalizeSearch(input.location),
    searchTokens: createSearchTokens(input.title),
    facetKeys: createFacetKeys(input.categoryId, input.condition, "auction", input.location),
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
    currentBidderId: typeof data.currentBidderId === "string" ? data.currentBidderId : null,
    bidCount: Number(data.bidCount ?? 0),
    auctionStatus: data.auctionStatus,
    auctionStartAt: date(data.auctionStartAt),
    auctionEndAt: date(data.auctionEndAt),
    winnerId: typeof data.winnerId === "string" ? data.winnerId : null,
    finalBid: Number.isSafeInteger(data.finalBid) ? data.finalBid : null,
    endedAt: date(data.endedAt),
  };
}

export const createAuctionListing = onCall(async (request) => {
  const uid = requireUser(request);
  const now = new Date();
  const input = parseListingPayload(request.data, now);
  const listingRef = db.collection(LISTINGS).doc();
  const timestamp = Timestamp.fromDate(now);
  const auctionStatus = input.auctionStartAt.getTime() <= now.getTime() ? "active" : "scheduled";
  await listingRef.create({
    id: listingRef.id,
    sellerId: uid,
    ...listingContent(input),
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
  return { listingId: listingRef.id };
});

export const publishAuctionListing = onCall(async (request) => {
  const uid = requireUser(request);
  const input = request.data as { listingId?: unknown; imageUrls?: unknown };
  const listingId = requireString(input?.listingId, "Listing ID", 1, 128);
  const imageUrls = await verifyListingImages(uid, listingId, input?.imageUrls);
  const listingRef = db.collection(LISTINGS).doc(listingId);
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(listingRef);
    const data = snapshot.data();
    requireAuctionOwner(data, uid);
    if (data?.status !== "draft" || data.bidCount !== 0) throw new HttpsError("failed-precondition", "This auction cannot be published.");
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

export const updateAuctionListing = onCall(async (request) => {
  const uid = requireUser(request);
  const payload = request.data as Record<string, unknown>;
  const listingId = requireString(payload?.listingId, "Listing ID", 1, 128);
  const input = parseListingPayload(payload, new Date());
  const imageUrls = await verifyListingImages(uid, listingId, payload.imageUrls);
  const listingRef = db.collection(LISTINGS).doc(listingId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(listingRef);
    const data = snapshot.data();
    requireAuctionOwner(data, uid);
    const now = Timestamp.now();
    if (data?.auctionStatus !== "scheduled" || data.bidCount !== 0 || !(data.auctionStartAt instanceof Timestamp) || now.toMillis() >= data.auctionStartAt.toMillis()) {
      throw new HttpsError("failed-precondition", "Auction settings are locked after the auction starts.");
    }
    transaction.update(listingRef, { ...listingContent(input), imageUrls, auctionStatus: "scheduled", updatedAt: now });
  });
  return { listingId };
});

export const placeBid = onCall(async (request) => {
  const uid = requireUser(request);
  const input = request.data as { listingId?: unknown; amount?: unknown };
  const listingId = requireString(input?.listingId, "Listing ID", 1, 128);
  const listingRef = db.collection(LISTINGS).doc(listingId);
  const bidRef = listingRef.collection("bids").doc();

  const result = await db.runTransaction(async (transaction) => {
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
    transaction.create(bidRef, { bidderId: uid, amount, createdAt: now });
    transaction.update(listingRef, {
      currentBid: amount,
      currentBidderId: uid,
      bidCount: bidCount + 1,
      auctionStatus: "active",
      updatedAt: now,
    });
    return { ...data, currentBid: amount, currentBidderId: uid, bidCount: bidCount + 1, auctionStatus: "active", updatedAt: now };
  });
  return serializeAuction(result);
});

export const cancelAuction = onCall(async (request) => {
  const uid = requireUser(request);
  const input = request.data as { listingId?: unknown };
  const listingId = requireString(input?.listingId, "Listing ID", 1, 128);
  const listingRef = db.collection(LISTINGS).doc(listingId);
  const result = await db.runTransaction(async (transaction) => {
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
  await Promise.all(Array.from(references.values()).map((listingRef) => db.runTransaction(async (transaction) => {
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
} from "./intelligence";

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
