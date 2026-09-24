import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, getIdToken } from "firebase/auth";
import { connectFirestoreEmulator, collection, getDocs, getFirestore, limit, query } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const projectId = "demo-takeme";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const requireFunctions = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = requireFunctions("firebase-admin/app");
const { getAuth: getAdminAuth } = requireFunctions("firebase-admin/auth");
const { getFirestore: getAdminFirestore, Timestamp } = requireFunctions("firebase-admin/firestore");
const adminApp = initializeAdmin({ projectId }, `phase9-admin-${Date.now()}`);
const db = getAdminFirestore(adminApp);
const adminAuth = getAdminAuth(adminApp);
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const config = { apiKey: "demo-api-key", authDomain: `${projectId}.firebaseapp.com`, projectId, storageBucket: `${projectId}.firebasestorage.app`, appId: "1:123456789:web:demo" };
async function client(label) {
  const app = initializeApp(config, `${label}-${suffix}`);
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const functions = getFunctions(app, "asia-southeast1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  await createUserWithEmailAndPassword(auth, `${label}-${suffix}@example.test`, "TestPass123!");
  return { app, auth, firestore, functions, uid: auth.currentUser.uid };
}
const call = (person, name, data) => httpsCallable(person.functions, name)(data).then((response) => response.data);
const [operator, member] = await Promise.all([client("phase9-operator"), client("phase9-member")]);
await assert.rejects(() => call(member, "getAdminMetrics", { section: "overview" }), /permission|administrator/i);
await assert.rejects(() => call(member, "getAdminPage", { section: "users" }), /permission|administrator/i);
await assert.rejects(() => call(member, "getAdminRecord", { section: "users", id: member.uid }), /permission|administrator/i);
await assert.rejects(() => getDocs(query(collection(member.firestore, "marketplaceEvents"), limit(10))), /permission/i);
await adminAuth.setCustomUserClaims(operator.uid, { admin: true });
await getIdToken(operator.auth.currentUser, true);

const historic = Timestamp.fromDate(new Date("2025-01-05T04:00:00Z"));
const confirmed = Timestamp.fromDate(new Date("2025-01-05T05:00:00Z"));
const range = { preset: "custom", from: "2025-01-05", to: "2025-01-05" };
const card = (data, label) => data.cards.find((item) => item.label === label);
const [beforeRevenue, beforePromotion, beforeReviews] = await Promise.all([
  call(operator, "getAdminMetrics", { section: "revenue", ...range }),
  call(operator, "getAdminMetrics", { section: "promotions", ...range }),
  call(operator, "getAdminMetrics", { section: "reviews", ...range }),
]);
const sellerId = member.uid;
await db.doc(`users/${operator.uid}`).set({ uid: operator.uid, displayName: "Emulator operator", photoURL: null, location: "Kuala Lumpur", createdAt: historic, updatedAt: historic });
await db.doc(`users/${sellerId}`).set({ uid: sellerId, displayName: "Emulator member", photoURL: null, location: "Kuala Lumpur", createdAt: historic, updatedAt: historic });
const seed = [
  { id: `phase9-completed-${suffix}`, status: "completed", amountSen: 12543090, type: "buy_now", categoryId: "electronics", completedAt: confirmed },
  { id: `phase9-pending-${suffix}`, status: "in_progress", amountSen: 99999900, type: "offer", categoryId: "electronics", completedAt: null },
  { id: `phase9-cancelled-${suffix}`, status: "cancelled", amountSen: 250000, type: "auction", categoryId: "games", completedAt: null },
  { id: `phase9-disputed-${suffix}`, status: "disputed", amountSen: 750000, type: "buy_now", categoryId: "games", completedAt: null },
];
for (const item of seed) await db.doc(`transactions/${item.id}`).set({ ...item, buyerId: operator.uid, sellerId, listingId: `phase9-listing-${suffix}`, listingTitle: "Phase 9 emulator fixture", sourceId: item.id,
  buyerConfirmedAt: item.status === "completed" ? confirmed : null, sellerConfirmedAt: item.status === "completed" ? confirmed : null, currency: "MYR", createdAt: historic, updatedAt: historic });
await db.doc(`listings/phase9-listing-${suffix}`).set({ sellerId, title: "Phase 9 emulator fixture", price: 999999, listingType: "buy_now", status: "active", categoryId: "electronics", createdAt: historic, updatedAt: historic });
await db.doc(`promotions/phase9-unpaid-${suffix}`).set({ listingId: `phase9-listing-${suffix}`, sellerId, type: "boost", status: "pending_payment", paymentStatus: "not_configured", priceSen: 999000, impressions: 0, clicks: 0, createdAt: historic, updatedAt: historic });
await db.doc(`trustSummaries/${operator.uid}`).set({ userId: operator.uid, buyer: { completedCount: 5, tier: "bronze" }, seller: { completedCount: 1, tier: null }, updatedAt: historic });
await db.doc(`publicReviews/phase9-review-${suffix}`).set({ reviewedUserId: sellerId, reviewerRole: "buyer", rating: 5, publishedAt: historic, createdAt: historic, tags: ["Item as described"], comment: "Emulator review" });

const revenue = await call(operator, "getAdminMetrics", { section: "revenue", ...range });
assert.equal(card(revenue, "Completed transactions").value - card(beforeRevenue, "Completed transactions").value, 1);
assert.equal(card(revenue, "GMV").value - card(beforeRevenue, "GMV").value, 12543090);
assert.equal(revenue.breakdowns.find((item) => item.label.includes("agreement type")).items.find((item) => item.label === "Buy Now").amountSen - beforeRevenue.breakdowns.find((item) => item.label.includes("agreement type")).items.find((item) => item.label === "Buy Now").amountSen, 12543090);
assert.equal(revenue.breakdowns.find((item) => item.label.includes("category")).items.find((item) => item.label === "electronics").amountSen - beforeRevenue.breakdowns.find((item) => item.label.includes("category")).items.find((item) => item.label === "electronics").amountSen, 12543090);
const promotion = await call(operator, "getAdminMetrics", { section: "promotions", ...range });
assert.equal(card(promotion, "Boost requests").value - card(beforePromotion, "Boost requests").value, 1);
assert.equal(card(promotion, "Boost revenue").value, null);
assert.equal(card(promotion, "Boost purchases").value, null);
const users = await call(operator, "getAdminMetrics", { section: "users", ...range });
assert.equal(card(users, "Active users").value, null);
assert.ok(users.breakdowns[0].items.find((item) => item.label === "bronze").count >= 1);
const reviews = await call(operator, "getAdminMetrics", { section: "reviews", ...range });
assert.equal(card(reviews, "Reviews published").value - card(beforeReviews, "Reviews published").value, 1);
assert.equal(reviews.breakdowns[0].items.find((item) => item.label === "5 stars").count - beforeReviews.breakdowns[0].items.find((item) => item.label === "5 stars").count, 1);
const userDetail = await call(operator, "getAdminRecord", { section: "users", id: operator.uid });
assert.ok(userDetail.detail.completedBuyerValueSen >= 12543090);
assert.equal(userDetail.detail.buyerTier, "bronze");
const transactionDetail = await call(operator, "getAdminRecord", { section: "transactions", id: seed[0].id });
assert.equal(transactionDetail.detail.buyerReviewed, false);
for (const section of ["overview", "listings", "transactions", "intelligence", "reports", "settings"]) {
  const result = await call(operator, "getAdminMetrics", { section, ...range });
  assert.equal(result.section, section);
  assert.ok(Array.isArray(result.cards));
}
const reportDate = Timestamp.fromDate(new Date(Date.now() + 86_400_000));
for (let index = 0; index < 22; index += 1) await db.doc(`reports/phase9-page-${suffix}-${index}`).set({ reporterId: operator.uid, targetType: "listing", targetId: `phase9-listing-${suffix}`, reason: "spam", details: "Emulator-only report", status: "submitted", createdAt: reportDate, updatedAt: reportDate });
const firstPage = await call(operator, "getAdminPage", { section: "reports", status: "submitted" });
assert.equal(firstPage.rows.length, 20);
assert.ok(firstPage.nextCursor);
const secondPage = await call(operator, "getAdminPage", { section: "reports", status: "submitted", cursor: firstPage.nextCursor });
assert.ok(secondPage.rows.length >= 2);
assert.equal(new Set([...firstPage.rows, ...secondPage.rows].map((row) => row.id)).size, firstPage.rows.length + secondPage.rows.length);
const triageId = `phase9-page-${suffix}-0`;
await assert.rejects(() => call(member, "updateAdminReport", { reportId: triageId, status: "resolved", resolution: "Reviewed", internalNotes: "Private" }), /permission|administrator/i);
await assert.rejects(() => call(operator, "updateAdminReport", { reportId: triageId, status: "resolved", resolution: "", internalNotes: "Private" }), /resolution/i);
assert.equal((await call(operator, "updateAdminReport", { reportId: triageId, status: "resolved", resolution: "Reviewed", internalNotes: "Private" })).updated, true);
const triaged = await call(operator, "getAdminRecord", { section: "reports", id: triageId });
assert.equal(triaged.detail.internalNotes, "Private");
assert.equal((await db.doc(`reports/${triageId}`).get()).data().status, "resolved");

await Promise.all([deleteApp(operator.app), deleteApp(member.app), deleteAdmin(adminApp)]);
console.log("Admin emulator integration passed: claim gate, private reads, completed-only GMV, promotion separation, date filters, tier/rating distribution, detail and pagination.");
