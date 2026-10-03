import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import { legalDraft, isLocalLegalPreview } from "@/lib/public-information";
import type { SetupStep } from "@/lib/auth-routing";

export const isLocalAccountSetup = isLocalLegalPreview;
export interface AccountSetupStatus { step: SetupStep }
async function call<T>(name: string, data = {}) {
  if (!functions || !isLocalAccountSetup()) throw new Error("Account setup is unavailable.");
  return (await httpsCallable<object, T>(functions, name)(data)).data;
}
export const getAccountSetupStatus = () => call<AccountSetupStatus>("getAccountSetupStatus");
export const acceptWebPolicies = (confirmed: boolean, agreed: boolean) => call("acceptWebPolicies", {
  confirmAge18: confirmed, acceptTerms: agreed, acceptPrivacy: agreed,
  termsVersion: legalDraft.version, privacyVersion: legalDraft.version,
});
export const completeFirstTimeProfile = () => call("completeFirstTimeProfile");
export const finishAccountWelcome = () => call("finishAccountWelcome");
