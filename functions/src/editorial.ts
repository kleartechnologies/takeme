import { randomUUID } from "node:crypto";
import { getApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import {
  getFirestore,
  Timestamp,
  type Transaction,
  type DocumentData,
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  marketplaceCall,
  marketplaceMutationCall,
  runGuardedTransaction,
  accountIsActive,
} from "./account-lifecycle";
import {
  EDITORIAL_KINDS,
  id,
  parseContent,
  effectiveState,
  type EditorialKind,
  type Campaign,
  type Banner,
  type Collection,
  type Homepage,
  type Announcement,
  type CategoryConfig,
} from "./editorial-domain";
import {
  currentHomepage,
  parseHomepage,
  type PublicHomepage,
  type PublicHomeSection,
} from "./homepage-projection";
import { isPublicListingSafe } from "./general-location";
import {
  ADMIN_ASSET_MAX_BYTES,
  adminAssetDimensions,
  assetFits,
} from "./admin-assets-domain";
const db = getFirestore();
const collection = (kind: EditorialKind) => db.collection(`editorial_${kind}`);
const liveRef = db.doc("homepagePublished/current");
export function requireEditorialAdmin(request: CallableRequest<unknown>) {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sign in to TAKEME Admin.");
  if (request.auth.token.admin !== true)
    throw new HttpsError("permission-denied", "Administrator access required.");
  return request.auth.uid;
}
function kind(v: unknown): EditorialKind {
  if (!EDITORIAL_KINDS.includes(v as EditorialKind))
    throw new HttpsError("invalid-argument", "Invalid content section.");
  return v as EditorialKind;
}
function checkedId(v: unknown) {
  try {
    return id(v);
  } catch {
    throw new HttpsError("invalid-argument", "Invalid reference.");
  }
}
function version(v: unknown) {
  if (!Number.isSafeInteger(v) || (v as number) < 0)
    throw new HttpsError(
      "invalid-argument",
      "Reload this record before editing.",
    );
  return v as number;
}
function conflict(actual: unknown, expected: number) {
  if ((actual ?? 0) !== expected)
    throw new HttpsError(
      "aborted",
      "This record changed. Reload and review the latest version before saving.",
    );
}
export function adminAudit(
  tx: Transaction,
  uid: string,
  action: string,
  resourceType: string,
  resourceId: string,
  summary: Record<string, string | number | boolean>,
) {
  tx.create(db.collection("adminAuditEvents").doc(), {
    adminUid: uid,
    action,
    resourceType,
    resourceId,
    timestamp: Timestamp.now(),
    summary,
  });
}
const iso = (v: unknown) =>
  v instanceof Timestamp ? v.toDate().toISOString() : null;
function record(k: EditorialKind, recordId: string, data: DocumentData) {
  return {
    id: recordId,
    kind: k,
    content: data.content,
    version: data.version,
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
    ...(k === "campaigns"
      ? { effectiveState: effectiveState(data.content, Date.now()) }
      : {}),
  };
}
export const getAdminEditorialPage = marketplaceCall(async (request) => {
  requireEditorialAdmin(request);
  const k = kind(request.data?.kind);
  let q = collection(k).orderBy("__name__").limit(31);
  if (request.data?.cursor) q = q.startAfter(checkedId(request.data.cursor));
  const result = await q.get();
  return {
    records: result.docs.slice(0, 30).map((d) => record(k, d.id, d.data())),
    nextCursor: result.size > 30 ? result.docs[29]!.id : null,
  };
});
export const getAdminEditorialRecord = marketplaceCall(async (request) => {
  requireEditorialAdmin(request);
  const k = kind(request.data?.kind),
    recordId = checkedId(request.data?.id);
  const result = await collection(k).doc(recordId).get();
  if (!result.exists)
    return {
      record: null,
      liveVersion: (await liveRef.get()).data()?.version ?? 0,
    };
  return {
    record: record(k, result.id, result.data()!),
    liveVersion: (await liveRef.get()).data()?.version ?? 0,
  };
});
async function validateReferences(tx: Transaction, content: DocumentData) {
  const sections = Array.isArray(content.sections)
    ? content.sections
    : [content];
  const products = [
    ...new Set(sections.flatMap((s) => s.productIds ?? [])),
  ] as string[];
  const sellers = new Set<string>(sections.flatMap((s) => s.sellerIds ?? []));
  if (products.length > 48 || sellers.size > 24)
    throw new HttpsError(
      "invalid-argument",
      "Use at most 48 products and 24 sellers across the homepage.",
    );
  for (const productId of products) {
    const data = (await tx.get(db.doc(`listings/${productId}`))).data();
    if (
      !data ||
      data.status !== "active" ||
      !isPublicListingSafe(data) ||
      !data.sellerId ||
      (data.listingType === "buy_now" &&
        (!Number.isFinite(data.price) || data.price <= 0)) ||
      (data.listingType !== "buy_now" &&
        (!Number.isFinite(data.startingBid) ||
          data.startingBid <= 0 ||
          !data.auctionEndAt?.toMillis ||
          data.auctionEndAt.toMillis() <= Date.now() ||
          !["active", "scheduled"].includes(data.auctionStatus)))
    )
      throw new HttpsError(
        "failed-precondition",
        "Only eligible public active products can be featured.",
      );
    sellers.add(data.sellerId);
  }
  for (const sellerId of sellers) {
    const profile = await tx.get(db.doc(`users/${sellerId}`));
    if (
      !profile.exists ||
      profile.data()?.status === "removed" ||
      profile.data()?.disabled === true ||
      !(await accountIsActive(sellerId, tx))
    )
      throw new HttpsError(
        "failed-precondition",
        "This seller is unavailable.",
      );
  }
}
export const mutateAdminEditorial = marketplaceMutationCall(async (request) => {
  const uid = requireEditorialAdmin(request),
    k = kind(request.data?.kind),
    recordId = checkedId(request.data?.id),
    expected = version(request.data?.expectedVersion);
  const action = request.data?.action ?? "save";
  if (
    !["save", "schedule", "publish", "end", "duplicate"].includes(action) ||
    (k !== "campaigns" && action !== "save")
  )
    throw new HttpsError("invalid-argument", "Invalid content action.");
  let content;
  try {
    content = parseContent(k, request.data?.content);
  } catch (error) {
    throw new HttpsError("invalid-argument", (error as Error).message);
  }
  if (k === "homepage" || k === "categories") {
    if (recordId !== "current")
      throw new HttpsError(
        "invalid-argument",
        "Use the current configuration.",
      );
  }
  if (k === "campaigns") {
    const campaign = content as Campaign;
    // Status transitions are actions, never a client-supplied status override.
    if (action === "save" && campaign.lifecycleStatus !== "DRAFT")
      throw new HttpsError(
        "invalid-argument",
        "Save as a draft, then schedule or publish explicitly.",
      );
    if (action === "schedule") {
      if (
        !campaign.startAt ||
        Date.parse(campaign.startAt) <= Date.now() ||
        !campaign.endAt
      )
        throw new HttpsError(
          "invalid-argument",
          "Choose a future start and an end time.",
        );
      campaign.lifecycleStatus = "SCHEDULED";
    }
    if (action === "publish") {
      campaign.lifecycleStatus = "LIVE";
      campaign.startAt = new Date().toISOString();
      if (campaign.endAt && Date.parse(campaign.endAt) <= Date.now())
        throw new HttpsError("invalid-argument", "Choose a future end time.");
    }
    if (action === "end") {
      campaign.lifecycleStatus = "ENDED";
      campaign.endAt = new Date().toISOString();
      if (campaign.startAt && campaign.startAt > campaign.endAt)
        campaign.startAt = null;
    }
    if (action === "duplicate") {
      campaign.lifecycleStatus = "DRAFT";
      campaign.startAt = null;
      campaign.endAt = null;
    }
  }
  return runGuardedTransaction(db, async (tx) => {
    const ref = collection(k).doc(recordId),
      previous = await tx.get(ref);
    const live = action === "end" ? await tx.get(liveRef) : null;
    conflict(previous.data()?.version, expected);
    if (action !== "save" && !previous.exists)
      throw new HttpsError("failed-precondition", "Save a draft first.");
    // Ending must remain possible even when a formerly featured item is gone.
    if (action !== "end") await validateReferences(tx, content);
    const invalidate =
      action === "end" &&
      live?.data()?.references?.campaignIds?.includes(recordId);
    const revokedAssets = invalidate
      ? await readLiveAssets(tx, live!.data()!)
      : [];
    if (k === "banners") {
      const banner = content as Banner,
        asset = (await tx.get(db.doc(`adminAssets/${banner.assetId}`))).data();
      if (
        !asset ||
        asset.state !== "ready" ||
        !assetFits(banner.placement, asset.width, asset.height)
      )
        throw new HttpsError(
          "failed-precondition",
          "Choose a validated asset matching this placement's aspect ratio.",
        );
    }
    const target =
      action === "duplicate" ? collection(k).doc(randomUUID()) : ref;
    const next = action === "duplicate" ? 1 : expected + 1,
      now = Timestamp.now();
    tx.set(target, {
      content,
      version: next,
      createdBy:
        action === "duplicate" || !previous.exists
          ? uid
          : previous.data()!.createdBy,
      createdAt:
        action === "duplicate" || !previous.exists
          ? now
          : previous.data()!.createdAt,
      updatedBy: uid,
      updatedAt: now,
    });
    if (invalidate) {
      tx.update(liveRef, { valid: false });
      for (const asset of revokedAssets)
        if (asset.exists) tx.update(asset.ref, { published: false });
    }
    adminAudit(tx, uid, action, k, target.id, { version: next });
    return { id: target.id, version: next };
  });
});
function maxDate(a: string | null, b: string | null) {
  return a && b ? (a > b ? a : b) : (a ?? b);
}
function minDate(a: string | null, b: string | null) {
  return a && b ? (a < b ? a : b) : (a ?? b);
}
async function compileHomepage(
  tx: Transaction,
  content: Homepage,
  nextVersion: number,
) {
  await validateReferences(tx, content);
  const campaignIds = new Set<string>();
  const sections: PublicHomeSection[] = [],
    assetIds = new Set<string>(),
    listingIds = new Set<string>(),
    sellerIds = new Set<string>();
  const read = async (k: EditorialKind, value: string) => {
    const doc = await tx.get(collection(k).doc(value));
    if (!doc.exists)
      throw new HttpsError(
        "failed-precondition",
        `Referenced ${k} record is missing.`,
      );
    return parseContent(k, doc.data()!.content);
  };
  for (const s of [...content.sections].sort((a, b) => a.order - b.order)) {
    if (!s.enabled) continue;
    const campaign = s.campaignId
      ? ((await read("campaigns", s.campaignId)) as Campaign)
      : null;
    if (
      campaign &&
      ["DRAFT", "ENDED"].includes(effectiveState(campaign, Date.now()))
    )
      throw new HttpsError(
        "failed-precondition",
        "Remove draft/ended campaign placements before publishing.",
      );
    if (s.campaignId) campaignIds.add(s.campaignId);
    if (campaign && !campaign.placements.includes(s.type))
      throw new HttpsError(
        "failed-precondition",
        "This campaign does not authorize this placement.",
      );
    const collectionData = s.collectionId
      ? ((await read("collections", s.collectionId)) as Collection)
      : null;
    if (collectionData && !collectionData.active)
      throw new HttpsError("failed-precondition", "Collection is disabled.");
    const refs = {
      productIds: [
        ...new Set([
          ...s.productIds,
          ...(campaign?.productIds ?? []),
          ...(collectionData?.productIds ?? []),
        ]),
      ],
      sellerIds: [...new Set([...s.sellerIds, ...(campaign?.sellerIds ?? [])])],
    };
    if (refs.productIds.length > 12 || refs.sellerIds.length > 12)
      throw new HttpsError(
        "invalid-argument",
        "Each placement supports at most 12 products and sellers.",
      );
    await validateReferences(tx, refs);
    const section: PublicHomeSection = {
      sectionId: s.sectionId,
      type: s.type,
      title: s.title,
      source: s.source,
      startAt: maxDate(
        maxDate(s.startAt, campaign?.startAt ?? null),
        collectionData?.startAt ?? null,
      ),
      endAt: minDate(
        minDate(s.endAt, campaign?.endAt ?? null),
        collectionData?.endAt ?? null,
      ),
      products: [],
      sellers: [],
      categories: [
        ...new Set([...s.categoryIds, ...(campaign?.categoryIds ?? [])]),
      ],
      banners: [],
      announcement: null,
      cta: campaign?.ctaLabel
        ? { label: campaign.ctaLabel, destination: campaign.destination }
        : null,
    };
    if (section.startAt && section.endAt && section.startAt >= section.endAt)
      throw new HttpsError(
        "invalid-argument",
        "Placement schedules do not overlap.",
      );
    for (const productId of refs.productIds) {
      const d = (await tx.get(db.doc(`listings/${productId}`))).data()!;
      listingIds.add(productId);
      sellerIds.add(d.sellerId);
      section.products.push({
        id: productId,
        title: String(d.title).slice(0, 80),
        price: Number(
          d.listingType === "buy_now" ? d.price : d.startingBid / 100,
        ),
        priceLabel: d.listingType === "buy_now" ? "Price" : "Starting bid",
        imageUrl: d.imageUrls?.[0] ?? "",
        sellerId: d.sellerId,
        endAt: iso(d.auctionEndAt),
      });
    }
    for (const sellerId of refs.sellerIds) {
      const d = (await tx.get(db.doc(`users/${sellerId}`))).data()!;
      sellerIds.add(sellerId);
      section.sellers.push({
        id: sellerId,
        displayName: String(d.displayName).slice(0, 80),
        photoURL: d.photoURL ?? null,
      });
    }
    const bannerIds = [
      ...new Set([...s.bannerIds, ...(campaign?.bannerIds ?? [])]),
    ];
    if (bannerIds.length > 4)
      throw new HttpsError(
        "invalid-argument",
        "Use at most four banners per section.",
      );
    for (const bannerId of bannerIds) {
      const b = (await read("banners", bannerId)) as Banner;
      if (!b.enabled) continue;
      const boundCampaign = b.campaignId
        ? ((await read("campaigns", b.campaignId)) as Campaign)
        : null;
      if (
        boundCampaign &&
        ["DRAFT", "ENDED"].includes(effectiveState(boundCampaign, Date.now()))
      )
        continue;
      const asset = (await tx.get(db.doc(`adminAssets/${b.assetId}`))).data();
      if (
        !asset ||
        asset.state !== "ready" ||
        !assetFits(b.placement, asset.width, asset.height)
      )
        throw new HttpsError(
          "failed-precondition",
          "Banner asset is unavailable.",
        );
      assetIds.add(b.assetId);
      section.banners.push({
        placement: b.placement,
        url: asset.url,
        alt: b.alt,
        ctaLabel: b.ctaLabel,
        destination: b.destination,
        order: b.order,
        startAt: boundCampaign?.startAt ?? null,
        endAt: boundCampaign?.endAt ?? null,
      });
    }
    if (collectionData?.assetId) {
      const asset = (
        await tx.get(db.doc(`adminAssets/${collectionData.assetId}`))
      ).data();
      if (
        !asset ||
        asset.state !== "ready" ||
        !assetFits("secondary_card", asset.width, asset.height)
      )
        throw new HttpsError(
          "failed-precondition",
          "Collection artwork must be a validated secondary-card asset.",
        );
      if (section.banners.length >= 4)
        throw new HttpsError(
          "invalid-argument",
          "Use at most four banners including collection artwork.",
        );
      assetIds.add(collectionData.assetId);
      section.banners.push({
        placement: "secondary_card",
        url: asset.url,
        alt: collectionData.title,
        ctaLabel: "",
        destination: "",
        order: 0,
        startAt: null,
        endAt: null,
      });
    }
    section.banners.sort((a, b) => a.order - b.order);
    if (s.announcementId) {
      const a = (await read("announcements", s.announcementId)) as Announcement;
      if (a.enabled) {
        section.startAt = maxDate(section.startAt, a.startAt);
        section.endAt = minDate(section.endAt, a.endAt);
        section.announcement = { title: a.title, destination: a.destination };
      }
    }
    if (section.startAt && section.endAt && section.startAt >= section.endAt)
      throw new HttpsError(
        "invalid-argument",
        "Placement schedules do not overlap.",
      );
    sections.push(section);
  }
  if (listingIds.size > 48 || sellerIds.size > 48)
    throw new HttpsError(
      "invalid-argument",
      "The homepage reference budget was exceeded.",
    );
  const categoriesDoc = await tx.get(collection("categories").doc("current"));
  const categories = categoriesDoc.exists
    ? (
        parseContent(
          "categories",
          categoriesDoc.data()!.content,
        ) as CategoryConfig
      ).categories.sort((a, b) => a.order - b.order)
    : [];
  const projection: PublicHomepage = {
    schemaVersion: 1,
    version: nextVersion,
    sections,
    categories,
  };
  if (!parseHomepage(projection))
    throw new HttpsError(
      "failed-precondition",
      "Public projection contains an unsafe or excessive value.",
    );
  return {
    projection,
    assetIds: [...assetIds],
    references: {
      listingIds: [...listingIds],
      sellerIds: [...sellerIds],
      campaignIds: [...campaignIds],
    },
  };
}
export const previewAdminHomepage = marketplaceCall(async (request) => {
  requireEditorialAdmin(request);
  let content: Homepage;
  try {
    content = parseContent("homepage", request.data?.content) as Homepage;
  } catch (error) {
    throw new HttpsError("invalid-argument", (error as Error).message);
  }
  return db.runTransaction(async (tx) => ({
    projection: (await compileHomepage(tx, content, 1)).projection,
    serverTime: new Date().toISOString(),
  }));
});
export const publishAdminHomepage = marketplaceMutationCall(async (request) => {
  const uid = requireEditorialAdmin(request),
    expected = version(request.data?.expectedVersion),
    expectedLive = version(request.data?.expectedLiveVersion);
  return runGuardedTransaction(db, async (tx) => {
    const draft = await tx.get(collection("homepage").doc("current")),
      live = await tx.get(liveRef);
    conflict(draft.data()?.version, expected);
    conflict(live.data()?.version, expectedLive);
    if (!draft.exists)
      throw new HttpsError(
        "failed-precondition",
        "Save a homepage draft before publishing.",
      );
    const content = parseContent("homepage", draft.data()!.content) as Homepage;
    const compiled = await compileHomepage(tx, content, expectedLive + 1);
    const oldAssets = Array.isArray(live.data()?.assetIds)
      ? (live.data()!.assetIds as string[])
      : [];
    // All transaction reads precede writes.
    const assetDocs = await Promise.all(
      [...new Set([...oldAssets, ...compiled.assetIds])].map((v) =>
        tx.get(db.doc(`adminAssets/${v}`)),
      ),
    );
    for (const asset of assetDocs)
      if (asset.exists)
        tx.update(asset.ref, {
          published: compiled.assetIds.includes(asset.id),
        });
    tx.set(liveRef, {
      ...compiled,
      version: expectedLive + 1,
      draftVersion: expected,
      valid: true,
      publishedAt: Timestamp.now(),
    });
    adminAudit(tx, uid, "publish", "homepage", "current", {
      liveVersion: expectedLive + 1,
      draftVersion: expected,
    });
    return { liveVersion: expectedLive + 1, draftVersion: expected };
  });
});
/** Exactly one read; effective schedules use server time. No auth boot or admin collection joins. */
export const getPublicHomepage = onCall(async () => {
  const live = (await liveRef.get()).data();
  return {
    homepage:
      live?.valid === true
        ? currentHomepage(live.projection, Date.now())
        : null,
  };
});
export async function readPublishedHomepage() {
  const live = (await liveRef.get()).data();
  return live?.valid === true
    ? currentHomepage(live.projection, Date.now())
    : null;
}
async function readLiveAssets(tx: Transaction, live: DocumentData) {
  const ids = Array.isArray(live.assetIds) ? live.assetIds : [];
  if (ids.length > 64)
    throw new HttpsError(
      "failed-precondition",
      "Published asset budget is invalid.",
    );
  return Promise.all(
    ids.map((value: unknown) =>
      tx.get(db.doc(`adminAssets/${checkedId(value)}`)),
    ),
  );
}
/** Stop serving stale featured content when eligibility changes, without scanning campaigns. */
async function invalidateReference(
  type: "listingIds" | "sellerIds",
  key: string,
) {
  await db.runTransaction(async (tx) => {
    const live = await tx.get(liveRef);
    if (live.data()?.references?.[type]?.includes(key)) {
      const assets = await readLiveAssets(tx, live.data()!);
      tx.update(liveRef, { valid: false });
      for (const asset of assets)
        if (asset.exists) tx.update(asset.ref, { published: false });
    }
  });
}
export const invalidateEditorialListing = onDocumentWritten(
  "listings/{listingId}",
  async (event) => {
    const before = event.data?.before.data(),
      d = event.data?.after.data();
    // Drafts could not enter the published projection, so skip their writes.
    if (!before || before.status !== "active") return;
    const changed = [
      "title",
      "price",
      "startingBid",
      "sellerId",
      "listingType",
      "imageUrls",
      "auctionEndAt",
    ].some((key) => JSON.stringify(before[key]) !== JSON.stringify(d?.[key]));
    if (!d || d.status !== "active" || !isPublicListingSafe(d) || changed)
      await invalidateReference("listingIds", event.params.listingId);
  },
);
export const invalidateEditorialSeller = onDocumentWritten(
  "users/{uid}",
  async (event) => {
    const before = event.data?.before.data(),
      d = event.data?.after.data();
    if (!before) return;
    if (
      !d ||
      d.disabled === true ||
      d.status === "removed" ||
      d.displayName !== before.displayName ||
      d.photoURL !== before.photoURL
    )
      await invalidateReference("sellerIds", event.params.uid);
  },
);
export const invalidateEditorialLifecycle = onDocumentWritten(
  "accountLifecycles/{uid}",
  async (event) => {
    if (event.data?.after.exists)
      await invalidateReference("sellerIds", event.params.uid);
  },
);
export const requestAdminAssetPermit = marketplaceMutationCall(
  async (request) => {
    const uid = requireEditorialAdmin(request),
      sizeBytes = request.data?.sizeBytes;
    if (
      !Number.isSafeInteger(sizeBytes) ||
      sizeBytes < 33 ||
      sizeBytes > ADMIN_ASSET_MAX_BYTES ||
      request.data?.contentType !== "image/png"
    )
      throw new HttpsError("invalid-argument", "Upload a PNG up to 2 MB.");
    const assetId = randomUUID(),
      path = `admin-assets/${assetId}/image.png`,
      expiresAt = Timestamp.fromMillis(Date.now() + 120000);
    await runGuardedTransaction(db, async (tx) => {
      const quota = db.doc(`adminAssetQuotas/${uid}`),
        previous = await tx.get(quota),
        now = Date.now();
      const recent =
        previous.data()?.windowStart instanceof Timestamp &&
        now - previous.data()!.windowStart.toMillis() < 3600000;
      const count = recent ? Number(previous.data()?.count ?? 0) : 0;
      if (count >= 30)
        throw new HttpsError(
          "resource-exhausted",
          "Wait before uploading more assets.",
        );
      tx.set(quota, {
        windowStart: recent ? previous.data()!.windowStart : Timestamp.now(),
        count: count + 1,
      });
      tx.create(db.doc(`adminAssets/${assetId}`), {
        uid,
        path,
        contentType: "image/png",
        sizeBytes,
        expiresAt,
        state: "pending",
        published: false,
      });
      adminAudit(tx, uid, "asset-permit", "asset", assetId, { sizeBytes });
    });
    return { assetId, path, expiresAt: expiresAt.toDate().toISOString() };
  },
);
export const finalizeAdminAsset = marketplaceMutationCall(async (request) => {
  const uid = requireEditorialAdmin(request),
    assetId = checkedId(request.data?.assetId),
    ref = db.doc(`adminAssets/${assetId}`);
  const asset = (await ref.get()).data();
  if (
    !asset ||
    asset.uid !== uid ||
    asset.state !== "pending" ||
    asset.expiresAt.toMillis() <= Date.now()
  )
    throw new HttpsError(
      "permission-denied",
      "The asset permit expired or belongs to another administrator.",
    );
  const file = getStorage().bucket().file(asset.path),
    [metadata] = await file.getMetadata();
  if (
    metadata.contentType !== "image/png" ||
    Number(metadata.size) !== asset.sizeBytes ||
    Number(metadata.size) > ADMIN_ASSET_MAX_BYTES
  )
    throw new HttpsError(
      "failed-precondition",
      "Uploaded asset does not match its permit.",
    );
  const [bytes] = await file.download();
  let dimensions;
  try {
    dimensions = adminAssetDimensions(bytes);
  } catch (error) {
    throw new HttpsError("invalid-argument", (error as Error).message);
  }
  const bucket = getApp().options.storageBucket;
  if (!bucket)
    throw new HttpsError(
      "failed-precondition",
      "Storage bucket is not configured.",
    );
  const origin = process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`
    : "https://firebasestorage.googleapis.com";
  const url = `${origin}/v0/b/${bucket}/o/${encodeURIComponent(asset.path)}?alt=media`;
  await runGuardedTransaction(db, async (tx) => {
    const latest = await tx.get(ref);
    if (latest.data()?.state !== "pending" || latest.data()?.uid !== uid)
      throw new HttpsError("aborted", "Asset changed. Reload.");
    tx.update(ref, { state: "ready", ...dimensions, url });
    adminAudit(tx, uid, "asset-ready", "asset", assetId, dimensions);
  });
  return { assetId, path: asset.path, url, ...dimensions };
});
export const getAdminControlOverview = marketplaceCall(async (request) => {
  const uid = requireEditorialAdmin(request);
  const total = async (query: FirebaseFirestore.Query) =>
    (await query.count().get()).data().count;
  const [listings, auctions, freshUsers, reports, campaigns, live, audits] =
    await Promise.all([
      total(db.collection("listings").where("status", "==", "active")),
      total(db.collection("listings").where("auctionStatus", "==", "active")),
      total(
        db
          .collection("users")
          .where(
            "createdAt",
            ">=",
            Timestamp.fromMillis(Date.now() - 7 * 86400000),
          ),
      ),
      total(
        db
          .collection("reports")
          .where("status", "in", ["submitted", "reviewing"]),
      ),
      collection("campaigns").limit(101).get(),
      liveRef.get(),
      db
        .collection("adminAuditEvents")
        .orderBy("timestamp", "desc")
        .limit(20)
        .get(),
    ]);
  const complete = campaigns.size <= 100;
  return {
    adminUid: uid,
    cards: [
      { label: "Active listings", value: listings },
      { label: "Live auctions · recorded state", value: auctions },
      { label: "New users · 7 days", value: freshUsers },
      { label: "Open reports", value: reports },
      {
        label: "Live campaigns",
        value: complete
          ? campaigns.docs.filter(
              (d) => effectiveState(d.data().content, Date.now()) === "LIVE",
            ).length
          : null,
      },
      {
        label: "Scheduled campaigns",
        value: complete
          ? campaigns.docs.filter(
              (d) =>
                effectiveState(d.data().content, Date.now()) === "SCHEDULED",
            ).length
          : null,
      },
    ],
    liveVersion: live.data()?.version ?? 0,
    liveValid: live.data()?.valid === true,
    audits: audits.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      timestamp: iso(d.data().timestamp),
    })),
  };
});

/** Small claim-guarded handshake for the dedicated app's HttpOnly session boundary. */
export const getAdminSession = marketplaceCall(async (request) => {
  const uid = requireEditorialAdmin(request);
  return { uid, expiresAt: Number(request.auth!.token.exp) };
});
