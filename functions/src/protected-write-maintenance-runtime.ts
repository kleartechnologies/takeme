import { getFirestore, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { runtimePolicyContext } from "./account-eligibility.ts";
import {
  maintenanceIsPaused, PROTECTED_WRITE_MAINTENANCE_MESSAGE, PROTECTED_WRITE_MAINTENANCE_REASON,
  type ProtectedWriteStatus,
} from "./protected-write-maintenance.ts";

/** Does not consult acceptance/publication state and never creates a control document. */
export async function readProtectedWriteStatus(tx?: Transaction): Promise<ProtectedWriteStatus> {
  try {
    const context = runtimePolicyContext();
    if (!context) return { protectedWritesPaused: true };
    const ref = getFirestore().doc("releaseControls/current");
    const snapshot = tx ? await tx.get(ref) : await ref.get();
    // A present document with unavailable data is malformed, rather than absent.
    const value = snapshot.exists ? snapshot.data() ?? null : undefined;
    return { protectedWritesPaused: maintenanceIsPaused(value, context) };
  } catch { return { protectedWritesPaused: true }; }
}

export async function assertProtectedWritesAvailable(tx?: Transaction): Promise<void> {
  if ((await readProtectedWriteStatus(tx)).protectedWritesPaused) {
    throw new HttpsError("failed-precondition", PROTECTED_WRITE_MAINTENANCE_MESSAGE, { reason: PROTECTED_WRITE_MAINTENANCE_REASON });
  }
}

/** Public read-only availability projection: no identity, policy or private control fields. */
export const getProtectedWriteStatus = onCall({ region: "asia-southeast1", maxInstances: 20 }, async () => readProtectedWriteStatus());
