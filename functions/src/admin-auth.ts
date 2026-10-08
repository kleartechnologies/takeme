import { getAuth } from "firebase-admin/auth";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

const DENIED = "Admin access is no longer available. Please sign in again.";

/** Admin-only boundary. Consumer authentication keeps its existing semantics. */
export async function verifyAdminIdentity(request: CallableRequest<unknown>) {
  try {
    if (!request.auth || request.auth.token.admin !== true)
      throw new Error("Missing admin authority");
    const header = request.rawRequest.headers.authorization;
    const match = typeof header === "string" && /^Bearer ([^\s]+)$/i.exec(header);
    if (!match || match[1]!.length > 8192)
      throw new Error("Missing bearer identity");
    const auth = getAuth();
    // The callable transport validates JWTs but does not request revocation checks.
    // Cookies contain this same ID token, so this applies to creation AND reuse.
    const verified = await auth.verifyIdToken(match[1]!, true);
    if (
      verified.uid !== request.auth.uid ||
      verified.admin !== true ||
      !Number.isSafeInteger(verified.exp) ||
      verified.exp * 1000 <= Date.now()
    )
      throw new Error("Invalid admin identity");
    // A token's embedded claim can outlive claim removal. This admin-only read
    // enforces current authority as well; never cache it across requests.
    const current = await auth.getUser(verified.uid);
    if (current.disabled || current.customClaims?.admin !== true)
      throw new Error("Admin authority removed");
    return { uid: verified.uid, expiresAt: verified.exp };
  } catch {
    // Do not expose SDK errors, account existence, claims, or token contents.
    throw new HttpsError("permission-denied", DENIED);
  }
}
