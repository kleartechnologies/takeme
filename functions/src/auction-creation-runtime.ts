import { getFirestore, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { trustedReleaseControlContext } from "./trusted-release-control-context.ts";
import { auctionCreationIsPaused, AUCTION_CREATION_CONTROL_PATH, AUCTION_CREATION_PAUSED_MESSAGE, AUCTION_CREATION_PAUSED_REASON } from "./auction-creation-control.ts";

/** Server-only, uncached, no policy activation, no public control projection or automatic writes. */
export async function assertAuctionCreationAvailable(tx?: Transaction): Promise<void> {
  let paused = true;
  try {
    const context = trustedReleaseControlContext();
    if (context) {
      const ref = getFirestore().doc(AUCTION_CREATION_CONTROL_PATH);
      const snapshot = tx ? await tx.get(ref) : await ref.get();
      paused = auctionCreationIsPaused(snapshot.exists ? snapshot.data() ?? null : undefined, context);
    }
  } catch { /* Read/identity errors remain fail-closed. */ }
  if (paused) throw new HttpsError("failed-precondition", AUCTION_CREATION_PAUSED_MESSAGE, { reason: AUCTION_CREATION_PAUSED_REASON });
}
