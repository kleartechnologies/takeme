import { AsyncLocalStorage } from "node:async_hooks";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore, type Transaction, type DocumentData } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";

const context = new AsyncLocalStorage<{ uid: string; alias?: string; resolution: boolean }>();
export const lifecycleRef = (uid: string) => getFirestore().doc(`accountLifecycles/${uid}`);

/** Read in the same transaction as a write: deletion initiation invalidates racing writes. */
export async function accountIsActive(uid: string, tx?: Transaction): Promise<boolean> {
  if (!uid || uid.startsWith("deleted-")) return false;
  const state = tx ? await tx.get(lifecycleRef(uid)) : await lifecycleRef(uid).get();
  if (state.exists) return false;
  try { return !(await getAuth().getUser(uid)).disabled; }
  catch (error) { if ((error as { code?: string }).code === "auth/user-not-found") return false; throw error; }
}

async function assertAccount(uid: string, resolution: boolean, tx?: Transaction) {
  const state = tx ? await tx.get(lifecycleRef(uid)) : await lifecycleRef(uid).get();
  if (state.exists && !(resolution && state.data()?.state === "deletion_pending")) {
    throw new HttpsError("failed-precondition", "Account deletion is pending. Only existing deal resolution and deletion status are available.");
  }
  try { if ((await getAuth().getUser(uid)).disabled) throw new HttpsError("unauthenticated", "Sign in again."); }
  catch (error) { if ((error as { code?: string }).code === "auth/user-not-found") throw new HttpsError("unauthenticated", "This account no longer exists."); throw error; }
}

// Keep Firebase's callable transport/auth validation; callers never choose their owner UID.
function call(resolution: boolean, handler: (request: CallableRequest<DocumentData>) => unknown | Promise<unknown>) {
  return onCall(async (request: CallableRequest<DocumentData>) => {
    if (!request.auth) return handler(request);
    await assertAccount(request.auth.uid, resolution);
    const original = request.auth.uid;
    const state = resolution ? (await lifecycleRef(original).get()).data() : null;
    const alias = state?.state === "deletion_pending" ? state.alias as string : undefined;
    const scoped = alias ? { ...request, auth: { ...request.auth, uid: alias } } : request;
    return context.run({ uid: original, alias, resolution }, () => handler(scoped));
  });
}
export const marketplaceCall = (handler: (request: CallableRequest<DocumentData>) => unknown | Promise<unknown>) => call(false, handler);
export const resolutionCall = (handler: (request: CallableRequest<DocumentData>) => unknown | Promise<unknown>) => call(true, handler);
export function runGuardedTransaction<T>(db: Firestore, handler: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.runTransaction(async (tx) => {
    const owner = context.getStore();
    if (owner) await assertAccount(owner.uid, owner.resolution, tx);
    return handler(tx);
  });
}

/** Only the authenticated owner sees their own pending pseudonym as their sign-in identity. */
export function visibleParticipantId(value: string) { const owner = context.getStore(); return owner?.alias === value ? owner.uid : value; }
