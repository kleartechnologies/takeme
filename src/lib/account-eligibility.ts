export const ACCOUNT_ELIGIBILITY_EVENT = "takeme:account-eligibility-required";
export function eligibilityReason(error: unknown): "account-policy-required" | "policy-release-unavailable" | null {
  if (!error || typeof error !== "object" || !("details" in error)) return null;
  const details = error.details;
  if (!details || typeof details !== "object" || !("reason" in details)) return null;
  return details.reason === "account-policy-required" || details.reason === "policy-release-unavailable" ? details.reason : null;
}
export function eligibilityMessage(error: unknown): string | null {
  const reason = eligibilityReason(error);
  return reason === "account-policy-required" ? "Please confirm you are 18 or older and accept TAKEME’s current policies before continuing."
    : reason === "policy-release-unavailable" ? "TAKEME’s policies are awaiting launch approval. Marketplace activity is unavailable." : null;
}
