import { createHash } from "node:crypto";
import { getFirestore, Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { CADENCE_MESSAGE, CADENCE_POLICIES, planActionCadence, type CadenceAction, type CadenceEvent } from "./action-cadence-policy";
export type { CadenceAction } from "./action-cadence-policy";

/** Finish all business reads before this final read/write; retries return before consuming. */
export async function consumeActionCadence(tx: Transaction, uid: string, action: CadenceAction, now = Timestamp.now(),
  options: { amount?: number; resourceId?: string } = {}): Promise<void> {
  const ref = getFirestore().doc(`users/${uid}/private/cadence-${action}`);
  const snapshot = await tx.get(ref);
  const data = snapshot.data();
  const stored = data?.events;
  let events: CadenceEvent[] = [];
  if (snapshot.exists) {
    if (data?.version !== 1 || data.action !== action || !Array.isArray(stored) || stored.length > CADENCE_POLICIES[action].limit
      || stored.some((event) => !event || !(event.at instanceof Timestamp) || (event.resource !== undefined && (typeof event.resource !== "string" || !/^[a-f0-9]{64}$/.test(event.resource))))) {
      throw new HttpsError("resource-exhausted", CADENCE_MESSAGE, { reason: "cadence-limit", retryAfterMs: CADENCE_POLICIES[action].windowMs });
    }
    events = stored.map((event) => ({ at: event.at.toMillis(), ...(event.resource ? { resource: event.resource } : {}) }));
  }
  const resource = options.resourceId ? createHash("sha256").update(options.resourceId).digest("hex") : undefined;
  // A retried transaction can observe an action committed after its caller's
  // original timestamp. Refresh the server clock after the final quota read.
  const clock = Timestamp.fromMillis(Math.max(Timestamp.now().toMillis(), now.toMillis()));
  const result = planActionCadence(action, events, clock.toMillis(), { amount: options.amount, resource });
  if (!result.allowed) throw new HttpsError("resource-exhausted", CADENCE_MESSAGE, { reason: "cadence-limit", retryAfterMs: result.retryAfterMs });
  tx.set(ref, { version: 1, action, events: result.events.map((event) => ({ ...event, at: Timestamp.fromMillis(event.at) })), updatedAt: clock, expiresAt: Timestamp.fromMillis(result.expiresAt) });
}
