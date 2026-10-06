export type LegalDetailResolution = "pending" | "approved" | "not-required";
export interface AddressPublicationDisposition {
  readonly addressPublicationDecision: "NOT_PUBLISHED_FOR_V1";
  readonly ownerApproved: true;
  readonly legalCounselStatus: "OUTSTANDING";
}

// Explicit owner launch decision, not a conclusion about Malaysian address law
// and not counsel approval. No address is inferred or supplied by this record.
export const v1AddressPublicationDisposition: Readonly<AddressPublicationDisposition> = Object.freeze({
  addressPublicationDecision: "NOT_PUBLISHED_FOR_V1", ownerApproved: true, legalCounselStatus: "OUTSTANDING",
});

export function isOwnerApprovedAddressOmission(value: unknown): value is AddressPublicationDisposition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 3
    && ["addressPublicationDecision", "ownerApproved", "legalCounselStatus"].every(key => Object.hasOwn(record, key))
    && record.addressPublicationDecision === "NOT_PUBLISHED_FOR_V1"
    && record.ownerApproved === true && record.legalCounselStatus === "OUTSTANDING";
}

export interface LegalPublicationReadiness {
  publicationApproved: boolean;
  finalContentApproved: boolean;
  bmPrivacyNoticeApproved: boolean;
  registration: LegalDetailResolution;
  address: LegalDetailResolution;
  addressDisposition?: AddressPublicationDisposition;
  productionRoutesReviewed: boolean;
  effectiveDate: string | null;
  lastUpdated: string | null;
}

// Shared by legal routes, final launch qualification and the private policy bootstrap.
// Registration and address omission are owner-confirmed; publication remains closed.
export const legalPublicationReadiness: Readonly<LegalPublicationReadiness> = Object.freeze({
  publicationApproved: false, finalContentApproved: false, bmPrivacyNoticeApproved: false,
  registration: "approved", address: "pending", productionRoutesReviewed: false,
  addressDisposition: v1AddressPublicationDisposition,
  effectiveDate: "2026-10-12", lastUpdated: "2026-10-12",
});

// Owner-approved V1 date rule; the prepared date is not an activation schedule.
// A later launch-date change requires separate explicit approval.
export const legalLaunchDatePolicy = Object.freeze({
  effectiveDate: "actual-public-launch-date",
  lastUpdated: "same-as-public-launch-date-for-v1-unless-separately-changed",
});

/** Exact calendar date only; draft dates cannot become final through an environment flag. */
export function isLegalCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function validateLegalPublication(readiness: LegalPublicationReadiness = legalPublicationReadiness): string[] {
  const issues: string[] = [];
  if (readiness.publicationApproved !== true) issues.push("Independent legal publication approval is required.");
  if (readiness.finalContentApproved !== true) issues.push("Final legal content approval is required.");
  if (readiness.bmPrivacyNoticeApproved !== true) issues.push("An approved Bahasa Melayu privacy notice is required.");
  if (!["approved", "not-required"].includes(readiness.registration)) issues.push("Legal registration details need approval or an explicit not-required decision.");
  if (readiness.addressDisposition !== undefined
    && (!isOwnerApprovedAddressOmission(readiness.addressDisposition) || readiness.address !== "pending")) issues.push("The owner address-publication disposition is invalid or conflicts with the address state.");
  if (readiness.address !== "approved"
    && !(readiness.address === "pending" && isOwnerApprovedAddressOmission(readiness.addressDisposition))) {
    issues.push("Legal address details need an approved disclosure or owner-approved NOT_PUBLISHED_FOR_V1 disposition.");
  }
  if (readiness.productionRoutesReviewed !== true) issues.push("The final legal routes must be reviewed for production publication; demo preview is insufficient.");
  if (!isLegalCalendarDate(readiness.effectiveDate)) issues.push("The final legal effective date requires owner/legal approval as an exact calendar date (YYYY-MM-DD).");
  if (!isLegalCalendarDate(readiness.lastUpdated)) issues.push("The final legal last-updated date requires owner/legal approval as an exact calendar date (YYYY-MM-DD).");
  return issues;
}
