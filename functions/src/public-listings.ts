import { marketplaceCall as onCall } from "./account-lifecycle";
import { getFirestore, Timestamp, type DocumentData, type Query } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { isPublicListingSafe, publishableLocation, validatePublicLocation } from "./general-location";
import { publicListing } from "./intelligence";

type Sort = "newest" | "price_low" | "price_high";
type Filters = {
  search: string; categoryId: string; condition: string; listingType: string;
  auctionStatus: string; location: string; maxPrice: number | null;
  sort: Sort; pageSize: number; sellerId: string;
};

const normalize = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, " ");
const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const publicStatuses = new Set(["active", "ended", "sold"]);
const auctionTypes = new Set(["auction", "buy_now_and_auction"]);

function listingId(value: unknown) {
  if (typeof value !== "string" || !idPattern.test(value)) throw new HttpsError("invalid-argument", "Listing ID is invalid.");
  return value;
}

function safeMeetup(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const location = validatePublicLocation({ districtOrCity: data.area, state: data.state, country: data.country });
  if (!location || typeof data.name !== "string" || data.name.trim().length < 2 || data.name.trim().length > 80) return null;
  return { name: data.name.trim(), area: location.districtOrCity, state: location.state, country: location.country };
}

function publicDetail(data: DocumentData, id: string) {
  return { ...publicListing(data, id), publicLocation: publishableLocation(data), meetupLocation: safeMeetup(data.meetupLocation) };
}

/** Public detail and bid history are field-whitelisted, including for authenticated callers. */
export const getPublicListingDetail = onCall(async (request) => {
  const id = listingId(request.data?.listingId);
  const db = getFirestore();
  const snapshot = await db.collection("listings").doc(id).get();
  const data = snapshot.data();
  if (!data || !publicStatuses.has(data.status) || !isPublicListingSafe(data)) throw new HttpsError("not-found", "Listing is unavailable.");
  const bids = auctionTypes.has(data.listingType) && ["active", "ended"].includes(data.status)
    ? (await snapshot.ref.collection("bids").orderBy("createdAt", "desc").limit(25).get()).docs.map((bid) => {
      const record = bid.data();
      return {
        amount: Number(record.amount),
        createdAt: record.createdAt instanceof Timestamp ? record.createdAt.toDate().toISOString() : "",
        isOwnBid: Boolean(request.auth?.uid && record.bidderId === request.auth.uid),
      };
    }) : [];
  return { listing: publicDetail(data, id), bids };
});

/** Authenticated viewer comparisons never serialize another participant's UID. */
export const getAuctionViewerState = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to view your auction status.");
  const id = listingId(request.data?.listingId);
  const db = getFirestore();
  const snapshot = await db.collection("listings").doc(id).get();
  const data = snapshot.data();
  if (!data || !auctionTypes.has(data.listingType) || !publicStatuses.has(data.status) || !isPublicListingSafe(data)) {
    throw new HttpsError("not-found", "Auction is unavailable.");
  }
  const isHighestBidder = data.status === "active" && data.currentBidderId === uid;
  const isWinner = data.status === "ended" && data.winnerId === uid;
  const hasBid = isHighestBidder || isWinner || !(await snapshot.ref.collection("bids").where("bidderId", "==", uid).limit(1).get()).empty;
  let transactionId: string | null = null;
  if (data.status === "ended" && (data.sellerId === uid || isWinner)) {
    const transaction = await db.collection("transactions").doc(`auction-${id}`).get();
    if (transaction.exists && [transaction.data()?.buyerId, transaction.data()?.sellerId].includes(uid)) transactionId = transaction.id;
  }
  return { isHighestBidder, isWinner, isOutbid: hasBid && !isHighestBidder && !isWinner, transactionId };
});

/** Owner history includes drafts but never serializes bidder or winner identity. */
export const getMyListingHistory = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to view your listings.");
  const page = await getFirestore().collection("listings").where("sellerId", "==", uid).orderBy("createdAt", "desc").limit(50).get();
  return { listings: page.docs.map((doc) => publicDetail(doc.data(), doc.id)) };
});

function parseRequest(value: unknown): { filters: Filters; cursor: string | null } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpsError("invalid-argument", "Listing filters are invalid.");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["filters", "cursor"].includes(key))) throw new HttpsError("invalid-argument", "Listing filters are invalid.");
  const raw = input.filters ?? {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpsError("invalid-argument", "Listing filters are invalid.");
  const fields = raw as Record<string, unknown>;
  const allowed = ["search", "categoryId", "condition", "listingType", "auctionStatus", "location", "maxPrice", "sort", "pageSize", "sellerId"];
  if (Object.keys(fields).some((key) => !allowed.includes(key))) throw new HttpsError("invalid-argument", "Listing filters are invalid.");
  const string = (key: string, max: number) => {
    const value = fields[key];
    if (value === undefined || value === null) return "";
    if (typeof value !== "string" || value.length > max) throw new HttpsError("invalid-argument", "Listing filters are invalid.");
    return value.trim();
  };
  const search = string("search", 120);
  const categoryId = string("categoryId", 60);
  const condition = string("condition", 20);
  const listingType = string("listingType", 30);
  const auctionStatus = string("auctionStatus", 20);
  const location = string("location", 120);
  const sellerId = string("sellerId", 128);
  if ((sellerId && !idPattern.test(sellerId)) || (listingType && !["buy_now", "auction"].includes(listingType))
    || (auctionStatus && !["active", "scheduled"].includes(auctionStatus))) throw new HttpsError("invalid-argument", "Listing filters are invalid.");
  const sort = fields.sort ?? "newest";
  if (sort !== "newest" && sort !== "price_low" && sort !== "price_high") throw new HttpsError("invalid-argument", "Listing sort is invalid.");
  const pageSize = fields.pageSize ?? 12;
  if (!Number.isSafeInteger(pageSize) || (pageSize as number) < 1 || (pageSize as number) > 50) throw new HttpsError("invalid-argument", "Listing page size is invalid.");
  const maxPrice = fields.maxPrice ?? null;
  if (maxPrice !== null && (typeof maxPrice !== "number" || !Number.isFinite(maxPrice) || maxPrice <= 0 || maxPrice > 10_000_000)) throw new HttpsError("invalid-argument", "Listing price filter is invalid.");
  const cursor = input.cursor ?? null;
  if (cursor !== null && (typeof cursor !== "string" || !idPattern.test(cursor))) throw new HttpsError("invalid-argument", "Listing cursor is invalid.");
  return { filters: { search, categoryId, condition, listingType, auctionStatus, location, maxPrice: maxPrice as number | null, sort, pageSize: pageSize as number, sellerId }, cursor };
}

function activeInventory(data: DocumentData) {
  if (data.status !== "active") return false;
  if (data.listingType === "buy_now") return Number.isFinite(data.price) && data.price > 0;
  if (data.auctionStatus !== "active" && data.auctionStatus !== "scheduled") return false;
  if (!data.auctionEndAt?.toDate || data.auctionEndAt.toDate().getTime() <= Date.now()) return false;
  if (!Number.isSafeInteger(data.startingBid) || data.startingBid <= 0) return false;
  return !(data.bidCount > 0 && (!Number.isSafeInteger(data.currentBid) || data.currentBid < data.startingBid));
}

function matches(data: DocumentData, filters: Filters) {
  if (!isPublicListingSafe(data) || !activeInventory(data)) return false;
  if (filters.categoryId && data.categoryId !== filters.categoryId) return false;
  if (filters.condition && data.condition !== filters.condition) return false;
  if (filters.listingType && data.listingType !== filters.listingType) return false;
  if (filters.auctionStatus && data.auctionStatus !== filters.auctionStatus) return false;
  const location = publishableLocation(data)!;
  if (filters.location && !normalize(`${location.districtOrCity}, ${location.state}`).includes(normalize(filters.location))) return false;
  if (filters.maxPrice && data.listingType !== "buy_now" && (data.bidCount > 0 ? data.currentBid : data.startingBid) / 100 > filters.maxPrice) return false;
  return true;
}

/** Public browse is a field-whitelisted callable. Raw listing collection queries remain owner/admin-only. */
export const getPublicListingPage = onCall(async (request) => {
  const { filters, cursor } = parseRequest(request.data);
  const db = getFirestore();
  let source: Query = db.collection("listings").where("status", "==", "active").where("privacyVersion", "==", 2);
  if (filters.sellerId) {
    source = source.where("sellerId", "==", filters.sellerId).orderBy("createdAt", "desc");
  } else {
    const search = normalize(filters.search);
    source = search.length >= 2
      ? source.where("searchTokens", "array-contains", search.slice(0, 40))
      : source.where("facetKeys", "array-contains", [filters.categoryId || "*", filters.condition || "*", filters.listingType || "*", normalize(filters.location) || "*"].join("|"));
    source = filters.maxPrice || filters.sort !== "newest"
      ? source.orderBy("price", filters.sort === "price_high" ? "desc" : "asc")
      : source.orderBy("createdAt", "desc");
    if (filters.maxPrice) source = source.where("price", "<=", filters.maxPrice);
  }
  let lastRead = cursor ? await db.collection("listings").doc(cursor).get() : null;
  if (cursor && !lastRead?.exists) throw new HttpsError("invalid-argument", "Listing cursor is unavailable.");
  const listings: Record<string, unknown>[] = [];
  let hasMore = false;
  for (let batch = 0; batch < 4 && listings.length < filters.pageSize; batch += 1) {
    const page = await (lastRead ? source.startAfter(lastRead) : source).limit(filters.pageSize + 1).get();
    const documents = page.docs.slice(0, filters.pageSize);
    hasMore = page.size > filters.pageSize;
    for (const document of documents) {
      lastRead = document;
      const data = document.data();
      if (!matches(data, filters)) continue;
      // publicListing constructs an explicit field allowlist; never return data itself.
      listings.push({ ...publicListing(data, document.id), publicLocation: publishableLocation(data) });
      if (listings.length === filters.pageSize) break;
    }
    if (!hasMore) break;
  }
  return { listings, cursor: lastRead?.id ?? null, hasMore };
});
