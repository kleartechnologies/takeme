import { accountIsActive, runGuardedTransaction } from "./account-lifecycle";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { CandidateSource } from "./intelligence-domain";

export interface ServedListing { id: string; source: CandidateSource; sectionId: string; reasonId: string }

export async function createDiscoverySession(uid: string, listings: ServedListing[], now = new Date()) {
  if (!listings.length) return null;
  const ref = getFirestore().collection("discoverySessions").doc();
  const created = await runGuardedTransaction(getFirestore(), async (tx) => { if (!(await accountIsActive(uid, tx))) return false; tx.create(ref, { userId: uid, listings: listings.slice(0, 80), createdAt: Timestamp.fromDate(now), expiresAt: Timestamp.fromMillis(now.getTime() + 2 * 60 * 60_000) }); return true; });
  if (!created) return null;
  return ref.id;
}

export async function verifyDiscoverySession(uid: string, sessionId: unknown, ids: string[], now = new Date()) {
  if (typeof sessionId !== "string" || !/^[A-Za-z0-9]{20}$/.test(sessionId)) throw new HttpsError("permission-denied", "A served discovery session is required.");
  const data = (await getFirestore().collection("discoverySessions").doc(sessionId).get()).data();
  if (!data || data.userId !== uid || !(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() <= now.getTime()) {
    throw new HttpsError("permission-denied", "Discovery session is unavailable or expired.");
  }
  const served = new Map<string, ServedListing>((Array.isArray(data.listings) ? data.listings : []).map((item: ServedListing) => [item.id, item]));
  if (ids.some((id) => !served.has(id))) throw new HttpsError("permission-denied", "This listing was not served in the discovery session.");
  return ids.map((id) => served.get(id)!);
}
