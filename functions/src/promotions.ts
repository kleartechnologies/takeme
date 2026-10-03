import { marketplaceCall as onCall, runGuardedTransaction, accountIsActive } from "./account-lifecycle";
import { getFirestore, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { recordMarketplaceSignal, publicListing } from "./intelligence";
import { isPublicListingSafe } from "./general-location";
import {
  allocatePromotionPlacements,
  canServePromotion,
  DEFAULT_PROMOTION_PACKAGES,
  effectivePromotionStatus,
  listingPromotionEligible,
  matchesPlacementContext,
  PROMOTION_PAYMENT_GATEWAY,
  validPackage,
  type PromotionListing,
  type PromotionPackage,
  type PromotionRecord,
} from "./promotion-domain";

const db = getFirestore();
const packageIds = DEFAULT_PROMOTION_PACKAGES.map((item) => item.id);
const iso = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() : typeof value === "string" ? value : null;
const requiredId = (value: unknown, field: string) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new HttpsError("invalid-argument", `${field} is invalid.`);
  return value;
};
const requireUid = (uid: string | undefined) => {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to manage promotions.");
  return uid;
};

function listingFromDoc(id: string, data: DocumentData): PromotionListing {
  return { id, sellerId: String(data.sellerId ?? ""), categoryId: String(data.categoryId ?? ""), title: String(data.title ?? ""), status: String(data.status ?? ""), listingType: String(data.listingType ?? ""), auctionStatus: data.auctionStatus ?? null, auctionEndAt: iso(data.auctionEndAt), searchTokens: Array.isArray(data.searchTokens) ? data.searchTokens : [] };
}

function promotionFromDoc(id: string, data: DocumentData): PromotionRecord {
  return { id, listingId: String(data.listingId ?? ""), sellerId: String(data.sellerId ?? ""), type: data.type, packageId: String(data.packageId ?? ""), status: data.status, paymentStatus: data.paymentStatus, startAt: iso(data.startAt), endAt: iso(data.endAt) };
}

function sellerPromotion(id: string, data: DocumentData) {
  const record = promotionFromDoc(id, data);
  return { ...record, status: effectivePromotionStatus(record, new Date()), priceSen: Number(data.priceSen ?? 0), currency: data.currency, durationHours: Number(data.durationHours ?? 0), impressions: Number(data.impressions ?? 0), clicks: Number(data.clicks ?? 0), createdAt: iso(data.createdAt), updatedAt: iso(data.updatedAt), paymentProvider: data.paymentProvider ?? "none" };
}

async function packages(): Promise<PromotionPackage[]> {
  const refs = packageIds.map((id) => db.collection("promotionPackages").doc(id));
  const snapshots = await db.getAll(...refs);
  return DEFAULT_PROMOTION_PACKAGES.map((fallback, index) => {
    const override = snapshots[index]?.data();
    const candidate = override ? { ...override, id: fallback.id, type: fallback.type, currency: "MYR" } : fallback;
    return validPackage(candidate) ? candidate : fallback;
  });
}

export const getPromotionPackages = onCall(async () => ({ packages: await packages(), paymentAvailable: PROMOTION_PAYMENT_GATEWAY.available, pricingFinal: false }));

export const createPromotionRequest = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const listingId = requiredId(request.data?.listingId, "Listing");
  const packageId = requiredId(request.data?.packageId, "Package");
  const selected = (await packages()).find((item) => item.id === packageId && item.available);
  if (!selected) throw new HttpsError("failed-precondition", "This promotion package is unavailable.");
  const listingRef = db.collection("listings").doc(listingId);
  const lockRef = db.collection("promotionLocks").doc(listingId);
  const promotionRef = db.collection("promotions").doc();
  const now = Timestamp.now();
  await runGuardedTransaction(db, async (transaction) => {
    const [listingSnapshot, lockSnapshot] = await Promise.all([transaction.get(listingRef), transaction.get(lockRef)]);
    if (!listingSnapshot.exists) throw new HttpsError("not-found", "Listing not found.");
    const listing = listingFromDoc(listingId, listingSnapshot.data()!);
    if (listing.sellerId !== uid) throw new HttpsError("permission-denied", "Only the listing seller can request a promotion.");
    if (!listingPromotionEligible(listing, now.toDate())) throw new HttpsError("failed-precondition", "This listing is not eligible for promotion.");
    if (lockSnapshot.exists && ["pending_payment", "scheduled", "active"].includes(String(lockSnapshot.data()?.status))) {
      throw new HttpsError("already-exists", "This listing already has a promotion request or promotion.");
    }
    transaction.create(promotionRef, {
      listingId, sellerId: uid, type: selected.type, packageId: selected.id, status: "pending_payment", paymentStatus: "not_configured", paymentProvider: PROMOTION_PAYMENT_GATEWAY.id,
      priceSen: selected.priceSen, currency: "MYR", durationHours: selected.durationHours,
      startAt: null, endAt: null, impressions: 0, clicks: 0, createdAt: now, updatedAt: now,
    });
    transaction.set(lockRef, { promotionId: promotionRef.id, sellerId: uid, status: "pending_payment", updatedAt: now });
    transaction.create(db.collection("marketplaceEvents").doc(`promotion-created-${promotionRef.id}`), {
      userId: uid, eventType: selected.type === "boost" ? "BOOST_CREATED" : "FEATURED_CREATED", source: "promotion", promotionId: promotionRef.id,
      listingId, sellerId: uid, categoryId: listing.categoryId, packageId: selected.id, paymentStatus: "not_configured",
      createdAt: now, expiresAt: Timestamp.fromMillis(now.toMillis() + 90 * 86_400_000),
    });
  });
  return { promotionId: promotionRef.id, status: "pending_payment", paymentAvailable: PROMOTION_PAYMENT_GATEWAY.available };
});

export const cancelPromotionRequest = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const promotionId = requiredId(request.data?.promotionId, "Promotion");
  const ref = db.collection("promotions").doc(promotionId);
  await runGuardedTransaction(db, async (transaction) => {
    const promotion = await transaction.get(ref);
    if (!promotion.exists) throw new HttpsError("not-found", "Promotion request not found.");
    const data = promotion.data()!;
    if (data.sellerId !== uid) throw new HttpsError("permission-denied", "This is not your promotion request.");
    if (data.status !== "pending_payment" || data.paymentStatus !== "not_configured") throw new HttpsError("failed-precondition", "Only an unpaid request can be cancelled here.");
    const lockRef = db.collection("promotionLocks").doc(data.listingId);
    const lock = await transaction.get(lockRef);
    const now = Timestamp.now();
    transaction.update(ref, { status: "cancelled", updatedAt: now });
    if (lock.data()?.promotionId === promotionId) transaction.set(lockRef, { promotionId, sellerId: uid, status: "cancelled", updatedAt: now });
  });
  return { status: "cancelled" };
});

export const getMyPromotionRequests = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const listingId = requiredId(request.data?.listingId, "Listing");
  const listing = await db.collection("listings").doc(listingId).get();
  if (!listing.exists || listing.data()?.sellerId !== uid) throw new HttpsError("permission-denied", "This listing is not yours.");
  const history = await db.collection("promotions").where("listingId", "==", listingId).orderBy("createdAt", "desc").limit(10).get();
  return { promotions: history.docs.filter((item) => item.data().sellerId === uid).map((item) => sellerPromotion(item.id, item.data())) };
});

export const getPromotionPlacements = onCall(async (request) => {
  const ids = request.data?.listingIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 24 || ids.some((id) => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id))) throw new HttpsError("invalid-argument", "Provide 1–24 listing IDs.");
  const listingIds = [...new Set(ids as string[])];
  const categoryId = typeof request.data?.categoryId === "string" ? request.data.categoryId.slice(0, 60) : "";
  const search = typeof request.data?.search === "string" ? request.data.search.slice(0, 40) : "";
  const now = new Date();
  const snapshots = await db.getAll(...listingIds.map((id) => db.collection("listings").doc(id)));
  const candidates = snapshots.filter((item) => item.exists).map((item) => listingFromDoc(item.id, item.data()!));
  const promotable = candidates.filter((item) => listingPromotionEligible(item, now) && matchesPlacementContext(item, categoryId, search));
  if (!promotable.length) return { orderIds: listingIds, badges: {} };
  const pages = await db.collection("promotions").where("listingId", "in", promotable.map((item) => item.id)).where("status", "==", "active").where("paymentStatus", "==", "paid").limit(24).get();
  const promotions = pages.docs.map((item) => promotionFromDoc(item.id, item.data()));
  return allocatePromotionPlacements(candidates, promotions, now);
});

export const getFeaturedPromotions = onCall(async () => {
  const now = new Date();
  const page = await db.collection("promotions").where("status", "==", "active").where("type", "==", "featured").where("paymentStatus", "==", "paid")
    .where("endAt", ">", Timestamp.fromDate(now)).orderBy("endAt", "asc").limit(12).get();
  if (!page.size) return { items: [] };
  const listingSnapshots = await db.getAll(...page.docs.map((item) => db.collection("listings").doc(String(item.data().listingId))));
  const sellerIds = new Set<string>();
  const items = [];
  for (let index = 0; index < page.docs.length && items.length < 4; index += 1) {
    const promotionSnapshot = page.docs[index]!;
    const listingSnapshot = listingSnapshots[index];
    if (!listingSnapshot?.exists) continue;
    const listing = listingFromDoc(listingSnapshot.id, listingSnapshot.data()!);
    const promotion = promotionFromDoc(promotionSnapshot.id, promotionSnapshot.data());
    if (!canServePromotion(promotion, listing, now) || sellerIds.has(listing.sellerId) || !isPublicListingSafe(listingSnapshot.data()!)) continue;
    items.push({ listing: publicListing(listingSnapshot.data()!, listing.id), promotionId: promotion.id, type: promotion.type });
    sellerIds.add(listing.sellerId);
  }
  return { items };
});

export const trackPromotionEngagement = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const type = request.data?.type;
  if (type !== "PROMOTION_IMPRESSION" && type !== "PROMOTION_CLICK") throw new HttpsError("invalid-argument", "Invalid promotion event.");
  const promotionId = requiredId(request.data?.promotionId, "Promotion");
  const listingId = requiredId(request.data?.listingId, "Listing");
  const context = request.data?.context === "home" || request.data?.context === "explore" ? request.data.context : undefined;
  const bucket = Math.floor(Date.now() / 3_600_000);
  return recordMarketplaceSignal(uid, { type, listingId }, `promotion|${promotionId}|${listingId}|${bucket}`, { source: "client", promotionId, context });
});

/** This becomes meaningful only after a verified payment integration can create active promotions. */
export const expirePromotions = onSchedule({ schedule: "every 60 minutes", timeZone: "UTC" }, async () => {
  const now = Timestamp.now();
  const page = await db.collection("promotions").where("status", "==", "active").where("endAt", "<=", now).orderBy("endAt", "asc").limit(100).get();
  for (const item of page.docs) {
    await runGuardedTransaction(db, async (transaction) => {
      const latest = await transaction.get(item.ref);
      if (!latest.exists || latest.data()?.status !== "active" || !(latest.data()?.endAt instanceof Timestamp) || latest.data()!.endAt.toMillis() > now.toMillis()) return;
      const data = latest.data()!;
      const lockRef = db.collection("promotionLocks").doc(String(data.listingId));
      const lock = await transaction.get(lockRef);
      if (!(await accountIsActive(data.sellerId, transaction))) return;
      transaction.update(item.ref, { status: "expired", updatedAt: now });
      if (lock.data()?.promotionId === item.id) transaction.set(lockRef, { promotionId: item.id, sellerId: data.sellerId, status: "expired", updatedAt: now });
      transaction.create(db.collection("marketplaceEvents").doc(`promotion-expired-${item.id}`), { userId: data.sellerId, eventType: data.type === "boost" ? "BOOST_EXPIRED" : "FEATURED_EXPIRED", source: "promotion", promotionId: item.id, listingId: data.listingId, sellerId: data.sellerId, createdAt: now, expiresAt: Timestamp.fromMillis(now.toMillis() + 90 * 86_400_000) });
    });
  }
});

/** Stop serving a promotion when its underlying listing leaves the marketplace. */
export const onPromotedListingUpdated = onDocumentUpdated("listings/{listingId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  const listingId = event.params.listingId;
  if (before.status !== "active" || (after.status === "active" && !["ended", "cancelled"].includes(String(after.auctionStatus)))) return;
  const lockRef = db.collection("promotionLocks").doc(listingId);
  await runGuardedTransaction(db, async (transaction) => {
    const lock = await transaction.get(lockRef);
    const promotionId = lock.data()?.promotionId;
    if (typeof promotionId !== "string") return;
    const promotionRef = db.collection("promotions").doc(promotionId);
    const promotion = await transaction.get(promotionRef);
    if (!promotion.exists || !["pending_payment", "scheduled", "active"].includes(String(promotion.data()?.status))) return;
    const data = promotion.data()!;
    if (!(await accountIsActive(data.sellerId, transaction))) return;
    const timestamp = Timestamp.now();
    transaction.update(promotionRef, { status: "cancelled", refundReviewRequired: data.paymentStatus === "paid", updatedAt: timestamp });
    transaction.set(lockRef, { promotionId, sellerId: data.sellerId, status: "cancelled", updatedAt: timestamp });
  });
});
