import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import { getReleasePolicy, policyIsConfigured } from "../../../functions/src/release-policy";
import type { SetupStep } from "@/lib/auth-routing";

export const isLocalAccountSetup = () => process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "demo-takeme";
export const accountReleasePolicy = () => getReleasePolicy(isLocalAccountSetup() ? "demo" : "production");
export const accountPolicyAvailable = () => policyIsConfigured(accountReleasePolicy());
export interface AccountSetupStatus { step: SetupStep; policyAvailable?: boolean; termsVersion?: string | null; privacyVersion?: string | null; minimumAge?: 18 }
async function call<T>(name: string, data = {}) {
  if (!functions) throw new Error("Account setup is unavailable.");
  return (await httpsCallable<object, T>(functions, name)(data)).data;
}
export const getAccountSetupStatus = () => call<AccountSetupStatus>("getAccountSetupStatus");
export const acceptWebPolicies = (confirmed: boolean, agreed: boolean) => {
  const policy = accountReleasePolicy();
  if (!policyIsConfigured(policy)) throw new Error("TAKEME’s policies are awaiting launch approval. Marketplace activity is unavailable.");
  return call("acceptWebPolicies", {
    confirmAge18: confirmed, acceptTerms: agreed, acceptPrivacy: agreed,
    termsVersion: policy.termsVersion, privacyVersion: policy.privacyVersion,
  });
};
export const completeFirstTimeProfile = () => call("completeFirstTimeProfile");
export const finishAccountWelcome = () => call("finishAccountWelcome");
