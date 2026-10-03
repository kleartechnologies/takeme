import { httpsCallable } from "firebase/functions";
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, type User } from "firebase/auth";
import { functions } from "@/lib/firebase/client";
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
export async function reauthenticateForDeletion(user: User, method: "password" | "google", password: string) {
  if (method === "google") await reauthenticateWithPopup(user, new GoogleAuthProvider());
  else {
    if (!user.email || !password) throw new Error("Enter your current password.");
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  }
  await user.getIdToken(true);
}
export async function initiateAccountDeletion(retry = false) {
  const status = await call(retry ? "retryAccountDeletion" : "requestAccountDeletion", retry ? {} : { confirmation: "DELETE", policyVersion: DELETION_POLICY_VERSION });
  clearPublicSellerSummaryCache();
  return status;
}
