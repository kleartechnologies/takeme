import { trustedReleaseControlContext } from "./trusted-release-control-context.ts";
import { assertAuctionCreationAvailable } from "./auction-creation-runtime.ts";
import { AsyncLocalStorage } from "node:async_hooks";
import { getFirestore, type DocumentReference, type DocumentData, type Firestore, type Transaction,
  type ReadOnlyTransactionOptions, type ReadWriteTransactionOptions, type SetOptions } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { maintenanceIsPaused, PROTECTED_WRITE_MAINTENANCE_MESSAGE, PROTECTED_WRITE_MAINTENANCE_REASON } from "./protected-write-maintenance.ts";

// Output-only historical-handler bridge support. Not exported by the current
// serving index. No policy/lifecycle/acceptance path is replaced or bypassed.
const protectedInvocation = new AsyncLocalStorage<{ auctionCreation: boolean }>();
/** No raw config, credentials, policy reads or automatic record creation. */
export async function historicalProtectedWriteStatus(tx?: Transaction) {
  try {
    const context = trustedReleaseControlContext();
    if (!context) return { protectedWritesPaused: true };
    const ref = getFirestore().doc("releaseControls/current");
    const snapshot = tx ? await tx.get(ref) : await ref.get();
    return { protectedWritesPaused: maintenanceIsPaused(snapshot.exists ? snapshot.data() ?? null : undefined, context) };
  } catch { return { protectedWritesPaused: true }; }
}

export async function assertHistoricalProtectedWritesAvailable(tx?: Transaction) {
  if ((await historicalProtectedWriteStatus(tx)).protectedWritesPaused) {
    throw new HttpsError("failed-precondition", PROTECTED_WRITE_MAINTENANCE_MESSAGE, { reason: PROTECTED_WRITE_MAINTENANCE_REASON });
  }
}

/** Runs inside the original onCall transport and preserves its original handler. */
export async function invokeHistoricalProtectedWrite<T>(request: { auth?: unknown }, handler: () => Promise<T>, auctionCreation = false): Promise<T> {
  if (!request.auth) return handler(); // Original authentication failure/contract.
  await assertHistoricalProtectedWritesAvailable();
  if (auctionCreation) await assertAuctionCreationAvailable();
  return protectedInvocation.run({ auctionCreation }, handler);
}

/** Scoped first-read guard; derived/read transactions retain their old semantics. */
export function runHistoricalMaintenanceTransaction<T>(db: Firestore, handler: (tx: Transaction) => Promise<T>, options?: ReadWriteTransactionOptions | ReadOnlyTransactionOptions): Promise<T> {
  return db.runTransaction(async tx => {
    const scope = protectedInvocation.getStore();
    if (scope) await assertHistoricalProtectedWritesAvailable(tx);
    if (scope?.auctionCreation) await assertAuctionCreationAvailable(tx);
    return handler(tx);
  }, options);
}

/** Three reviewed legacy standalone writes have ignored WriteResult values.
 * Convert only those awaits to guarded transactions; preserve payload/merge and
 * create-only semantics, preventing a pause race from committing a new write. */
export async function writeHistoricalMaintenanceDocument(ref: DocumentReference, kind: "create" | "set", data: DocumentData, options?: SetOptions): Promise<void> {
  if (!protectedInvocation.getStore()) {
    if (kind === "create") await ref.create(data);
    else if (options) await ref.set(data, options);
    else await ref.set(data);
    return;
  }
  await runHistoricalMaintenanceTransaction(ref.firestore, async tx => {
    if (kind === "create") tx.create(ref, data);
    else if (options) tx.set(ref, data, options);
    else tx.set(ref, data);
  });
}
