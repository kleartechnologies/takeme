export const ACCOUNT_ELIGIBILITY_EVENT = "takeme:account-eligibility-required";
export interface AccountEligibilityEventDetail { uid: string; intended?: string }

/** Setup/profile completion is separate from acceptance; onboarding uploads need eligibility too. */
export function currentPolicyAllowsWrite(setup: { step: string; policyAvailable?: boolean } | null) {
  return setup?.policyAvailable === true && ["profile", "welcome", "ready"].includes(setup.step);
}

const protectedCallables = new Set([
  "cancelAuction", "cancelPromotionRequest", "confirmTransactionCompletion", "createAuctionListing", "createFixedListingDraft",
  "createPromotionRequest", "declineTransactionCancellation", "deleteSavedSearch", "disputeTransaction", "markAllNotificationsRead",
  "markConversationSeen", "markNotificationRead", "openListingConversation", "openNotification", "openTransactionConversation",
  "beginListingMedia", "placeBid", "publishAuctionListing", "publishFixedListing", "removeFixedListing", "reportPublicReview", "requestTransactionCancellation",
  "requestUploadPermits", "respondToOffer", "saveSearch", "sendConversationMessage", "setNotificationPreference", "setSellerFollow",
  "submitMarketplaceReport", "submitOffer", "submitTransactionReview", "trackMarketplaceEvent", "trackPromotionEngagement",
  "updateAdminReport", "updateAuctionListing", "updateFixedListing", "createProtectedPayment", "respondToProtectedDispute", "addProtectedDisputeEvidence",
]);
export const isProtectedMarketplaceCallable = (name: string) => protectedCallables.has(name);
export function isPendingResolutionMutation(name: string) {
  return ["confirmTransactionCompletion", "requestTransactionCancellation", "declineTransactionCancellation", "disputeTransaction",
    "respondToProtectedDispute", "addProtectedDisputeEvidence"].includes(name);
}
export function eligibilityReason(error: unknown): "account-policy-required" | "policy-release-unavailable" | null {
  if (!error || typeof error !== "object" || !("details" in error)) return null;
  const details = error.details;
  if (!details || typeof details !== "object" || !("reason" in details)) return null;
  return details.reason === "account-policy-required" || details.reason === "policy-release-unavailable" ? details.reason : null;
}
export function eligibilityMessage(error: unknown): string | null {
  const reason = eligibilityReason(error);
  return reason === "account-policy-required" ? "Please confirm you are 18 or older and accept TAKEME’s current policies before continuing."
    : reason === "policy-release-unavailable" ? "TAKEME’s policies are awaiting launch approval. Protected marketplace actions are unavailable; you can still browse." : null;
}
