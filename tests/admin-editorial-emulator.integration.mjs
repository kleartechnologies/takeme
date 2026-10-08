import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getIdToken,
} from "firebase/auth";
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from "firebase/functions";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
} from "firebase/firestore";
import {
  getStorage,
  connectStorageEmulator,
  ref,
  uploadBytes,
  getBytes,
} from "firebase/storage";
import {
  acceptDemoPolicies,
  createDemoPassword,
} from "./helpers/demo-eligibility.mjs";
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== "demo-takeme")
  throw new Error("Demo-only qualification.");
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
const require = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const {
  initializeApp: adminInit,
  deleteApp: adminDelete,
} = require("firebase-admin/app");
const {
  getFirestore: adminDb,
  Timestamp,
} = require("firebase-admin/firestore");
const { getAuth: adminAuth } = require("firebase-admin/auth");
const { newContent } = require("../functions/lib/editorial-domain");
const projectId = "demo-takeme",
  suffix = Date.now().toString(),
  admin = adminInit(
    { projectId, storageBucket: `${projectId}.appspot.com` },
    "editorial-test-" + suffix,
  ),
  db = adminDb(admin),
  authAdmin = adminAuth(admin);
const config = {
  apiKey: "demo-api-key",
  projectId,
  authDomain: `${projectId}.firebaseapp.com`,
  storageBucket: `${projectId}.appspot.com`,
  appId: "1:123456789:web:demo",
};
async function client(label, signed = true) {
  const app = initializeApp(config, label + suffix),
    auth = getAuth(app),
    functions = getFunctions(app, "asia-southeast1"),
    firestore = getFirestore(app),
    storage = getStorage(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  if (signed) {
    await createUserWithEmailAndPassword(
      auth,
      `${label}-${suffix}@example.test`,
      createDemoPassword(),
    );
    await acceptDemoPolicies(app);
  }
  return {
    app,
    auth,
    functions,
    firestore,
    storage,
    uid: auth.currentUser?.uid,
  };
}
const [operator, member, anonymous] = await Promise.all([
  client("editorial-operator"),
  client("editorial-member"),
  client("editorial-anon", false),
]);
await authAdmin.setCustomUserClaims(operator.uid, { admin: true });
await getIdToken(operator.auth.currentUser, true);
const call = (p, name, data = {}) =>
  httpsCallable(p.functions, name)(data).then((v) => v.data);
let checks = 0;
const check = () => checks++;
for (const name of [
  "getAdminSession",
  "getAdminControlOverview",
  "getAdminEditorialPage",
  "getAdminEditorialRecord",
  "mutateAdminEditorial",
  "previewAdminHomepage",
  "publishAdminHomepage",
  "requestAdminAssetPermit",
  "finalizeAdminAsset",
  "loadAdminReportContext",
]) {
  for (const p of [anonymous, member]) {
    await assert.rejects(
      () =>
        call(p, name, {
          admin: true,
          kind: "campaigns",
          id: "forged",
          content: {},
          expectedVersion: 0,
        }),
      /permission|administrator|Sign in|unauthenticated/i,
    );
    check();
  }
}
for (const p of [member, operator]) {
  await assert.rejects(
    () =>
      setDoc(doc(p.firestore, "editorial_campaigns/forged"), { admin: true }),
    /permission/i,
  );
  check();
}
const sellerId = member.uid;
const now = Timestamp.now();
await db.doc(`users/${sellerId}`).set({
  displayName: "Synthetic seller",
  email: "private@example.test",
  address: "private address",
  location: "private location",
  createdAt: now,
});
const listingId = "editorial-product-" + suffix;
const listing = {
  title: "Synthetic public product",
  status: "active",
  listingType: "buy_now",
  price: 12,
  sellerId,
  categoryId: "electronics",
  privacyVersion: 2,
  publicLocation: {
    districtOrCity: "Kuala Lumpur",
    state: "W.P. Kuala Lumpur",
    country: "Malaysia",
  },
  location: "Kuala Lumpur, W.P. Kuala Lumpur",
  imageUrls: [],
  searchTokens: ["synthetic"],
  createdAt: now,
};
await db.doc(`listings/${listingId}`).set(listing);
const campaignId = "campaign-" + suffix;
let campaign = {
  ...newContent("campaigns"),
  title: "Weekend campaign",
  internalDescription: "PRIVATE EDITORIAL NOTES",
  ctaLabel: "Explore deals",
  destination: "/explore",
  productIds: [listingId],
};
const mutate = (kind, id, content, expectedVersion, action = "save") =>
  call(operator, "mutateAdminEditorial", {
    kind,
    id,
    content,
    expectedVersion,
    action,
  });
assert.equal((await mutate("campaigns", campaignId, campaign, 0)).version, 1);
check();
await assert.rejects(
  () => mutate("campaigns", campaignId, { ...campaign, title: "Conflict" }, 0),
  /changed|Reload/i,
);
check();
campaign = { ...campaign, title: "Edited campaign" };
await mutate("campaigns", campaignId, campaign, 1);
check();
const startAt = new Date(Date.now() + 3600000).toISOString(),
  endAt = new Date(Date.now() + 7200000).toISOString();
await mutate(
  "campaigns",
  campaignId,
  { ...campaign, startAt, endAt },
  2,
  "schedule",
);
let row = (
  await call(operator, "getAdminEditorialRecord", {
    kind: "campaigns",
    id: campaignId,
  })
).record;
assert.equal(row.effectiveState, "SCHEDULED");
check();
await mutate("campaigns", campaignId, campaign, 3, "publish");
row = (
  await call(operator, "getAdminEditorialRecord", {
    kind: "campaigns",
    id: campaignId,
  })
).record;
assert.equal(row.effectiveState, "LIVE");
check();
const duplicate = await mutate(
  "campaigns",
  campaignId,
  campaign,
  4,
  "duplicate",
);
assert.notEqual(duplicate.id, campaignId);
assert.equal(
  (
    await call(operator, "getAdminEditorialRecord", {
      kind: "campaigns",
      id: duplicate.id,
    })
  ).record.effectiveState,
  "DRAFT",
);
check();
const invalidId = "draft-" + suffix;
await db.doc(`listings/${invalidId}`).set({ ...listing, status: "draft" });
await assert.rejects(
  () =>
    mutate(
      "campaigns",
      "invalid-" + suffix,
      { ...campaign, productIds: [invalidId] },
      0,
    ),
  /eligible|active|public/i,
);
check();
await db.doc(`listings/${invalidId}`).update({ status: "removed" });
await assert.rejects(
  () =>
    mutate(
      "campaigns",
      "removed-" + suffix,
      { ...campaign, productIds: [invalidId] },
      0,
    ),
  /eligible/i,
);
check();
await assert.rejects(
  () =>
    mutate(
      "campaigns",
      "missing-" + suffix,
      { ...campaign, productIds: ["no-such-product"] },
      0,
    ),
  /eligible/i,
);
check();
await db
  .doc(`accountLifecycles/${sellerId}`)
  .set({ state: "deletion_pending" });
await assert.rejects(
  () =>
    mutate(
      "campaigns",
      "seller-deleted-" + suffix,
      { ...campaign, sellerIds: [sellerId], productIds: [] },
      0,
    ),
  /seller/i,
);
await db.doc(`accountLifecycles/${sellerId}`).delete();
check();
await db.doc(`users/${sellerId}`).update({ status: "removed" });
await assert.rejects(
  () =>
    mutate(
      "campaigns",
      "removed-seller-" + suffix,
      { ...campaign, sellerIds: [sellerId], productIds: [] },
      0,
    ),
  /seller/i,
);
check();
await db.doc(`users/${sellerId}`).update({ status: "active" });
// Valid PNG bytes from a deterministic synthetic fixture; no personal image data.
const zlib = await import("node:zlib");
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length);
  out.write(type, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, -4)), out.length - 4);
  return out;
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(1200);
ihdr.writeUInt32BE(400, 4);
ihdr[8] = 8;
ihdr[9] = 2;
const pixels = Buffer.alloc((1200 * 3 + 1) * 400, 0);
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(pixels)),
  chunk("IEND", Buffer.alloc(0)),
]);
await assert.rejects(
  () =>
    call(operator, "requestAdminAssetPermit", {
      sizeBytes: 3000000,
      contentType: "image/png",
    }),
  /PNG|2 MB/i,
);
check();
await assert.rejects(
  () =>
    call(operator, "requestAdminAssetPermit", {
      sizeBytes: 100,
      contentType: "image/svg+xml",
    }),
  /PNG/i,
);
check();
const expired = await call(operator, "requestAdminAssetPermit", {
  sizeBytes: png.length,
  contentType: "image/png",
});
await db
  .doc(`adminAssets/${expired.assetId}`)
  .update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
await assert.rejects(
  () =>
    uploadBytes(ref(operator.storage, expired.path), png, {
      contentType: "image/png",
    }),
  /unauthorized/i,
);
check();
const permit = await call(operator, "requestAdminAssetPermit", {
  sizeBytes: png.length,
  contentType: "image/png",
});
await assert.rejects(
  () =>
    uploadBytes(ref(member.storage, permit.path), png, {
      contentType: "image/png",
    }),
  /unauthorized/i,
);
check();
await uploadBytes(ref(operator.storage, permit.path), png, {
  contentType: "image/png",
});
check();
await assert.rejects(
  () =>
    uploadBytes(ref(operator.storage, permit.path), png, {
      contentType: "image/png",
    }),
  /unauthorized/i,
);
check();
await call(operator, "finalizeAdminAsset", { assetId: permit.assetId });
check();
await assert.rejects(
  () => getBytes(ref(anonymous.storage, permit.path)),
  /unauthorized/i,
);
check();
const bannerId = "banner-" + suffix,
  banner = {
    ...newContent("banners"),
    title: "Synthetic hero",
    assetId: permit.assetId,
    alt: "Synthetic campaign artwork",
    enabled: true,
  };
await mutate("banners", bannerId, banner, 0);
check();
await assert.rejects(
  () =>
    mutate(
      "banners",
      "wrong-aspect-" + suffix,
      { ...banner, placement: "mobile_hero" },
      0,
    ),
  /aspect/i,
);
check();
const collId = "collection-" + suffix;
await mutate(
  "collections",
  collId,
  {
    ...newContent("collections"),
    title: "Curated collection",
    slug: "weekend",
    productIds: [listingId],
    active: true,
  },
  0,
);
check();
const announceId = "announcement-" + suffix;
await mutate(
  "announcements",
  announceId,
  {
    ...newContent("announcements"),
    title: "Weekend deals live",
    enabled: true,
    endAt,
  },
  0,
);
check();
const home = {
  title: "Homepage",
  sections: [
    {
      ...newContent("homepage").sections[0],
      title: "Campaign hero",
      source: "CAMPAIGN",
      campaignId,
      enabled: true,
      bannerIds: [bannerId],
      order: 0,
    },
    {
      ...newContent("homepage").sections[2],
      sectionId: "selection",
      title: "Selected products",
      source: "MANUAL",
      collectionId: collId,
      productIds: [],
      order: 1,
    },
    {
      ...newContent("homepage").sections[2],
      sectionId: "notice",
      type: "announcement",
      title: "Notice",
      source: "MANUAL",
      announcementId: announceId,
      order: 2,
    },
    { ...newContent("homepage").sections[3], enabled: false, order: 3 },
  ],
};
const existingVersion =
  (
    await call(operator, "getAdminEditorialRecord", {
      kind: "homepage",
      id: "current",
    })
  ).record?.version ?? 0;
await mutate("homepage", "current", home, existingVersion);
check();
const preview = await call(operator, "previewAdminHomepage", { content: home });
assert.equal(preview.projection.sections.length, 3);
assert.equal(preview.projection.sections[0].cta.label, "Explore deals");
check();
assert.equal(preview.projection.sections[0].title, "Campaign hero");
assert.ok(
  !JSON.stringify(preview.projection).includes("PRIVATE EDITORIAL NOTES"),
);
check();

const liveBefore = (
  await call(operator, "getAdminEditorialRecord", {
    kind: "homepage",
    id: "current",
  })
).liveVersion;
await call(operator, "publishAdminHomepage", {
  expectedVersion: existingVersion + 1,
  expectedLiveVersion: liveBefore,
});
check();
const live = (await call(anonymous, "getPublicHomepage")).homepage;
assert.ok(live);
assert.equal(live.sections.length, 3);
assert.ok(!JSON.stringify(live).includes("createdBy"));
assert.ok(!JSON.stringify(live).includes(operator.uid));
check();
const combined = await call(anonymous, "getPublicListingPage", {
  filters: { sort: "newest", pageSize: 8 },
  cursor: null,
  includeHomepage: true,
});
assert.deepEqual(combined.homepage, live);
check();
const plainFeed = await call(anonymous, "getPublicListingPage", {
  filters: { sort: "newest", pageSize: 8 },
  cursor: null,
});
assert.equal("homepage" in plainFeed, false);
check();
await assert.rejects(
  () =>
    call(anonymous, "getPublicListingPage", {
      filters: {},
      includeHomepage: "true",
    }),
  /homepage request/i,
);
check();
assert.ok(!JSON.stringify(live).includes("private@example.test"));
assert.ok(!JSON.stringify(live).includes("PRIVATE EDITORIAL NOTES"));
assert.equal(
  (await getBytes(ref(anonymous.storage, permit.path))).byteLength,
  png.length,
);
check();
await mutate(
  "homepage",
  "current",
  { ...home, title: "Unpublished edit" },
  existingVersion + 1,
);
assert.deepEqual((await call(anonymous, "getPublicHomepage")).homepage, live);
check();
await assert.rejects(
  () =>
    call(operator, "publishAdminHomepage", {
      expectedVersion: existingVersion + 1,
      expectedLiveVersion: liveBefore,
    }),
  /changed/i,
);
check();
const sellerPage = await call(operator, "getAdminPage", {
  section: "users",
  recordId: sellerId,
  sellerSummary: true,
});
assert.equal(sellerPage.rows[0].activeListings, 1);
assert.equal(sellerPage.rows[0].sellerRating, null);
const namedSellers = await call(operator,"getAdminPage",{section:"users",search:"Synthetic",featureEligibleOnly:true,sellerSummary:true});
assert.ok(namedSellers.rows.some(r=>r.id===sellerId));
const namedProducts = await call(operator,"getAdminPage",{section:"listings",recordId:listingId,featureEligibleOnly:true});
assert.equal(namedProducts.rows[0].sellerName,"Synthetic seller");
assert.ok(!JSON.stringify(namedProducts).includes("private@example.test"));
check();
await db.doc(`reports/listing-report-${suffix}`).set({
  targetType: "listing",
  targetId: listingId,
  reporterId: operator.uid,
  status: "submitted",
  reason: "misleading",
  createdAt: now,
});
const reportedListings = await call(operator, "getAdminPage", {
  section: "listings",
  reported: true,
});
assert.ok(reportedListings.rows.some((row) => row.id === listingId));
check();
const user = await call(operator, "getAdminRecord", {
  section: "users",
  id: sellerId,
});
assert.ok(!JSON.stringify(user).includes("private@example.test"));
assert.ok(!JSON.stringify(user).includes("private address"));
assert.equal(user.row.location, "");
check();
const convId = "conversation-" + suffix,
  reportId = "report-" + suffix;
await db
  .doc(`conversations/${convId}`)
  .set({ buyerId: operator.uid, sellerId });
for (let i = 0; i < 12; i++)
  await db.doc(`conversations/${convId}/messages/message${i}`).set({
    senderId: sellerId,
    body: `Synthetic message ${i}`,
    createdAt: Timestamp.fromMillis(now.toMillis() + i * 1000),
  });
await db.doc(`reports/${reportId}`).set({
  targetType: "message",
  targetId: "message5",
  conversationId: convId,
  reporterId: operator.uid,
  reason: "spam",
  status: "submitted",
  details: "Reported synthetic context",
  createdAt: now,
});
const report = await call(operator, "getAdminRecord", {
  section: "reports",
  id: reportId,
});
assert.ok(!("recentConversationMessages" in report.detail));
assert.ok(!JSON.stringify(report).includes("Synthetic message"));
check();
await assert.rejects(
  () => call(operator, "loadAdminReportContext", { reportId, purpose: "x" }),
  /Explain/i,
);
check();
const context = await call(operator, "loadAdminReportContext", {
  reportId,
  purpose: "Review reported spam context",
});
assert.equal(context.messages.length, 5);
assert.equal(context.messages.filter((m) => m.reported).length, 1);
assert.ok(
  context.messages.every((m) =>
    ["message3", "message4", "message5", "message6", "message7"].includes(m.id),
  ),
);
check();
await call(operator, "updateAdminReport", {
  reportId,
  status: "reviewing",
  resolution: "",
  internalNotes: "Synthetic triage",
});
check();
const audit = await db
  .collection("adminAuditEvents")
  .where("resourceId", "==", reportId)
  .get();
assert.ok(audit.docs.some((d) => d.data().action === "load-reported-context"));
assert.ok(audit.docs.some((d) => d.data().action === "report-triage"));
check();
// A paired banner owns two art representations, one record and one public slot.
// It can publish without Campaign Manager, while all three versions stay guarded.
const mobileHeader = Buffer.from(ihdr);
mobileHeader.writeUInt32BE(900);
mobileHeader.writeUInt32BE(1000, 4);
const mobilePng = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", mobileHeader),
  chunk("IDAT", zlib.deflateSync(Buffer.alloc((900 * 3 + 1) * 1000))),
  chunk("IEND", Buffer.alloc(0)),
]);
const mobilePermit = await call(operator, "requestAdminAssetPermit", {
  sizeBytes: mobilePng.length,
  contentType: "image/png",
});
await uploadBytes(ref(operator.storage, mobilePermit.path), mobilePng, {
  contentType: "image/png",
});
await call(operator, "finalizeAdminAsset", { assetId: mobilePermit.assetId });
check();
// First resolve the deliberately unpublished Homepage edit from the earlier concurrency check.
const homeState = await call(operator, "getAdminEditorialRecord", {
  kind: "homepage",
  id: "current",
});
await call(operator, "publishAdminHomepage", {
  expectedVersion: homeState.record.version,
  expectedLiveVersion: homeState.liveVersion,
});
const pairedId = "paired-" + suffix;
const paired = {
  ...banner,
  title: "Electronics Week",
  campaignId: null,
  mobileAssetId: mobilePermit.assetId,
  enabled: false,
  destination: "/explore?category=electronics",
  startAt: null,
  endAt: null,
};
await mutate("banners", pairedId, paired, 0);
check();
const updateBanner = async (action, content = paired, expected) => {
  const r = await call(operator, "getAdminEditorialRecord", {
    kind: "banners",
    id: pairedId,
  });
  return call(operator, "mutateAdminEditorial", {
    kind: "banners",
    id: pairedId,
    expectedVersion: expected ?? r.record.version,
    expectedHomepageVersion: r.homepageVersion,
    expectedLiveVersion: r.liveVersion,
    action,
    content,
  });
};
const firstPublished = await updateBanner("publish");
check();
const bannerLive = (await call(anonymous, "getPublicHomepage")).homepage;
const pairedSection = bannerLive.sections.find(
  (s) => s.sectionId === "banner_" + pairedId,
);
assert.equal(pairedSection.banners.length, 2);
assert.deepEqual(
  pairedSection.banners.map((b) => b.placement),
  ["desktop_hero", "mobile_hero"],
);
check();
assert.ok(!JSON.stringify(bannerLive).includes(operator.uid));
check();
assert.equal(
  (await getBytes(ref(anonymous.storage, mobilePermit.path))).byteLength,
  mobilePng.length,
);
check();
await assert.rejects(() => updateBanner("pause", paired, 1), /changed/);
check();
await updateBanner("pause");
check();
assert.ok(
  !(await call(anonymous, "getPublicHomepage")).homepage.sections.some((s) =>
    s.banners.some((b) => b.url.includes(encodeURIComponent(mobilePermit.path))),
  ),
);
check();
await assert.rejects(
  () => getBytes(ref(anonymous.storage, mobilePermit.path)),
  /unauthorized|permission/,
);
check();
await updateBanner("schedule", {
  ...paired,
  startAt: new Date(Date.now() + 3600000).toISOString(),
  endAt: new Date(Date.now() + 7200000).toISOString(),
});
check();
assert.ok(
  !(await call(anonymous, "getPublicHomepage")).homepage.sections.some((s) =>
    s.banners.some((b) => b.url.includes(encodeURIComponent(mobilePermit.path))),
  ),
);
check();
await updateBanner("activate");
check();
const copy = await updateBanner("duplicate");
const copyRecord = await call(operator, "getAdminEditorialRecord", {
  kind: "banners",
  id: copy.id,
});
assert.equal(copyRecord.record.content.enabled, false);
assert.equal(copyRecord.record.content.startAt, null);
check();
const currentHome = await call(operator, "getAdminEditorialRecord", {
  kind: "homepage",
  id: "current",
});
await mutate(
  "homepage",
  "current",
  { ...currentHome.record.content, title: "Pending section changes" },
  currentHome.record.version,
);
await assert.rejects(() => updateBanner("pause"), /pending Homepage/);
check();
await call(operator, "publishAdminHomepage", {
  expectedVersion: currentHome.record.version + 1,
  expectedLiveVersion: currentHome.liveVersion,
});
// Collections become a real existing Home anchor, never an invented public route.
await updateBanner("publish", {
  ...paired,
  destination: "/#collection_" + collId,
});
assert.ok(
  (await call(anonymous, "getPublicHomepage")).homepage.sections.some(
    (s) => s.sectionId === "collection_" + collId,
  ),
);
check();
await assert.rejects(
  () =>
    updateBanner("publish", {
      ...paired,
      destination: "/listings/missing-public-product",
    }),
  /available|eligible|Choose/,
);
check();
const pairedAudit = await db
  .collection("adminAuditEvents")
  .where("resourceId", "==", pairedId)
  .get();
assert.ok(pairedAudit.docs.some((d) => d.data().action === "pause"));
assert.ok(pairedAudit.docs.some((d) => d.data().action === "schedule"));
check();
assert.ok(firstPublished.liveVersion > 0);

// An operator must still be able to end a campaign after a featured item is removed.
await db.doc(`listings/${listingId}`).update({ status: "removed" });
await mutate("campaigns", campaignId, campaign, 4, "end");
assert.equal(
  (
    await call(operator, "getAdminEditorialRecord", {
      kind: "campaigns",
      id: campaignId,
    })
  ).record.effectiveState,
  "ENDED",
);
assert.equal((await call(anonymous, "getPublicHomepage")).homepage, null);
check();
await assert.rejects(
  () => getBytes(ref(anonymous.storage, permit.path)),
  /unauthorized|permission/i,
);
check();
// Local-only maintenance control: new editorial writes stop, public reads continue.
const controlRef = db.doc("releaseControls/current"),
  priorControl = await controlRef.get();
try {
  await controlRef.set({
    releaseTarget: "demo",
    projectId: "demo-takeme",
    protectedWritesPaused: true,
  });
  await assert.rejects(
    () => mutate("campaigns", "paused-" + suffix, campaign, 0),
    /temporarily unavailable|system update/i,
  );
  check();
  await assert.rejects(
    () =>
      call(operator, "requestAdminAssetPermit", {
        sizeBytes: png.length,
        contentType: "image/png",
      }),
    /temporarily unavailable|system update/i,
  );
  check();
  await assert.rejects(
    () =>
      call(operator, "publishAdminHomepage", {
        expectedVersion: existingVersion + 2,
        expectedLiveVersion: liveBefore + 1,
      }),
    /temporarily unavailable|system update/i,
  );
  check();
  assert.equal((await call(anonymous, "getPublicHomepage")).homepage, null);
  check();
} finally {
  if (priorControl.exists) await controlRef.set(priorControl.data());
  else await controlRef.delete();
}
await Promise.all([
  deleteApp(operator.app),
  deleteApp(member.app),
  deleteApp(anonymous.app),
  adminDelete(admin),
]);
console.log(
  `Editorial emulator integration PASS: ${checks} assertions; no production access.`,
);
