import { httpsCallable, type Functions } from "firebase/functions";
import { auth } from "@/lib/firebase/client";
import { ACCOUNT_ELIGIBILITY_EVENT, currentPolicyAllowsWrite, eligibilityMessage, isPendingResolutionMutation, isProtectedMarketplaceCallable } from "@/lib/account-eligibility";
import { cadenceErrorMessage } from "@/lib/cadence-error";
import { getAccountSetupStatus } from "@/lib/services/account-setup";
import { safeAuthNext } from "@/lib/auth-routing";
import { announceProtectedWriteMaintenance, ProtectedWriteMaintenanceError, protectedWriteMaintenanceMessage } from "@/lib/protected-write-maintenance";
import { assertProtectedWritesAvailable } from "@/lib/services/protected-write-status";

interface EligibilityHandlingOptions { checkPolicy?: boolean; notifyEligibility?: boolean; allowPendingResolution?: boolean; checkMaintenance?: boolean; notifyMaintenance?: boolean }

async function assertCurrentPolicy(uid: string | undefined, allowPendingResolution: boolean) {
  if (!uid) throw new Error("Sign in to continue.");
  const status = await getAccountSetupStatus();
  if (auth?.currentUser?.uid !== uid) throw new Error("The signed-in account changed. Please try again.");
  if (currentPolicyAllowsWrite(status) || allowPendingResolution && status.step === "deletion") return;
  if (status.step === "deletion") throw Object.assign(new Error("Account deletion is pending."), { code: "functions/failed-precondition", details: { reason: "account-policy-required" } });
  throw Object.assign(new Error("Current policy acceptance is required."), { code: "functions/failed-precondition",
    details: { reason: status.policyAvailable === true ? "account-policy-required" : "policy-release-unavailable" } });
}

// Recheck server-owned eligibility after a stale-session rejection. Routing preserves
// the current URL; it never retries the rejected marketplace action automatically.
export async function withEligibilityHandling<T>(action: () => Promise<T>, options: EligibilityHandlingOptions = {}): Promise<T> {
  const uid = auth?.currentUser?.uid;
  const intended = typeof window !== "undefined" ? safeAuthNext(`${window.location.pathname}${window.location.search}${window.location.hash}`) : undefined;
  try {
    if (options.checkMaintenance !== false) await assertProtectedWritesAvailable();
    if (options.checkPolicy !== false) await assertCurrentPolicy(uid, options.allowPendingResolution === true);
    return await action();
  }
  catch (error) {
    let maintenance = protectedWriteMaintenanceMessage(error);
    const ruleDenied = !!error && typeof error === "object" && "code" in error && ["permission-denied", "storage/unauthorized"].includes(String(error.code));
    // A direct write may race with the pause after its precheck. Distinguish it
    // from an account-policy rejection without redirecting or replaying anything.
    if (!maintenance && ruleDenied && options.checkMaintenance !== false) {
      try { await assertProtectedWritesAvailable(); }
      catch (statusError) { maintenance = protectedWriteMaintenanceMessage(statusError); }
    }
    if (maintenance) {
      if (options.notifyMaintenance !== false) announceProtectedWriteMaintenance();
      throw new ProtectedWriteMaintenanceError({ cause: error });
    }
    const cadenceMessage = cadenceErrorMessage(error);
    if (cadenceMessage) {
      const retryAfterMs = (error as { details?: { retryAfterMs?: unknown } }).details?.retryAfterMs;
      throw Object.assign(new Error(cadenceMessage), { code: "functions/resource-exhausted", details: { reason: "cadence-limit",
        ...(typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) ? { retryAfterMs: Math.max(1, Math.min(120_000, Math.ceil(retryAfterMs))) } : {}) } });
    }
    const message = eligibilityMessage(error);
    if (options.notifyEligibility !== false && (message || ruleDenied) && uid && auth?.currentUser?.uid === uid && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ACCOUNT_ELIGIBILITY_EVENT, { detail: { uid, intended } }));
    }
    if (message) throw new Error(message);
    if (ruleDenied) throw new Error("This action could not be authorised. Please check your account status before trying again.");
    throw error;
  }
}
export function marketplaceCallable<Request, Response>(service: Functions, name: string, options: { background?: boolean } = {}) {
  const invoke = httpsCallable<Request, Response>(service, name);
  return (data: Request) => withEligibilityHandling(() => invoke(data), {
    checkPolicy: options.background !== true && isProtectedMarketplaceCallable(name),
    checkMaintenance: options.background !== true && isProtectedMarketplaceCallable(name),
    notifyEligibility: options.background !== true,
    notifyMaintenance: options.background !== true,
    allowPendingResolution: isPendingResolutionMutation(name),
  });
}
