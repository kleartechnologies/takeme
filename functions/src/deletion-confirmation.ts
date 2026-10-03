import { HttpsError } from "firebase-functions/v2/https";

/** Bind the displayed confirmation to the current authenticated owner; never select an owner. */
export function assertDeletionOwnerBinding(authenticatedUid: string, expectedOwnerUid: unknown): void {
  if (typeof expectedOwnerUid !== "string" || !expectedOwnerUid || expectedOwnerUid !== authenticatedUid) {
    throw new HttpsError("failed-precondition", "Your signed-in account changed. Review deletion for the current account and try again.", { reason: "account-changed" });
  }
}
