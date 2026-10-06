export interface OperatorDisclosureDecision {
  kind: "unresolved" | "address" | "reviewed-alternative";
  text: string | null;
  bmText: string | null;
  ownerApprovedForPublicUse: boolean;
  counselApproved: boolean;
}

// A single future insertion point. No address is inferred from registration,
// account data, environment variables or a private/home address.
export const operatorDisclosureDecision: Readonly<OperatorDisclosureDecision> = Object.freeze({
  kind: "unresolved", text: null, bmText: null, ownerApprovedForPublicUse: false, counselApproved: false,
});

export function validateOperatorDisclosure(decision: OperatorDisclosureDecision = operatorDisclosureDecision): string[] {
  const issues: string[] = [];
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
  return Object.freeze({ businessAddress: decision.kind === "address" ? decision.text : null, businessAddressStatus: decision.text! });
}

/** Use separately reviewed BM wording; never translate or infer a disclosure at publication time. */
export function bmLegalOperatorDisclosure(decision: OperatorDisclosureDecision = operatorDisclosureDecision) {
  return validateOperatorDisclosure(decision).length ? "SEMAKAN UNDANG-UNDANG / INPUT PEMILIK DIPERLUKAN" : decision.bmText!;
}
