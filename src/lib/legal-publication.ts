export type LegalDetailResolution = "pending" | "approved" | "not-required";
export interface LegalPublicationReadiness {
  publicationApproved: boolean;
  finalContentApproved: boolean;
  bmPrivacyNoticeApproved: boolean;
  registration: LegalDetailResolution;
  address: LegalDetailResolution;
  productionRoutesReviewed: boolean;
}

// Separate from acceptance versions: policy approval alone cannot publish drafts.
// "not-required" needs an owner/legal applicability decision, never an inference.
export const legalPublicationReadiness: Readonly<LegalPublicationReadiness> = Object.freeze({
  publicationApproved: false,
  finalContentApproved: false,
  bmPrivacyNoticeApproved: false,
  registration: "pending",
  address: "pending",
  productionRoutesReviewed: false,
});

export function validateLegalPublication(readiness: LegalPublicationReadiness = legalPublicationReadiness): string[] {
  const issues: string[] = [];
  if (readiness.publicationApproved !== true) issues.push("Independent legal publication approval is required.");
  if (readiness.finalContentApproved !== true) issues.push("Final legal content approval is required.");
  if (readiness.bmPrivacyNoticeApproved !== true) issues.push("An approved Bahasa Melayu privacy notice is required.");
  for (const key of ["registration", "address"] as const) if (!["approved", "not-required"].includes(readiness[key])) issues.push(`Legal ${key} details need approval or an explicit not-required decision.`);
  if (readiness.productionRoutesReviewed !== true) issues.push("The final legal routes must be reviewed for production publication; demo preview is insufficient.");
  return issues;
}
