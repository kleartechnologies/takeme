import { httpsCallable } from "firebase/functions";
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, type User } from "firebase/auth";
import { auth, functions } from "@/lib/firebase/client";
import { clearPublicSellerSummaryCache } from "@/lib/services/public-sellers";

export const DELETION_POLICY_VERSION = "v1-2026-10-03";
export interface DeletionStatus {
  state: "not_requested" | "pending" | "cleaning" | "blocked" | "failed" | "completed";
  phase?: string;
  blockers?: string[];
  failureCode?: string | null;
  requestedAt?: string | null;
  completedAt?: string | null;
  policyVersion: string;
}
async function call(name: string, input: Record<string, unknown> = {}) {
  if (!functions) throw new Error("Account deletion is temporarily unavailable.");
  return (await httpsCallable<Record<string, unknown>, DeletionStatus>(functions, name)(input)).data;
}
export const getAccountDeletionStatus = () => call("getAccountDeletionStatus");
export interface DeletionAvailability { available: boolean; environment: "demo" | "production" | "unavailable" }
export async function getAccountDeletionAvailability(): Promise<DeletionAvailability> {
  if (!functions) return { available: false, environment: "unavailable" };
  return (await httpsCallable<Record<string, never>, DeletionAvailability>(functions, "getAccountDeletionAvailability")({})).data;
}
export async function reauthenticateForDeletion(user: User, method: "password" | "google", password: string) {
  if (method === "google") await reauthenticateWithPopup(user, new GoogleAuthProvider());
  else {
    if (!user.email || !password) throw new Error("Enter your current password.");
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  }
  await user.getIdToken(true);
}
export function assertCurrentDeletionOwner(expectedOwnerUid: string) {
  if (!expectedOwnerUid || auth?.currentUser?.uid !== expectedOwnerUid) {
    throw Object.assign(new Error("The signed-in account changed."), { code: "functions/failed-precondition", details: { reason: "account-changed" } });
  }
}
export async function initiateAccountDeletion(expectedOwnerUid: string, retry = false) {
  assertCurrentDeletionOwner(expectedOwnerUid);
  // The server compares this confirmation owner with its authenticated UID. It
  // never uses a caller-supplied UID to select the account that will be deleted.
  const status = await call(retry ? "retryAccountDeletion" : "requestAccountDeletion", {
    expectedOwnerUid,
    ...(retry ? {} : { confirmation: "DELETE", policyVersion: DELETION_POLICY_VERSION }),
  });
  clearPublicSellerSummaryCache();
  return status;
}
