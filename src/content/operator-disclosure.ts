import { isOwnerApprovedAddressOmission, v1AddressPublicationDisposition, type AddressPublicationDisposition } from "../../functions/src/legal-publication.ts";

export interface OperatorDisclosureDecision {
  kind: "unresolved" | "address" | "reviewed-alternative" | "not-published-for-v1";
  text: string | null;
  bmText: string | null;
  ownerApprovedForPublicUse: boolean;
  counselApproved: boolean;
  addressDisposition?: AddressPublicationDisposition;
}

// Owner-approved V1 omission. Counsel review remains outstanding. No address is
// inferred from registration, account data, environment variables or a home address.
export const operatorDisclosureDecision: Readonly<OperatorDisclosureDecision> = Object.freeze({
  kind: "not-published-for-v1", text: null, bmText: null, ownerApprovedForPublicUse: true, counselApproved: false,
  addressDisposition: v1AddressPublicationDisposition,
});

export function validateOperatorDisclosure(decision: OperatorDisclosureDecision = operatorDisclosureDecision): string[] {
  const issues: string[] = [];
  if (decision.kind === "not-published-for-v1") {
    if (!isOwnerApprovedAddressOmission(decision.addressDisposition) || decision.ownerApprovedForPublicUse !== true
      || decision.counselApproved !== false || decision.text !== null || decision.bmText !== null) {
      issues.push("V1 address omission requires the exact owner decision, no address text and truthful outstanding counsel status.");
    }
    return issues;
  }
  if (decision.addressDisposition !== undefined) issues.push("An address disposition cannot be combined with a different disclosure decision.");
  if (!["address", "reviewed-alternative"].includes(decision.kind)) issues.push("A publishable address or legally reviewed alternative is unresolved.");
  for (const key of ["text", "bmText"] as const) {
    const text = decision[key];
    if (typeof text !== "string" || !text.trim() || text !== text.trim()
      || text.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
      issues.push(`The approved public disclosure ${key} is required.`);
    }
  }
  if (decision.ownerApprovedForPublicUse !== true) issues.push("Owner approval for public use is required.");
  if (decision.counselApproved !== true) issues.push("Counsel approval of the address/disclosure decision is required.");
  return issues;
}

/** Unapproved text never reaches any legal document. This grants no publication permission. */
export function legalOperatorDisclosure(decision: OperatorDisclosureDecision = operatorDisclosureDecision) {
  if (validateOperatorDisclosure(decision).length) return Object.freeze({
    businessAddress: null, businessAddressStatus: "LEGAL REVIEW / OWNER INPUT REQUIRED",
  });
  if (decision.kind === "not-published-for-v1") return Object.freeze({ businessAddress: null, businessAddressStatus: "NOT_PUBLISHED_FOR_V1" });
  return Object.freeze({ businessAddress: decision.kind === "address" ? decision.text : null, businessAddressStatus: decision.text! });
}

/** Use separately reviewed BM wording; never translate or infer a disclosure at publication time. */
export function bmLegalOperatorDisclosure(decision: OperatorDisclosureDecision = operatorDisclosureDecision) {
  return validateOperatorDisclosure(decision).length ? "SEMAKAN UNDANG-UNDANG / INPUT PEMILIK DIPERLUKAN"
    : decision.kind === "not-published-for-v1" ? "NOT_PUBLISHED_FOR_V1" : decision.bmText!;
}

/** Address-only paragraphs never expose an unresolved placeholder or omission marker. */
export function legalSectionParagraphs(section: { paragraphs?: readonly string[]; addressParagraphs?: readonly string[] }, decision: OperatorDisclosureDecision = operatorDisclosureDecision): readonly string[] {
  return !validateOperatorDisclosure(decision).length && ["address", "reviewed-alternative"].includes(decision.kind)
    ? [...(section.paragraphs ?? []), ...(section.addressParagraphs ?? [])] : section.paragraphs ?? [];
}
