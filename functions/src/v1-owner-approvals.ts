import { productionReleasePolicy } from "./release-policy.ts";

// Human owner approval of content/product decisions for release preparation.
// This is not counsel approval, publication or production authority. The date has separate explicit owner approval.
export const v1OwnerApprovalReference = "Owner instruction: APPLY FINAL OWNER APPROVALS FOR TAKEME V1 LEGAL CONTENT";
export const ownerApprovedPreparationItems = Object.freeze({
  terms: true, privacyEn: true, privacyBm: true, prohibitedItems: true,
  productPolicyModel: true, publicBrowsingMigration: true, immutableAcceptanceHistory: true,
  protectedWriteMaintenance: true, productionActivationRunbook: true,
});

// Approval belongs to the expressly approved 1.0 content; a later source version
// cannot inherit it automatically. This is evidence scope, not a policy-version override.
export const v1OwnerDocumentApproval = (version: string | null) => Object.freeze({
  version, ownerStatus: version === "1.0" ? "owner-approved" as const : "not-approved" as const, counselStatus: "outstanding" as const,
});
export const v1OwnerLegalDocuments = Object.freeze({
  terms: v1OwnerDocumentApproval(productionReleasePolicy.termsVersion),
  privacyEn: v1OwnerDocumentApproval(productionReleasePolicy.privacyVersion),
  privacyBm: v1OwnerDocumentApproval(productionReleasePolicy.privacyVersion),
  prohibitedItems: v1OwnerDocumentApproval(productionReleasePolicy.termsVersion),
});

export const ownerApprovedV1ProductDecisions = Object.freeze({
  minimumAge18: true,
  publicBrowsingWithoutCurrentAcceptance: true,
  protectedWritesRequireCurrentAcceptance: true,
  immutableAcceptanceHistory: true,
  preserveReturnIntentWithoutAutomaticAction: true,
  oneAccountForBuyingAndSelling: true,
  marketplaceIntermediaryModel: true,
  accountDeletionModelWithSeparateActivation: true,
  prohibitedItemsEnforcementModel: true,
  directBuyerSellerTransactions: true,
  noIntegratedCheckoutPayments: true,
  noSellerPayouts: true,
  noIntegratedShippingAwb: true,
  noSellerCentre: true,
  noShortVideoLiveCommerce: true,
});

export const deferredV1OwnerDecisions = Object.freeze({
  addressDisclosure: false, retention: false, launchDate: true, productionActivation: false, domainCutover: false,
});
