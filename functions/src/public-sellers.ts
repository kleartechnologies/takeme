import { marketplaceCall as onCall } from "./account-lifecycle";
import { lifecycleRef } from "./account-lifecycle";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { publicSellerIds, publicSellerSummary } from "./public-seller-domain";

const db = getFirestore();

/** One bounded join replaces per-card profile and reputation reads. */
export const getPublicSellerSummaries = onCall(async (request) => {
  let ids: string[];
  try { ids = publicSellerIds(request.data?.sellerIds); }
  catch (error) { throw new HttpsError("invalid-argument", error instanceof Error ? error.message : "Seller IDs are invalid."); }
  if (!ids.length) return { sellers: [] };

  const profileRefs = ids.map((userId) => db.collection("users").doc(userId));
  const trustRefs = ids.map((userId) => db.collection("trustSummaries").doc(userId));
  const [profiles, summaries] = await Promise.all([db.getAll(...profileRefs), db.getAll(...trustRefs)]);
  const lifecycle = await Promise.all(ids.map((uid) => lifecycleRef(uid).get()));
  const sellers = ids.map((userId, index) => lifecycle[index]?.exists ? null : publicSellerSummary(userId, profiles[index]?.data(), summaries[index]?.data())).filter((value) => value !== null);
  return { sellers };
});
